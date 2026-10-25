# BYD

## Overview

This integration brings your BYD cars into Gladys through the cloud of the overseas **BYD** app (not the app for China): battery, range, charge, lock, doors, windows, climate, tyre pressures, warnings and position. With the remote control PIN of the app, Gladys can also lock and unlock the car, start or stop the climate, flash the lights and run "find my car".

BYD publishes no API: the integration speaks the protocol of the app, after the open-source pyBYD library (used by the Home Assistant integration). BYD may change it at any time.

## Prerequisites

- Gladys Assistant 5.3.0 or later.
- A BYD car connected to the BYD app, and the e-mail address and password of the app account.
- Advised: a second BYD account the car is shared with (sharing is done from the app). The app may sign your phone out when Gladys signs in with the same account.
- For commands: the 6-digit **remote control PIN** set in the BYD app by the account Gladys uses (a shared account sets its own).

## Configuration

| Field                  | Meaning                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| E-mail address         | The account of the BYD app.                                                                   |
| Password               | Its password, stored as a secret.                                                             |
| Country of the account | Two-letter code of the country the account was created in (FR, BE, DE…): it picks the server. |
| Remote control PIN     | The 6 digits of the app. Empty: read only.                                                    |
| Refresh interval       | 5 to 480 minutes (15 by default). Each reading wakes the car up and costs a little battery.   |
| Climate temperature    | 15 to 31 °C, asked when the climate is started from Gladys.                                   |
| Climate duration       | 10, 15, 20, 25 or 30 minutes.                                                                 |
| Home radius            | Under this distance from a house of Gladys (with a position), the car is home.                |
| Language of the texts  | Language of the names, statuses and scene summaries.                                          |

Save, then click **Test the connection**: it lists the cars of the account.

## Usage

### Devices

In **Discover**, add your cars. Each car offers the features it reports: battery, electric range (and fuel for plug-in hybrids), odometer, charging cable, charging status, time to full charge, inside temperature, lock, doors and trunk, windows, climate, the four tyre pressures (in bar), warnings and distance from home. Scan again after a first drive if a feature is missing.

The lock and the climate are commands: they need the PIN. A command is sent in the background; the car answers within a minute and is read again 30 seconds later.

### Dashboard widget

The **BYD car** widget shows the picture of the model, battery, range, lock, openings, charge, inside temperature, climate, position, warnings and the age of the data, with buttons to lock or unlock, start or stop the climate, flash the lights and open the map.

![Two cards of the BYD widget: a car charging at home, one parked in town (generated illustration, not a screenshot)](https://raw.githubusercontent.com/William-De71/gladys-byd/main/docs/assets/widgets.en.png)

### Scenes

Triggers: locked or unlocked, locked but left open, charge started or stopped, cable plugged or unplugged, arrived home or left, warning light on, account problem. Actions: send a command (waits for the car), read the status of the car.

- When the car arrives home → send "Plug the car in: {{triggerEvent.data.battery_level}} %".
- When the car is locked but left open → send {{triggerEvent.data.summary}}.
- Every weekday at 7:40 → send the command "Start the climate".

### Transport

Everything goes through the BYD cloud of your region (badge **cloud**). An orange dot means BYD sees the car offline: the values may be old.

## Troubleshooting

- **Sign-in refused**: check the e-mail address, the password and the country. After a refusal the integration waits 15 minutes (then 30, up to 4 hours) before trying again, so that BYD does not lock the account; saving the configuration tries again at once.
- **PIN refused**: every command stops until you change the PIN in the configuration. Repeated wrong PINs lock the remote control of the car for the day.
- **Your phone was signed out**: use a second account the car is shared with.
- **Old values, "car offline"**: the car has no mobile network (underground car park) or sleeps deeply; commands may fail until it reconnects.
- **A value is missing or looks wrong**: click **Diagnostic** in the configuration, then copy the lines starting with "BYD diagnostic" from the Logs tab into a GitHub issue (VIN, plate and position are removed).
