/**
 * WxPusher 微信推送接入
 * POST https://wxpusher.zjiecode.com/api/send/message
 */
const { http } = require('../utils/http');

/** WxPusher 推送接口地址 */
const WXPUSHER_SEND_URL = 'https://wxpusher.zjiecode.com/api/send/message';

/**
 * 解析 UID 字符串，支持中英文逗号、分号、空格分隔的多个 UID
 * @param {string} uid
 * @returns {string[]}
 */
function parseUids(uid) {
  return String(uid || '')
    .split(/[,，;；\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 发送微信消息
 * @param {Object} params
 * @param {string} params.appToken WxPusher AppToken
 * @param {string} params.uid 接收用户 UID（可多个）
 * @param {string} params.title 消息标题
 * @param {string} params.content 消息正文
 * @returns {Promise<{ok:boolean, raw:Object}>}
 */
async function sendWxPusher({ appToken, uid, title, content }) {
  if (!appToken) throw new Error('未配置 WxPusher AppToken');
  const uids = parseUids(uid);
  if (!uids.length) throw new Error('未配置 WxPusher UID');
  if (!content) throw new Error('推送内容为空，已取消发送');

  const res = await http.post(WXPUSHER_SEND_URL, {
    appToken,
    uids,
    title: title || 'HeartCron 心时',
    content,
    contentType: 1,
  });

  const data = res.data || {};
  if (data.code !== 1000) {
    throw new Error(`WxPusher 推送失败（code=${data.code}）：${data.msg || '未知原因'}`);
  }
  return { ok: true, raw: data };
}

module.exports = { sendWxPusher, parseUids, WXPUSHER_SEND_URL };
