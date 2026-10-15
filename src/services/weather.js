/**
 * 和风天气（QWeather）接入
 * 文档：https://dev.qweather.com/
 * 组合「实时天气 + 今日预报 + 灾害预警」为一段中文文本，供 {{weather_info}} 使用
 */
const { http } = require('../utils/http');
const logger = require('../utils/logger');

/** 和风天气 API 域名（开发版 Key 使用 devapi，商业版可换成 api.qweather.com） */
const QWEATHER_BASE = process.env.QWEATHER_BASE || 'https://devapi.qweather.com';

/** 城市名缓存：避免每次推送都调用城市查询接口 */
const cityNameCache = new Map();

/**
 * 发起一次和风天气请求，并校验业务返回码
 * @param {string} pathname 接口路径
 * @param {Object} params 查询参数
 * @returns {Promise<Object>}
 */
async function requestQWeather(pathname, params) {
  const res = await http.get(QWEATHER_BASE + pathname, { params });
  const data = res.data || {};
  if (String(data.code) !== '200') {
    throw new Error(`和风天气返回错误码 ${data.code}（请检查 Key 与城市 ID）`);
  }
  return data;
}

/**
 * 根据城市 ID 反查城市名称（带内存缓存）
 * @param {string} key 和风天气 Key
 * @param {string} cityId 城市 ID
 * @returns {Promise<string>}
 */
async function getCityName(key, cityId) {
  if (cityNameCache.has(cityId)) return cityNameCache.get(cityId);
  try {
    const data = await requestQWeather('/geo/v2/city/lookup', { location: cityId, key });
    const name = data.location && data.location[0] ? data.location[0].name : '';
    if (name) cityNameCache.set(cityId, name);
    return name;
  } catch (err) {
    logger.warn('和风天气城市查询失败：' + err.message);
    return '';
  }
}

/**
 * 拼接天气文本
 * @param {Object} params
 * @returns {string}
 */
function buildWeatherText({ cityName, now, today, warnings }) {
  const parts = [];
  parts.push(`${cityName || '目标城市'} ${now.text || ''} ${now.temp || '--'}℃`);
  if (now.feelsLike && now.feelsLike !== now.temp) parts.push(`体感 ${now.feelsLike}℃`);
  if (now.humidity) parts.push(`湿度 ${now.humidity}%`);
  if (now.windDir) parts.push(`${now.windDir}${now.windScale || ''}级`);
  if (today) {
    const range = `${today.tempMin || '--'}~${today.tempMax || '--'}℃`;
    const desc = [today.textDay, today.textNight && today.textNight !== today.textDay ? today.textNight : '']
      .filter(Boolean)
      .join('转');
    parts.push(`今日 ${range}${desc ? '，' + desc : ''}`);
    if (today.precip && Number(today.precip) > 0) parts.push(`预计降水 ${today.precip}mm`);
    if (today.uvIndex) parts.push(`紫外线指数 ${today.uvIndex}`);
  }
  if (warnings && warnings.length) {
    const warningText = warnings
      .map((w) => w.title || w.typeName)
      .filter(Boolean)
      .join('、');
    if (warningText) parts.push(`⚠️天气预警：${warningText}`);
  }
  return parts.join('，');
}

/**
 * 获取整理后的天气信息
 * @param {string} qweatherKey 和风天气 Key
 * @param {string} cityId 和风天气城市 ID
 * @returns {Promise<{ok:boolean, text:string, raw:Object|null}>}
 */
async function getWeather(qweatherKey, cityId) {
  if (!qweatherKey || !cityId) {
    return { ok: false, text: '（未配置和风天气，本次不含天气信息）', raw: null };
  }

  const [cityName, nowData, dailyData, warningData] = await Promise.all([
    getCityName(qweatherKey, cityId),
    requestQWeather('/v7/weather/now', { location: cityId, key: qweatherKey }),
    requestQWeather('/v7/weather/3d', { location: cityId, key: qweatherKey }).catch(() => null),
    requestQWeather('/v7/warning/now', { location: cityId, key: qweatherKey }).catch(() => null),
  ]);

  const now = nowData.now || {};
  const today = dailyData && dailyData.daily ? dailyData.daily[0] : null;
  const warnings = (warningData && warningData.warning) || [];
  const text = buildWeatherText({ cityName, now, today, warnings });

  return { ok: true, text, raw: { cityName, now, today, warnings } };
}

module.exports = { getWeather, QWEATHER_BASE };
