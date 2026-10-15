/**
 * 数据库初始化脚本：npm run init-db
 * 作用：创建 SQLite 数据库文件、建表、写入默认系统配置与默认 Prompt 模板
 */
const config = require('../src/config');
const logger = require('../src/utils/logger');
const { initDatabase, getConfigRow, all } = require('../src/db');

(async function main() {
  await initDatabase();

  const cfg = await getConfigRow();
  const taskCount = (await all('SELECT id FROM remind_task')).length;
  const anniversaryCount = (await all('SELECT id FROM anniversary')).length;
  const todoCount = (await all('SELECT id FROM todo_item')).length;

  console.log('');
  console.log('HeartCron 心时 —— 数据库初始化完成');
  console.log('数据库文件   ：' + config.dbPath);
  console.log('默认风格     ：' + cfg.default_style);
  console.log('Prompt 长度  ：' + String(cfg.ai_prompt_template || '').length + ' 字符');
  console.log('已有定时任务 ：' + taskCount + ' 条');
  console.log('已有纪念日   ：' + anniversaryCount + ' 条');
  console.log('已有待办事项 ：' + todoCount + ' 条');
  console.log('');
  console.log('下一步：npm start 启动服务，登录后台填写密钥与任务配置。');
})().catch((err) => {
  logger.error('数据库初始化失败：' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
