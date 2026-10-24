# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.1] - 2026-10-24

### Security

- **security:** build the image on Node.js 24.22.1 or later ([1a30bb4](https://github.com/William-De71/gladys-byd/commit/1a30bb4f0c69c1d20b43d0bd2b25c7ef4aa13732))

## [0.1.0] - 2026-10-16

### Added

- A device per BYD car of the account (overseas BYD app cloud): battery level, electric range, fuel level and range (plug-in hybrids), odometer, charging cable, charging status, time to full charge, inside temperature, lock, doors, windows, climate, tyre pressures, warnings and distance from home.
- Remote commands with the remote control PIN of the BYD app: lock, unlock, start and stop the climate (temperature and duration set in the configuration), flash the lights, find my car. A refused PIN stops every command until it is changed, so the remote control of the car is never locked by retries.
- Scene triggers: locked or unlocked, locked but left open, charge started or stopped, cable plugged or unplugged, arrived home or left, warning light on, account problem (sign-in or PIN refused).
- Scene actions: send a command and wait for the car, read the status of the car (lock, openings, battery, range, charge, climate, position, warnings, with a ready-made sentence).
- A dashboard widget per car: picture, battery, range, lock, openings, charge, climate, position, warnings and quick buttons.
- One kept session (stored in /data), a pause after a refused sign-in, and a Diagnostic button writing the anonymized answers of BYD to the logs.
- English, French, German and Spanish.

[0.1.1]: https://github.com/William-De71/gladys-byd/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/William-De71/gladys-byd/releases/tag/v0.1.0
