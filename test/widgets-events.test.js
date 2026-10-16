import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { buildVehicleWidget, messageContent } from '../src/widgets.js';
import { detectEvents, buildSceneEvent, buildAccountProblemEvent } from '../src/events.js';
import { buildStatusOutputs } from '../src/scene-actions.js';
import { climateParams } from '../src/commands.js';
import { LANGUAGES, TEXTS } from '../src/i18n.js';
import { fullInfo, fullSnapshot } from './helpers/fixtures.js';

const reading = (snapshot = fullSnapshot, extra = {}) => ({
  snapshot,
  distanceHomeKm: 12.3,
  atHome: false,
  climateOn: false,
  readAt: 1760000000000,
  ...extra,
});

test('the widget passes the checks of the core in every case and language', () => {
  const cases = [
    reading(),
    reading(
      {
        ...fullSnapshot,
        charge: { status: 'charging', plugged: true, minutesToFull: 95 },
        online: false,
        openList: ['trunk', 'window_front_left', 'window_rear_right', 'sunroof'],
        warnings: ['tyre_pressure', 'braking', 'power_system'],
      },
      { climateOn: true, atHome: true },
    ),
  ];
  for (const language of LANGUAGES) {
    for (const value of cases) {
      for (const canCommand of [true, false]) {
        const content = buildVehicleWidget({
          info: fullInfo,
          reading: value,
          imageKey: 'car-1',
          canCommand,
          language,
          now: 1760000600000,
        });
        assert.deepEqual(validateWidgetContent(content), [], language);
        assert.ok(content.components.length <= 8);
      }
    }
    assert.deepEqual(
      validateWidgetContent(
        buildVehicleWidget({ info: fullInfo, reading: null, language, now: 0 }),
      ),
      [],
    );
    assert.deepEqual(validateWidgetContent(messageContent('x')), []);
  }
});

test('button labels: 24 characters at most in every language', () => {
  for (const [key, entry] of Object.entries(TEXTS).filter(([k]) => k.startsWith('button'))) {
    for (const language of LANGUAGES) {
      assert.ok(entry[language].length <= 24, `${key}.${language}`);
    }
  }
});

test('scene events: flat, scalar, within the limits, summary in the language', () => {
  const before = reading(fullSnapshot, { atHome: false });
  const after = reading(
    {
      ...fullSnapshot,
      lock: 'unlocked',
      charge: { status: 'charging', plugged: true, minutesToFull: 30 },
      warnings: ['abs'],
    },
    { atHome: true },
  );
  const events = detectEvents(before, after);
  assert.deepEqual(
    events.map((e) => e.key),
    [
      'lock_changed',
      'charging_changed',
      'charger_connection_changed',
      'home_changed',
      'warning_raised',
    ],
  );
  assert.deepEqual(detectEvents(null, after), [], 'first reading = baseline');
  for (const language of LANGUAGES) {
    for (const event of events) {
      const { data } = buildSceneEvent(event, {
        vehicle: 'ext:byd:vehicle:x',
        carName: 'BYD SEAL',
        reading: after,
        language,
      });
      assert.ok(Object.keys(data).length <= 30);
      for (const value of Object.values(data)) {
        assert.ok(value === null || typeof value !== 'object');
        assert.ok(typeof value !== 'string' || value.length <= 1000);
      }
      assert.ok(data.summary.includes('BYD SEAL'));
    }
    assert.ok(buildAccountProblemEvent('pin_refused', language).data.summary.length > 10);
  }
});

test('left open fires when locked with something open, once per new opening', () => {
  const locked = { ...fullSnapshot, lock: 'locked' };
  const open = { ...locked, openList: ['trunk'] };
  assert.deepEqual(
    detectEvents(reading(locked), reading(open)).map((e) => e.key),
    ['left_open'],
  );
  assert.deepEqual(detectEvents(reading(open), reading(open)), []);
});

test('status outputs: declared scalars only', () => {
  const outputs = buildStatusOutputs({ reading: reading(), carName: 'BYD ATTO 3', language: 'fr' });
  for (const value of Object.values(outputs)) {
    assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
  }
  assert.match(outputs.summary, /^BYD ATTO 3 : verrouillée/);
});

test('climate parameters on the scale of the car', () => {
  assert.equal(climateParams(21, 20).mainSettingTemp, 7);
  assert.equal(climateParams(15, 10).timeSpan, 1);
  assert.equal(climateParams(31, 30).mainSettingTemp, 17);
  assert.equal(climateParams(40, 99).mainSettingTemp, 17);
  assert.equal(climateParams(40, 99).timeSpan, 3);
});
