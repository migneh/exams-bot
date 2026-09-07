const { ChannelType, PermissionFlagsBits, OverwriteType } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

function sanitizeName(name) {
  const cleaned = String(name || '')
    .replace(/[^\p{L}\p{N}_]+/gu, '-') // keep letters (incl. Arabic) and digits
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return (cleaned || 'user').slice(0, 24);
}

/**
 * Create the private exam channel: امتحان-username-03
 * Visible only to the member, staff role, and the bot.
 */
async function createExamChannel(guild, member, attemptNumber, settings) {
  const name = `امتحان-${sanitizeName(member.user.username)}-${String(attemptNumber).padStart(2, '0')}`;
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: member.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: guild.members.me.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  if (settings && settings.staff_role_id) {
    overwrites.push({
      id: settings.staff_role_id,
      type: OverwriteType.Role,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: settings && settings.exams_category_id ? settings.exams_category_id : null,
    permissionOverwrites: overwrites,
    reason: `Exams system — private exam channel for ${member.user.tag}`,
  });
}

/** Delete a channel after a delay (best-effort, never throws). */
function scheduleDelete(channel, delayMs = config.timing.channelDeleteDelay) {
  if (!channel) return;
  setTimeout(async () => {
    try {
      await channel.delete('Exams system — cleanup');
    } catch (err) {
      logger.debug('channel cleanup skipped:', err?.message || err);
    }
  }, delayMs).unref?.();
}

module.exports = { createExamChannel, scheduleDelete, sanitizeName };
