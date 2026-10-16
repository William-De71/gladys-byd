// -----------------------------------------------------------------------------
// The transport badge of each car (Devices screen of Gladys).
//
// Everything goes through the BYD cloud: the badge says `cloud` while the
// cloud answers for the car, and `unreachable` when no call for it succeeded.
// When the cloud says the car itself is offline (no mobile network in an
// underground car park, deep sleep), the badge stays `cloud` but is flagged
// `degraded`: the values may be old and commands may not reach the car.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { all } from './i18n.js';

/**
 * @description The transport entry of a car.
 * @param {string} externalId - The device external id.
 * @param {object|null} reading - Its last reading (poller.js).
 * @param {{ errors: Error[], succeeded: number }} [outcome] - The last read.
 * @returns {object} The `publishTransports` entry.
 * @example
 * transportOf('ext:byd:vehicle:LGX…', reading, { errors: [], succeeded: 3 });
 */
function transportOf(externalId, reading, outcome) {
  if (outcome && outcome.succeeded === 0 && outcome.errors.length > 0) {
    return { external_id: externalId, transport: DEVICE_TRANSPORTS.UNREACHABLE };
  }
  if (reading?.snapshot?.online === false) {
    return {
      external_id: externalId,
      transport: DEVICE_TRANSPORTS.CLOUD,
      degraded: true,
      message: all('transportOffline'),
    };
  }
  return { external_id: externalId, transport: DEVICE_TRANSPORTS.CLOUD };
}

export { transportOf };
