/**
 * HeartCron 心时 —— 后端服务入口
 * Cron调度时间，心意准时抵达。
 *
 * 启动流程：
 *   1. 加载 .env 环境变量
 *   2. 连接 MySQL 并初始化数据库（建表 + 预置默认配置）
 *   3. 注册 Express 中间件与 REST API 路由
 *   4. 托管前端打包产物 frontend/dist
 *   5. 读取 remind_task 表，注册全部定时任务
 */
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const config = require('./src/config');
const logger = require('./src/utils/logger');
const { initDatabase, ensureDatabase } = require('./src/db');
const apiRoutes = require('./src/routes');
const { pageRouter: installPageRouter, apiRouter: installApiRouter } = require('./src/routes/install');
const { reloadSchedules } = require('./src/services/scheduler');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');

/**
 * 托管前端静态资源，并为前端单页应用（history 模式路由）做 fallback
 * @param {import('express').Express} app
 */
function mountWebApp(app) {
  if (!fs.existsSync(config.webDistDir)) {
    // 前端未打包时，所有页面请求都返回一份可执行的排查提示，避免直接 404 让人摸不着头脑
    app.get(/^\/(?!api\/).*/, (req, res) => {
      res.status(503).type('html').send(renderNotBuiltPage());
    });
    logger.error('未找到前端构建产物，页面无法显示：' + config.webDistDir);
    logger.error('解决办法：在项目根目录执行 npm run build（会自动安装前端依赖并打包），然后重启服务');
    return;
  }

  app.use(express.static(config.webDistDir, { index: 'index.html' }));
  // 非 /api 开头的 GET 请求一律交给前端路由处理
  app.get(/^\/(?!api\/|install|healthz).*/, (req, res, next) => {
    const indexFile = require('path').join(config.webDistDir, 'index.html');
    res.sendFile(indexFile, (err) => (err ? next(err) : undefined));
  });
  logger.info('前端静态资源已托管：' + config.webDistDir);
}

/**
 * 前端构建产物缺失时的提示页（把 404 变成能照着做的下一步）
 * @returns {string} HTML
 */
function renderNotBuiltPage() {
  return [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>HeartCron 心时 · 前端尚未构建</title>',
    '<style>',
    'body{margin:0;padding:40px 20px;background:#fff5f7;color:#303133;font-family:"PingFang SC","Microsoft YaHei",Arial,sans-serif;line-height:1.8}',
    'main{max-width:760px;margin:0 auto;background:#fff;border-radius:14px;padding:28px 30px;box-shadow:0 10px 34px rgba(0,0,0,.07)}',
    'h1{font-size:20px;margin:0 0 6px}p{margin:0 0 14px}code{background:#f5f7fa;padding:2px 6px;border-radius:4px}',
    'pre{background:#282c34;color:#e6e6e6;padding:14px 16px;border-radius:10px;overflow:auto}',
    '.tip{color:#909399;font-size:13px}',
    '</style></head><body><main>',
    '<h1>后端已经跑起来了，但前端页面还没构建</h1>',
    '<p>当前访问的是后端服务，接口与安装向导 <code>/install</code> 都是正常的，只是管理后台的静态页面（<code>frontend/dist</code>）不存在。</p>',
    '<p>在<strong>项目根目录</strong>执行下面这一条命令即可修复，然后重启服务：</p>',
    '<pre>npm run build</pre>',
    '<p class="tip">该命令等价于 <code>cd frontend &amp;&amp; npm install &amp;&amp; npm run build</code>，会把管理后台打包到 <code>frontend/dist</code>。</p>',
    '<p class="tip">如果服务器内存较小、打包失败，可以在本地执行 <code>npm run build</code>，再把整个 <code>frontend/dist</code> 目录上传到服务器同一位置。</p>',
    '<p class="tip">PM2 用户改完记得重启：<code>pm2 restart heartcron</code></p>',
    '<p class="tip">构建产物路径：' + config.webDistDir + '</p>',
    '<p class="tip">健康检查：<a href="/healthz">/healthz</a> ｜ 安装向导：<a href="/install">/install</a></p>',
    '</main></body></html>',
  ].join('');
}

async function bootstrap() {
  // 未安装时不初始化数据库，由网页安装向导完成建表与初始配置
  if (config.isInstalled()) {
    try {
      await ensureDatabase();
      await initDatabase();
    } catch (err) {
      logger.error('数据库连接失败：' + err.message);
      logger.error(
        '请检查 .env 中的 MySQL 配置（DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME）；' +
          '如需重新配置，删除 data/install.lock 与 .env 后重启服务，再访问 /install'
      );
      throw err;
    }
  } else {
    logger.warn('系统尚未安装：请在浏览器访问 /install 完成安装向导');
  }

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  // 未安装时引导到网页安装向导：除安装页与健康检查外，全部请求重定向到 /install
  app.use((req, res, next) => {
    if (config.isInstalled()) return next();
    const currentPath = req.path;
    if (currentPath === '/install' || currentPath.startsWith('/api/install') || currentPath === '/healthz') {
      return next();
    }
    if (currentPath.startsWith('/api')) {
      return res.status(503).json({
        success: false,
        code: 'NOT_INSTALLED',
        message: '系统尚未安装，请先访问 /install 完成安装',
      });
    }
    return res.redirect('/install');
  });

  // 安装向导（页面与接口均免登录）
  app.use('/install', installPageRouter);
  app.use('/api/install', installApiRouter);

  app.use(
    session({
      name: 'heartcron.sid',
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: config.session.maxAge,
      },
    })
  );

  // 健康检查（无需登录）
  app.get('/healthz', (req, res) => {
    res.json({ ok: true, name: 'HeartCron 心时', time: new Date().toISOString() });
  });

  app.use('/api', apiRoutes);
  mountWebApp(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(config.port, () => {
    logger.info(`HeartCron 心时 服务已启动：http://localhost:${config.port}`);
    logger.info(`数据库连接：${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`);
    if (config.isInstalled()) {
      logger.info(`管理后台：http://<服务器IP或域名>:${config.port}（用宝塔/Nginx 反代时请访问你的域名）`);
    } else {
      logger.info(`请打开安装向导完成初始化：http://<服务器IP或域名>:${config.port}/install`);
    }
  });

  // 服务启动后加载全部启用的定时任务（未安装时跳过，安装完成后会自动加载）
  if (config.isInstalled()) await reloadSchedules();
}

bootstrap().catch((err) => {
  logger.error('服务启动失败：' + (err && err.stack ? err.stack : err));
  process.exit(1);
});

// 兜底：避免未捕获异常导致进程静默退出
process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 异常：' + (reason && reason.stack ? reason.stack : reason));
});
