// -----------------------------------------------------------------------------
// The BYD integration, wired to a Gladys client.
//
// `createApp(gladys)` registers every handler on the client it receives:
// `new GladysIntegration()` in production (index.js), the fake Gladys of the
// SDK in the tests. Nothing here connects: the caller does, once the
// handlers are registered.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger } from '@gladysassistant/integration-sdk';
import {
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  normalizeConfig,
  hasAccount,
  readLanguage,
} from './config.js';
import { createBydClient } from './byd/client.js';
import { regionOf } from './byd/regions.js';
import { createStorage } from './storage.js';
import { createPoller } from './poller.js';
import { summarize } from './vehicle.js';
import {
  FEATURE_KEYS,
  idsOf,
  parseExternalId,
  vehicleName,
  buildDevice,
  buildStates,
} from './device.js';
import { buildSceneEvent, buildAccountProblemEvent } from './events.js';
import { COMMANDS, runCommand } from './commands.js';
import { createPictureRegistry, downloadImage } from './images.js';
import { WIDGETS, WIDGET_ACTIONS, messageContent, buildVehicleWidget } from './widgets.js';
import { SCENE_ACTIONS, buildStatusOutputs } from './scene-actions.js';
import { transportOf } from './transport.js';
import { anonymize } from './diagnostic.js';
import { t, all, each } from './i18n.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const ACTIONS = {
  TEST_CONNECTION: 'test_connection',
  REFRESH: 'refresh',
  DIAGNOSTIC: 'diagnostic',
};
// Unchanged states are published again every hour, so the dashboard never
// shows them as outdated while the car sleeps in the garage.
const HEARTBEAT_MS = 60 * 60 * 1000;
const HOUSES_MAX_AGE_MS = 60 * 60 * 1000;
const START_RETRY_MS = 5 * 60 * 1000;
const DIAGNOSTIC_CHUNK = 800;
const VIN_PATTERN = /[A-HJ-NPR-Z0-9]{17}/g;

/**
 * @description A VIN cut down to its last 4 characters, for the logs.
 * @param {string} text - A text.
 * @returns {string} The text, VINs masked.
 * @example
 * redactVin('LGXCE6CB0P0000001 failed'); // -> '…0001 failed'
 */
function redactVin(text) {
  return String(text ?? '').replace(VIN_PATTERN, (vin) => `…${vin.slice(-4)}`);
}

/**
 * @description Register the handlers of the integration on a Gladys client.
 * @param {object} gladys - The GladysIntegration instance (or the fake one).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetchImpl] - fetch, for the tests.
 * @param {object} [options.storage] - The /data storage, for the tests.
 * @param {Function} [options.sleep] - Waits of the BYD client, for the tests.
 * @returns {{ poller: object, byd: object }} What the tests look into.
 * @example
 * createApp(new GladysIntegration());
 */
export function createApp(gladys, { fetchImpl = fetch, storage = createStorage(), sleep } = {}) {
  let config = normalizeConfig();
  let lastLanguage = 'en';
  let createdDevices = new Set();
  let createdFeatures = new Set();
  let houses = [];
  let housesReadAt = 0;
  let lastStatus = null;
  let startRetry = null;
  let starting = Promise.resolve();
  let loginProblemReported = false;
  const transports = new Map();
  const pictures = createPictureRegistry();

  const byd = createBydClient({
    storage,
    logger,
    fetchImpl,
    appName: `gladys-byd+${version}`,
    ...(sleep ? { sleep } : {}),
  });

  /**
   * @description The language of the texts written outside a widget request.
   * @returns {string} The language.
   */
  function textLanguage() {
    return config.language === AUTO_LANGUAGE ? lastLanguage : config.language;
  }

  /**
   * @description Remember the language of a widget request.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === lastLanguage) {
      return;
    }
    lastLanguage = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description The status message of an error.
   * @param {Error} err - The error.
   * @returns {object} The multi-language message.
   */
  function errorStatus(err) {
    if (err?.kind === 'auth') {
      const at = err.retryAt ? new Date(err.retryAt).toISOString().slice(11, 16) : '…';
      return all('statusLoginRefused', { time: `${at} UTC` });
    }
    if (err?.kind === 'config') {
      return statusOfConfig();
    }
    if (err?.kind === 'busy') {
      return all('statusBusy');
    }
    return all('statusUnreachable');
  }

  /**
   * @description The status of an incomplete configuration.
   * @returns {object|null} The message, null when complete.
   */
  function statusOfConfig() {
    if (!hasAccount(config)) {
      return all('statusNotConfigured');
    }
    if (!regionOf(config.country)) {
      return all('statusBadCountry', { country: config.country });
    }
    return null;
  }

  /**
   * @description Tell the scenes about an account problem, once.
   * @param {string} problem - `login_refused` or `pin_refused`.
   * @returns {Promise<void>}
   */
  async function reportAccountProblem(problem) {
    const { key, data } = buildAccountProblemEvent(problem, textLanguage());
    await gladys
      .publishSceneEvent(key, data)
      .catch((err) => logger.warn(`Unable to publish the scene event ${key}: ${err.message}`));
  }

  /**
   * @description Refresh the houses of Gladys (the home of the cars).
   * @param {boolean} [force] - Even if read recently.
   * @returns {Promise<void>}
   */
  async function refreshHouses(force = false) {
    if (!force && Date.now() - housesReadAt < HOUSES_MAX_AGE_MS) {
      return;
    }
    try {
      houses = await gladys.getHouses();
      housesReadAt = Date.now();
    } catch (err) {
      logger.warn(`Unable to read the houses: ${err.message}`);
    }
  }

  /**
   * @description Refresh the external ids of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
      createdFeatures = new Set(
        devices.flatMap((device) => (device.features ?? []).map((feature) => feature.external_id)),
      );
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  /**
   * @description The context of the states of a car.
   * @param {string} vin - The VIN.
   * @param {object|null} reading - Its reading.
   * @returns {object} The context (device.js).
   */
  function stateContext(vin, reading) {
    return {
      language: textLanguage(),
      climateOn: reading?.climateOn ?? poller.climateOn(vin),
      distanceHomeKm: reading?.distanceHomeKm ?? null,
    };
  }

  /**
   * @description Publish the states of a car that changed (or are an hour old),
   * only for the features the user created.
   * @param {object} info - The car description.
   * @param {object} reading - Its reading.
   * @param {boolean} [force] - Every state, even unchanged.
   * @returns {Promise<boolean>} True when something was published.
   */
  async function publishStates(info, reading, force = false) {
    const states = buildStates(
      gladys,
      info,
      reading.snapshot,
      stateContext(info.vin, reading),
      createdFeatures,
    );
    if (force) {
      gladys.forgetPublishedStates(idsOf(gladys, info.vin).device);
    }
    const { count } = await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
    return count > 0;
  }

  /**
   * @description Publish the transport badge of a car, when it changed.
   * @param {object} info - The car description.
   * @param {object|null} reading - Its last reading.
   * @param {object} [outcome] - Its last read.
   * @returns {Promise<void>}
   */
  async function publishTransport(info, reading, outcome) {
    const externalId = idsOf(gladys, info.vin).device;
    if (!createdDevices.has(externalId)) {
      return;
    }
    const entry = transportOf(externalId, reading, outcome);
    const signature = JSON.stringify(entry);
    if (transports.get(externalId) === signature) {
      return;
    }
    try {
      await gladys.publishTransports([entry]);
      transports.set(externalId, signature);
    } catch (err) {
      logger.warn(`Unable to publish the transport of ${info.model}: ${err.message}`);
    }
  }

  /**
   * @description Offer a device per car on the Discovery screen.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices() {
    const devices = poller
      .list()
      .map(({ info, reading }) =>
        buildDevice(
          gladys,
          info,
          reading?.snapshot ?? summarize(info, {}),
          stateContext(info.vin, reading),
        ),
      );
    await gladys.publishDiscoveredDevices(devices);
    return devices.length;
  }

  /**
   * @description The car a device external id points at; empty = the first car.
   * @param {unknown} deviceExternalId - The `source: "devices"` value.
   * @returns {{ info: object, reading: object|null }|null} The car.
   */
  function resolveCar(deviceExternalId) {
    const parsed = parseExternalId(deviceExternalId);
    if (parsed) {
      return poller.get(parsed.vin);
    }
    return poller.list()[0] ?? null;
  }

  // --- The poller --------------------------------------------------------------------
  const poller = createPoller({
    byd,
    getIntervalMs: () => config.pollInterval * 60 * 1000,
    getHomeRadius: () => config.homeRadius,
    getHouses: () => houses,
    logger,
    onReading: async (info, reading, { events }) => {
      const carName = vehicleName(info, textLanguage());
      const vehicle = idsOf(gladys, info.vin).device;
      for (const event of events) {
        const { key, data } = buildSceneEvent(event, {
          vehicle,
          carName,
          reading,
          language: textLanguage(),
        });
        logger.info(`${carName}: ${key} (${data.summary})`);
        await gladys
          .publishSceneEvent(key, data)
          .catch((err) => logger.warn(`Unable to publish the scene event ${key}: ${err.message}`));
      }
      let changed = false;
      try {
        changed = await publishStates(info, reading);
      } catch (err) {
        logger.warn(`Unable to publish the states of ${carName}: ${err.message}`);
      }
      if (changed || events.length > 0) {
        gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
      }
    },
    onCarRead: async (info, outcome) => {
      // A refused login or a busy cloud says nothing about the car.
      if (outcome.errors.some((err) => ['auth', 'config', 'busy'].includes(err?.kind))) {
        return;
      }
      await publishTransport(info, poller.get(info.vin)?.reading ?? null, outcome);
    },
    onRoundEnd: async ({ errors, succeeded }) => {
      refreshHouses().catch(() => {});
      const authError = errors.find((err) => err?.kind === 'auth');
      if (authError) {
        await reportStatus(false, errorStatus(authError));
        if (!loginProblemReported) {
          loginProblemReported = true;
          await reportAccountProblem('login_refused');
        }
        return;
      }
      if (succeeded === 0 && errors.length > 0) {
        await reportStatus(false, errorStatus(errors[0]));
        return;
      }
      loginProblemReported = false;
      await reportStatus(true, connectedStatus());
    },
  });

  /**
   * @description The "connected" status (with the PIN state).
   * @returns {object} The message.
   */
  function connectedStatus() {
    const count = poller.list().length;
    if (byd.pinRefusal()) {
      return all('statusPinRefused', { count });
    }
    return all(config.pin ? 'statusConnected' : 'statusConnectedReadOnly', { count });
  }

  // --- Start ----------------------------------------------------------------------------

  /**
   * @description Check the setup, list the cars, offer them and start reading.
   * Retried every 5 minutes while BYD cannot be reached.
   * @returns {Promise<void>}
   */
  async function start() {
    clearTimeout(startRetry);
    poller.stop();
    const problem = statusOfConfig();
    if (problem) {
      await reportStatus(false, problem);
      return;
    }
    try {
      const infos = await poller.discover();
      logger.info(
        `${infos.length} car(s): ${infos.map((info) => `${info.model} (…${info.vin.slice(-4)}, energy ${info.energyType})`).join(', ') || 'none'}`,
      );
      await poller.round({ force: true });
      await publishDiscoveredDevices();
      if (infos.length === 0) {
        await reportStatus(true, all('noVehicle'));
      }
      poller.start();
    } catch (err) {
      logger.error(`Unable to read the BYD account: ${redactVin(err.message)}`);
      await reportStatus(false, errorStatus(err));
      if (err?.kind === 'auth' && !loginProblemReported) {
        loginProblemReported = true;
        await reportAccountProblem('login_refused');
      }
      if (err?.kind === 'config') {
        return;
      }
      const wait =
        err?.kind === 'auth' && err.retryAt
          ? Math.max(START_RETRY_MS, err.retryAt - Date.now())
          : START_RETRY_MS;
      startRetry = setTimeout(() => {
        startIfReady().catch((e) => logger.error('Start failed', e));
      }, wait);
      startRetry.unref?.();
    }
  }

  /**
   * @description Start, one at a time.
   * @returns {Promise<void>}
   */
  function startIfReady() {
    starting = starting.catch(() => {}).then(start);
    return starting;
  }

  // --- Commands ---------------------------------------------------------------------

  /**
   * @description Why a command cannot run now, or null.
   * @param {string} language - The language.
   * @returns {string|null} The reason.
   */
  function commandBlocked(language) {
    if (!config.pin) {
      return t(config.pinInvalid ? 'pinInvalid' : 'noPin', language);
    }
    if (byd.pinRefusal()) {
      return t('pinRefused', language);
    }
    return null;
  }

  /**
   * @description What the integration remembers after a command the car ran.
   * @param {object} info - The car description.
   * @param {string} command - The command.
   */
  function afterCommand(info, command) {
    if (command === 'climate_start' || command === 'climate_stop') {
      poller.setClimate(info.vin, command === 'climate_start' ? config.climateDuration : 0);
      const car = poller.get(info.vin);
      if (car?.reading) {
        publishStates(info, car.reading, true).catch(() => {});
      }
    }
    gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
    poller.refreshSoon(info.vin);
  }

  /**
   * @description Handle a failed command: log, status and scenes for a refused PIN.
   * @param {object} info - The car description.
   * @param {string} command - The command.
   * @param {Error} err - The error.
   * @param {boolean} fromScene - Sent by a scene action (no scene event then).
   */
  function commandFailed(info, command, err, fromScene) {
    logger.warn(`${info.model}: ${command} failed: ${redactVin(err.message)}`);
    if (err?.kind === 'pin') {
      reportStatus(true, connectedStatus()).catch(() => {});
      if (!fromScene) {
        reportAccountProblem('pin_refused').catch(() => {});
      }
      gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
    }
  }

  /**
   * @description Options of a command.
   * @returns {object} `{ temperature, minutes }`.
   */
  function commandOptions() {
    return { temperature: config.climateTemperature, minutes: config.climateDuration };
  }

  /**
   * @description Run a command in the background: the car answers far beyond
   * the 5 s a device command may take.
   * @param {object} info - The car description.
   * @param {string} command - The command.
   */
  function runInBackground(info, command) {
    runCommand(byd, info, command, commandOptions())
      .then(() => {
        logger.info(`${info.model}: ${command} done`);
        afterCommand(info, command);
      })
      .catch((err) => {
        commandFailed(info, command, err, false);
        poller.refreshSoon(info.vin, 1000);
      });
  }

  gladys.onSetValue(async (device, feature, value) => {
    const parsed = parseExternalId(feature.external_id);
    const car = parsed ? poller.get(parsed.vin) : null;
    if (!car) {
      throw new Error('Unknown car: scan again');
    }
    let command;
    if (parsed.feature === FEATURE_KEYS.LOCK) {
      command = Number(value) === 1 ? 'lock' : 'unlock';
    } else if (parsed.feature === FEATURE_KEYS.CLIMATE) {
      command = Number(value) === 1 ? 'climate_start' : 'climate_stop';
    } else {
      throw new Error(`${parsed.feature} is read-only`);
    }
    const blocked = commandBlocked('en');
    if (blocked) {
      throw new Error(blocked);
    }
    runInBackground(car.info, command);
  });

  // --- Dashboard widget -------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.VEHICLE, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    if (statusOfConfig()) {
      return messageContent(t('notReady', lang));
    }
    const car = resolveCar(settings.vehicle);
    if (!car) {
      return messageContent(t('noVehicle', lang));
    }
    return buildVehicleWidget({
      info: car.info,
      reading: car.reading,
      imageKey: pictures.register(car.info.imageUrl),
      canCommand: byd.canCommand(),
      settings,
      language: lang,
      now: Date.now(),
    });
  });

  gladys.onWidgetAction(WIDGETS.VEHICLE, async (actionKey, params) => {
    const command = Object.values(WIDGET_ACTIONS).includes(actionKey) ? actionKey : null;
    const car = typeof params?.vin === 'string' ? poller.get(params.vin) : null;
    if (!command || !car) {
      throw new Error(`Unknown action ${actionKey}`);
    }
    const blocked = commandBlocked('en');
    if (blocked) {
      return each((lang) => commandBlocked(lang));
    }
    runInBackground(car.info, command);
    return each((lang) => t('commandSent', lang, { command: t(`command_${command}`, lang) }));
  });

  gladys.onWidgetGetImage(async (imageKey) => {
    const url = pictures.urlOf(imageKey);
    if (url === null) {
      throw new Error(`Unknown image key: ${imageKey}`);
    }
    try {
      return await downloadImage(url, fetchImpl);
    } catch (err) {
      // Not offered again: the card shows without its picture.
      logger.warn(`Car picture unavailable: ${err.message}`);
      pictures.markBroken(imageKey);
      gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
      throw err;
    }
  });

  // --- Scene actions ----------------------------------------------------------------

  /**
   * @description The car of a scene action.
   * @param {unknown} deviceExternalId - The "Car" field.
   * @returns {{ info: object, reading: object|null }} The car.
   */
  function sceneCar(deviceExternalId) {
    const car = resolveCar(deviceExternalId);
    if (!car) {
      throw new Error('No BYD car: check the integration settings');
    }
    return car;
  }

  gladys.onSceneAction(SCENE_ACTIONS.SEND_COMMAND, async (fields) => {
    const { info } = sceneCar(fields.vehicle);
    const command = String(fields.command ?? '');
    if (!COMMANDS.includes(command)) {
      throw new Error(`Unknown command ${command}`);
    }
    const language = textLanguage();
    const label = t(`command_${command}`, language);
    const blocked = commandBlocked(language);
    if (blocked) {
      return { success: false, summary: blocked };
    }
    try {
      await runCommand(byd, info, command, commandOptions());
      afterCommand(info, command);
      return { success: true, summary: t('commandDone', language, { command: label }) };
    } catch (err) {
      commandFailed(info, command, err, true);
      poller.refreshSoon(info.vin, 1000);
      return {
        success: false,
        summary: t(err?.kind === 'pin' ? 'pinRefused' : 'commandFailed', language, {
          command: label,
        }),
      };
    }
  });

  gladys.onSceneAction(SCENE_ACTIONS.GET_STATUS, async (fields) => {
    let car = sceneCar(fields.vehicle);
    if (fields.refresh === true || !car.reading) {
      await poller.round({ force: true, vin: car.info.vin });
      car = poller.get(car.info.vin);
    }
    if (!car?.reading) {
      throw new Error('The car could not be read');
    }
    return buildStatusOutputs({
      reading: car.reading,
      carName: vehicleName(car.info, textLanguage()),
      language: textLanguage(),
    });
  });

  // --- Configuration screen actions ---------------------------------------------------
  gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
    const problem = statusOfConfig();
    if (problem) {
      return problem;
    }
    try {
      const infos = await poller.discover();
      if (infos.length === 0) {
        return all('noVehicle');
      }
      return each((lang) => {
        const list = infos
          .map((info) => `${vehicleName(info, lang)} …${info.vin.slice(-4)}`)
          .join(', ');
        const pin = config.pin ? '' : ` ${t('noPin', lang)}`;
        return `${t('testConnected', lang, { list })}${pin}`;
      });
    } catch (err) {
      logger.warn(`Connection test failed: ${redactVin(err.message)}`);
      return errorStatus(err);
    }
  });

  gladys.onAction(ACTIONS.REFRESH, async () => {
    if (poller.list().length === 0) {
      await startIfReady();
    } else {
      await poller.round({ force: true });
    }
    return all('refreshed', { count: poller.list().length });
  });

  // Gladys gives no way to set DEBUG or LOG_LEVEL on the container: the
  // diagnostic goes to the Logs tab at the info level, on demand, anonymized.
  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const problem = statusOfConfig();
    if (problem) {
      return problem;
    }
    if (poller.list().length === 0) {
      await startIfReady();
    } else {
      await poller.round({ force: true });
    }
    const cars = poller.list();
    if (cars.length === 0) {
      return all('noVehicle');
    }
    logger.info(
      `BYD diagnostic: integration ${version}, server ${byd.region()?.baseUrl}, language ${byd.region()?.language}, PIN ${config.pin ? (byd.pinRefusal() ? `refused (${byd.pinRefusal().code})` : 'set') : 'none'}`,
    );
    cars.forEach(({ info }, index) => {
      const label = `BYD diagnostic ${index + 1}/${cars.length} ${info.model} energy ${info.energyType}`;
      const raw = anonymize(poller.raw(info.vin) ?? {});
      for (const [part, value] of Object.entries(raw)) {
        const json = JSON.stringify(value);
        const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
        for (let chunk = 0; chunk < count; chunk += 1) {
          const suffix = count > 1 ? ` (${chunk + 1}/${count})` : '';
          logger.info(
            `${label} ${part}${suffix}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
          );
        }
      }
    });
    const models = cars.map(({ info }) => info.model).join(', ');
    return all('diagnosticDone', { count: cars.length, list: models });
  });

  // --- Devices ------------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    if (statusOfConfig()) {
      await gladys.publishDiscoveredDevices([]);
      return;
    }
    await poller.discover();
    await poller.round({ force: true });
    const count = await publishDiscoveredDevices();
    logger.info(`Scan: ${count} car(s) offered`);
  });

  // Gladys drops the states of a feature that does not exist yet: publish them
  // all once the car is created, and refresh the widget.
  gladys.onDeviceCreated(async (device) => {
    await refreshCreatedDevices();
    const parsed = parseExternalId(device.external_id);
    const car = parsed ? poller.get(parsed.vin) : null;
    if (car?.reading) {
      await publishStates(car.info, car.reading, true).catch((err) =>
        logger.warn(`Unable to publish the states: ${err.message}`),
      );
    }
    if (car) {
      transports.delete(device.external_id);
      await publishTransport(car.info, car.reading);
    }
    gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration ------------------------------------------------------------------

  /**
   * @description Reload the whole config and hand the account to the client.
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      lastLanguage = readLanguage(raw, lastLanguage);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
    byd.configure({
      username: config.username,
      password: config.password,
      country: config.country,
      pin: config.pin,
    });
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const before = JSON.stringify([config.username, config.password, config.country]);
    await loadConfig(rawConfig);
    logger.info(`Configuration updated: read every ${config.pollInterval} min`);
    lastStatus = null;
    if (before !== JSON.stringify([config.username, config.password, config.country])) {
      poller.stop();
      poller.clear();
      loginProblemReported = false;
      await startIfReady();
    } else if (poller.list().length === 0) {
      await startIfReady();
    } else {
      await reportStatus(true, connectedStatus());
    }
  });

  // --- Connection lifecycle -----------------------------------------------------------
  gladys.on('connected', async () => {
    await loadConfig();
    await refreshHouses(true);
    await refreshCreatedDevices();
    lastStatus = null;
    await startIfReady();
  });

  // --- Graceful shutdown --------------------------------------------------------------
  gladys.handleShutdown((signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    clearTimeout(startRetry);
    poller.stop();
  });

  return { poller, byd };
}

export { redactVin };
