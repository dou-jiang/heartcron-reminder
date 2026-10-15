-- HeartCron 心时 数据库建表语句（SQLite）
-- 共 5 张表：系统配置 / 定时任务 / 纪念日 / 待办事项 / 推送日志

-- 表 1：system_config 系统全局配置（单行存储，id 恒为 1）
CREATE TABLE IF NOT EXISTS system_config (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  wx_pusher_apptoken TEXT DEFAULT '',                                  -- WxPusher AppToken
  wx_pusher_uid      TEXT DEFAULT '',                                  -- WxPusher 接收用户 UID（多个用逗号分隔）
  wx_pusher_title    TEXT DEFAULT 'HeartCron 心时 · 今日份关心',        -- 推送消息标题模板
  qweather_key       TEXT DEFAULT '',                                  -- 和风天气 Key
  qweather_city_id   TEXT DEFAULT '',                                  -- 和风天气城市 ID
  ai_api_url         TEXT DEFAULT '',                                  -- 大模型接口地址（OpenAI 兼容）
  ai_api_key         TEXT DEFAULT '',                                  -- 大模型 API Key
  ai_model           TEXT DEFAULT 'gpt-4o-mini',                       -- 模型名称
  ai_temperature     REAL DEFAULT 0.8,                                 -- 0~1，随机性
  ai_max_tokens      INTEGER DEFAULT 600,                              -- 最大输出 token
  ai_prompt_template TEXT DEFAULT '',                                  -- 完整 AI 提示词模板
  boy_name           TEXT DEFAULT '我',                                 -- 男方昵称 {{boy_name}}
  girl_name          TEXT DEFAULT '宝贝',                               -- 女方昵称 {{girl_name}}
  default_style      TEXT DEFAULT '温柔治愈'                            -- 默认文案风格
);

-- 表 2：remind_task 定时任务表
CREATE TABLE IF NOT EXISTS remind_task (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  task_name        TEXT NOT NULL,                -- 任务名称
  cron_expr        TEXT NOT NULL,                -- cron 表达式（标准 6 位：秒 分 时 日 月 周）
  push_time_period TEXT DEFAULT '早安',           -- 推送时段：早安 / 午间关心 / 晚安提醒
  enable           INTEGER DEFAULT 1,            -- 0/1 是否启用任务
  remark           TEXT DEFAULT ''               -- 备注
);

-- 表 3：anniversary 纪念日表
CREATE TABLE IF NOT EXISTS anniversary (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,                  -- 纪念日名称，例：相识纪念日
  target_date    TEXT NOT NULL,                  -- 日期 YYYY-MM-DD
  enable         INTEGER DEFAULT 1,              -- 0/1 是否启用
  show_countdown INTEGER DEFAULT 1               -- 0/1 是否在 AI 文案中展示倒计时
);

-- 表 4：todo_item 待办事项表
CREATE TABLE IF NOT EXISTS todo_item (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  content      TEXT NOT NULL,                    -- 待办内容
  enable       INTEGER DEFAULT 1,                -- 0/1 是否启用
  only_workday INTEGER DEFAULT 0                 -- 0/1 仅工作日推送：0=关闭，1=开启
);

-- 表 5：push_log 推送日志表
CREATE TABLE IF NOT EXISTS push_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  create_time  TEXT DEFAULT '',                  -- 推送时间 YYYY-MM-DD HH:mm:ss
  weather_info TEXT DEFAULT '',                  -- 本次天气信息
  ai_content   TEXT DEFAULT '',                  -- AI 生成的文案
  status       INTEGER DEFAULT 0,                -- 1=成功，0=失败
  error_msg    TEXT DEFAULT '',                  -- 失败错误信息
  task_id      INTEGER DEFAULT NULL              -- 关联定时任务 ID
);

-- 常用查询索引：日志按时间倒序分页
CREATE INDEX IF NOT EXISTS idx_push_log_create_time ON push_log (create_time DESC);
CREATE INDEX IF NOT EXISTS idx_remind_task_enable ON remind_task (enable);
