// -----------------------------------------------------------------------------
// BYD answers -> plain values.
//
// A car is described once (`readVehicleInfo`, from the list of the account)
// and read every round into a snapshot (`summarize`) from up to four answers:
// live data, position, charge page and climate status. The meaning of the raw
// fields comes from pyBYD (models/realtime.py and API_MAPPING), checked on
// real cars by its users; a value the cloud marks unknown ("", "--", -1, -129
// for temperatures, 0 for a lock state) is null here, never 0.
// -----------------------------------------------------------------------------

const ENERGY_TYPES = { electric: 0, combustion: 1, hybrid: 2 };
const SENTINELS = new Set(['', '--', 'NaN', 'nan']);
// Tyre pressure unit of the car (tirePressUnit) -> factor to bar.
const TO_BAR = { 1: 1, 2: 0.0689476, 3: 0.01 };
const DOORS = {
  front_left: 'leftFrontDoor',
  front_right: 'rightFrontDoor',
  rear_left: 'leftRearDoor',
  rear_right: 'rightRearDoor',
  sliding: 'slidingDoor',
  trunk: 'trunkLid',
  frunk: 'forehold',
};
const WINDOWS = {
  window_front_left: 'leftFrontWindow',
  window_front_right: 'rightFrontWindow',
  window_rear_left: 'leftRearWindow',
  window_rear_right: 'rightRearWindow',
  sunroof: 'skylight',
};
const LOCKS = ['leftFrontDoorLock', 'rightFrontDoorLock', 'leftRearDoorLock', 'rightRearDoorLock'];
const TYRES = {
  front_left: 'leftFrontTirepressure',
  front_right: 'rightFrontTirepressure',
  rear_left: 'leftRearTirepressure',
  rear_right: 'rightRearTirepressure',
};
// Warning lamps: 0 normal, more than 0 on, -1 unknown.
const WARNINGS = {
  tyre_pressure: 'tirepressureSystem',
  tyre_leak: 'rapidTireLeak',
  power_system: 'powerSystem',
  braking: 'brakingSystem',
  charging_system: 'chargingSystem',
  steering: 'steeringSystem',
  abs: 'abs',
  esp: 'esp',
  eps: 'eps',
  airbag: 'srs',
  service: 'svs',
  coolant: 'ect',
};

/**
 * @description A number, or null when unknown.
 * @param {unknown} value - The raw value.
 * @returns {number|null} The number.
 * @example
 * num('42.5'); // -> 42.5
 */
function num(value) {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return null;
  }
  if (typeof value === 'string' && SENTINELS.has(value.trim())) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * @description A non-negative number, or null (-1 and the like are "unknown").
 * @param {unknown} value - The raw value.
 * @returns {number|null} The number.
 */
function positive(value) {
  const number = num(value);
  return number !== null && number >= 0 ? number : null;
}

/**
 * @description A timestamp (seconds or ms) in ms, null when absent.
 * @param {unknown} value - The raw value.
 * @returns {number|null} The instant.
 */
function instant(value) {
  const number = num(value);
  if (number === null || number <= 0) {
    return null;
  }
  return number >= 1e12 ? number : number * 1000;
}

/**
 * @description The description of a car of the account.
 * @param {object} entry - An entry of getAllListByUserId.
 * @returns {object} `{ vin, model, brand, alias, plate, energyType, isHybrid, imageUrl }`.
 * @example
 * readVehicleInfo({ vin: 'LGX…', modelName: 'ATTO 3', energyType: '0' });
 */
function readVehicleInfo(entry) {
  const energyType = num(entry.energyType);
  const pic = entry.picMainUrl || entry.cfPic?.picMainUrl || '';
  return {
    vin: String(entry.vin),
    model: String(entry.modelName || entry.outModelType || 'BYD').trim(),
    brand: String(entry.brandName || 'BYD').trim(),
    alias: String(entry.autoAlias || '').trim(),
    plate: String(entry.autoPlate || '').trim(),
    energyType: energyType === null ? ENERGY_TYPES.electric : energyType,
    isHybrid: energyType === ENERGY_TYPES.hybrid,
    shared: num(entry.empowerType) !== null && num(entry.empowerType) < 0,
    imageUrl: typeof pic === 'string' && pic.startsWith('https://') ? pic : null,
  };
}

/**
 * @description The position of a GPS answer.
 * @param {object|undefined} gps - The raw answer.
 * @returns {{ latitude: number, longitude: number, at: number|null }|null} The position.
 */
function readLocation(gps) {
  if (!gps || typeof gps !== 'object') {
    return null;
  }
  const data = gps.data && typeof gps.data === 'object' ? { ...gps, ...gps.data } : gps;
  const latitude = num(data.latitude);
  const longitude = num(data.longitude);
  if (
    latitude === null ||
    longitude === null ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }
  return { latitude, longitude, at: instant(data.gpsTimeStamp) };
}

/**
 * @description Open (true), closed (false) or unknown (null) for each opening.
 * @param {object} rt - The live data.
 * @returns {object} The openings, by name.
 */
function readOpenings(rt) {
  const openings = {};
  Object.entries(DOORS).forEach(([name, key]) => {
    const raw = num(rt[key] ?? (key === 'trunkLid' ? rt.backCover : undefined));
    openings[name] = raw === 1 ? true : raw === 0 ? false : null;
  });
  Object.entries(WINDOWS).forEach(([name, key]) => {
    const raw = num(rt[key]);
    openings[name] = raw === 2 ? true : raw === 1 ? false : null;
  });
  return openings;
}

/**
 * @description The lock of the car: locked when every known door is.
 * @param {object} rt - The live data.
 * @returns {'locked'|'unlocked'|null} The lock state.
 */
function readLock(rt) {
  const known = LOCKS.map((key) => num(rt[key])).filter((value) => value === 1 || value === 2);
  if (known.length === 0) {
    return null;
  }
  return known.every((value) => value === 2) ? 'locked' : 'unlocked';
}

/**
 * @description Tyre pressures in bar (rounded to 0.01).
 * @param {object} rt - The live data.
 * @returns {object} The pressures by wheel (null when unknown).
 */
function readTyres(rt) {
  const factor = TO_BAR[num(rt.tirePressUnit)] ?? null;
  const tyres = {};
  Object.entries(TYRES).forEach(([wheel, key]) => {
    const value = positive(rt[key] ?? rt[key.replace('Tirepressure', 'TirePressure')]);
    tyres[wheel] =
      value === null || value === 0 || factor === null
        ? null
        : Math.round(value * factor * 100) / 100;
  });
  return tyres;
}

/**
 * @description The minutes until the battery is full.
 * @param {object} source - Live data or charge page.
 * @returns {number|null} The minutes.
 */
function minutesToFull(source) {
  const hours = positive(source.fullHour);
  const minutes = positive(source.fullMinute);
  return hours === null || minutes === null ? null : hours * 60 + minutes;
}

/**
 * @description The snapshot of a car.
 * @param {object} info - The car description.
 * @param {object} raw - `{ realtime, gps, charging, hvac }` (any may miss).
 * @returns {object} The snapshot.
 * @example
 * summarize(info, { realtime, gps });
 */
function summarize(info, raw = {}) {
  const rt = raw.realtime && typeof raw.realtime === 'object' ? raw.realtime : {};
  const charge = raw.charging && typeof raw.charging === 'object' ? raw.charging : {};
  let hvac = raw.hvac && typeof raw.hvac === 'object' ? raw.hvac : {};
  hvac = hvac.statusNow && typeof hvac.statusNow === 'object' ? hvac.statusNow : hvac;

  const level =
    positive(rt.elecPercent) ??
    positive(rt.powerBattery) ??
    positive(charge.soc ?? charge.elecPercent);
  const range = positive(rt.enduranceMileage) ?? positive(rt.evEndurance);
  const charging =
    num(rt.chargeState) === 1 || num(charge.chargingState) === 1
      ? true
      : num(rt.chargeState) === 0 || num(charge.chargingState) === 0
        ? false
        : null;
  // The charge page says whether the cable is in; the live data only knows
  // it while charging (pyBYD: its "connected" value does not follow the gun).
  const connect = num(charge.connectState);
  let plugged = connect !== null ? connect !== 0 : null;
  if (charging === true) {
    plugged = true;
  }
  let chargeStatus = null;
  if (charging === true) {
    chargeStatus = 'charging';
  } else if (plugged !== null) {
    chargeStatus = plugged ? 'plugged' : 'unplugged';
  }

  const openings = readOpenings(rt);
  const tempInside = num(rt.tempInCar) ?? num(hvac.tempInCar);
  const hvacStatus = num(hvac.status);
  const online = num(rt.onlineState);

  return {
    battery: { level: level === null ? null : Math.min(100, level), rangeKm: range },
    fuel: info.isHybrid
      ? { level: positive(rt.oilPercent), rangeKm: positive(rt.oilEndurance) }
      : { level: null, rangeKm: null },
    odometerKm: positive(rt.totalMileage),
    charge: {
      status: chargeStatus,
      plugged,
      minutesToFull: charging ? (minutesToFull(rt) ?? minutesToFull(charge)) : null,
    },
    lock: readLock(rt),
    openings,
    openList: Object.keys(openings).filter((name) => openings[name] === true),
    climateOn: hvacStatus === 1 ? true : hvacStatus === 2 ? false : null,
    tempInside: tempInside === null || tempInside <= -100 ? null : tempInside,
    tyres: readTyres(rt),
    warnings: Object.keys(WARNINGS).filter((name) => (num(rt[WARNINGS[name]]) ?? 0) > 0),
    online: online === 1 ? true : online === 2 ? false : null,
    location: readLocation(raw.gps),
    updatedAt: instant(rt.time),
  };
}

export {
  ENERGY_TYPES,
  DOORS,
  WINDOWS,
  TYRES,
  WARNINGS,
  num,
  readVehicleInfo,
  readLocation,
  readLock,
  readOpenings,
  readTyres,
  summarize,
};
