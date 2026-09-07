const dao = require('../../database/dao');
const reviewQueue = require('../../systems/reviewQueue');
const embeds = require('../../utils/embeds');
const { isStaff } = require('../../utils/perms');

module.exports = {
  id: 'review:gradem',
  async execute(interaction, answerId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const answer = dao.getAnswerById(answerId);
    if (!answer) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    const attempt = dao.getAttempt(answer.attempt_id);
    if (!attempt || attempt.status !== 'reviewing') {
      return void (await interaction.reply(embeds.errorPayload('error.attempt_closed')));
    }
    const question = dao.getQuestion(answer.question_id);
    const max = question ? question.points : 0;

    const score = parseInt((interaction.fields.getTextInputValue('score') || '').trim(), 10);
    if (Number.isNaN(score) || score < 0 || score > max) {
      return void (await interaction.reply(embeds.errorPayload('builder.bad_score')));
    }
    const feedback = (interaction.fields.getTextInputValue('feedback') || '').trim();

    const result = await reviewQueue.onGraded(answer.id, {
      score,
      feedback,
      reviewerId: interaction.user.id,
      interaction,
    });
    if (result && result.closed) {
      return void (await interaction.reply(embeds.errorPayload('error.attempt_closed')));
    }
  },
};
