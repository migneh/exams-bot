const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { isStaff } = require('../../utils/perms');

module.exports = {
  id: 'builder:settingsm',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));

    const parsed = builder.parseBasics({
      name: interaction.fields.getTextInputValue('name'),
      description: interaction.fields.getTextInputValue('description'),
      duration_min: interaction.fields.getTextInputValue('duration_min'),
      pass_percent: interaction.fields.getTextInputValue('pass_percent'),
      combo: interaction.fields.getTextInputValue('combo'),
    });
    if (!parsed.ok) return void (await interaction.reply(embeds.errorPayload(parsed.key)));

    dao.updateExam(exam.id, parsed.values);
    await interaction.update(builder.home(exam.id));
  },
};
