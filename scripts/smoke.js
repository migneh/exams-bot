// Headless smoke test: exercises DB migrations, DAO, grader and utilities
// without connecting to Discord. Run with: npm run smoke
process.env.DATA_DIR = require('path').join(__dirname, '..', 'data-smoke');
process.env.DB_FILE = 'smoke.sqlite';

const fs = require('fs');
fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });

const assert = require('assert');
const dao = require('../src/database/dao');
const grader = require('../src/systems/grader');
const { progressBar, progressBarLine } = require('../src/utils/progressBar');
const { t } = require('../src/utils/strings');
const { fmtDurationAr } = require('../src/utils/time');
const builder = require('../src/systems/builder');
const engine = require('../src/systems/examEngine');

function step(name, fn) {
  fn();
  console.log(`  ✅ ${name}`);
}

console.log('🧪 smoke test — exams-bot core');

step('migrations + settings', () => {
  const s = dao.saveSettings('123', { staff_role_id: 'r1', review_channel_id: 'c1', log_channel_id: 'c2', exams_category_id: 'cat1' });
  assert.strictEqual(s.staff_role_id, 'r1');
  const again = dao.getSettings('123');
  assert.strictEqual(again.review_channel_id, 'c1');
});

step('exam create/update/duplicate', () => {
  const exam = dao.createExam({ name: 'امتحان الدعم', description: 'اختبار', duration_min: 15, pass_percent: 60, max_attempts: 2, cooldown_hours: 24, created_by: 'u1' });
  assert.ok(exam.id && exam.enabled === 1);
  dao.updateExam(exam.id, { pass_percent: 70, enabled: false });
  assert.strictEqual(dao.getExam(exam.id).pass_percent, 70);
  assert.strictEqual(dao.getExam(exam.id).enabled, 0);
  dao.updateExam(exam.id, { enabled: true });

  // questions
  const q1 = dao.addQuestion(exam.id, { type: 'mcq_single', text: 'سؤال 1', points: 2 });
  const cA = dao.addChoice(q1.id, 'خيار أ', 1);
  dao.addChoice(q1.id, 'خيار ب', 0);
  dao.addChoice(q1.id, 'خيار ج', 0);

  const q2 = dao.addQuestion(exam.id, { type: 'true_false', text: 'السماء زرقاء', points: 1 });
  const tf = dao.listChoices(q2.id); // auto-created by test below
  assert.strictEqual(tf.length, 0);
  const tRight = dao.addChoice(q2.id, t('common.true'), 1);
  dao.addChoice(q2.id, t('common.false'), 0);

  const q3 = dao.addQuestion(exam.id, { type: 'mcq_multi', text: 'اختر الحروف', points: 3 });
  const m1 = dao.addChoice(q3.id, 'أ', 1);
  const m2 = dao.addChoice(q3.id, 'ب', 1);
  const m3 = dao.addChoice(q3.id, 'ج', 0);

  const q4 = dao.addQuestion(exam.id, { type: 'short', text: 'اشرح باختصار', points: 4 });
  const q5 = dao.addQuestion(exam.id, { type: 'long', text: 'سيناريو', points: 5, image_url: 'https://example.com/i.png' });

  assert.strictEqual(dao.countQuestions(exam.id), 5);

  const dup = dao.duplicateExam(exam.id, 'u2');
  assert.strictEqual(dao.countQuestions(dup.id), 5);
  assert.strictEqual(dup.enabled, 0);
  assert.notStrictEqual(dup.name, exam.name);
  dao.deleteExam(dup.id);
  assert.strictEqual(dao.getExam(dup.id), null);
});

step('attempt + answers + auto grading', () => {
  const exam = dao.listExams().find((e) => e.name === 'امتحان الدعم');
  const questions = dao.listQuestions(exam.id);
  const q1 = questions.find((q) => q.type === 'mcq_single');
  const q2 = questions.find((q) => q.type === 'true_false');
  const q3 = questions.find((q) => q.type === 'mcq_multi');
  const q4 = questions.find((q) => q.type === 'short');

  const attempt = dao.createAttempt({ exam_id: exam.id, user_id: 'u9', channel_id: 'ch1', attempt_number: 1 });
  dao.updateAttempt(attempt.id, {
    status: 'in_progress',
    started_at: Date.now(),
    question_order: JSON.stringify(questions.map((q) => q.id)),
  });

  // answer q1 correctly (correct = first choice)
  const correct1 = dao.listChoices(q1.id).find((c) => c.is_correct);
  dao.saveChoiceAnswer(attempt.id, q1.id, [correct1.id]);
  // answer q2 WRONG (false instead of true)
  const wrong2 = dao.listChoices(q2.id).find((c) => !c.is_correct);
  dao.saveChoiceAnswer(attempt.id, q2.id, [wrong2.id]);
  // answer q3 PARTIALLY (only one of two correct) → all-or-nothing = 0
  const multiCorrect = dao.listChoices(q3.id).filter((c) => c.is_correct);
  dao.saveChoiceAnswer(attempt.id, q3.id, [multiCorrect[0].id]);
  // written answer q4
  dao.saveTextAnswer(attempt.id, q4.id, 'شرح موجز للإجابة');

  const fresh = dao.getAttempt(attempt.id);
  const graded = grader.gradeAuto(fresh);
  assert.strictEqual(graded.hasWritten, true);
  assert.strictEqual(graded.autoScore, 2, 'only q1 correct');
  assert.strictEqual(graded.maxScore, 15, '2+1+3+4+5');
  // The database enforces one live attempt per user/exam; finish this
  // partially reviewed attempt before creating the second fixture below.
  dao.updateAttempt(attempt.id, { status: 'graded', passed: 0, submitted_at: Date.now(), manual_score: 0 });

  // exact multi answer → full points
  const attempt2 = dao.createAttempt({ exam_id: exam.id, user_id: 'u9', channel_id: 'ch2', attempt_number: 2 });
  dao.updateAttempt(attempt2.id, { status: 'in_progress', started_at: Date.now(), question_order: JSON.stringify([q1.id, q2.id, q3.id]) });
  dao.saveChoiceAnswer(attempt2.id, q1.id, [correct1.id]);
  const right2 = dao.listChoices(q2.id).find((c) => c.is_correct);
  dao.saveChoiceAnswer(attempt2.id, q2.id, [right2.id]);
  dao.saveChoiceAnswer(attempt2.id, q3.id, multiCorrect.map((c) => c.id));
  const graded2 = grader.gradeAuto(dao.getAttempt(attempt2.id));
  assert.strictEqual(graded2.hasWritten, false);
  assert.strictEqual(graded2.autoScore, 6);

  // percent helper
  assert.strictEqual(grader.percentOf(6, 15), 40);
  assert.strictEqual(grader.percentOf(1, 0), 0);

  // review bookkeeping
  assert.strictEqual(dao.ungradedWrittenCount(attempt.id), 2); // q4 + q5
  const written = dao.writtenAnswers(attempt.id);
  const a4 = written.find((w) => w.question_id === q4.id);
  dao.setAnswerManual(a4.id, 3, 'جيد', 'staff1');
  assert.strictEqual(dao.ungradedWrittenCount(attempt.id), 1);
});

step('stats + hardest questions', () => {
  const exam = dao.listExams().find((e) => e.name === 'امتحان الدعم');
  const stats = dao.examStats(exam.id);
  assert.ok(typeof stats.total === 'number' && stats.total >= 2);
  const hardest = dao.hardestQuestions(exam.id, 5);
  assert.ok(Array.isArray(hardest) && hardest.length > 0);
  const top = hardest[0];
  assert.ok(top.answered >= top.correct);
});

step('eligibility helpers (blacklist/attempts counters)', () => {
  const exam = dao.listExams().find((e) => e.name === 'امتحان الدعم');
  assert.strictEqual(dao.finishedAttemptsCount('u9', exam.id), 1);
  dao.updateAttempt(dao.getAttemptByChannel('ch1') ? dao.getAttemptByChannel('ch1').id : '', {});
  // mark both attempts graded
  for (const a of dao.attemptsByUser('u9')) {
    if (['in_progress', 'reviewing'].includes(a.status)) {
      dao.updateAttempt(a.id, { status: 'graded', passed: 1, submitted_at: Date.now(), manual_score: 0 });
    }
  }
  assert.strictEqual(dao.hasPassed('u9', exam.id), true);
  assert.strictEqual(dao.finishedAttemptsCount('u9', exam.id), 2);
  assert.strictEqual(dao.nextAttemptNumber('u9', exam.id), 3);
  dao.addBlacklist('u9', 'اختبار', 'admin');
  assert.strictEqual(dao.isBlacklisted('u9'), true);
  dao.removeBlacklist('u9');
  assert.strictEqual(dao.isBlacklisted('u9'), false);

  dao.resetAttempts('u9', exam.id);
  assert.strictEqual(dao.finishedAttemptsCount('u9', exam.id), 0);
  assert.strictEqual(dao.hasPassed('u9', exam.id), false);
});

step('builder parsing (basics/advanced/roles/question)', () => {
  const basics = builder.parseBasics({ name: 'اختبار', description: '-', duration_min: '15', pass_percent: '60', combo: '2، 48' });
  assert.ok(basics.ok);
  assert.deepStrictEqual(basics.values, {
    name: 'اختبار',
    description: null,
    duration_min: 15,
    pass_percent: 60,
    max_attempts: 2,
    cooldown_hours: 48,
  });
  assert.ok(!builder.parseBasics({ name: '', duration_min: 'x', pass_percent: '60', combo: '1,1' }).ok);
  assert.ok(!builder.parseBasics({ name: 'x', duration_min: '15', pass_percent: '200', combo: '1,1' }).ok);

  const adv = builder.parseAdvanced({ questions_per_attempt: '10', shuffle_questions: 'نعم', shuffle_answers: 'لا' });
  assert.ok(adv.ok);
  assert.deepStrictEqual(adv.values, { questions_per_attempt: 10, shuffle_questions: true, shuffle_answers: false });
  assert.ok(!builder.parseAdvanced({ questions_per_attempt: '', shuffle_questions: 'ربما', shuffle_answers: 'نعم' }).ok);

  const q = builder.parseQuestion({ text: 'نص السؤال؟', points: '5', image_url: 'https://x.test/i.png' });
  assert.ok(q.ok && q.values.points === 5 && q.values.image_url === 'https://x.test/i.png');
  assert.ok(!builder.parseQuestion({ text: 'نص', points: '5', image_url: 'ftp://bad' }).ok);
  assert.ok(!builder.parseQuestion({ text: '', points: '5', image_url: '' }).ok);

  const badRole = builder.parseRoleInput(null, '123456789012345678');
  assert.strictEqual(badRole.ok, false);
});

step('locale + progress bar + time formatting', () => {
  assert.strictEqual(t('exam.start'), '🚀 بدء الامتحان');
  assert.strictEqual(t('exam.question_title', { current: 3, total: 10 }), 'السؤال 3 من 10');
  assert.ok(t('nonexistent.key') === 'nonexistent.key');
  assert.strictEqual(progressBar(3, 5, 5), '▰▰▰▱▱');
  assert.ok(progressBarLine(3, 5).includes('3/5'));
  assert.strictEqual(fmtDurationAr(330000), '5 د 30 ث');
  assert.strictEqual(fmtDurationAr(0), '0 ث');
  assert.strictEqual(engine.deadlineFor({ deadline_at: 123 }, { duration_min: 99 }), 123);
  assert.strictEqual(engine.isExpired({ deadline_at: 123 }, { duration_min: 99 }, 124), true);
});

console.log('\n✅ smoke test passed — core systems OK');
fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
