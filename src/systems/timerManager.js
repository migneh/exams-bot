// Restart-proof timer system: all timing facts live in the DB (started_at +
// duration), in-memory timeouts are just accelerators re-hydrated on boot.
const config = require('../config');
const dao = require('../database/dao');
const embeds = require('../utils/embeds');
const { t } = require('../utils/strings');
const { fmtDurationAr } = require('../utils/time');
const logger = require('../utils/logger');
const state = require('../state');
const EmbedBuilder = require('discord.js').EmbedBuilder;

/** attemptId → { tick, warn5, warn1, expire, message } */
const timers = new Map();

function disarm(attemptId) {
  const entry = timers.get(attemptId);
  if (!entry) return;
  if (entry.tick) clearInterval(entry.tick);
  if (entry.warn5) clearTimeout(entry.warn5);
  if (entry.warn1) clearTimeout(entry.warn1);
  if (entry.expire) clearTimeout(entry.expire);
  timers.delete(attemptId);
}

/** Edit the live exam message's time field + urgency color. */
async function tickUpdate(attempt, endAt) {
  try {
    const fresh = dao.getAttempt(attempt.id);
    if (!fresh || fresh.status !== 'in_progress') return disarm(attempt.id);
    const remaining = endAt - Date.now();
    if (remaining <= 0) return; // expire timeout will handle it

    const channel = await state.client.channels.fetch(fresh.channel_id).catch(() => null);
    if (!channel) return;
    const message = fresh.message_id
      ? await channel.messages.fetch(fresh.message_id).catch(() => null)
      : null;
    if (!message || !message.embeds || !message.embeds.length) return;

    const builder = EmbedBuilder.from(message.embeds[0]);
    const timeField = t('exam.time_left');
    const idx = builder.data.fields ? builder.data.fields.findIndex((f) => f.name && f.name.includes(timeField)) : -1;
    if (idx >= 0) {
      builder.spliceFields(idx, 1, {
        name: '⏱️ ' + timeField,
        value: `**${fmtDurationAr(remaining)}**`,
        inline: true,
      });
    }
    const color =
      remaining <= config.timing.warning1
        ? config.colors.DANGER
        : remaining <= config.timing.warning5
          ? config.colors.WARN
          : config.colors.PRIMARY;
    builder.setColor(color);
    await message.edit({ embeds: [builder] });
  } catch (err) {
    logger.debug('tick failed:', err?.message || err);
  }
}

/** Warning ping in channel (+ DM at the 5 minute mark). */
async function warnPing(attempt, minutes) {
  try {
    const fresh = dao.getAttempt(attempt.id);
    if (!fresh || fresh.status !== 'in_progress') return;
    const channel = await state.client.channels.fetch(fresh.channel_id).catch(() => null);
    if (!channel) return;
    await channel.send({
      content: `<@${fresh.user_id}> ${t('exam.warn_ping', { minutes })}`,
      embeds: [
        embeds.warn(
          t('exam.warn_title', { minutes }),
          minutes === 5 ? t('exam.warn_dm_5') : t('exam.warn_dm_1')
        ),
      ],
    });
    if (minutes === 5) {
      const user = await state.client.users.fetch(fresh.user_id).catch(() => null);
      if (user) await user.send({ embeds: [embeds.warn(t('exam.warn_title', { minutes }), t('exam.warn_dm_5'))] });
    }
  } catch (err) {
    logger.debug('warn ping failed:', err?.message || err);
  }
}

/** (Re-)arm all timers for an in-progress attempt. */
function arm(attemptId) {
  disarm(attemptId);
  const attempt = dao.getAttempt(attemptId);
  if (!attempt || attempt.status !== 'in_progress' || !attempt.started_at) return;
  const exam = dao.getExam(attempt.exam_id);
  if (!exam || !exam.duration_min) return;

  const endAt = attempt.started_at + exam.duration_min * 60000;
  const remaining = endAt - Date.now();
  if (remaining <= 0) {
    require('./examEngine').handleSubmit(attemptId, { expired: true }).catch((e) =>
      logger.error('boot expiry failed:', e)
    );
    return;
  }

  const entry = { tick: null, warn5: null, warn1: null, expire: null };
  const w5 = config.timing.warning5;
  const w1 = config.timing.warning1;

  if (remaining > w5) {
    entry.warn5 = setTimeout(() => warnPing(attempt, 5), endAt - w5 - Date.now());
  } else if (remaining > w1) {
    // already below 5 minutes — go straight to the 1-minute warning
  }
  if (remaining > w1) {
    entry.warn1 = setTimeout(() => warnPing(attempt, 1), endAt - w1 - Date.now());
  }

  entry.tick = setInterval(() => tickUpdate(attempt, endAt), config.timing.tick);
  entry.expire = setTimeout(() => {
    disarm(attemptId);
    require('./examEngine')
      .handleSubmit(attemptId, { expired: true })
      .catch((e) => logger.error('auto-expire failed:', e));
  }, remaining);

  timers.set(attemptId, entry);
  logger.debug(`timer armed for attempt ${attemptId} (${Math.round(remaining / 1000)}s left)`);
}

/** Boot recovery: re-arm (or instantly expire) every in-progress attempt. */
async function hydrate() {
  const live = dao.listInProgress();
  for (const attempt of live) {
    try {
      const engine = require('./examEngine');
      await engine.resync(attempt);
      arm(attempt.id);
    } catch (err) {
      logger.error('hydrate failed for attempt', attempt.id, err);
    }
  }
  if (live.length) logger.info(`hydrated ${live.length} in-progress attempt(s)`);
}

function armedCount() {
  return timers.size;
}

module.exports = { arm, disarm, hydrate, armedCount };
