/**
 * 全局配置：统一读取 .env，集中管理路径、端口、登录账号等运行时参数
 * 支持安装向导写入 .env 后热更新（reloadRuntimeConfig）
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/** 项目根目录 */
const rootDir = path.resolve(__dirname, '..', '..');

/** .env 文件路径 */
const envFile = path.join(rootDir, '.env');

/** 安装完成标记文件（存在即视为已安装） */
const installLockFile = path.join(rootDir, 'data', 'install.lock');

/** 网页安装向导页面 */
const installPageFile = path.join(rootDir, 'public', 'install.html');

dotenv.config({ path: envFile });

/**
 * 读取环境变量并做兜底
 * @param {string} key 变量名
 * @param {string} fallback 默认值
 * @returns {string}
 */
function readEnv(key, fallback) {
  const value = process.env[key];
  return value === undefined || value === null || value === '' ? fallback : value;
}

/**
 * 由当前环境变量生成配置对象
 * @returns {Object}
 */
function buildConfig() {
  return {
    rootDir,
    envFile,
    installLockFile,
    installPageFile,
    /** 服务监听端口 */
    port: Number(readEnv('PORT', '8080')),
    /** 定时任务时区 */
    timezone: readEnv('TZ', 'Asia/Shanghai'),
    /** 外部请求超时（毫秒） */
    httpTimeout: Number(readEnv('HTTP_TIMEOUT', '10000')),
    /** SQLite 数据库文件绝对路径 */
    dbPath: path.resolve(rootDir, readEnv('DB_PATH', 'data/heartcron.db')),
    /** 前端打包产物目录 */
    webDistDir: path.resolve(rootDir, 'frontend', 'dist'),
    /** 建表 SQL 文件 */
    schemaFile: path.resolve(__dirname, '..', 'db', 'schema.sql'),
    /** 登录会话配置 */
    session: {
      secret: readEnv('SESSION_SECRET', 'heartcron_default_session_secret'),
      maxAge: Number(readEnv('SESSION_MAX_AGE', String(7 * 24 * 60 * 60 * 1000))),
    },
    /** 后台登录账号（存 .env，不入库） */
    admin: {
      username: readEnv('ADMIN_USERNAME', 'admin'),
      password: readEnv('ADMIN_PASSWORD', 'heartcron123'),
    },
  };
}

const config = buildConfig();

/**
 * 重新读取 .env 并刷新配置（安装向导写入 .env 后调用，免重启生效）
 * @returns {Object} 最新的配置对象
 */
function reloadRuntimeConfig() {
  const parsed = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
  Object.keys(parsed).forEach((key) => {
    process.env[key] = parsed[key];
  });
  Object.assign(config, buildConfig());
  return config;
}

/**
 * 是否已完成安装
 * 判定：存在安装锁；或（兼容手动部署）.env 与数据库文件同时存在
 * @returns {boolean}
 */
function isInstalled() {
  if (fs.existsSync(installLockFile)) return true;
  return fs.existsSync(envFile) && fs.existsSync(config.dbPath);
}

/**
 * 写入安装完成标记
 * @param {Object} [info] 附加信息
 * @returns {void}
 */
function markInstalled(info = {}) {
  fs.mkdirSync(path.dirname(installLockFile), { recursive: true });
  fs.writeFileSync(
    installLockFile,
    JSON.stringify({ name: 'HeartCron 心时', installedAt: new Date().toISOString(), ...info }, null, 2),
    'utf8'
  );
}

module.exports = config;
module.exports.reloadRuntimeConfig = reloadRuntimeConfig;
module.exports.isInstalled = isInstalled;
module.exports.markInstalled = markInstalled;
module.exports.buildConfig = buildConfig;
