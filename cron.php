<?php
declare(strict_types=1);
// CLI only: visiting this file cannot trigger a push or disclose credentials.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('HC_ROOT',__DIR__);
require __DIR__.'/php/bootstrap.php';
require __DIR__.'/php/cron.php';
require __DIR__.'/php/services.php';
$failed=false;
try {
    $db=hc_db(); $now=new DateTimeImmutable(); $minute=$now->format('Y-m-d H:i:00');
    hc_query("INSERT INTO hc_runtime (name,value) VALUES ('cron_heartbeat',?) ON DUPLICATE KEY UPDATE value=VALUES(value)",[$now->format(DATE_ATOM)]);
    foreach (hc_rows('SELECT * FROM remind_task WHERE enable=1') as $task) {
        try {
            $cron=hc_cron_parse($task['cron_expr']);
            if (!hc_cron_due($cron,$now)) continue;
            // A unique claim prevents double delivery if cron is invoked twice in a minute.
            $claim=hc_query('INSERT IGNORE INTO hc_cron_run (task_id,scheduled_minute) VALUES (?,?)',[(int)$task['id'],$minute]);
            if (!$claim->rowCount()) continue;
            $result=hc_push((int)$task['id'],$task['push_time_period'],'','schedule');
            if (!$result['success']) $failed=true;
            echo $minute.' task #'.$task['id'].' '.($result['success'] ? 'OK' : 'FAILED: '.$result['errorMsg']).PHP_EOL;
        } catch (Throwable $e) { $failed=true; error_log('HeartCron cron task #'.$task['id'].': '.$e->getMessage()); }
    }
    hc_query('DELETE FROM hc_cron_run WHERE scheduled_minute < ?',[$now->modify('-7 days')->format('Y-m-d H:i:s')]);
    echo 'HeartCron tick '.$minute.PHP_EOL;
} catch (Throwable $e) { $failed=true; error_log('HeartCron cron: '.$e->getMessage()); }
exit($failed ? 1 : 0);
