const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/strings');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription(t('cmd.help.desc'))
    .setDMPermission(false),
  async execute(interaction) {
    const embed = embeds.info(`📘 ${t('help.title')}`, t('help.intro'));
    embed.addFields(
      {
        name: `👥 ${t('help.members_title')}`,
        value: [
          '`/leaderboard` — ' + t('cmd.leaderboard.desc'),
          '`/help` — ' + t('cmd.help.desc'),
          t('help.panel_hint'),
        ].join('\n'),
      },
      {
        name: `🛡️ ${t('help.staff_title')}`,
        value: [
          '`/exam create` — ' + t('cmd.exam.create'),
          '`/exam edit` — ' + t('cmd.exam.edit'),
          '`/exam delete` — ' + t('cmd.exam.delete'),
          '`/exam list` — ' + t('cmd.exam.list'),
          '`/exam toggle` — ' + t('cmd.exam.toggle'),
          '`/exam duplicate` — ' + t('cmd.exam.duplicate'),
          '`/panel send` — ' + t('cmd.panel.send'),
          '`/settings` — ' + t('cmd.settings.desc'),
          '`/attempts view` — ' + t('cmd.attempts.view'),
          '`/attempts reset` — ' + t('cmd.attempts.reset'),
          '`/blacklist add/remove/list` — ' + t('cmd.blacklist.desc'),
          '`/results export` — ' + t('cmd.results.export'),
          '`/stats` — ' + t('cmd.stats.desc'),
        ].join('\n'),
      }
    );
    await interaction.reply({ embeds: [embed] });
  },
};
