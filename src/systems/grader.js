const dao = require('../database/dao');

/**
 * Auto-grade all objective answers of an attempt (mcq_single, mcq_multi,
 * true_false are stored as choices). Multi-select is all-or-nothing.
 * Returns { hasWritten, autoScore, maxScore }.
 */
function gradeAuto(attempt) {
  const order = attempt.question_order ? JSON.parse(attempt.question_order) : [];
  const questions = order
    .map((qid) => dao.getQuestion(qid))
    .filter(Boolean);
  const answers = {};
  for (const a of dao.listAnswers(attempt.id)) answers[a.question_id] = a;

  let autoScore = 0;
  let maxScore = 0;
  let hasWritten = false;

  for (const q of questions) {
    maxScore += q.points;
    if (q.type === 'short' || q.type === 'long') {
      hasWritten = true;
      // ensure a row exists so the review queue shows unanswered questions too
      dao.ensureAnswer(attempt.id, q.id);
      continue;
    }
    const ans = answers[q.id];
    let score = 0;
    if (ans && ans.choice_ids) {
      let chosen = [];
      try {
        chosen = JSON.parse(ans.choice_ids) || [];
      } catch {
        chosen = [];
      }
      const correct = dao
        .listChoices(q.id)
        .filter((c) => c.is_correct)
        .map((c) => c.id)
        .sort();
      const chosenSorted = [...chosen].sort();
      const exact =
        chosenSorted.length === correct.length &&
        chosenSorted.every((v, i) => v === correct[i]);
      if (exact && correct.length > 0) score = q.points;
    }
    const row = ans || dao.ensureAnswer(attempt.id, q.id);
    dao.setAnswerAuto(row.id, score);
    autoScore += score;
  }

  dao.updateAttempt(attempt.id, { auto_score: autoScore, max_score: maxScore });
  return { hasWritten, autoScore, maxScore };
}

/** Percent helper (0 when max is 0 to avoid division by zero). */
function percentOf(total, max) {
  if (!max) return 0;
  return Math.round((total / max) * 100);
}

module.exports = { gradeAuto, percentOf };
