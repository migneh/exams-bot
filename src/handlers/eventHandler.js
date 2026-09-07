const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function loadEvents(client, dir = path.join(__dirname, '..', 'events')) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const event = require(path.join(dir, entry.name));
    if (!event || !event.name) continue;
    const handler = (...args) => Promise.resolve(event.execute(...args, client)).catch((err) =>
      logger.error(`event ${event.name} failed:`, err)
    );
    if (event.once) client.once(event.name, handler);
    else client.on(event.name, handler);
    logger.debug(`bound event ${event.name}`);
  }
}

module.exports = { loadEvents };
