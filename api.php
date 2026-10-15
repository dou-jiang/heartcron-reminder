<?php
declare(strict_types=1);
define('HC_ROOT',__DIR__);
require __DIR__.'/php/bootstrap.php';
require __DIR__.'/php/cron.php';
require __DIR__.'/php/services.php';
require __DIR__.'/php/api.php';
set_time_limit(120);
try { hc_api(); } catch (Throwable $e) { hc_error($e); }
