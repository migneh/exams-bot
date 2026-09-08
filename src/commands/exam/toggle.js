const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { requireStaff } = require('../../utils/perms');
const { sendLog } = require('../../utils/audit');
const { resolveExamSettings } = require('../../utils/examSettings');

module.exports = {
  builder: (sub) =>
    sub
      .setName('toggle')
      .setDescription(t('cmd.exam.toggle'))
      .addStringOption((o) =>
        o.setName('exam').setDescription(t('cmd.exam_option')).setRequired(true).setAutocomplete(true)
      ),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;
    const exam = dao.getExam(interaction.options.getString('exam'));
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    const enabled = exam.enabled ? 0 : 1;
    dao.updateExam(exam.id, { enabled });
    const embed = enabled
      ? embeds.success(t('builder.toggled_on_title', { name: exam.name }), t('builder.toggled_on_desc'))
      : embeds.warn(t('builder.toggled_off_title', { name: exam.name }), t('builder.toggled_off_desc'));
    await interaction.reply({ embeds: [embed] });
    await sendLog(
      interaction.guild,
      embeds.info(
        t('log.exam_toggled', { name: exam.name, state: enabled ? t('common.enabled') : t('common.disabled') }),
        `<@${interaction.user.id}>`
      ),
      resolveExamSettings(exam, dao.getSettings(interaction.guildId) || {}).log_channel_id
    );
  },
};
