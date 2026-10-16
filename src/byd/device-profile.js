// -----------------------------------------------------------------------------
// The phone this installation presents to the BYD cloud.
//
// Every request carries the identity of the phone running the app (IMEI,
// MAC address, model…). The values are drawn once, at random, and kept in
// /data/device.json: the cloud sees one stable phone per Gladys, never the
// same fingerprint for every user (the Home Assistant integration does the
// same). Nothing here is read from the host.
// -----------------------------------------------------------------------------

import { createHash, randomInt } from 'node:crypto';

// A few common Android phones: brand, model, `Build.MANUFACTURER`, and the
// Android SDK level paired with its version.
const PHONES = [
  { brand: 'SAMSUNG', model: 'SM-S928B', mod: 'samsung', sdk: ['34', '14'] },
  { brand: 'SAMSUNG', model: 'SM-A556B', mod: 'samsung', sdk: ['34', '14'] },
  { brand: 'GOOGLE', model: 'Pixel 8', mod: 'Google', sdk: ['35', '15'] },
  { brand: 'XIAOMI', model: '23127PN0CG', mod: 'Xiaomi', sdk: ['34', '14'] },
  { brand: 'ONEPLUS', model: 'CPH2581', mod: 'OnePlus', sdk: ['35', '15'] },
];

/**
 * @description The Luhn check digit of a number.
 * @param {string} digits - The digits.
 * @returns {string} The check digit.
 * @example
 * luhnDigit('35362711123456'); // -> one digit
 */
function luhnDigit(digits) {
  let total = 0;
  [...digits].forEach((char, index) => {
    let value = Number(char);
    if (index % 2 === 1) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }
    total += value;
  });
  return String((10 - (total % 10)) % 10);
}

/**
 * @description Draw a new phone identity.
 * @returns {object} The profile (strings).
 * @example
 * createDeviceProfile().imei; // -> 15 digits
 */
function createDeviceProfile() {
  const phone = PHONES[randomInt(PHONES.length)];
  const partial = `35${Array.from({ length: 12 }, () => randomInt(10)).join('')}`;
  const imei = partial + luhnDigit(partial);
  // A locally administered, unicast MAC address.
  const bytes = Array.from({ length: 6 }, () => randomInt(256));
  bytes[0] = (bytes[0] | 0x02) & 0xfe;
  return {
    ostype: 'and',
    imei,
    mac: bytes.map((b) => b.toString(16).padStart(2, '0')).join(':'),
    model: phone.model,
    sdk: phone.sdk[0],
    mod: phone.mod,
    imeiMd5: createHash('md5').update(imei).digest('hex'),
    mobileBrand: phone.brand,
    mobileModel: phone.model,
    deviceType: '0',
    networkType: 'wifi',
    osType: phone.sdk[1],
    osVersion: phone.sdk[0],
  };
}

/**
 * @description Whether a stored profile is complete.
 * @param {unknown} profile - The stored value.
 * @returns {boolean} True when usable.
 */
function isDeviceProfile(profile) {
  const keys = ['imei', 'mac', 'model', 'sdk', 'mod', 'imeiMd5', 'mobileBrand', 'mobileModel'];
  return Boolean(profile) && keys.every((key) => typeof profile[key] === 'string' && profile[key]);
}

export { PHONES, luhnDigit, createDeviceProfile, isDeviceProfile };
