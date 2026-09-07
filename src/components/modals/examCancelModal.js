const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const timerManager = require('../../systems/timerManager');
const channelManager = require('../../systems/channelManager');
const embeds = require('../../utils/embeds');
const { sendLog } = require('../../utils/audit');

module.exports = {
  id: 'exam:cancelm',
  async execute(interaction, attemptId) {
    const confirm = (interaction.fields.getTextInputValue('confirm') || '').trim();
    if (confirm !== t('common.confirm_word_yes')) {
      return void (await interaction.reply(embeds.errorPayload('error.confirm_word')));
    }
    const attempt = dao.getAttempt(attemptId);
    if (!attempt || attempt.user_id !== interaction.user.id) {
      return void (await interaction.reply(embeds.errorPayload('error.not_for_you')));
    }
    if (!['pending', 'in_progress'].includes(attempt.status)) {
      return void (await interaction.reply(embeds.errorPayload('error.attempt_closed')));
    }

    dao.updateAttempt(attempt.id, { status: 'cancelled' });
    timerManager.disarm(attempt.id);

    const embed = embeds.warn(t('exam.cancelled_title'), t('exam.cancelled_desc'));
    await interaction.update({ content: '', embeds: [embed], components: [] });
    channelManager.scheduleDelete(interaction.channel, 15000);

    const exam = dao.getExam(attempt.exam_id);
    await sendLog(
      interaction.guild,
      embeds.warn(
        t('log.attempt_cancelled', { user: `<@${attempt.user_id}>` }),
        `${exam ? exam.name : '—'} • <#${attempt.channel_id}>`
      )
    );
  },
};
