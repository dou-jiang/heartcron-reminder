/**
 * cron 表达式工具（标准 6 位：秒 分 时 日 月 周）
 * 说明：需求文档建议使用 vue3-cron 可视化组件，但该包发布产物缺少入口文件
 *      （package.json main 指向 lib/vue3Cron.umd.js，实际未随包发布），
 *      因此这里实现等价的本地可视化编辑器 CronPicker，直接产出标准 6 位表达式。
 */

/** 星期中文名（0=周日，与标准 cron 一致） */
export const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 字段定义，顺序与表达式一致 */
export const CRON_FIELDS = [
  { key: 'second', label: '秒', min: 0, max: 59 },
  { key: 'minute', label: '分', min: 0, max: 59 },
  { key: 'hour', label: '时', min: 0, max: 23 },
  { key: 'day', label: '日', min: 1, max: 31 },
  { key: 'month', label: '月', min: 1, max: 12 },
  { key: 'week', label: '周', min: 0, max: 6, names: WEEK_NAMES },
];

/** 常用表达式快捷选项 */
export const CRON_PRESETS = [
  { label: '每天 09:30', value: '0 30 9 * * *' },
  { label: '每天 12:30', value: '0 30 12 * * *' },
  { label: '每天 22:00', value: '0 0 22 * * *' },
  { label: '工作日 08:30', value: '0 30 8 * * 1-5' },
  { label: '每周日 20:00', value: '0 0 20 * * 0' },
  { label: '每月 5 号 10:00', value: '0 0 10 5 * *' },
];

/**
 * 校验单个字段片段是否合法
 * @param {string} segment 字段片段
 * @param {Object} field 字段定义
 * @returns {boolean}
 */
function isValidSegment(segment, field) {
  if (segment === '*' || segment === '?') return true;
  if (segment === 'L') return field.key === 'day';
  return segment.split(',').every((item) => {
    const [range, step] = item.split('/');
    if (step !== undefined && (!/^\d+$/.test(step) || Number(step) <= 0)) return false;
    if (range === '*') return true;
    const [from, to] = range.split('-');
    const nums = [from, to].filter((v) => v !== undefined);
    return nums.every((v) => /^\d+$/.test(v) && Number(v) >= field.min && Number(v) <= field.max);
  });
}

/**
 * 校验标准 6 位 cron 表达式
 * @param {string} expr
 * @returns {boolean}
 */
export function validateCron(expr) {
  const segments = String(expr || '').trim().split(/\s+/);
  if (segments.length !== 6) return false;
  return segments.every((segment, index) => isValidSegment(segment, CRON_FIELDS[index]));
}

/**
 * 把字段状态数组拼成 cron 表达式
 * @param {Array<{mode:string, value:number, from:number, to:number, step:number, specific:number[]}>} fields
 * @returns {string}
 */
export function buildCron(fields) {
  return fields
    .map((field) => {
      switch (field.mode) {
        case 'specific':
          return field.specific && field.specific.length ? [...field.specific].sort((a, b) => a - b).join(',') : '*';
        case 'range':
          return `${field.from}-${field.to}`;
        case 'step':
          return `${field.from}-${field.to}/${field.step}`;
        case 'last':
          return 'L';
        case 'every':
        default:
          return '*';
      }
    })
    .join(' ');
}

/**
 * 解析 cron 表达式为字段状态数组，无法解析时返回 null
 * @param {string} expr
 * @returns {Array|null}
 */
export function parseCron(expr) {
  const segments = String(expr || '').trim().split(/\s+/);
  if (segments.length !== 6) return null;

  const result = [];
  for (let index = 0; index < CRON_FIELDS.length; index += 1) {
    const field = CRON_FIELDS[index];
    const segment = segments[index];
    const state = { mode: 'every', value: field.min, from: field.min, to: field.max, step: 1, specific: [] };

    if (segment === '*') {
      state.mode = 'every';
    } else if (segment === 'L' && field.key === 'day') {
      state.mode = 'last';
    } else if (/^\d+$/.test(segment)) {
      state.mode = 'specific';
      state.specific = [Number(segment)];
    } else if (/^[\d,]+$/.test(segment)) {
      state.mode = 'specific';
      state.specific = segment.split(',').map(Number);
    } else if (/^\d+-\d+$/.test(segment)) {
      const [from, to] = segment.split('-').map(Number);
      state.mode = 'range';
      state.from = from;
      state.to = to;
    } else if (/^\d+-\d+\/\d+$/.test(segment)) {
      const [range, step] = segment.split('/');
      const [from, to] = range.split('-').map(Number);
      state.mode = 'step';
      state.from = from;
      state.to = to;
      state.step = Number(step);
    } else {
      return null;
    }
    result.push(state);
  }
  return result;
}

/**
 * 生成 cron 表达式的中文描述
 * @param {string} expr
 * @returns {string}
 */
export function describeCron(expr) {
  if (!validateCron(expr)) return '表达式不合法';
  const [second, minute, hour, day, month, week] = String(expr).trim().split(/\s+/);
  const pad = (v) => String(v).padStart(2, '0');
  const isNum = (v) => /^\d+$/.test(v);
  const timeText = isNum(second) && isNum(minute) && isNum(hour) ? `${pad(hour)}:${pad(minute)}:${pad(second)}` : '';

  if (day === '*' && month === '*' && week === '*') {
    if (timeText) return `每天 ${timeText}`;
    if (isNum(minute) && hour === '*') return `每小时第 ${minute} 分`;
    if (minute === '*' && hour === '*') return '每分钟执行';
    return `每小时按表达式执行（${expr}）`;
  }
  if (day === '*' && month === '*' && isNum(week)) {
    return timeText ? `每${WEEK_NAMES[Number(week)]} ${timeText}` : `每${WEEK_NAMES[Number(week)]}执行`;
  }
  if (day === '*' && month === '*' && /^\d-\d$/.test(week)) {
    const [from, to] = week.split('-').map(Number);
    return timeText ? `每${WEEK_NAMES[from]}至${WEEK_NAMES[to]} ${timeText}` : `${WEEK_NAMES[from]}至${WEEK_NAMES[to]}执行`;
  }
  if (isNum(day) && month === '*') {
    return timeText ? `每月 ${day} 号 ${timeText}` : `每月 ${day} 号执行`;
  }
  if (day === 'L' && month === '*') {
    return timeText ? `每月最后一天 ${timeText}` : '每月最后一天执行';
  }
  return `按表达式执行：${expr}`;
}

/**
 * 生成默认字段状态（每天 09:30:00）
 * @returns {Array}
 */
export function createDefaultFieldStates() {
  const states = parseCron('0 30 9 * * *');
  return states || CRON_FIELDS.map((field) => ({ mode: 'every', value: field.min, from: field.min, to: field.max, step: 1, specific: [] }));
}
