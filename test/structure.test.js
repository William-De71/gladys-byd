// -----------------------------------------------------------------------------
// Non-regression of everything users store: the device and feature external
// ids, the fields the Discovery "Update" button compares (category, type,
// unit, min, max, step), and every key of the manifest a scene, a widget or a
// saved configuration refers to.
//
// test/fixtures/discovery.baseline.json was generated from version 0.1.0 (the
// first release). A failure here means existing users would have to delete
// and recreate a device, or would lose a scene or a widget setting: never
// update the baseline without a documented migration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

import { buildDevice } from '../src/device.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, fullInfo, fullSnapshot, fullContext } from './helpers/fixtures.js';

const BASELINE = new URL('./fixtures/discovery.baseline.json', import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const ETERNAL = [
  'external_id',
  'category',
  'type',
  'unit',
  'min',
  'max',
  'step',
  'read_only',
  'has_feedback',
];
const pick = (feature) =>
  Object.fromEntries(
    ETERNAL.filter((key) => feature[key] !== undefined).map((key) => [key, feature[key]]),
  );
const keys = (list) => (list ?? []).map((entry) => entry.key);

/**
 * @description What users store, from the current code.
 * @param {string} language - The language of the names (they must not matter).
 * @returns {object} The structure.
 */
function current(language) {
  const device = buildDevice(fakeGladys, fullInfo, fullSnapshot, { ...fullContext, language });
  return {
    device: {
      external_id: device.external_id,
      should_poll: device.should_poll,
      params: device.params.map((param) => param.name),
      features: device.features.map(pick),
    },
    config: keys(manifest.config_schema),
    actions: keys(manifest.actions),
    scene_triggers: manifest.scene_triggers.map((trigger) => ({
      key: trigger.key,
      fields: (trigger.fields ?? []).map((field) => ({
        key: field.key,
        options: (field.options ?? []).map((option) => option.value),
      })),
      variables: keys(trigger.variables),
    })),
    scene_actions: manifest.scene_actions.map((action) => ({
      key: action.key,
      fields: (action.fields ?? []).map((field) => ({
        key: field.key,
        options: (field.options ?? []).map((option) => option.value),
      })),
      outputs: keys(action.outputs),
    })),
    widgets: manifest.widgets.map((widget) => ({
      key: widget.key,
      settings: keys(widget.settings),
    })),
  };
}

if (process.env.UPDATE_BASELINE === '1') {
  writeFileSync(BASELINE, `${JSON.stringify(current('en'), null, 2)}\n`);
}
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

test('the device keeps its external ids and the fields Discovery compares, in every language', () => {
  for (const language of LANGUAGES) {
    assert.deepEqual(current(language).device, baseline.device, language);
  }
});

test('the manifest keeps every key users store (configuration, scenes, widgets)', () => {
  const now = current('en');
  for (const part of ['config', 'actions', 'scene_triggers', 'scene_actions', 'widgets']) {
    assert.deepEqual(now[part], baseline[part], part);
  }
});
