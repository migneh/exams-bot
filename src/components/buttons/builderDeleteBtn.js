const { t } = require('../../utils/strings');
const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

module.exports = {
  id: 'builder:delete',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    await interaction.showModal(
      builder.makeConfirmModal(`builder:deletem:${exam.id}`, 'builder.delete_confirm_title', t('common.confirm_word_delete'))
    );
  },
};
