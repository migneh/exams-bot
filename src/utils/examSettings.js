/**
 * Resolve per-exam overrides over the guild-wide defaults. Every value is
 * optional so existing exams continue to inherit the main bot settings.
 */
function resolveExamSettings(exam, guildSettings = {}) {
  const e = exam || {};
  const g = guildSettings || {};
  return {
    ...g,
    staff_role_id: e.staff_role_id || g.staff_role_id || null,
    review_channel_id: e.review_channel_id || g.review_channel_id || null,
    log_channel_id: e.log_channel_id || g.log_channel_id || null,
    exams_category_id: e.exams_category_id || g.exams_category_id || null,
  };
}

module.exports = { resolveExamSettings };
