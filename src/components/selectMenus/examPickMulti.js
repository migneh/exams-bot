const dao = require('../../database/dao');
const engine = require('../../systems/examEngine');
const embeds = require('../../utils/embeds');
const { requireAttemptOwner, questionInAttempt } = require('../../utils/guards');

/** Objective answer via select menu (mcq_multi, or mcq_single with >5 choices). */
module.exports = {
  id: 'exam:pickmulti',
  async execute(interaction, attemptId, questionId) {
    const attempt = await requireAttemptOwner(interaction, attemptId, {
      statuses: ['in_progress'],
    });
    if (!attempt) return;
    if (await engine.rejectIfExpired(interaction, attempt)) return;
    const question = questionInAttempt(attempt, questionId);
    if (!question) {
      return void (await interaction.reply(embeds.errorPayload('error.invalid_input')));
    }
    let values = interaction.values || [];
    if (question.type !== 'mcq_multi') values = values.slice(0, 1);
    // all values must be choices of this question
    for (const v of values) {
      const c = dao.getChoice(v);
      if (!c || c.question_id !== question.id) {
        return void (await interaction.reply(embeds.errorPayload('error.invalid_input')));
      }
    }
    dao.saveChoiceAnswer(attempt.id, question.id, values);
    await engine.afterAnswer(interaction, attempt.id, question.id);
  },
};
