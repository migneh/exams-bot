const dao = require('../database/dao');
const embeds = require('./embeds');
const logger = require('./logger');
const { t } = require('./strings');

/**
 * Send an embed to the configured audit-log channel (no-op when unset).
 */
async function sendLog(guild, embed, channelOverride = null) {
  try {
    if (!guild) return;
    const settings = dao.getSettings(guild.id);
    const channelId = channelOverride || settings?.log_channel_id;
    if (!channelId) return;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn('audit log send failed:', err?.message || err);
  }
}

/** Convenience: log a simple titled event with a description. */
async function logEvent(guild, color, titleKey, descKey = null, vars = {}) {
  const embed = embeds.brand(
    new (require('discord.js').EmbedBuilder)().setTitle(t(titleKey, vars)),
    color
  );
  if (descKey) embed.setDescription(t(descKey, vars));
  await sendLog(guild, embed);
}

module.exports = { sendLog, logEvent };
