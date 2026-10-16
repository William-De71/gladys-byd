// -----------------------------------------------------------------------------
// The `vehicle` dashboard widget.
//
// One card per car (setting `vehicle`, a `source: "devices"` select; empty =
// the first car of the account):
//   - the picture of the model the BYD app shows;
//   - two tiles: battery and range;
//   - a status list: lock, openings, charge, inside temperature, climate,
//     position, warnings, connection of the car, age of the data;
//   - up to four buttons: lock/unlock, climate, flash the lights (to find it
//     in a car park), the position on a map. The command buttons need the
//     remote control PIN; unlock and flash ask first.
// The budget of the core is 8 components: 1 picture + 2 tiles + 1 status + 4
// buttons fits exactly.
// -----------------------------------------------------------------------------

import { t, warningLabel, openingsLabel, ago } from './i18n.js';
import { mapUrl } from './geo.js';

const WIDGETS = { VEHICLE: 'vehicle' };
const WIDGET_ACTIONS = {
  LOCK: 'lock',
  UNLOCK: 'unlock',
  CLIMATE_START: 'climate_start',
  CLIMATE_STOP: 'climate_stop',
  FLASH: 'flash_lights',
};
const TTL_SECONDS = { vehicle: 60, message: 120 };
const MAX_STATUS_LENGTH = 40;

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL_SECONDS.message) {
  return { ttl_seconds: ttl, components: [{ type: 'text', variant: 'body', text: message }] };
}

/**
 * @description Format a number (no decimals).
 * @param {number} value - The number.
 * @param {string} language - The language.
 * @param {number} [digits] - Decimals at most.
 * @returns {string} The text.
 */
function formatNumber(value, language, digits = 0) {
  const locale = { fr: 'fr-FR', de: 'de-DE', es: 'es-ES' }[language] ?? 'en-US';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}

/**
 * @description The two tiles of a car.
 * @param {object} snapshot - Its snapshot.
 * @param {string} language - The language.
 * @returns {Array<object>} The tiles (0 to 2).
 */
function tiles(snapshot, language) {
  const result = [];
  const { battery } = snapshot;
  if (battery.level !== null) {
    result.push({
      type: 'value',
      value: formatNumber(battery.level, language),
      unit: '%',
      label: t('battery', language),
      icon: snapshot.charge.status === 'charging' ? 'battery-charging' : 'battery',
      color: battery.level <= 20 ? 'danger' : battery.level <= 40 ? 'warning' : 'success',
    });
  }
  if (battery.rangeKm !== null) {
    result.push({
      type: 'value',
      value: formatNumber(battery.rangeKm, language),
      unit: 'km',
      label: t('range', language),
      icon: 'navigation',
    });
  }
  return result;
}

/**
 * @description The status list of a car.
 * @param {object} reading - Its reading.
 * @param {string} language - The language.
 * @param {number} now - Now, in ms.
 * @returns {Array<object>} The items (at most 10).
 */
function statusItems(reading, language, now) {
  const { snapshot } = reading;
  const items = [];
  if (snapshot.lock) {
    items.push({
      label: t('lockState', language),
      value: t(snapshot.lock, language),
      color: snapshot.lock === 'locked' ? 'success' : 'warning',
    });
  }
  if (Object.values(snapshot.openings).some((state) => state !== null)) {
    items.push({
      label: t('openings', language),
      value:
        snapshot.openList.length === 0
          ? t('allClosed', language)
          : clip(
              t('open', language, { list: openingsLabel(snapshot.openList, language) }),
              MAX_STATUS_LENGTH,
            ),
      color: snapshot.openList.length === 0 ? 'success' : 'warning',
    });
  }
  if (snapshot.charge.status) {
    const status = snapshot.charge.status;
    let value = t(`charge_${status}`, language);
    if (status === 'charging' && snapshot.charge.minutesToFull !== null) {
      value = clip(
        `${value} · ${t('fullIn', language, { time: duration(snapshot.charge.minutesToFull) })}`,
        MAX_STATUS_LENGTH,
      );
    }
    items.push({
      label: t('charging', language),
      value,
      color: status === 'charging' ? 'info' : 'neutral',
    });
  }
  if (snapshot.tempInside !== null) {
    items.push({
      label: t('inside', language),
      value: `${formatNumber(snapshot.tempInside, language, 1)} °C`,
    });
  }
  items.push({
    label: t('climate', language),
    value: t(reading.climateOn ? 'on' : 'off', language),
    color: reading.climateOn ? 'info' : 'neutral',
  });
  if (reading.atHome !== null) {
    items.push({
      label: t('position', language),
      value: reading.atHome
        ? t('atHome', language)
        : t('awayFrom', language, { km: formatNumber(reading.distanceHomeKm, language) }),
      color: reading.atHome ? 'success' : 'neutral',
    });
  }
  items.push({
    label: t('warnings', language),
    value:
      snapshot.warnings.length === 0
        ? t('noWarning', language)
        : clip(
            snapshot.warnings.map((warning) => warningLabel(warning, language)).join(', '),
            MAX_STATUS_LENGTH,
          ),
    color: snapshot.warnings.length === 0 ? 'success' : 'danger',
  });
  if (snapshot.online === false) {
    items.push({
      label: t('connection', language),
      value: t('carOffline', language),
      color: 'warning',
    });
  }
  const updatedAt = snapshot.updatedAt ?? reading.readAt;
  if (Number.isFinite(updatedAt)) {
    items.push({ label: t('updated', language), value: ago(updatedAt, now, language) });
  }
  return items.slice(0, 10);
}

/**
 * @description "1 h 25" from minutes.
 * @param {number} minutes - The minutes.
 * @returns {string} The duration.
 */
function duration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = String(minutes % 60).padStart(2, '0');
  return hours > 0 ? `${hours} h ${rest}` : `${minutes} min`;
}

/**
 * @description The buttons of a car.
 * @param {object} info - The car description.
 * @param {object} reading - Its reading.
 * @param {boolean} canCommand - Whether a PIN allows commands.
 * @param {string} language - The language.
 * @returns {Array<object>} The buttons (0 to 4).
 */
function buttons(info, reading, canCommand, language) {
  const { snapshot } = reading;
  const params = { vin: info.vin };
  const result = [];
  if (canCommand) {
    if (snapshot.lock === 'locked') {
      result.push({
        type: 'button',
        label: t('buttonUnlock', language),
        icon: 'unlock',
        style: 'secondary',
        action: { key: WIDGET_ACTIONS.UNLOCK, params, confirm: true },
      });
    } else {
      result.push({
        type: 'button',
        label: t('buttonLock', language),
        icon: 'lock',
        style: 'primary',
        action: { key: WIDGET_ACTIONS.LOCK, params },
      });
    }
    result.push(
      reading.climateOn
        ? {
            type: 'button',
            label: t('buttonClimateStop', language),
            icon: 'wind',
            style: 'secondary',
            action: { key: WIDGET_ACTIONS.CLIMATE_STOP, params },
          }
        : {
            type: 'button',
            label: t('buttonClimateStart', language),
            icon: 'wind',
            style: 'primary',
            action: { key: WIDGET_ACTIONS.CLIMATE_START, params },
          },
    );
    result.push({
      type: 'button',
      label: t('buttonFlash', language),
      icon: 'sun',
      style: 'secondary',
      action: { key: WIDGET_ACTIONS.FLASH, params, confirm: true },
    });
  }
  if (snapshot.location) {
    result.push({
      type: 'button',
      label: t('buttonMap', language),
      icon: 'map-pin',
      style: 'secondary',
      link: { url: mapUrl(snapshot.location) },
    });
  }
  return result;
}

/**
 * @description The `vehicle` widget.
 * @param {object} options - Options.
 * @param {object} options.info - The car description.
 * @param {object|null} options.reading - Its last reading.
 * @param {string|null} options.imageKey - The key of its picture.
 * @param {boolean} options.canCommand - Whether a PIN allows commands.
 * @param {object} [options.settings] - `{ show_buttons }`.
 * @param {string} options.language - The language.
 * @param {number} options.now - Now, in ms.
 * @returns {object} The content.
 */
function buildVehicleWidget({ info, reading, imageKey, canCommand, settings = {}, language, now }) {
  if (!reading) {
    return messageContent(t('loading', language), 30);
  }
  const components = [];
  if (imageKey) {
    components.push({
      type: 'image',
      key: imageKey,
      alt: clip(`${info.brand} ${info.model}`, 100),
      fit: 'contain',
    });
  }
  components.push(...tiles(reading.snapshot, language));
  components.push({ type: 'status', items: statusItems(reading, language, now) });
  if (settings.show_buttons !== false) {
    components.push(...buttons(info, reading, canCommand, language));
  }
  return { ttl_seconds: TTL_SECONDS.vehicle, components };
}

export { WIDGETS, WIDGET_ACTIONS, messageContent, buildVehicleWidget };
