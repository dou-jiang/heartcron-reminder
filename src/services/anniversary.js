/**
 * 纪念日工具：计算倒计时并拼接为 {{anniversary_list}} 文本
 */
const { formatDate, isValidDateStr, diffDays, nextAnniversaryDate } = require('../utils/date');

/** 没有任何纪念日时返回的占位文本（供 AI 提示词与备用文案判断使用） */
const EMPTY_ANNIVERSARY_TEXT = '暂无纪念日';

/**
 * 生成纪念日倒计时列表文本
 * @param {Array<Object>} anniversaryRows anniversary 表记录
 * @param {Date} [today] 参考日期，默认今天
 * @returns {string}
 */
function calcAnniversaryList(anniversaryRows = [], today = new Date()) {
  const todayStr = formatDate(today);
  const parts = [];

  anniversaryRows
    .filter((row) => Number(row.enable) === 1 && isValidDateStr(row.target_date))
    .forEach((row) => {
      const name = row.name || '纪念日';
      const days = diffDays(todayStr, row.target_date);

      if (days === 0) {
        parts.push(`今天是${name}`);
        return;
      }
      // 未开启倒计时展示的日子不参与文案生成
      if (Number(row.show_countdown) !== 1) return;

      if (days > 0) {
        parts.push(`距离${name}还有 ${days} 天`);
      } else {
        const nextDate = nextAnniversaryDate(row.target_date, today);
        const nextDays = diffDays(todayStr, nextDate);
        parts.push(`${name}已过去 ${Math.abs(days)} 天（距下一个周年还有 ${nextDays} 天）`);
      }
    });

  return parts.length ? parts.join('；') : EMPTY_ANNIVERSARY_TEXT;
}

module.exports = { calcAnniversaryList, EMPTY_ANNIVERSARY_TEXT };
