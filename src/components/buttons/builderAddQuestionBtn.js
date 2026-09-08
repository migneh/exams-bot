const builder = require('../../systems/builder');
const { isStaff } = require('../../utils/perms');
const embeds = require('../../utils/embeds');

module.exports = {
  id: 'builder:addq',
  async execute(interaction, examId) {
    if (!isStaff(interaction)) return void (await interaction.reply(embeds.errorPayload('error.not_staff')));
    await interaction.update(builder.typeSelect(examId));
  },
};
