// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// Two cards of the `vehicle` widget on made-up cars (fixed date): an ATTO 3
// charging at home, and a SEAL parked in town, locked with its trunk open.
// The car picture is a drawn illustration (BYD serves the real one of the
// model to the integration), the content around it is real.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildVehicleWidget } = await load('src/widgets.js');
const { readVehicleInfo, summarize } = await load('src/vehicle.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// Thursday 15 October 2026, 20:00 in Paris.
const NOW = Date.parse('2026-10-15T18:00:00Z');
const MINUTE = 60000;

const closed = {
  leftFrontDoor: 0,
  rightFrontDoor: 0,
  leftRearDoor: 0,
  rightRearDoor: 0,
  trunkLid: 0,
  leftFrontWindow: 1,
  rightFrontWindow: 1,
  leftRearWindow: 1,
  rightRearWindow: 1,
};
const locks = (state) => ({
  leftFrontDoorLock: state,
  rightFrontDoorLock: state,
  leftRearDoorLock: state,
  rightRearDoorLock: state,
});

const atto = readVehicleInfo({
  vin: 'LGXCE6CB0P0000001',
  modelName: 'ATTO 3',
  brandName: 'BYD',
  energyType: '0',
  picMainUrl: 'https://example.com/atto3.png',
});
const seal = readVehicleInfo({
  vin: 'LGXCE6CB0P0000002',
  modelName: 'SEAL',
  brandName: 'BYD',
  energyType: '0',
  picMainUrl: 'https://example.com/seal.png',
});

const charging = {
  snapshot: summarize(atto, {
    realtime: {
      ...closed,
      ...locks(2),
      onlineState: 1,
      elecPercent: 64,
      enduranceMileage: 268,
      chargeState: 1,
      fullHour: 1,
      fullMinute: 40,
      tempInCar: 17.5,
      time: (NOW - 6 * MINUTE) / 1000,
    },
    charging: { connectState: 1, chargingState: 1 },
    hvac: { status: 2 },
    gps: { data: { latitude: 48.8584, longitude: 2.2945 } },
  }),
  distanceHomeKm: 0.02,
  atHome: true,
  climateOn: false,
  readAt: NOW - 6 * MINUTE,
};
const parked = {
  snapshot: summarize(seal, {
    realtime: {
      ...closed,
      ...locks(2),
      trunkLid: 1,
      onlineState: 1,
      elecPercent: 31,
      enduranceMileage: 142,
      chargeState: 0,
      tempInCar: 24,
      tirepressureSystem: 1,
      time: (NOW - 14 * MINUTE) / 1000,
    },
    charging: { connectState: 0 },
    hvac: { status: 1 },
    gps: { data: { latitude: 48.8738, longitude: 2.295 } },
  }),
  distanceHomeKm: 1.7,
  atHome: false,
  climateOn: true,
  readAt: NOW - 14 * MINUTE,
};

// A drawn car (illustration), in the 16:9 frame of the widget.
const car = (color) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
<rect width="640" height="360" fill="#eef2f7"/>
<ellipse cx="320" cy="292" rx="250" ry="18" fill="#cfd6e0"/>
<path d="M88 250 Q92 205 150 196 L222 150 Q248 132 290 130 L398 130 Q440 132 470 156 L522 196 Q560 204 556 250 Z" fill="${color}"/>
<path d="M238 160 Q256 146 292 145 L340 145 L340 194 L200 194 Z" fill="#dfe8f3"/>
<path d="M356 145 L398 145 Q432 147 456 166 L486 194 L356 194 Z" fill="#dfe8f3"/>
<rect x="86" y="236" width="472" height="14" rx="7" fill="#2b3440" opacity="0.35"/>
<circle cx="185" cy="258" r="40" fill="#2b3440"/><circle cx="185" cy="258" r="18" fill="#9aa5b4"/>
<circle cx="460" cy="258" r="40" fill="#2b3440"/><circle cx="460" cy="258" r="18" fill="#9aa5b4"/>
<rect x="520" y="206" width="30" height="10" rx="4" fill="#ffd166"/>
<rect x="92" y="208" width="22" height="9" rx="4" fill="#ef476f"/>
</svg>`,
  ).toString('base64')}`;

const contents = {};
const images = {};
for (const language of LANGUAGES) {
  const one = buildVehicleWidget({
    info: atto,
    reading: charging,
    imageKey: 'car-atto3',
    canCommand: true,
    language,
    now: NOW,
  });
  const two = buildVehicleWidget({
    info: seal,
    reading: parked,
    imageKey: 'car-seal',
    canCommand: true,
    language,
    now: NOW,
  });
  contents[language] = { vehicle: one, vehicle2: two };
}
images['car-atto3'] = car('#3a7bd5');
images['car-seal'] = car('#5c6b7a');
const widget = manifest.widgets.find((w) => w.key === 'vehicle');
const widgets = {
  vehicle: { icon: widget.icon, label: widget.label },
  vehicle2: { icon: widget.icon, label: widget.label },
};
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents, images }));
