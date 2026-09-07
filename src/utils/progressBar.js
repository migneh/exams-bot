/**
 * Render a text progress bar: ▰▰▰▱▱ 3/5
 */
function progressBar(current, total, length = 10) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const cur = Math.max(0, Math.min(Number(current) || 0, safeTotal));
  const filled = Math.round((cur / safeTotal) * length);
  return '▰'.repeat(filled) + '▱'.repeat(length - filled);
}

function progressBarLine(current, total, length = 10) {
  return `${progressBar(current, total, length)}  **${current}/${total}**`;
}

module.exports = { progressBar, progressBarLine };
