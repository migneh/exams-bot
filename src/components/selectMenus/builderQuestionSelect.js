const builder = require('../../systems/builder');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

/** Question picked from the manage list → open its editor. */
module.exports = {
  id: 'builder:qsel',
  async execute(interaction /* , examId */) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const questionId = (interaction.values || [])[0];
    const dao = require('../../database/dao');
    const q = dao.getQuestion(questionId);
    if (!q) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    await interaction.update(builder.questionEditor(q.id));
  },
};
