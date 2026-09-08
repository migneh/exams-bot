const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { requireStaff } = require('../../utils/perms');
const { sendLog } = require('../../utils/audit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription(t('cmd.settings.desc'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addRoleOption((o) => o.setName('staff_role').setDescription(t('cmd.settings.staff_role')))
    .addChannelOption((o) =>
      o
        .setName('review_channel')
        .setDescription(t('cmd.settings.review_channel'))
        .addChannelTypes(ChannelType.GuildText)
    )
    .addChannelOption((o) =>
      o
        .setName('log_channel')
        .setDescription(t('cmd.settings.log_channel'))
        .addChannelTypes(ChannelType.GuildText)
    )
    .addChannelOption((o) =>
      o
        .setName('exams_category')
        .setDescription(t('cmd.settings.exams_category'))
        .addChannelTypes(ChannelType.GuildCategory)
    ),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;

    const patch = {};
    if (interaction.options.getRole('staff_role')) patch.staff_role_id = interaction.options.getRole('staff_role').id;
    if (interaction.options.getChannel('review_channel')) patch.review_channel_id = interaction.options.getChannel('review_channel').id;
    if (interaction.options.getChannel('log_channel')) patch.log_channel_id = interaction.options.getChannel('log_channel').id;
    if (interaction.options.getChannel('exams_category')) patch.exams_category_id = interaction.options.getChannel('exams_category').id;

    let settings = dao.getSettings(interaction.guildId);
    if (Object.keys(patch).length || !settings) {
      settings = dao.saveSettings(interaction.guildId, patch);
      await sendLog(
        interaction.guild,
        embeds.info(t('log.settings_updated'), `<@${interaction.user.id}>`)
      );
    }

    const embed = embeds.dark(`⚙️ ${t('cmd.settings.view_title')}`);
    embed.setDescription(t('cmd.settings.view_desc'));
    const value = (id, kind) => {
      if (!id) return `❌ ${t('common.not_set')}`;
      return kind === 'role' ? `<@&${id}>` : `<#${id}>`;
    };
    embed.addFields(
      { name: `🛡️ ${t('cmd.settings.staff_role')}`, value: value(settings?.staff_role_id, 'role'), inline: true },
      { name: `📥 ${t('cmd.settings.review_channel')}`, value: value(settings?.review_channel_id, 'channel'), inline: true },
      { name: `📜 ${t('cmd.settings.log_channel')}`, value: value(settings?.log_channel_id, 'channel'), inline: true },
      { name: `🗂️ ${t('cmd.settings.exams_category')}`, value: value(settings?.exams_category_id, 'channel'), inline: true }
    );
    await interaction.reply({ embeds: [embed] });
  },
};
