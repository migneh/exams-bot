const { MessageFlags } = require('discord.js');
const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const builder = require('../../systems/builder');
const embeds = require('../../utils/embeds');
const { requireStaff } = require('../../utils/perms');

module.exports = {
  builder: (sub) =>
    sub
      .setName('edit')
      .setDescription(t('cmd.exam.edit'))
      .addStringOption((o) =>
        o.setName('exam').setDescription(t('cmd.exam_option')).setRequired(true).setAutocomplete(true)
      ),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;
    const examId = interaction.options.getString('exam');
    const exam = dao.getExam(examId);
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    await interaction.reply({ ...builder.home(exam.id), flags: MessageFlags.Ephemeral });
  },
};
