const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { requireStaff } = require('../../utils/perms');

module.exports = {
  builder: (sub) => sub.setName('list').setDescription(t('cmd.exam.list')),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;
    const exams = dao.listExams();
    if (!exams.length) {
      return void (await interaction.reply(embeds.errorPayload('builder.no_exams')));
    }
    const embed = embeds.dark(`📋 ${t('cmd.exam.list')}`);
    embed.setDescription(
      exams
        .map((e) => {
          const count = dao.countQuestions(e.id);
          return `${e.enabled ? '🟢' : '🔴'} **${e.name}** \`${e.id}\`\n${t('field.questions')}: **${count}** • ${t('field.pass_mark')}: **${e.pass_percent}%** • ${t('field.duration')}: **${e.duration_min ? e.duration_min + ' ' + t('field.minutes') : t('field.untimed')}**`;
        })
        .join('\n\n')
    );
    await interaction.reply({ embeds: [embed] });
  },
};
