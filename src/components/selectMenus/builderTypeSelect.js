const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

/** Question type picked → open the question text modal. */
module.exports = {
  id: 'builder:type',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    const type = (interaction.values || [])[0];
    const types = ['mcq_single', 'mcq_multi', 'true_false', 'short', 'long'];
    if (!types.includes(type)) {
      return void (await interaction.reply(embeds.errorPayload('error.invalid_input')));
    }
    await interaction.showModal(builder.makeQuestionModal(`builder:qtextm:${exam.id}:${type}`));
  },
};
