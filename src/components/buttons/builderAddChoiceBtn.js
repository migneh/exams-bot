const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const config = require('../../config');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

module.exports = {
  id: 'builder:addchoice',
  async execute(interaction, questionId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const q = dao.getQuestion(questionId);
    if (!q) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    if (dao.listChoices(q.id).length >= config.limits.maxChoices) {
      return void (await interaction.reply(embeds.errorPayload('builder.max_choices')));
    }
    await interaction.showModal(builder.makeChoiceModal(`builder:choicem:${q.id}`));
  },
};
