/**
 * 登录鉴权接口
 * POST /api/login   登录，账号密码来自 .env
 * POST /api/logout  退出登录
 * GET  /api/session 查询当前登录状态
 */
const crypto = require('crypto');
const express = require('express');

const config = require('../config');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/** 登录失败次数上限与锁定时长 */
const MAX_FAIL_TIMES = 10;
const LOCK_DURATION_MS = 5 * 60 * 1000;

/** @type {Map<string, {count:number, lockedUntil:number}>} 简单的登录失败计数（按 IP） */
const loginAttempts = new Map();

/**
 * 恒定时间字符串比较，避免时序攻击
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * 判断当前 IP 是否处于锁定状态
 * @param {string} ip
 * @returns {number} 剩余锁定毫秒数，0 表示未锁定
 */
function lockedRemainMs(ip) {
  const record = loginAttempts.get(ip);
  if (!record || !record.lockedUntil) return 0;
  const remain = record.lockedUntil - Date.now();
  return remain > 0 ? remain : 0;
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const ip = req.ip || 'unknown';
    const remain = lockedRemainMs(ip);
    if (remain > 0) {
      return res.status(429).json({
        success: false,
        message: `登录失败次数过多，请 ${Math.ceil(remain / 60000)} 分钟后再试`,
      });
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请输入账号与密码' });
    }

    const ok = safeEqual(username, config.admin.username) && safeEqual(password, config.admin.password);
    if (!ok) {
      const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
      record.count += 1;
      if (record.count >= MAX_FAIL_TIMES) {
        record.lockedUntil = Date.now() + LOCK_DURATION_MS;
        record.count = 0;
      }
      loginAttempts.set(ip, record);
      logger.warn(`登录失败（${ip}）：账号或密码错误`);
      return res.status(401).json({ success: false, message: '账号或密码错误' });
    }

    loginAttempts.delete(ip);
    req.session.user = { username: config.admin.username, loginAt: Date.now() };
    logger.info(`登录成功（${ip}）`);
    return res.json({ success: true, data: { username: config.admin.username } });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('heartcron.sid');
      res.json({ success: true, data: { message: '已退出登录' } });
    });
  })
);

router.get(
  '/session',
  asyncHandler(async (req, res) => {
    const user = req.session && req.session.user;
    res.json({
      success: true,
      data: { loggedIn: Boolean(user), username: user ? user.username : '' },
    });
  })
);

module.exports = router;
