<?php
if (!defined('HC_ROOT')) { http_response_code(404); exit; }
return <<<'HC_SQL'
-- HeartCron 心时 数据库建表语句（MySQL 5.7+ / 8.0 / MariaDB 10.4+）
-- 共 5 张表：系统配置 / 定时任务 / 纪念日 / 待办事项 / 推送日志
-- 字符集统一 utf8mb4，支持中文与 emoji
-- 说明：脚本可重复执行（IF NOT EXISTS），不会覆盖已有数据

-- 表 1：system_config 系统全局配置（单行存储，id 恒为 1）
CREATE TABLE IF NOT EXISTS system_config (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  wx_pusher_apptoken VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'WxPusher AppToken',
  wx_pusher_uid      VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'WxPusher 接收用户 UID，多个用逗号分隔',
  wx_pusher_title    VARCHAR(255) NOT NULL DEFAULT 'HeartCron 心时 · 今日份关心' COMMENT '推送消息标题模板',
  push_mode          VARCHAR(16)  NOT NULL DEFAULT 'ai' COMMENT '推送内容模式：ai=大模型生成，template=固定模板',
  push_template      TEXT         NULL COMMENT '固定模板内容，支持 {{变量}} 与 {{变量.DATA}} 写法',
  qweather_key       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '和风天气 Key',
  qweather_city_id   VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '和风天气城市 ID',
  ai_api_url         VARCHAR(500) NOT NULL DEFAULT '' COMMENT '大模型接口地址（OpenAI 兼容）',
  ai_api_key         VARCHAR(255) NOT NULL DEFAULT '' COMMENT '大模型 API Key',
  ai_model           VARCHAR(128) NOT NULL DEFAULT 'gpt-4o-mini' COMMENT '模型名称',
  ai_temperature     FLOAT        NOT NULL DEFAULT 0.8 COMMENT '0~1，随机性',
  ai_max_tokens      INT          NOT NULL DEFAULT 600 COMMENT '最大输出 token',
  ai_prompt_template TEXT         NULL COMMENT '完整 AI 提示词模板',
  boy_name           VARCHAR(64)  NOT NULL DEFAULT '我' COMMENT '男方昵称',
  girl_name          VARCHAR(64)  NOT NULL DEFAULT '宝贝' COMMENT '女方昵称',
  default_style      VARCHAR(32)  NOT NULL DEFAULT '温柔治愈' COMMENT '默认文案风格',
  love_start_date    VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '相恋开始日期 YYYY-MM-DD，用于 {{love}} / {{anniversary}}',
  birthday           VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '生日，YYYY-MM-DD 或 MM-DD，用于 {{birthday}} / {{individual}}',
  pay_day            TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '每月发薪日 1~31，0=未设置，用于 {{pay}}',
  love_message       TEXT         NULL COMMENT '每日一句集合，每行一条，用于 {{message}}',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统全局配置';

-- 表 2：remind_task 定时任务表
CREATE TABLE IF NOT EXISTS remind_task (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  task_name        VARCHAR(128) NOT NULL COMMENT '任务名称',
  cron_expr        VARCHAR(128) NOT NULL COMMENT 'cron 表达式（标准 6 位：秒 分 时 日 月 周）',
  push_time_period VARCHAR(32)  NOT NULL DEFAULT '早安' COMMENT '推送时段：早安 / 午间关心 / 晚安提醒',
  push_mode        VARCHAR(16) NOT NULL DEFAULT 'inherit' COMMENT 'inherit=全局配置，template=独立内容，ai=独立AI',
  push_title       VARCHAR(255) NOT NULL DEFAULT '',
  push_template    TEXT NULL,
  ai_prompt_template TEXT NULL,
  style_type       VARCHAR(32) NOT NULL DEFAULT '',
  wx_pusher_uid    VARCHAR(500) NOT NULL DEFAULT '',
  schedule_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enable           TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0/1 是否启用任务',
  remark           VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  PRIMARY KEY (id),
  KEY idx_remind_task_enable (enable)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定时任务';

-- 表 3：anniversary 纪念日表
CREATE TABLE IF NOT EXISTS anniversary (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  name           VARCHAR(128) NOT NULL COMMENT '纪念日名称，例：相识纪念日',
  target_date    DATE         NOT NULL COMMENT '日期 YYYY-MM-DD',
  enable         TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0/1 是否启用',
  show_countdown TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0/1 是否在 AI 文案中展示倒计时',
  PRIMARY KEY (id),
  KEY idx_anniversary_target_date (target_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='纪念日';

-- 表 4：todo_item 待办事项表
CREATE TABLE IF NOT EXISTS todo_item (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  content      VARCHAR(255) NOT NULL COMMENT '待办内容',
  enable       TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0/1 是否启用',
  only_workday TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '0/1 仅工作日推送：0=关闭，1=开启',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='待办事项';

-- 表 5：push_log 推送日志表
CREATE TABLE IF NOT EXISTS push_log (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  create_time  DATETIME     NOT NULL COMMENT '推送时间',
  weather_info TEXT         NULL COMMENT '本次天气信息',
  ai_content   TEXT         NULL COMMENT 'AI 生成的文案',
  status       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1=成功，0=失败',
  error_msg    TEXT         NULL COMMENT '失败错误信息',
  task_id      INT UNSIGNED NULL COMMENT '关联定时任务 ID（手动测试为 NULL）',
  push_title   VARCHAR(255) NOT NULL DEFAULT '',
  source       VARCHAR(16) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_push_log_create_time (create_time),
  KEY idx_push_log_task_id (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推送日志';

HC_SQL;
