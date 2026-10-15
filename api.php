<?php
declare(strict_types=1);
define('HC_ROOT',__DIR__);
require __DIR__.'/php/bootstrap.php';
require __DIR__.'/php/cron.php';
require __DIR__.'/php/services.php';
require __DIR__.'/php/api.php';
if (function_exists('set_time_limit')) set_time_limit(240);
try { hc_api(); } catch (Throwable $e) { hc_error($e); }
