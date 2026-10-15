/**
 * 安装向导路由
 * 页面：GET /install（免登录，未安装时其他地址会自动跳转到此页）
 * 接口：GET  /api/install/status  安装状态 + 环境检测
 *      POST /api/install/check   重新执行环境检测
 *      POST /api/install/test-db 测试 MySQL 连接（向导第 2 步「测试连接」）
 *      POST /api/install/run     执行安装
 */
const fs = require('fs');
const express = require('express');

const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const { getInstallStatus, performInstall, runEnvironmentChecks, testDatabase } = require('../services/installer');

/** 安装页面路由（挂载到 /install） */
const pageRouter = express.Router();

pageRouter.get('/', (req, res) => {
  if (!fs.existsSync(config.installPageFile)) {
    return res.status(500).type('html').send('<h1>安装页面缺失</h1><p>未找到 public/install.html</p>');
  }
  res.sendFile(config.installPageFile);
});

/** 安装接口路由（挂载到 /api/install） */
const apiRouter = express.Router();

apiRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getInstallStatus() });
  })
);

apiRouter.post(
  '/check',
  asyncHandler(async (req, res) => {
    if (config.isInstalled()) {
      return res.status(403).json({ success: false, message: '系统已安装，如需重新安装请删除 data/install.lock' });
    }
    res.json({ success: true, data: { checks: await runEnvironmentChecks() } });
  })
);

apiRouter.post(
  '/test-db',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await testDatabase(req.body || {}) });
  })
);

apiRouter.post(
  '/run',
  asyncHandler(async (req, res) => {
    const result = await performInstall(req.body || {});
    res.json({ success: true, data: result, message: '安装完成' });
  })
);

module.exports = { pageRouter, apiRouter };
