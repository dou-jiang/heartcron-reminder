/**
 * 全局配置：统一读取 .env，集中管理路径、端口、登录账号等运行时参数
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

/** 项目根目录 */
const rootDir = path.resolve(__dirname, '..', '..');

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

const config = {
  rootDir,
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

module.exports = config;
