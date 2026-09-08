const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

module.exports = {
  id: 'builder:adv',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    await interaction.showModal(
      builder.makeAdvancedModal(`builder:advm:${exam.id}`, {
        questions_per_attempt: exam.questions_per_attempt || '',
        shuffle_questions: !!exam.shuffle_questions,
        shuffle_answers: !!exam.shuffle_answers,
      })
    );
  },
};
