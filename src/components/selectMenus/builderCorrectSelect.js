const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

/** Mark the correct choice(s), then return to the question editor. */
module.exports = {
  id: 'builder:correct',
  async execute(interaction, questionId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const q = dao.getQuestion(questionId);
    if (!q) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    let values = interaction.values || [];
    if (q.type !== 'mcq_multi') values = values.slice(0, 1);
    dao.setCorrectChoices(q.id, values);
    await interaction.update(builder.questionEditor(q.id));
  },
};
