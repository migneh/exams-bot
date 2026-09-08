const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
} = require('discord.js');
const { t } = require('../../utils/strings');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { requireStaff } = require('../../utils/perms');
const { fmtDurationAr } = require('../../utils/time');

function buildPanelPayload() {
  const exams = dao.listOpenExams();
  if (!exams.length) return null;
  const embed = embeds.info(`📋 ${t('panel.title')}`, t('panel.description'));
  for (const exam of exams.slice(0, 10)) {
    const questions = dao.countQuestions(exam.id);
    const effective = exam.questions_per_attempt ? Math.min(exam.questions_per_attempt, questions) : questions;
    embed.addFields({
      name: `📝 ${exam.name}`,
      value: [
        exam.description ? String(exam.description).slice(0, 200) : '—',
        `▸ ${t('field.questions')}: **${effective}** • ${t('field.duration')}: **${exam.duration_min ? fmtDurationAr(exam.duration_min * 60000) : t('field.untimed')}** • ${t('field.pass_mark')}: **${exam.pass_percent}%**`,
      ].join('\n'),
    });
  }
  const menu = new StringSelectMenuBuilder()
    .setCustomId('panel:select')
    .setPlaceholder(t('panel.placeholder'))
    .addOptions(
      exams.slice(0, 25).map((e) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(String(e.name).slice(0, 100))
          .setValue(e.id)
          .setDescription(`${t('field.pass_mark')}: ${e.pass_percent}% • ${t('field.duration')}: ${e.duration_min || '—'}`.slice(0, 100))
          .setEmoji('📝')
      )
    );
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription(t('cmd.panel.desc'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('send')
        .setDescription(t('cmd.panel.send'))
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription(t('cmd.panel.channel'))
            .addChannelTypes(ChannelType.GuildText)
        )
    ),
  async execute(interaction) {
    if (!(await requireStaff(interaction))) return;
    const sub = interaction.options.getSubcommand();
    if (sub !== 'send') return;

    const payload = buildPanelPayload();
    if (!payload) return void (await interaction.reply(embeds.errorPayload('panel.no_exams')));

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    await channel.send(payload);
    await interaction.reply({
      embeds: [embeds.success(t('common.done'), t('panel.sent', { channel: `<#${channel.id}>` }))],
      flags: MessageFlags.Ephemeral,
    });
  },
};

module.exports.buildPanelPayload = buildPanelPayload;
