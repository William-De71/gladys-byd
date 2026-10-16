import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readVehicleInfo, summarize, readLocation, readTyres, num } from '../src/vehicle.js';
import { VEHICLE, REALTIME, GPS, CHARGING, HVAC } from './helpers/byd-cloud.js';

const info = readVehicleInfo(VEHICLE);

test('the description of a car from the list of the account', () => {
  assert.deepEqual(
    { ...info },
    {
      vin: VEHICLE.vin,
      model: 'ATTO 3',
      brand: 'BYD',
      alias: 'Family car',
      plate: 'AB-123-CD',
      energyType: 0,
      isHybrid: false,
      shared: false,
      imageUrl: 'https://cdn.example.com/byd/atto3.png',
    },
  );
  const hybrid = readVehicleInfo({
    vin: VEHICLE.vin,
    energyType: '2',
    cfPic: { picMainUrl: 'http://x' },
  });
  assert.equal(hybrid.isHybrid, true);
  assert.equal(hybrid.imageUrl, null, 'https only');
  assert.equal(hybrid.model, 'BYD');
});

test('a parked, locked, unplugged car', () => {
  const s = summarize(info, { realtime: REALTIME, gps: GPS, charging: CHARGING, hvac: HVAC });
  assert.deepEqual(s.battery, { level: 76, rangeKm: 312 });
  assert.equal(s.odometerKm, 12345.6);
  assert.deepEqual(s.charge, { status: 'unplugged', plugged: false, minutesToFull: null });
  assert.equal(s.lock, 'locked');
  assert.deepEqual(s.openList, []);
  assert.equal(s.openings.frunk, null, 'not reported');
  assert.equal(s.climateOn, false);
  assert.equal(s.tempInside, 18.5);
  assert.deepEqual(s.tyres, { front_left: 2.5, front_right: 2.5, rear_left: 2.4, rear_right: 2.4 });
  assert.deepEqual(s.warnings, []);
  assert.equal(s.online, true);
  assert.deepEqual(s.location, { latitude: 48.8584, longitude: 2.2945, at: 1760000000000 });
  assert.equal(s.updatedAt, 1760000000000);
  assert.deepEqual(s.fuel, { level: null, rangeKm: null });
});

test('charging, an open door, a warning, unknown values', () => {
  const s = summarize(info, {
    realtime: {
      ...REALTIME,
      chargeState: 1,
      fullHour: 1,
      fullMinute: 25,
      leftFrontDoorLock: 1,
      trunkLid: 1,
      rightRearWindow: 2,
      tirepressureSystem: 1,
      tempInCar: -129,
      elecPercent: -1,
      powerBattery: '80',
      enduranceMileage: '--',
    },
  });
  assert.deepEqual(s.charge, { status: 'charging', plugged: true, minutesToFull: 85 });
  assert.equal(s.lock, 'unlocked');
  assert.deepEqual(s.openList, ['trunk', 'window_rear_right']);
  assert.deepEqual(s.warnings, ['tyre_pressure']);
  assert.equal(s.tempInside, null);
  assert.equal(s.battery.level, 80, 'fallback field');
  assert.equal(s.battery.rangeKm, null);
  assert.equal(s.climateOn, null, 'no climate status');
  assert.equal(s.charge.plugged, true);
});

test('lock states 0 (unavailable) are unknown, never "unlocked"', () => {
  const s = summarize(info, {
    realtime: { leftFrontDoorLock: 0, rightFrontDoorLock: 0, backCover: 1 },
  });
  assert.equal(s.lock, null);
  assert.equal(s.openings.trunk, true, 'backCover is the trunk');
});

test('tyre pressures in bar whatever the unit of the car; zeros are unknown', () => {
  assert.deepEqual(
    readTyres({ tirePressUnit: 2, leftFrontTirepressure: 36, rightFrontTirepressure: 0 }),
    { front_left: 2.48, front_right: null, rear_left: null, rear_right: null },
  );
  assert.equal(readTyres({ tirePressUnit: 3, leftRearTirepressure: 250 }).rear_left, 2.5);
  assert.equal(readTyres({ leftRearTirepressure: 2.5 }).rear_left, null, 'unit unknown');
});

test('a hybrid has its fuel; a position needs both coordinates', () => {
  const hybrid = readVehicleInfo({ ...VEHICLE, energyType: 2 });
  const s = summarize(hybrid, { realtime: { ...REALTIME, oilPercent: 45, oilEndurance: 520 } });
  assert.deepEqual(s.fuel, { level: 45, rangeKm: 520 });
  assert.equal(readLocation({ data: { latitude: 0, longitude: 0 } }), null);
  assert.equal(readLocation({ latitude: '48.1', longitude: '' }), null);
  assert.deepEqual(readLocation({ latitude: '48.1', longitude: '2.2' }), {
    latitude: 48.1,
    longitude: 2.2,
    at: null,
  });
  assert.equal(num('NaN'), null);
  assert.equal(num(true), null);
});
