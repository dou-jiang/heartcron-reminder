/**
 * 业务常量：推送时段、文案风格、默认推送标题等
 */

/** 推送时段（对应 {{push_time_period}} 变量） */
const PUSH_TIME_PERIODS = ['早安', '午间关心', '晚安提醒'];

/** 文案风格（对应 {{style_type}} 变量） */
const STYLE_TYPES = ['温柔治愈', '简短清爽', '俏皮可爱'];

/** 默认推送标题模板 */
const DEFAULT_PUSH_TITLE = 'HeartCron 心时 · 今日份关心';

/** 默认文案风格 */
const DEFAULT_STYLE = '温柔治愈';

/** 推送内容模式：ai = 大模型生成，template = 固定模板渲染 */
const PUSH_MODES = [
  { value: 'ai', label: 'AI 生成文案' },
  { value: 'template', label: '固定模板文案' },
];

/** 默认推送内容模式 */
const DEFAULT_PUSH_MODE = 'ai';

/** system_config 表允许写入的字段（白名单，防止越权写入任意列） */
const CONFIG_FIELDS = [
  'wx_pusher_apptoken',
  'wx_pusher_uid',
  'wx_pusher_title',
  'push_mode',
  'push_template',
  'qweather_key',
  'qweather_city_id',
  'ai_api_url',
  'ai_api_key',
  'ai_model',
  'ai_temperature',
  'ai_max_tokens',
  'ai_prompt_template',
  'boy_name',
  'girl_name',
  'default_style',
  'love_start_date',
  'birthday',
  'pay_day',
  'love_message',
];

/** 需要脱敏的敏感字段：接口返回时做掩码，更新时收到掩码值代表「不修改」 */
const SECRET_FIELDS = ['wx_pusher_apptoken', 'qweather_key', 'ai_api_key'];

/** 数值型配置字段 */
const NUMBER_FIELDS = ['ai_temperature', 'ai_max_tokens', 'pay_day'];

module.exports = {
  PUSH_TIME_PERIODS,
  STYLE_TYPES,
  DEFAULT_PUSH_TITLE,
  DEFAULT_STYLE,
  PUSH_MODES,
  DEFAULT_PUSH_MODE,
  CONFIG_FIELDS,
  SECRET_FIELDS,
  NUMBER_FIELDS,
};
