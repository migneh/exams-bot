const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const dao = require('../database/dao');
const { t } = require('./strings');
const embeds = require('./embeds');

/** Is this member staff? (exam role override, global role, or Manage Server permission) */
function isStaff(interaction, examId = null) {
  if (!interaction.inGuild()) return false;
  const globalSettings = dao.getSettings(interaction.guildId) || {};
  const exam = examId ? dao.getExam(examId) : null;
  const staffRoleId = (exam && exam.staff_role_id) || globalSettings.staff_role_id;
  const member = interaction.member;
  if (staffRoleId && member.roles && member.roles.cache && member.roles.cache.has(staffRoleId)) return true;
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
