const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { requireStaff } = require('../../utils/perms');
const { sendLog } = require('../../utils/audit');
const { resolveExamSettings } = require('../../utils/examSettings');
const { fmtDate } = require('../../utils/time');
const channelManager = require('../../systems/channelManager');
const timerManager = require('../../systems/timerManager');

const STATUS_EMOJI = {
  pending: '📭',
  in_progress: '✍️',
  reviewing: '⏳',
  review_failed: '⚠️',
  graded: '🏁',
  cancelled: '🚫',
  retake: '🔄',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('attempts')
    .setDescription(t('cmd.attempts.desc'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription(t('cmd.attempts.view'))
        .addUserOption((o) => o.setName('user').setDescription(t('cmd.attempts.user')).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription(t('cmd.attempts.reset'))
        .addUserOption((o) => o.setName('user').setDescription(t('cmd.attempts.user')).setRequired(true))
        .addStringOption((o) =>
          o.setName('exam').setDescription(t('cmd.exam_option')).setRequired(true).setAutocomplete(true)
        )
    ),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (sub === 'view') {
      const rows = dao.attemptsByUser(user.id);
      const embed = embeds.dark(`👤 ${t('attempts.view_title', { user: user.username })}`);
      embed.setThumbnail(user.displayAvatarURL());
      if (dao.isBlacklisted(user.id)) embed.addFields({ name: '⛔', value: t('blacklist.flagged'), inline: true });
      embed.setDescription(
        rows.length
          ? rows
              .map((a) => {
                const status = `${STATUS_EMOJI[a.status] || '❓'} ${t(`status.${a.status}`)}`;
                const score =
                  a.status === 'graded'
                    ? ` • **${a.auto_score + a.manual_score}/${a.max_score}** (${Math.round(
                        ((a.auto_score + a.manual_score) / Math.max(1, a.max_score)) * 100
                      )}%)`
                    : '';
                const res =
                  a.status === 'graded' ? ` • ${a.passed ? '✅' : '❌'}` : '';
                return `**#${a.attempt_number}** ${a.exam_name} — ${status}${score}${res} • ${fmtDate(a.started_at)}`;
              })
              .join('\n')
          : t('attempts.none')
      );
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (sub === 'reset') {
      const exam = dao.getExam(interaction.options.getString('exam'));
      if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
      const liveAttempts = dao.resetAttempts(user.id, exam.id);
      // Close channels and disarm timers for attempts that were just
      // cancelled. Querying attemptsByUser after reset would only see the new
      // `cancelled` status and leak the channels.
      for (const attempt of liveAttempts) {
        timerManager.disarm(attempt.id);
        const ch = await interaction.guild.channels.fetch(attempt.channel_id).catch(() => null);
        if (ch) channelManager.scheduleDelete(ch, 5000);
      }
      await interaction.reply({
        embeds: [
          embeds.success(
            t('attempts.reset_title'),
            t('attempts.reset_desc', { user: `<@${user.id}>`, exam: exam.name })
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      await sendLog(
        interaction.guild,
        embeds.warn(
          t('log.attempts_reset', { user: `<@${user.id}>` }),
          `${exam.name} • <@${interaction.user.id}>`
        ),
        resolveExamSettings(exam, dao.getSettings(interaction.guildId) || {}).log_channel_id
      );
    }
  },
  async autocomplete(interaction) {
    const { examAutocomplete } = require('../../utils/autocomplete');
    return examAutocomplete(interaction);
  },
};
