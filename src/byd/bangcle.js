// -----------------------------------------------------------------------------
// The outer "Bangcle" envelope of the BYD app requests.
//
// Every request body is `{"request": "F<base64>"}` and every answer
// `{"response": "F<base64>"}`: the JSON payload, PKCS#7 padded, encrypted in
// CBC mode (zero IV) with a white-box AES. A white-box AES has no key: the key
// is baked into lookup tables (extracted from the libencrypt.so library of the
// BYD app by the pyBYD project, MIT, see NOTICE). The tables ship as
// src/data/bangcle_tables.bin:
//
//   "BGTB" | version u16 LE (1) | count u16 LE (8) | 8 × (offset u32, length u32)
//   then the tables: inverse round, inverse xor, inverse first, round, xor,
//   final, decrypt permutation, encrypt permutation.
//
// The round structure below follows the decompiled routine described by
// pyBYD (`_crypto/_bangcle_block.py`); it is rewritten here, not copied.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const TABLES_URL = new URL('../data/bangcle_tables.bin', import.meta.url);
const MAGIC = 'BGTB';
const TABLE_SPECS = [
  ['invRound', 0x28000],
  ['invXor', 0x3c000],
  ['invFirst', 0x1000],
  ['round', 0x28000],
  ['xor', 0x3c000],
  ['final', 0x1000],
  ['permDecrypt', 8],
  ['permEncrypt', 8],
];
const BLOCK = 16;
const ZERO_IV = Buffer.alloc(BLOCK);

/** The envelope or its tables are not what the BYD cloud uses. */
class BangcleError extends Error {
  /**
   * @param {string} message - The reason.
   */
  constructor(message) {
    super(message);
    this.name = 'BangcleError';
  }
}

/**
 * @description Parse the table file.
 * @param {Buffer} data - The file content.
 * @returns {object} The tables, by name (Buffers).
 * @example
 * parseTables(readFileSync(TABLES_URL));
 */
function parseTables(data) {
  if (data.length < 8 + TABLE_SPECS.length * 8 || data.toString('latin1', 0, 4) !== MAGIC) {
    throw new BangcleError('Bangcle tables: bad header');
  }
  if (data.readUInt16LE(4) !== 1 || data.readUInt16LE(6) !== TABLE_SPECS.length) {
    throw new BangcleError('Bangcle tables: unsupported version');
  }
  const tables = {};
  TABLE_SPECS.forEach(([name, size], index) => {
    const offset = data.readUInt32LE(8 + index * 8);
    const length = data.readUInt32LE(12 + index * 8);
    if (length !== size || offset + length > data.length) {
      throw new BangcleError(`Bangcle tables: ${name} has a wrong size`);
    }
    tables[name] = data.subarray(offset, offset + length);
  });
  return tables;
}

let cached = null;

/**
 * @description The tables, read once.
 * @returns {object} The tables.
 */
function tables() {
  cached ??= parseTables(readFileSync(TABLES_URL));
  return cached;
}

/**
 * @description One white-box round: 16 table words, then the nibble xor network.
 * @param {Uint8Array} state - The 32-byte state (column c, row r at c * 8 + r).
 * @param {number} round - The round number (0-9).
 * @param {Buffer} roundTable - The round table (u32 LE words).
 * @param {Buffer} xorTable - The xor table.
 * @param {Buffer} perm - The permutation.
 */
function whiteBoxRound(state, round, roundTable, xorTable, perm) {
  const words = new Uint8Array(64);
  for (let column = 0; column < 4; column += 1) {
    const start = perm[column * 2];
    for (let j = 0; j < 4; j += 1) {
      const row = (start + j) & 3;
      const index = state[column * 8 + row] + (column + (round * 4 + row) * 4) * 256;
      words.set(roundTable.subarray(index * 4, index * 4 + 4), column * 16 + j * 4);
    }
  }
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      const at = column + row * 4;
      let low = words[at] & 0x0f;
      let high = (words[at] & 0xf0) >> 4;
      const base = row * 0x18 + round * 0x60 + column * 6;
      for (let step = 0; step < 3; step += 1) {
        const other = words[at + 16 * (step + 1)];
        const lowIndex = ((other << 4) & 0xff) | low;
        const highIndex = (high | ((other >> 4) << 4)) & 0xff;
        low = xorTable[(base + step * 2) * 256 + lowIndex] & 0x0f;
        high = xorTable[(base + step * 2 + 1) * 256 + highIndex] & 0x0f;
      }
      state[row + column * 8] = (high << 4) | low;
    }
  }
}

/**
 * @description The last (encrypt) or first (decrypt) byte substitution.
 * @param {Uint8Array} state - The state.
 * @param {Buffer} table - The final or inverse first table.
 * @param {number} direction - +1 to encrypt, -1 to decrypt.
 */
function substitute(state, table, direction) {
  const copy = Uint8Array.from(state);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const source = (row + direction * column + 4) & 3;
      state[column * 8 + row] = table[copy[column * 8 + source] + source * 0x400 + column * 0x100];
    }
  }
}

/**
 * @description Encrypt or decrypt one 16-byte block.
 * @param {Uint8Array} block - The block.
 * @param {boolean} encrypt - The direction.
 * @returns {Uint8Array} The result.
 */
function cryptBlock(block, encrypt) {
  const t = tables();
  const state = new Uint8Array(32);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      state[column * 8 + row] = block[column + row * 4];
    }
  }
  if (encrypt) {
    for (let round = 0; round < 9; round += 1) {
      whiteBoxRound(state, round, t.round, t.xor, t.permEncrypt);
    }
    substitute(state, t.final, 1);
  } else {
    for (let round = 9; round >= 1; round -= 1) {
      whiteBoxRound(state, round, t.invRound, t.invXor, t.permDecrypt);
    }
    substitute(state, t.invFirst, -1);
  }
  const out = new Uint8Array(BLOCK);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column + row * 4] = state[column * 8 + row];
    }
  }
  return out;
}

/**
 * @description Encode a payload into an envelope.
 * @param {string} plaintext - The JSON text.
 * @returns {string} `F` + base64.
 * @example
 * encodeEnvelope('{"a":1}'); // -> 'F…'
 */
function encodeEnvelope(plaintext) {
  const data = Buffer.from(plaintext, 'utf8');
  const pad = BLOCK - (data.length % BLOCK);
  const padded = Buffer.concat([data, Buffer.alloc(pad, pad)]);
  const out = Buffer.alloc(padded.length);
  let previous = ZERO_IV;
  for (let offset = 0; offset < padded.length; offset += BLOCK) {
    const block = new Uint8Array(BLOCK);
    for (let i = 0; i < BLOCK; i += 1) {
      block[i] = padded[offset + i] ^ previous[i];
    }
    const encrypted = cryptBlock(block, true);
    out.set(encrypted, offset);
    previous = encrypted;
  }
  return `F${out.toString('base64')}`;
}

/**
 * @description Decode an envelope.
 * @param {string} envelope - `F` + base64 (or base64url).
 * @returns {string} The decoded text.
 * @throws {BangcleError} When it is not an envelope.
 * @example
 * decodeEnvelope(encodeEnvelope('{"a":1}')); // -> '{"a":1}'
 */
function decodeEnvelope(envelope) {
  const text = String(envelope ?? '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!text.startsWith('F')) {
    throw new BangcleError('Bangcle envelope must start with "F"');
  }
  const data = Buffer.from(text.slice(1), 'base64');
  if (data.length === 0 || data.length % BLOCK !== 0) {
    throw new BangcleError(`Bangcle ciphertext of ${data.length} bytes`);
  }
  const out = Buffer.alloc(data.length);
  let previous = ZERO_IV;
  for (let offset = 0; offset < data.length; offset += BLOCK) {
    const block = data.subarray(offset, offset + BLOCK);
    const decrypted = cryptBlock(block, false);
    for (let i = 0; i < BLOCK; i += 1) {
      out[offset + i] = decrypted[i] ^ previous[i];
    }
    previous = block;
  }
  // Lenient PKCS#7, like the app: an invalid padding is kept as is.
  const pad = out[out.length - 1];
  let end = out.length;
  if (pad > 0 && pad <= BLOCK && out.subarray(out.length - pad).every((b) => b === pad)) {
    end -= pad;
  }
  return out.subarray(0, end).toString('utf8');
}

export { BangcleError, parseTables, encodeEnvelope, decodeEnvelope };
