const { t } = require('../../utils/strings');
const { makeConfirmModal } = require('../../systems/builder');
const { requireAttemptOwner } = require('../../utils/guards');

module.exports = {
  id: 'exam:submit',
  async execute(interaction, attemptId) {
    const attempt = await requireAttemptOwner(interaction, attemptId, {
      statuses: ['in_progress'],
    });
    if (!attempt) return;
    await interaction.showModal(
      makeConfirmModal(`exam:submitm:${attempt.id}`, 'exam.confirm_submit_title', t('common.confirm_word_submit'))
    );
  },
};
