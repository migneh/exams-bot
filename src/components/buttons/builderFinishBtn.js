const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { t } = require('../../utils/strings');
const { isStaff } = require('../../utils/perms');
const { sendLog } = require('../../utils/audit');

function truncate(s, n = 50) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

module.exports = {
  id: 'builder:finish',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    const count = dao.countQuestions(exam.id);
    if (count === 0) {
      return void (await interaction.reply(embeds.errorPayload('builder.warn_no_questions_finish')));
    }

    const warnings = [];
    let invalid = false;
    for (const q of dao.listQuestions(exam.id)) {
      if (['mcq_single', 'mcq_multi', 'true_false'].includes(q.type)) {
        const choices = dao.listChoices(q.id);
        const correct = choices.filter((c) => c.is_correct).length;
        if (choices.length < 2) {
          invalid = true;
          warnings.push(`⚠️ ${t('builder.warn_min_choices')} — ${truncate(q.text)}`);
        }
        if (correct === 0) {
          invalid = true;
          warnings.push(`⚠️ ${t('builder.warn_no_correct')} — ${truncate(q.text)}`);
        }
        if (q.type === 'mcq_single' && correct !== 1) {
          invalid = true;
          warnings.push(`⚠️ ${t('builder.warn_multi_correct')} — ${truncate(q.text)}`);
        }
      }
    }

    if (invalid) {
      return void (await interaction.reply({
        embeds: [embeds.error(t('error.title'), `${t('builder.home_desc')}\n\n${warnings.join('\n')}`)],
      }));
    }

    dao.updateExam(exam.id, { enabled: 1 });
    const embed = embeds.success(
      t('builder.finished_title'),
      warnings.length
        ? `${t('builder.finished_desc')}\n\n${warnings.join('\n')}`
        : t('builder.finished_desc')
    );
    await interaction.update({ embeds: [embed], components: [] });

    await sendLog(
      interaction.guild,
      embeds.success(
        t('log.exam_saved', { name: exam.name }),
        `<@${interaction.user.id}> • ${count} ${t('field.questions')}`
      )
    );
  },
};
