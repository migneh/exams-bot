const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const dao = require('../database/dao');
const { t } = require('./strings');
const embeds = require('./embeds');

/** Is this member staff? (configured staff role OR Manage Server permission) */
function isStaff(interaction) {
  if (!interaction.inGuild()) return false;
  const settings = dao.getSettings(interaction.guildId);
  const member = interaction.member;
  if (settings && settings.staff_role_id && member.roles && member.roles.cache) {
    if (member.roles.cache.has(settings.staff_role_id)) return true;
  }
  return member.permissions
    ? member.permissions.has(PermissionFlagsBits.ManageGuild)
    : false;
}

/** Guard helper: replies with an ephemeral error and returns false when not staff. */
async function requireStaff(interaction) {
  if (isStaff(interaction)) return true;
  const payload = {
    embeds: [embeds.error(t('error.title'), t('error.not_staff'))],
    flags: MessageFlags.Ephemeral,
  };
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
  return false;
}

module.exports = { isStaff, requireStaff };
