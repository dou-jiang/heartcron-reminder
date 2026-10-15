/**
 * 纪念日管理接口（CRUD）
 */
const express = require('express');

const { run, get, all } = require('../db');
const { isValidDateStr, diffDays, formatDate } = require('../utils/date');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * 校验纪念日请求体
 * @param {Object} body
 * @returns {string|null}
 */
function validatePayload(body = {}) {
  const name = String(body.name || '').trim();
  const targetDate = String(body.target_date || '').trim();
  if (!name) return '纪念日名称不能为空';
  if (!isValidDateStr(targetDate)) return '日期格式必须为 YYYY-MM-DD';
  return null;
}

/**
 * 补充「距今天数」字段，方便前端直接展示
 * @param {Object} row
 * @returns {Object}
 */
function toAnniversaryView(row) {
  const days = isValidDateStr(row.target_date) ? diffDays(formatDate(), row.target_date) : null;
  return {
    ...row,
    enable: Number(row.enable) === 1 ? 1 : 0,
    show_countdown: Number(row.show_countdown) === 1 ? 1 : 0,
    days_left: days,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await all('SELECT * FROM anniversary ORDER BY target_date ASC, id ASC');
    res.json({ success: true, data: { list: rows.map(toAnniversaryView) } });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const error = validatePayload(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { name, target_date: targetDate, enable, show_countdown: showCountdown } = req.body;
    const result = await run(
      'INSERT INTO anniversary (name, target_date, enable, show_countdown) VALUES (?, ?, ?, ?)',
      [String(name).trim(), targetDate, Number(enable) === 0 ? 0 : 1, Number(showCountdown) === 0 ? 0 : 1]
    );
    const row = await get('SELECT * FROM anniversary WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: { anniversary: toAnniversaryView(row) }, message: '纪念日已创建' });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const exists = await get('SELECT id FROM anniversary WHERE id = ?', [id]);
    if (!exists) return res.status(404).json({ success: false, message: '纪念日不存在' });

    const error = validatePayload(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { name, target_date: targetDate, enable, show_countdown: showCountdown } = req.body;
    await run(
      'UPDATE anniversary SET name = ?, target_date = ?, enable = ?, show_countdown = ? WHERE id = ?',
      [String(name).trim(), targetDate, Number(enable) === 0 ? 0 : 1, Number(showCountdown) === 0 ? 0 : 1, id]
    );
    const row = await get('SELECT * FROM anniversary WHERE id = ?', [id]);
    res.json({ success: true, data: { anniversary: toAnniversaryView(row) }, message: '纪念日已更新' });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const result = await run('DELETE FROM anniversary WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: '纪念日不存在' });
    res.json({ success: true, data: { id }, message: '纪念日已删除' });
  })
);

module.exports = router;
