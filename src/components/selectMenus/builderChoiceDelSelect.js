const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

/** Delete one choice, then return to the question editor. */
module.exports = {
  id: 'builder:choicedel',
  async execute(interaction, questionId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const q = dao.getQuestion(questionId);
    if (!q) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    const choiceId = (interaction.values || [])[0];
    dao.deleteChoice(choiceId);
    await interaction.update(builder.questionEditor(q.id));
  },
};
