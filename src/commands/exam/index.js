const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { t } = require('../../utils/strings');
const { examAutocomplete } = require('../../utils/autocomplete');

const subs = {
  create: require('./create'),
  edit: require('./edit'),
  delete: require('./delete'),
  list: require('./list'),
  toggle: require('./toggle'),
  duplicate: require('./duplicate'),
};

const data = new SlashCommandBuilder()
  .setName('exam')
  .setDescription(t('cmd.exam.desc'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

for (const mod of Object.values(subs)) data.addSubcommand(mod.builder);

module.exports = {
  data,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const mod = subs[sub];
    if (mod) await mod.execute(interaction);
  },
  async autocomplete(interaction) {
    const sub = interaction.options.getSubcommand(true);
    if (['edit', 'delete', 'toggle', 'duplicate'].includes(sub)) {
      return examAutocomplete(interaction);
    }
  },
};
