// -----------------------------------------------------------------------------
// Scene actions.
//
//   - `send_command`  lock, unlock, start or stop the climate, flash the
//                     lights, find my car (horn and lights): waits for the
//                     car (up to two minutes, a car asleep is slow to wake
//                     up) and tells whether it was carried out;
//   - `get_status`    everything a scene may want to say or test: lock,
//                     openings, battery, range, charge, position, warnings,
//                     with a sentence ready for a message. From the last
//                     reading, or a fresh one on demand (wakes the car).
// -----------------------------------------------------------------------------

import { t, warningLabel, openingsLabel } from './i18n.js';
import { mapUrl } from './geo.js';

const SCENE_ACTIONS = { SEND_COMMAND: 'send_command', GET_STATUS: 'get_status' };

/**
 * @description The outputs of `get_status`.
 * @param {object} options - Options.
 * @param {object} options.reading - The reading of the car.
 * @param {string} options.carName - Its name.
 * @param {string} options.language - The language.
 * @returns {object} The outputs.
 * @example
 * buildStatusOutputs({ reading, carName: 'BYD ATTO 3', language: 'fr' });
 */
function buildStatusOutputs({ reading, carName, language }) {
  const { snapshot } = reading;
  const openings = openingsLabel(snapshot.openList, language);
  const known = Object.values(snapshot.openings).some((state) => state !== null);
  const energy =
    snapshot.battery.level === null
      ? ''
      : t('summaryBattery', language, {
          level: Math.round(snapshot.battery.level),
          range: snapshot.battery.rangeKm ?? '?',
        });
  return {
    vehicle_name: carName,
    locked: snapshot.lock === null ? null : snapshot.lock === 'locked',
    all_closed: known ? snapshot.openList.length === 0 : null,
    openings,
    battery_level: snapshot.battery.level,
    range_km: snapshot.battery.rangeKm,
    charging: snapshot.charge.status === null ? null : snapshot.charge.status === 'charging',
    plugged: snapshot.charge.plugged,
    minutes_to_full: snapshot.charge.minutesToFull,
    climate_on: reading.climateOn,
    inside_temperature: snapshot.tempInside,
    odometer_km: snapshot.odometerKm,
    at_home: reading.atHome,
    distance_home_km:
      reading.distanceHomeKm === null ? null : Math.round(reading.distanceHomeKm * 10) / 10,
    latitude: snapshot.location?.latitude ?? null,
    longitude: snapshot.location?.longitude ?? null,
    map_url: snapshot.location ? mapUrl(snapshot.location) : null,
    warnings: snapshot.warnings.map((warning) => warningLabel(warning, language)).join(', '),
    summary: t('summaryStatus', language, {
      car: carName,
      lock: snapshot.lock ? t(snapshot.lock, language).toLowerCase() : '?',
      openings: known
        ? snapshot.openList.length === 0
          ? t('allClosed', language).toLowerCase()
          : t('open', language, { list: openings }).toLowerCase()
        : '?',
      energy,
    }).trim(),
  };
}

export { SCENE_ACTIONS, buildStatusOutputs };
