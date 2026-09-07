const { t } = require('../../utils/strings');
const { makeConfirmModal } = require('../../systems/builder');
const { requireAttemptOwner } = require('../../utils/guards');

module.exports = {
  id: 'exam:cancel',
  async execute(interaction, attemptId) {
    const attempt = await requireAttemptOwner(interaction, attemptId, {
      statuses: ['pending', 'in_progress'],
    });
    if (!attempt) return;
    await interaction.showModal(
      makeConfirmModal(`exam:cancelm:${attempt.id}`, 'exam.cancel_confirm_title', t('common.confirm_word_yes'))
    );
  },
};
