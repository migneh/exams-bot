const dao = require('../../database/dao');
const reviewQueue = require('../../systems/reviewQueue');
const embeds = require('../../utils/embeds');
const { t } = require('../../utils/strings');
const { isStaff } = require('../../utils/perms');
const { sendLog } = require('../../utils/audit');
const { resolveExamSettings } = require('../../utils/examSettings');

/** Confirmations for: force-accept / request retake / final rejection. */
module.exports = [
  {
    id: 'review:acceptm',
    async execute(interaction, attemptId) {
      if (!(await guard(interaction, attemptId))) return;
      const attempt = dao.getAttempt(attemptId);
      await interaction.deferUpdate();
      await reviewQueue.accept(attempt.id, interaction.user.id);
      await sendLog(
        interaction.guild,
        embeds.success(
          t('log.review_accepted', { user: `<@${interaction.user.id}>` }),
          `<@${attempt.user_id}> • ${dao.getExam(attempt.exam_id)?.name || '—'}`
        ),
        resolveExamSettings(dao.getExam(attempt.exam_id), dao.getSettings(interaction.guildId) || {}).log_channel_id
      );
    },
  },
  {
    id: 'review:retakem',
    async execute(interaction, attemptId) {
      if (!(await guard(interaction, attemptId))) return;
      const attempt = dao.getAttempt(attemptId);
      await interaction.deferUpdate();
      await reviewQueue.retake(attempt.id, interaction.user.id);
      // disable the control message buttons
      await disableControl(interaction);
      await sendLog(
        interaction.guild,
        embeds.warn(
          t('log.review_retake', { user: `<@${interaction.user.id}>` }),
          `<@${attempt.user_id}> • ${dao.getExam(attempt.exam_id)?.name || '—'}`
        ),
        resolveExamSettings(dao.getExam(attempt.exam_id), dao.getSettings(interaction.guildId) || {}).log_channel_id
      );
    },
  },
  {
    id: 'review:rejectm',
    async execute(interaction, attemptId) {
      if (!(await guard(interaction, attemptId))) return;
      const attempt = dao.getAttempt(attemptId);
      await interaction.deferUpdate();
      await reviewQueue.reject(attempt.id, interaction.user.id);
      await sendLog(
        interaction.guild,
        embeds.error(
          t('log.review_rejected', { user: `<@${interaction.user.id}>` }),
          `<@${attempt.user_id}> • ${dao.getExam(attempt.exam_id)?.name || '—'}`
        ),
        resolveExamSettings(dao.getExam(attempt.exam_id), dao.getSettings(interaction.guildId) || {}).log_channel_id
      );
    },
  },
];

async function guard(interaction, attemptId) {
  const attempt = dao.getAttempt(attemptId);
  if (!isStaff(interaction, attempt?.exam_id)) {
    await interaction.reply(embeds.errorPayload('error.not_staff')).catch(() => {});
    return false;
  }
  const confirm = (interaction.fields.getTextInputValue('confirm') || '').trim();
  if (confirm !== t('common.confirm_word_yes')) {
    await interaction.reply(embeds.errorPayload('error.confirm_word')).catch(() => {});
    return false;
  }
  if (!attempt || attempt.status !== 'reviewing') {
    await interaction.reply(embeds.errorPayload('error.attempt_closed')).catch(() => {});
    return false;
  }
  return true;
}

async function disableControl(interaction) {
  try {
    if (interaction.message && interaction.message.editable) {
      await interaction.message.edit({ components: [] });
    }
  } catch {
    /* ignore */
  }
}
