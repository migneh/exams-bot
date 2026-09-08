const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
require('dayjs/locale/ar');
dayjs.extend(relativeTime);
dayjs.locale('ar');

/** "5 د 30 ث" style short Arabic duration. */
function fmtDurationAr(msLeft) {
  const total = Math.max(0, Math.floor((msLeft || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (h) parts.push(`${h} س`);
  if (m) parts.push(`${m} د`);
  if (!h && (s || parts.length === 0)) parts.push(`${s} ث`);
  return parts.join(' ');
}

/** "2026/09/07 15:30" (server timezone). */
function fmtDate(ts) {
  if (!ts) return '—';
  return dayjs(ts).format('YYYY/MM/DD HH:mm');
}

/** "السبت 7 سبتمبر 2026 15:30" */
function fmtDateLong(ts) {
  if (!ts) return '—';
  return dayjs(ts).format('dddd D MMMM YYYY HH:mm');
}

/** "منذ 5 دقائق" style relative label. */
function fmtFromNow(ts) {
  if (!ts) return '—';
  return dayjs(ts).fromNow
    ? dayjs(ts).fromNow()
    : fmtDurationAr(Date.now() - ts);
}

module.exports = { dayjs, fmtDurationAr, fmtDate, fmtDateLong, fmtFromNow };
