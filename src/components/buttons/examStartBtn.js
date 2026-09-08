const engine = require('../../systems/examEngine');

module.exports = {
  id: 'exam:start',
  async execute(interaction, attemptId) {
    await engine.startExam(interaction, attemptId);
  },
};
