/**
 * HeartCron 心时 —— 后端服务入口
 * Cron调度时间，心意准时抵达。
 *
 * 启动流程：
 *   1. 加载 .env 环境变量
 *   2. 初始化 SQLite 数据库（建表 + 预置默认配置）
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
const { initDatabase } = require('./src/db');
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
    // 前端未打包时给出明确提示，方便本地开发时只跑后端接口
    app.get('/', (req, res) => {
      res.type('html').send(
        '<h1>HeartCron 心时</h1>' +
          '<p>前端尚未构建。请在 frontend 目录执行 <code>npm install && npm run build</code>，' +
          '或在 frontend 目录执行 <code>npm run dev</code> 使用 Vite 开发服务器。</p>'
      );
    });
    logger.warn('未找到前端构建产物，跳过静态资源托管：' + config.webDistDir);
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

async function bootstrap() {
  // 未安装时不初始化数据库，由网页安装向导完成建表与初始配置
  if (config.isInstalled()) {
    await initDatabase();
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
    logger.info(`数据库文件：${config.dbPath}`);
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
