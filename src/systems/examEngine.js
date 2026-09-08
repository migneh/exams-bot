const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const config = require('../config');
const dao = require('../database/dao');
const grader = require('./grader');
const timerManager = require('./timerManager');
const reviewQueue = require('./reviewQueue');
const { checkEligibility } = require('./eligibility');
const channelManager = require('./channelManager');
const embeds = require('../utils/embeds');
const { t } = require('../utils/strings');
const { progressBarLine } = require('../utils/progressBar');
const { fmtDurationAr, fmtDate } = require('../utils/time');
const { resolveExamSettings } = require('../utils/examSettings');
const logger = require('../utils/logger');
const state = require('../state');

/* ------------------------------- helpers -------------------------------- */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Effective ordered question list for an attempt. */
function attemptQuestions(attempt) {
  const order = attempt.question_order ? JSON.parse(attempt.question_order) : [];
  return order.map((qid) => dao.getQuestion(qid)).filter(Boolean);
}

/** Ordered choice ids for a question within an attempt (shuffled at start). */
function attemptChoiceOrder(attempt, questionId) {
  const map = attempt.choice_orders ? JSON.parse(attempt.choice_orders) : {};
  return map[questionId] || null;
}

function answersMap(attemptId) {
  const map = {};
  for (const a of dao.listAnswers(attemptId)) map[a.question_id] = a;
  return map;
}

function deadlineFor(attempt, exam) {
  if (attempt.deadline_at) return attempt.deadline_at;
  if (!exam || !exam.duration_min || !attempt.started_at) return null;
  // Compatibility for attempts created before deadline_at was added.
  return attempt.started_at + exam.duration_min * 60000;
}

function timeLeftMs(attempt, exam) {
  const deadline = deadlineFor(attempt, exam);
  return deadline === null ? null : deadline - Date.now();
}

function isExpired(attempt, exam, now = Date.now()) {
  const deadline = deadlineFor(attempt, exam);
  return deadline !== null && deadline <= now;
}

/** Expire an attempt before accepting an action that arrived too late. */
async function rejectIfExpired(interaction, attempt) {
  const exam = dao.getExam(attempt.exam_id);
  if (!exam || !isExpired(attempt, exam)) return false;
  await handleSubmit(attempt.id, { expired: true });
  if (interaction && interaction.isRepliable && interaction.isRepliable()) {
    await interaction.reply(embeds.errorPayload('error.attempt_closed')).catch(() => {});
  }
  return true;
}

/* ----------------------------- welcome view ------------------------------ */

function welcomePayload(exam, attempt, member) {
  const questions = dao.listQuestions(exam.id);
  const effective = exam.questions_per_attempt
    ? Math.min(exam.questions_per_attempt, questions.length)
    : questions.length;

  const embed = embeds.info(t('welcome.title', { name: exam.name }));
  if (exam.description) embed.setDescription(exam.description);
  embed.addFields(
    {
      name: '📋 ' + t('welcome.meta'),
      value: [
        `▸ ${t('field.questions')}: **${effective}**`,
        `▸ ${t('field.duration')}: **${exam.duration_min ? fmtDurationAr(exam.duration_min * 60000) : t('field.untimed')}**`,
        `▸ ${t('field.pass_mark')}: **${exam.pass_percent}%**`,
        `▸ ${t('field.attempts')}: **${exam.max_attempts > 0 ? exam.max_attempts : '∞'}**`,
        exam.required_role_id ? `▸ ${t('field.required_role')}: <@&${exam.required_role_id}>` : null,
        exam.reward_role_id ? `▸ ${t('field.reward_role')}: <@&${exam.reward_role_id}>` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    },
    { name: '📜 ' + t('welcome.rules_title'), value: t('welcome.rules') }
  );

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`exam:start:${attempt.id}`)
        .setLabel(t('exam.start'))
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`exam:cancel:${attempt.id}`)
        .setLabel(t('exam.cancel'))
        .setStyle(ButtonStyle.Danger)
    ),
  ];

  return { content: `<@${member.id}>`, embeds: [embed], components: rows };
}

/* --------------------------- question rendering -------------------------- */

function buildQuestionMessage(attempt, index) {
  const exam = dao.getExam(attempt.exam_id);
  const questions = attemptQuestions(attempt);
  const n = questions.length;
  const q = questions[index];
  if (!q) return buildSummaryMessage(attempt);

  const answers = answersMap(attempt.id);
  const answer = answers[q.id];
  dao.markShown(attempt.id, q.id); // record display time (anti-cheat)

  const embed = embeds.brand(new EmbedBuilder().setTitle(t('exam.question_title', { current: index + 1, total: n })));
  let desc = q.text;
  desc += `\n\n${progressBarLine(index + 1, n)}`;
  embed.setDescription(desc);
  if (q.image_url) embed.setImage(q.image_url);

  const left = timeLeftMs(attempt, exam);
  const fields = [
    {
      name: '⚡ ' + t('field.points'),
      value: `**${q.points}**`,
      inline: true,
    },
    {
      name: '🏷️ ' + t('field.type'),
      value: t(`type.${q.type}`),
      inline: true,
    },
  ];
  if (left !== null) {
    fields.push({
      name: '⏱️ ' + t('exam.time_left'),
      value: `**${fmtDurationAr(left)}**`,
      inline: true,
    });
  }
  embed.addFields(fields);

  const rows = [];
  const aid = attempt.id;

  if (q.type === 'short' || q.type === 'long') {
    const answered = answer && answer.text_answer;
    embed.addFields({
      name: '✏️ ' + t('exam.your_answer'),
      value: answered
        ? `✅ ${t('exam.answered')}\n\`\`\`${String(answered).slice(0, 120)}\`\`\``
        : `⬜ ${t('exam.not_answered')}`,
    });
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`exam:written:${aid}:${q.id}`)
          .setLabel(answered ? t('exam.edit_answer') : t('exam.write_answer'))
          .setStyle(ButtonStyle.Primary)
      )
    );
  } else {
    const orderIds = attemptChoiceOrder(attempt, q.id) || dao.listChoices(q.id).map((c) => c.id);
    const choices = orderIds.map((cid) => dao.getChoice(cid)).filter(Boolean);
    let chosen = [];
    if (answer && answer.choice_ids) {
      try {
        chosen = JSON.parse(answer.choice_ids) || [];
      } catch {
        chosen = [];
      }
    }

    if (!choices.length) {
      // malformed objective question — nothing to click; navigation still works
    } else if ((q.type === 'mcq_single' || q.type === 'true_false') && choices.length <= 5) {
      rows.push(
        new ActionRowBuilder().addComponents(
          choices.map(
            (c) =>
              new ButtonBuilder()
                .setCustomId(`exam:pick:${aid}:${q.id}:${c.id}`)
                .setLabel(String(c.text).slice(0, 80))
                .setStyle(chosen.includes(c.id) ? ButtonStyle.Success : ButtonStyle.Secondary)
          )
        )
      );
    } else {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`exam:pickmulti:${aid}:${q.id}`)
        .setPlaceholder(chosen.length ? t('exam.select_answered') : t('exam.select_placeholder'))
        .setMinValues(1)
        .setMaxValues(q.type === 'mcq_multi' ? Math.max(1, choices.length) : 1)
        .addOptions(
          choices.map((c) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(String(c.text).slice(0, 100))
              .setValue(c.id)
              .setDefault(chosen.includes(c.id))
          )
        );
      rows.push(new ActionRowBuilder().addComponents(menu));
    }
  }

  // navigation row
  const nav = [];
  if (index > 0) {
    nav.push(
      new ButtonBuilder()
        .setCustomId(`exam:nav:${aid}:${index - 1}`)
        .setLabel(t('exam.prev'))
        .setStyle(ButtonStyle.Secondary)
    );
  }
  if (index < n - 1) {
    nav.push(
      new ButtonBuilder()
        .setCustomId(`exam:nav:${aid}:${index + 1}`)
        .setLabel(t('exam.next'))
        .setStyle(ButtonStyle.Secondary)
    );
  }
  nav.push(
    new ButtonBuilder()
      .setCustomId(`exam:submit:${aid}`)
      .setLabel(t('exam.submit'))
      .setStyle(ButtonStyle.Success)
  );
  nav.push(
    new ButtonBuilder()
      .setCustomId(`exam:cancel:${aid}`)
      .setLabel(t('exam.cancel'))
      .setStyle(ButtonStyle.Danger)
  );
  rows.push(new ActionRowBuilder().addComponents(nav));

  return { embeds: [embed], components: rows };
}

function buildSummaryMessage(attempt) {
  const exam = dao.getExam(attempt.exam_id);
  const questions = attemptQuestions(attempt);
  const answers = answersMap(attempt.id);

  const lines = questions.map((q, i) => {
    const a = answers[q.id];
    const done =
      q.type === 'short' || q.type === 'long'
        ? !!(a && a.text_answer)
        : !!(a && a.choice_ids);
    return `${done ? '✅' : '❌'} **${i + 1}.** ${String(q.text).slice(0, 60)} \`(${q.points} ${t('field.points_unit')})\``;
  });

  const embed = embeds.warn(t('exam.review_title'));
  embed.setDescription(`${t('exam.review_desc')}\n\n${lines.join('\n')}`);
  const left = timeLeftMs(attempt, exam);
  if (left !== null) {
    embed.addFields({
      name: '⏱️ ' + t('exam.time_left'),
      value: `**${fmtDurationAr(left)}**`,
      inline: true,
    });
  }

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`exam:submit:${attempt.id}`)
        .setLabel(t('exam.submit'))
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`exam:nav:${attempt.id}:${Math.max(0, questions.length - 1)}`)
        .setLabel(t('exam.back'))
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
  return { embeds: [embed], components: rows };
}

/* ------------------------------ exam flow -------------------------------- */

async function startExam(interaction, attemptId) {
  const attempt = dao.getAttempt(attemptId);
  if (!attempt) return void (await interaction.reply(embeds.errorPayload('error.exam_not_found')));
  if (attempt.user_id !== interaction.user.id) {
    return void (await interaction.reply(embeds.errorPayload('error.not_for_you')));
  }
  if (attempt.status !== 'pending') {
    return void (await interaction.reply(embeds.errorPayload('error.attempt_already')));
  }
  if (!interaction.guild || !interaction.member) {
    return void (await interaction.reply(embeds.errorPayload('error.guild_only')));
  }

  const exam = dao.getExam(attempt.exam_id);
  if (!exam || !exam.enabled || dao.countQuestions(exam.id) === 0) {
    return void (await interaction.reply(embeds.errorPayload('eligibility.disabled')));
  }

  // A pending welcome message can outlive role/blacklist/attempt changes.
  // Re-run the full server-side eligibility check at the actual start.
  const eligibility = checkEligibility({
    guild: interaction.guild,
    member: interaction.member,
    exam,
    excludeAttemptId: attempt.id,
  });
  if (!eligibility.ok) {
    return void (await interaction.reply(embeds.errorPayload(eligibility.key, eligibility.vars || {})));
  }

  const questions = dao.listQuestions(exam.id);
  const order = questions.map((q) => q.id);
  const shuffled = exam.shuffle_questions ? shuffle(order) : order;
  const finalOrder =
    exam.questions_per_attempt && exam.questions_per_attempt > 0 && exam.questions_per_attempt < shuffled.length
      ? shuffle(questions).slice(0, exam.questions_per_attempt).map((q) => q.id)
      : shuffled;

  const choiceOrders = {};
  for (const q of questions) {
    if (q.type === 'mcq_single' || q.type === 'mcq_multi' || q.type === 'true_false') {
      const cs = dao.listChoices(q.id);
      choiceOrders[q.id] = (exam.shuffle_answers ? shuffle(cs) : cs).map((c) => c.id);
    }
  }

  const startedAt = Date.now();
  dao.updateAttempt(attempt.id, {
    status: 'in_progress',
    started_at: startedAt,
    deadline_at: exam.duration_min ? startedAt + exam.duration_min * 60000 : null,
    current_index: 0,
    question_order: JSON.stringify(finalOrder),
    choice_orders: JSON.stringify(choiceOrders),
    message_id: interaction.message.id,
  });

  const fresh = dao.getAttempt(attempt.id);
  timerManager.arm(fresh.id);
  await interaction.update({ content: '', ...buildQuestionMessage(fresh, 0) });

  const { sendLog } = require('../utils/audit');
  const examSettings = resolveExamSettings(exam, dao.getSettings(interaction.guild.id) || {});
  await sendLog(
    interaction.guild,
    embeds.info(t('log.attempt_started', { user: `<@${attempt.user_id}>` }), t('log.attempt_started_desc', { exam: exam.name, channel: `<#${attempt.channel_id}>` })),
    examSettings.log_channel_id
  );
}

/** Navigate to an index (nav buttons). */
async function navTo(interaction, attemptId, index) {
  const attempt = dao.getAttempt(attemptId);
  if (!attempt || attempt.status !== 'in_progress') {
    return void (await interaction.reply(embeds.errorPayload('error.attempt_closed')));
  }
  if (attempt.user_id !== interaction.user.id) {
    return void (await interaction.reply(embeds.errorPayload('error.not_for_you')));
  }
  if (await rejectIfExpired(interaction, attempt)) return;
  const questions = attemptQuestions(attempt);
  const idx = Math.max(0, Math.min(parseInt(index, 10) || 0, questions.length - 1));
  dao.updateAttempt(attempt.id, { current_index: idx });
  const fresh = dao.getAttempt(attempt.id);
  const payload = idx >= questions.length ? buildSummaryMessage(fresh) : buildQuestionMessage(fresh, idx);
  await interaction.update(payload);
}

/** After an answer is recorded: auto-advance when it was the current question. */
async function afterAnswer(interaction, attemptId, questionId) {
  const attempt = dao.getAttempt(attemptId);
  if (!attempt || attempt.status !== 'in_progress') return;
  const questions = attemptQuestions(attempt);
  const orderIds = questions.map((q) => q.id);
  const answeredIdx = orderIds.indexOf(questionId);
  const current = attempt.current_index;

  if (answeredIdx === current && current + 1 < questions.length) {
    const next = current + 1;
    dao.updateAttempt(attempt.id, { current_index: next });
    const fresh = dao.getAttempt(attempt.id);
    await interaction.update(buildQuestionMessage(fresh, next));
  } else if (answeredIdx === current) {
    // last question → summary
    const fresh = dao.getAttempt(attempt.id);
    await interaction.update(buildSummaryMessage(fresh));
  } else {
    // stale click on an old question view → re-render current
    const fresh = dao.getAttempt(attempt.id);
    await interaction.update(buildQuestionMessage(fresh, current));
  }
}

/** Resolve the bot's (single) guild — settings/logs use it. */
async function resolveGuild(channelId = null) {
  if (channelId) {
    const ch = await state.client.channels.fetch(channelId).catch(() => null);
    if (ch && ch.guild) return ch.guild;
  }
  if (config.guildId) {
    return state.client.guilds.cache.get(config.guildId)
      || await state.client.guilds.fetch(config.guildId).catch(() => null);
  }
  const guilds = await state.client.guilds.fetch().catch(() => null);
  if (guilds && guilds.size) {
    return state.client.guilds.cache.get([...guilds.keys()][0]) || null;
  }
  return state.client.guilds.cache.first() || null;
}

/** Submit the attempt (manual or auto after expiry). */
async function handleSubmit(attemptId, { expired = false } = {}) {
  const attempt = dao.getAttempt(attemptId);
  if (!attempt || attempt.status !== 'in_progress') return null;

  const examBeforeGrade = dao.getExam(attempt.exam_id);
  const actuallyExpired = expired || isExpired(attempt, examBeforeGrade);
  timerManager.disarm(attemptId);
  const { sendLog } = require('../utils/audit');

  dao.updateAttempt(attempt.id, { submitted_at: Date.now(), expired: actuallyExpired ? 1 : 0 });
  const fresh = dao.getAttempt(attempt.id);
  const exam = dao.getExam(fresh.exam_id);
  const graded = grader.gradeAuto(fresh);

  const editExamMessage = async (payload) => {
    try {
      const channel = await state.client.channels.fetch(fresh.channel_id).catch(() => null);
      if (!channel) return;
      const message = fresh.message_id
        ? await channel.messages.fetch(fresh.message_id).catch(() => null)
        : null;
      if (message) await message.edit(payload);
      else await channel.send(payload);
    } catch (err) {
      logger.warn('failed to update exam message:', err?.message || err);
    }
  };

  if (graded.hasWritten) {
    dao.updateAttempt(attempt.id, { status: 'reviewing' });
    const pendingEmbed = embeds.pending(t('result.pending'));
    pendingEmbed.setDescription(
      `<@${fresh.user_id}>\n${actuallyExpired ? t('result.expired_note') + '\n' : ''}${t('result.pending_desc')}`
    );
    await editExamMessage({ content: '', embeds: [pendingEmbed], components: [] });
    try {
      await reviewQueue.enqueue(attempt.id);
    } catch (err) {
      dao.updateAttempt(attempt.id, { status: 'review_failed' });
      logger.error('review queue enqueue failed:', err?.message || err);
      const guild = await resolveGuild(fresh.channel_id);
      const examSettings = resolveExamSettings(exam, guild ? dao.getSettings(guild.id) || {} : {});
      await sendLog(
        guild,
        embeds.error(
          t('log.review_queue_failed', { user: `<@${fresh.user_id}>` }),
          `${exam ? exam.name : '—'} • ${err?.message || 'unknown error'}`
        ),
        examSettings.log_channel_id
      );
      return { reviewing: false, failed: true };
    }
    if (dao.getAttempt(attempt.id)?.status === 'graded') return { reviewing: false };
    const guild = await resolveGuild(fresh.channel_id);
    await sendLog(
      guild,
      embeds.pending(
        t('log.submitted_review', { user: `<@${fresh.user_id}>` }),
        `${exam ? exam.name : '—'} • ${t('field.auto_score')}: ${graded.autoScore}/${graded.maxScore}`
      ),
      resolveExamSettings(exam, guild ? dao.getSettings(guild.id) || {} : {}).log_channel_id
    );
    return { reviewing: true };
  }

  return finalize(attempt.id, { noteKey: actuallyExpired ? 'result.expired_note' : null });
}

/** Compute the final result, apply role, notify, schedule cleanup. */
async function finalize(attemptId, { forcePassed = null, noteKey = null, decidedBy = null, skipMessage = false } = {}) {
  const attempt = dao.getAttempt(attemptId);
  if (!attempt) return null;
  const exam = dao.getExam(attempt.exam_id);
  if (!exam) return null;
  if (attempt.status === 'graded') return attempt; // already finalized

  const answers = dao.listAnswers(attempt.id);
  const manualTotal = answers.reduce((sum, a) => sum + (a.manual_score || 0), 0);
  const total = attempt.auto_score + manualTotal;
  const percent = grader.percentOf(total, attempt.max_score);
  const passed = forcePassed !== null ? !!forcePassed : percent >= exam.pass_percent;

  dao.updateAttempt(attempt.id, {
    status: 'graded',
    manual_score: manualTotal,
    passed: passed ? 1 : 0,
    decided_by: decidedBy || null,
    cleanup_at: Date.now() + config.timing.channelDeleteDelay,
  });
  const final = dao.getAttempt(attempt.id);

  // reward role
  let roleAdded = false;
  if (passed && exam.reward_role_id) {
    try {
      const guild = await resolveGuild(final.channel_id);
      const member = await guild.members.fetch(final.user_id);
      await member.roles.add(exam.reward_role_id, 'Exams — passed exam');
      roleAdded = true;
    } catch (err) {
      logger.warn('could not assign reward role:', err?.message || err);
    }
  }

  // remaining attempts
  const used = dao.finishedAttemptsCount(final.user_id, exam.id);
  const remaining = exam.max_attempts > 0 ? Math.max(0, exam.max_attempts - used) : null;

  const embed = passed
    ? embeds.success(t('result.passed'))
    : embeds.error(t('result.failed'));
  embed.setDescription(`<@${final.user_id}>`);
  embed.addFields(
    {
      name: '📊 ' + t('field.score'),
      value: `**${total}/${final.max_score}** (${percent}%)`,
      inline: true,
    },
    { name: '🎯 ' + t('field.pass_mark'), value: `**${exam.pass_percent}%**`, inline: true },
    {
      name: '🔁 ' + t('field.remaining_attempts'),
      value: remaining === null ? '∞' : String(remaining),
      inline: true,
    }
  );
  if (roleAdded) embed.addFields({ name: '🏅 ' + t('field.reward_role'), value: `<@&${exam.reward_role_id}>`, inline: true });
  if (noteKey) embed.addFields({ name: '📝 ' + t('field.note'), value: t(noteKey) });
  const feedbackLines = answers
    .filter((answer) => answer.feedback)
    .map((answer) => {
      const question = dao.getQuestion(answer.question_id);
      return `• **${String(question ? question.text : 'سؤال').slice(0, 80)}**\n${String(answer.feedback).slice(0, 180)}`;
    })
    .join('\n');
  if (feedbackLines) {
    embed.addFields({ name: '💬 ' + t('field.feedback'), value: feedbackLines.slice(0, 900) });
  }

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`exam:delchan:${final.id}`)
        .setLabel(t('exam.close_channel'))
        .setStyle(ButtonStyle.Secondary)
    ),
  ];

  const { sendLog } = require('../utils/audit');
  const guild = await resolveGuild(final.channel_id);
  const examSettings = resolveExamSettings(exam, guild ? dao.getSettings(guild.id) || {} : {});

  if (!skipMessage) {
    try {
      const channel = await state.client.channels.fetch(final.channel_id).catch(() => null);
      if (channel) {
        if (final.message_id) {
          const message = await channel.messages.fetch(final.message_id).catch(() => null);
          if (message) await message.edit({ content: '', embeds: [embed], components: rows });
          else await channel.send({ embeds: [embed], components: rows });
        } else {
          await channel.send({ embeds: [embed], components: rows });
        }
        channelManager.scheduleDelete(channel, config.timing.channelDeleteDelay);
      }
    } catch (err) {
      logger.warn('finalize: channel message update failed:', err?.message || err);
    }
  }

  // DM copy
  try {
    const user = await state.client.users.fetch(final.user_id);
    await user.send({ embeds: [embed] });
  } catch {
    /* DMs closed — fine */
  }

  // audit log
  await sendLog(
    guild,
    embeds.brand(
      new EmbedBuilder().setTitle(t('log.graded', { user: `<@${final.user_id}>` })),
      passed ? config.colors.SUCCESS : config.colors.DANGER
    ).addFields(
      { name: t('field.exam'), value: exam.name, inline: true },
      { name: t('field.score'), value: `${total}/${final.max_score} (${percent}%)`, inline: true },
      { name: t('field.result'), value: passed ? t('result.passed_short') : t('result.failed_short'), inline: true }
    ),
    examSettings.log_channel_id
  );

  // disable review control buttons if present
  if (final.review_msg_id) {
    try {
      const reviewChannelId = examSettings.review_channel_id;
      if (reviewChannelId) {
        const rch = await state.client.channels.fetch(reviewChannelId).catch(() => null);
        const rmsg = rch ? await rch.messages.fetch(final.review_msg_id).catch(() => null) : null;
        if (rmsg) {
          const doneEmbed = EmbedBuilder.from(rmsg.embeds[0]);
          doneEmbed.addFields({ name: '🏁 ' + t('field.result'), value: passed ? t('result.passed_short') : t('result.failed_short') });
          await rmsg.edit({ embeds: [doneEmbed], components: [] });
        }
      }
    } catch {
      /* ignore */
    }
  }

  return final;
}

/** Boot-time re-render: make sure the live exam message matches DB state. */
async function resync(attempt) {
  try {
    const fresh = dao.getAttempt(attempt.id);
    if (!fresh || fresh.status !== 'in_progress') return;
    const questions = attemptQuestions(fresh);
    const channel = await state.client.channels.fetch(fresh.channel_id).catch(() => null);
    if (!channel) {
      // channel gone — expire the attempt silently
      await handleSubmit(fresh.id, { expired: true });
      return;
    }
    const payload =
      fresh.current_index >= questions.length
        ? buildSummaryMessage(fresh)
        : buildQuestionMessage(fresh, Math.min(fresh.current_index, Math.max(0, questions.length - 1)));
    if (fresh.message_id) {
      const message = await channel.messages.fetch(fresh.message_id).catch(() => null);
      if (message) {
        await message.edit(payload);
        return;
      }
    }
    const sent = await channel.send(payload);
    dao.updateAttempt(fresh.id, { message_id: sent.id });
  } catch (err) {
    logger.warn('resync failed for attempt', attempt.id, err?.message || err);
  }
}

module.exports = {
  shuffle,
  attemptQuestions,
  attemptChoiceOrder,
  deadlineFor,
  isExpired,
  rejectIfExpired,
  welcomePayload,
  buildQuestionMessage,
  buildSummaryMessage,
  startExam,
  navTo,
  afterAnswer,
  handleSubmit,
  finalize,
  resync,
};
