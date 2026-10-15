/**
 * 统一 404 与异常处理中间件
 */
const logger = require('../utils/logger');

/**
 * 未匹配到的接口
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `接口不存在：${req.method} ${req.originalUrl}`,
  });
}

/**
 * 全局异常处理
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(`接口异常 ${req.method} ${req.originalUrl}：${err && err.stack ? err.stack : err}`);

  // 请求体 JSON 解析失败
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ success: false, message: '请求体 JSON 格式错误' });
  }
  // 请求体过大
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: '请求体过大' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: (err && err.message) || '服务器内部错误',
  });
}

module.exports = { notFoundHandler, errorHandler };
