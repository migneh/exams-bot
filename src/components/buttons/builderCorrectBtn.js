const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

module.exports = {
  id: 'builder:correctbtn',
  async execute(interaction, questionId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const q = dao.getQuestion(questionId);
    if (!q) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    if (!dao.listChoices(q.id).length) {
      return void (await interaction.reply(embeds.errorPayload('builder.no_choices_err')));
    }
    await interaction.update(builder.correctSelect(q.id, q.type === 'mcq_multi'));
  },
};
