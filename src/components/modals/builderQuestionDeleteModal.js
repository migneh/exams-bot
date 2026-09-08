const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { t } = require('../../utils/strings');
const { isStaff } = require('../../utils/perms');

module.exports = {
  id: 'builder:qdelm',
  async execute(interaction, questionId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const confirm = (interaction.fields.getTextInputValue('confirm') || '').trim();
    if (confirm !== t('common.confirm_word_delete')) {
      return void (await interaction.reply(embeds.errorPayload('error.confirm_word')));
    }
    const q = dao.getQuestion(questionId);
    if (!q) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    const examId = q.exam_id;
    dao.deleteQuestion(q.id);
    // re-number order_index
    dao.listQuestions(examId).forEach((qq, i) => dao.updateQuestion(qq.id, { order_index: i }));
    await interaction.update(builder.questionSelect(examId));
  },
};
