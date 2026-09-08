// Data-access layer — every DB query in the app lives here.
const { nanoid } = require('nanoid');
const db = require('./index');

const newId = () => nanoid(12);

/** SQLite rejects booleans — coerce to 0/1 and drop undefined keys. */
function clean(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = typeof v === 'boolean' ? (v ? 1 : 0) : v;
  }
  return out;
}

function buildUpdate(table, id, patch) {
  const safe = clean(patch);
  const keys = Object.keys(safe);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE ${table} SET ${set} WHERE id = @__id`).run({ ...safe, __id: id });
}

/* ------------------------------- settings ------------------------------- */

const getSettings = (guildId) =>
  db.prepare('SELECT * FROM settings WHERE guild_id = ?').get(guildId) || null;

function saveSettings(guildId, patch) {
  const safe = clean(patch);
  const keys = Object.keys(safe);
  if (!keys.length) return getSettings(guildId);
  const existing = getSettings(guildId);
  if (!existing) {
    db.prepare('INSERT INTO settings (guild_id) VALUES (?)').run(guildId);
  }
  const set = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE settings SET ${set} WHERE guild_id = @g`).run({ ...safe, g: guildId });
  return getSettings(guildId);
}

/* -------------------------------- exams --------------------------------- */

const getExam = (id) => db.prepare('SELECT * FROM exams WHERE id = ?').get(id) || null;
const listExams = () => db.prepare('SELECT * FROM exams ORDER BY created_at DESC').all();
const listOpenExams = () =>
  db
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count
       FROM exams e WHERE e.enabled = 1 ORDER BY e.created_at DESC`
    )
    .all()
    .filter((e) => e.question_count > 0);

function createExam(fields) {
  const exam = {
    id: newId(),
    name: fields.name,
    description: fields.description || null,
    duration_min: fields.duration_min ?? 0,
    pass_percent: fields.pass_percent ?? 60,
    max_attempts: fields.max_attempts ?? 1,
    cooldown_hours: fields.cooldown_hours ?? 24,
    required_role_id: fields.required_role_id || null,
    reward_role_id: fields.reward_role_id || null,
    shuffle_questions: fields.shuffle_questions === false ? 0 : 1,
    shuffle_answers: fields.shuffle_answers === false ? 0 : 1,
    questions_per_attempt: fields.questions_per_attempt || null,
    enabled: fields.enabled === 0 || fields.enabled === false ? 0 : 1,
    created_by: fields.created_by || null,
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO exams (id, name, description, duration_min, pass_percent, max_attempts,
      cooldown_hours, required_role_id, reward_role_id, shuffle_questions, shuffle_answers,
      questions_per_attempt, enabled, created_by, created_at)
     VALUES (@id, @name, @description, @duration_min, @pass_percent, @max_attempts,
      @cooldown_hours, @required_role_id, @reward_role_id, @shuffle_questions, @shuffle_answers,
      @questions_per_attempt, @enabled, @created_by, @created_at)`
  ).run(clean(exam));
  return getExam(exam.id);
}

const updateExam = (id, patch) => buildUpdate('exams', id, patch);

function deleteExam(id) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE exam_id = ?)').run(id);
    db.prepare('DELETE FROM attempts WHERE exam_id = ?').run(id);
    db.prepare('DELETE FROM exams WHERE id = ?').run(id);
  });
  tx();
}

function deleteAttempt(id) {
  db.prepare('DELETE FROM answers WHERE attempt_id = ?').run(id);
  db.prepare('DELETE FROM attempts WHERE id = ?').run(id);
}

function duplicateExam(id, createdBy) {
  const exam = getExam(id);
  if (!exam) return null;
  const copy = createExam({
    ...exam,
    name: `${exam.name} (نسخة)`,
    enabled: 0,
    created_by: createdBy || exam.created_by,
  });
  const questions = listQuestions(exam.id);
  for (const q of questions) {
    const nq = addQuestion(copy.id, { type: q.type, text: q.text, image_url: q.image_url, points: q.points });
    for (const c of listChoices(q.id)) {
      addChoice(nq.id, c.text, c.is_correct);
    }
  }
  return getExam(copy.id);
}

/* ------------------------------- questions ------------------------------ */

const getQuestion = (id) => db.prepare('SELECT * FROM questions WHERE id = ?').get(id) || null;
const listQuestions = (examId) =>
  db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index').all(examId);
const countQuestions = (examId) =>
  db.prepare('SELECT COUNT(*) AS c FROM questions WHERE exam_id = ?').get(examId).c;

function addQuestion(examId, { type, text, image_url, points }) {
  const q = {
    id: newId(),
    exam_id: examId,
    type,
    text,
    image_url: image_url || null,
    points: Math.max(1, Math.min(100, parseInt(points, 10) || 1)),
    order_index: countQuestions(examId),
  };
  db.prepare(
    `INSERT INTO questions (id, exam_id, type, text, image_url, points, order_index)
     VALUES (@id, @exam_id, @type, @text, @image_url, @points, @order_index)`
  ).run(q);
  return getQuestion(q.id);
}

const updateQuestion = (id, patch) => buildUpdate('questions', id, patch);

function deleteQuestion(id) {
  db.prepare('DELETE FROM choices WHERE question_id = ?').run(id);
  db.prepare('DELETE FROM questions WHERE id = ?').run(id);
}

/* -------------------------------- choices ------------------------------- */

const getChoice = (id) => db.prepare('SELECT * FROM choices WHERE id = ?').get(id) || null;
const listChoices = (questionId) =>
  db.prepare('SELECT * FROM choices WHERE question_id = ? ORDER BY rowid').all(questionId);

function addChoice(questionId, text, isCorrect = 0) {
  const c = { id: newId(), question_id: questionId, text, is_correct: isCorrect ? 1 : 0 };
  db.prepare('INSERT INTO choices (id, question_id, text, is_correct) VALUES (@id, @question_id, @text, @is_correct)').run(c);
  return c;
}

function deleteChoice(id) {
  db.prepare('DELETE FROM choices WHERE id = ?').run(id);
}

/** Set the correct choice(s) for a question (replaces previous marks). */
function setCorrectChoices(questionId, choiceIds) {
  const set = new Set(choiceIds);
  const tx = db.transaction(() => {
    for (const c of listChoices(questionId)) {
      db.prepare('UPDATE choices SET is_correct = ? WHERE id = ?').run(set.has(c.id) ? 1 : 0, c.id);
    }
  });
  tx();
}

/* ------------------------------- attempts ------------------------------- */

const getAttempt = (id) => db.prepare('SELECT * FROM attempts WHERE id = ?').get(id) || null;
const getAttemptByChannel = (channelId) =>
  db.prepare("SELECT * FROM attempts WHERE channel_id = ? AND status IN ('pending','in_progress') ORDER BY started_at DESC").get(channelId) || null;

function createAttempt({ exam_id, user_id, channel_id, attempt_number }) {
  const a = {
    id: newId(),
    exam_id,
    user_id,
    channel_id,
    message_id: null,
    review_msg_id: null,
    review_answer_msg_ids: null,
    status: 'pending',
    attempt_number,
    current_index: 0,
    question_order: null,
    choice_orders: null,
    auto_score: 0,
    manual_score: 0,
    max_score: 0,
    passed: null,
    expired: 0,
    decided_by: null,
    started_at: null,
    submitted_at: null,
    deadline_at: null,
    cleanup_at: null,
  };
  db.prepare(
    `INSERT INTO attempts (id, exam_id, user_id, channel_id, message_id, review_msg_id, review_answer_msg_ids, status,
      attempt_number, current_index, question_order, choice_orders, auto_score, manual_score,
      max_score, passed, expired, decided_by, started_at, submitted_at, deadline_at, cleanup_at)
     VALUES (@id, @exam_id, @user_id, @channel_id, @message_id, @review_msg_id, @review_answer_msg_ids, @status,
      @attempt_number, @current_index, @question_order, @choice_orders, @auto_score, @manual_score,
      @max_score, @passed, @expired, @decided_by, @started_at, @submitted_at, @deadline_at, @cleanup_at)`
  ).run(a);
  return getAttempt(a.id);
}

const updateAttempt = (id, patch) => buildUpdate('attempts', id, patch);

const listInProgress = () =>
  db.prepare("SELECT * FROM attempts WHERE status = 'in_progress'").all();

const listPendingCleanup = () =>
  db
    .prepare("SELECT * FROM attempts WHERE cleanup_at IS NOT NULL AND status IN ('cancelled','retake','graded')")
    .all();

const listReviewQueuePending = () =>
  db
    .prepare("SELECT * FROM attempts WHERE status = 'review_failed' OR (status = 'reviewing' AND review_msg_id IS NULL)")
    .all();

const activeAttemptsByUser = (userId, examId = null) =>
  db
    .prepare(
      `SELECT * FROM attempts
       WHERE user_id = ? AND status IN ('pending','in_progress')
       ${examId ? 'AND exam_id = ?' : ''}
       ORDER BY rowid DESC`
    )
    .all(...(examId ? [userId, examId] : [userId]));

const activeAttemptFor = (userId, examId, excludeId = null) =>
  db
    .prepare(
      `SELECT * FROM attempts
       WHERE user_id = ? AND exam_id = ? AND status IN ('pending','in_progress','review_failed')
       ${excludeId ? 'AND id != ?' : ''}
       ORDER BY rowid DESC`
    )
    .get(...(excludeId ? [userId, examId, excludeId] : [userId, examId])) || null;

const hasPassed = (userId, examId) =>
  !!db
    .prepare("SELECT id FROM attempts WHERE user_id = ? AND exam_id = ? AND status = 'graded' AND passed = 1")
    .get(userId, examId);

const finishedAttemptsCount = (userId, examId) =>
  db
    .prepare("SELECT COUNT(*) AS c FROM attempts WHERE user_id = ? AND exam_id = ? AND status IN ('reviewing','review_failed','graded')")
    .get(userId, examId).c;

const lastFinishedAttempt = (userId, examId) =>
  db
    .prepare(
      "SELECT * FROM attempts WHERE user_id = ? AND exam_id = ? AND status IN ('reviewing','review_failed','graded') AND submitted_at IS NOT NULL ORDER BY submitted_at DESC"
    )
    .get(userId, examId) || null;

const nextAttemptNumber = (userId, examId) =>
  db
    .prepare("SELECT COUNT(*) AS c FROM attempts WHERE user_id = ? AND exam_id = ? AND status != 'pending'")
    .get(userId, examId).c + 1;

const attemptsByUser = (userId) =>
  db
    .prepare(
      `SELECT a.*, e.name AS exam_name, e.pass_percent FROM attempts a
       JOIN exams e ON e.id = a.exam_id WHERE a.user_id = ? ORDER BY a.started_at DESC LIMIT 25`
    )
    .all(userId);

const attemptsForExam = (examId) =>
  db.prepare('SELECT * FROM attempts WHERE exam_id = ? ORDER BY started_at DESC').all(examId);

const allAttempts = () =>
  db
    .prepare(
      `SELECT a.*, e.name AS exam_name FROM attempts a JOIN exams e ON e.id = a.exam_id
       ORDER BY a.started_at DESC`
    )
    .all();

const leaderboard = (examId) =>
  db
    .prepare(
      `SELECT * FROM attempts WHERE exam_id = ? AND status = 'graded' AND passed = 1 ORDER BY started_at DESC`
    )
    .all(examId);

/* -------------------------------- answers ------------------------------- */

const getAnswerById = (id) => db.prepare('SELECT * FROM answers WHERE id = ?').get(id) || null;
const getAnswer = (attemptId, questionId) =>
  db.prepare('SELECT * FROM answers WHERE attempt_id = ? AND question_id = ?').get(attemptId, questionId) || null;
const listAnswers = (attemptId) =>
  db.prepare('SELECT * FROM answers WHERE attempt_id = ?').all(attemptId);

function ensureAnswer(attemptId, questionId) {
  let row = getAnswer(attemptId, questionId);
  if (!row) {
    db.prepare(
      'INSERT INTO answers (id, attempt_id, question_id, shown_at) VALUES (?, ?, ?, ?)'
    ).run(newId(), attemptId, questionId, Date.now());
    row = getAnswer(attemptId, questionId);
  }
  return row;
}

function markShown(attemptId, questionId) {
  const row = getAnswer(attemptId, questionId);
  if (!row) {
    db.prepare('INSERT INTO answers (id, attempt_id, question_id, shown_at) VALUES (?, ?, ?, ?)').run(
      newId(),
      attemptId,
      questionId,
      Date.now()
    );
  }
}

function saveChoiceAnswer(attemptId, questionId, choiceIds, answeredAt = Date.now()) {
  const row = ensureAnswer(attemptId, questionId);
  db.prepare('UPDATE answers SET choice_ids = ?, answered_at = ? WHERE id = ?').run(
    JSON.stringify([...choiceIds].sort()),
    answeredAt,
    row.id
  );
}

function saveTextAnswer(attemptId, questionId, text, answeredAt = Date.now()) {
  const row = ensureAnswer(attemptId, questionId);
  db.prepare('UPDATE answers SET text_answer = ?, answered_at = ? WHERE id = ?').run(
    text,
    answeredAt,
    row.id
  );
}

function setAnswerAuto(id, score) {
  db.prepare('UPDATE answers SET auto_score = ? WHERE id = ?').run(score, id);
}

function setAnswerManual(id, score, feedback, gradedBy) {
  db.prepare('UPDATE answers SET manual_score = ?, feedback = ?, graded_by = ? WHERE id = ?').run(
    score,
    feedback || null,
    gradedBy || null,
    id
  );
}

const ungradedWrittenCount = (attemptId) =>
  db
    .prepare(
      `SELECT COUNT(*) AS c FROM answers a JOIN questions q ON q.id = a.question_id
       WHERE a.attempt_id = ? AND q.type IN ('short','long') AND a.manual_score IS NULL`
    )
    .get(attemptId).c;

const writtenAnswers = (attemptId) =>
  db
    .prepare(
      `SELECT a.*, q.text AS question_text, q.points AS question_points, q.type AS question_type,
              q.image_url AS question_image
       FROM answers a JOIN questions q ON q.id = a.question_id
       WHERE a.attempt_id = ? AND q.type IN ('short','long')`
    )
    .all(attemptId);

/* ------------------------------- blacklist ------------------------------ */

const isBlacklisted = (userId) =>
  !!db.prepare('SELECT user_id FROM blacklist WHERE user_id = ?').get(userId);

function addBlacklist(userId, reason, addedBy) {
  db.prepare(
    `INSERT INTO blacklist (user_id, reason, added_by, added_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET reason = excluded.reason, added_by = excluded.added_by, added_at = excluded.added_at`
  ).run(userId, reason || null, addedBy || null, Date.now());
}

function removeBlacklist(userId) {
  db.prepare('DELETE FROM blacklist WHERE user_id = ?').run(userId);
}

const listBlacklist = () =>
  db.prepare('SELECT * FROM blacklist ORDER BY added_at DESC').all();

/* --------------------------------- stats -------------------------------- */

function examStats(examId) {
  const where = examId ? 'WHERE exam_id = ?' : '';
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status IN ('reviewing','review_failed','graded') THEN 1 ELSE 0 END) AS finished,
              SUM(CASE WHEN status = 'graded' THEN 1 ELSE 0 END) AS graded,
              SUM(CASE WHEN status = 'graded' AND passed = 1 THEN 1 ELSE 0 END) AS passed,
              SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress
       FROM attempts ${where}`
    )
    .get(...(examId ? [examId] : []));
  const avg = db
    .prepare(
      `SELECT AVG(CAST(auto_score + manual_score AS REAL) / NULLIF(max_score, 0)) AS avg
       FROM attempts WHERE status = 'graded' ${examId ? 'AND exam_id = ?' : ''}`
    )
    .get(...(examId ? [examId] : []));
  return {
    ...row,
    avg_percent: avg && avg.avg != null ? Math.round(avg.avg * 100) : null,
  };
}

/** Hardest objective questions (lowest correct rate). */
function hardestQuestions(examId, limit = 5) {
  return db
    .prepare(
      `SELECT q.id, q.text, q.type, e.name AS exam_name,
              COUNT(a.id) AS answered,
              SUM(CASE WHEN a.auto_score > 0 THEN 1 ELSE 0 END) AS correct
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       JOIN exams e ON e.id = q.exam_id
       WHERE a.auto_score IS NOT NULL AND q.type NOT IN ('short','long')
         ${examId ? 'AND q.exam_id = ?' : ''}
       GROUP BY q.id
       HAVING answered > 0
       ORDER BY (CAST(correct AS REAL) / answered) ASC
       LIMIT ?`
    )
    .all(...(examId ? [examId, limit] : [limit]));
}

function resetAttempts(userId, examId) {
  // Return live rows before changing their status so callers can clean up the
  // associated channels and in-memory timers as well.
  const live = activeAttemptsByUser(userId, examId);
  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE attempts SET status = 'cancelled', cleanup_at = ? WHERE user_id = ? AND exam_id = ? AND status IN ('pending','in_progress')"
    ).run(Date.now() + 5000, userId, examId);
    db.prepare(
      "DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE user_id = ? AND exam_id = ? AND status IN ('reviewing','review_failed','graded','retake'))"
    ).run(userId, examId);
    db.prepare(
      "DELETE FROM attempts WHERE user_id = ? AND exam_id = ? AND status IN ('reviewing','review_failed','graded','retake')"
    ).run(userId, examId);
  });
  tx();
  return live;
}

module.exports = {
  newId,
  getSettings,
  saveSettings,
  getExam,
  listExams,
  listOpenExams,
  createExam,
  updateExam,
  deleteExam,
  deleteAttempt,
  duplicateExam,
  getQuestion,
  listQuestions,
  countQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  getChoice,
  listChoices,
  addChoice,
  deleteChoice,
  setCorrectChoices,
  getAttempt,
  getAttemptByChannel,
  createAttempt,
  updateAttempt,
  listInProgress,
  listPendingCleanup,
  listReviewQueuePending,
  activeAttemptsByUser,
  activeAttemptFor,
  hasPassed,
  finishedAttemptsCount,
  lastFinishedAttempt,
  nextAttemptNumber,
  attemptsByUser,
  attemptsForExam,
  allAttempts,
  leaderboard,
  getAnswerById,
  getAnswer,
  listAnswers,
  ensureAnswer,
  markShown,
  saveChoiceAnswer,
  saveTextAnswer,
  setAnswerAuto,
  setAnswerManual,
  ungradedWrittenCount,
  writtenAnswers,
  isBlacklisted,
  addBlacklist,
  removeBlacklist,
  listBlacklist,
  examStats,
  hardestQuestions,
  resetAttempts,
};
