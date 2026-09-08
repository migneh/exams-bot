const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { t } = require('../../utils/strings');
const { isStaff } = require('../../utils/perms');
const { sendLog } = require('../../utils/audit');

module.exports = {
  id: 'builder:deletem',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const confirm = (interaction.fields.getTextInputValue('confirm') || '').trim();
    if (confirm !== t('common.confirm_word_delete')) {
      return void (await interaction.reply(embeds.errorPayload('error.confirm_word')));
    }
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    const openAttempts = dao.attemptsForExam(exam.id).filter((attempt) =>
      ['pending', 'in_progress', 'reviewing', 'review_failed'].includes(attempt.status)
    );
    if (openAttempts.length) {
      return void (await interaction.reply(embeds.errorPayload('builder.delete_active')));
    }
    dao.deleteExam(exam.id);
    await interaction.update({
      embeds: [embeds.success(t('builder.deleted_title'), t('builder.deleted_desc', { name: exam.name }))],
      components: [],
    });
    await sendLog(
      interaction.guild,
      embeds.error(t('log.exam_deleted', { name: exam.name }), `<@${interaction.user.id}>`)
    );
  },
};
