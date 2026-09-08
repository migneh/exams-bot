# 📝 Exams Bot — نظام الامتحانات

An **Arabic-first, high-end staff exams system** for Discord support/staff servers.

```
Apply → private exam channel → timed exam → auto/manual grading → pass/fail + role → logs & analytics
```

> عضو السيرفر يضغط على لوحة التقديم → يحصل على قناة خاصة → يؤدي امتحاناً موقوتاً ومخلطاً
> بأسئلة اختيار ومقالي → تصحيح تلقائي ومراجعة يدوية → نتيجة ورتبة — وكل شيء مسجل.

---

## ✨ Features

- 🛠️ **Interactive exam builder** — build entire exams with buttons, selects and modals. No code editing, ever.
- ⚙️ **Per-exam settings** — each exam can override the staff role, review channel, audit-log channel, and exam-channel category; `-` inherits the main `/settings` value.
- 🗣️ **Fixed Arabic shortcuts** — `مساعدة`, `أوامر`, `بنغ`, `فحص`, `لوحة`, `الامتحانات`, and `إعدادات` work as built-in message shortcuts (not configurable).
- 5 question types: اختيار من متعدد، اختيارات متعددة، صح أو خطأ، إجابة قصيرة، سؤال مقالي (+ optional image per question).
- 🎫 **Private ticket-style exam channels** visible only to the member + staff.
- ⏱️ **Restart-proof timers** — everything is persisted in SQLite and re-hydrated on boot; overdue attempts auto-expire, live attempts resume exactly where they stopped.
- 📊 Real-time progress bar `▰▰▰▱▱ 3/5`, live countdown, warning pings at 5 & 1 minutes, DM reminder.
- 🤖 **Auto grading** for objective questions + **staff review queue** for written answers (score modal + feedback, force accept / request retake / final reject).
- 🏅 Pass → reward role + celebration embed + DM copy of the result.
- 🛡️ Anti-cheat: max attempts, cooldowns, blacklist, required role, question & answer shuffling, random question subsets, suspicious-speed flagging (< 5 s answers), owner verification on every click.
- 📈 `/stats` (pass rates, averages, hardest questions), `/leaderboard`, `/results export` (CSV with Arabic headers, Excel-friendly BOM).
- 📜 Full audit log channel: who applied, started, submitted, graded, and every reviewer decision.
- 🌐 **All Arabic strings in one file** — `locales/ar.json`.

## 🧰 Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22.5+ |
| Library | `discord.js@^14.16` |
| Database | SQLite — `better-sqlite3` (preferred) with automatic fallback to Node's built-in `node:sqlite` (Node ≥ 22.5) when the native module can't build |
| Config | `dotenv` |
| Time | `ms` + `dayjs` (Arabic locale) |
| IDs | `nanoid` v3 |

> The `node:sqlite` fallback makes the bot run anywhere — even on hosts where native compilation is blocked. If `better-sqlite3` installs successfully it is used automatically (you'll see the active driver in the boot log).

## 🚀 Setup

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env
#    TOKEN      → Discord Developer Portal → Bot → Reset Token
#    CLIENT_ID  → Developer Portal → General Information → Application ID
#    GUILD_ID   → your server ID (required; enables the single-server safety boundary)

# 3. run
npm start        # or: npm run dev (auto-restart on changes)
```

**Invite the bot** with the `bot` + `applications.commands` scopes and at least:
`Manage Channels`, `Manage Roles`, `View Channels`, `Send Messages`, `Embed Links`, `Read Message History`, `Manage Messages`.
The bot needs the **Server Members** and **Message Content** privileged intents enabled in the Developer Portal. Message Content is required only for the fixed Arabic message shortcuts.

**First run checklist (in Discord):**

1. `/settings staff_role:` رتبة الإدارة `review_channel:` قناة المراجعة `log_channel:` قناة السجل `exams_category:` تصنيف قنوات الامتحانات
2. `/exam create` → fill the basics modal → add questions in the builder → optionally open `📚 القنوات` and `🎭 الرتب` → ✅ تم
3. `/panel send` in #التقديم — done! Each exam inherits the main channels/role unless its builder override is set.

## 📋 Commands

### Members
| Command | Purpose |
|---|---|
| `/leaderboard exam` | 🏆 top scorers per exam |
| `/help` | 📘 full command guide |
| `مساعدة` / `أوامر` | 📘 fixed Arabic help shortcut |
| `بنغ` / `فحص` | 🏓 fixed Arabic ping shortcut |
| `لوحة` / `الامتحانات` | 📋 fixed Arabic panel shortcut (staff) |
| `إعدادات` | ⚙️ fixed Arabic settings shortcut (staff) |

### Staff (requires Manage Server or the configured staff role)
| Command | Purpose |
|---|---|
| `/exam create` | new exam → interactive question builder |
| `/exam edit exam` | re-open the builder for an existing exam |
| `/exam delete exam` | delete an exam (confirmation modal) |
| `/exam list` | list all exams with status |
| `/exam toggle exam` | enable/disable signups |
| `/exam duplicate exam` | copy an exam with all questions (disabled by default) |
| `/panel send [channel]` | post the application panel |
| `/settings` | staff role, review channel, log channel, exams category |
| `/attempts view @user` | all attempts by a member |
| `/attempts reset @user exam` | reset attempts + cooldown |
| `/blacklist add/remove/list` | block users from all exams |
| `/results export [exam]` | CSV export of results |
| `/stats [exam]` | pass rates, averages, hardest questions |

## 🧩 Per-exam overrides

Open an exam from `/exam edit` and use the builder's `📚 القنوات` and `🎭 الرتب` buttons. Enter a channel/role mention, ID, or exact name. Enter `-` to clear the exam override and inherit the corresponding main setting. The exam-specific staff role is also accepted for review actions; Manage Server always remains an administrator fallback.

## 🎨 UX conventions

- One message per exam state — the question embed is **edited in place**, never re-sent.
- Every destructive action (submit, cancel, delete) requires a **confirmation modal** (type `نعم` / `تسليم` / `حذف`).
- Buttons disable/are replaced after use; errors are ephemeral and Arabic only.
- Consistent brand: emoji-first Arabic titles, aligned inline fields, progress bars, fixed footer `نظام الامتحانات • Support Exams`.
- Palette: Blurple `#5865F2` · Success `#57F287` · Warning `#FEE75C` · Danger `#ED4245` · Review `#EB459E` · Info `#2B2D31`.

## 🗄️ Database

SQLite file at `data/exams.sqlite` (auto-created). Tables: `settings`, `exams`, `questions`, `choices`, `attempts`, `answers`, `blacklist`. The `exams` table stores additive per-exam overrides for staff role, review channel, audit-log channel, and exam-channel category.

Beyond the master plan's schema, the attempt row also stores `message_id`, `current_index`, `question_order`, `choice_orders`, `review_msg_id`, `expired`, `decided_by` and answers store `shown_at` / `graded_by` — this is what makes exams fully restart-proof (the shuffled order is frozen per attempt) and review actions auditable.

## 📁 Project structure

```
├── .env                      # TOKEN, CLIENT_ID, GUILD_ID
├── data/                     # SQLite DB + logs (auto-created, git-ignored)
├── locales/ar.json           # ALL Arabic strings
├── scripts/                  # smoke.js (headless tests), check-locale.js
└── src/
    ├── index.js              # login, boot, graceful shutdown
    ├── config.js             # env + palette + timing constants
    ├── state.js              # shared client reference
    ├── database/             # driver (better-sqlite3 → node:sqlite fallback), dao, migrations
    ├── handlers/             # command / event / component routers
    ├── events/               # ready (register + timer rehydration), interactionCreate, messageCreate shortcuts
    ├── commands/             # exam/, admin/, general/
    ├── components/           # buttons/, selectMenus/, modals/ — one file per custom ID
    └── systems/              # examEngine, timerManager, grader, reviewQueue,
                              # channelManager, eligibility, builder
```

### Custom-ID routing

Every component follows `domain:action:id…`, routed by `componentHandler`:

```
exam:start:ATTEMPT_ID        exam:pick:ATTEMPT:QUESTION:CHOICE     exam:nav:ATTEMPT:INDEX
exam:submitm:ATTEMPT_ID      builder:addchoice:QUESTION_ID         review:grade:ANSWER_ID
```

## 🧪 Testing

```bash
npm run smoke          # headless test: migrations, DAO, grading, builders, locale, formatting
npm run check:locale   # verifies every t('key') in src exists in locales/ar.json
```

## 🚢 Deployment (VPS)

```bash
npm install -g pm2
npm install --omit=dev   # or plain install; better-sqlite3 builds natively on most VPSes
pm2 start src/index.js --name exams-bot
pm2 save && pm2 startup  # boot persistence
```

Daily backup cron:

```bash
0 4 * * * sqlite3 /path/to/exams-bot/data/exams.sqlite ".backup '/path/to/backups/exams-$(date +\%F).sqlite'"
```

## 🔒 Integrity notes

- Attempts, cooldowns and blacklists are enforced **server-side** at panel selection *and* at exam start.
- Question order and choice order are shuffled **once per attempt** and persisted — restarts or replays can't reshuffle an in-flight exam.
- Written answers record `shown_at` vs `answered_at`; anything under 5 seconds is flagged ⚠️ in the review queue.
- Every click verifies `interaction.user.id` matches the attempt owner.

## 🗺️ Roadmap ideas (post v1)

Pass certificate images (canvas) · web dashboard (Next.js) · recurring re-certification · adaptive difficulty · bilingual ar/en toggle (strings already externalized).
