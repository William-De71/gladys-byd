import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { SCENE_TRIGGERS } from '../src/events.js';
import { SCENE_ACTIONS } from '../src/scene-actions.js';
import { WIDGETS } from '../src/widgets.js';
import { COMMANDS } from '../src/commands.js';
import { WARNINGS } from '../src/vehicle.js';
import {
  POLL_INTERVAL,
  HOME_RADIUS,
  CLIMATE_TEMPERATURE,
  CLIMATE_DURATIONS,
  AUTO_LANGUAGE,
  normalizeConfig,
} from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'BYD');
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-byd:${pkg.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-byd/main/cover.jpg',
  );
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-byd');
});

test('declares the cloud transport only, and the location of the houses', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.doesNotMatch(source('../src/app.js'), /GLADYS_PREFER_LOCAL/);
  assert.equal(manifest.location, true, 'getHouses: the distance from home');
  for (const key of ['network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
  assert.equal(manifest.gladys_version, '>=5.1.1');
  assert.deepEqual(manifest.categories, ['vehicles']);
  assert.doesNotMatch(source('../src/widgets.js'), /fields:/, 'no button form (5.2.0)');
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers), Object.values(SCENE_TRIGGERS).sort());
  assert.deepEqual(keysOf(manifest.scene_actions), Object.values(SCENE_ACTIONS).sort());
  assert.deepEqual(keysOf(manifest.widgets), Object.values(WIDGETS).sort());
  const app = source('../src/app.js');
  assert.match(app, /onWidgetGet\(WIDGETS\.VEHICLE/);
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  for (const action of manifest.actions) {
    assert.match(app, new RegExp(`'${action.key}'`), action.key);
  }
  const command = byKey(byKey(manifest.scene_actions).get('send_command').fields).get('command');
  assert.deepEqual(values(command), COMMANDS);
  const warning = byKey(byKey(manifest.scene_triggers).get('warning_raised').fields).get('warning');
  assert.deepEqual(values(warning), Object.keys(WARNINGS));
});

function keysOf(list) {
  return list.map((entry) => entry.key).sort();
}

test('mirrors the bounds and values of the code', () => {
  const config = byKey(manifest.config_schema);
  ['min', 'max', 'default'].forEach((bound) => {
    assert.equal(config.get('poll_interval')[bound], POLL_INTERVAL[bound]);
    assert.equal(config.get('home_radius')[bound], HOME_RADIUS[bound]);
    assert.equal(config.get('climate_temperature')[bound], CLIMATE_TEMPERATURE[bound]);
  });
  assert.deepEqual(values(config.get('climate_duration')).map(Number), CLIMATE_DURATIONS);
  assert.equal(normalizeConfig({}).climateDuration, Number(config.get('climate_duration').default));
  assert.equal(config.get('password').type, 'secret');
  assert.equal(config.get('control_pin').type, 'secret');
  assert.equal(config.get('username').type, 'string');
  assert.equal(normalizeConfig({}).country, config.get('country').default);
  const field = config.get('language');
  assert.deepEqual(values(field), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(field.default, AUTO_LANGUAGE);
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  assert.ok(manifest.scene_triggers.length <= 20);
  assert.ok(manifest.scene_actions.length <= 20);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
  }
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
    assert.ok((action.fields ?? []).length <= 10 && (action.outputs ?? []).length <= 20);
  }
  for (const widget of manifest.widgets) {
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
});

test('configuration: PIN digits only, country upper case, password kept as typed', () => {
  assert.equal(normalizeConfig({ control_pin: ' 123456 ' }).pin, '123456');
  assert.equal(normalizeConfig({ control_pin: '12a456' }).pin, '');
  assert.equal(normalizeConfig({ control_pin: '12a456' }).pinInvalid, true);
  assert.equal(normalizeConfig({ country: ' be ' }).country, 'BE');
  assert.equal(normalizeConfig({ password: ' p ' }).password, ' p ');
  assert.equal(normalizeConfig({ poll_interval: '1' }).pollInterval, 5);
  assert.equal(normalizeConfig({ climate_duration: '25' }).climateDuration, 25);
});
