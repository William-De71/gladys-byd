// -----------------------------------------------------------------------------
// Client of the BYD cloud, the one the overseas "BYD" app talks to.
//
// BYD publishes no API: this is a rewrite after pyBYD (MIT, jkaberg, the
// library of the Home Assistant integration hass-byd-vehicle, see NOTICE).
// Every call is a POST of `{"request": <Bangcle envelope>}` whose JSON holds
// signed fields and an AES-encrypted payload (crypto.js, bangcle.js).
//
//   login         /app/account/login  -> user id, signToken, encryToken
//   cars          /app/account/getAllListByUserId
//   live data     /vehicleInfo/vehicle/vehicleRealTimeRequest, then …Result
//   position      /control/getGpsInfo, then …Result
//   charge        /control/smartCharge/homePage
//   climate       /control/getStatusNow
//   PIN check     /vehicle/vehicleswitch/verifyControlPassword
//   commands      /control/remoteControl, then …Result
//
// "Request, then Result": the cloud wakes the car and answers with a
// `requestSerial`; the result is polled with that serial until the car has
// answered. (The app also gets these answers over MQTT; this client polls
// only, which pyBYD keeps as its fallback.)
//
// Account safety:
//   - one login, kept: the session lives in /data/session.json and is reused
//     after a restart, a new login only when the cloud says it expired. With
//     the same account, a login may sign the phone app out;
//   - a refused login pauses every new attempt (15 min, doubling up to 4 h);
//   - a refused PIN (5005 wrong, 5006 locked for the day, 5011) blocks every
//     command until the PIN is changed in the configuration: retrying a wrong
//     PIN locks the remote control of the car.
// -----------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { encodeEnvelope, decodeEnvelope } from './bangcle.js';
import {
  pyJson,
  md5Hex,
  loginKey,
  sign,
  checkcode,
  aesEncryptHex,
  aesDecryptHex,
} from './crypto.js';
import { regionOf } from './regions.js';
import { createDeviceProfile, isDeviceProfile } from './device-profile.js';

const APP_VERSION = '3.5.1';
const APP_INNER_VERSION = '351';
const TBOX_VERSION = '3';
const USER_AGENT = 'okhttp/4.12.0';
const TIMEOUT_MS = 30 * 1000;
const PAUSE_MIN_MS = 15 * 60 * 1000;
const PAUSE_MAX_MS = 4 * 60 * 60 * 1000;
const POLL = { attempts: 10, intervalMs: 1500 };
const RATE_LIMIT = { attempts: 3, delayMs: 5000 };

const CODES = {
  sessionExpired: ['1002', '1005', '1010'],
  notSupported: ['1001'],
  busy: ['1008'],
  unavailable: ['6002', '6051'],
  pin: ['5005', '5006', '5011'],
  rateLimited: ['6024'],
  remote: ['1009'],
};

const ENDPOINTS = {
  LOGIN: '/app/account/login',
  VEHICLES: '/app/account/getAllListByUserId',
  REALTIME: '/vehicleInfo/vehicle/vehicleRealTimeRequest',
  REALTIME_RESULT: '/vehicleInfo/vehicle/vehicleRealTimeResult',
  GPS: '/control/getGpsInfo',
  GPS_RESULT: '/control/getGpsInfoResult',
  CHARGE: '/control/smartCharge/homePage',
  HVAC: '/control/getStatusNow',
  VERIFY_PIN: '/vehicle/vehicleswitch/verifyControlPassword',
  REMOTE: '/control/remoteControl',
  REMOTE_RESULT: '/control/remoteControlResult',
};

// The `commandType` of each remote command.
const REMOTE_COMMANDS = {
  lock: 'LOCKDOOR',
  unlock: 'OPENDOOR',
  climate_start: 'OPENAIR',
  climate_stop: 'CLOSEAIR',
  flash_lights: 'FLASHLIGHTNOWHISTLE',
  find_car: 'FINDCAR',
  close_windows: 'CLOSEWINDOW',
};

/**
 * A failed BYD call. `kind`: auth (login refused or paused), config (missing
 * or unsupported setting), transport (network, HTTP, envelope), session,
 * notSupported, busy, unavailable (car asleep, no GPS fix), pin, rateLimited,
 * remote (command refused or not confirmed), api (anything else).
 */
class BydError extends Error {
  /**
   * @param {string} message - English, for the logs (never a secret).
   * @param {object} details - `{ kind, code, endpoint, retryAt }`.
   */
  constructor(message, { kind, code = '', endpoint = '', retryAt = 0 } = {}) {
    super(message);
    this.name = 'BydError';
    this.kind = kind;
    this.code = String(code);
    this.endpoint = endpoint;
    this.retryAt = retryAt;
  }
}

/**
 * @description The error of a non-zero answer code.
 * @param {string} endpoint - The endpoint.
 * @param {string} code - The code.
 * @param {string} message - The message of the cloud.
 * @param {boolean} remote - A command endpoint (1001 is a refusal there).
 * @returns {BydError} The error.
 */
function errorOf(endpoint, code, message, remote) {
  const text = `${endpoint} failed: code=${code}${message ? ` message=${message}` : ''}`;
  const find = (kind) => CODES[kind].includes(code);
  let kind = 'api';
  if (find('sessionExpired')) {
    kind = 'session';
  } else if (find('pin')) {
    kind = 'pin';
  } else if (find('rateLimited')) {
    kind = 'rateLimited';
  } else if (remote && (find('remote') || find('notSupported'))) {
    kind = 'remote';
  } else if (find('notSupported')) {
    kind = 'notSupported';
  } else if (find('busy')) {
    kind = 'busy';
  } else if (find('unavailable')) {
    kind = 'unavailable';
  }
  return new BydError(text, { kind, code, endpoint });
}

/**
 * @description Whether a remote command result is final, and how.
 * @param {object} data - The result payload.
 * @returns {'pending'|'success'|'failure'} The state.
 * @example
 * remoteState({ controlState: 1 }); // -> 'success'
 */
function remoteState(data) {
  if (!data || typeof data !== 'object') {
    return 'pending';
  }
  if (data.controlState !== undefined && data.controlState !== null) {
    const state = Number(data.controlState);
    return state === 1 ? 'success' : state === 2 ? 'failure' : 'pending';
  }
  if (data.res !== undefined && data.res !== null) {
    const res = Number(data.res);
    return res === 1 ? 'pending' : res === 2 ? 'success' : 'failure';
  }
  return 'pending';
}

/**
 * @description Whether a live data answer holds the data (not only a serial).
 * @param {object} data - The answer.
 * @returns {boolean} True when ready.
 */
function realtimeReady(data) {
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return false;
  }
  if (Number(data.onlineState) === 2) {
    return false;
  }
  const tyres = [
    'leftFrontTirepressure',
    'rightFrontTirepressure',
    'leftRearTirepressure',
    'rightRearTirepressure',
  ];
  return (
    tyres.some((key) => Number(data[key]) > 0) ||
    Number(data.time) > 0 ||
    Number(data.enduranceMileage) > 0
  );
}

/**
 * @description Whether a position answer holds the data.
 * @param {object} data - The answer.
 * @returns {boolean} True when ready.
 */
function gpsReady(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const keys = Object.keys(data).filter((key) => key !== 'requestSerial');
  return keys.length > 0;
}

/**
 * @description Create the client.
 * @param {object} options - Options.
 * @param {object} options.storage - `{ read, write }` (storage.js).
 * @param {object} options.logger - The logger.
 * @param {string} options.appName - Client name sent at login.
 * @param {Function} [options.fetchImpl] - fetch, for the tests.
 * @param {Function} [options.now] - Clock (ms).
 * @param {Function} [options.sleep] - `(ms) => Promise`, for the tests.
 * @param {string} [options.timeZone] - IANA time zone sent at login.
 * @param {Function} [options.randomHex] - The `random` field, for the tests.
 * @returns {object} The client.
 * @example
 * const byd = createBydClient({ storage, logger, appName: 'gladys-byd+0.1.0' });
 */
function createBydClient({
  storage,
  logger,
  appName,
  fetchImpl = fetch,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
  randomHex = () => randomBytes(16).toString('hex').toUpperCase(),
}) {
  let credentials = { username: '', password: '', country: '', pin: '' };
  let region = null;
  let device = null;
  let session = null;
  let sessionLoaded = false;
  let loggingIn = null;
  let pausedUntil = 0;
  let pauseMs = PAUSE_MIN_MS;
  let pinVerified = false;
  let pinBlocked = null;

  // The account a stored session belongs to (never the password).
  const accountOf = () => md5Hex(`${credentials.username}|${region?.baseUrl ?? ''}`);

  /**
   * @description The phone identity, drawn once and stored.
   * @returns {Promise<object>} The profile.
   */
  async function deviceProfile() {
    if (device) {
      return device;
    }
    const stored = await storage.read('device.json');
    if (isDeviceProfile(stored)) {
      device = stored;
    } else {
      device = createDeviceProfile();
      await storage
        .write('device.json', device)
        .catch((err) => logger.warn(`BYD: the phone identity could not be saved: ${err.message}`));
    }
    return device;
  }

  /**
   * @description POST an envelope and decode the answer.
   * @param {string} endpoint - The endpoint.
   * @param {object} outer - The outer payload.
   * @returns {Promise<object>} The decoded answer.
   */
  async function post(endpoint, outer) {
    let response;
    try {
      response = await fetchImpl(`${region.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'accept-encoding': 'identity',
          'content-type': 'application/json; charset=UTF-8',
          'user-agent': USER_AGENT,
        },
        body: JSON.stringify({ request: encodeEnvelope(pyJson(outer)) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new BydError(`${endpoint} unreachable: ${err.message}`, {
        kind: 'transport',
        endpoint,
      });
    }
    const text = await response.text();
    if (!response.ok) {
      throw new BydError(`${endpoint} answered HTTP ${response.status}`, {
        kind: 'transport',
        code: response.status,
        endpoint,
      });
    }
    try {
      const body = JSON.parse(text);
      let decoded = decodeEnvelope(body.response).trim();
      // Some answers carry a stray "F" before the JSON.
      if (decoded.startsWith('F{') || decoded.startsWith('F[')) {
        decoded = decoded.slice(1);
      }
      return JSON.parse(decoded);
    } catch (err) {
      throw new BydError(`${endpoint} answered an unreadable envelope: ${err.message}`, {
        kind: 'transport',
        endpoint,
      });
    }
  }

  /**
   * @description Sign in, at most one at a time.
   * @returns {Promise<object>} The session.
   */
  async function login() {
    if (pausedUntil > now()) {
      throw new BydError('BYD login paused after a refusal', {
        kind: 'auth',
        retryAt: pausedUntil,
      });
    }
    const profile = await deviceProfile();
    const timestamp = String(now());
    const inner = {
      agreeStatus: '0',
      agreementType: '[1,2]',
      appInnerVersion: APP_INNER_VERSION,
      appVersion: APP_VERSION,
      deviceName: `${profile.mobileBrand}${profile.mobileModel}`,
      deviceType: profile.deviceType,
      imeiMD5: profile.imeiMd5,
      isAuto: '1',
      mobileBrand: profile.mobileBrand,
      mobileModel: profile.mobileModel,
      networkType: profile.networkType,
      osType: profile.osType,
      osVersion: profile.osVersion,
      random: randomHex(),
      softType: '0',
      timeStamp: timestamp,
      timeZone,
    };
    const common = {
      appName,
      countryCode: region.country,
      functionType: 'pwdLogin',
      identifier: credentials.username,
      identifierType: '0',
      language: region.language,
      reqTimestamp: timestamp,
    };
    const outer = {
      appName,
      countryCode: region.country,
      encryData: aesEncryptHex(pyJson(inner), loginKey(credentials.password)),
      functionType: 'pwdLogin',
      identifier: credentials.username,
      identifierType: '0',
      imeiMD5: profile.imeiMd5,
      isAuto: '1',
      language: region.language,
      reqTimestamp: timestamp,
      sign: sign({ ...inner, ...common }, md5Hex(credentials.password)),
      signKey: credentials.password,
      ostype: profile.ostype,
      imei: profile.imei,
      mac: profile.mac,
      model: profile.model,
      sdk: profile.sdk,
      mod: profile.mod,
      serviceTime: String(now()),
    };
    outer.checkcode = checkcode(outer);
    const answer = await post(ENDPOINTS.LOGIN, outer);
    let token = null;
    if (String(answer.code) === '0' && answer.respondData) {
      try {
        token = JSON.parse(aesDecryptHex(answer.respondData, loginKey(credentials.password))).token;
      } catch {
        token = null;
      }
    }
    if (!token?.userId || !token?.signToken || !token?.encryToken) {
      pausedUntil = now() + pauseMs;
      const minutes = Math.round(pauseMs / 60000);
      pauseMs = Math.min(PAUSE_MAX_MS, pauseMs * 2);
      throw new BydError(
        `BYD login refused (code=${answer.code ?? '?'}${answer.message ? ` message=${answer.message}` : ''}), next attempt in ${minutes} min`,
        { kind: 'auth', code: answer.code ?? '', endpoint: ENDPOINTS.LOGIN, retryAt: pausedUntil },
      );
    }
    pausedUntil = 0;
    pauseMs = PAUSE_MIN_MS;
    session = {
      account: accountOf(),
      userId: String(token.userId),
      signToken: String(token.signToken),
      encryToken: String(token.encryToken),
      createdAt: now(),
    };
    await storage
      .write('session.json', session)
      .catch((err) => logger.warn(`BYD: the session could not be saved: ${err.message}`));
    logger.info('BYD: signed in');
    return session;
  }

  /**
   * @description The current session: stored, or a new login.
   * @returns {Promise<object>} The session.
   */
  async function ensureSession() {
    if (!region) {
      throw new BydError('No BYD server for this country', { kind: 'config' });
    }
    if (!credentials.username || !credentials.password) {
      throw new BydError('BYD account not configured', { kind: 'config' });
    }
    if (!session && !sessionLoaded) {
      sessionLoaded = true;
      const stored = await storage.read('session.json');
      if (stored?.account === accountOf() && stored.userId && stored.encryToken) {
        session = stored;
      }
    }
    if (session) {
      return session;
    }
    loggingIn ??= login().finally(() => {
      loggingIn = null;
    });
    return loggingIn;
  }

  /**
   * @description Forget the session (expired).
   * @returns {Promise<void>}
   */
  async function dropSession() {
    session = null;
    await storage.write('session.json', null).catch(() => {});
  }

  /**
   * @description The common fields of a payload.
   * @param {object} profile - The phone identity.
   * @param {object} [extra] - More fields.
   * @returns {object} The payload.
   */
  function innerOf(profile, extra = {}) {
    return {
      deviceType: profile.deviceType,
      imeiMD5: profile.imeiMd5,
      networkType: profile.networkType,
      random: randomHex(),
      timeStamp: String(now()),
      version: APP_INNER_VERSION,
      ...extra,
    };
  }

  /**
   * @description A signed call, with one new login when the session expired.
   * @param {string} endpoint - The endpoint.
   * @param {object} extra - Payload fields besides the common ones.
   * @param {object} [options] - `{ remote }`.
   * @returns {Promise<unknown>} The decrypted `respondData` ({} when empty).
   */
  async function call(endpoint, extra, { remote = false } = {}) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const current = await ensureSession();
      const profile = await deviceProfile();
      const inner = innerOf(profile, extra);
      const contentKey = md5Hex(current.encryToken);
      const timestamp = String(now());
      const outer = {
        countryCode: region.country,
        encryData: aesEncryptHex(pyJson(inner), contentKey),
        identifier: current.userId,
        imeiMD5: profile.imeiMd5,
        language: region.language,
        reqTimestamp: timestamp,
        sign: sign(
          {
            ...inner,
            countryCode: region.country,
            identifier: current.userId,
            imeiMD5: profile.imeiMd5,
            language: region.language,
            reqTimestamp: timestamp,
          },
          md5Hex(current.signToken),
        ),
        ostype: profile.ostype,
        imei: profile.imei,
        mac: profile.mac,
        model: profile.model,
        sdk: profile.sdk,
        mod: profile.mod,
        serviceTime: String(now()),
      };
      outer.checkcode = checkcode(outer);
      const answer = await post(endpoint, outer);
      const code = String(answer.code ?? '');
      if (code !== '0') {
        const error = errorOf(endpoint, code, answer.message ?? '', remote);
        if (error.kind === 'session' && attempt === 0) {
          logger.info('BYD: session expired, signing in again');
          await dropSession();
          continue;
        }
        throw error;
      }
      if (typeof answer.respondData !== 'string' || answer.respondData === '') {
        return {};
      }
      const text = aesDecryptHex(answer.respondData, contentKey).trim();
      if (!text) {
        return {};
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new BydError(`${endpoint} answered data that is not JSON`, { kind: 'api', endpoint });
      }
    }
    throw new BydError(`${endpoint}: session refused twice`, { kind: 'session', endpoint });
  }

  /**
   * @description Request, then poll the result with the serial until ready.
   * @param {string} trigger - The request endpoint.
   * @param {string} result - The result endpoint.
   * @param {object} extra - Payload fields.
   * @param {Function} ready - `(data) => boolean`.
   * @returns {Promise<object>} The last answer ({} when none).
   */
  async function triggerAndPoll(trigger, result, extra, ready) {
    let latest = await call(trigger, extra);
    latest = latest && typeof latest === 'object' && !Array.isArray(latest) ? latest : {};
    if (ready(latest)) {
      return latest;
    }
    let serial = typeof latest.requestSerial === 'string' ? latest.requestSerial : null;
    if (!serial) {
      return latest;
    }
    let unavailable = 0;
    for (let attempt = 0; attempt < POLL.attempts; attempt += 1) {
      await sleep(POLL.intervalMs);
      try {
        const data = await call(result, { ...extra, requestSerial: serial });
        unavailable = 0;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          latest = data;
          serial = typeof data.requestSerial === 'string' ? data.requestSerial : serial;
          if (ready(data)) {
            return data;
          }
        }
      } catch (err) {
        if (err.kind !== 'unavailable') {
          throw err;
        }
        unavailable += 1;
        if (unavailable >= 2) {
          throw err;
        }
      }
    }
    return latest;
  }

  /**
   * @description Check the PIN once per client, before the first command.
   * @param {string} vin - The VIN.
   * @returns {Promise<void>}
   */
  async function verifyPin(vin) {
    if (pinBlocked) {
      throw pinBlocked;
    }
    if (!credentials.pin) {
      throw new BydError('No remote control PIN configured', { kind: 'pin', code: 'no_pin' });
    }
    if (pinVerified) {
      return;
    }
    try {
      await call(ENDPOINTS.VERIFY_PIN, {
        vin,
        commandPwd: md5Hex(credentials.pin),
        functionType: 'remoteControl',
      });
      pinVerified = true;
    } catch (err) {
      if (err.kind === 'pin') {
        pinBlocked = err;
      }
      throw err;
    }
  }

  return {
    /**
     * @description Set the account. A change of account or server forgets
     * the session; a change of PIN lifts the PIN block.
     * @param {object} next - `{ username, password, country, pin }`.
     */
    configure(next) {
      const before = JSON.stringify([
        credentials.username,
        credentials.password,
        credentials.country,
      ]);
      const pinBefore = credentials.pin;
      credentials = {
        username: String(next.username ?? '').trim(),
        password: String(next.password ?? ''),
        country: String(next.country ?? '').trim(),
        pin: String(next.pin ?? '').trim(),
      };
      region = regionOf(credentials.country);
      if (
        before !== JSON.stringify([credentials.username, credentials.password, credentials.country])
      ) {
        session = null;
        sessionLoaded = false;
        pausedUntil = 0;
        pauseMs = PAUSE_MIN_MS;
        pinVerified = false;
      }
      if (pinBefore !== credentials.pin) {
        pinBlocked = null;
        pinVerified = false;
      }
    },

    /** @returns {object|null} `{ country, baseUrl, language }`. */
    region: () => region,

    /** @returns {number} End of the login pause (ms), 0 when none. */
    pausedUntil: () => (pausedUntil > now() ? pausedUntil : 0),

    /** @returns {boolean} Whether a PIN is set and not refused. */
    canCommand: () => Boolean(credentials.pin) && !pinBlocked,

    /** @returns {BydError|null} The refusal of the PIN. */
    pinRefusal: () => pinBlocked,

    /**
     * @description The cars of the account.
     * @returns {Promise<object[]>} The raw entries.
     */
    async listVehicles() {
      const data = await call(ENDPOINTS.VEHICLES, {});
      return Array.isArray(data)
        ? data.filter((entry) => entry && typeof entry.vin === 'string')
        : [];
    },

    /**
     * @description The live data of a car (wakes it).
     * @param {string} vin - The VIN.
     * @param {number} energyType - 0 electric, 2 hybrid (vehicle list).
     * @returns {Promise<object>} The raw data.
     */
    getRealtime(vin, energyType = 0) {
      return triggerAndPoll(
        ENDPOINTS.REALTIME,
        ENDPOINTS.REALTIME_RESULT,
        { vin, energyType: String(energyType), tboxVersion: TBOX_VERSION },
        realtimeReady,
      );
    },

    /**
     * @description The position of a car.
     * @param {string} vin - The VIN.
     * @returns {Promise<object>} The raw data (`data` holds the position).
     */
    getGps(vin) {
      return triggerAndPoll(ENDPOINTS.GPS, ENDPOINTS.GPS_RESULT, { vin }, gpsReady);
    },

    /**
     * @description The charge page of a car.
     * @param {string} vin - The VIN.
     * @returns {Promise<object>} The raw data.
     */
    async getCharging(vin) {
      const data = await call(ENDPOINTS.CHARGE, { vin });
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    },

    /**
     * @description The climate status of a car.
     * @param {string} vin - The VIN.
     * @returns {Promise<object>} The raw status (`statusNow` unwrapped).
     */
    async getHvac(vin) {
      const data = await call(ENDPOINTS.HVAC, { vin });
      if (data && typeof data.statusNow === 'object' && data.statusNow !== null) {
        return data.statusNow;
      }
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    },

    /**
     * @description Run a remote command and wait for the car.
     * @param {string} vin - The VIN.
     * @param {string} command - A REMOTE_COMMANDS key.
     * @param {object} [params] - The `controlParamsMap`.
     * @returns {Promise<object>} The final result.
     * @throws {BydError} `pin`, `rateLimited` or `remote` when not carried out.
     */
    async remoteControl(vin, command, params = null) {
      const commandType = REMOTE_COMMANDS[command];
      if (!commandType) {
        throw new BydError(`Unknown command ${command}`, { kind: 'config' });
      }
      await verifyPin(vin);
      const extra = { vin, commandPwd: md5Hex(credentials.pin), commandType };
      if (params) {
        const sorted = Object.fromEntries(
          Object.keys(params)
            .sort()
            .map((key) => [key, params[key]]),
        );
        extra.controlParamsMap = pyJson(sorted);
      }
      let first;
      for (let attempt = 1; ; attempt += 1) {
        try {
          first = await call(ENDPOINTS.REMOTE, extra, { remote: true });
          break;
        } catch (err) {
          if (err.kind === 'pin') {
            pinBlocked = err;
          }
          if (err.kind !== 'rateLimited' || attempt >= RATE_LIMIT.attempts) {
            throw err;
          }
          await sleep(RATE_LIMIT.delayMs);
        }
      }
      let latest = first && typeof first === 'object' ? first : {};
      const serial = typeof latest.requestSerial === 'string' ? latest.requestSerial : null;
      for (
        let attempt = 0;
        remoteState(latest) === 'pending' && attempt < POLL.attempts;
        attempt += 1
      ) {
        if (!serial) {
          throw new BydError(`${command} could not be confirmed (no request serial)`, {
            kind: 'remote',
            code: 'no_serial',
            endpoint: ENDPOINTS.REMOTE,
          });
        }
        await sleep(POLL.intervalMs);
        try {
          const data = await call(
            ENDPOINTS.REMOTE_RESULT,
            { ...extra, requestSerial: serial },
            { remote: true },
          );
          if (data && typeof data === 'object') {
            latest = data;
          }
        } catch (err) {
          if (err.kind === 'session' || err.kind === 'pin' || err.kind === 'auth') {
            throw err;
          }
        }
      }
      const state = remoteState(latest);
      if (state === 'success') {
        return latest;
      }
      throw new BydError(
        state === 'failure'
          ? `${command} refused by the car`
          : `${command} not confirmed in time (car asleep or offline?)`,
        {
          kind: 'remote',
          code: state === 'failure' ? '2' : 'timeout',
          endpoint: ENDPOINTS.REMOTE_RESULT,
        },
      );
    },
  };
}

export {
  APP_VERSION,
  ENDPOINTS,
  REMOTE_COMMANDS,
  CODES,
  BydError,
  errorOf,
  remoteState,
  realtimeReady,
  gpsReady,
  createBydClient,
};
