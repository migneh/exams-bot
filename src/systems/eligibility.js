const dao = require('../database/dao');
const { fmtDate } = require('../utils/time');

/**
 * Full eligibility check before creating/starting an attempt.
 * Returns { ok: true } or { ok: false, key, vars } — key is a locale string.
 */
function checkEligibility({ guild, member, exam }) {
  // 1. Blacklist
  if (dao.isBlacklisted(member.id)) {
    return { ok: false, key: 'eligibility.blacklisted' };
  }

  // 2. Required role
  if (exam.required_role_id && !member.roles.cache.has(exam.required_role_id)) {
    const role = guild.roles.cache.get(exam.required_role_id);
    return {
      ok: false,
      key: 'eligibility.required_role',
      vars: { role: role ? `<@&${role.id}>` : exam.required_role_id },
    };
  }

  // 3. Already passed
  if (dao.hasPassed(member.id, exam.id)) {
    return { ok: false, key: 'eligibility.passed' };
  }

  // 4. Live attempt already exists → point to the channel
  const active = dao.activeAttemptFor(member.id, exam.id);
  if (active) {
    return {
      ok: false,
      key: 'eligibility.in_progress',
      vars: { channel: `<#${active.channel_id}>` },
    };
  }

  // 5. Attempts left (0 = unlimited)
  if (exam.max_attempts > 0) {
    const used = dao.finishedAttemptsCount(member.id, exam.id);
    if (used >= exam.max_attempts) {
      return { ok: false, key: 'eligibility.no_attempts', vars: { max: exam.max_attempts } };
    }
  }

  // 6. Cooldown
  if (exam.cooldown_hours > 0) {
    const last = dao.lastFinishedAttempt(member.id, exam.id);
    if (last && last.submitted_at) {
      const until = last.submitted_at + exam.cooldown_hours * 3600000;
      if (until > Date.now()) {
        return {
          ok: false,
          key: 'eligibility.cooldown',
          vars: { time: fmtDate(until) },
        };
      }
    }
  }

  return { ok: true };
}

module.exports = { checkEligibility };
