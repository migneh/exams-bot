const { MessageFlags } = require('discord.js');
const { t } = require('../../utils/strings');
const { requireStaff } = require('../../utils/perms');
const { makeBasicsModal } = require('../../systems/builder');

module.exports = {
  builder: (sub) =>
    sub
      .setName('create')
      .setDescription(t('cmd.exam.create')),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;
    await interaction.showModal(makeBasicsModal('exam:basicsm'));
  },
};
