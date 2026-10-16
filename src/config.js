// -----------------------------------------------------------------------------
// Configuration of the BYD integration.
//
// Fields of the config_schema:
//   - `username`             e-mail address of the BYD app account;
//   - `password`             its password (secret: never logged, never stored
//                            outside the Gladys configuration);
//   - `country`              ISO code of the country of the account: it picks
//                            the BYD server (src/byd/regions.js);
//   - `control_pin`          the 6-digit remote control PIN set in the BYD app
//                            (secret); empty = read only, no command;
//   - `poll_interval`        minutes between two readings: each reading wakes
//                            the car, which costs a little battery;
//   - `climate_temperature`  °C asked when the climate is started;
//   - `climate_duration`     minutes the climate runs (10, 15, 20, 25 or 30,
//                            the only values the car accepts);
//   - `home_radius`          the distance from home (m) under which a car is home;
//   - `language`             language of the texts written outside a widget
//                            request: `auto` = the language of the last widget
//                            request, else en / fr / de / es.
//
// Internal key, outside the config_schema: `last_language`.
// -----------------------------------------------------------------------------

// Minutes.
const POLL_INTERVAL = { min: 5, max: 480, default: 15 };
const HOME_RADIUS = { min: 50, max: 5000, default: 200 };
// °C, the range of most BYD cars (pyBYD: scale 1-17 from 15 °C).
const CLIMATE_TEMPERATURE = { min: 15, max: 31, default: 21 };
const CLIMATE_DURATIONS = [10, 15, 20, 25, 30];
const DEFAULT_CLIMATE_DURATION = 20;
const LANGUAGES = ['en', 'fr', 'de', 'es'];
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };

/**
 * @description Read a bounded number field, falling back to its default.
 * @param {unknown} raw - The raw value (the form can send numbers as strings).
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('10', POLL_INTERVAL); // -> 10
 */
function readNumber(raw, bounds) {
  const value = Number(raw ?? bounds.default);
  if (raw === '' || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description Read a trimmed string.
 * @param {unknown} raw - The raw value.
 * @returns {string} The string, '' when absent.
 */
function readString(raw) {
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} The config.
 * @example
 * normalizeConfig({ username: 'me@example.com', password: 'x', country: 'fr' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const duration = Number(config.climate_duration);
  const pin = readString(config.control_pin);
  return {
    username: readString(config.username),
    // A password may start or end with a space: kept as typed.
    password: typeof config.password === 'string' ? config.password : '',
    country: readString(config.country).toUpperCase() || 'FR',
    pin: /^\d{4,8}$/.test(pin) ? pin : '',
    pinInvalid: pin !== '' && !/^\d{4,8}$/.test(pin),
    pollInterval: readNumber(config.poll_interval, POLL_INTERVAL),
    climateTemperature: readNumber(config.climate_temperature, CLIMATE_TEMPERATURE),
    climateDuration: CLIMATE_DURATIONS.includes(duration) ? duration : DEFAULT_CLIMATE_DURATION,
    homeRadius: readNumber(config.home_radius, HOME_RADIUS),
    language: LANGUAGES.includes(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Whether the account is filled in.
 * @param {object} config - The normalized config.
 * @returns {boolean} True with an e-mail address and a password.
 */
function hasAccount(config) {
  return Boolean(config.username && config.password);
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  POLL_INTERVAL,
  HOME_RADIUS,
  CLIMATE_TEMPERATURE,
  CLIMATE_DURATIONS,
  LANGUAGES,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  normalizeConfig,
  hasAccount,
  readLanguage,
};
