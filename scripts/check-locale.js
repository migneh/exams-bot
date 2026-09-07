// Verifies every locale key referenced in src/ exists in locales/ar.json.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const locale = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'ar.json'), 'utf8'));
const localeKeys = new Set(Object.keys(locale));

const used = new Set();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) scan(fs.readFileSync(full, 'utf8'));
  }
}

function scan(code) {
  // t('key'), t("key") and errorPayload('key')
  for (const m of code.matchAll(/[^\w.$](?:t|errorPayload)\(\s*['"]([a-z0-9_.]+)['"]\s*[,)]/g)) {
    used.add(m[1]);
  }
  // noteKey: 'key'
  for (const m of code.matchAll(/noteKey:\s*['"]([a-z0-9_.]+)['"]/g)) {
    used.add(m[1]);
  }
  // key: 'key' (returned from parsers / eligibility)
  for (const m of code.matchAll(/key:\s*'([a-z0-9_.]+)'/g)) {
    used.add(m[1]);
  }
  // template families: t(`type.${x}`) etc.
  for (const m of code.matchAll(/[^\w.$]t\(\s*`([a-z0-9_.]+)\$\{/g)) {
    const prefix = m[1];
    for (const k of localeKeys) if (k.startsWith(prefix)) used.add(k);
  }
}

walk(path.join(ROOT, 'src'));

const missing = [...used].filter((k) => !localeKeys.has(k) && !['discord.js'].includes(k));
const unused = [...localeKeys].filter((k) => !used.has(k) && !k.startsWith('brand.name') && !k.startsWith('error.guild_only'));

if (missing.length) {
  console.error('❌ MISSING KEYS:');
  for (const k of missing.sort()) console.error('  -', k);
  process.exit(1);
}
console.log(`✅ all ${used.size} referenced keys exist in locales/ar.json`);
console.log(`ℹ️  ${unused.length} unused/extra keys:`, unused.join(', '));
