// Minimal file + console logger (no external deps).
const fs = require('fs');
const path = require('path');
const config = require('../config');

const LOG_DIR = path.join(config.dataDir, 'logs');

function ensureDir() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

function stamp() {
  return new Date().toISOString();
}

function fmt(value) {
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function write(level, args) {
  const parts = args.map(fmt);
  const line = `[${stamp()}] [${level}] ${parts.join(' ')}`;
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](line);
  if (level === 'debug') return;
  ensureDir();
  const file = path.join(LOG_DIR, `bot-${new Date().toISOString().slice(0, 10)}.log`);
  try {
    fs.appendFileSync(file, line + '\n');
  } catch {
    /* ignore write errors */
  }
}

module.exports = {
  debug: (...a) => write('debug', a),
  info: (...a) => write('info', a),
  warn: (...a) => write('warn', a),
  error: (...a) => write('error', a),
};
