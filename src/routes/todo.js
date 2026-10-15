/**
 * 待办事项管理接口（CRUD）
 */
const express = require('express');

const { run, get, all } = require('../db');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * 校验待办请求体
 * @param {Object} body
 * @returns {string|null}
 */
function validatePayload(body = {}) {
  const content = String(body.content || '').trim();
  if (!content) return '待办内容不能为空';
  if (content.length > 200) return '待办内容不能超过 200 字';
  return null;
}

/**
 * 转换展示结构（0/1 统一为数字）
 * @param {Object} row
 * @returns {Object}
 */
function toTodoView(row) {
  return {
    ...row,
    enable: Number(row.enable) === 1 ? 1 : 0,
    only_workday: Number(row.only_workday) === 1 ? 1 : 0,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await all('SELECT * FROM todo_item ORDER BY id ASC');
    res.json({ success: true, data: { list: rows.map(toTodoView) } });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const error = validatePayload(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { content, enable, only_workday: onlyWorkday } = req.body;
    const result = await run('INSERT INTO todo_item (content, enable, only_workday) VALUES (?, ?, ?)', [
      String(content).trim(),
      Number(enable) === 0 ? 0 : 1,
      Number(onlyWorkday) === 1 ? 1 : 0,
    ]);
    const row = await get('SELECT * FROM todo_item WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: { todo: toTodoView(row) }, message: '待办已创建' });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const exists = await get('SELECT id FROM todo_item WHERE id = ?', [id]);
    if (!exists) return res.status(404).json({ success: false, message: '待办不存在' });

    const error = validatePayload(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { content, enable, only_workday: onlyWorkday } = req.body;
    await run('UPDATE todo_item SET content = ?, enable = ?, only_workday = ? WHERE id = ?', [
      String(content).trim(),
      Number(enable) === 0 ? 0 : 1,
      Number(onlyWorkday) === 1 ? 1 : 0,
      id,
    ]);
    const row = await get('SELECT * FROM todo_item WHERE id = ?', [id]);
    res.json({ success: true, data: { todo: toTodoView(row) }, message: '待办已更新' });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const result = await run('DELETE FROM todo_item WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: '待办不存在' });
    res.json({ success: true, data: { id }, message: '待办已删除' });
  })
);

module.exports = router;
