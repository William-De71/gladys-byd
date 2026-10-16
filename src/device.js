// -----------------------------------------------------------------------------
// The "BYD <model>" devices.
//
// One device per car of the account (VIN), offered on the Discovery screen.
// A feature appears when the car reports its value at the scan (a plug-in
// hybrid gets its fuel range, a car without a sunroof no sunroof…): scan
// again after a first drive if one is missing.
//
// The categories are the "electrical vehicle" ones of Gladys (the only car
// categories). Fuel and distances use the generic sensors with the `decimal`
// type: `distance-sensor` + `integer` has no icon nor label in the Gladys UI.
// Lock and climate are always commands (read_only false): adding the PIN
// later must not need a new device (Gladys never resyncs read_only); without
// a PIN, a command is refused with a message saying so.
//
// External ids: ext:<selector>:vehicle:<VIN>[:<feature>].
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { t, warningLabel } from './i18n.js';
import { TYRES } from './vehicle.js';

const DEVICE_TYPE = 'vehicle';
const BINARY = { min: 0, max: 1 };

const FEATURE_KEYS = {
  BATTERY_LEVEL: 'battery_level',
  BATTERY_RANGE: 'battery_range',
  FUEL_LEVEL: 'fuel_level',
  FUEL_RANGE: 'fuel_range',
  ODOMETER: 'odometer',
  PLUGGED: 'plugged',
  CHARGING_STATUS: 'charging_status',
  CHARGE_TIME: 'charge_time',
  INDOOR_TEMPERATURE: 'indoor_temperature',
  LOCK: 'lock',
  DOORS: 'doors',
  WINDOWS: 'windows',
  CLIMATE: 'climate',
  WARNINGS: 'warnings',
  DISTANCE_HOME: 'distance_home',
};
const TYRE_FEATURES = Object.keys(TYRES).map((wheel) => `tyre_${wheel}`);

const known = (value) => value !== null && value !== undefined;
const binary = (value) => (value ? 1 : 0);
const DOOR_NAMES = [
  'front_left',
  'front_right',
  'rear_left',
  'rear_right',
  'sliding',
  'trunk',
  'frunk',
];
const WINDOW_NAMES = [
  'window_front_left',
  'window_front_right',
  'window_rear_left',
  'window_rear_right',
  'sunroof',
];

/**
 * @description Whether any of some openings is open (null when none is known).
 * @param {object} openings - The openings of the snapshot.
 * @param {string[]} names - The names.
 * @returns {boolean|null} The answer.
 */
function anyOpen(openings, names) {
  const values = names.map((name) => openings[name]).filter(known);
  return values.length === 0 ? null : values.some(Boolean);
}

// Every feature: its Gladys shape, whether this car has it, and its state.
// `state` returns a number, `{ text }`, or null when unknown (not published).
const FEATURES = [
  {
    key: FEATURE_KEYS.BATTERY_LEVEL,
    name: 'featureBatteryLevel',
    shape: {
      category: CATEGORIES.ELECTRICAL_VEHICLE_BATTERY,
      type: TYPES.ELECTRICAL_VEHICLE_BATTERY.BATTERY_LEVEL,
      unit: UNITS.PERCENT,
      min: 0,
      max: 100,
    },
    has: (s) => known(s.battery.level),
    state: (s) => s.battery.level,
  },
  {
    key: FEATURE_KEYS.BATTERY_RANGE,
    name: 'featureBatteryRange',
    shape: {
      category: CATEGORIES.ELECTRICAL_VEHICLE_BATTERY,
      type: TYPES.ELECTRICAL_VEHICLE_BATTERY.BATTERY_RANGE_ESTIMATE,
      unit: UNITS.KM,
      min: 0,
      max: 1500,
    },
    has: (s) => known(s.battery.rangeKm),
    state: (s) => s.battery.rangeKm,
  },
  {
    key: FEATURE_KEYS.FUEL_LEVEL,
    name: 'featureFuelLevel',
    shape: {
      category: CATEGORIES.LEVEL_SENSOR,
      type: TYPES.LEVEL_SENSOR.LIQUID_LEVEL_PERCENT,
      unit: UNITS.PERCENT,
      min: 0,
      max: 100,
    },
    has: (s) => known(s.fuel.level),
    state: (s) => s.fuel.level,
  },
  {
    key: FEATURE_KEYS.FUEL_RANGE,
    name: 'featureFuelRange',
    shape: {
      category: CATEGORIES.DISTANCE_SENSOR,
      type: TYPES.SENSOR.DECIMAL,
      unit: UNITS.KM,
      min: 0,
      max: 3000,
    },
    has: (s) => known(s.fuel.rangeKm),
    state: (s) => s.fuel.rangeKm,
  },
  {
    key: FEATURE_KEYS.ODOMETER,
    name: 'featureOdometer',
    shape: {
      category: CATEGORIES.ELECTRICAL_VEHICLE_STATE,
      type: TYPES.ELECTRICAL_VEHICLE_STATE.ODOMETER,
      unit: UNITS.KM,
      min: 0,
      max: 2000000,
    },
    has: (s) => known(s.odometerKm),
    state: (s) => s.odometerKm,
  },
  {
    key: FEATURE_KEYS.PLUGGED,
    name: 'featurePlugged',
    shape: {
      category: CATEGORIES.ELECTRICAL_VEHICLE_CHARGE,
      type: TYPES.ELECTRICAL_VEHICLE_CHARGE.PLUGGED,
      ...BINARY,
    },
    has: (s) => known(s.charge.plugged),
    state: (s) => (known(s.charge.plugged) ? binary(s.charge.plugged) : null),
  },
  {
    key: FEATURE_KEYS.CHARGING_STATUS,
    name: 'featureChargingStatus',
    shape: {
      category: CATEGORIES.TEXT,
      type: TYPES.TEXT.TEXT,
      keep_history: false,
      min: 0,
      max: 0,
    },
    has: (s) => known(s.charge.status),
    state: (s, { language }) =>
      known(s.charge.status) ? { text: t(`charge_${s.charge.status}`, language) } : null,
  },
  {
    key: FEATURE_KEYS.CHARGE_TIME,
    name: 'featureChargeTime',
    shape: {
      category: CATEGORIES.DURATION,
      type: TYPES.DURATION.INTEGER,
      unit: UNITS.MINUTES,
      min: 0,
      max: 6000,
    },
    // Only known while charging: offered with the charge status.
    has: (s) => known(s.charge.status),
    state: (s) => (s.charge.status === 'charging' ? (s.charge.minutesToFull ?? null) : 0),
  },
  {
    key: FEATURE_KEYS.INDOOR_TEMPERATURE,
    name: 'featureIndoorTemperature',
    shape: {
      category: CATEGORIES.ELECTRICAL_VEHICLE_CLIMATE,
      type: TYPES.ELECTRICAL_VEHICLE_CLIMATE.INDOOR_TEMPERATURE,
      unit: UNITS.CELSIUS,
      min: -40,
      max: 80,
    },
    has: (s) => known(s.tempInside),
    state: (s) => s.tempInside,
  },
  {
    key: FEATURE_KEYS.LOCK,
    name: 'featureLock',
    // 1 = locked, as the dashboard labels it ("Verrouillée").
    shape: {
      category: CATEGORIES.ELECTRICAL_VEHICLE_COMMAND,
      type: TYPES.ELECTRICAL_VEHICLE_COMMAND.LOCK,
      read_only: false,
      has_feedback: true,
      ...BINARY,
    },
    has: (s) => known(s.lock),
    state: (s) => (known(s.lock) ? binary(s.lock === 'locked') : null),
  },
  {
    key: FEATURE_KEYS.DOORS,
    name: 'featureDoors',
    shape: {
      category: CATEGORIES.ELECTRICAL_VEHICLE_STATE,
      type: TYPES.ELECTRICAL_VEHICLE_STATE.DOOR_OPENED,
      ...BINARY,
    },
    has: (s) => known(anyOpen(s.openings, DOOR_NAMES)),
    state: (s) => {
      const open = anyOpen(s.openings, DOOR_NAMES);
      return known(open) ? binary(open) : null;
    },
  },
  {
    key: FEATURE_KEYS.WINDOWS,
    name: 'featureWindows',
    shape: {
      category: CATEGORIES.ELECTRICAL_VEHICLE_STATE,
      type: TYPES.ELECTRICAL_VEHICLE_STATE.WINDOW_OPENED,
      ...BINARY,
    },
    has: (s) => known(anyOpen(s.openings, WINDOW_NAMES)),
    state: (s) => {
      const open = anyOpen(s.openings, WINDOW_NAMES);
      return known(open) ? binary(open) : null;
    },
  },
  {
    key: FEATURE_KEYS.CLIMATE,
    name: 'featureClimate',
    // The climate status comes from the car when it reports it, else from the
    // last command, trusted for its duration (poller.js).
    shape: {
      category: CATEGORIES.ELECTRICAL_VEHICLE_CLIMATE,
      type: TYPES.ELECTRICAL_VEHICLE_CLIMATE.CLIMATE_ON,
      read_only: false,
      has_feedback: false,
      keep_history: false,
      ...BINARY,
    },
    has: () => true,
    state: (s, { climateOn }) => binary(climateOn),
  },
  ...Object.keys(TYRES).map((wheel) => ({
    key: `tyre_${wheel}`,
    name: `featureTyre_${wheel}`,
    shape: {
      category: CATEGORIES.ELECTRICAL_VEHICLE_STATE,
      type: TYPES.ELECTRICAL_VEHICLE_STATE.TIRE_PRESSURE,
      unit: UNITS.BAR,
      min: 0,
      max: 6,
    },
    has: (s) => known(s.tyres[wheel]),
    state: (s) => s.tyres[wheel],
  })),
  {
    key: FEATURE_KEYS.WARNINGS,
    name: 'featureWarnings',
    shape: {
      category: CATEGORIES.TEXT,
      type: TYPES.TEXT.TEXT,
      keep_history: false,
      min: 0,
      max: 0,
    },
    has: () => true,
    state: (s, { language }) => ({
      text:
        s.warnings.length === 0
          ? t('noWarning', language)
          : s.warnings.map((warning) => warningLabel(warning, language)).join(', '),
    }),
  },
  {
    key: FEATURE_KEYS.DISTANCE_HOME,
    name: 'featureDistanceHome',
    shape: {
      category: CATEGORIES.DISTANCE_SENSOR,
      type: TYPES.SENSOR.DECIMAL,
      unit: UNITS.KM,
      min: 0,
      max: 20000,
    },
    has: (s, { distanceHomeKm }) => known(distanceHomeKm),
    state: (s, { distanceHomeKm }) =>
      known(distanceHomeKm) ? Math.round(distanceHomeKm * 10) / 10 : null,
  },
];

/**
 * @description The external ids of a car.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} vin - The VIN.
 * @returns {{ device: string, feature: Function }} The ids.
 * @example
 * idsOf(gladys, 'LGXCE6CB0P0000001').device; // -> 'ext:byd:vehicle:LGXCE6CB0P0000001'
 */
function idsOf(gladys, vin) {
  return gladys.externalIds(DEVICE_TYPE, vin);
}

/**
 * @description The VIN and feature key an external id stands for.
 * @param {string} externalId - A device or feature external id.
 * @returns {{ vin: string, feature: string|null }|null} Its parts.
 * @example
 * parseExternalId('ext:byd:vehicle:LGXCE6CB0P0000001:lock'); // -> { vin: 'LGX…', feature: 'lock' }
 */
function parseExternalId(externalId) {
  const match = /:vehicle:([A-HJ-NPR-Z0-9]{17})(?::([a-z_]+))?$/.exec(String(externalId ?? ''));
  return match ? { vin: match[1], feature: match[2] ?? null } : null;
}

/**
 * @description The name of a car: "BYD ATTO 3", or its nickname in the app.
 * @param {object} info - The car description.
 * @param {string} language - The language.
 * @returns {string} The name.
 */
function vehicleName(info, language = 'en') {
  const name = t('deviceName', language, { model: info.model });
  return info.alias && info.alias !== info.model ? `${name} (${info.alias})` : name;
}

/**
 * @description Build the device of a car.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} info - The car description (vehicle.js).
 * @param {object} snapshot - Its snapshot.
 * @param {object} context - `{ language, climateOn, distanceHomeKm }`.
 * @returns {object} The discovered device.
 */
function buildDevice(gladys, info, snapshot, context) {
  const ids = idsOf(gladys, info.vin);
  const language = context.language ?? 'en';
  return {
    name: vehicleName(info, language),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: 'BYD_VIN', value: info.vin },
      { name: 'BYD_MODEL', value: info.model },
      { name: 'BYD_ENERGY_TYPE', value: String(info.energyType) },
    ],
    features: FEATURES.filter((feature) => feature.has(snapshot, context)).map((feature) => ({
      name: t(feature.name, language),
      external_id: ids.feature(feature.key),
      read_only: true,
      has_feedback: false,
      keep_history: true,
      ...feature.shape,
    })),
  };
}

/**
 * @description The states of a car. Unknown values are omitted, never sent as 0.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} info - The car description.
 * @param {object} snapshot - Its snapshot.
 * @param {object} context - `{ language, climateOn, distanceHomeKm }`.
 * @param {Set<string>} [only] - Feature external ids to keep (the created ones).
 * @returns {Array<object>} The states.
 */
function buildStates(gladys, info, snapshot, context, only = null) {
  const ids = idsOf(gladys, info.vin);
  const states = [];
  FEATURES.forEach((feature) => {
    const externalId = ids.feature(feature.key);
    if (only && !only.has(externalId)) {
      return;
    }
    const value = feature.state(snapshot, context);
    if (value === null || value === undefined) {
      return;
    }
    if (typeof value === 'object') {
      states.push({ device_feature_external_id: externalId, text: value.text });
    } else if (Number.isFinite(value)) {
      states.push({ device_feature_external_id: externalId, state: value });
    }
  });
  return states;
}

export {
  DEVICE_TYPE,
  FEATURE_KEYS,
  TYRE_FEATURES,
  FEATURES,
  anyOpen,
  idsOf,
  parseExternalId,
  vehicleName,
  buildDevice,
  buildStates,
};
