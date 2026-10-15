<?php
if (!defined('HC_ROOT')) { http_response_code(404); exit; }
return json_decode(<<<'HC_JSON'
{
  "DEFAULT_PROMPT_TEMPLATE": "# 人设\n你是【{{boy_name}}】，一名程序员，对女朋友【{{girl_name}}】细心温柔，表达内敛真诚，带有一点程序员式的浪漫，不要油腻土味情话，不要长篇大论，文字适合微信消息阅读，控制在80~160字，每次生成内容不重复。\n\n本消息由 HeartCron「心时」暖心调度系统生成。\nHeartCron 是一个后台运行的定时守护服务，按照设定时间收集天气、纪念日和待办事项，并生成专属关心消息。\n文案中可以偶尔轻量地融入 HeartCron 小彩蛋，但不要频繁出现，不要生硬广告，保持自然、温柔、像男朋友在说话。\n\n# 当前信息\n今日日期：{{today_date}}\n目标城市天气：{{weather_info}}\n纪念日倒计时列表：{{anniversary_list}}\n今日需要提醒事项：{{todo_list}}\n推送时段：{{push_time_period}}\n文案风格：{{style_type}}\n\n# 规则强制遵守\n1. 优先结合天气情况给出关心：下雨提醒带伞；降温提醒多穿衣服；高温提醒防晒补水；有天气预警一定要重点提醒。\n2. 如果有纪念日倒计时，自然融入文字，不要生硬单独罗列。\n3. 把待办事项温柔提醒，不是命令，是关心叮嘱。\n4. 程序员小浪漫彩蛋：可以偶尔轻描淡写加入一点点程序员小梗，例如\"今日bug清零，温柔优先级最高\"\"后台一直在线，关心永不超时\"\"把你存进最高优先级任务队列\"等，但不要太多，随机出现。\n5. 禁止生硬列表输出，整合为一段自然连贯的话。\n6. 不要出现过多表情，少量即可；不要重复模板句式，每次表达角度不一样。\n7. 兜底：如果没有待办、没有纪念日，就单纯根据天气表达关心。\n8. 输出只返回最终消息正文，不要额外解释，不要前言后语，不要markdown。",
  "FALLBACK_WEATHER_EMPTY": "今天的天气我还没查到，出门前记得看一眼窗外。",
  "FALLBACK_ENDINGS": [
    "后台一直在线，关心永不超时。",
    "今日 bug 清零，温柔优先级最高。",
    "慢慢来，不用一次做完，我一直在线。",
    "把你存进最高优先级任务队列，先照顾好自己。"
  ],
  "samples": [
    {
      "key": "daily",
      "name": "元气提醒",
      "description": "日常关心：日期、相恋天数、发薪日、生日倒计时、天气与每日一句",
      "content": "{{dateTime.DATA}}\n今天是 我们相恋的第{{love.DATA}}天\n距离上交工资还有{{pay.DATA}}天\n距离你的生日还有{{birthday.DATA}}天\n今日天气 {{weather.DATA}}\n今日温度 {{temp.DATA}}度\n空气湿度 {{humidity.DATA}}\n风向 {{wind.DATA}}\n每日一句\n{{message.DATA}}"
    },
    {
      "key": "pay",
      "name": "工资模板",
      "description": "发薪日当天推送，也可以在定时任务里配成每月发薪日的 cron",
      "content": "{{dateTime.DATA}}\n亲爱的，今天要发工资了，咱们账户上又多了一笔！注意查收~！"
    },
    {
      "key": "birthday",
      "name": "生日模板",
      "description": "生日当天推送，{{individual}} 是「人生中的第几个生日」",
      "content": "{{dateTime.DATA}}\n听说今天是你人生当中第 {{individual.DATA}} 个生日？\n天呐， 我差点忘记！因为你永远18岁~。\n尽管，日历告诉我：你又涨了一岁，但你还是那个天真可爱的小仙女，生日快乐!"
    },
    {
      "key": "anniversary",
      "name": "纪念日模板",
      "description": "相恋周年当天推送，{{anniversary}} 是周年数",
      "content": "{{dateTime.DATA}}\n今天是在一起{{anniversary.DATA}}周年纪念日。\n经历了风风雨雨,最终依然走在一起,很幸运,很幸福!我们的小家庭要一直幸福下去。"
    }
  ]
}
HC_JSON, true);
