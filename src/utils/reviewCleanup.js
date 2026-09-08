const dao = require('../database/dao');
const state = require('../state');
const config = require('../config');
const { resolveExamSettings } = require('./examSettings');
const logger = require('./logger');

/**
 * Remove the review control and answer embeds after a review decision.
 * Missing messages/channels are intentionally ignored so cleanup never blocks
 * result delivery or channel cleanup.
 */
async function deleteReviewMessages(attempt) {
  if (!attempt || !state.client) return;

  const exam = dao.getExam(attempt.exam_id);
  const attemptChannel = await state.client.channels.fetch(attempt.channel_id).catch(() => null);
  const guild = attemptChannel?.guild || (config.guildId ? state.client.guilds.cache.get(config.guildId) : state.client.guilds.cache.first());
  const settings = resolveExamSettings(exam, guild ? dao.getSettings(guild.id) || {} : {});
  if (!settings.review_channel_id) return;

  const channel = await state.client.channels.fetch(settings.review_channel_id).catch(() => null);
  if (!channel || !channel.messages) return;

  const ids = new Set();
  if (attempt.review_msg_id) ids.add(attempt.review_msg_id);
  try {
    const answerMessageIds = attempt.review_answer_msg_ids ? JSON.parse(attempt.review_answer_msg_ids) : {};
    for (const id of Object.values(answerMessageIds || {})) {
      if (id) ids.add(id);
    }
  } catch (err) {
    logger.warn('review message ID list could not be parsed:', err?.message || err);
  }

  await Promise.all(
    [...ids].map(async (id) => {
      const message = await channel.messages.fetch(id).catch(() => null);
      if (!message) return;
      await message.delete('Exams system — completed review cleanup').catch((err) => {
        logger.debug('review message cleanup skipped:', err?.message || err);
      });
    })
  );
}

module.exports = { deleteReviewMessages };
