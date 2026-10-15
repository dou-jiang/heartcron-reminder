/**
 * SQLite 数据访问层
 * 统一封装 sqlite3 的回调式 API，对外暴露 Promise 化的 run / get / all / exec
 */
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const config = require('../config');
const logger = require('../utils/logger');
const { DEFAULT_PROMPT_TEMPLATE } = require('../config/defaultPrompt');
const { DEFAULT_PUSH_TITLE, DEFAULT_STYLE } = require('../config/constants');

/** @type {sqlite3.Database|null} 数据库连接单例 */
let db = null;

/**
 * 获取数据库连接（首次调用时建立连接）
 * @returns {sqlite3.Database}
 */
function getDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new sqlite3.Database(config.dbPath);
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA foreign_keys = ON;');
  return db;
}

/**
 * 执行写入语句
 * @param {string} sql SQL 语句
 * @param {Array} params 参数
 * @returns {Promise<{lastID:number, changes:number}>}
 */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function onDone(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * 查询单行
 * @param {string} sql SQL 语句
 * @param {Array} params 参数
 * @returns {Promise<Object|undefined>}
 */
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

/**
 * 查询多行
 * @param {string} sql SQL 语句
 * @param {Array} params 参数
 * @returns {Promise<Array<Object>>}
 */
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

/**
 * 执行多语句 SQL（用于建表脚本）
 * @param {string} sql
 * @returns {Promise<void>}
 */
function exec(sql) {
  return new Promise((resolve, reject) => {
    getDb().exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * 初始化数据库：建表 + 预置单行系统配置（含默认 Prompt 模板）
 * 幂等：重复执行不会覆盖已有数据
 * @returns {Promise<void>}
 */
async function initDatabase() {
  const schema = fs.readFileSync(config.schemaFile, 'utf8');
  await exec(schema);

  // 预置 id=1 的单行配置；已存在则忽略
  await run(
    `INSERT OR IGNORE INTO system_config
       (id, wx_pusher_title, ai_model, ai_temperature, ai_max_tokens, ai_prompt_template, boy_name, girl_name, default_style)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [DEFAULT_PUSH_TITLE, 'gpt-4o-mini', 0.8, 600, DEFAULT_PROMPT_TEMPLATE, '我', '宝贝', DEFAULT_STYLE]
  );

  // 老库升级：Prompt 模板为空时补默认模板
  await run(
    `UPDATE system_config
        SET ai_prompt_template = ?
      WHERE id = 1 AND (ai_prompt_template IS NULL OR ai_prompt_template = '')`,
    [DEFAULT_PROMPT_TEMPLATE]
  );

  logger.info('数据库初始化完成：' + config.dbPath);
}

/**
 * 读取系统配置单行记录（不存在时兜底返回默认值对象）
 * @returns {Promise<Object>}
 */
async function getConfigRow() {
  const row = await get('SELECT * FROM system_config WHERE id = 1');
  if (row) return row;
  return {
    id: 1,
    wx_pusher_apptoken: '',
    wx_pusher_uid: '',
    wx_pusher_title: DEFAULT_PUSH_TITLE,
    qweather_key: '',
    qweather_city_id: '',
    ai_api_url: '',
    ai_api_key: '',
    ai_model: '',
    ai_temperature: 0.8,
    ai_max_tokens: 600,
    ai_prompt_template: DEFAULT_PROMPT_TEMPLATE,
    boy_name: '我',
    girl_name: '宝贝',
    default_style: DEFAULT_STYLE,
  };
}

module.exports = { getDb, run, get, all, exec, initDatabase, getConfigRow };
