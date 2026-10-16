// The BYD client against the fake cloud (test/helpers/byd-cloud.js), and its
// requests against pyBYD (test/fixtures/request-vectors.json).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createBydClient, remoteState, realtimeReady } from '../src/byd/client.js';
import { decodeEnvelope } from '../src/byd/bangcle.js';
import { md5Hex } from '../src/byd/crypto.js';
import { regionOf } from '../src/byd/regions.js';
import { createDeviceProfile, isDeviceProfile, luhnDigit } from '../src/byd/device-profile.js';
import {
  createFakeCloud,
  memoryStorage,
  VIN,
  USERNAME,
  PASSWORD,
  PIN,
} from './helpers/byd-cloud.js';

const quiet = { info() {}, warn() {}, error() {}, debug() {} };
const vectors = JSON.parse(
  readFileSync(new URL('./fixtures/request-vectors.json', import.meta.url), 'utf8'),
);

function client({ cloud = createFakeCloud(), storage = memoryStorage(), now, pin = PIN } = {}) {
  const byd = createBydClient({
    storage,
    logger: quiet,
    appName: 'gladys-byd+0.1.0',
    fetchImpl: cloud.fetchImpl,
    sleep: async () => {},
    ...(now ? { now } : {}),
  });
  byd.configure({ username: USERNAME, password: PASSWORD, country: 'fr', pin });
  return { byd, cloud, storage };
}

test('the login and a signed request are byte for byte the ones of pyBYD', async () => {
  const d = vectors.device;
  const device = {
    ostype: d.ostype,
    imei: d.imei,
    mac: d.mac,
    model: d.model,
    sdk: d.sdk,
    mod: d.mod,
    imeiMd5: d.imei_md5,
    mobileBrand: d.mobile_brand,
    mobileModel: d.mobile_model,
    deviceType: d.device_type,
    networkType: d.network_type,
    osType: d.os_type,
    osVersion: d.os_version,
  };
  const sent = [];
  const fetchImpl = async (url, init) => {
    sent.push(JSON.parse(decodeEnvelope(JSON.parse(init.body).request)));
    throw new Error('offline');
  };
  const options = {
    logger: quiet,
    fetchImpl,
    now: () => 1760000000000,
    timeZone: 'Europe/Paris',
    randomHex: () => 'AB'.repeat(16),
  };
  const login = createBydClient({
    ...options,
    appName: 'gladys-byd+0.1.0',
    storage: memoryStorage({ 'device.json': device }),
  });
  login.configure({ username: 'user@example.com', password: 'Secret!1', country: 'FR' });
  await assert.rejects(login.listVehicles(), { kind: 'transport' });
  assert.deepEqual(sent[0], vectors.login);

  const session = {
    account: md5Hex('user@example.com|https://dilinkappoversea-eu.byd.auto'),
    userId: '42',
    signToken: 'SIGNTOKEN',
    encryToken: 'ENCRYTOKEN',
  };
  const signed = createBydClient({
    ...options,
    appName: 'x',
    storage: memoryStorage({ 'device.json': device, 'session.json': session }),
  });
  signed.configure({ username: 'user@example.com', password: 'Secret!1', country: 'FR' });
  await assert.rejects(signed.getRealtime('LGXCE6CB0P0000001', 0), { kind: 'transport' });
  assert.deepEqual(sent[1], vectors.token);
});

test('reads the cars, the live data (request then result), the position and the charge', async () => {
  const { byd, cloud } = client();
  const cars = await byd.listVehicles();
  assert.equal(cars[0].vin, VIN);
  const realtime = await byd.getRealtime(VIN, 0);
  assert.equal(realtime.elecPercent, 76);
  const result = cloud.calls.find((call) => call.endpoint.endsWith('vehicleRealTimeResult'));
  assert.equal(result.inner.requestSerial, 'RT-1');
  assert.equal(result.inner.energyType, '0');
  assert.equal((await byd.getGps(VIN)).data.latitude, 48.8584);
  assert.equal((await byd.getCharging(VIN)).connectState, 0);
  assert.equal((await byd.getHvac(VIN)).status, 2, 'statusNow unwrapped');
  assert.equal(cloud.calls.filter((call) => call.endpoint.endsWith('/login')).length, 1);
});

test('the session is kept in /data and reused after a restart: no new login', async () => {
  const storage = memoryStorage();
  const first = client({ storage });
  await first.byd.listVehicles();
  assert.ok(storage.files['session.json'].encryToken);
  assert.ok(isDeviceProfile(storage.files['device.json']));
  assert.doesNotMatch(JSON.stringify(storage.files), new RegExp(PASSWORD.replace('!', '\\!')));

  const second = client({ storage });
  await second.byd.listVehicles();
  assert.equal(second.cloud.calls.filter((call) => call.endpoint.endsWith('/login')).length, 0);
});

test('an expired session signs in again, once, and the call goes through', async () => {
  const { byd, cloud } = client();
  await byd.listVehicles();
  cloud.cloud.expireNext = true;
  assert.equal((await byd.listVehicles()).length, 1);
  assert.equal(cloud.calls.filter((call) => call.endpoint.endsWith('/login')).length, 2);
});

test('a refused login pauses the next attempts (15 min, then 30)', async () => {
  let clock = 1_000_000;
  const cloud = createFakeCloud({ password: 'other' });
  const { byd } = client({ cloud, now: () => clock });
  await assert.rejects(byd.listVehicles(), { kind: 'auth', code: '3008' });
  await assert.rejects(byd.listVehicles(), { kind: 'auth', code: '' });
  assert.equal(cloud.calls.length, 1, 'no second login during the pause');
  assert.equal(byd.pausedUntil(), clock + 15 * 60 * 1000);
  clock += 15 * 60 * 1000;
  await assert.rejects(byd.listVehicles(), { kind: 'auth', code: '3008' });
  assert.equal(byd.pausedUntil(), clock + 30 * 60 * 1000);
});

test('a command checks the PIN once, then waits for the result of the car', async () => {
  const { byd, cloud } = client();
  await byd.remoteControl(VIN, 'lock');
  await byd.remoteControl(VIN, 'climate_start', { timeSpan: 3, airSet: null, mainSettingTemp: 7 });
  const verify = cloud.calls.filter((call) => call.endpoint.endsWith('verifyControlPassword'));
  assert.equal(verify.length, 1);
  const triggers = cloud.calls.filter((call) => call.endpoint === '/control/remoteControl');
  assert.deepEqual(
    triggers.map((call) => call.inner.commandType),
    ['LOCKDOOR', 'OPENAIR'],
  );
  assert.equal(triggers[0].inner.commandPwd, md5Hex(PIN));
  assert.equal(
    triggers[1].inner.controlParamsMap,
    '{"airSet":null,"mainSettingTemp":7,"timeSpan":3}',
  );
});

test('a refused PIN blocks every command until the PIN changes: no lock-out', async () => {
  const cloud = createFakeCloud({ pin: '999999' });
  const { byd } = client({ cloud });
  await assert.rejects(byd.remoteControl(VIN, 'unlock'), { kind: 'pin', code: '5005' });
  const count = cloud.calls.length;
  await assert.rejects(byd.remoteControl(VIN, 'unlock'), { kind: 'pin' });
  assert.equal(cloud.calls.length, count, 'not sent again');
  assert.equal(byd.canCommand(), false);
  byd.configure({ username: USERNAME, password: PASSWORD, country: 'FR', pin: '999999' });
  assert.equal(byd.canCommand(), true);
  await byd.remoteControl(VIN, 'unlock');
});

test('a command the car refuses or never confirms is an error', async () => {
  const refused = client({ cloud: createFakeCloud({ remoteResult: { controlState: 2 } }) });
  await assert.rejects(refused.byd.remoteControl(VIN, 'lock'), { kind: 'remote', code: '2' });
  const silent = client({ cloud: createFakeCloud({ remoteResult: { controlState: 0 } }) });
  await assert.rejects(silent.byd.remoteControl(VIN, 'lock'), { kind: 'remote', code: 'timeout' });
  const noPin = client({ pin: '' });
  await assert.rejects(noPin.byd.remoteControl(VIN, 'lock'), { kind: 'pin', code: 'no_pin' });
});

test('an endpoint the car does not offer is "notSupported"', async () => {
  const cloud = createFakeCloud();
  cloud.cloud.unsupported.add('/control/getStatusNow');
  const { byd } = client({ cloud });
  await assert.rejects(byd.getHvac(VIN), { kind: 'notSupported', code: '1001' });
});

test('result states and readiness, as pyBYD reads them', () => {
  assert.equal(remoteState({ controlState: 1 }), 'success');
  assert.equal(remoteState({ controlState: 2 }), 'failure');
  assert.equal(remoteState({ res: 1 }), 'pending');
  assert.equal(remoteState({ res: 2 }), 'success');
  assert.equal(remoteState({ res: 3 }), 'failure');
  assert.equal(remoteState({}), 'pending');
  assert.equal(realtimeReady({ requestSerial: 'x' }), false);
  assert.equal(realtimeReady({ onlineState: 2, time: 5 }), false);
  assert.equal(realtimeReady({ time: 1760000000 }), true);
});

test('regions: the server of the country of the account', () => {
  assert.deepEqual(regionOf('fr'), {
    country: 'FR',
    baseUrl: 'https://dilinkappoversea-eu.byd.auto',
    language: 'fr',
  });
  assert.equal(regionOf('AU').baseUrl, 'https://dilinkappoversea-au.byd.auto');
  assert.equal(regionOf('ae').baseUrl, 'https://dilinkappoversea-no.byd.auto');
  assert.equal(regionOf('BE').language, 'en');
  assert.equal(regionOf('CN'), null, 'the Chinese app is another cloud');
  assert.equal(regionOf(''), null);
});

test('the phone identity: a valid IMEI, a local MAC address, drawn at random', () => {
  const a = createDeviceProfile();
  const b = createDeviceProfile();
  assert.ok(isDeviceProfile(a));
  assert.match(a.imei, /^\d{15}$/);
  assert.equal(luhnDigit(a.imei.slice(0, 14)), a.imei[14]);
  assert.equal(parseInt(a.mac.slice(0, 2), 16) & 0x03, 0x02);
  assert.notEqual(a.imei, b.imei);
});
