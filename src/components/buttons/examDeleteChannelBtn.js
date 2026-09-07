const channelManager = require('../../systems/channelManager');
const dao = require('../../database/dao');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

/** Close the exam channel early (owner or staff, after grading). */
module.exports = {
  id: 'exam:delchan',
  async execute(interaction, attemptId) {
    const attempt = dao.getAttempt(attemptId);
    if (!attempt) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    const allowed = attempt.user_id === interaction.user.id || isStaff(interaction);
    if (!allowed) return void (await interaction.reply(embeds.errorPayload('error.not_for_you')));
    if (['pending', 'in_progress'].includes(attempt.status)) {
      return void (await interaction.reply(embeds.errorPayload('error.attempt_open')));
    }
    await interaction.deferUpdate();
    channelManager.scheduleDelete(interaction.channel, 3000);
  },
};
