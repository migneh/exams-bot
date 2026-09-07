const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

module.exports = {
  id: 'builder:settings',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    await interaction.showModal(
      builder.makeBasicsModal(`builder:settingsm:${exam.id}`, {
        name: exam.name,
        description: exam.description || '',
        duration_min: exam.duration_min,
        pass_percent: exam.pass_percent,
        combo: `${exam.max_attempts}, ${exam.cooldown_hours}`,
      })
    );
  },
};
