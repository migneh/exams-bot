const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { requireStaff } = require('../../utils/perms');
const { sendLog } = require('../../utils/audit');

module.exports = {
  builder: (sub) =>
    sub
      .setName('duplicate')
      .setDescription(t('cmd.exam.duplicate'))
      .addStringOption((o) =>
        o.setName('exam').setDescription(t('cmd.exam_option')).setRequired(true).setAutocomplete(true)
      ),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;
    const exam = dao.getExam(interaction.options.getString('exam'));
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    const copy = dao.duplicateExam(exam.id, interaction.user.id);
    if (!copy) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    await interaction.reply({
      embeds: [
        embeds.success(
          t('builder.duplicated_title', { name: copy.name }),
          `${t('builder.duplicated_desc')}\n\`${copy.id}\``
        ),
      ],
    });
    await sendLog(
      interaction.guild,
      embeds.info(
        t('log.exam_duplicated', { from: exam.name, to: copy.name }),
        `<@${interaction.user.id}>`
      )
    );
  },
};
