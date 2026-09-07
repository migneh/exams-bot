const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const state = require('../state');
const { t } = require('./strings');

/** Apply the consistent brand look (footer + timestamp) to any embed. */
function brand(embed, color = config.colors.PRIMARY) {
  embed.setColor(color).setTimestamp();
  const client = state.client;
  if (client && client.user) {
    embed.setFooter({
      text: t('brand.footer'),
      iconURL: client.user.displayAvatarURL(),
    });
  } else {
    embed.setFooter({ text: t('brand.footer') });
  }
  return embed;
}

function info(title, description = null) {
  return brand(new EmbedBuilder().setTitle(title).setDescription(description), config.colors.PRIMARY);
}

function success(title, description = null) {
  return brand(new EmbedBuilder().setTitle(title).setDescription(description), config.colors.SUCCESS);
}

function warn(title, description = null) {
  return brand(new EmbedBuilder().setTitle(title).setDescription(description), config.colors.WARN);
}

function error(title, description = null) {
  return brand(new EmbedBuilder().setTitle(title).setDescription(description), config.colors.DANGER);
}

function pending(title, description = null) {
  return brand(new EmbedBuilder().setTitle(title).setDescription(description), config.colors.PENDING);
}

function dark(title, description = null) {
  return brand(new EmbedBuilder().setTitle(title).setDescription(description), config.colors.INFO);
}

/** Quick ephemeral error payload. */
function errorPayload(key, vars = {}) {
  return { embeds: [error(t('error.title'), t(key, vars))], flags: 64 }; // 64 = MessageFlags.Ephemeral
}

module.exports = {
  brand,
  info,
  success,
  warn,
  error,
  pending,
  dark,
  errorPayload,
  colors: config.colors,
};
