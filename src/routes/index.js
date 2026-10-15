/**
 * API 路由总入口
 * 除登录相关接口外，全部接口都经过 requireLogin 鉴权
 */
const express = require('express');

const { requireLogin } = require('../middleware/auth');
const authRoutes = require('./auth');
const configRoutes = require('./config');
const taskRoutes = require('./task');
const anniversaryRoutes = require('./anniversary');
const todoRoutes = require('./todo');
const logRoutes = require('./log');
const pushRoutes = require('./push');

const router = express.Router();

// 登录相关（无需鉴权）
router.use('/', authRoutes);

// 业务接口（需要登录）
router.use('/config', requireLogin, configRoutes);
router.use('/task', requireLogin, taskRoutes);
router.use('/anniversary', requireLogin, anniversaryRoutes);
router.use('/todo', requireLogin, todoRoutes);
router.use('/log', requireLogin, logRoutes);
router.use('/', requireLogin, pushRoutes);

module.exports = router;
