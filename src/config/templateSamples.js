/**
 * 内置固定模板示例
 * 采用原版 Vitality-reminder 的微信模板消息写法：{{变量}} 或 {{变量.DATA}} 都会被替换为真实数据。
 * 在后台「推送内容模式 → 固定模板」中可一键套用。
 */

/** 元气提醒（日常） */
const DAILY_TEMPLATE = [
  '{{dateTime.DATA}}',
  '今天是 我们相恋的第{{love.DATA}}天',
  '距离上交工资还有{{pay.DATA}}天',
  '距离你的生日还有{{birthday.DATA}}天',
  '今日天气 {{weather.DATA}}',
  '今日温度 {{temp.DATA}}度',
  '空气湿度 {{humidity.DATA}}',
  '风向 {{wind.DATA}}',
  '每日一句',
  '{{message.DATA}}',
].join('\n');

/** 工资模板 */
const PAY_TEMPLATE = [
  '{{dateTime.DATA}}',
  '亲爱的，今天要发工资了，咱们账户上又多了一笔！注意查收~！',
].join('\n');

/** 生日模板 */
const BIRTHDAY_TEMPLATE = [
  '{{dateTime.DATA}}',
  '听说今天是你人生当中第 {{individual.DATA}} 个生日？',
  '天呐， 我差点忘记！因为你永远18岁~。',
  '尽管，日历告诉我：你又涨了一岁，但你还是那个天真可爱的小仙女，生日快乐!',
].join('\n');

/** 纪念日模板 */
const ANNIVERSARY_TEMPLATE = [
  '{{dateTime.DATA}}',
  '今天是在一起{{anniversary.DATA}}周年纪念日。',
  '经历了风风雨雨,最终依然走在一起,很幸运,很幸福!我们的小家庭要一直幸福下去。',
].join('\n');

/** 模板示例列表（后台「插入示例模板」按钮与 README 共用同一份数据） */
const TEMPLATE_SAMPLES = [
  {
    key: 'daily',
    name: '元气提醒',
    description: '日常关心：日期、相恋天数、发薪日、生日倒计时、天气与每日一句',
    content: DAILY_TEMPLATE,
  },
  {
    key: 'pay',
    name: '工资模板',
    description: '发薪日当天推送，也可以在定时任务里配成每月发薪日的 cron',
    content: PAY_TEMPLATE,
  },
  {
    key: 'birthday',
    name: '生日模板',
    description: '生日当天推送，{{individual}} 是「人生中的第几个生日」',
    content: BIRTHDAY_TEMPLATE,
  },
  {
    key: 'anniversary',
    name: '纪念日模板',
    description: '相恋周年当天推送，{{anniversary}} 是周年数',
    content: ANNIVERSARY_TEMPLATE,
  },
];

/** 切换为固定模板模式时的默认模板 */
const DEFAULT_PUSH_TEMPLATE = DAILY_TEMPLATE;

module.exports = { TEMPLATE_SAMPLES, DEFAULT_PUSH_TEMPLATE };

