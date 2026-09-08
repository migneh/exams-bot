const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/strings');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription(t('cmd.ping.desc'))
    .setDMPermission(false),
  async execute(interaction) {
    const sent = await interaction.reply({
      embeds: [embeds.info('🏓 ...')],
      fetchReply: true,
    });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply({
      embeds: [
        embeds.success('🏓 Pong!', t('ping.reply', { ms: roundtrip, ws: Math.round(interaction.client.ws.ping) })),
      ],
    });
  },
};
