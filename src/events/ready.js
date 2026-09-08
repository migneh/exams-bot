const logger = require('../utils/logger');
const commandHandler = require('../handlers/commandHandler');
const timerManager = require('../systems/timerManager');
const channelManager = require('../systems/channelManager');
const reviewQueue = require('../systems/reviewQueue');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`logged in as ${client.user.tag} (${client.user.id})`);
    client.user.setPresence({
      status: 'online',
      activities: [{ name: 'نظام الامتحانات 📝', type: 3 }], // 3 = WATCHING
    });

    try {
      await commandHandler.register(client);
    } catch (err) {
      logger.error('command registration failed:', err);
    }

    // Restart-proof: re-hydrate timers for every in-progress attempt.
    try {
      await timerManager.hydrate();
    } catch (err) {
      logger.error('timer hydration failed:', err);
    }

    try {
      await channelManager.hydrate();
    } catch (err) {
      logger.error('channel cleanup hydration failed:', err);
    }

    try {
      await reviewQueue.hydrate();
    } catch (err) {
      logger.error('review queue hydration failed:', err);
    }

    logger.info('boot complete — bot is ready');
  },
};
