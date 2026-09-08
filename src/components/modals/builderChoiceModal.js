const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { isStaff } = require('../../utils/perms');

module.exports = {
  id: 'builder:choicem',
  async execute(interaction, questionId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const q = dao.getQuestion(questionId);
    if (!q) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));

    const text = (interaction.fields.getTextInputValue('text') || '').trim();
    if (!text || text.length > builder.CHOICE_LABEL) {
      return void (await interaction.reply(embeds.errorPayload('builder.bad_choice')));
    }
    dao.addChoice(q.id, text, 0);
    await interaction.update(builder.questionEditor(q.id));
  },
};
