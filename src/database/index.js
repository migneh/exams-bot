const fs = require('fs');
const path = require('path');
const config = require('../config');
const migrate = require('./migrate');
const logger = require('../utils/logger');
const { createDatabase } = require('./driver');

fs.mkdirSync(config.dataDir, { recursive: true });

const db = createDatabase(path.join(config.dataDir, config.dbFile));
db.pragma('busy_timeout = 5000');
migrate(db);

process.on('exit', () => {
  try {
    db.close();
  } catch {
    /* ignore */
  }
});

logger.info(`sqlite opened: ${path.join(config.dataDir, config.dbFile)}`);

module.exports = db;
