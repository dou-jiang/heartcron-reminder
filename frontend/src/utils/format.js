/**
 * 前端通用格式化工具
 */

/**
 * 把 ISO 时间字符串格式化为本地时间
 * @param {string} iso ISO 时间字符串
 * @returns {string}
 */
export function formatDateTime(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 文案摘要：超长内容截断
 * @param {string} text
 * @param {number} length
 * @returns {string}
 */
export function truncate(text, length = 40) {
  const str = String(text || '');
  return str.length > length ? `${str.slice(0, length)}...` : str;
}

/**
 * 距今倒计时的中文描述
 * @param {number|null} days
 * @returns {string}
 */
export function describeDaysLeft(days) {
  if (days === null || days === undefined) return '-';
  if (days === 0) return '就是今天';
  if (days > 0) return `还有 ${days} 天`;
  return `已过去 ${Math.abs(days)} 天`;
}
