/**
 * 日期工具：日期格式化、工作日判断、天数差计算
 * 全部基于「本地日期字符串」计算，避免时区偏移导致的误差
 */

const WEEK_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/**
 * 数字补零
 * @param {number} n
 * @returns {string}
 */
function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * 格式化为 YYYY-MM-DD
 * @param {Date} [date]
 * @returns {string}
 */
function formatDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 格式化为 YYYY-MM-DD HH:mm:ss
 * @param {Date} [date]
 * @returns {string}
 */
function formatDateTime(date = new Date()) {
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 格式化为中文日期，如 2026年10月15日 星期四
 * @param {Date} [date]
 * @returns {string}
 */
function formatDateCN(date = new Date()) {
  return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${WEEK_CN[date.getDay()]}`;
}

/**
 * 是否为周末（周六 / 周日）
 * @param {Date} [date]
 * @returns {boolean}
 */
function isWeekend(date = new Date()) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * 校验 YYYY-MM-DD 日期字符串是否合法
 * @param {string} value
 * @returns {boolean}
 */
function isValidDateStr(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * 计算两个日期字符串相差的天数（to - from）
 * @param {string} fromDate YYYY-MM-DD
 * @param {string} toDate YYYY-MM-DD
 * @returns {number}
 */
function diffDays(fromDate, toDate) {
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

/**
 * 计算某个纪念日距离今天的下一个周年（同月同日）
 * @param {string} targetDate YYYY-MM-DD
 * @param {Date} [today]
 * @returns {string} 下一个周年的 YYYY-MM-DD
 */
function nextAnniversaryDate(targetDate, today = new Date()) {
  const [, m, d] = targetDate.split('-').map(Number);
  const todayStr = formatDate(today);
  let candidate = `${today.getFullYear()}-${pad(m)}-${pad(d)}`;
  if (diffDays(todayStr, candidate) < 0) {
    candidate = `${today.getFullYear() + 1}-${pad(m)}-${pad(d)}`;
  }
  return candidate;
}

module.exports = {
  WEEK_CN,
  pad,
  formatDate,
  formatDateTime,
  formatDateCN,
  isWeekend,
  isValidDateStr,
  diffDays,
  nextAnniversaryDate,
};
