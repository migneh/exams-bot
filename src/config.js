require('dotenv').config();
const path = require('path');
const ms = require('ms');

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');

module.exports = {
  token: process.env.TOKEN && process.env.TOKEN.trim() ? process.env.TOKEN.trim() : null,
  clientId: process.env.CLIENT_ID && process.env.CLIENT_ID.trim() ? process.env.CLIENT_ID.trim() : null,
  guildId: process.env.GUILD_ID && process.env.GUILD_ID.trim() ? process.env.GUILD_ID.trim() : null,

  dataDir,
  dbFile: process.env.DB_FILE || 'exams.sqlite',

  /** Brand palette — used by every embed factory. */
  colors: {
    PRIMARY: 0x5865f2, // Discord Blurple
    SUCCESS: 0x57f287, // Green — pass
    WARN: 0xfee75c,    // Yellow — timer low
    DANGER: 0xed4245,  // Red — fail
    PENDING: 0xeb459e, // Fuchsia — review / pending
    INFO: 0x2b2d31,    // Dark grey — informational
  },

  timing: {
    warning5: ms('5m'),
    warning1: ms('1m'),
    tick: ms('20s'),        // live countdown edit interval
    fastAnswer: 5000,       // answers faster than this are flagged for staff
    channelDeleteDelay: ms('5m'), // delay before auto-deleting a finished exam channel
  },

  limits: {
    maxChoices: 10,        // max choices per MCQ question
    maxQuestionsListed: 15, // max questions listed in builder home embed
    maxTextLen: 1500,      // question text
    maxChoiceLen: 80,      // choice text (button label limit)
    maxShortAnswer: 500,
    maxLongAnswer: 3000,
    maxFeedback: 500,
  },
};
