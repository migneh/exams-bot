const { MessageFlags } = require('discord.js');
const builder = require('../../systems/builder');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { t } = require('../../utils/strings');
const { sendLog } = require('../../utils/audit');

/** /exam create → exam basics → creates the exam and opens the builder. */
module.exports = {
  id: 'exam:basicsm',
  async execute(interaction) {
    const parsed = builder.parseBasics({
      name: interaction.fields.getTextInputValue('name'),
      description: interaction.fields.getTextInputValue('description'),
      duration_min: interaction.fields.getTextInputValue('duration_min'),
      pass_percent: interaction.fields.getTextInputValue('pass_percent'),
      combo: interaction.fields.getTextInputValue('combo'),
    });
    if (!parsed.ok) {
      return void (await interaction.reply(embeds.errorPayload(parsed.key)));
    }
    const exam = dao.createExam({ ...parsed.values, created_by: interaction.user.id });
    await interaction.reply({ ...builder.home(exam.id), flags: MessageFlags.Ephemeral });
    await sendLog(
      interaction.guild,
      embeds.info(t('log.exam_created', { name: exam.name }), `<@${interaction.user.id}>`)
    );
  },
};
