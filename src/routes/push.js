/**
 * 推送相关接口
 * POST /api/test-push  【一键测试推送】手动执行完整链路：天气 → AI 生成 → WxPusher 推送
 * GET  /api/meta       返回前端下拉选项、时区、已注册任务数等元信息
 */
const express = require('express');

const config = require('../config');
const { runPushFlow, collectPromptData } = require('../services/push');
const { getJobCount } = require('../services/scheduler');
const { get, all } = require('../db');
const { PUSH_TIME_PERIODS, STYLE_TYPES, PUSH_MODES, DEFAULT_PUSH_TITLE, DEFAULT_PUSH_MODE } = require('../config/constants');
const { buildFixedVars, renderFixedTemplate } = require('../services/template');
const { renderPromptTemplate } = require('../services/prompt');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/meta',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        appName: 'HeartCron 心时',
        slogan: 'Cron调度时间，心意准时抵达。',
        version: require('../../package.json').version,
        timezone: config.timezone,
        pushTimePeriods: PUSH_TIME_PERIODS,
        styleTypes: STYLE_TYPES,
        pushModes: PUSH_MODES,
        runningJobs: getJobCount(),
        now: new Date().toISOString(),
      },
    });
  })
);

router.post(
  '/test-push',
  asyncHandler(async (req, res) => {
    const { task_id: taskId, push_time_period: period, style_type: styleType } = req.body || {};

    const result = await runPushFlow({
      taskId: taskId === undefined || taskId === null || taskId === '' ? null : Number(taskId),
      period: period || '',
      styleType: styleType || '',
      source: 'manual',
    });

    res.json({
      success: true,
      data: result,
      message: result.success ? '测试推送成功' : '测试推送失败：' + result.errorMsg,
    });
  })
);

/**
 * 仪表盘今日预览：不推送，只组装一次当前会用于生成的变量
 */
router.get(
  '/preview',
  asyncHandler(async (req, res) => {
    const { cfg, data, weatherRaw } = await collectPromptData({ period: '', styleType: '' });
    const pushMode = cfg.push_mode === 'template' ? 'template' : DEFAULT_PUSH_MODE;
    // 固定模板模式下顺便渲染一份预览，方便仪表盘直接看到最终推送内容
    const previewContent =
      pushMode === 'template' ? renderFixedTemplate(cfg.push_template, buildFixedVars({ cfg, data, weatherRaw })) : '';
    const taskRow = await get('SELECT COUNT(*) AS total FROM remind_task');
    const enableTaskRow = await get('SELECT COUNT(*) AS total FROM remind_task WHERE enable = 1');
    const anniversaryRow = await get('SELECT COUNT(*) AS total FROM anniversary WHERE enable = 1');
    const todoRow = await get('SELECT COUNT(*) AS total FROM todo_item WHERE enable = 1');
    const logs = await all('SELECT * FROM push_log ORDER BY id DESC LIMIT 5');

    res.json({
      success: true,
      data: {
        ...data,
        push_mode: pushMode,
        preview_title: renderPromptTemplate(cfg.wx_pusher_title || DEFAULT_PUSH_TITLE, data),
        preview_content: previewContent,
        stats: {
          taskTotal: taskRow ? taskRow.total : 0,
          taskEnabled: enableTaskRow ? enableTaskRow.total : 0,
          anniversaryEnabled: anniversaryRow ? anniversaryRow.total : 0,
          todoEnabled: todoRow ? todoRow.total : 0,
          runningJobs: getJobCount(),
        },
        recentLogs: logs.map((row) => ({ ...row, status: Number(row.status) === 1 ? 1 : 0 })),
      },
    });
  })
);

module.exports = router;
