const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { t } = require('../../utils/strings');
const { isStaff } = require('../../utils/perms');

/** New question created → straight into the question editor. */
module.exports = {
  id: 'builder:qtextm',
  async execute(interaction, examId, type) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));

    const parsed = builder.parseQuestion({
      text: interaction.fields.getTextInputValue('text'),
      points: interaction.fields.getTextInputValue('points'),
      image_url: interaction.fields.getTextInputValue('image_url'),
    });
    if (!parsed.ok) return void (await interaction.reply(embeds.errorPayload(parsed.key)));

    const q = dao.addQuestion(exam.id, { type, ...parsed.values });

    if (type === 'true_false') {
      const right = dao.addChoice(q.id, t('common.true'), 1);
      dao.addChoice(q.id, t('common.false'), 0);
      void right;
    }

    await interaction.update(builder.questionEditor(q.id));
  },
};
