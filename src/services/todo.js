/**
 * 待办事项工具：按启用状态与「仅工作日」规则筛选，拼接为 {{todo_list}} 文本
 */
const { isWeekend } = require('../utils/date');

/** 没有任何待办时返回的占位文本（供 AI 提示词与备用文案判断使用） */
const EMPTY_TODO_TEXT = '今日暂无待办';

/**
 * 生成今日待办文本
 * @param {Array<Object>} todoRows todo_item 表记录
 * @param {Date} [today] 参考日期，默认今天
 * @returns {string}
 */
function getTodoList(todoRows = [], today = new Date()) {
  const weekend = isWeekend(today);

  const contents = todoRows
    .filter((row) => Number(row.enable) === 1)
    // 「仅工作日推送」的待办在周末自动跳过
    .filter((row) => !(Number(row.only_workday) === 1 && weekend))
    .map((row) => String(row.content || '').trim())
    .filter(Boolean);

  return contents.length ? contents.join('；') : EMPTY_TODO_TEXT;
}

module.exports = { getTodoList, EMPTY_TODO_TEXT };
