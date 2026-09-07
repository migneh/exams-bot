const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { makeConfirmModal } = require('../../systems/builder');
const { requireStaff } = require('../../utils/perms');

module.exports = {
  builder: (sub) =>
    sub
      .setName('delete')
      .setDescription(t('cmd.exam.delete'))
      .addStringOption((o) =>
        o.setName('exam').setDescription(t('cmd.exam_option')).setRequired(true).setAutocomplete(true)
      ),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;
    const exam = dao.getExam(interaction.options.getString('exam'));
    if (!exam) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
    await interaction.showModal(
      makeConfirmModal(`builder:deletem:${exam.id}`, 'builder.delete_confirm_title', t('common.confirm_word_delete'))
    );
  },
};
