/**
 * 登录鉴权中间件：未登录一律拒绝访问业务接口
 */

/**
 * 校验会话，未登录返回 401
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({
    success: false,
    code: 'UNAUTHORIZED',
    message: '未登录或登录已过期，请重新登录',
  });
}

module.exports = { requireLogin };
