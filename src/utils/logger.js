/**
 * 轻量日志工具：统一带时间戳输出，方便 PM2 日志排查
 */

/**
 * 生成日志前缀
 * @returns {string}
 */
function prefix() {
  return '[' + new Date().toISOString() + ']';
}

function info(message) {
  console.log(prefix(), '[INFO]', message);
}

function warn(message) {
  console.warn(prefix(), '[WARN]', message);
}

function error(message) {
  console.error(prefix(), '[ERROR]', message);
}

module.exports = { info, warn, error };
