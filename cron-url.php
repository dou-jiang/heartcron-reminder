<?php
declare(strict_types=1);
define('HC_ROOT',__DIR__);
require __DIR__.'/php/bootstrap.php';
require __DIR__.'/php/cron.php';
require __DIR__.'/php/services.php';
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
try {
    if (!hc_installed() || !in_array($_SERVER['REQUEST_METHOD'],['GET','POST'],true)) { http_response_code(404); exit; }
    $key=$_GET['key'] ?? '';
    if (!is_string($key) || strlen($key)!==64) { http_response_code(404); exit; }
    $stored=hc_row("SELECT value FROM hc_runtime WHERE name='cron_access_key'")['value'] ?? '';
    if (!$stored || !hash_equals($stored,$key)) { http_response_code(404); exit; }
    if (function_exists('set_time_limit')) set_time_limit(240);
    $result=hc_scheduler_tick('url');
    hc_json(['success'=>$result['failed']===0,'data'=>$result],$result['failed'] ? 500 : 200);
} catch (Throwable $e) { hc_error($e); }
