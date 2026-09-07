// Interactive exam builder: no code editing — admins compose exams entirely
// through buttons, select menus and modals. All state lives in the DB, so a
// restart never loses a half-built exam.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const dao = require('../database/dao');
const embeds = require('../utils/embeds');
const { t } = require('../utils/strings');
const config = require('../config');

const CHOICE_LABEL = 80;

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/* ------------------------------ input parsing ---------------------------- */

function parseNumber(input, { min, max, fallback = null } = {}) {
  const n = parseInt(String(input).replace(/[^\d-]/g, ''), 10);
  if (Number.isNaN(n)) return { ok: false, value: fallback };
  if (min !== undefined && n < min) return { ok: false, value: fallback };
  if (max !== undefined && n > max) return { ok: false, value: fallback };
  return { ok: true, value: n };
}

/** Basics modal: name / description / duration / pass% / "attempts, cooldown". */
function parseBasics(fields) {
  const name = (fields.name || '').trim();
  if (!name || name.length > 100) return { ok: false, key: 'builder.bad_name' };
  let description = (fields.description || '').trim();
  if (description === '-') description = '';

  const duration = parseNumber(fields.duration_min, { min: 0, max: 600 });
  if (!duration.ok) return { ok: false, key: 'builder.bad_duration' };
  const pass = parseNumber(fields.pass_percent, { min: 1, max: 100 });
  if (!pass.ok) return { ok: false, key: 'builder.bad_pass' };

  const combo = String(fields.combo || '1, 24');
  const nums = combo.split(/[^\d]+/).filter((x) => x !== '');
  const attempts = parseNumber(nums[0] ?? '1', { min: 0, max: 50, fallback: 1 });
  const cooldown = parseNumber(nums[1] ?? '24', { min: 0, max: 1000, fallback: 24 });
  if (!attempts.ok || !cooldown.ok) return { ok: false, key: 'builder.bad_combo' };

  return {
    ok: true,
    values: {
      name,
      description: description || null,
      duration_min: duration.value,
      pass_percent: pass.value,
      max_attempts: attempts.value,
      cooldown_hours: cooldown.value,
    },
  };
}

function parseBoolAr(input) {
  const s = String(input || '').trim().toLowerCase();
  if (['نعم', 'yes', '1', 'true', 'صح'].includes(s)) return true;
  if (['لا', 'no', '0', 'false', 'خطأ'].includes(s)) return false;
  return null;
}

function parseAdvanced(fields) {
  const subsetRaw = String(fields.questions_per_attempt || '').trim();
  let questions_per_attempt = null;
  if (subsetRaw && subsetRaw !== '-') {
    const r = parseNumber(subsetRaw, { min: 1, max: 100 });
    if (!r.ok) return { ok: false, key: 'builder.bad_subset' };
    questions_per_attempt = r.value;
  }
  const sq = parseBoolAr(fields.shuffle_questions);
  if (sq === null) return { ok: false, key: 'builder.bad_bool' };
  const sa = parseBoolAr(fields.shuffle_answers);
  if (sa === null) return { ok: false, key: 'builder.bad_bool' };
  return {
    ok: true,
    values: { questions_per_attempt, shuffle_questions: sq, shuffle_answers: sa },
  };
}

/** Roles modal: value = role ID / mention / name, or "-" to clear. */
function parseRoleInput(guild, input) {
  const raw = String(input || '').trim();
  if (!raw || raw === '-') return { ok: true, value: null };
  if (!guild) return { ok: false, value: null };
  const mention = raw.match(/^<@&(\d+)>$/);
  if (mention) {
    const role = guild.roles.cache.get(mention[1]);
    return role ? { ok: true, value: role.id } : { ok: false, value: null };
  }
  if (/^\d+$/.test(raw)) {
    const role = guild.roles.cache.get(raw);
    return role ? { ok: true, value: role.id } : { ok: false, value: null };
  }
  const byName = guild.roles.cache.find((r) => r.name.toLowerCase() === raw.toLowerCase());
  return byName ? { ok: true, value: byName.id } : { ok: false, value: null };
}

function parseQuestion(fields) {
  const text = (fields.text || '').trim();
  if (!text || text.length > config.limits.maxTextLen) return { ok: false, key: 'builder.bad_text' };
  const points = parseNumber(fields.points, { min: 1, max: 100, fallback: 1 });
  if (!points.ok) return { ok: false, key: 'builder.bad_points' };
  let image_url = (fields.image_url || '').trim();
  if (image_url === '-') image_url = '';
  if (image_url && !/^https?:\/\//i.test(image_url)) return { ok: false, key: 'builder.bad_image' };
  return { ok: true, values: { text, points: points.value, image_url: image_url || null } };
}

/* --------------------------------- views --------------------------------- */

function settingsSummary(exam) {
  return [
    `▸ ${t('field.duration')}: **${exam.duration_min ? exam.duration_min + ' ' + t('field.minutes') : t('field.untimed')}**`,
    `▸ ${t('field.pass_mark')}: **${exam.pass_percent}%**`,
    `▸ ${t('field.attempts')}: **${exam.max_attempts > 0 ? exam.max_attempts : '∞'}**`,
    `▸ ${t('field.cooldown')}: **${exam.cooldown_hours > 0 ? exam.cooldown_hours + ' ' + t('field.hours') : t('field.none')}**`,
    `▸ ${t('field.questions_per_attempt')}: **${exam.questions_per_attempt || t('field.all')}**`,
    `▸ ${t('field.shuffle_questions')}: **${exam.shuffle_questions ? t('common.yes') : t('common.no')}**`,
    `▸ ${t('field.shuffle_answers')}: **${exam.shuffle_answers ? t('common.yes') : t('common.no')}**`,
    `▸ ${t('field.required_role')}: **${exam.required_role_id ? `<@&${exam.required_role_id}>` : t('field.none')}**`,
    `▸ ${t('field.reward_role')}: **${exam.reward_role_id ? `<@&${exam.reward_role_id}>` : t('field.none')}**`,
  ].join('\n');
}

function home(examId) {
  const exam = dao.getExam(examId);
  if (!exam) return { embeds: [embeds.error(t('error.title'), t('error.exam_not_found'))], components: [] };
  const questions = dao.listQuestions(exam.id);

  const embed = embeds.brand(
    new (require('discord.js').EmbedBuilder)()
      .setTitle(`🛠️ ${t('builder.home_title', { name: exam.name })}`),
    exam.enabled ? config.colors.SUCCESS : config.colors.WARN
  );
  embed.setDescription(
    `${exam.description ? truncate(exam.description, 500) + '\n\n' : ''}${t('builder.home_desc')}`
  );
  embed.addFields(
    {
      name: `⚙️ ${t('builder.settings_field')} — ${exam.enabled ? '🟢 ' + t('common.enabled') : '🔴 ' + t('common.disabled')}`,
      value: settingsSummary(exam),
    },
    {
      name: `📋 ${t('builder.questions_field')} (${questions.length})`,
      value: questions.length
        ? questions
            .slice(0, config.limits.maxQuestionsListed)
            .map(
              (q, i) =>
                `${i + 1}. ${t(`type.${q.type}`)} — ${truncate(q.text, 60)} \`(${q.points} ${t('field.points_unit')})\``
            )
            .join('\n') + (questions.length > config.limits.maxQuestionsListed ? `\n… +${questions.length - config.limits.maxQuestionsListed}` : '')
        : t('builder.no_questions'),
    }
  );

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`builder:addq:${exam.id}`).setLabel(t('builder.add_question')).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`builder:manage:${exam.id}`).setLabel(t('builder.manage_questions')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`builder:finish:${exam.id}`).setLabel(t('builder.finish')).setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`builder:settings:${exam.id}`).setLabel(t('builder.settings')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`builder:adv:${exam.id}`).setLabel(t('builder.advanced')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`builder:roles:${exam.id}`).setLabel(t('builder.roles')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`builder:delete:${exam.id}`).setLabel(t('builder.delete_exam')).setStyle(ButtonStyle.Danger)
    ),
  ];
  return { embeds: [embed], components: rows };
}

function typeSelect(examId) {
  const exam = dao.getExam(examId);
  if (!exam) return home(examId);
  const embed = embeds.info(t('builder.type_title'), t('builder.type_desc'));
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`builder:type:${exam.id}`)
    .setPlaceholder(t('builder.type_placeholder'))
    .addOptions(
      ['mcq_single', 'mcq_multi', 'true_false', 'short', 'long'].map((type) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(t(`type.${type}`))
          .setValue(type)
          .setDescription(t(`type.desc.${type}`))
          .setEmoji(typeEmoji(type))
      )
    );
  const rows = [
    new ActionRowBuilder().addComponents(menu),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`builder:home:${exam.id}`).setLabel(t('common.back')).setStyle(ButtonStyle.Secondary)
    ),
  ];
  return { embeds: [embed], components: rows };
}

function typeEmoji(type) {
  return {
    mcq_single: '🔘',
    mcq_multi: '🔢',
    true_false: '⚖️',
    short: '✏️',
    long: '📝',
  }[type] || '❓';
}

function questionSelect(examId) {
  const exam = dao.getExam(examId);
  if (!exam) return home(examId);
  const questions = dao.listQuestions(exam.id);
  const embed = embeds.info(t('builder.manage_questions'), t('builder.qsel_desc'));
  if (!questions.length) {
    return {
      embeds: [embed.setDescription(embed.data.description + `\n\n⚠️ ${t('builder.no_questions')}`)],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`builder:home:${exam.id}`).setLabel(t('common.back')).setStyle(ButtonStyle.Secondary)
        ),
      ],
    };
  }
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`builder:qsel:${exam.id}`)
    .setPlaceholder(t('builder.qsel_placeholder'))
    .addOptions(
      questions.slice(0, 25).map((q, i) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${i + 1}. ${truncate(q.text, 90)}`)
          .setValue(q.id)
          .setDescription(`${t(`type.${q.type}`)} • ${q.points} ${t('field.points_unit')}`)
          .setEmoji(typeEmoji(q.type))
      )
    );
  const rows = [
    new ActionRowBuilder().addComponents(menu),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`builder:addq:${exam.id}`).setLabel(t('builder.add_question')).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`builder:home:${exam.id}`).setLabel(t('common.back')).setStyle(ButtonStyle.Secondary)
    ),
  ];
  return { embeds: [embed], components: rows };
}

function questionEditor(questionId) {
  const q = dao.getQuestion(questionId);
  if (!q) return { embeds: [embeds.error(t('error.title'), t('error.exam_not_found'))], components: [] };
  const exam = dao.getExam(q.exam_id);
  const choices = dao.listChoices(q.id);
  const correctCount = choices.filter((c) => c.is_correct).length;

  const embed = embeds.info(`${typeEmoji(q.type)} ${t('builder.q_editor_title', { n: q.order_index + 1 })}`);
  embed.setDescription(
    [
      `**${q.text}**`,
      '',
      `▸ ${t('field.type')}: ${t(`type.${q.type}`)}`,
      `▸ ${t('field.points')}: **${q.points}**`,
      `▸ ${t('field.image')}: ${q.image_url ? t('common.yes') : t('common.no')}`,
    ].join('\n')
  );
  if (q.image_url) embed.setThumbnail(q.image_url);

  if (q.type === 'mcq_single' || q.type === 'mcq_multi' || q.type === 'true_false') {
    const list = choices.length
      ? choices
          .map((c, i) => `${c.is_correct ? '✅' : '⬜'} ${String.fromCharCode(65 + i)}. ${truncate(c.text, 50)}`)
          .join('\n')
      : t('builder.no_choices');
    embed.addFields({ name: `🔀 ${t('builder.choices_field')} (${choices.length})`, value: list });

    const warnings = [];
    if (choices.length < 2 && q.type !== 'true_false') warnings.push(`⚠️ ${t('builder.warn_min_choices')}`);
    if (correctCount === 0) warnings.push(`⚠️ ${t('builder.warn_no_correct')}`);
    if (q.type === 'mcq_single' && correctCount > 1) warnings.push(`⚠️ ${t('builder.warn_multi_correct')}`);
    if (warnings.length) embed.addFields({ name: `🚨 ${t('builder.warnings')}`, value: warnings.join('\n') });
  }

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`builder:home:${exam.id}`).setLabel(t('common.back')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`builder:qedit:${q.id}`).setLabel(t('builder.edit_text')).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`builder:qdel:${q.id}`).setLabel(t('builder.delete_question')).setStyle(ButtonStyle.Danger)
    ),
  ];
  if (q.type === 'mcq_single' || q.type === 'mcq_multi') {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`builder:addchoice:${q.id}`).setLabel(t('builder.add_choice')).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`builder:correctbtn:${q.id}`).setLabel(t('builder.set_correct')).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`builder:choicedelbtn:${q.id}`).setLabel(t('builder.delete_choice')).setStyle(ButtonStyle.Secondary)
      )
    );
  } else if (q.type === 'true_false') {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`builder:correctbtn:${q.id}`).setLabel(t('builder.set_correct')).setStyle(ButtonStyle.Success)
      )
    );
  }
  return { embeds: [embed], components: rows };
}

function correctSelect(questionId, multi) {
  const q = dao.getQuestion(questionId);
  if (!q) return questionEditor(questionId);
  const choices = dao.listChoices(q.id);
  const embed = embeds.info(t('builder.correct_title', { multi: multi ? t('common.multi') : t('common.single') }), t('builder.correct_desc'));
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`builder:correct:${q.id}`)
    .setPlaceholder(t('builder.correct_placeholder'))
    .setMinValues(1)
    .setMaxValues(multi ? Math.max(1, choices.length) : 1)
    .addOptions(
      choices.map((c, i) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${String.fromCharCode(65 + i)}. ${truncate(c.text, 90)}`)
          .setValue(c.id)
          .setDefault(!!c.is_correct)
      )
    );
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(menu),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`builder:qback:${q.id}`).setLabel(t('common.back')).setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

function choiceDeleteSelect(questionId) {
  const q = dao.getQuestion(questionId);
  if (!q) return questionEditor(questionId);
  const choices = dao.listChoices(q.id);
  const embed = embeds.warn(t('builder.choicedel_title'), t('builder.choicedel_desc'));
  if (!choices.length) return questionEditor(questionId);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`builder:choicedel:${q.id}`)
    .setPlaceholder(t('builder.choicedel_placeholder'))
    .addOptions(
      choices.map((c, i) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${String.fromCharCode(65 + i)}. ${truncate(c.text, 90)}`)
          .setValue(c.id)
          .setDescription(c.is_correct ? t('builder.currently_correct') : '—')
      )
    );
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(menu),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`builder:qback:${q.id}`).setLabel(t('common.back')).setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

/* ------------------------------ modal factories -------------------------- */

const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

function inputRow(input) {
  return new ActionRowBuilder().addComponents(input);
}

/** Set the prefilled value only when non-empty (setValue(undefined) throws). */
function applyValue(input, value, max = 4000) {
  const s = String(value ?? '').trim().slice(0, max);
  if (s) input.setValue(s);
  return input;
}

function makeBasicsModal(customId, prefill = {}) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(t('modal.basics_title'));
  modal.addComponents(
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel(t('modal.exam_name'))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
        prefill.name,
        100
      )
    ),
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel(t('modal.exam_description'))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000)
          .setPlaceholder('-'),
        prefill.description,
        1000
      )
    ),
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('duration_min')
          .setLabel(t('modal.exam_duration'))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(4),
        prefill.duration_min ?? '15',
        4
      )
    ),
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('pass_percent')
          .setLabel(t('modal.exam_pass'))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3),
        prefill.pass_percent ?? '60',
        3
      )
    ),
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('combo')
          .setLabel(t('modal.exam_combo'))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(12)
          .setPlaceholder('1, 24'),
        prefill.combo ?? '1, 24',
        12
      )
    )
  );
  return modal;
}

function makeAdvancedModal(customId, prefill = {}) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(t('modal.advanced_title'));
  modal.addComponents(
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('questions_per_attempt')
          .setLabel(t('modal.exam_subset'))
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(3)
          .setPlaceholder('-'),
        prefill.questions_per_attempt,
        3
      )
    ),
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('shuffle_questions')
          .setLabel(t('modal.shuffle_questions'))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(4),
        prefill.shuffle_questions === false ? t('common.no') : t('common.yes')
      )
    ),
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('shuffle_answers')
          .setLabel(t('modal.shuffle_answers'))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(4),
        prefill.shuffle_answers === false ? t('common.no') : t('common.yes')
      )
    )
  );
  return modal;
}

function makeRolesModal(customId, prefill = {}) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(t('modal.roles_title'));
  modal.addComponents(
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('required_role')
          .setLabel(t('modal.required_role'))
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(30)
          .setPlaceholder('-'),
        prefill.required_role_id ? `<@&${prefill.required_role_id}>` : '-',
        30
      )
    ),
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('reward_role')
          .setLabel(t('modal.reward_role'))
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(30)
          .setPlaceholder('-'),
        prefill.reward_role_id ? `<@&${prefill.reward_role_id}>` : '-',
        30
      )
    )
  );
  return modal;
}

function makeQuestionModal(customId, prefill = {}) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(t('modal.question_title'));
  modal.addComponents(
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('text')
          .setLabel(t('modal.question_text'))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(config.limits.maxTextLen),
        prefill.text,
        config.limits.maxTextLen
      )
    ),
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('points')
          .setLabel(t('modal.question_points'))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3),
        prefill.points ?? '1',
        3
      )
    ),
    inputRow(
      applyValue(
        new TextInputBuilder()
          .setCustomId('image_url')
          .setLabel(t('modal.question_image'))
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(300)
          .setPlaceholder('https://...'),
        prefill.image_url,
        300
      )
    )
  );
  return modal;
}

function makeChoiceModal(customId) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(t('modal.choice_title'));
  modal.addComponents(
    inputRow(
      new TextInputBuilder()
        .setCustomId('text')
        .setLabel(t('modal.choice_text'))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(config.limits.maxChoiceLen)
    )
  );
  return modal;
}

function makeConfirmModal(customId, titleKey, word) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(t(titleKey).slice(0, 45));
  modal.addComponents(
    inputRow(
      new TextInputBuilder()
        .setCustomId('confirm')
        .setLabel(t('modal.confirm_label', { word }).slice(0, 45))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20)
        .setPlaceholder(word)
    )
  );
  return modal;
}

module.exports = {
  truncate,
  parseBasics,
  parseAdvanced,
  parseRoleInput,
  parseQuestion,
  home,
  typeSelect,
  questionSelect,
  questionEditor,
  correctSelect,
  choiceDeleteSelect,
  typeEmoji,
  CHOICE_LABEL,
  makeBasicsModal,
  makeAdvancedModal,
  makeRolesModal,
  makeQuestionModal,
  makeChoiceModal,
  makeConfirmModal,
};
