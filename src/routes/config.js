/**
 * 系统全局配置接口
 * GET /api/config  读取配置（敏感字段掩码返回）
 * PUT /api/config  更新配置（提交掩码值表示不修改该密钥）
 */
const express = require('express');

const { run, getConfigRow } = require('../db');
const { CONFIG_FIELDS, SECRET_FIELDS, NUMBER_FIELDS, PUSH_TIME_PERIODS, STYLE_TYPES } = require('../config/constants');
const { maskSecret, isMaskedValue } = require('../utils/mask');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * 把配置行转换为前端可安全展示的对象（密钥掩码）
 * @param {Object} row
 * @returns {Object}
 */
function toSafeConfig(row) {
  const safe = { ...row };
  SECRET_FIELDS.forEach((field) => {
    safe[field] = maskSecret(row[field]);
    safe[`${field}_configured`] = Boolean(row[field]);
  });
  return safe;
}

/**
 * 校验并转换待更新的配置项
 * @param {Object} body 请求体
 * @returns {{fields:string[], values:Array, errors:string[]}}
 */
function normalizeConfigPayload(body = {}) {
  const fields = [];
  const values = [];
  const errors = [];

  CONFIG_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(body, field)) return;
    let value = body[field];

    if (SECRET_FIELDS.includes(field)) {
      // 掩码值代表前端未修改该密钥，保持原值
      if (isMaskedValue(value)) return;
      value = value === undefined || value === null ? '' : String(value).trim();
    } else if (NUMBER_FIELDS.includes(field)) {
      const num = Number(value);
      if (Number.isNaN(num)) {
        errors.push(`${field} 必须是数字`);
        return;
      }
      if (field === 'ai_temperature' && (num < 0 || num > 1)) {
        errors.push('ai_temperature 取值范围为 0~1');
        return;
      }
      if (field === 'ai_max_tokens' && (num <= 0 || num > 100000)) {
        errors.push('ai_max_tokens 取值范围为 1~100000');
        return;
      }
      value = num;
    } else {
      value = value === undefined || value === null ? '' : String(value);
    }

    fields.push(field);
    values.push(value);
  });

  return { fields, values, errors };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const row = await getConfigRow();
    res.json({
      success: true,
      data: {
        config: toSafeConfig(row),
        options: { pushTimePeriods: PUSH_TIME_PERIODS, styleTypes: STYLE_TYPES },
      },
    });
  })
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const { fields, values, errors } = normalizeConfigPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join('；') });
    }
    if (!fields.length) {
      return res.status(400).json({ success: false, message: '没有需要更新的配置项' });
    }

    const setSql = fields.map((field) => `${field} = ?`).join(', ');
    await run(`UPDATE system_config SET ${setSql} WHERE id = 1`, values);

    const row = await getConfigRow();
    res.json({ success: true, data: { config: toSafeConfig(row) }, message: '配置已保存' });
  })
);

module.exports = router;
module.exports.toSafeConfig = toSafeConfig;
