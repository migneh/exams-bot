const config = require('../../config');
const dao = require('../../database/dao');
const engine = require('../../systems/examEngine');
const embeds = require('../../utils/embeds');
const { requireAttemptOwner, questionInAttempt } = require('../../utils/guards');

module.exports = {
  id: 'exam:writtenm',
  async execute(interaction, attemptId, questionId) {
    const attempt = await requireAttemptOwner(interaction, attemptId, {
      statuses: ['in_progress'],
    });
    if (!attempt) return;
    if (await engine.rejectIfExpired(interaction, attempt)) return;
    const question = questionInAttempt(attempt, questionId);
    if (!question || (question.type !== 'short' && question.type !== 'long')) {
      return void (await interaction.reply(embeds.errorPayload('error.invalid_input')));
    }
    const text = (interaction.fields.getTextInputValue('answer') || '').trim();
    const max = question.type === 'short' ? config.limits.maxShortAnswer : config.limits.maxLongAnswer;
    if (!text || text.length > max) {
      return void (await interaction.reply(embeds.errorPayload('error.invalid_input')));
    }
    dao.saveTextAnswer(attempt.id, question.id, text);
    await engine.afterAnswer(interaction, attemptId, questionId);
  },
};
