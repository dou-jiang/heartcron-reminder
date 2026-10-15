/**
 * 定时任务管理接口（CRUD）
 * GET    /api/task       任务列表（含下次执行时间）
 * POST   /api/task       新增任务
 * PUT    /api/task/:id   修改任务
 * DELETE /api/task/:id   删除任务
 */
const express = require('express');

const { run, get, all } = require('../db');
const { PUSH_TIME_PERIODS } = require('../config/constants');
const { isValidCron, nextRunTime, reloadSchedules } = require('../services/scheduler');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * 校验任务请求体
 * @param {Object} body
 * @returns {string|null} 错误信息，null 表示校验通过
 */
function validateTaskPayload(body = {}) {
  const taskName = String(body.task_name || '').trim();
  const cronExpr = String(body.cron_expr || '').trim();

  if (!taskName) return '任务名称不能为空';
  if (!cronExpr) return 'cron 表达式不能为空';
  if (!isValidCron(cronExpr)) {
    return 'cron 表达式不合法，请使用标准 6 位格式（秒 分 时 日 月 周），例如 0 30 9 * * *';
  }
  if (body.push_time_period && !PUSH_TIME_PERIODS.includes(body.push_time_period)) {
    return `推送时段必须是：${PUSH_TIME_PERIODS.join(' / ')}`;
  }
  return null;
}

/**
 * 把任务记录转换成前端展示结构
 * @param {Object} row
 * @returns {Object}
 */
function toTaskView(row) {
  return {
    ...row,
    enable: Number(row.enable) === 1 ? 1 : 0,
    next_run: Number(row.enable) === 1 ? nextRunTime(row.cron_expr) : null,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await all('SELECT * FROM remind_task ORDER BY id ASC');
    res.json({ success: true, data: { list: rows.map(toTaskView) } });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const error = validateTaskPayload(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { task_name: taskName, cron_expr: cronExpr, push_time_period: period, enable, remark } = req.body;
    const result = await run(
      'INSERT INTO remind_task (task_name, cron_expr, push_time_period, enable, remark) VALUES (?, ?, ?, ?, ?)',
      [String(taskName).trim(), String(cronExpr).trim(), period || PUSH_TIME_PERIODS[0], Number(enable) === 0 ? 0 : 1, String(remark || '')]
    );
    await reloadSchedules();

    const row = await get('SELECT * FROM remind_task WHERE id = ?', [result.lastID]);
    res.json({ success: true, data: { task: toTaskView(row) }, message: '任务已创建' });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const exists = await get('SELECT id FROM remind_task WHERE id = ?', [id]);
    if (!exists) return res.status(404).json({ success: false, message: '任务不存在' });

    const error = validateTaskPayload(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { task_name: taskName, cron_expr: cronExpr, push_time_period: period, enable, remark } = req.body;
    await run(
      `UPDATE remind_task
          SET task_name = ?, cron_expr = ?, push_time_period = ?, enable = ?, remark = ?
        WHERE id = ?`,
      [String(taskName).trim(), String(cronExpr).trim(), period || PUSH_TIME_PERIODS[0], Number(enable) === 0 ? 0 : 1, String(remark || ''), id]
    );
    await reloadSchedules();

    const row = await get('SELECT * FROM remind_task WHERE id = ?', [id]);
    res.json({ success: true, data: { task: toTaskView(row) }, message: '任务已更新' });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const result = await run('DELETE FROM remind_task WHERE id = ?', [id]);
    if (!result.changes) return res.status(404).json({ success: false, message: '任务不存在' });
    await reloadSchedules();
    res.json({ success: true, data: { id }, message: '任务已删除' });
  })
);

module.exports = router;
