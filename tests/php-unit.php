<?php
// Run: php tests/php-unit.php. No database or third-party credentials needed.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('HC_ROOT',dirname(__DIR__));
require HC_ROOT.'/php/bootstrap.php';
require HC_ROOT.'/php/cron.php';
require HC_ROOT.'/php/services.php';
require HC_ROOT.'/php/api.php';
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
$global=['push_mode'=>'ai','push_template'=>'global text','ai_prompt_template'=>'global prompt','wx_pusher_title'=>'global title','wx_pusher_uid'=>'UID_global','default_style'=>'温柔治愈'];
check(hc_task_config($global,['push_mode'=>'inherit','push_template'=>'ignored'])['push_template'],'global text','Old tasks inherit global template');
$custom=hc_task_config($global,['push_mode'=>'template','push_template'=>'喝水提醒','push_title'=>'喝水','wx_pusher_uid'=>'UID_water']);
check($custom['push_mode'],'template','Independent task overrides AI global');
check($custom['push_template'],'喝水提醒','Task text overrides global text');
check($custom['wx_pusher_title'],'喝水','Task title');
check($custom['wx_pusher_uid'],'UID_water','Task recipient');
check(hc_task_config($global,['push_mode'=>'inherit','wx_pusher_uid'=>''])['wx_pusher_uid'],'UID_global','Blank recipient inherits');
check(hc_task_config($global,['push_mode'=>'ai','ai_prompt_template'=>'学习计划'])['ai_prompt_template'],'学习计划','Independent AI prompt');
$new=hc_task_fields(['task_name'=>'喝水','cron_expr'=>'*/10 * * * *','push_time_period'=>'喝水吃药','push_mode'=>'template','push_template'=>'照顾好自己']);
check($new['push_time_period'],'喝水吃药','Custom reminder scene');
check($new['cron_expr'],'0 */10 * * * *','Five fields normalized');
check(hc_task_fields(['task_name'=>'old','cron_expr'=>'0 0 8 * * *'])['push_mode'],'inherit','Old task API compatible');
foreach ([['push_mode'=>'invalid'],['push_mode'=>'template','push_template'=>' '],['push_mode'=>'ai','ai_prompt_template'=>''],['push_time_period'=>str_repeat('长',33)],['push_template'=>['invalid']]] as $fields) {
    try { hc_task_fields($fields+['task_name'=>'bad','cron_expr'=>'0 0 8 * * *']); throw new RuntimeException('Accepted invalid task fields'); }
    catch (InvalidArgumentException $e) { $count++; }
}
$tick=new DateTimeImmutable('2026-10-15 10:03:25');
check(array_map(fn($d)=>$d->format('H:i'),hc_scheduler_minutes('2026-10-15T10:00:12+08:00',$tick)),['10:01','10:02','10:03'],'Recover delayed minutes');
check(count(hc_scheduler_minutes('',$tick)),1,'First tick does not backfill');
check(count(hc_scheduler_minutes('2026-10-15T09:00:00+08:00',$tick)),1,'Long outage does not flood');
check(count(hc_scheduler_minutes('2026-10-15T10:04:00+08:00',$tick)),1,'Clock reversal');
check(hc_ai_url(' https://example.test/v1/ '),'https://example.test/v1/chat/completions','AI base URL');
check(hc_ai_url('https://example.test/v1/chat/completions/'),'https://example.test/v1/chat/completions','AI complete URL is not appended twice');
check(hc_upstream_error(['error'=>['message'=>'invalid sk-test-secret Bearer other-secret https://api.test/private']],['sk-test-secret']),'invalid [已隐藏] Bearer [已隐藏] [接口地址]','AI error redacts secrets');
foreach (['ftp://example.test','https://user:secret@example.test','https://example.test/v1?key=secret'] as $url) {
    try { hc_ai_url($url); throw new RuntimeException('Accepted invalid AI URL'); }
    catch (InvalidArgumentException $e) { $count++; }
}
echo "Passed $count PHP assertions\n";
