// Manual review queue: posts written answers to the staff review channel,
// collects scores via modals, finalizes when everything is graded.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const dao = require('../database/dao');
const embeds = require('../utils/embeds');
const { t } = require('../utils/strings');
const { fmtDate } = require('../utils/time');
const logger = require('../utils/logger');
const state = require('../state');
const config = require('../config');
const { resolveExamSettings } = require('../utils/examSettings');

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/** Post the review control embed + one message per written answer. */
async function enqueue(attemptId) {
  const attempt = dao.getAttempt(attemptId);
  if (!attempt) return;
  const exam = dao.getExam(attempt.exam_id);
  const written = dao.writtenAnswers(attempt.id);

  const channel = await state.client.channels.fetch(attempt.channel_id).catch(() => null);
  const guild = channel
    ? channel.guild
    : (config.guildId ? state.client.guilds.cache.get(config.guildId) : state.client.guilds.cache.first());
  if (!guild) throw new Error('cannot resolve guild for review queue');
  const settings = resolveExamSettings(exam, dao.getSettings(guild.id) || {});

  if (!settings.review_channel_id) {
    logger.warn('no review channel configured — finalizing without manual scores');
    await require('./examEngine').finalize(attempt.id, { noteKey: 'review.no_channel_note' });
    return;
  }

  const reviewChannel = await guild.channels.fetch(settings.review_channel_id).catch(() => null);
  if (!reviewChannel) {
    await require('./examEngine').finalize(attempt.id, { noteKey: 'review.no_channel_note' });
    return;
  }

  const control = embeds.pending(t('review.new'));
  control.setDescription(
    `<@${attempt.user_id}> • **${exam ? exam.name : '—'}**\n${t('review.control_desc')}`
  );
  control.addFields(
    { name: '🤖 ' + t('field.auto_score'), value: `**${attempt.auto_score}/${attempt.max_score}**`, inline: true },
    { name: '📝 ' + t('field.written_count'), value: `**${written.length}**`, inline: true },
    { name: '📅 ' + t('field.submitted_at'), value: fmtDate(attempt.submitted_at), inline: true }
  );
  if (attempt.expired) control.addFields({ name: '⏰ ' + t('field.note'), value: t('result.expired_note') });

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`review:accept:${attempt.id}`).setLabel(t('review.accept')).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`review:retake:${attempt.id}`).setLabel(t('review.retake')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`review:reject:${attempt.id}`).setLabel(t('review.reject')).setStyle(ButtonStyle.Danger)
    ),
  ];

  let sentAnswerIds = {};
  try {
    sentAnswerIds = attempt.review_answer_msg_ids ? JSON.parse(attempt.review_answer_msg_ids) : {};
  } catch {
    sentAnswerIds = {};
  }

  // The control message and each answer message are persisted independently,
  // making a retry after a Discord outage idempotent instead of duplicating the
  // entire review queue.
  if (!attempt.review_msg_id) {
    const controlMsg = await reviewChannel.send({ embeds: [control], components: rows });
    dao.updateAttempt(attempt.id, {
      review_msg_id: controlMsg.id,
      review_answer_msg_ids: JSON.stringify(sentAnswerIds),
    });
  }

  for (const a of written) {
    if (sentAnswerIds[a.id]) continue;
    const fast = a.shown_at && a.answered_at && a.answered_at - a.shown_at < config.timing.fastAnswer;
    const ansEmbed = embeds.pending(
      `${t(`type.${a.question_type}`)} • ${t('review.answer_of', { user: `<@${attempt.user_id}>` })}`
    );
    ansEmbed.setDescription(`**${truncate(a.question_text, 700)}**`);
    ansEmbed.addFields(
      {
        name: '✍️ ' + t('review.member_answer'),
        value: a.text_answer ? `\`\`\`${truncate(a.text_answer, 900)}\`\`\`` : `❌ ${t('review.not_answered')}`,
      },
      { name: '⚡ ' + t('field.points'), value: `**0 — ${a.question_points}**`, inline: true }
    );
    if (fast) ansEmbed.addFields({ name: '🚨 ' + t('review.fast_flag_title'), value: t('review.fast_flag') });
    if (a.question_image) ansEmbed.setImage(a.question_image);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`review:grade:${a.id}`)
        .setLabel(t('review.grade'))
        .setStyle(ButtonStyle.Primary)
    );
    const answerMsg = await reviewChannel.send({ embeds: [ansEmbed], components: [row] });
    sentAnswerIds[a.id] = answerMsg.id;
    dao.updateAttempt(attempt.id, { review_answer_msg_ids: JSON.stringify(sentAnswerIds) });
  }

  const { sendLog } = require('../utils/audit');
  await sendLog(
    guild,
    embeds.pending(t('log.review_queued'), `<@${attempt.user_id}> • ${exam ? exam.name : '—'}`),
    settings.log_channel_id
  );
}

/** A reviewer submitted a score for one written answer. */
async function onGraded(answerId, { score, feedback, reviewerId, interaction }) {
  const answer = dao.getAnswerById(answerId);
  if (!answer) return null;
  const attempt = dao.getAttempt(answer.attempt_id);
  if (!attempt || attempt.status !== 'reviewing') return { closed: true };

  dao.setAnswerManual(answer.id, score, feedback, reviewerId);

  // refresh the answer message
  try {
    const question = dao.getQuestion(answer.question_id);
    const maxScore = question ? question.points : 0;
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    embed.addFields({ name: '✅ ' + t('field.score'), value: `**${score}/${maxScore}**${feedback ? `\n💬 ${truncate(feedback, 200)}` : ''}`, inline: true });
    await interaction.update({ embeds: [embed], components: [] });
  } catch {
    /* ignore */
  }

  const remaining = dao.ungradedWrittenCount(attempt.id);
  if (remaining === 0) {
    await require('./examEngine').finalize(attempt.id, { decidedBy: reviewerId });
  } else if (attempt.review_msg_id) {
    try {
      const channel = await state.client.channels.fetch(attempt.channel_id).catch(() => null);
      const guild = channel ? channel.guild : null;
      const exam = dao.getExam(attempt.exam_id);
      const settings = guild ? resolveExamSettings(exam, dao.getSettings(guild.id) || {}) : null;
      if (settings && settings.review_channel_id) {
        const rch = await guild.channels.fetch(settings.review_channel_id).catch(() => null);
        const rmsg = rch ? await rch.messages.fetch(attempt.review_msg_id).catch(() => null) : null;
        if (rmsg) {
          const cEmbed = EmbedBuilder.from(rmsg.embeds[0]);
          cEmbed.addFields({ name: '⏳ ' + t('field.remaining_review'), value: `**${remaining}**` });
          await rmsg.edit({ embeds: [cEmbed] });
        }
      }
    } catch {
      /* ignore */
    }
  }
  return { closed: false, remaining };
}

/** Staff decision: force accept (pass regardless of score). */
async function accept(attemptId, reviewerId) {
  return require('./examEngine').finalize(attemptId, {
    forcePassed: true,
    decidedBy: reviewerId,
    noteKey: 'review.accepted_note',
  });
}

/** Staff decision: ask for a retake (attempt does not count, channel closes). */
async function retake(attemptId, reviewerId) {
  const attempt = dao.getAttempt(attemptId);
  if (!attempt || attempt.status !== 'reviewing') return null;
  dao.updateAttempt(attempt.id, {
    status: 'retake',
    decided_by: reviewerId,
    cleanup_at: Date.now() + config.timing.channelDeleteDelay,
  });

  const exam = dao.getExam(attempt.exam_id);
  try {
    const channel = await state.client.channels.fetch(attempt.channel_id).catch(() => null);
    if (channel) {
      const embed = embeds.warn(t('review.retake_title'), t('review.retake_member', { exam: exam ? exam.name : '' }));
      await channel.send({ content: `<@${attempt.user_id}>`, embeds: [embed] });
      require('./channelManager').scheduleDelete(channel, config.timing.channelDeleteDelay);
    }
  } catch (err) {
    logger.warn('retake notify failed:', err?.message || err);
  }
  try {
    const user = await state.client.users.fetch(attempt.user_id);
    await user.send({ embeds: [embeds.warn(t('review.retake_title'), t('review.retake_member', { exam: exam ? exam.name : '' }))] });
  } catch {
    /* ignore */
  }
  return dao.getAttempt(attemptId);
}

/** Retry review jobs that were interrupted by a process or Discord failure. */
async function hydrate() {
  for (const attempt of dao.listReviewQueuePending()) {
    try {
      if (attempt.status === 'review_failed') dao.updateAttempt(attempt.id, { status: 'reviewing' });
      await enqueue(attempt.id);
    } catch (err) {
      dao.updateAttempt(attempt.id, { status: 'review_failed' });
      logger.error('review queue hydration failed:', err?.message || err);
    }
  }
}

/** Staff decision: final rejection. */
async function reject(attemptId, reviewerId) {
  return require('./examEngine').finalize(attemptId, {
    forcePassed: false,
    decidedBy: reviewerId,
    noteKey: 'review.rejected_note',
  });
}

module.exports = { enqueue, hydrate, onGraded, accept, retake, reject };
