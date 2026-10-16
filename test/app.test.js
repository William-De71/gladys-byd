// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the transports like the host API does, and the
// fake BYD cloud (test/helpers/byd-cloud.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';

import { createApp, redactVin } from '../src/app.js';
import { WIDGETS, WIDGET_ACTIONS } from '../src/widgets.js';
import {
  createFakeCloud,
  memoryStorage,
  VIN,
  USERNAME,
  PASSWORD,
  PIN,
  REALTIME,
} from './helpers/byd-cloud.js';

const LANGUAGES = ['en', 'fr', 'de', 'es'];
const CONFIG = { username: USERNAME, password: PASSWORD, country: 'FR', control_pin: PIN };
const HOUSE = { selector: 'home', name: 'Home', latitude: 48.8584, longitude: 2.2945 };
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

async function startApp({ config = CONFIG, cloud = createFakeCloud(), houses = [HOUSE] } = {}) {
  const gladys = createFakeGladys({ config, houses });
  const app = createApp(gladys, {
    fetchImpl: cloud.fetchImpl,
    storage: memoryStorage(),
    sleep: async () => {},
  });
  await gladys.connect();
  return { gladys, app, cloud };
}

async function createCar(gladys) {
  const [device] = gladys.fake.discoveredDevices;
  await gladys.fake.deviceCreated(device);
  return device;
}

test('a car is offered on the Discovery screen, accepted by the host API checks', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.discoveredDevices.length, 1);
  const [device] = gladys.fake.discoveredDevices;
  assert.equal(device.external_id, `ext:test-integration:vehicle:${VIN}`);
  assert.equal(device.name, 'BYD ATTO 3 (Family car)');
  assert.equal(device.should_poll, false);
  const keys = device.features.map((feature) => feature.external_id.split(':').at(-1));
  for (const key of ['battery_level', 'battery_range', 'lock', 'climate', 'plugged', 'doors']) {
    assert.ok(keys.includes(key), key);
  }
  assert.ok(keys.includes('distance_home'), 'a house with a position');
  assert.ok(!keys.includes('fuel_range'), 'electric car');
  for (const feature of device.features) {
    for (const field of ['min', 'max', 'read_only', 'has_feedback']) {
      assert.notEqual(feature[field], undefined, `${feature.external_id} ${field}`);
    }
  }
  assert.equal(gladys.fake.connectionStatus.connected, true);
  for (const language of LANGUAGES) {
    assert.ok(gladys.fake.connectionStatus.message[language], language);
  }
});

test('creating the car publishes all its states, its transport and refreshes the widget', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.states.length, 0, 'nothing before the car exists');
  const device = await createCar(gladys);
  const id = device.external_id;
  assert.equal(gladys.fake.lastState(`${id}:battery_level`), 76);
  assert.equal(gladys.fake.lastState(`${id}:lock`), 1);
  assert.equal(gladys.fake.lastState(`${id}:distance_home`), 0);
  assert.equal(gladys.fake.lastState(`${id}:tyre_front_left`), 2.5);
  assert.deepEqual(gladys.fake.transports.at(-1), { device_external_id: id, transport: 'cloud' });
  assert.ok(gladys.fake.widgetRefreshes.includes(WIDGETS.VEHICLE));
});

test('the widget, in the four languages, passes the checks of the core', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const language of LANGUAGES) {
    const ack = await gladys.fake.widgetGet(WIDGETS.VEHICLE, { settings: {}, language });
    assert.equal(ack.success, true, language);
    assert.deepEqual(validateWidgetContent(ack.data.content), [], language);
    const types = ack.data.content.components.map((component) => component.type);
    assert.deepEqual(types, [
      'image',
      'value',
      'value',
      'status',
      'button',
      'button',
      'button',
      'button',
    ]);
  }
  const ack = await gladys.fake.widgetGet(WIDGETS.VEHICLE, { settings: {} });
  const picture = ack.data.content.components.find((component) => component.type === 'image');
  const image = await gladys.fake.widgetGetImage(picture.key);
  assert.deepEqual(validateWidgetImage(image.data.image), []);
});

test('without PIN: read only, no command button, a command explains why', async (t) => {
  const { gladys, cloud } = await startApp({ config: { ...CONFIG, control_pin: '' } });
  t.after(() => gladys.fake.shutdown());
  const ack = await gladys.fake.widgetGet(WIDGETS.VEHICLE, { settings: {} });
  const buttons = ack.data.content.components.filter((component) => component.type === 'button');
  assert.equal(buttons.length, 1, 'the map only');
  const action = await gladys.fake.widgetAction(WIDGETS.VEHICLE, WIDGET_ACTIONS.UNLOCK, {
    vin: VIN,
  });
  assert.match(action.data.message.fr, /PIN/);
  const scene = await gladys.fake.sceneAction('send_command', { command: 'lock' });
  assert.equal(scene.data.outputs.success, false);
  assert.equal(cloud.calls.filter((call) => call.endpoint === '/control/remoteControl').length, 0);
  assert.match(gladys.fake.connectionStatus.message.en, /read only/);
});

test('a widget button runs the command in the background, then reads the car again', async (t) => {
  const { gladys, cloud } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const ack = await gladys.fake.widgetAction(WIDGETS.VEHICLE, WIDGET_ACTIONS.UNLOCK, { vin: VIN });
  assert.equal(ack.success, true);
  for (const language of LANGUAGES) {
    assert.ok(ack.data.message[language].length <= 200, language);
  }
  await tick();
  const sent = cloud.calls.filter((call) => call.endpoint === '/control/remoteControl');
  assert.deepEqual(
    sent.map((call) => call.inner.commandType),
    ['OPENDOOR'],
  );
});

test('the climate feature starts the climate with the configured settings', async (t) => {
  const { gladys, cloud } = await startApp({
    config: { ...CONFIG, climate_temperature: 22, climate_duration: '10' },
  });
  t.after(() => gladys.fake.shutdown());
  const device = await createCar(gladys);
  const feature = device.features.find((f) => f.external_id.endsWith(':climate'));
  await gladys.fake.setValue(device, feature, 1);
  await tick();
  const sent = cloud.calls.find((call) => call.endpoint === '/control/remoteControl');
  assert.equal(sent.inner.commandType, 'OPENAIR');
  assert.deepEqual(JSON.parse(sent.inner.controlParamsMap), {
    airAccuracy: 1,
    airConditioningMode: 1,
    airSet: null,
    copilotSettingTemp: 8,
    cycleMode: 2,
    mainSettingTemp: 8,
    remoteMode: 4,
    timeSpan: 1,
  });
  assert.equal(gladys.fake.lastState(`${device.external_id}:climate`), 1);
});

test('scene actions: a command waits for the car; the status has every output', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const done = await gladys.fake.sceneAction('send_command', { command: 'find_car' });
  assert.equal(done.data.outputs.success, true);
  const status = await gladys.fake.sceneAction('get_status', {});
  const { outputs } = status.data;
  assert.equal(outputs.locked, true);
  assert.equal(outputs.battery_level, 76);
  assert.equal(outputs.at_home, true);
  assert.match(outputs.map_url, /openstreetmap/);
  assert.match(outputs.summary, /ATTO 3/);
});

test('a refused PIN stops the commands and tells the scenes, once', async (t) => {
  const cloud = createFakeCloud({ pin: '000000' });
  const { gladys } = await startApp({ cloud });
  t.after(() => gladys.fake.shutdown());
  await gladys.fake.widgetAction(WIDGETS.VEHICLE, WIDGET_ACTIONS.LOCK, { vin: VIN });
  await tick();
  const events = gladys.fake.sceneEvents.filter((event) => event.key === 'account_problem');
  assert.deepEqual(
    events.map((event) => event.data.problem),
    ['pin_refused'],
  );
  const again = await gladys.fake.widgetAction(WIDGETS.VEHICLE, WIDGET_ACTIONS.LOCK, { vin: VIN });
  assert.match(again.data.message.en, /refused the PIN/);
  assert.match(gladys.fake.connectionStatus.message.en, /PIN was refused/);
});

test('a refused sign-in: status, scene event, no retry loop', async (t) => {
  const cloud = createFakeCloud({ password: 'changed' });
  const { gladys } = await startApp({ cloud });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /Sign-in refused/);
  assert.deepEqual(
    gladys.fake.sceneEvents.map((event) => [event.key, event.data.problem]),
    [['account_problem', 'login_refused']],
  );
  const test = await gladys.fake.action('test_connection');
  assert.match(test.data.message.en, /Sign-in refused/);
  assert.equal(cloud.calls.filter((call) => call.endpoint.endsWith('/login')).length, 1);
});

test('the scene triggers follow the readings: unlocked, then left open and charging', async (t) => {
  const { gladys, app, cloud } = await startApp();
  t.after(() => gladys.fake.shutdown());
  cloud.cloud.realtime = { ...REALTIME, leftFrontDoorLock: 1 };
  await app.poller.round({ force: true });
  cloud.cloud.realtime = { ...REALTIME, trunkLid: 1, chargeState: 1 };
  cloud.cloud.charging = { connectState: 1 };
  await app.poller.round({ force: true });
  const keys = gladys.fake.sceneEvents.map((event) => [event.key, event.data.state ?? '']);
  assert.deepEqual(keys, [
    ['lock_changed', 'unlocked'],
    ['lock_changed', 'locked'],
    ['left_open', ''],
    ['charging_changed', 'started'],
    ['charger_connection_changed', 'connected'],
  ]);
  for (const { data } of gladys.fake.sceneEvents) {
    assert.ok(Object.keys(data).length <= 30);
    for (const value of Object.values(data)) {
      assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
    }
  }
});

test('configuration screen: test, refresh and an anonymized diagnostic', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const tested = await gladys.fake.action('test_connection');
  assert.match(tested.data.message.fr, /…0001/);
  const refreshed = await gladys.fake.action('refresh');
  assert.match(refreshed.data.message.en, /1 car/);
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    const diagnostic = await gladys.fake.action('diagnostic');
    assert.match(diagnostic.data.message.en, /Logs tab/);
  } finally {
    console.log = original;
  }
  const logged = lines.join('\n');
  assert.doesNotMatch(logged, new RegExp(VIN));
  assert.doesNotMatch(logged, /48\.858/);
  assert.doesNotMatch(logged, /AB-123-CD/);
});

test('an incomplete or wrong configuration says what is missing', async (t) => {
  const empty = await startApp({ config: {} });
  t.after(() => empty.gladys.fake.shutdown());
  assert.match(empty.gladys.fake.connectionStatus.message.en, /e-mail address/);
  const country = await startApp({ config: { ...CONFIG, country: 'CN' } });
  t.after(() => country.gladys.fake.shutdown());
  assert.match(country.gladys.fake.connectionStatus.message.fr, /« CN »/);
  assert.equal(country.cloud.calls.length, 0);
});

test('logs never show a full VIN', () => {
  assert.equal(redactVin(`car ${VIN} failed`), 'car …0001 failed');
});
