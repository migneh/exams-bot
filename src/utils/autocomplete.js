const dao = require('../database/dao');

/**
 * Shared autocomplete for "exam" string options.
 * Matches by name (case-insensitive contains), returns up to 25 options.
 */
async function examAutocomplete(interaction) {
  const focused = (interaction.options.getFocused() || '').toLowerCase().trim();
  let exams = dao.listExams();
  if (focused) {
    exams = exams.filter((e) => e.name.toLowerCase().includes(focused) || e.id.toLowerCase().includes(focused));
  }
  return interaction.respond(
    exams.slice(0, 25).map((e) => ({
      name: `${e.enabled ? '🟢' : '🔴'} ${e.name} — ${e.id}`.slice(0, 100),
      value: e.id,
    }))
  );
}

module.exports = { examAutocomplete };
