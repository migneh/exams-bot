// Arabic-first localization: every user-facing string lives in locales/ar.json
const locale = require('../../locales/ar.json');

/**
 * Translate a key, optionally interpolating {vars}.
 * Falls back to the key itself when missing (easy to spot in testing).
 */
function t(key, vars = {}) {
  let s = locale[key] !== undefined ? locale[key] : key;
  for (const [name, value] of Object.entries(vars)) {
    s = s.split(`{${name}}`).join(String(value ?? ''));
  }
  return s;
}

module.exports = { t, locale };
