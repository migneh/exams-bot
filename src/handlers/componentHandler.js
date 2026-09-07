// Routes every button / select menu / modal through the custom-ID convention:
//   domain:action:id[:id...]
// e.g.  exam:start:ATTEMPT_ID  /  builder:addchoice:QUESTION_ID  /  review:grade:ANSWER_ID
const fs = require('fs');
const path = require('path');
const { Collection, MessageFlags } = require('discord.js');
const logger = require('../utils/logger');
const embeds = require('../utils/embeds');
const { t } = require('../utils/strings');

const components = new Collection(); // "domain:action" → module

function registerComponent(mod, file) {
  if (!mod) return;
  if (Array.isArray(mod)) {
    mod.forEach((m) => registerComponent(m, file));
    return;
  }
  if (!mod.id) return;
  if (components.has(mod.id)) {
    logger.warn(`duplicate component id: ${mod.id} (${file})`);
  }
  components.set(mod.id, mod);
  logger.debug(`loaded component ${mod.id}`);
}

function loadComponents(dir = path.join(__dirname, '..', 'components')) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadComponents(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      registerComponent(require(full), entry.name);
    }
  }
  return components;
}

async function handle(interaction) {
  const parts = interaction.customId.split(':');
  const key = parts.slice(0, 2).join(':');
  const args = parts.slice(2);
  const mod = components.get(key);
  if (!mod) {
    logger.warn(`unrouted component: ${interaction.customId}`);
    return;
  }
  await mod.execute(interaction, ...args);
}

/** Safe wrapper: replies with a clean ephemeral Arabic error on failure. */
async function handleSafe(interaction) {
  try {
    await handle(interaction);
  } catch (err) {
    logger.error(`component ${interaction.customId} failed:`, err);
    try {
      const payload = {
        embeds: [embeds.error(t('error.title'), t('error.generic'))],
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
      else if (interaction.isRepliable()) await interaction.reply(payload);
    } catch {
      /* ignore */
    }
  }
}

module.exports = { components, loadComponents, handle, handleSafe };
