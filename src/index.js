const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const state = require('./state');
const logger = require('./utils/logger');

// DB must initialize before anything touches it.
require('./database');

const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');
const componentHandler = require('./handlers/componentHandler');

if (!config.token || !config.clientId || !config.guildId) {
  logger.error(
    'missing configuration: copy .env.example to .env and set TOKEN, CLIENT_ID, and GUILD_ID.'
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel],
});

state.client = client;

commandHandler.loadCommands();
componentHandler.loadComponents();
eventHandler.loadEvents(client);

process.on('unhandledRejection', (err) => {
  logger.error('unhandled rejection:', err);
  process.exitCode = 1;
});
process.on('uncaughtException', (err) => {
  logger.error('uncaught exception:', err);
  // Continuing after an uncaught exception can leave timers and interaction
  // state inconsistent. Let the process supervisor restart a clean instance.
  process.exit(1);
});

const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down`);
  try {
    await client.destroy();
  } catch {
    /* ignore */
  }
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(config.token).catch((err) => {
  logger.error('login failed:', err?.message || err);
  process.exit(1);
});
