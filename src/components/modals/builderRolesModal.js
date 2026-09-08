const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { isStaff } = require('../../utils/perms');

module.exports = {
  id: 'builder:rolesm',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));

    const required = builder.parseRoleInput(interaction.guild, interaction.fields.getTextInputValue('required_role'));
    const reward = builder.parseRoleInput(interaction.guild, interaction.fields.getTextInputValue('reward_role'));
    const staff = builder.parseRoleInput(interaction.guild, interaction.fields.getTextInputValue('staff_role'));
    if (!required.ok || !reward.ok || !staff.ok) {
      return void (await interaction.reply(embeds.errorPayload('builder.bad_role')));
    }

    dao.updateExam(exam.id, {
      required_role_id: required.value,
      reward_role_id: reward.value,
      staff_role_id: staff.value,
    });
    await interaction.update(builder.home(exam.id));
  },
};
