const { t } = require('../../utils/strings');
const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

module.exports = {
  id: 'builder:qdel',
  async execute(interaction, questionId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const q = dao.getQuestion(questionId);
    if (!q) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    await interaction.showModal(
      builder.makeConfirmModal(`builder:qdelm:${q.id}`, 'builder.qdel_confirm_title', t('common.confirm_word_delete'))
    );
  },
};
