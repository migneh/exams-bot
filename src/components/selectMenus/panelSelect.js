const { MessageFlags } = require('discord.js');
const dao = require('../../database/dao');
const embeds = require('../../utils/embeds');
const { t } = require('../../utils/strings');
const { checkEligibility } = require('../../systems/eligibility');
const channelManager = require('../../systems/channelManager');
const engine = require('../../systems/examEngine');
const { sendLog } = require('../../utils/audit');
const logger = require('../../utils/logger');

/** Application panel: member picks an exam → eligibility → private channel. */
module.exports = {
  id: 'panel:select',
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

    const examId = (interaction.values || [])[0];
    const exam = dao.getExam(examId);
    if (!exam || !exam.enabled || dao.countQuestions(exam.id) === 0) {
      return void (await interaction.editReply({ embeds: [embeds.error(t('error.title'), t('eligibility.disabled'))] }));
    }

    const settings = dao.getSettings(interaction.guildId);
    if (!settings) {
      return void (await interaction.editReply({ embeds: [embeds.error(t('error.title'), t('error.no_settings'))] }));
    }

    const member = interaction.member;
    const eligibility = checkEligibility({ guild: interaction.guild, member, exam });
    if (!eligibility.ok) {
      return void (await interaction.editReply({
        embeds: [embeds.error(t('error.title'), t(eligibility.key, eligibility.vars || {}))],
      }));
    }

    // Create the private exam channel + pending attempt. Discord channel
    // creation is not transactional with SQLite, so every partial failure is
    // explicitly cleaned up below.
    let channel;
    let attempt;
    try {
      if (dao.activeAttemptFor(member.id, exam.id)) {
        return void (await interaction.editReply({
          embeds: [embeds.error(t('error.title'), t('eligibility.in_progress', { channel: '—' }))],
        }));
      }
      const attemptNumber = dao.nextAttemptNumber(member.id, exam.id);
      channel = await channelManager.createExamChannel(interaction.guild, member, attemptNumber, settings);
      attempt = dao.createAttempt({
        exam_id: exam.id,
        user_id: member.id,
        channel_id: channel.id,
        attempt_number: attemptNumber,
      });
      await channel.send(engine.welcomePayload(exam, attempt, member));
    } catch (err) {
      logger.error('channel creation failed:', err);
      if (attempt) dao.deleteAttempt(attempt.id);
      if (channel) await channel.delete('Exams system — rollback failed application').catch(() => {});
      return void (await interaction.editReply({ embeds: [embeds.error(t('error.title'), t('error.generic'))] }));
    }

    await interaction.editReply({
      embeds: [embeds.success(t('panel.created_title'), t('panel.created', { channel: `<#${channel.id}>` }))],
    });

    await sendLog(
      interaction.guild,
      embeds.info(
        t('log.applied', { user: `<@${member.id}>` }),
        `${exam.name} • <#${channel.id}>`
      )
    );
  },
};
