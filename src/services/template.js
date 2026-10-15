/**
 * 固定模板渲染（推送内容模式 = template 时使用）
 * 支持 {{变量}} 与 {{变量.DATA}} 两种写法，兼容原版 Vitality-reminder 的微信模板消息模板。
 */
const { formatDate, formatDateCN, formatDateTime, diffDays, pad, isValidDateStr } = require('../utils/date');
const { DEFAULT_PUSH_TEMPLATE } = require('../config/templateSamples');

/** 未配置时统一显示的占位符 */
const PLACEHOLDER = '—';

/**
 * 解析 YYYY-MM-DD 或 MM-DD
 * @param {string} value
 * @returns {{year:number|null, month:number, day:number}|null}
 */
function parseMonthDay(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  let matched = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (matched) {
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    if (!isValidDateStr(`${year}-${pad(month)}-${pad(day)}`)) return null;
    return { year, month, day };
  }
  matched = /^(\d{1,2})-(\d{1,2})$/.exec(text);
  if (matched) {
    const month = Number(matched[1]);
    const day = Number(matched[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year: null, month, day };
  }
  return null;
}

/**
 * 拼出某个「月-日」在指定年份里的合法日期（2 月 29 日在平年回退到 2 月 28 日）
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {string} YYYY-MM-DD
 */
function safeDate(year, month, day) {
  let candidate = `${year}-${pad(month)}-${pad(day)}`;
  if (isValidDateStr(candidate)) return candidate;
  const lastDay = new Date(year, month, 0).getDate();
  candidate = `${year}-${pad(month)}-${pad(Math.min(day, lastDay))}`;
  return candidate;
}

/**
 * 距离下一个生日还有多少天，以及下一次生日是哪一年
 * @param {{month:number, day:number}} info
 * @param {Date} today
 * @returns {{days:number, year:number}}
 */
function daysUntilNextBirthday(info, today) {
  const todayStr = formatDate(today);
  let year = today.getFullYear();
  let candidate = safeDate(year, info.month, info.day);
  if (diffDays(todayStr, candidate) < 0) {
    year += 1;
    candidate = safeDate(year, info.month, info.day);
  }
  return { days: diffDays(todayStr, candidate), year };
}

/**
 * 距离下一个发薪日还有多少天
 * @param {number} payDay 每月发薪日 1~31
 * @param {Date} today
 * @returns {number}
 */
function daysUntilPayDay(payDay, today) {
  const todayStr = formatDate(today);
  let year = today.getFullYear();
  let month = today.getMonth() + 1;
  let candidate = safeDate(year, month, payDay);
  if (diffDays(todayStr, candidate) < 0) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    candidate = safeDate(year, month, payDay);
  }
  return diffDays(todayStr, candidate);
}

/**
 * 计算从开始日期到今天已经过了几个完整周年
 * @param {string} startDate YYYY-MM-DD
 * @param {Date} today
 * @returns {number|null}
 */
function fullYearsBetween(startDate, today) {
  const start = parseMonthDay(startDate);
  if (!start || !start.year) return null;
  let years = today.getFullYear() - start.year;
  if (diffDays(formatDate(today), safeDate(today.getFullYear(), start.month, start.day)) > 0) years -= 1;
  return years < 0 ? null : years;
}

/**
 * 从「每日一句」集合里随机取一条（每行一条）
 * @param {string} raw
 * @returns {string}
 */
function pickLoveMessage(raw) {
  const list = String(raw || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!list.length) return PLACEHOLDER;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 组装固定模板所需的全部变量
 * @param {Object} params
 * @param {Object} params.cfg system_config 行
 * @param {Object} params.data 通用变量（昵称 / 天气文本 / 纪念日 / 待办等）
 * @param {Object|null} params.weatherRaw 和风天气原始数据（含实时天气）
 * @param {Date} [params.now]
 * @returns {Object}
 */
function buildFixedVars({ cfg = {}, data = {}, weatherRaw = null, now = new Date() } = {}) {
  const todayStr = formatDate(now);

  // 相恋天数与周年数
  let loveDays = PLACEHOLDER;
  const loveStart = parseMonthDay(cfg.love_start_date);
  if (loveStart && loveStart.year) {
    const startStr = `${loveStart.year}-${pad(loveStart.month)}-${pad(loveStart.day)}`;
    const gap = diffDays(startStr, todayStr);
    if (gap >= 0) loveDays = String(gap + 1);
  }
  const years = fullYearsBetween(cfg.love_start_date, now);

  // 生日倒计时与「第几个生日」
  let birthdayDays = PLACEHOLDER;
  let individual = PLACEHOLDER;
  const birthdayInfo = parseMonthDay(cfg.birthday);
  if (birthdayInfo) {
    const next = daysUntilNextBirthday(birthdayInfo, now);
    birthdayDays = String(next.days);
    if (birthdayInfo.year) individual = String(next.year - birthdayInfo.year + 1);
  }

  // 发薪日倒计时
  const payDayNum = Number(cfg.pay_day || 0);
  const payDays = payDayNum >= 1 && payDayNum <= 31 ? String(daysUntilPayDay(payDayNum, now)) : PLACEHOLDER;

  // 天气四件套
  const nowWeather = (weatherRaw && weatherRaw.now) || {};
  const hasTemp = nowWeather.temp !== undefined && nowWeather.temp !== null && nowWeather.temp !== '';
  const wind = nowWeather.windDir
    ? `${nowWeather.windDir}${nowWeather.windScale ? `${nowWeather.windScale}级` : ''}`
    : PLACEHOLDER;

  return {
    ...data,
    dateTime: formatDateCN(now),
    date: todayStr,
    time: formatDateTime(now),
    love: loveDays,
    anniversary: years === null ? PLACEHOLDER : String(years),
    birthday: birthdayDays,
    individual,
    pay: payDays,
    city: (weatherRaw && weatherRaw.cityName) || PLACEHOLDER,
    weather: nowWeather.text || PLACEHOLDER,
    temp: hasTemp ? String(nowWeather.temp) : PLACEHOLDER,
    humidity: nowWeather.humidity ? String(nowWeather.humidity) : PLACEHOLDER,
    wind,
    message: pickLoveMessage(cfg.love_message),
  };
}

/**
 * 渲染固定模板：{{变量}} 与 {{变量.DATA}} 均替换为真实值，未知变量替换为空串
 * @param {string} template 模板内容
 * @param {Object} vars 变量表
 * @returns {string}
 */
function renderFixedTemplate(template, vars = {}) {
  const source = String(template || '').trim() ? String(template) : DEFAULT_PUSH_TEMPLATE;
  return source.replace(/\{\{\s*([\w]+)\s*(?:\.\s*([\w]+)\s*)?\}\}/g, (match, key) => {
    const value = vars[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

module.exports = { buildFixedVars, renderFixedTemplate, PLACEHOLDER };

