const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { fmtDate } = require('../../utils/time');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription(t('cmd.leaderboard.desc'))
    .setDMPermission(false)
    .addStringOption((o) =>
      o.setName('exam').setDescription(t('cmd.exam_option')).setRequired(true).setAutocomplete(true)
    ),
  async execute(interaction) {
    const exam = dao.getExam(interaction.options.getString('exam'));
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));

    const attempts = dao.leaderboard(exam.id);
    // best attempt per user
    const best = new Map();
    for (const a of attempts) {
      const total = a.auto_score + a.manual_score;
      const percent = a.max_score ? Math.round((total / a.max_score) * 100) : 0;
      const prev = best.get(a.user_id);
      if (!prev || percent > prev.percent) {
        best.set(a.user_id, { percent, total, max: a.max_score, date: a.submitted_at || a.started_at });
      }
    }
    const rows = [...best.entries()].sort((a, b) => b[1].percent - a[1].percent).slice(0, 10);

    const embed = embeds.brand(
      new (require('discord.js').EmbedBuilder)().setTitle(`🏆 ${t('leaderboard.title', { name: exam.name })}`),
      embeds.colors.SUCCESS
    );
    embed.setDescription(
      rows.length
        ? rows
            .map(([userId, r], i) => {
              const medal = MEDALS[i] || `**${i + 1}.**`;
              return `${medal} <@${userId}> — **${r.percent}%** (${r.total}/${r.max}) • ${fmtDate(r.date)}`;
            })
            .join('\n')
        : t('leaderboard.empty')
    );
    await interaction.reply({ embeds: [embed] });
  },
  async autocomplete(interaction) {
    const { examAutocomplete } = require('../../utils/autocomplete');
    return examAutocomplete(interaction);
  },
};
