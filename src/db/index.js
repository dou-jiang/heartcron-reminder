/**
 * MySQL 数据访问层
 * 基于 mysql2/promise 连接池，对外暴露 Promise 化的 run / get / all / query
 * 约定：
 *   - run() 返回 { insertId, affectedRows }
 *   - 日期与时间字段统一按字符串返回（dateStrings），避免时区换算带来的偏差
 */
const fs = require('fs');
const mysql = require('mysql2/promise');

const config = require('../config');
const logger = require('../utils/logger');
const { DEFAULT_PROMPT_TEMPLATE } = require('../config/defaultPrompt');
const { DEFAULT_PUSH_TITLE, DEFAULT_STYLE } = require('../config/constants');

/** @type {import('mysql2/promise').Pool|null} 连接池单例 */
let pool = null;

/**
 * 组装 mysql2 连接参数
 * @param {Object} [overrides] 覆盖项（安装向导测试连接时使用）
 * @returns {Object}
 */
function buildConnectionOptions(overrides = {}) {
  return {
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    charset: 'utf8mb4',
    // 日期字段以 'YYYY-MM-DD' / 'YYYY-MM-DD HH:mm:ss' 字符串返回
    dateStrings: true,
    ...overrides,
  };
}

/**
 * 获取连接池（首次调用时创建）
 * @returns {import('mysql2/promise').Pool}
 */
function getDb() {
  if (pool) return pool;
  pool = mysql.createPool({
    ...buildConnectionOptions(),
    waitForConnections: true,
    connectionLimit: config.mysql.connectionLimit,
    queueLimit: 0,
    enableKeepAlive: true,
  });
  return pool;
}

/**
 * 执行 SQL 并返回原始结果
 * @param {string} sql SQL 语句
 * @param {Array} params 参数
 * @returns {Promise<any>}
 */
async function query(sql, params = []) {
  const [rows] = await getDb().query(sql, params);
  return rows;
}

/**
 * 执行写入语句
 * @param {string} sql SQL 语句
 * @param {Array} params 参数
 * @returns {Promise<{insertId:number, affectedRows:number}>}
 */
async function run(sql, params = []) {
  const [result] = await getDb().query(sql, params);
  return { insertId: result.insertId, affectedRows: result.affectedRows };
}

/**
 * 查询单行
 * @param {string} sql SQL 语句
 * @param {Array} params 参数
 * @returns {Promise<Object|undefined>}
 */
async function get(sql, params = []) {
  const rows = await query(sql, params);
  return Array.isArray(rows) ? rows[0] : undefined;
}

/**
 * 查询多行
 * @param {string} sql SQL 语句
 * @param {Array} params 参数
 * @returns {Promise<Array<Object>>}
 */
async function all(sql, params = []) {
  const rows = await query(sql, params);
  return Array.isArray(rows) ? rows : [];
}

/**
 * 建立一个独立连接（安装向导测试连接、执行建表脚本时使用）
 * @param {Object} [overrides] 连接参数覆盖
 * @returns {Promise<import('mysql2/promise').Connection>}
 */
async function createConnection(overrides = {}) {
  return mysql.createConnection({ ...buildConnectionOptions(), ...overrides });
}

/**
 * 测试数据库连接，返回服务端版本
 * @param {Object} [overrides] 连接参数覆盖
 * @returns {Promise<{version:string, databaseExists:boolean, tableCount:number}>}
 */
async function testConnection(overrides = {}) {
  const options = buildConnectionOptions(overrides);
  const databaseName = options.database;

  // 先不带库名连接，判断数据库是否存在
  const rootConn = await mysql.createConnection({ ...options, database: undefined });
  let version = '';
  let databaseExists = false;
  try {
    const [versionRows] = await rootConn.query('SELECT VERSION() AS version');
    version = versionRows[0].version;
    const [schemaRows] = await rootConn.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [databaseName]
    );
    databaseExists = schemaRows.length > 0;
  } finally {
    await rootConn.end();
  }

  let tableCount = 0;
  if (databaseExists) {
    const conn = await mysql.createConnection(options);
    try {
      const [rows] = await conn.query(
        `SELECT COUNT(*) AS total FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME IN ('system_config', 'remind_task', 'anniversary', 'todo_item', 'push_log')`,
        [databaseName]
      );
      tableCount = Number(rows[0].total);
    } finally {
      await conn.end();
    }
  }

  return { version, databaseExists, tableCount };
}

/**
 * 确保数据库存在（不存在时创建）
 * @returns {Promise<boolean>} 是否新建了数据库
 */
async function ensureDatabase() {
  try {
    const conn = await createConnection();
    await conn.end();
    return false;
  } catch (err) {
    if (err.code !== 'ER_BAD_DB_ERROR') throw err;
  }

  const conn = await mysql.createConnection({ ...buildConnectionOptions(), database: undefined });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\`
        DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }
  return true;
}

/**
 * 关闭连接池
 * @returns {Promise<void>}
 */
async function closeDb() {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}

/**
 * 重置连接池（安装向导切换数据库配置后调用）
 * @returns {Promise<import('mysql2/promise').Pool>}
 */
async function resetDbConnection() {
  await closeDb();
  return getDb();
}

/**
 * 初始化数据库：建表 + 预置单行系统配置（含默认 Prompt 模板）
 * 幂等：重复执行不会覆盖已有数据
 * @returns {Promise<void>}
 */
async function initDatabase() {
  const schema = fs.readFileSync(config.schemaFile, 'utf8');
  const conn = await createConnection({ multipleStatements: true });
  try {
    // 建表脚本包含多条语句，需要 multipleStatements
    await conn.query(schema);

    // 预置 id=1 的单行配置；已存在则忽略
    await conn.query(
      `INSERT IGNORE INTO system_config
         (id, wx_pusher_title, ai_model, ai_temperature, ai_max_tokens, ai_prompt_template, boy_name, girl_name, default_style)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [DEFAULT_PUSH_TITLE, 'gpt-4o-mini', 0.8, 600, DEFAULT_PROMPT_TEMPLATE, '我', '宝贝', DEFAULT_STYLE]
    );

    // 老库升级：Prompt 模板为空时补默认模板
    await conn.query(
      `UPDATE system_config
          SET ai_prompt_template = ?
        WHERE id = 1 AND (ai_prompt_template IS NULL OR ai_prompt_template = '')`,
      [DEFAULT_PROMPT_TEMPLATE]
    );
  } finally {
    await conn.end();
  }

  logger.info(`数据库初始化完成：${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`);
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

module.exports = {
  getDb,
  query,
  run,
  get,
  all,
  createConnection,
  testConnection,
  ensureDatabase,
  initDatabase,
  getConfigRow,
  closeDb,
  resetDbConnection,
};
