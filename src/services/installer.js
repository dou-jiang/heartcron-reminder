/**
 * 网页安装向导服务
 * 职责：环境自检、写入 .env、初始化数据库、写入初始系统配置与示例数据、生成安装锁
 * 与 PHP 项目的「安装向导」等价，只是本项目运行在 Node.js + SQLite 上：
 *   - 不需要填写数据库账号密码，SQLite 是一个文件数据库
 *   - 环境检测项从「PHP 扩展」换成「Node 版本 / 依赖模块 / sqlite3 可用性 / 目录可写」
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('../config');
const logger = require('../utils/logger');
const { http } = require('../utils/http');
const { run, get, resetDbConnection, initDatabase } = require('../db');
const { STYLE_TYPES, DEFAULT_STYLE, DEFAULT_PUSH_TITLE } = require('../config/constants');
const { DEFAULT_PROMPT_TEMPLATE } = require('../config/defaultPrompt');
const { formatDate } = require('../utils/date');

/** 后端运行必需的依赖模块 */
const REQUIRED_MODULES = [
  'express',
  'express-session',
  'cookie-parser',
  'cors',
  'dotenv',
  'axios',
  'node-schedule',
  'cron-parser',
  'sqlite3',
];

/** 安装向导可写入的默认端口 */
const DEFAULT_PORT = 8080;

/**
 * 检测 Node 运行环境与依赖是否就绪
 * @returns {Promise<Array<Object>>} 检测项列表
 */
async function runEnvironmentChecks() {
  const checks = [];

  // 1. Node.js 版本
  const nodeMajor = Number(String(process.version).replace(/^v/, '').split('.')[0]);
  checks.push({
    key: 'node',
    name: 'Node.js 版本',
    level: 'error',
    ok: nodeMajor >= 16,
    current: process.version,
    required: '>= 16',
    hint: '请升级 Node.js 到 16 及以上版本（推荐 20 LTS）',
  });

  // 2. 依赖模块是否安装
  const missing = [];
  REQUIRED_MODULES.forEach((name) => {
    try {
      require.resolve(name);
    } catch (err) {
      missing.push(name);
    }
  });
  checks.push({
    key: 'modules',
    name: '后端依赖模块',
    level: 'error',
    ok: missing.length === 0,
    current: missing.length ? `缺少 ${missing.join('、')}` : `${REQUIRED_MODULES.length} 个依赖已就绪`,
    required: 'npm install',
    hint: '请在项目根目录执行 npm install 安装依赖',
  });

  // 3. sqlite3 模块可实际使用（相当于 PHP 的扩展可用性检测）
  let sqliteOk = false;
  let sqliteDetail = '未安装';
  try {
    // eslint-disable-next-line global-require
    const sqlite3 = require('sqlite3');
    sqliteDetail = 'v' + (require('sqlite3/package.json').version || '');
    await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(':memory:');
      db.get('SELECT 1 AS ok', (err) => {
        db.close(() => (err ? reject(err) : resolve()));
      });
    });
    sqliteOk = true;
  } catch (err) {
    sqliteDetail = err.message;
  }
  checks.push({
    key: 'sqlite3',
    name: 'SQLite 数据库扩展',
    level: 'error',
    ok: sqliteOk,
    current: sqliteDetail,
    required: '可正常读写',
    hint: 'sqlite3 原生模块加载失败，请重新执行 npm install（必要时安装编译工具链）',
  });

  // 4. 数据目录可写
  const dataDir = path.dirname(config.dbPath);
  let writable = false;
  let writableDetail = dataDir;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const testFile = path.join(dataDir, '.write-test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    writable = true;
    writableDetail = `${dataDir} 可写`;
  } catch (err) {
    writableDetail = err.message;
  }
  checks.push({
    key: 'dataDir',
    name: '数据目录可写',
    level: 'error',
    ok: writable,
    current: writableDetail,
    required: '可读写',
    hint: '请给运行用户授予项目目录写权限（宝塔可在「文件」中修改权限为 755/777）',
  });

  // 5. 前端构建产物
  const distIndex = path.join(config.webDistDir, 'index.html');
  const hasDist = fs.existsSync(distIndex);
  checks.push({
    key: 'frontend',
    name: '前端构建产物',
    level: 'warn',
    ok: hasDist,
    current: hasDist ? distIndex : '未找到 frontend/dist/index.html',
    required: '存在 frontend/dist',
    hint: '可在本地执行 npm run build 后上传 frontend/dist，或在服务器执行 npm run build；缺失时只能访问接口',
  });

  // 6. 外网连通性（推送与天气接口）
  let networkOk = false;
  let networkDetail = '检测超时';
  try {
    const res = await http.get('https://wxpusher.zjiecode.com/', { timeout: 5000, validateStatus: () => true });
    networkOk = res.status > 0;
    networkDetail = `外网可访问（HTTP ${res.status}）`;
  } catch (err) {
    networkDetail = err.message;
  }
  checks.push({
    key: 'network',
    name: '外网连通性',
    level: 'warn',
    ok: networkOk,
    current: networkDetail,
    required: '可访问 wxpusher / 和风天气 / 大模型接口',
    hint: '服务器无法访问外网时，天气、AI 文案与微信推送都会失败，请检查网络或代理设置',
  });

  // 7. 时区与系统时间
  checks.push({
    key: 'timezone',
    name: '时区与系统时间',
    level: 'info',
    ok: true,
    current: `${process.env.TZ || config.timezone} · ${new Date().toLocaleString('zh-CN')}`,
    required: 'Asia/Shanghai',
    hint: '定时任务按此时区执行，如有偏差请在 .env 中修改 TZ',
  });

  // 8. 安装状态
  const installed = config.isInstalled();
  checks.push({
    key: 'installed',
    name: '安装状态',
    level: 'info',
    ok: !installed,
    current: installed ? '已安装' : '未安装',
    required: '未安装',
    hint: '如需重新安装，请删除 data/install.lock 后刷新本页面',
  });

  return checks;
}

/**
 * 获取安装状态（已安装时只返回状态，不暴露环境细节）
 * @returns {Promise<Object>}
 */
async function getInstallStatus() {
  const installed = config.isInstalled();
  if (installed) {
    let lockInfo = {};
    try {
      lockInfo = JSON.parse(fs.readFileSync(config.installLockFile, 'utf8'));
    } catch (err) {
      lockInfo = {};
    }
    return { installed: true, installedAt: lockInfo.installedAt || '', checks: [] };
  }
  return {
    installed: false,
    appName: 'HeartCron 心时',
    slogan: 'Cron调度时间，心意准时抵达。',
    defaults: {
      port: DEFAULT_PORT,
      timezone: config.timezone,
      dbPath: 'data/heartcron.db',
      boyName: '我',
      girlName: '宝贝',
      defaultStyle: DEFAULT_STYLE,
      pushTitle: DEFAULT_PUSH_TITLE,
      styleTypes: STYLE_TYPES,
    },
    checks: await runEnvironmentChecks(),
  };
}

/**
 * 校验安装参数
 * @param {Object} payload 表单数据
 * @returns {string[]} 错误信息列表
 */
function validateInstallPayload(payload = {}) {
  const errors = [];
  const username = String(payload.adminUsername || '').trim();
  const password = String(payload.adminPassword || '');

  if (username.length < 3 || username.length > 32) {
    errors.push('管理员账号长度需为 3~32 个字符');
  } else if (!/^[A-Za-z0-9_.@-]+$/.test(username)) {
    errors.push('管理员账号只能包含字母、数字与 _ . @ - ');
  }
  if (password.length < 8) errors.push('管理员密码至少 8 位');
  if (payload.adminPassword !== payload.adminPasswordConfirm) errors.push('两次输入的密码不一致');

  const port = Number(payload.port || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('服务端口需为 1~65535 之间的整数');

  if (payload.dbPath) {
    const resolved = path.resolve(config.rootDir, String(payload.dbPath));
    if (!resolved.startsWith(config.rootDir)) errors.push('数据库文件路径必须位于项目目录内');
    if (path.extname(resolved) !== '.db') errors.push('数据库文件需以 .db 结尾，例如 data/heartcron.db');
  }

  if (payload.timezone && !/^[A-Za-z]+(?:[_-][A-Za-z]+)*\/[A-Za-z]+(?:[_-][A-Za-z]+)*$/.test(String(payload.timezone))) {
    errors.push('时区格式不正确，例如 Asia/Shanghai');
  }
  if (payload.defaultStyle && !STYLE_TYPES.includes(payload.defaultStyle)) {
    errors.push(`文案风格必须是：${STYLE_TYPES.join(' / ')}`);
  }
  return errors;
}

/**
 * 生成 .env 文件内容
 * @param {Object} values 配置值
 * @returns {string}
 */
function buildEnvContent(values) {
  const secret = values.sessionSecret || crypto.randomBytes(24).toString('hex');
  return [
    '# ================= HeartCron 心时 环境变量 =================',
    '# 由网页安装向导生成于 ' + new Date().toISOString(),
    '# 修改后需要重启服务（pm2 restart heartcron）',
    '',
    '# 服务监听端口',
    'PORT=' + values.port,
    '',
    '# 后台登录账号 / 密码',
    'ADMIN_USERNAME=' + values.adminUsername,
    'ADMIN_PASSWORD=' + values.adminPassword,
    '',
    '# session 加密密钥',
    'SESSION_SECRET=' + secret,
    '',
    '# session 有效期（毫秒），默认 7 天',
    'SESSION_MAX_AGE=' + (values.sessionMaxAge || 7 * 24 * 60 * 60 * 1000),
    '',
    '# SQLite 数据库文件路径',
    'DB_PATH=' + values.dbPath,
    '',
    '# 定时任务时区',
    'TZ=' + values.timezone,
    '',
    '# 外部请求超时（毫秒）',
    'HTTP_TIMEOUT=' + (values.httpTimeout || 10000),
    '',
  ].join('\n');
}

/**
 * 写入初始系统配置（仅覆盖表单中填写过的项）
 * @param {Object} payload 表单数据
 * @returns {Promise<void>}
 */
async function seedSystemConfig(payload) {
  const fields = [];
  const values = [];
  const map = {
    wxPusherAppToken: 'wx_pusher_apptoken',
    wxPusherUid: 'wx_pusher_uid',
    wxPusherTitle: 'wx_pusher_title',
    qweatherKey: 'qweather_key',
    qweatherCityId: 'qweather_city_id',
    aiApiUrl: 'ai_api_url',
    aiApiKey: 'ai_api_key',
    aiModel: 'ai_model',
    boyName: 'boy_name',
    girlName: 'girl_name',
    defaultStyle: 'default_style',
  };

  Object.entries(map).forEach(([formKey, column]) => {
    const value = payload[formKey];
    if (value === undefined || value === null || String(value).trim() === '') return;
    fields.push(column);
    values.push(String(value).trim());
  });

  if (fields.length) {
    await run(
      `UPDATE system_config SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = 1`,
      values
    );
  }

  // 确保 Prompt 模板存在
  await run(
    `UPDATE system_config SET ai_prompt_template = ?
      WHERE id = 1 AND (ai_prompt_template IS NULL OR ai_prompt_template = '')`,
    [DEFAULT_PROMPT_TEMPLATE]
  );
}

/**
 * 写入示例数据，方便安装后立刻看到完整效果
 * @returns {Promise<void>}
 */
async function seedDemoData() {
  const taskCount = await get('SELECT COUNT(*) AS total FROM remind_task');
  if (!taskCount || taskCount.total === 0) {
    const demoTasks = [
      ['早安提醒', '0 30 9 * * *', '早安', '每天 09:30 推送'],
      ['午间关心', '0 30 12 * * *', '午间关心', '每天 12:30 推送'],
      ['晚安提醒', '0 0 22 * * *', '晚安提醒', '每天 22:00 推送'],
    ];
    for (const task of demoTasks) {
      // eslint-disable-next-line no-await-in-loop
      await run('INSERT INTO remind_task (task_name, cron_expr, push_time_period, enable, remark) VALUES (?, ?, ?, 1, ?)', task);
    }
  }

  const todoCount = await get('SELECT COUNT(*) AS total FROM todo_item');
  if (!todoCount || todoCount.total === 0) {
    await run('INSERT INTO todo_item (content, enable, only_workday) VALUES (?, 1, 1)', ['记得吃维生素']);
    await run('INSERT INTO todo_item (content, enable, only_workday) VALUES (?, 1, 0)', ['早点睡觉，别熬夜']);
  }

  const anniversaryCount = await get('SELECT COUNT(*) AS total FROM anniversary');
  if (!anniversaryCount || anniversaryCount.total === 0) {
    const target = new Date();
    target.setDate(target.getDate() + 30);
    await run('INSERT INTO anniversary (name, target_date, enable, show_countdown) VALUES (?, ?, 1, 1)', [
      '纪念日示例',
      formatDate(target),
    ]);
  }
}

/**
 * 执行安装
 * @param {Object} payload 表单数据
 * @returns {Promise<{steps:Array<Object>, adminUrl:string, port:number}>}
 */
async function performInstall(payload = {}) {
  if (config.isInstalled()) {
    const err = new Error('系统已安装，如需重新安装请先删除 data/install.lock');
    err.status = 403;
    throw err;
  }

  const errors = validateInstallPayload(payload);
  if (errors.length) {
    const err = new Error(errors.join('；'));
    err.status = 400;
    throw err;
  }

  const steps = [];
  const pushStep = (name, ok, message) => steps.push({ name, ok, message });

  // 1. 写入 .env（已存在时先备份）
  const values = {
    port: Number(payload.port || DEFAULT_PORT),
    adminUsername: String(payload.adminUsername).trim(),
    adminPassword: String(payload.adminPassword),
    sessionSecret: payload.sessionSecret || '',
    sessionMaxAge: Number(payload.sessionMaxAge || 0) || undefined,
    dbPath: String(payload.dbPath || 'data/heartcron.db').replace(/\\/g, '/'),
    timezone: String(payload.timezone || 'Asia/Shanghai'),
    httpTimeout: Number(payload.httpTimeout || 0) || undefined,
  };

  if (fs.existsSync(config.envFile)) {
    fs.copyFileSync(config.envFile, config.envFile + '.bak');
    pushStep('备份原 .env', true, '已备份为 .env.bak');
  }
  fs.writeFileSync(config.envFile, buildEnvContent(values), 'utf8');
  pushStep('写入环境变量 .env', true, '账号密码、端口、时区与数据库路径已写入');

  // 2. 让新配置立即生效（免重启）
  config.reloadRuntimeConfig();
  pushStep('应用新配置', true, `服务端口 ${config.port}，时区 ${config.timezone}`);

  // 3. 初始化数据库（建表 + 默认配置）
  await resetDbConnection();
  await initDatabase();
  pushStep('初始化 SQLite 数据库', true, config.dbPath);

  // 4. 写入表单中的系统配置
  await seedSystemConfig(payload);
  pushStep('写入系统配置', true, 'WxPusher / 天气 / 大模型 / 昵称等配置已保存');

  // 5. 示例数据
  if (payload.demoData) {
    await seedDemoData();
    pushStep('写入示例数据', true, '3 个定时任务、2 条待办、1 个纪念日（可在后台修改或删除）');
  }

  // 6. 安装锁
  config.markInstalled({ version: require('../../package.json').version, port: config.port });
  pushStep('生成安装锁', true, 'data/install.lock');

  // 7. 重新加载定时任务
  // eslint-disable-next-line global-require
  const { reloadSchedules } = require('./scheduler');
  const registered = await reloadSchedules();
  pushStep('加载定时任务', true, `已注册 ${registered} 个任务`);

  const hasDist = fs.existsSync(path.join(config.webDistDir, 'index.html'));
  if (!hasDist) {
    pushStep('前端构建产物', false, '未找到 frontend/dist，请执行 npm run build 或上传构建产物后刷新页面');
  }

  logger.info(`安装完成：端口 ${config.port}，数据库 ${config.dbPath}`);
  return { steps, adminUrl: `/`, port: config.port };
}

module.exports = {
  runEnvironmentChecks,
  getInstallStatus,
  validateInstallPayload,
  performInstall,
  REQUIRED_MODULES,
};
