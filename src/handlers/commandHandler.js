const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config');

const commands = new Collection();

function loadCommands(dir = path.join(__dirname, '..', 'commands')) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const mod = require(full);
      if (mod && mod.data && mod.data.name) {
        commands.set(mod.data.name, mod);
        logger.debug(`loaded command /${mod.data.name}`);
      }
    }
  }
  return commands;
}

/** Register slash commands to the configured guild (instant) or globally. */
async function register(client) {
  const body = [...commands.values()].map((c) => c.data.toJSON());
  if (config.guildId) {
    await client.application.commands.set(body, config.guildId);
    logger.info(`registered ${body.length} guild slash commands to ${config.guildId}`);
  } else {
    await client.application.commands.set(body);
    logger.info(`registered ${body.length} global slash commands`);
  }
}

async function execute(interaction) {
  const command = commands.get(interaction.commandName);
  if (!command) return;
  if (interaction.isAutocomplete()) {
    if (command.autocomplete) await command.autocomplete(interaction);
    return;
  }
  await command.execute(interaction);
}

module.exports = { commands, loadCommands, register, execute };
