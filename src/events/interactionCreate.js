const logger = require('../utils/logger');
const commandHandler = require('../handlers/commandHandler');
const componentHandler = require('../handlers/componentHandler');
const embeds = require('../utils/embeds');
const { t } = require('../utils/strings');
const { MessageFlags } = require('discord.js');
const config = require('../config');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // Keep the configured single-server boundary enforced for every
      // interaction, not only during slash-command registration.
      if (config.guildId && interaction.guildId !== config.guildId) {
        if (interaction.isAutocomplete()) return void (await interaction.respond([]).catch(() => {}));
        if (interaction.isRepliable()) {
          return void (await interaction.reply({
            embeds: [embeds.error(t('error.title'), t('error.wrong_guild'))],
            flags: MessageFlags.Ephemeral,
          }).catch(() => {}));
        }
        return;
      }
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
