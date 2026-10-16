// -----------------------------------------------------------------------------
// Scene triggers: what changed between two readings of a car.
//
// The integration compares each reading with the previous one. The first
// reading after a start is a baseline (a car unlocked since this morning does
// not fire "unlocked" at every restart). A value that becomes unknown fires
// nothing: only a change between two known values does. Nothing here is ever
// fired by a command the integration sent itself: the next reading shows the
// new state, which is a change like any other (the user asked for it).
//
// Every car event carries the device of the car in `vehicle`, the field of
// the `source: "devices"` filter of the manifest.
// -----------------------------------------------------------------------------

import { t, warningLabel, openingsLabel } from './i18n.js';

const SCENE_TRIGGERS = {
  LOCK_CHANGED: 'lock_changed',
  LEFT_OPEN: 'left_open',
  CHARGING_CHANGED: 'charging_changed',
  CHARGER_CONNECTION_CHANGED: 'charger_connection_changed',
  HOME_CHANGED: 'home_changed',
  WARNING_RAISED: 'warning_raised',
  ACCOUNT_PROBLEM: 'account_problem',
};

/**
 * @description The events between two readings.
 * @param {object|null} previous - The previous reading (null: baseline).
 * @param {object} next - The new reading.
 * @returns {Array<{ key: string, values: object }>} The events.
 * @example
 * detectEvents(previous, next); // -> [{ key: 'lock_changed', values: { state: 'unlocked' } }]
 */
function detectEvents(previous, next) {
  if (!previous) {
    return [];
  }
  const before = previous.snapshot;
  const after = next.snapshot;
  const events = [];
  const changed = (a, b) => a !== null && b !== null && a !== b;

  if (changed(before.lock, after.lock)) {
    events.push({ key: SCENE_TRIGGERS.LOCK_CHANGED, values: { state: after.lock } });
  }

  // Locked with something open: when it starts, or when one more opens.
  if (after.lock === 'locked' && after.openList.length > 0) {
    const wasLeftOpen = before.lock === 'locked' && before.openList.length > 0;
    const newlyOpen = after.openList.filter((name) => !before.openList.includes(name));
    if (!wasLeftOpen || newlyOpen.length > 0) {
      events.push({ key: SCENE_TRIGGERS.LEFT_OPEN, values: { openings: after.openList } });
    }
  }

  const wasCharging = before.charge.status === null ? null : before.charge.status === 'charging';
  const isCharging = after.charge.status === null ? null : after.charge.status === 'charging';
  if (changed(wasCharging, isCharging)) {
    events.push({
      key: SCENE_TRIGGERS.CHARGING_CHANGED,
      values: { state: isCharging ? 'started' : 'stopped' },
    });
  }

  if (changed(before.charge.plugged, after.charge.plugged)) {
    events.push({
      key: SCENE_TRIGGERS.CHARGER_CONNECTION_CHANGED,
      values: { state: after.charge.plugged ? 'connected' : 'disconnected' },
    });
  }

  if (changed(previous.atHome, next.atHome)) {
    events.push({
      key: SCENE_TRIGGERS.HOME_CHANGED,
      values: { state: next.atHome ? 'arrived' : 'left' },
    });
  }

  after.warnings
    .filter((warning) => !before.warnings.includes(warning))
    .forEach((warning) => {
      events.push({ key: SCENE_TRIGGERS.WARNING_RAISED, values: { warning } });
    });

  return events;
}

/**
 * @description The scene data of an event.
 * @param {object} event - `{ key, values }` (detectEvents).
 * @param {object} context - `{ vehicle, carName, reading, language }`.
 * @returns {{ key: string, data: object }} The scene event.
 */
function buildSceneEvent(event, { vehicle, carName, reading, language }) {
  const { snapshot } = reading;
  const car = carName;
  const base = { vehicle, vehicle_name: carName };
  const level = snapshot.battery.level;
  switch (event.key) {
    case SCENE_TRIGGERS.LOCK_CHANGED:
      return {
        key: event.key,
        data: {
          ...base,
          state: event.values.state,
          summary: t(
            event.values.state === 'locked' ? 'summaryLocked' : 'summaryUnlocked',
            language,
            {
              car,
            },
          ),
        },
      };
    case SCENE_TRIGGERS.LEFT_OPEN: {
      const list = openingsLabel(event.values.openings, language);
      return {
        key: event.key,
        data: { ...base, openings: list, summary: t('summaryLeftOpen', language, { car, list }) },
      };
    }
    case SCENE_TRIGGERS.CHARGING_CHANGED:
      return {
        key: event.key,
        data: {
          ...base,
          state: event.values.state,
          battery_level: level,
          range_km: snapshot.battery.rangeKm,
          summary: t(
            event.values.state === 'started' ? 'summaryChargeStarted' : 'summaryChargeStopped',
            language,
            { car, level: level ?? '?' },
          ),
        },
      };
    case SCENE_TRIGGERS.CHARGER_CONNECTION_CHANGED:
      return {
        key: event.key,
        data: {
          ...base,
          state: event.values.state,
          battery_level: level,
          summary: t(
            event.values.state === 'connected' ? 'summaryPlugged' : 'summaryUnplugged',
            language,
            { car, level: level ?? '?' },
          ),
        },
      };
    case SCENE_TRIGGERS.HOME_CHANGED:
      return {
        key: event.key,
        data: {
          ...base,
          state: event.values.state,
          distance_km:
            reading.distanceHomeKm === null ? null : Math.round(reading.distanceHomeKm * 10) / 10,
          battery_level: level,
          summary: t(
            event.values.state === 'arrived' ? 'summaryArrived' : 'summaryLeft',
            language,
            {
              car,
              level: level ?? '?',
            },
          ),
        },
      };
    case SCENE_TRIGGERS.WARNING_RAISED: {
      const label = warningLabel(event.values.warning, language);
      return {
        key: event.key,
        data: {
          ...base,
          warning: event.values.warning,
          warning_label: label,
          summary: t('summaryWarning', language, { car, warning: label }),
        },
      };
    }
    default:
      throw new Error(`Unknown event ${event.key}`);
  }
}

/**
 * @description The scene data of the "account problem" event.
 * @param {string} problem - `login_refused` or `pin_refused`.
 * @param {string} language - The language.
 * @returns {{ key: string, data: object }} The scene event.
 */
function buildAccountProblemEvent(problem, language) {
  return {
    key: SCENE_TRIGGERS.ACCOUNT_PROBLEM,
    data: { problem, summary: t(`summary_${problem}`, language) },
  };
}

export { SCENE_TRIGGERS, detectEvents, buildSceneEvent, buildAccountProblemEvent };
