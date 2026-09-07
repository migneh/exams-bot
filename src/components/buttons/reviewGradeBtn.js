const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../../config');
const dao = require('../../database/dao');
const { t } = require('../../utils/strings');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

/** Staff opens the scoring modal for one written answer. */
module.exports = {
  id: 'review:grade',
  async execute(interaction, answerId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const answer = dao.getAnswerById(answerId);
    if (!answer) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    const attempt = dao.getAttempt(answer.attempt_id);
    if (!attempt || attempt.status !== 'reviewing') {
      return void (await interaction.reply(embeds.errorPayload('error.attempt_closed')));
    }
    const question = dao.getQuestion(answer.question_id);
    const maxScore = question ? question.points : 0;

    const scoreInput = new TextInputBuilder()
      .setCustomId('score')
      .setLabel(t('modal.review_score', { max: maxScore }).slice(0, 45))
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(4)
      .setPlaceholder(`0 — ${maxScore}`);
    if (answer.manual_score !== null && answer.manual_score !== undefined) {
      scoreInput.setValue(String(answer.manual_score));
    }

    const feedbackInput = new TextInputBuilder()
      .setCustomId('feedback')
      .setLabel(t('modal.review_feedback').slice(0, 45))
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(config.limits.maxFeedback);
    if (answer.feedback) feedbackInput.setValue(String(answer.feedback).slice(0, config.limits.maxFeedback));

    const modal = new ModalBuilder()
      .setCustomId(`review:gradem:${answer.id}`)
      .setTitle(t('modal.review_title').slice(0, 45))
      .addComponents(
        new ActionRowBuilder().addComponents(scoreInput),
        new ActionRowBuilder().addComponents(feedbackInput)
      );
    await interaction.showModal(modal);
  },
};
