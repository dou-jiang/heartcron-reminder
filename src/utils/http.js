/**
 * 外部 HTTP 请求统一封装：统一超时、统一错误信息整理
 */
const axios = require('axios');
const config = require('../config');

/** 带默认超时的 axios 实例 */
const http = axios.create({
  timeout: config.httpTimeout,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * 把 axios 异常转换成便于排查的中文提示
 * @param {any} err 异常对象
 * @returns {string}
 */
function describeHttpError(err) {
  if (!err) return '未知错误';
  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
    return '请求超时（超过 ' + config.httpTimeout + 'ms）';
  }
  if (err.response) {
    const data = err.response.data;
    let detail = '';
    if (data && typeof data === 'object') {
      detail = data.message || data.error?.message || data.msg || JSON.stringify(data).slice(0, 300);
    } else if (typeof data === 'string') {
      detail = data.slice(0, 300);
    }
    return `HTTP ${err.response.status}${detail ? '：' + detail : ''}`;
  }
  return err.message || '网络请求失败';
}

module.exports = { http, describeHttpError };
