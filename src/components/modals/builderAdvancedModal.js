const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { isStaff } = require('../../utils/perms');

module.exports = {
  id: 'builder:advm',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));

    const parsed = builder.parseAdvanced({
      questions_per_attempt: interaction.fields.getTextInputValue('questions_per_attempt'),
      shuffle_questions: interaction.fields.getTextInputValue('shuffle_questions'),
      shuffle_answers: interaction.fields.getTextInputValue('shuffle_answers'),
    });
    if (!parsed.ok) return void (await interaction.reply(embeds.errorPayload(parsed.key)));

    dao.updateExam(exam.id, parsed.values);
    await interaction.update(builder.home(exam.id));
  },
};
