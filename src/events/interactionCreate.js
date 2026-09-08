const logger = require('../utils/logger');
const commandHandler = require('../handlers/commandHandler');
const componentHandler = require('../handlers/componentHandler');
const embeds = require('../utils/embeds');
const { t } = require('../utils/strings');
const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
        await commandHandler.execute(interaction);
      } else if (
        interaction.isButton() ||
        interaction.isAnySelectMenu() ||
        interaction.isModalSubmit()
      ) {
        await componentHandler.handleSafe(interaction);
      }
    } catch (err) {
      logger.error(`interaction ${interaction.id} (${interaction.type}) failed:`, err);
      try {
        const payload = {
          embeds: [embeds.error(t('error.title'), t('error.generic'))],
          flags: MessageFlags.Ephemeral,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
        else if (interaction.isRepliable() && !interaction.isAutocomplete())
          await interaction.reply(payload);
      } catch {
        /* ignore */
      }
    }
  },
};
