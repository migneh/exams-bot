const dao = require('../../database/dao');
const engine = require('../../systems/examEngine');
const { requireAttemptOwner, questionInAttempt } = require('../../utils/guards');

/** Objective answer via button (mcq_single / true_false). */
module.exports = {
  id: 'exam:pick',
  async execute(interaction, attemptId, questionId, choiceId) {
    const attempt = await requireAttemptOwner(interaction, attemptId, {
      statuses: ['in_progress'],
    });
    if (!attempt) return;
    const question = questionInAttempt(attempt, questionId);
    const choice = dao.getChoice(choiceId);
    if (!question || !choice || choice.question_id !== question.id) {
      return void (await interaction.reply(require('../../utils/embeds').errorPayload('error.invalid_input')));
    }
    if (question.type === 'short' || question.type === 'long') {
      return void (await interaction.reply(require('../../utils/embeds').errorPayload('error.invalid_input')));
    }
    dao.saveChoiceAnswer(attempt.id, question.id, [choice.id]);
    await engine.afterAnswer(interaction, attempt.id, question.id);
  },
};
