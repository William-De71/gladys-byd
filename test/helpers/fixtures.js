// Shared test data: a fake `externalIds` and a car reporting every feature.

import { readVehicleInfo, summarize } from '../../src/vehicle.js';
import { VEHICLE, REALTIME, GPS, CHARGING, HVAC } from './byd-cloud.js';

export const fakeGladys = {
  externalIds(type, id) {
    const device = `ext:byd:${type}:${id}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

// A plug-in hybrid with every value known: every feature is offered.
export const fullInfo = readVehicleInfo({ ...VEHICLE, energyType: '2' });
export const fullSnapshot = summarize(fullInfo, {
  realtime: { ...REALTIME, oilPercent: 40, oilEndurance: 500 },
  gps: GPS,
  charging: CHARGING,
  hvac: HVAC,
});
export const fullContext = { language: 'en', climateOn: false, distanceHomeKm: 1.234 };
