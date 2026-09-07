const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const engine = require('../../systems/examEngine');
const embeds = require('../../utils/embeds');

module.exports = {
  id: 'exam:submitm',
  async execute(interaction, attemptId) {
    const confirm = (interaction.fields.getTextInputValue('confirm') || '').trim();
    if (confirm !== t('common.confirm_word_submit')) {
      return void (await interaction.reply(embeds.errorPayload('error.confirm_word')));
    }
    const attempt = dao.getAttempt(attemptId);
    if (!attempt || attempt.user_id !== interaction.user.id) {
      return void (await interaction.reply(embeds.errorPayload('error.not_for_you')));
    }
    if (attempt.status !== 'in_progress') {
      return void (await interaction.reply(embeds.errorPayload('error.attempt_closed')));
    }
    await interaction.deferUpdate();
    await engine.handleSubmit(attemptId, {});
  },
};
