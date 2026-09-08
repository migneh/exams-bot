const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const state = require('./state');
const logger = require('./utils/logger');

// DB must initialize before anything touches it.
require('./database');

const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');
const componentHandler = require('./handlers/componentHandler');

if (!config.token || !config.clientId) {
  logger.error(
    'missing credentials: copy .env.example to .env and set TOKEN + CLIENT_ID (and optionally GUILD_ID).'
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

process.on('unhandledRejection', (err) => logger.error('unhandled rejection:', err));
process.on('uncaughtException', (err) => logger.error('uncaught exception:', err));

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
