// SQLite driver selection:
//  1. better-sqlite3 (preferred — the plan's stack, synchronous + battle-tested)
//  2. node:sqlite (built into Node >= 22.5, zero native build) as a fallback
// This keeps the bot runnable everywhere, including hosts where native
// compilation or prebuilt downloads are blocked.

const logger = require('../utils/logger');

function createDatabase(file) {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(file);
    logger.info('sqlite driver: better-sqlite3');
    return db;
  } catch (err) {
    logger.warn(`better-sqlite3 unavailable (${err.code || err.message}) — falling back to node:sqlite`);
    const { DatabaseSync } = require('node:sqlite');
    return wrapNodeSqlite(new DatabaseSync(file));
  }
}

/** Thin better-sqlite3-compatible wrapper around node:sqlite DatabaseSync. */
function wrapNodeSqlite(db) {
  const toNum = (v) => (typeof v === 'bigint' ? Number(v) : v);
  const wrapStatement = (st) => ({
    run: (...args) => {
      const res = st.run(...args);
      return { changes: toNum(res.changes), lastInsertRowid: toNum(res.lastInsertRowid) };
    },
    get: (...args) => st.get(...args),
    all: (...args) => st.all(...args),
  });

  return {
    __driver: 'node:sqlite',
    exec: (sql) => db.exec(sql),
    prepare: (sql) => wrapStatement(db.prepare(sql)),
    pragma: (statement) => {
      try {
        return db.prepare(`PRAGMA ${statement}`).all();
      } catch {
        return [];
      }
    },
    transaction: (fn) =>
      function tx(...args) {
        db.exec('BEGIN');
        try {
          const result = fn(...args);
          db.exec('COMMIT');
          return result;
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      },
    close: () => db.close(),
  };
}

module.exports = { createDatabase };
