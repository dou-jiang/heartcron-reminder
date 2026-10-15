<?php
declare(strict_types=1);
// CLI only: visiting this file cannot trigger a push or disclose credentials.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('HC_ROOT',__DIR__);
require __DIR__.'/php/bootstrap.php';
require __DIR__.'/php/cron.php';
require __DIR__.'/php/services.php';
try {
    $result=hc_scheduler_tick('cli');
    echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL;
    exit($result['failed'] ? 1 : 0);
} catch (Throwable $e) {
    error_log('HeartCron cron: '.$e->getMessage());
    fwrite(STDERR,"HeartCron 调度启动失败，请检查 PHP 扩展、config.php 与数据库权限。\n");
    exit(1);
}
