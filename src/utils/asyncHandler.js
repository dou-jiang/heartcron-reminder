/**
 * 包装 async 路由处理函数，自动把异常交给 Express 错误中间件
 * @param {Function} fn 路由处理函数
 * @returns {Function}
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
