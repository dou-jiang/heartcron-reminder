/**
 * 定时任务调度：使用 node-schedule 注册 cron 任务
 * 服务启动与任务变更（增删改/启停）后都会重新加载全部任务
 */
const schedule = require('node-schedule');
const parser = require('cron-parser');

const config = require('../config');
const logger = require('../utils/logger');
const { all } = require('../db');
const { runPushFlow } = require('./push');

/** @type {Map<number, import('node-schedule').Job>} 已注册任务：taskId -> Job */
const jobs = new Map();

/**
 * 校验 cron 表达式是否合法（标准 6 位：秒 分 时 日 月 周）
 * @param {string} expr
 * @returns {boolean}
 */
function isValidCron(expr) {
  if (!expr || typeof expr !== 'string') return false;
  try {
    parser.parseExpression(expr, { tz: config.timezone });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * 计算下一次执行时间（ISO 字符串），表达式非法时返回 null
 * @param {string} expr
 * @returns {string|null}
 */
function nextRunTime(expr) {
  try {
    const interval = parser.parseExpression(expr, { tz: config.timezone });
    return interval.next().toDate().toISOString();
  } catch (err) {
    return null;
  }
}

/**
 * 注册单个定时任务
 * @param {Object} task remind_task 记录
 * @returns {boolean} 是否注册成功
 */
function registerTask(task) {
  if (!isValidCron(task.cron_expr)) {
    logger.warn(`任务 #${task.id}「${task.task_name}」cron 表达式非法，已跳过：${task.cron_expr}`);
    return false;
  }

  const job = schedule.scheduleJob({ rule: task.cron_expr, tz: config.timezone }, () => {
    logger.info(`定时任务触发：#${task.id}「${task.task_name}」`);
    runPushFlow({ taskId: task.id, period: task.push_time_period, source: 'schedule' }).catch((err) => {
      logger.error(`定时任务 #${task.id} 执行异常：${err.message}`);
    });
  });

  if (!job) {
    logger.warn(`任务 #${task.id}「${task.task_name}」注册失败：${task.cron_expr}`);
    return false;
  }

  jobs.set(task.id, job);
  return true;
}

/**
 * 取消全部已注册任务
 */
function cancelAll() {
  jobs.forEach((job) => job.cancel());
  jobs.clear();
}

/**
 * 重新加载全部启用的定时任务（程序重启或任务配置变更后调用）
 * @returns {Promise<number>} 成功注册的任务数量
 */
async function reloadSchedules() {
  cancelAll();

  const tasks = await all('SELECT * FROM remind_task WHERE enable = 1');
  let registered = 0;
  tasks.forEach((task) => {
    if (registerTask(task)) registered += 1;
  });

  logger.info(`定时任务加载完成：启用 ${tasks.length} 个，成功注册 ${registered} 个`);
  return registered;
}

/**
 * 当前已注册任务数量
 * @returns {number}
 */
function getJobCount() {
  return jobs.size;
}

module.exports = { isValidCron, nextRunTime, registerTask, cancelAll, reloadSchedules, getJobCount };
