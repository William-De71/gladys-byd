# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for BYD cars: a Node.js service
(Node 22+, ESM, no build step) that runs in its own sandboxed Docker container
and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It speaks the undocumented protocol of the
overseas BYD app (Bangcle white-box AES envelope, AES payload, signed
requests), as a rewrite after the pyBYD Python library (MIT, see NOTICE), and
reads every car every 15 minutes by default. Transport: cloud only.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/byd-client.test.js       # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
UPDATE_BASELINE=1 node --test test/structure.test.js   # ONLY with a documented migration
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect()
src/byd/bangcle.js      outer envelope: white-box AES-CBC with the tables of src/data/
src/byd/crypto.js       payload AES, MD5, signature, checkcode
src/byd/client.js       BYD cloud client: login, kept session, pauses, PIN guard, commands
src/byd/regions.js      country -> BYD server and language
src/byd/device-profile.js   the phone identity presented to BYD (drawn once, /data)
src/data/bangcle_tables.bin white-box tables (from pyBYD, MIT, see NOTICE)
src/storage.js          JSON files in /data (session.json, device.json)
src/vehicle.js          BYD answers -> snapshots (null, never 0, when unknown)
src/poller.js           the timer loop: live data, position, charge, climate per car
src/events.js           snapshots -> scene trigger events
src/device.js           one device per car (VIN), its features and states
src/commands.js         remote commands and the climate parameters
src/widgets.js          the vehicle dashboard widget
src/scene-actions.js    outputs of the status scene action
src/transport.js        cloud / unreachable / degraded badge
src/images.js           car pictures for the widget
src/diagnostic.js       anonymized raw answers for the Diagnostic button
src/config.js           configuration
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **The protocol is checked against pyBYD.** `test/fixtures/crypto-vectors.json`
  and `request-vectors.json` were produced by pyBYD: a change of the
  cryptography or of the request fields must keep these tests green. Never
  invent an endpoint or a field: read pyBYD (and say where it comes from).
- **External ids are forever**, and so is every key users store: device and
  feature external ids (`vehicle:<VIN>[:<feature>]`, never a name), feature
  `category` / `type` / `unit` / `min` / `max` / `step`, the keys of
  `config_schema`, `actions`, the widget and its settings, scene triggers
  (fields, options, variables) and scene actions (fields, outputs).
  `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json` (version 0.1.0): never update the
  baseline to make a test pass without a documented migration.
- **Category / type pairs** come from the SDK constants and have an icon and a
  label in the Gladys front (`test/devices.test.js` lists them).
  `distance-sensor` + `integer` has none: distances are `decimal`.
- **`should_poll` stays false**: the cars are read on the integration's own
  timer. Each reading wakes the car: keep the default at 15 minutes.
- **Account safety.** One login, kept in `/data/session.json` (never the
  password), a new one only when BYD says the session expired. A refused
  login pauses every attempt (15 min, doubling up to 4 h). A refused PIN
  (5005, 5006, 5011) blocks every command until the PIN changes: never retry
  a refused PIN, BYD locks the remote control of the car.
- **No scene event because of a scene action** (loops): a refused PIN during
  a scene action does not fire `account_problem`.
- **The container rootfs is read-only.** Write only under `/data`. Never log
  the password, the PIN, a full VIN or a position: `redactVin`, and
  `src/diagnostic.js` for the Diagnostic button (Gladys sends no DEBUG to the
  container).
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. Widget button labels: 24 characters
  at most.
- **Widget images.** After any change to the content of the widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. Transport: `["cloud"]`. `gladys_version` `>=5.1.1`; a widget button
  with a form would need 5.2.0.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (the fake BYD cloud of
  `test/helpers/byd-cloud.js`).
