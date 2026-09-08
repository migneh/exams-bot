const dao = require('../database/dao');
const embeds = require('./embeds');
const { t } = require('./strings');

/**
 * Load an attempt and verify the clicker owns it (optionally: status check).
 * Replies with the proper ephemeral error and returns null when invalid.
 */
async function requireAttemptOwner(interaction, attemptId, { statuses = null } = {}) {
  const attempt = dao.getAttempt(attemptId);
  if (!attempt) {
    await interaction.reply(embeds.errorPayload('error.exam_not_found')).catch(() => {});
    return null;
  }
  if (attempt.user_id !== interaction.user.id) {
    await interaction.reply(embeds.errorPayload('error.not_for_you')).catch(() => {});
    return null;
  }
  if (statuses && !statuses.includes(attempt.status)) {
    await interaction.reply(embeds.errorPayload('error.attempt_closed')).catch(() => {});
    return null;
  }
  return attempt;
}

/** Verify the question belongs to the attempt's exam and is in its order. */
function questionInAttempt(attempt, questionId) {
  let order = [];
  try {
    order = attempt.question_order ? JSON.parse(attempt.question_order) : [];
  } catch {
    order = [];
  }
  const q = dao.getQuestion(questionId);
  if (!q || q.exam_id !== attempt.exam_id) return null;
  if (order.length && !order.includes(questionId)) return null;
  return q;
}

module.exports = { requireAttemptOwner, questionInAttempt };
