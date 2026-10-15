/**
 * 推送日志接口
 * GET /api/log?page=1&size=10  分页查询推送日志（按时间倒序）
 */
const express = require('express');

const { get, all } = require('../db');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/** 单页最大条数，避免一次性拉取过多数据 */
const MAX_PAGE_SIZE = 100;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.size) || 10));
    const offset = (page - 1) * size;

    const totalRow = await get('SELECT COUNT(*) AS total FROM push_log');
    const list = await all(
      `SELECT l.*, t.task_name
         FROM push_log l
         LEFT JOIN remind_task t ON t.id = l.task_id
        ORDER BY l.id DESC
        LIMIT ? OFFSET ?`,
      [size, offset]
    );

    res.json({
      success: true,
      data: {
        total: totalRow ? totalRow.total : 0,
        page,
        size,
        list: list.map((row) => ({ ...row, status: Number(row.status) === 1 ? 1 : 0 })),
      },
    });
  })
);

module.exports = router;
