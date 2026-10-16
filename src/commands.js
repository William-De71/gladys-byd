// -----------------------------------------------------------------------------
// Remote commands.
//
// Every command needs the remote control PIN of the BYD app (configuration
// field `control_pin`). The cloud answers once the car has carried it out,
// which takes from a few seconds to a minute for a car asleep: device
// commands and widget buttons run in the background, scene actions wait.
//
// "Flash the lights" and "find my car" (horn + lights) are never fired by
// the integration itself, only on request (widget button with confirmation,
// scene action).
// -----------------------------------------------------------------------------

import { CLIMATE_DURATIONS } from './config.js';

const COMMANDS = ['lock', 'unlock', 'climate_start', 'climate_stop', 'flash_lights', 'find_car'];

/**
 * @description The `controlParamsMap` of a climate start, as the app sends it
 * (pyBYD ClimateStartParams): temperatures on the 1-17 scale of the car (15 to
 * 31 °C), duration code 1-5 (10 to 30 minutes), immediate start (mode 4).
 * @param {number} temperature - °C.
 * @param {number} minutes - 10, 15, 20, 25 or 30.
 * @returns {object} The parameters.
 * @example
 * climateParams(21, 20); // -> { mainSettingTemp: 7, timeSpan: 3, … }
 */
function climateParams(temperature, minutes) {
  const scale = Math.min(17, Math.max(1, Math.round(Number(temperature) - 14)));
  const index = CLIMATE_DURATIONS.indexOf(Number(minutes));
  return {
    airAccuracy: 1,
    airConditioningMode: 1,
    airSet: null,
    copilotSettingTemp: scale,
    cycleMode: 2,
    mainSettingTemp: scale,
    remoteMode: 4,
    timeSpan: index === -1 ? 3 : index + 1,
  };
}

/**
 * @description Run a command and wait for the car.
 * @param {object} byd - The BYD client.
 * @param {object} info - The car description.
 * @param {string} command - A COMMANDS value.
 * @param {object} [options] - `{ temperature, minutes }` for climate_start.
 * @returns {Promise<object>} The final answer of the cloud.
 * @throws {Error} When the command is unknown or not carried out.
 * @example
 * await runCommand(byd, info, 'lock');
 */
async function runCommand(byd, info, command, { temperature = 21, minutes = 20 } = {}) {
  if (!COMMANDS.includes(command)) {
    throw new Error(`Unknown command ${command}`);
  }
  const params = command === 'climate_start' ? climateParams(temperature, minutes) : null;
  return byd.remoteControl(info.vin, command, params);
}

export { COMMANDS, climateParams, runCommand };
