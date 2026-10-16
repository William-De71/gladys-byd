// The cryptography of the BYD requests, checked against vectors produced by
// pyBYD (test/fixtures/crypto-vectors.json, the library the Home Assistant
// integration uses against the real cloud).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { encodeEnvelope, decodeEnvelope, parseTables, BangcleError } from '../src/byd/bangcle.js';
import {
  pyJson,
  md5Hex,
  loginKey,
  sign,
  checkcode,
  aesEncryptHex,
  aesDecryptHex,
} from '../src/byd/crypto.js';

const vectors = JSON.parse(
  readFileSync(new URL('./fixtures/crypto-vectors.json', import.meta.url), 'utf8'),
);

test('Bangcle envelopes: byte for byte what pyBYD produces, and back', () => {
  for (const [plaintext, envelope] of vectors.envelopes) {
    assert.equal(encodeEnvelope(plaintext), envelope);
    assert.equal(decodeEnvelope(envelope), plaintext);
  }
  // base64url and spaces are accepted, like the app.
  const [plaintext, envelope] = vectors.envelopes[1];
  assert.equal(decodeEnvelope(` ${envelope.replace(/\+/g, '-').replace(/\//g, '_')}\n`), plaintext);
});

test('Bangcle envelopes: anything else is refused', () => {
  assert.throws(() => decodeEnvelope('{"a":1}'), BangcleError);
  assert.throws(() => decodeEnvelope('FAAAA'), BangcleError);
  assert.throws(() => parseTables(Buffer.from('nope')), BangcleError);
});

test('hashes, signature and checkcode: as pyBYD computes them', () => {
  assert.equal(md5Hex('secret'), vectors.md5);
  assert.equal(loginKey('secret'), vectors.loginKey);
  assert.equal(sign(vectors.sign[0], vectors.sign[1]), vectors.sign[2]);
  assert.equal(checkcode(vectors.checkcode[0]), vectors.checkcode[1]);
});

test('payload AES: as pyBYD, and back', () => {
  const [plaintext, key, cipher] = vectors.aes;
  assert.equal(aesEncryptHex(plaintext, key), cipher);
  assert.equal(aesDecryptHex(cipher, key), plaintext);
});

test('JSON as Python writes it: compact, non-ASCII escaped on demand', () => {
  assert.equal(pyJson({ a: 'é', b: [1, null] }), '{"a":"\\u00e9","b":[1,null]}');
  assert.equal(pyJson({ a: 'é' }, { ascii: false }), '{"a":"é"}');
});
