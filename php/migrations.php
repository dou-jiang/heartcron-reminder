<?php
if (!defined('HC_ROOT')) { http_response_code(404); exit; }

// Runs once after an upload upgrade; existing configuration and task data stay intact.
function hc_migrate(PDO $db): void {
    $db->exec('CREATE TABLE IF NOT EXISTS hc_runtime (`name` VARCHAR(128) PRIMARY KEY, `value` TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $version='20261015_task_content_v1';
    $read=$db->prepare("SELECT value FROM hc_runtime WHERE name='schema_version'");
    $read->execute();
    if ($read->fetchColumn()===$version) return;
    $lock='heartcron_schema_'.substr(hash('sha256',(string)$db->query('SELECT DATABASE()')->fetchColumn()),0,24);
    $stmt=$db->prepare('SELECT GET_LOCK(?,10)'); $stmt->execute([$lock]);
    if ((int)$stmt->fetchColumn()!==1) throw new RuntimeException('数据表正在升级，请稍后刷新');
    try {
        $tables=[
            'remind_task'=>[
                'push_mode'=>"VARCHAR(16) NOT NULL DEFAULT 'inherit'",
                'push_title'=>"VARCHAR(255) NOT NULL DEFAULT ''",
                'push_template'=>'TEXT NULL',
                'ai_prompt_template'=>'TEXT NULL',
                'style_type'=>"VARCHAR(32) NOT NULL DEFAULT ''",
                'wx_pusher_uid'=>"VARCHAR(500) NOT NULL DEFAULT ''",
                'schedule_updated_at'=>'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            ],
            'push_log'=>[
                'push_title'=>"VARCHAR(255) NOT NULL DEFAULT ''",
                'source'=>"VARCHAR(16) NOT NULL DEFAULT ''",
            ],
        ];
        foreach ($tables as $table=>$fields) {
            $columns=$db->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($fields as $field=>$type) if (!in_array($field,$columns,true)) $db->exec("ALTER TABLE `$table` ADD COLUMN `$field` $type");
        }
        $db->exec('CREATE TABLE IF NOT EXISTS hc_cron_run (task_id INT UNSIGNED NOT NULL, scheduled_minute DATETIME NOT NULL, PRIMARY KEY(task_id,scheduled_minute)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $stmt=$db->prepare("INSERT INTO hc_runtime (name,value) VALUES ('schema_version',?) ON DUPLICATE KEY UPDATE value=VALUES(value)");
        $stmt->execute([$version]);
    } finally { $stmt=$db->prepare('SELECT RELEASE_LOCK(?)'); $stmt->execute([$lock]); }
}
