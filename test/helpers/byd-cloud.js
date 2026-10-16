// A fake BYD cloud for the tests: it decodes the Bangcle envelope, decrypts
// the payload, checks the signature and the checkcode like the real one, and
// answers encrypted data. Never touches the network.

import { encodeEnvelope, decodeEnvelope } from '../../src/byd/bangcle.js';
import {
  md5Hex,
  loginKey,
  sign,
  checkcode,
  aesEncryptHex,
  aesDecryptHex,
} from '../../src/byd/crypto.js';

export const VIN = 'LGXCE6CB0P0000001';
export const PASSWORD = 'Secret!1';
export const PIN = '123456';
export const USERNAME = 'driver@example.com';
const TOKEN = { userId: '7001', signToken: 'SIGN-TOKEN', encryToken: 'ENCRY-TOKEN' };
// A 1 x 1 transparent PNG, the picture of the car.
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export const VEHICLE = {
  vin: VIN,
  modelName: 'ATTO 3',
  brandName: 'BYD',
  energyType: '0',
  autoAlias: 'Family car',
  autoPlate: 'AB-123-CD',
  picMainUrl: 'https://cdn.example.com/byd/atto3.png',
  totalMileage: 12345,
  empowerType: 2,
};

// A parked, locked ATTO 3, unplugged, all closed.
export const REALTIME = {
  onlineState: 1,
  elecPercent: 76,
  enduranceMileage: 312,
  totalMileage: 12345.6,
  tempInCar: 18.5,
  chargeState: 0,
  fullHour: -1,
  fullMinute: -1,
  leftFrontDoorLock: 2,
  rightFrontDoorLock: 2,
  leftRearDoorLock: 2,
  rightRearDoorLock: 2,
  leftFrontDoor: 0,
  rightFrontDoor: 0,
  leftRearDoor: 0,
  rightRearDoor: 0,
  trunkLid: 0,
  leftFrontWindow: 1,
  rightFrontWindow: 1,
  leftRearWindow: 1,
  rightRearWindow: 1,
  skylight: 1,
  tirePressUnit: 1,
  leftFrontTirepressure: 2.5,
  rightFrontTirepressure: 2.5,
  leftRearTirepressure: 2.4,
  rightRearTirepressure: 2.4,
  tirepressureSystem: 0,
  rapidTireLeak: 0,
  powerSystem: 0,
  brakingSystem: 0,
  abs: 0,
  esp: -1,
  time: 1760000000,
};

export const GPS = {
  data: { latitude: 48.8584, longitude: 2.2945, gpsTimeStamp: 1760000000, speed: 0 },
};
export const CHARGING = { vin: VIN, soc: 76, chargingState: 0, connectState: 0 };
export const HVAC = { statusNow: { status: 2, tempInCar: 18.5, tempOutCar: 12 } };

/**
 * @description A fetch Response-like object.
 * @param {number} status - HTTP status.
 * @param {string|Buffer} body - The body.
 * @returns {object} The response.
 */
function reply(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => String(body),
    arrayBuffer: async () => (Buffer.isBuffer(body) ? body : Buffer.from(String(body))),
  };
}

/**
 * @description Create the fake cloud.
 * @param {object} [options] - Answers and behaviours.
 * @returns {{ fetchImpl: Function, calls: Array, cloud: object }} The fake.
 */
export function createFakeCloud(options = {}) {
  const cloud = {
    password: PASSWORD,
    pin: PIN,
    vehicles: [VEHICLE],
    realtime: REALTIME,
    gps: GPS,
    charging: CHARGING,
    hvac: HVAC,
    unsupported: new Set(),
    remoteResult: { controlState: 1 },
    expireNext: false,
    ...options,
  };
  const calls = [];

  const answer = (data, key) =>
    reply(
      200,
      JSON.stringify({
        response: encodeEnvelope(
          JSON.stringify({
            code: '0',
            message: 'ok',
            respondData: data === undefined ? '' : aesEncryptHex(JSON.stringify(data), key),
          }),
        ),
      }),
    );
  const fail = (code) =>
    reply(
      200,
      JSON.stringify({
        response: encodeEnvelope(JSON.stringify({ code, message: `error ${code}` })),
      }),
    );

  async function fetchImpl(url, init = {}) {
    if (!url.startsWith('https://dilinkappoversea-')) {
      calls.push({ endpoint: url });
      return url.endsWith('.png') ? reply(200, PNG) : reply(404, 'not found');
    }
    const endpoint = new URL(url).pathname;
    const outer = JSON.parse(decodeEnvelope(JSON.parse(init.body).request));
    const { checkcode: received, ...rest } = outer;
    if (received !== checkcode(rest)) {
      return fail('1003');
    }
    if (endpoint === '/app/account/login') {
      calls.push({ endpoint, outer });
      if (outer.signKey !== cloud.password) {
        return fail('3008');
      }
      return answer({ token: TOKEN }, loginKey(cloud.password));
    }
    const key = md5Hex(TOKEN.encryToken);
    const inner = JSON.parse(aesDecryptHex(outer.encryData, key));
    calls.push({ endpoint, outer, inner });
    const signed = {
      ...inner,
      countryCode: outer.countryCode,
      identifier: outer.identifier,
      imeiMD5: outer.imeiMD5,
      language: outer.language,
      reqTimestamp: outer.reqTimestamp,
    };
    if (outer.sign !== sign(signed, md5Hex(TOKEN.signToken))) {
      return fail('1003');
    }
    if (cloud.expireNext) {
      cloud.expireNext = false;
      return fail('1005');
    }
    if (cloud.unsupported.has(endpoint)) {
      return fail('1001');
    }
    switch (endpoint) {
      case '/app/account/getAllListByUserId':
        return answer(cloud.vehicles, key);
      case '/vehicleInfo/vehicle/vehicleRealTimeRequest':
        return answer({ requestSerial: 'RT-1' }, key);
      case '/vehicleInfo/vehicle/vehicleRealTimeResult':
        return answer({ ...cloud.realtime, requestSerial: inner.requestSerial }, key);
      case '/control/getGpsInfo':
        return answer({ requestSerial: 'GPS-1' }, key);
      case '/control/getGpsInfoResult':
        return answer({ ...cloud.gps, requestSerial: inner.requestSerial }, key);
      case '/control/smartCharge/homePage':
        return answer(cloud.charging, key);
      case '/control/getStatusNow':
        return answer(cloud.hvac, key);
      case '/vehicle/vehicleswitch/verifyControlPassword':
        return inner.commandPwd === md5Hex(cloud.pin) ? answer({ ok: true }, key) : fail('5005');
      case '/control/remoteControl':
        if (inner.commandPwd !== md5Hex(cloud.pin)) {
          return fail('5005');
        }
        return answer({ requestSerial: 'RC-1', controlState: 0 }, key);
      case '/control/remoteControlResult':
        return answer({ ...cloud.remoteResult, requestSerial: inner.requestSerial }, key);
      default:
        return fail('1001');
    }
  }

  return { fetchImpl, calls, cloud };
}

/**
 * @description A storage kept in memory.
 * @param {object} [initial] - Initial files.
 * @returns {object} The storage.
 */
export function memoryStorage(initial = {}) {
  const files = { ...initial };
  return {
    files,
    async read(name) {
      return files[name] === undefined ? null : structuredClone(files[name]);
    },
    async write(name, value) {
      if (value === null || value === undefined) {
        delete files[name];
      } else {
        files[name] = structuredClone(value);
      }
    },
  };
}
