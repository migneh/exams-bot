const engine = require('../../systems/examEngine');
const { requireAttemptOwner } = require('../../utils/guards');

module.exports = {
  id: 'exam:nav',
  async execute(interaction, attemptId, index) {
    const attempt = await requireAttemptOwner(interaction, attemptId, {
      statuses: ['in_progress'],
    });
    if (!attempt) return;
    await engine.navTo(interaction, attemptId, index);
  },
};
