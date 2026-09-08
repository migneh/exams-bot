const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { isStaff } = require('../../utils/perms');

module.exports = {
  id: 'builder:channelsm',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));

    const review = builder.parseChannelInput(interaction.guild, interaction.fields.getTextInputValue('review_channel'));
    const log = builder.parseChannelInput(interaction.guild, interaction.fields.getTextInputValue('log_channel'));
    const category = builder.parseChannelInput(interaction.guild, interaction.fields.getTextInputValue('exams_category'), { category: true });
    if (!review.ok || !log.ok || !category.ok) {
      return void (await interaction.reply(embeds.errorPayload('builder.bad_channel')));
    }

    dao.updateExamSettings(exam.id, {
      review_channel_id: review.value,
      log_channel_id: log.value,
      exams_category_id: category.value,
    });
    await interaction.update(builder.home(exam.id));
  },
};
