const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AttachmentBuilder } = require('discord.js');
const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { requireStaff } = require('../../utils/perms');
const { fmtDate } = require('../../utils/time');
const state = require('../../state');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('results')
    .setDescription(t('cmd.results.desc'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('export')
        .setDescription(t('cmd.results.export'))
        .addStringOption((o) =>
          o.setName('exam').setDescription(t('cmd.results.exam_opt')).setAutocomplete(true)
        )
    ),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;
    if (interaction.options.getSubcommand() !== 'export') return;

    const examId = interaction.options.getString('exam');
    const exam = examId ? dao.getExam(examId) : null;
    if (examId && !exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rows = exam ? dao.attemptsForExam(exam.id) : dao.allAttempts();
    if (!rows.length) {
      return void (await interaction.editReply({ embeds: [embeds.error(t('error.title'), t('results.no_data'))] }));
    }

    // resolve usernames best-effort
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const names = {};
    await Promise.allSettled(
      userIds.map(async (id) => {
        try {
          const u = await state.client.users.fetch(id);
          names[id] = u.username;
        } catch {
          names[id] = id;
        }
      })
    );

    const header = [
      'المعرف',
      'المستخدم',
      'الامتحان',
      'المحاولة',
      'الحالة',
      'انتهى الوقت',
      'درجة تلقائية',
      'درجة يدوية',
      'الدرجة الكلية',
      'النهاية العظمى',
      'النسبة',
      'النتيجة',
      'وقت البدء',
      'وقت التسليم',
    ].join(',');
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((a) => {
      const total = a.auto_score + a.manual_score;
      const percent = a.max_score ? Math.round((total / a.max_score) * 100) : 0;
      return [
        a.id,
        esc(names[a.user_id] || a.user_id),
        esc(a.exam_name || (exam ? exam.name : '')),
        a.attempt_number,
        t(`status.${a.status}`),
        a.expired ? 'نعم' : 'لا',
        a.auto_score ?? 0,
        a.manual_score ?? 0,
        total,
        a.max_score ?? 0,
        `${percent}%`,
        a.status === 'graded' ? (a.passed ? 'ناجح' : 'راسب') : '—',
        a.started_at ? fmtDate(a.started_at) : '—',
        a.submitted_at ? fmtDate(a.submitted_at) : '—',
      ].join(',');
    });

    const csv = '\uFEFF' + [header, ...lines].join('\n');
    const date = new Date().toISOString().slice(0, 10);
    const file = new AttachmentBuilder(Buffer.from(csv, 'utf8'), { name: `results-${date}.csv` });

    await interaction.editReply({
      embeds: [embeds.success(t('results.exported_title'), t('results.exported_desc', { count: rows.length }))],
      files: [file],
    });
  },
  async autocomplete(interaction) {
    const { examAutocomplete } = require('../../utils/autocomplete');
    return examAutocomplete(interaction);
  },
};
