const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { requireStaff } = require('../../utils/perms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription(t('cmd.stats.desc'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption((o) =>
      o.setName('exam').setDescription(t('cmd.results.exam_opt')).setAutocomplete(true)
    ),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;
    const examId = interaction.options.getString('exam');
    const exam = examId ? dao.getExam(examId) : null;
    if (examId && !exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));

    const stats = dao.examStats(exam ? exam.id : null);
    const examsCount = dao.listExams().length;
    const passRate =
      stats.graded && stats.graded > 0 ? Math.round((stats.passed / stats.graded) * 100) : null;

    const embed = embeds.dark(`📈 ${t('stats.title', { name: exam ? exam.name : t('stats.all') })}`);
    embed.addFields(
      { name: `📝 ${t('stats.total')}`, value: `**${stats.total || 0}**`, inline: true },
      { name: `✍️ ${t('stats.in_progress')}`, value: `**${stats.in_progress || 0}**`, inline: true },
      { name: `🏁 ${t('stats.graded')}`, value: `**${stats.graded || 0}**`, inline: true },
      { name: `✅ ${t('stats.passed')}`, value: `**${stats.passed || 0}**`, inline: true },
      { name: `📊 ${t('stats.pass_rate')}`, value: passRate === null ? '—' : `**${passRate}%**`, inline: true },
      {
        name: `📉 ${t('stats.avg_score')}`,
        value: stats.avg_percent === null ? '—' : `**${stats.avg_percent}%**`,
        inline: true,
      }
    );
    if (!exam) embed.addFields({ name: `📚 ${t('stats.exams')}`, value: `**${examsCount}**`, inline: true });

    const hardest = dao.hardestQuestions(exam ? exam.id : null, 5);
    if (hardest.length) {
      embed.addFields({
        name: `🔥 ${t('stats.hardest')}`,
        value: hardest
          .map((q) => {
            const rate = Math.round((q.correct / q.answered) * 100);
            const name = exam ? '' : `**${q.exam_name}** — `;
            return `${name}${String(q.text).slice(0, 60)}\n> ${q.correct}/${q.answered} ${t('stats.correct_rate')} (${rate}%)`;
          })
          .join('\n'),
      });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
  async autocomplete(interaction) {
    const { examAutocomplete } = require('../../utils/autocomplete');
    return examAutocomplete(interaction);
  },
};
