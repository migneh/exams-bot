const logger = require('../utils/logger');

/**
 * Schema bootstrap plus additive migrations. CREATE TABLE IF NOT EXISTS alone
 * does not add columns to an existing database, so the small ALTER TABLE block
 * below is intentionally kept idempotent as well.
 */
module.exports = function migrate(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      guild_id TEXT PRIMARY KEY,
      staff_role_id TEXT,
      review_channel_id TEXT,
      log_channel_id TEXT,
      exams_category_id TEXT
    );

    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      duration_min INTEGER,
      pass_percent INTEGER DEFAULT 60,
      max_attempts INTEGER DEFAULT 1,
      cooldown_hours INTEGER DEFAULT 24,
      required_role_id TEXT,
      reward_role_id TEXT,
      shuffle_questions INTEGER DEFAULT 1,
      shuffle_answers INTEGER DEFAULT 1,
      questions_per_attempt INTEGER,
      enabled INTEGER DEFAULT 1,
      created_by TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      image_url TEXT,
      points INTEGER DEFAULT 1,
      order_index INTEGER
    );

    CREATE TABLE IF NOT EXISTS choices (
      id TEXT PRIMARY KEY,
      question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      exam_id TEXT REFERENCES exams(id),
      user_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      review_msg_id TEXT,
      review_answer_msg_ids TEXT,
      status TEXT,
      attempt_number INTEGER,
      current_index INTEGER DEFAULT 0,
      question_order TEXT,
      choice_orders TEXT,
      auto_score INTEGER DEFAULT 0,
      manual_score INTEGER DEFAULT 0,
      max_score INTEGER,
      passed INTEGER,
      expired INTEGER DEFAULT 0,
      decided_by TEXT,
      started_at INTEGER,
      submitted_at INTEGER,
      deadline_at INTEGER,
      cleanup_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      attempt_id TEXT REFERENCES attempts(id) ON DELETE CASCADE,
      question_id TEXT,
      choice_ids TEXT,
      text_answer TEXT,
      auto_score INTEGER,
      manual_score INTEGER,
      feedback TEXT,
      shown_at INTEGER,
      answered_at INTEGER,
      graded_by TEXT
    );

    CREATE TABLE IF NOT EXISTS blacklist (
      user_id TEXT PRIMARY KEY,
      reason TEXT,
      added_by TEXT,
      added_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
    CREATE INDEX IF NOT EXISTS idx_choices_question ON choices(question_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_exam ON attempts(exam_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_answers_attempt ON answers(attempt_id);
  `);

  // Additive migrations for databases created before restart-proof deadlines
  // and persisted cleanup jobs were introduced.
  const attemptColumns = db.prepare('PRAGMA table_info(attempts)').all().map((row) => row.name);
  if (!attemptColumns.includes('deadline_at')) db.exec('ALTER TABLE attempts ADD COLUMN deadline_at INTEGER');
  if (!attemptColumns.includes('cleanup_at')) db.exec('ALTER TABLE attempts ADD COLUMN cleanup_at INTEGER');
  if (!attemptColumns.includes('review_answer_msg_ids')) db.exec('ALTER TABLE attempts ADD COLUMN review_answer_msg_ids TEXT');

  // Prevent the most common double-click/race condition. A legacy database
  // containing duplicate live attempts must be repaired before this index is
  // introduced; failing loudly is safer than silently weakening the invariant.
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_one_active ON attempts(user_id, exam_id) WHERE status IN ('pending','in_progress')"
  );

  logger.info('database ready (schema migrated)');
};
