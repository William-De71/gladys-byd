// -----------------------------------------------------------------------------
// Which BYD server holds an account, from its country.
//
// The overseas BYD app (not the Chinese one) has one cloud per region; an
// account only exists on the server of the country it was created in. The
// country → server table is the one the BYD app uses, as published by the
// Home Assistant integration hass-byd-vehicle (MIT, see NOTICE). The server
// also wants the country code and a language with every request.
// -----------------------------------------------------------------------------

const SERVERS = {
  eu: 'https://dilinkappoversea-eu.byd.auto',
  sg: 'https://dilinkappoversea-sg.byd.auto',
  au: 'https://dilinkappoversea-au.byd.auto',
  br: 'https://dilinkappoversea-br.byd.auto',
  jp: 'https://dilinkappoversea-jp.byd.auto',
  uz: 'https://dilinkappoversea-uz.byd.auto',
  no: 'https://dilinkappoversea-no.byd.auto',
  mx: 'https://dilinkappoversea-mx.byd.auto',
  id: 'https://dilinkappoversea-id.byd.auto',
  tr: 'https://dilinkappoversea-tr.byd.auto',
  kr: 'https://dilinkappoversea-kr.byd.auto',
  in: 'https://dilinkappoversea-in.byd.auto',
  vn: 'https://dilinkappoversea-vn.byd.auto',
  sa: 'https://dilinkappoversea-sa.byd.auto',
  om: 'https://dilinkappoversea-om.byd.auto',
  kz: 'https://dilinkappoversea-kz.byd.auto',
};

// Server of each country (ISO 3166-1 alpha-2). "no" is the Middle East and
// Africa server, despite its name.
const COUNTRY_SERVER = {
  ...Object.fromEntries(
    'NO NL DE DK SE FR AT LU BE FI IT ES PT GB IE IS IL HU MT GR CH PL CY EE LV LT CZ RO SK SI BG HR LI ME RS BA MK AL MD MC VA XK UA'
      .split(' ')
      .map((code) => [code, 'eu']),
  ),
  ...Object.fromEntries(
    'SG TH MY HK MO KH LA PH BN MM NP BD PK LK PF NC MN BT MV'
      .split(' ')
      .map((code) => [code, 'sg']),
  ),
  AU: 'au',
  NZ: 'au',
  BR: 'br',
  JP: 'jp',
  UZ: 'uz',
  ...Object.fromEntries('AE KW QA MA BH JO ZA RE MU EG'.split(' ').map((code) => [code, 'no'])),
  ...Object.fromEntries(
    'MX CL UY CO DO CR PE EC PY BO PA GT SV HN NI AR'.split(' ').map((code) => [code, 'mx']),
  ),
  ID: 'id',
  TR: 'tr',
  KR: 'kr',
  IN: 'in',
  VN: 'vn',
  SA: 'sa',
  OM: 'om',
  KZ: 'kz',
};

// Language the server answers in (messages, units), as the app sends it.
// Countries not listed use English.
const COUNTRY_LANGUAGE = {
  FR: 'fr',
  LU: 'fr',
  MC: 'fr',
  PF: 'fr',
  NC: 'fr',
  RE: 'fr',
  DE: 'de',
  AT: 'de',
  CH: 'de',
  LI: 'de',
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CL: 'es',
  CO: 'es',
  PE: 'es',
  EC: 'es',
  UY: 'es',
  PY: 'es',
  BO: 'es',
  CR: 'es',
  DO: 'es',
  GT: 'es',
  SV: 'es',
  HN: 'es',
  NI: 'es',
  PA: 'es',
  IT: 'it',
  VA: 'it',
  NL: 'nl',
  PT: 'pt',
  BR: 'pt',
};

/**
 * @description The connection settings of a country.
 * @param {string} country - ISO country code (any case).
 * @returns {{ country: string, baseUrl: string, language: string }|null} The
 * settings, null for a country without BYD server.
 * @example
 * regionOf('fr'); // -> { country: 'FR', baseUrl: 'https://dilinkappoversea-eu.byd.auto', language: 'fr' }
 */
function regionOf(country) {
  const code = String(country ?? '')
    .trim()
    .toUpperCase();
  const server = COUNTRY_SERVER[code];
  if (!server) {
    return null;
  }
  return { country: code, baseUrl: SERVERS[server], language: COUNTRY_LANGUAGE[code] ?? 'en' };
}

export { SERVERS, COUNTRY_SERVER, regionOf };
