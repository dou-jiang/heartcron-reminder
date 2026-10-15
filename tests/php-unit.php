<?php
// Run: php tests/php-unit.php. No database or third-party credentials needed.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('HC_ROOT',dirname(__DIR__));
require HC_ROOT.'/php/bootstrap.php';
require HC_ROOT.'/php/cron.php';
require HC_ROOT.'/php/services.php';
$count=0;
function check($actual,$expected,string $label): void {
    global $count;
    if ($actual!==$expected) throw new RuntimeException($label.': expected '.var_export($expected,true).', got '.var_export($actual,true));
    $count++;
}
check(hc_render('{{love}} / {{ love.DATA }} / {{unknown}}',['love'=>12]),'12 / 12 / ','Template syntax');
check(hc_date_valid('2026-02-29'),false,'Invalid date');
check(hc_date_valid('2024-02-29'),true,'Leap date');
$v=hc_fixed_vars(['love_start_date'=>'2024-02-28','birthday'=>'2000-02-29','pay_day'=>31,'love_message'=>'hello'],[],['now'=>['temp'=>'0','humidity'=>'0']],new DateTimeImmutable('2025-02-28 09:00:00'));
check($v['love'],'367','Love includes today');
check($v['anniversary'],'1','Completed years');
check($v['birthday'],'0','Leap birthday on non-leap year');
check($v['individual'],'26','Birthday ordinal includes birth');
check($v['pay'],'0','Payday clamped to last day');
check($v['temp'],'0','Zero temperature');
check($v['humidity'],'0','Zero humidity');
check(hc_fixed_vars(['pay_day'=>31],[],null,new DateTimeImmutable('2026-04-30'))['pay'],'0','Month end payday');
check(hc_fixed_vars(['pay_day'=>31],[],null,new DateTimeImmutable('2026-03-01'))['pay'],'30','Next month after February');
check(hc_fixed_vars(['love_start_date'=>'2099-01-01'],[],null,new DateTimeImmutable('2026-10-15'))['love'],'—','Future love date');
check(hc_cron_next('0 30 9 * * *',new DateTimeImmutable('2026-10-15 09:30:00')),'2026-10-16T09:30:00+08:00','Next run is strictly later');
check(hc_cron_next('0 0 9 L * *',new DateTimeImmutable('2026-02-01')),'2026-02-28T09:00:00+08:00','Last day cron');
check(hc_cron_next('0 0 9 29 2 *',new DateTimeImmutable('2096-03-01')),'2104-02-29T09:00:00+08:00','Century leap gap');
check(hc_cron_next('0 0 9 31 2 *',new DateTimeImmutable('2026-01-01')),null,'Impossible date');
check(hc_cron_due(hc_cron_parse('*/5 * * * *'),new DateTimeImmutable('2026-10-15 09:35:25')),true,'Five fields and delayed minute tick');
check(hc_cron_due(hc_cron_parse('0 0 9 15 * 1'),new DateTimeImmutable('2026-10-15 09:00:00')),true,'Day and week use OR');
check(hc_cron_due(hc_cron_parse('0 0 9 * * 7'),new DateTimeImmutable('2026-10-18 09:00:00')),true,'Sunday 7');
foreach (['* * * * * *','1 0 9 * * *','0 70 9 * * *','0 30 9 * * 5-2','0 */0 * * * *','0 0 9 1-99 * *'] as $bad) {
    try { hc_cron_parse($bad); throw new RuntimeException('Accepted bad cron: '.$bad); }
    catch (InvalidArgumentException $e) { $count++; }
}
echo "Passed $count PHP assertions\n";
