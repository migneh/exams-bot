const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

module.exports = {
  id: 'builder:channels',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    await interaction.showModal(
      builder.makeChannelsModal(`builder:channelsm:${exam.id}`, {
        review_channel_id: exam.review_channel_id,
        log_channel_id: exam.log_channel_id,
        exams_category_id: exam.exams_category_id,
      })
    );
  },
};
