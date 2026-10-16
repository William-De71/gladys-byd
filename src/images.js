// -----------------------------------------------------------------------------
// The picture of a car in the widget.
//
// The list of the cars gives a picture of each model (`picMainUrl`), the one
// the BYD app shows. A widget refers to an image by a key; the core fetches
// its bytes through onWidgetGetImage and caches them one hour per key. The
// key is a hash of the URL: it changes when the picture does, and the handler
// only ever downloads a URL BYD gave (an unknown key is refused).
//
// Gladys takes PNG, JPEG or WebP up to 300 KB: a picture that is not one of
// them is marked broken and the card shows without it. The size and format
// BYD serves are not documented: this is checked on every download.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { validateWidgetImage } from '@gladysassistant/integration-sdk';

const TIMEOUT_MS = 15 * 1000;

/**
 * @description The widget key of a picture URL.
 * @param {string} url - The URL.
 * @returns {string} The key.
 * @example
 * keyOf('https://…/atto3.png'); // -> 'car-0123456789ab'
 */
function keyOf(url) {
  return `car-${createHash('sha256').update(url).digest('hex').slice(0, 12)}`;
}

/**
 * @description Download a picture for the widget, checked as the core will.
 * @param {string} url - The URL.
 * @param {Function} fetchImpl - fetch.
 * @returns {Promise<string>} The raw base64.
 * @throws {Error} When it is not an image Gladys accepts.
 */
async function downloadImage(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`picture: HTTP ${response.status}`);
  }
  const data = Buffer.from(await response.arrayBuffer()).toString('base64');
  const issues = validateWidgetImage(data);
  if (issues.length > 0) {
    throw new Error(issues.join('; '));
  }
  return data;
}

/**
 * @description A registry of the pictures the widget may show.
 * @returns {{ register: Function, urlOf: Function, markBroken: Function }} The registry.
 */
function createPictureRegistry() {
  const urls = new Map();
  const broken = new Set();
  return {
    /**
     * @param {string|null} url - The URL given by BYD.
     * @returns {string|null} Its key, null without a (working) picture.
     */
    register(url) {
      if (typeof url !== 'string' || !url.startsWith('https://')) {
        return null;
      }
      const key = keyOf(url);
      if (broken.has(key)) {
        return null;
      }
      urls.set(key, url);
      return key;
    },
    /**
     * @param {string} key - The key.
     * @returns {string|null} The URL, null for an unknown key.
     */
    urlOf(key) {
      return urls.get(String(key)) ?? null;
    },
    /** @param {string} key - The key of a picture that cannot be served. */
    markBroken(key) {
      broken.add(String(key));
      urls.delete(String(key));
    },
  };
}

export { keyOf, downloadImage, createPictureRegistry };
