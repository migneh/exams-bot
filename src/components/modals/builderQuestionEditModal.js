const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { isStaff } = require('../../utils/perms');

module.exports = {
  id: 'builder:qeditm',
  async execute(interaction, questionId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const q = dao.getQuestion(questionId);
    if (!q) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));

    const parsed = builder.parseQuestion({
      text: interaction.fields.getTextInputValue('text'),
      points: interaction.fields.getTextInputValue('points'),
      image_url: interaction.fields.getTextInputValue('image_url'),
    });
    if (!parsed.ok) return void (await interaction.reply(embeds.errorPayload(parsed.key)));

    dao.updateQuestion(q.id, parsed.values);
    await interaction.update(builder.questionEditor(q.id));
  },
};
