// -----------------------------------------------------------------------------
// The anonymized copy of the raw BYD answers the "Diagnostic" action logs.
//
// Users of the store cannot set DEBUG on the container: the diagnostic writes
// the raw answers to the Logs tab instead, so a report can say which field a
// car model sends. What identifies the owner or the car is removed: VIN,
// plate, nickname, position, request serials, user ids, picture URLs.
// -----------------------------------------------------------------------------

const REMOVED = new Set([
  'vin',
  'autoPlate',
  'autoAlias',
  'latitude',
  'longitude',
  'requestSerial',
  'userId',
  'empowerId',
  'identifier',
  'picMainUrl',
  'picSetUrl',
  'cfPic',
  'direction',
]);
const VIN = /[A-HJ-NPR-Z0-9]{17}/g;

/**
 * @description A deep copy without the identifying fields.
 * @param {unknown} value - A raw answer.
 * @returns {unknown} The anonymized copy.
 * @example
 * anonymize({ vin: 'LGX…', elecPercent: 80 }); // -> { vin: '…', elecPercent: 80 }
 */
function anonymize(value) {
  if (Array.isArray(value)) {
    return value.map(anonymize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, REMOVED.has(key) ? '…' : anonymize(item)]),
    );
  }
  if (typeof value === 'string') {
    return value.replace(VIN, '…');
  }
  return value;
}

export { anonymize };
