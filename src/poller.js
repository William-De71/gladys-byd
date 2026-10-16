// -----------------------------------------------------------------------------
// Reading the cars on a loop.
//
// BYD pushes nothing to the integration (the app's MQTT channel is not used):
// every `poll_interval` minutes (15 by default) each car is read — live data,
// position, charge page and climate status. Each reading wakes the car up,
// which costs a little of its battery: Home Assistant users measured about
// 0.1 kWh an hour when reading every 5 minutes.
//
// One failing call does not fail the car (its last good answer is kept); an
// endpoint the car does not support (code 1001) is not asked again until the
// next restart; a refused login pauses everything (the client counts the
// pause); a busy cloud (1008) waits for the next round. A command asks for a
// reading a little later (`refreshSoon`), so the dashboard shows its effect.
// -----------------------------------------------------------------------------

import { readVehicleInfo, summarize } from './vehicle.js';
import { detectEvents } from './events.js';
import { nearestHouse, isHome } from './geo.js';

const TICK_MS = 30 * 1000;
// A reading due within this margin is read now (timers drift).
const DUE_MARGIN_MS = 15 * 1000;
const PARTS = ['realtime', 'gps', 'charging', 'hvac'];

/**
 * @description Create the poller.
 * @param {object} options - Options.
 * @param {object} options.byd - The BYD client.
 * @param {Function} options.getIntervalMs - `() => number`.
 * @param {Function} options.getHomeRadius - `() => number`, meters.
 * @param {Function} options.getHouses - `() => Array`, the houses of Gladys.
 * @param {Function} options.onReading - `async (info, reading, { events, previous })`.
 * @param {Function} [options.onCarRead] - `async (info, { errors, succeeded })`.
 * @param {Function} [options.onRoundEnd] - `async ({ errors, succeeded })`.
 * @param {object} options.logger - The logger.
 * @param {Function} [options.now] - Clock, for the tests.
 * @returns {object} The poller.
 */
function createPoller({
  byd,
  getIntervalMs,
  getHomeRadius,
  getHouses,
  onReading,
  onCarRead = async () => {},
  onRoundEnd = async () => {},
  logger,
  now = Date.now,
}) {
  const cars = new Map();
  let timer = null;
  let running = null;
  let started = false;

  /**
   * @description Read the four answers of a car.
   * @param {object} car - The car state.
   * @returns {Promise<{ errors: Error[], succeeded: number }>} The outcome.
   */
  async function readCar(car) {
    const { info } = car;
    const errors = [];
    let succeeded = 0;
    for (const part of PARTS) {
      if (car.unsupported.has(part)) {
        continue;
      }
      try {
        let value;
        if (part === 'realtime') {
          value = await byd.getRealtime(info.vin, info.energyType);
        } else if (part === 'gps') {
          value = await byd.getGps(info.vin);
        } else if (part === 'charging') {
          value = await byd.getCharging(info.vin);
        } else {
          value = await byd.getHvac(info.vin);
        }
        car.raw[part] = value;
        succeeded += 1;
      } catch (err) {
        if (err?.kind === 'notSupported') {
          car.unsupported.add(part);
          logger.info(`${info.model}: ${part} not offered for this car`);
          continue;
        }
        errors.push(err);
        // Account problems stop the round: every other call would fail too.
        if (err?.kind === 'auth' || err?.kind === 'config' || err?.kind === 'session') {
          break;
        }
      }
    }
    car.readAt = now();
    return { errors, succeeded };
  }

  /**
   * @description The reading of a car from its raw answers.
   * @param {object} car - The car state.
   * @returns {object} `{ snapshot, distanceHomeKm, atHome, climateOn, readAt }`.
   */
  function readingOf(car) {
    const snapshot = summarize(car.info, car.raw);
    const nearest = nearestHouse(snapshot.location, getHouses());
    const distanceHomeKm = nearest ? nearest.distanceKm : null;
    // The car's own climate status wins; else the last command, for its run time.
    const climateOn = snapshot.climateOn ?? car.climateUntil > now();
    return {
      snapshot,
      distanceHomeKm,
      atHome: isHome(distanceHomeKm, getHomeRadius(), car.reading?.atHome ?? null),
      climateOn,
      readAt: now(),
    };
  }

  /**
   * @description Read every car whose reading is due (or all, forced).
   * @param {object} [options] - `{ force, vin }`.
   * @returns {Promise<void>}
   */
  async function doRound({ force = false, vin = null } = {}) {
    if (cars.size === 0) {
      return;
    }
    const errors = [];
    let succeeded = 0;
    let readAny = false;
    for (const car of cars.values()) {
      if (vin && car.info.vin !== vin) {
        continue;
      }
      const due =
        force || car.dueAt <= now() || now() - car.readAt >= getIntervalMs() - DUE_MARGIN_MS;
      if (!due) {
        continue;
      }
      car.dueAt = Infinity;
      readAny = true;
      const outcome = await readCar(car);
      errors.push(...outcome.errors);
      succeeded += outcome.succeeded;
      outcome.errors.forEach((err) => logger.warn(`${car.info.model}: ${err.message}`));
      if (outcome.succeeded > 0 && car.raw.realtime) {
        const previous = car.reading;
        const reading = readingOf(car);
        car.reading = reading;
        try {
          await onReading(car.info, reading, { events: detectEvents(previous, reading), previous });
        } catch (err) {
          logger.error(`Unable to handle the reading of ${car.info.model}`, err);
        }
      }
      try {
        await onCarRead(car.info, outcome);
      } catch (err) {
        logger.error(`Unable to handle the outcome of ${car.info.model}`, err);
      }
      if (outcome.errors.some((err) => err?.kind === 'auth' || err?.kind === 'config')) {
        break;
      }
    }
    if (!readAny) {
      return;
    }
    try {
      await onRoundEnd({ errors, succeeded });
    } catch (err) {
      logger.error('Round end failed', err);
    }
  }

  /**
   * @description Run a round, one at a time.
   * @param {object} [options] - `{ force, vin }`.
   * @returns {Promise<void>}
   */
  async function round(options = {}) {
    while (running) {
      await running.catch(() => {});
    }
    running = doRound(options).finally(() => {
      running = null;
    });
    return running;
  }

  /** @description Schedule the next tick. */
  function schedule() {
    if (!started) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await round().catch((err) => logger.error('BYD round failed', err));
      schedule();
    }, TICK_MS);
    timer.unref?.();
  }

  return {
    /**
     * @description List the cars of the account. Keeps the cars already known.
     * @returns {Promise<object[]>} The car descriptions.
     */
    async discover() {
      const entries = await byd.listVehicles();
      const infos = entries.map(readVehicleInfo);
      infos.forEach((info) => {
        const car = cars.get(info.vin) ?? {
          raw: {},
          readAt: 0,
          dueAt: 0,
          reading: null,
          climateUntil: 0,
          unsupported: new Set(),
        };
        car.info = info;
        cars.set(info.vin, car);
      });
      const vins = infos.map((info) => info.vin);
      [...cars.keys()].filter((vin) => !vins.includes(vin)).forEach((vin) => cars.delete(vin));
      return infos;
    },

    round,

    /** @description Start the loop. */
    start() {
      started = true;
      schedule();
    },

    /** @description Stop the loop. */
    stop() {
      started = false;
      clearTimeout(timer);
      timer = null;
    },

    /** @description Forget the cars (account changed). */
    clear() {
      cars.clear();
    },

    /**
     * @description Ask for a reading of a car soon (after a command).
     * @param {string} vin - The VIN.
     * @param {number} [delayMs] - The delay.
     */
    refreshSoon(vin, delayMs = 30000) {
      const car = cars.get(vin);
      if (!car) {
        return;
      }
      car.dueAt = now() + delayMs;
      const refresh = setTimeout(() => {
        round({ vin }).catch((err) => logger.error('BYD refresh failed', err));
      }, delayMs);
      refresh.unref?.();
    },

    /**
     * @description Remember a climate start (minutes) or stop (0).
     * @param {string} vin - The VIN.
     * @param {number} minutes - How long it runs.
     */
    setClimate(vin, minutes) {
      const car = cars.get(vin);
      if (car) {
        car.climateUntil = minutes > 0 ? now() + minutes * 60 * 1000 : 0;
        if (car.reading) {
          car.reading = { ...car.reading, climateOn: minutes > 0 };
        }
      }
    },

    /**
     * @description Whether the climate of a car is (believed) on.
     * @param {string} vin - The VIN.
     * @returns {boolean} The state.
     */
    climateOn(vin) {
      const car = cars.get(vin);
      return Boolean(car?.reading?.climateOn ?? (car?.climateUntil ?? 0) > now());
    },

    /**
     * @description The raw answers of a car (diagnostic).
     * @param {string} vin - The VIN.
     * @returns {object|null} The raw answers.
     */
    raw(vin) {
      const car = cars.get(vin);
      return car ? { ...car.raw, unsupported: [...car.unsupported] } : null;
    },

    /**
     * @param {string} vin - The VIN.
     * @returns {{ info: object, reading: object|null }|null} The car.
     */
    get(vin) {
      const car = cars.get(vin);
      return car ? { info: car.info, reading: car.reading } : null;
    },

    /** @returns {Array<{ info: object, reading: object|null }>} Every car. */
    list() {
      return [...cars.values()].map((car) => ({ info: car.info, reading: car.reading }));
    },
  };
}

export { TICK_MS, PARTS, createPoller };
