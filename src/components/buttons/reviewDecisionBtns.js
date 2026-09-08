const { t } = require('../../utils/strings');
const { makeConfirmModal } = require('../../systems/builder');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

/** Staff decisions on a review control message → confirmation modals. */
module.exports = [
  {
    id: 'review:accept',
    async execute(interaction, attemptId) {
      if (!(await guard(interaction, attemptId))) return;
      await interaction.showModal(
        makeConfirmModal(`review:acceptm:${attemptId}`, 'review.accept_confirm_title', t('common.confirm_word_yes'))
      );
    },
  },
  {
    id: 'review:retake',
    async execute(interaction, attemptId) {
      if (!(await guard(interaction, attemptId))) return;
      await interaction.showModal(
        makeConfirmModal(`review:retakem:${attemptId}`, 'review.retake_confirm_title', t('common.confirm_word_yes'))
      );
    },
  },
  {
    id: 'review:reject',
    async execute(interaction, attemptId) {
      if (!(await guard(interaction, attemptId))) return;
      await interaction.showModal(
        makeConfirmModal(`review:rejectm:${attemptId}`, 'review.reject_confirm_title', t('common.confirm_word_yes'))
      );
    },
  },
];

async function guard(interaction, attemptId) {
  if (!isStaff(interaction)) {
    await interaction.reply(embeds.errorPayload('error.not_staff')).catch(() => {});
    return false;
  }
  const attempt = dao.getAttempt(attemptId);
  if (!attempt || attempt.status !== 'reviewing') {
    await interaction.reply(embeds.errorPayload('error.attempt_closed')).catch(() => {});
    return false;
  }
  return true;
}
