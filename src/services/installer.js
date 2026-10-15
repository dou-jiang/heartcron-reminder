/**
 * 网页安装向导服务（MySQL 版）
 * 职责：环境自检、测试数据库连接、写入 .env、创建数据库与数据表、写入初始配置与示例数据、生成安装锁
 * 与 PHP 项目的「安装向导」等价：先检测运行环境（Node 版本 / 依赖模块 / MySQL 驱动 / 目录权限 / 网络），
 * 再填写数据库信息与管理员账号，一键完成安装。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('../config');
const logger = require('../utils/logger');
const { http } = require('../utils/http');
const { run, get, testConnection, ensureDatabase, initDatabase, resetDbConnection } = require('../db');
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
  'mysql2',
];

/** 安装向导默认值 */
const DEFAULT_PORT = 8080;
const DEFAULT_DB = { host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'heartcron' };

/**
 * 把 MySQL 错误转换成中文提示
 * @param {any} err 异常对象
 * @returns {string}
 */
function describeDbError(err) {
  const map = {
    ECONNREFUSED: '无法连接数据库服务器，请检查主机、端口是否正确以及 MySQL 是否已启动',
    ETIMEDOUT: '连接数据库超时，请检查网络与防火墙设置',
    ENOTFOUND: '数据库主机地址无法解析，请检查主机地址是否填写正确',
    ER_ACCESS_DENIED_ERROR: '数据库账号或密码错误（远程连接还需授权该账号从本机访问）',
    ER_DBACCESS_DENIED_ERROR: '当前数据库账号没有访问该库的权限',
    ER_NOT_SUPPORTED_AUTH_MODE: 'MySQL 认证方式不兼容，请升级 MySQL 或调整该用户的认证插件',
    ER_NO_SUCH_TABLE: '数据表不存在，请重新执行安装初始化',
  };
  return map[err && err.code] || (err && err.message) || '数据库连接失败';
}

/**
 * 读取表单中的数据库配置并做默认值兜底
 * @param {Object} payload 表单数据
 * @returns {{host:string, port:number, user:string, password:string, database:string}}
 */
function normalizeDbPayload(payload = {}) {
  return {
    host: String(payload.dbHost === undefined || payload.dbHost === null || payload.dbHost === '' ? DEFAULT_DB.host : payload.dbHost).trim(),
    port: Number(payload.dbPort || DEFAULT_DB.port),
    user: String(payload.dbUser === undefined || payload.dbUser === null || payload.dbUser === '' ? DEFAULT_DB.user : payload.dbUser).trim(),
    password: payload.dbPassword === undefined || payload.dbPassword === null ? '' : String(payload.dbPassword),
    database: String(payload.dbName === undefined || payload.dbName === null || payload.dbName === '' ? DEFAULT_DB.database : payload.dbName).trim(),
  };
}

/**
 * 校验数据库连接参数
 * @param {Object} db 数据库配置
 * @returns {string[]} 错误信息
 */
function validateDbPayload(db) {
  const errors = [];
  if (!db.host) errors.push('数据库主机不能为空');
  if (!Number.isInteger(db.port) || db.port < 1 || db.port > 65535) errors.push('数据库端口需为 1~65535 之间的整数');
  if (!db.user) errors.push('数据库账号不能为空');
  if (!db.database) errors.push('数据库名称不能为空');
  else if (!/^[A-Za-z0-9_$]+$/.test(db.database)) errors.push('数据库名称只能包含字母、数字与下划线');
  else if (db.database.length > 64) errors.push('数据库名称不能超过 64 个字符');
  return errors;
}

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

  // 3. MySQL 驱动（相当于 PHP 的 mysqli / pdo_mysql 扩展检测）
  let driverOk = false;
  let driverDetail = '未安装';
  try {
    // eslint-disable-next-line global-require
    const pkg = require('mysql2/package.json');
    driverDetail = 'mysql2 v' + (pkg.version || '');
    driverOk = true;
  } catch (err) {
    driverDetail = err.message;
  }
  checks.push({
    key: 'mysql2',
    name: 'MySQL 驱动（mysql2）',
    level: 'error',
    ok: driverOk,
    current: driverDetail,
    required: '已安装',
    hint: '请在项目根目录执行 npm install mysql2',
  });

  // 4. 数据库连接：已安装时实测，未安装时提示在向导中填写
  if (config.isInstalled()) {
    let ok = false;
    let detail = '';
    try {
      const info = await testConnection();
      ok = true;
      detail = `已连接 MySQL ${info.version} · 数据库 ${config.mysql.database}`;
    } catch (err) {
      detail = describeDbError(err);
    }
    checks.push({
      key: 'database',
      name: 'MySQL 数据库连接',
      level: 'error',
      ok,
      current: detail,
      required: `${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`,
      hint: '请检查 .env 中的 DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME',
    });
  } else {
    checks.push({
      key: 'database',
      name: 'MySQL 数据库连接',
      level: 'info',
      ok: true,
      current: '待配置（在第 2 步填写后点击「测试连接」）',
      required: 'MySQL 5.7+ / 8.0 / MariaDB 10.4+',
      hint: '需要提前准备好数据库主机、账号与密码，数据库不存在时向导会自动创建',
    });
  }

  // 5. 项目目录可写（需要写入 .env 与安装锁）
  let writable = false;
  let writableDetail = config.rootDir;
  try {
    const testFile = path.join(config.rootDir, '.install-write-test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    writable = true;
    writableDetail = `${config.rootDir} 可写`;
  } catch (err) {
    writableDetail = err.message;
  }
  checks.push({
    key: 'rootDir',
    name: '项目目录可写',
    level: 'error',
    ok: writable,
    current: writableDetail,
    required: '可读写',
    hint: '安装需要写入 .env 与 data/install.lock，请给运行用户授予项目目录写权限（宝塔可在「文件」中修改权限）',
  });

  // 6. 前端构建产物
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

  // 7. 外网连通性（推送、天气与大模型接口）
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

  // 8. 时区与系统时间
  checks.push({
    key: 'timezone',
    name: '时区与系统时间',
    level: 'info',
    ok: true,
    current: `${process.env.TZ || config.timezone} · ${new Date().toLocaleString('zh-CN')}`,
    required: 'Asia/Shanghai',
    hint: '定时任务按此时区执行，如有偏差请在 .env 中修改 TZ',
  });

  // 9. 安装状态
  const installed = config.isInstalled();
  checks.push({
    key: 'installed',
    name: '安装状态',
    level: 'info',
    ok: !installed,
    current: installed ? '已安装' : '未安装',
    required: '未安装',
    hint: '如需重新安装，请删除 data/install.lock 与 .env 后刷新本页面',
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
      db: { ...DEFAULT_DB },
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

  errors.push(...validateDbPayload(normalizeDbPayload(payload)));

  if (payload.timezone && !/^[A-Za-z]+(?:[_-][A-Za-z]+)*\/[A-Za-z]+(?:[_-][A-Za-z]+)*$/.test(String(payload.timezone))) {
    errors.push('时区格式不正确，例如 Asia/Shanghai');
  }
  if (payload.defaultStyle && !STYLE_TYPES.includes(payload.defaultStyle)) {
    errors.push(`文案风格必须是：${STYLE_TYPES.join(' / ')}`);
  }
  return errors;
}

/**
 * 测试数据库连接（向导第 2 步的「测试连接」按钮）
 * @param {Object} payload 表单数据
 * @returns {Promise<Object>}
 */
async function testDatabase(payload = {}) {
  const db = normalizeDbPayload(payload);
  const errors = validateDbPayload(db);
  if (errors.length) {
    const err = new Error(errors.join('；'));
    err.status = 400;
    throw err;
  }

  try {
    const info = await testConnection({
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.database,
    });
    return {
      host: db.host,
      port: db.port,
      database: db.database,
      mysqlVersion: info.version,
      databaseExists: info.databaseExists,
      tableCount: info.tableCount,
      message: info.databaseExists
        ? `连接成功：MySQL ${info.version}，数据库 ${db.database} 已存在（${info.tableCount} 张 HeartCron 数据表）`
        : `连接成功：MySQL ${info.version}，数据库 ${db.database} 不存在，安装时会自动创建`,
    };
  } catch (err) {
    const wrapped = new Error(describeDbError(err));
    wrapped.status = 400;
    throw wrapped;
  }
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
    '# ================= MySQL 数据库 =================',
    'DB_HOST=' + values.db.host,
    'DB_PORT=' + values.db.port,
    'DB_USER=' + values.db.user,
    'DB_PASSWORD=' + values.db.password,
    'DB_NAME=' + values.db.database,
    'DB_CONNECTION_LIMIT=' + (values.dbConnectionLimit || 10),
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
  if (!taskCount || Number(taskCount.total) === 0) {
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
  if (!todoCount || Number(todoCount.total) === 0) {
    await run('INSERT INTO todo_item (content, enable, only_workday) VALUES (?, 1, 1)', ['记得吃维生素']);
    await run('INSERT INTO todo_item (content, enable, only_workday) VALUES (?, 1, 0)', ['早点睡觉，别熬夜']);
  }

  const anniversaryCount = await get('SELECT COUNT(*) AS total FROM anniversary');
  if (!anniversaryCount || Number(anniversaryCount.total) === 0) {
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
    const err = new Error('系统已安装，如需重新安装请先删除 data/install.lock 与 .env');
    err.status = 403;
    throw err;
  }

  const errors = validateInstallPayload(payload);
  if (errors.length) {
    const err = new Error(errors.join('；'));
    err.status = 400;
    throw err;
  }

  const db = normalizeDbPayload(payload);
  const steps = [];
  const pushStep = (name, ok, message) => steps.push({ name, ok, message });

  // 1. 测试数据库连接（先验证再写入任何配置）
  let dbInfo;
  try {
    dbInfo = await testConnection({
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.database,
    });
  } catch (err) {
    const wrapped = new Error(describeDbError(err));
    wrapped.status = 400;
    throw wrapped;
  }
  pushStep(
    '测试数据库连接',
    true,
    `MySQL ${dbInfo.version} · ${db.host}:${db.port} · ` +
      (dbInfo.databaseExists ? `数据库 ${db.database} 已存在` : `数据库 ${db.database} 将自动创建`)
  );

  // 2. 写入 .env（原文件备份为 .env.bak），失败时回滚，保证向导可以重跑
  const envExisted = fs.existsSync(config.envFile);
  const envBackup = config.envFile + '.bak';
  if (envExisted) fs.copyFileSync(config.envFile, envBackup);

  const values = {
    port: Number(payload.port || DEFAULT_PORT),
    adminUsername: String(payload.adminUsername).trim(),
    adminPassword: String(payload.adminPassword),
    sessionSecret: payload.sessionSecret || '',
    sessionMaxAge: Number(payload.sessionMaxAge || 0) || undefined,
    db,
    dbConnectionLimit: Number(payload.dbConnectionLimit || 0) || undefined,
    timezone: String(payload.timezone || 'Asia/Shanghai'),
    httpTimeout: Number(payload.httpTimeout || 0) || undefined,
  };

  try {
    fs.writeFileSync(config.envFile, buildEnvContent(values), 'utf8');
    pushStep('写入环境变量 .env', true, '账号密码、端口、时区与 MySQL 连接信息已写入' + (envExisted ? '（原文件已备份为 .env.bak）' : ''));

    // 3. 让新配置立即生效（免重启）
    config.reloadRuntimeConfig();
    pushStep('应用新配置', true, `服务端口 ${config.port}，数据库 ${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`);

    // 4. 创建数据库（若不存在）并建表
    const created = await ensureDatabase();
    await resetDbConnection();
    await initDatabase();
    pushStep('初始化数据表', true, created ? `已创建数据库 ${config.mysql.database} 并建好 5 张表` : '5 张数据表已就绪（IF NOT EXISTS，不会覆盖已有数据）');

    // 5. 写入表单中的系统配置
    await seedSystemConfig(payload);
    pushStep('写入系统配置', true, 'WxPusher / 天气 / 大模型 / 昵称等配置已保存');

    // 6. 示例数据
    if (payload.demoData) {
      await seedDemoData();
      pushStep('写入示例数据', true, '3 个定时任务、2 条待办、1 个纪念日（可在后台修改或删除）');
    }

    // 7. 安装锁
    config.markInstalled({
      version: require('../../package.json').version,
      port: config.port,
      database: `${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`,
    });
    pushStep('生成安装锁', true, 'data/install.lock');

    // 8. 重新加载定时任务
    // eslint-disable-next-line global-require
    const { reloadSchedules } = require('./scheduler');
    const registered = await reloadSchedules();
    pushStep('加载定时任务', true, `已注册 ${registered} 个任务`);
  } catch (err) {
    // 回滚 .env，避免出现「已写入配置但安装失败」的死锁状态
    try {
      if (envExisted) fs.copyFileSync(envBackup, config.envFile);
      else if (fs.existsSync(config.envFile)) fs.unlinkSync(config.envFile);
      config.reloadRuntimeConfig();
    } catch (rollbackErr) {
      logger.error('回滚 .env 失败：' + rollbackErr.message);
    }
    throw err;
  }

  const hasDist = fs.existsSync(path.join(config.webDistDir, 'index.html'));
  if (!hasDist) {
    pushStep('前端构建产物', false, '未找到 frontend/dist，请执行 npm run build 或上传构建产物后刷新页面');
  }

  logger.info(`安装完成：端口 ${config.port}，数据库 ${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`);
  return { steps, adminUrl: '/', port: config.port };
}

module.exports = {
  runEnvironmentChecks,
  getInstallStatus,
  validateInstallPayload,
  testDatabase,
  performInstall,
  describeDbError,
  REQUIRED_MODULES,
};
