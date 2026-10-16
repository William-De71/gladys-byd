// -----------------------------------------------------------------------------
// The inner layer of the BYD requests: hashes, signature and payload AES.
//
//   - `encryData`  the request fields, AES-128-CBC (zero IV), uppercase hex;
//                  key MD5(MD5(password)) for the login, MD5(encryToken) after;
//   - `sign`       SHA-1 of "k1=v1&k2=v2…&password=<key>" (keys sorted), its
//                  hex digits alternately upper/lower case, the "0" at even
//                  positions dropped; key MD5(password) for the login,
//                  MD5(signToken) after;
//   - `checkcode`  MD5 of the compact JSON of the outer payload, its four
//                  8-character chunks reordered 4-2-3-1.
// As documented by pyBYD (MIT, see NOTICE), rewritten here.
// -----------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';

const ZERO_IV = Buffer.alloc(16);

/**
 * @description JSON text as Python's `json.dumps(…, separators=(',', ':'))`
 * writes it: compact, non-ASCII characters escaped by default.
 * @param {unknown} value - The value.
 * @param {object} [options] - `{ ascii }` (true: escape non-ASCII, the default).
 * @returns {string} The JSON text.
 * @example
 * pyJson({ a: 'é' }); // -> '{"a":"\\u00e9"}'
 */
function pyJson(value, { ascii = true } = {}) {
  const text = JSON.stringify(value);
  if (!ascii) {
    return text;
  }
  return text.replace(
    /[\u0080-\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/**
 * @description MD5, uppercase hex.
 * @param {string} value - The text.
 * @returns {string} The digest.
 * @example
 * md5Hex('a'); // -> '0CC175B9C0F1B6A831C399E269772661'
 */
function md5Hex(value) {
  return createHash('md5').update(String(value), 'utf8').digest('hex').toUpperCase();
}

/**
 * @description The AES key of the login payload.
 * @param {string} password - The account password.
 * @returns {string} MD5(MD5(password)), uppercase hex.
 */
function loginKey(password) {
  return md5Hex(md5Hex(password));
}

/**
 * @description The "mixed" SHA-1 of the signature.
 * @param {string} value - The sign string.
 * @returns {string} The signature.
 */
function sha1Mixed(value) {
  const digest = createHash('sha1').update(value, 'utf8').digest();
  const mixed = [...digest]
    .map((byte, index) => {
      const hex = byte.toString(16).padStart(2, '0');
      return index % 2 === 0 ? hex.toUpperCase() : hex;
    })
    .join('');
  return [...mixed].filter((char, index) => !(char === '0' && index % 2 === 0)).join('');
}

/**
 * @description The signature of a set of fields.
 * @param {object} fields - The signed fields.
 * @param {string} key - The signing key.
 * @returns {string} The signature.
 * @example
 * sign({ b: '2', a: '1' }, 'K'); // SHA-1 of 'a=1&b=2&password=K'
 */
function sign(fields, key) {
  const text = Object.keys(fields)
    .sort()
    .map(
      (name) =>
        `${name}=${fields[name] === null || fields[name] === undefined ? 'null' : fields[name]}`,
    )
    .join('&');
  return sha1Mixed(`${text}&password=${key}`);
}

/**
 * @description The checkcode of an outer payload.
 * @param {object} payload - The outer payload, without its checkcode.
 * @returns {string} The checkcode.
 */
function checkcode(payload) {
  const md5 = createHash('md5')
    .update(pyJson(payload, { ascii: false }), 'utf8')
    .digest('hex');
  return md5.slice(24, 32) + md5.slice(8, 16) + md5.slice(16, 24) + md5.slice(0, 8);
}

/**
 * @description AES-CBC (zero IV) encryption, uppercase hex.
 * @param {string} plaintext - The text.
 * @param {string} keyHex - The key (32 hex characters).
 * @returns {string} The ciphertext.
 */
function aesEncryptHex(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const cipher = createCipheriv(`aes-${key.length * 8}-cbc`, key, ZERO_IV);
  return Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    .toString('hex')
    .toUpperCase();
}

/**
 * @description AES-CBC (zero IV) decryption of hex.
 * @param {string} cipherHex - The ciphertext.
 * @param {string} keyHex - The key.
 * @returns {string} The text.
 */
function aesDecryptHex(cipherHex, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv(`aes-${key.length * 8}-cbc`, key, ZERO_IV);
  return Buffer.concat([
    decipher.update(Buffer.from(String(cipherHex), 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

export { pyJson, md5Hex, loginKey, sha1Mixed, sign, checkcode, aesEncryptHex, aesDecryptHex };
