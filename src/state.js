// Shared runtime state (client reference available everywhere without circular imports).
const state = {
  /** @type {import('discord.js').Client|null} */
  client: null,
};

module.exports = state;
