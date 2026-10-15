/**
 * 敏感信息掩码工具
 * 规则：接口返回时把密钥做掩码；前端提交掩码值时视为「不修改原值」
 */

/**
 * 对密钥做掩码展示，如 sk-abcd****wxyz
 * @param {string} value 原始值
 * @returns {string}
 */
function maskSecret(value) {
  if (!value) return '';
  const str = String(value);
  if (str.length <= 8) return '********';
  return str.slice(0, 4) + '****' + str.slice(-4);
}

/**
 * 判断一个值是否是掩码值（前端未修改密钥时会原样回传掩码）
 * @param {any} value
 * @returns {boolean}
 */
function isMaskedValue(value) {
  return typeof value === 'string' && value.includes('****');
}

module.exports = { maskSecret, isMaskedValue };
