// -----------------------------------------------------------------------------
// Entry point of the BYD external integration.
//
// Brings BYD cars into Gladys, through the cloud of the overseas BYD app:
//   - devices: one per car (battery, range, charge, lock, doors, windows,
//     climate, tyres, warnings, distance from home), offered on the
//     Discovery screen (see src/device.js);
//   - scene triggers: locked/unlocked, locked but left open, charge started
//     or stopped, cable plugged or unplugged, arrived/left home, warning,
//     account problem;
//   - scene actions: send a command, read the status;
//   - dashboard widget: one card per car.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the BYD integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
