const dao = require('../database/dao');
const embeds = require('../utils/embeds');
const { t } = require('../utils/strings');
const { isStaff } = require('../utils/perms');
const panelCommand = require('../commands/admin/panel');
const config = require('../config');

// Deliberately fixed: these aliases are part of the bot UX and are not
// user-configurable. Keep them short, Arabic-first, and stable for help docs.
const FIXED_ARABIC_ALIASES = Object.freeze({
  'مساعدة': 'help',
  'أوامر': 'help',
  'اوامر': 'help',
  'بنغ': 'ping',
  'فحص': 'ping',
  'لوحة': 'panel',
  'الامتحانات': 'panel',
  'امتحانات': 'panel',
  'إعدادات': 'settings',
  'اعدادات': 'settings',
});

function normalizedShortcut(content) {
  return String(content || '').trim().replace(/^!/, '').trim().toLocaleLowerCase('ar');
}

function helpEmbed() {
  const embed = embeds.info(`📘 ${t('help.title')}`, t('help.intro'));
  embed.addFields(
    {
      name: `👥 ${t('help.members_title')}`,
      value: [
        '`مساعدة` / `أوامر` — ' + t('cmd.help.desc'),
        '`بنغ` / `فحص` — ' + t('cmd.ping.desc'),
        '`الامتحانات` / `لوحة` — ' + t('help.panel_hint'),
      ].join('\n'),
    },
    {
      name: `🛡️ ${t('help.staff_title')}`,
      value: [
        '`/exam create` — ' + t('cmd.exam.create'),
        '`/exam edit` — ' + t('cmd.exam.edit'),
        '`/settings` — ' + t('cmd.settings.desc'),
        '`/panel send` — ' + t('cmd.panel.send'),
      ].join('\n'),
    }
  );
  return embed;
}

function settingsEmbed(guildId) {
  const settings = dao.getSettings(guildId);
  const value = (id, kind) => {
    if (!id) return `❌ ${t('common.not_set')}`;
    return kind === 'role' ? `<@&${id}>` : `<#${id}>`;
  };
  const embed = embeds.dark(`⚙️ ${t('cmd.settings.view_title')}`);
  embed.setDescription(t('cmd.settings.view_desc'));
  embed.addFields(
    { name: `🛡️ ${t('cmd.settings.staff_role')}`, value: value(settings?.staff_role_id, 'role'), inline: true },
    { name: `📥 ${t('cmd.settings.review_channel')}`, value: value(settings?.review_channel_id, 'channel'), inline: true },
    { name: `📜 ${t('cmd.settings.log_channel')}`, value: value(settings?.log_channel_id, 'channel'), inline: true },
    { name: `🗂️ ${t('cmd.settings.exams_category')}`, value: value(settings?.exams_category_id, 'channel'), inline: true }
  );
  return embed;
}

async function executeShortcut(message, command) {
  if (command === 'help') return message.reply({ embeds: [helpEmbed()] });
  if (command === 'ping') {
    const sent = await message.reply({ embeds: [embeds.info('🏓 ...')] });
    return sent.edit({ embeds: [embeds.success('🏓 Pong!', t('ping.reply', {
      ms: Date.now() - message.createdTimestamp,
      ws: Math.round(message.client.ws.ping),
    }))] });
  }
  if (command === 'settings') {
    if (!isStaff(message)) return message.reply({ embeds: [embeds.error(t('error.title'), t('error.not_staff'))] });
    return message.reply({ embeds: [settingsEmbed(message.guildId)] });
  }
  if (command === 'panel') {
    if (!isStaff(message)) return message.reply({ embeds: [embeds.error(t('error.title'), t('error.not_staff'))] });
    const payload = panelCommand.buildPanelPayload();
    return message.channel.send(payload || { embeds: [embeds.error(t('error.title'), t('panel.no_exams'))] });
  }
  return null;
}

module.exports = {
  name: 'messageCreate',
  FIXED_ARABIC_ALIASES,
  async execute(message) {
    if (!message || message.author?.bot || !message.guild || message.guildId !== config.guildId) return;
    const alias = normalizedShortcut(message.content);
    const command = FIXED_ARABIC_ALIASES[alias];
    if (!command) return;
    await executeShortcut(message, command);
  },
};
