// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';

import { buildDevice, buildStates, parseExternalId, FEATURES } from '../src/device.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, fullInfo, fullSnapshot, fullContext } from './helpers/fixtures.js';

// Pairs with an icon and a label in the Gladys front (front/src/utils/consts.js
// and the i18n files, checked on v5.1.1 and v5.2.1), with the units the core
// accepts for the category (DEVICE_FEATURE_UNITS_BY_CATEGORY).
const PAIRS = {
  [`${C.ELECTRICAL_VEHICLE_BATTERY}/${T.ELECTRICAL_VEHICLE_BATTERY.BATTERY_LEVEL}`]: [U.PERCENT],
  [`${C.ELECTRICAL_VEHICLE_BATTERY}/${T.ELECTRICAL_VEHICLE_BATTERY.BATTERY_RANGE_ESTIMATE}`]: [
    U.KM,
  ],
  [`${C.LEVEL_SENSOR}/${T.LEVEL_SENSOR.LIQUID_LEVEL_PERCENT}`]: [U.PERCENT],
  [`${C.DISTANCE_SENSOR}/${T.SENSOR.DECIMAL}`]: [U.KM],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.ODOMETER}`]: [U.KM],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.DOOR_OPENED}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.WINDOW_OPENED}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.TIRE_PRESSURE}`]: [U.BAR],
  [`${C.ELECTRICAL_VEHICLE_CHARGE}/${T.ELECTRICAL_VEHICLE_CHARGE.PLUGGED}`]: [undefined],
  [`${C.TEXT}/${T.TEXT.TEXT}`]: [undefined],
  [`${C.DURATION}/${T.DURATION.INTEGER}`]: [U.MINUTES],
  [`${C.ELECTRICAL_VEHICLE_CLIMATE}/${T.ELECTRICAL_VEHICLE_CLIMATE.INDOOR_TEMPERATURE}`]: [
    U.CELSIUS,
  ],
  [`${C.ELECTRICAL_VEHICLE_CLIMATE}/${T.ELECTRICAL_VEHICLE_CLIMATE.CLIMATE_ON}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_COMMAND}/${T.ELECTRICAL_VEHICLE_COMMAND.LOCK}`]: [undefined],
};

test('a car reporting everything gets every feature, each one complete and valid', () => {
  for (const language of LANGUAGES) {
    const device = buildDevice(fakeGladys, fullInfo, fullSnapshot, { ...fullContext, language });
    assert.equal(device.should_poll, false, 'read on the timer of the integration');
    assert.equal(device.poll_frequency, undefined);
    assert.equal(device.features.length, FEATURES.length, language);
    const ids = new Set();
    for (const feature of device.features) {
      for (const field of ['min', 'max', 'read_only', 'has_feedback', 'keep_history']) {
        assert.notEqual(feature[field], undefined, `${feature.external_id} ${field}`);
      }
      assert.ok(feature.min <= feature.max, feature.external_id);
      const pair = `${feature.category}/${feature.type}`;
      assert.ok(PAIRS[pair], `${feature.external_id}: ${pair} has no icon`);
      assert.ok(PAIRS[pair].includes(feature.unit), `${feature.external_id}: unit ${feature.unit}`);
      assert.ok(feature.name && !feature.name.startsWith('feature'), feature.external_id);
      ids.add(feature.external_id);
    }
    assert.equal(ids.size, device.features.length, 'unique external ids');
  }
});

test('only lock and climate are commands', () => {
  const device = buildDevice(fakeGladys, fullInfo, fullSnapshot, fullContext);
  const commands = device.features.filter((feature) => !feature.read_only);
  assert.deepEqual(commands.map((feature) => feature.external_id.split(':').at(-1)).sort(), [
    'climate',
    'lock',
  ]);
});

test('states: numbers and texts within the bounds, unknown values left out', () => {
  const device = buildDevice(fakeGladys, fullInfo, fullSnapshot, fullContext);
  const states = buildStates(fakeGladys, fullInfo, fullSnapshot, fullContext);
  const byId = new Map(device.features.map((feature) => [feature.external_id, feature]));
  for (const state of states) {
    const feature = byId.get(state.device_feature_external_id);
    assert.ok(feature, state.device_feature_external_id);
    if (state.text !== undefined) {
      assert.equal(typeof state.text, 'string');
    } else {
      assert.ok(state.state >= feature.min && state.state <= feature.max, feature.external_id);
    }
  }
  const empty = buildStates(
    fakeGladys,
    fullInfo,
    { ...fullSnapshot, battery: { level: null, rangeKm: null } },
    fullContext,
  );
  assert.ok(!empty.some((s) => s.device_feature_external_id.endsWith(':battery_level')));
});

test('external ids: VIN and feature, never a name', () => {
  assert.deepEqual(parseExternalId('ext:byd:vehicle:LGXCE6CB0P0000001:tyre_rear_left'), {
    vin: 'LGXCE6CB0P0000001',
    feature: 'tyre_rear_left',
  });
  assert.deepEqual(parseExternalId('ext:byd:vehicle:LGXCE6CB0P0000001'), {
    vin: 'LGXCE6CB0P0000001',
    feature: null,
  });
  assert.equal(parseExternalId('ext:byd:vehicle:short'), null);
});
