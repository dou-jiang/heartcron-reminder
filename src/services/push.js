/**
 * 推送主链路：读取配置 → 天气 → 纪念日 → 待办 → AI 生成文案 → WxPusher 推送 → 写入日志
 * 定时任务与【一键测试推送】共用本模块，保证两条路径逻辑完全一致
 */
const { all, run, getConfigRow } = require('../db');
const { getWeather } = require('./weather');
const { getAIMessage } = require('./ai');
const { sendWxPusher } = require('./wxpusher');
const { renderPromptTemplate } = require('./prompt');
const { calcAnniversaryList, EMPTY_ANNIVERSARY_TEXT } = require('./anniversary');
const { getTodoList, EMPTY_TODO_TEXT } = require('./todo');
const { formatDateCN, formatDateTime } = require('../utils/date');
const { DEFAULT_PROMPT_TEMPLATE, FALLBACK_ENDINGS, FALLBACK_WEATHER_EMPTY } = require('../config/defaultPrompt');
const { DEFAULT_PUSH_TITLE, DEFAULT_STYLE } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * AI 调用失败时，用内置素材拼出一条备用暖心文案，保证推送内容不空白
 * @param {Object} data 模板变量表
 * @returns {string}
 */
function pickFallbackContent(data) {
  const boy = data.boy_name || '我';
  const girl = data.girl_name || '宝贝';
  const period = data.push_time_period || '今日';
  const weatherOk = data.weather_info && !String(data.weather_info).startsWith('（');
  const todoOk = data.todo_list && data.todo_list !== EMPTY_TODO_TEXT;
  const anniversaryOk = data.anniversary_list && data.anniversary_list !== EMPTY_ANNIVERSARY_TEXT;

  const sentences = [`${period}好呀 ${girl}，这是 ${boy} 的今日份关心。`];
  if (weatherOk) sentences.push(`今天${data.weather_info}。`);
  else sentences.push(FALLBACK_WEATHER_EMPTY);
  if (anniversaryOk) sentences.push(`${data.anniversary_list}，我替你记着呢。`);
  if (todoOk) sentences.push(`今天也别忘了：${data.todo_list}。`);
  sentences.push(FALLBACK_ENDINGS[Math.floor(Math.random() * FALLBACK_ENDINGS.length)]);

  return sentences.join('');
}

/**
 * 收集本次推送所需的全部变量
 * @param {Object} options
 * @param {string} options.period 推送时段
 * @param {string} options.styleType 文案风格
 * @returns {Promise<{cfg:Object, data:Object, weatherInfo:string, weatherRaw:Object|null}>}
 */
async function collectPromptData({ period, styleType, cfg: presetCfg }) {
  const cfg = presetCfg || (await getConfigRow());

  // 天气：未配置或请求失败都不阻断推送，仅降级天气文本
  let weatherInfo = '（天气信息不可用）';
  let weatherRaw = null;
  try {
    const weather = await getWeather(cfg.qweather_key, cfg.qweather_city_id);
    weatherInfo = weather.text;
    weatherRaw = weather.raw;
  } catch (err) {
    weatherInfo = '（天气信息获取失败）';
    logger.warn('获取天气失败：' + err.message);
  }

  const anniversaryRows = await all('SELECT * FROM anniversary');
  const todoRows = await all('SELECT * FROM todo_item');

  const data = {
    boy_name: cfg.boy_name || '我',
    girl_name: cfg.girl_name || '宝贝',
    today_date: formatDateCN(),
    weather_info: weatherInfo,
    anniversary_list: calcAnniversaryList(anniversaryRows),
    todo_list: getTodoList(todoRows),
    push_time_period: period || '早安',
    style_type: styleType || cfg.default_style || DEFAULT_STYLE,
  };

  return { cfg, data, weatherInfo, weatherRaw };
}

/**
 * 写入推送日志
 * @param {Object} log
 * @returns {Promise<void>}
 */
async function savePushLog(log) {
  try {
    await run(
      `INSERT INTO push_log (create_time, weather_info, ai_content, status, error_msg, task_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        log.createTime,
        log.weatherInfo || '',
        log.content || '',
        log.success ? 1 : 0,
        log.errorMsg || '',
        log.taskId === undefined ? null : log.taskId,
      ]
    );
  } catch (err) {
    logger.error('写入推送日志失败：' + err.message);
  }
}

/**
 * 执行完整推送链路
 * @param {Object} [options]
 * @param {number|null} [options.taskId] 关联的定时任务 ID（手动测试为 null）
 * @param {string} [options.period] 推送时段
 * @param {string} [options.styleType] 文案风格（默认取系统配置）
 * @param {string} [options.source] 触发来源：schedule=定时任务，manual=一键测试
 * @returns {Promise<{success:boolean, content:string, weatherInfo:string, errorMsg:string, createTime:string, source:string}>}
 */
async function runPushFlow({ taskId = null, period = '', styleType = '', source = 'schedule' } = {}) {
  const createTime = formatDateTime();
  const result = {
    success: false,
    content: '',
    weatherInfo: '',
    errorMsg: '',
    createTime,
    source,
    taskId: taskId === undefined ? null : taskId,
  };

  try {
    const cfg = await getConfigRow();

    // 推送通道未配置时直接失败，避免无意义地调用天气与 AI 接口
    if (!cfg.wx_pusher_apptoken) throw new Error('未配置 WxPusher AppToken，请先到「全局配置」填写并保存');
    if (!cfg.wx_pusher_uid) throw new Error('未配置 WxPusher UID，请先到「全局配置」填写并保存');

    const { data, weatherInfo } = await collectPromptData({ period, styleType, cfg });
    result.weatherInfo = weatherInfo;

    const promptTemplate = cfg.ai_prompt_template || DEFAULT_PROMPT_TEMPLATE;
    const fullPrompt = renderPromptTemplate(promptTemplate, data);

    // AI 调用失败时使用内置备用文案兜底，保证推送不空白
    let aiFailedReason = '';
    try {
      result.content = await getAIMessage(cfg, fullPrompt);
    } catch (err) {
      aiFailedReason = err.message;
      logger.warn('AI 文案生成失败，使用备用文案兜底：' + err.message);
      result.content = pickFallbackContent(data);
    }

    const title = renderPromptTemplate(cfg.wx_pusher_title || DEFAULT_PUSH_TITLE, data);
    await sendWxPusher({
      appToken: cfg.wx_pusher_apptoken,
      uid: cfg.wx_pusher_uid,
      title,
      content: result.content,
    });

    result.success = true;
    result.errorMsg = aiFailedReason ? `AI 调用失败，已使用备用文案：${aiFailedReason}` : '';
    logger.info(`推送成功（${source}）：${result.content.slice(0, 40)}...`);
  } catch (err) {
    result.success = false;
    result.errorMsg = err.message || '推送失败';
    logger.error('推送失败：' + result.errorMsg);
  }

  await savePushLog({
    createTime,
    weatherInfo: result.weatherInfo,
    content: result.content,
    success: result.success,
    errorMsg: result.errorMsg,
    taskId,
  });

  return result;
}

module.exports = { runPushFlow, collectPromptData, pickFallbackContent };
