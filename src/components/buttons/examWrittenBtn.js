const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../../config');
const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const { requireAttemptOwner, questionInAttempt } = require('../../utils/guards');

/** Written answer: opens a modal (short / long). */
module.exports = {
  id: 'exam:written',
  async execute(interaction, attemptId, questionId) {
    const attempt = await requireAttemptOwner(interaction, attemptId, {
      statuses: ['in_progress'],
    });
    if (!attempt) return;
    const question = questionInAttempt(attempt, questionId);
    if (!question || (question.type !== 'short' && question.type !== 'long')) return;

    const existing = dao.getAnswer(attempt.id, question.id);
    const isShort = question.type === 'short';
    const input = new TextInputBuilder()
      .setCustomId('answer')
      .setLabel(t('modal.written_label').slice(0, 45))
      .setStyle(isShort ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(isShort ? config.limits.maxShortAnswer : config.limits.maxLongAnswer);
    if (existing && existing.text_answer) input.setValue(existing.text_answer.slice(0, isShort ? config.limits.maxShortAnswer : config.limits.maxLongAnswer));

    const modal = new ModalBuilder()
      .setCustomId(`exam:writtenm:${attempt.id}:${question.id}`)
      .setTitle(`${t(`type.${question.type}`)} — ${t('modal.written_title')}`.slice(0, 45))
      .addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  },
};
