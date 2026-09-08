const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { requireStaff } = require('../../utils/perms');
const { sendLog } = require('../../utils/audit');
const { fmtDate } = require('../../utils/time');
const channelManager = require('../../systems/channelManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription(t('cmd.blacklist.desc'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription(t('cmd.blacklist.add'))
        .addUserOption((o) => o.setName('user').setDescription(t('cmd.blacklist.user')).setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription(t('cmd.blacklist.reason')))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription(t('cmd.blacklist.remove'))
        .addUserOption((o) => o.setName('user').setDescription(t('cmd.blacklist.user')).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription(t('cmd.blacklist.list'))),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (sub === 'add') {
      const reason = interaction.options.getString('reason');
      dao.addBlacklist(user.id, reason, interaction.user.id);
      // cancel any live attempts
      for (const attempt of dao.listInProgress()) {
        if (attempt.user_id === user.id) {
          dao.updateAttempt(attempt.id, { status: 'cancelled' });
          const ch = await interaction.guild.channels.fetch(attempt.channel_id).catch(() => null);
          if (ch) channelManager.scheduleDelete(ch, 5000);
        }
      }
      await interaction.reply({
        embeds: [embeds.success(t('blacklist.added_title'), `<@${user.id}>${reason ? `\n💬 ${reason}` : ''}`)],
        flags: MessageFlags.Ephemeral,
      });
      await sendLog(
        interaction.guild,
        embeds.error(t('log.blacklist_added', { user: `<@${user.id}>` }), `<@${interaction.user.id}>${reason ? ` • ${reason}` : ''}`)
      );
    } else if (sub === 'remove') {
      dao.removeBlacklist(user.id);
      await interaction.reply({
        embeds: [embeds.success(t('blacklist.removed_title'), `<@${user.id}>`)],
        flags: MessageFlags.Ephemeral,
      });
      await sendLog(
        interaction.guild,
        embeds.success(t('log.blacklist_removed', { user: `<@${user.id}>` }), `<@${interaction.user.id}>`)
      );
    } else if (sub === 'list') {
      const rows = dao.listBlacklist();
      const embed = embeds.dark(`⛔ ${t('blacklist.list_title')}`);
      embed.setDescription(
        rows.length
          ? rows.map((r) => `<@${r.user_id}> — ${r.reason || '—'} • ${fmtDate(r.added_at)}`).join('\n')
          : t('blacklist.empty')
      );
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
