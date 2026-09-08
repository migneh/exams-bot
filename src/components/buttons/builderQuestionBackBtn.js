const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

/** Back from a sub-view (correct-picker / choice-delete) to the question editor. */
module.exports = {
  id: 'builder:qback',
  async execute(interaction, questionId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const q = dao.getQuestion(questionId);
    if (!q) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    await interaction.update(builder.questionEditor(q.id));
  },
};
