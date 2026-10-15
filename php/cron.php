<?php
if (!defined('HC_ROOT')) { http_response_code(404); exit; }

/** Minute resolution; seconds must be zero. Supports lists, ranges, steps and day L. */
function hc_cron_parse(string $expr): array {
    $parts = preg_split('/\s+/', trim($expr));
    if (count($parts) === 5) array_unshift($parts,'0');
    if (count($parts) !== 6 || $parts[0] !== '0') throw new InvalidArgumentException('PHP 定时任务按分钟执行，秒位必须为 0，例如 0 30 9 * * *');
    $bounds = [[0,0],[0,59],[0,23],[1,31],[1,12],[0,7]];
    $result = [];
    foreach ($parts as $i=>$part) {
        [$min,$max] = $bounds[$i];
        $values = [];
        foreach (explode(',',$part) as $segment) {
            if ($segment === 'L' && $i === 3) { $values[] = 'L'; continue; }
            if (!preg_match('/^(\*|\?|\d+(?:-\d+)?)(?:\/(\d+))?$/D',$segment,$m)) throw new InvalidArgumentException('cron 字段不合法：' . $part);
            $base = $m[1]; $step = isset($m[2]) ? (int)$m[2] : 1;
            if ($step < 1 || $step > max(1,$max)) throw new InvalidArgumentException('cron 间隔超出范围');
            if ($base === '?' && !in_array($i,[3,5],true)) throw new InvalidArgumentException('? 只能用于日或周');
            if ($base === '*' || $base === '?') { $start=$min; $end=$max; }
            else { $range=explode('-',$base); $start=(int)$range[0]; $end=isset($range[1]) ? (int)$range[1] : (isset($m[2]) ? $max : $start); }
            if ($start<$min || $end>$max || $start>$end) throw new InvalidArgumentException('cron 数值或区间超出范围');
            for ($n=$start;$n<=$end;$n+=$step) $values[] = $i===5 && $n===7 ? 0 : $n;
        }
        $result[] = array_values(array_unique($values,SORT_REGULAR));
    }
    return ['values'=>$result,'parts'=>$parts];
}
function hc_cron_day(array $cron, DateTimeImmutable $now): bool {
    $v=$cron['values']; $p=$cron['parts'];
    if (!in_array((int)$now->format('n'),$v[4],true)) return false;
    $day = in_array((int)$now->format('j'),$v[3],true) || (in_array('L',$v[3],true) && $now->format('j')===$now->format('t'));
    $week = in_array((int)$now->format('w'),$v[5],true);
    $dayWild = $p[3]==='*' || $p[3]==='?'; $weekWild = $p[5]==='*' || $p[5]==='?';
    return $dayWild ? $week : ($weekWild ? $day : ($day || $week));
}
function hc_cron_due(array $cron, DateTimeImmutable $now): bool {
    return hc_cron_day($cron,$now) && in_array((int)$now->format('G'),$cron['values'][2],true) && in_array((int)$now->format('i'),$cron['values'][1],true);
}
function hc_cron_next(string $expr, ?DateTimeImmutable $now=null): ?string {
    try { $cron=hc_cron_parse($expr); } catch (InvalidArgumentException $e) { return null; }
    $now=$now ?? new DateTimeImmutable(); $day=$now->setTime(0,0);
    $hours=$cron['values'][2]; $minutes=$cron['values'][1]; sort($hours); sort($minutes);
    // Eight years includes the longest leap-day gap around non-leap century years.
    for ($i=0;$i<2923;$i++,$day=$day->modify('+1 day')) {
        if (!hc_cron_day($cron,$day)) continue;
        foreach ($hours as $h) foreach ($minutes as $m) {
            $candidate=$day->setTime($h,$m);
            if ($candidate>$now) return $candidate->format(DATE_ATOM);
        }
    }
    return null;
}
function hc_scheduler_info(): array {
    $last=hc_row("SELECT value FROM hc_runtime WHERE name='cron_heartbeat'")['value'] ?? '';
    // BaoTa may disable escapeshellarg in PHP-FPM; this only formats a command.
    $quote=fn($s)=>"'".str_replace("'","'\\''",$s)."'";
    $command = '/www/server/php/' . PHP_MAJOR_VERSION . PHP_MINOR_VERSION . '/bin/php ' . $quote(HC_ROOT . '/cron.php');
    hc_query("INSERT IGNORE INTO hc_runtime (name,value) VALUES ('cron_access_key',?)",[bin2hex(random_bytes(32))]);
    $key=hc_row("SELECT value FROM hc_runtime WHERE name='cron_access_key'")['value'];
    $summary=json_decode(hc_row("SELECT value FROM hc_runtime WHERE name='cron_result'")['value'] ?? '{}',true) ?: [];
    $age=$last ? time()-strtotime($last) : null;
    return ['lastRun'=>$last,'healthy'=>$age!==null && $age>=0 && $age<180,'command'=>$command,
        'url'=>'./cron-url.php?key='.$key,'summary'=>$summary,'now'=>date(DATE_ATOM),'timezone'=>'Asia/Shanghai'];
}
function hc_scheduler_minutes(string $last,DateTimeImmutable $now): array {
    $current=$now->setTime((int)$now->format('G'),(int)$now->format('i'),0);
    $times=[$current]; $stamp=$last ? strtotime($last) : false;
    // Recover short delays, avoiding a flood after a long outage.
    if ($stamp!==false && $stamp<$current->getTimestamp() && $now->getTimestamp()-$stamp<=300) {
        $cursor=$current->setTimestamp((int)(floor($stamp/60)*60+60)); $times=[];
        for (;$cursor<=$current;$cursor=$cursor->modify('+1 minute')) $times[]=$cursor;
    }
    return $times;
}
function hc_scheduler_tick(string $source='cli',?DateTimeImmutable $now=null): array {
    $db=hc_db(); $now=$now ?? new DateTimeImmutable();
    $result=['time'=>$now->format(DATE_ATOM),'source'=>$source,'enabled'=>0,'due'=>0,'success'=>0,'failed'=>0,'errors'=>[],'skipped'=>false];
    $lock='heartcron_tick_'.substr(hash('sha256',(string)$db->query('SELECT DATABASE()')->fetchColumn()),0,24);
    if ((int)hc_query('SELECT GET_LOCK(?,0)',[$lock])->fetchColumn()!==1) { $result['skipped']=true; return $result; }
    try {
        $last=hc_row("SELECT value FROM hc_runtime WHERE name='cron_heartbeat'")['value'] ?? '';
        if ($source!=='manual') hc_query("INSERT INTO hc_runtime (name,value) VALUES ('cron_heartbeat',?) ON DUPLICATE KEY UPDATE value=VALUES(value)",[$now->format(DATE_ATOM)]);
        hc_query('UPDATE push_log SET status=0,error_msg=? WHERE status=2 AND create_time < ?',[
            '上次执行中断或超过十分钟，发送结果未知；请检查 PHP/宝塔日志，确认接收情况后再手动测试',$now->modify('-10 minutes')->format('Y-m-d H:i:s')]);
        $times=hc_scheduler_minutes($last,$now);
        $tasks=hc_rows('SELECT * FROM remind_task WHERE enable=1'); $result['enabled']=count($tasks);
        foreach ($tasks as $task) {
            try { $cron=hc_cron_parse($task['cron_expr']); }
            catch (Throwable $e) {
                $claim=hc_query('INSERT IGNORE INTO hc_cron_run (task_id,scheduled_minute) VALUES (?,?)',[(int)$task['id'],$now->format('Y-m-d H:i:00')]);
                if ($claim->rowCount()) {
                    hc_log_failure((int)$task['id'],'定时表达式无效：'.$e->getMessage()); $result['failed']++;
                    $result['errors'][]='任务 #'.$task['id'].' 的定时表达式无效，请编辑后保存';
                }
                continue;
            }
            foreach ($times as $minute) {
                if (!empty($task['schedule_updated_at']) && $minute->format('Y-m-d H:i')<substr($task['schedule_updated_at'],0,16)) continue;
                if (!hc_cron_due($cron,$minute)) continue;
                $claim=hc_query('INSERT IGNORE INTO hc_cron_run (task_id,scheduled_minute) VALUES (?,?)',[(int)$task['id'],$minute->format('Y-m-d H:i:00')]);
                if (!$claim->rowCount()) continue;
                $result['due']++;
                try {
                    $push=hc_push((int)$task['id'],$task['push_time_period'],'','schedule');
                    $result[$push['success'] ? 'success' : 'failed']++;
                    if (!$push['success']) $result['errors'][]='任务 #'.$task['id'].'：'.$push['errorMsg'];
                } catch (Throwable $e) {
                    $result['failed']++; $result['errors'][]='任务 #'.$task['id'].' 执行异常，请检查 PHP 错误日志';
                    error_log('HeartCron task #'.$task['id'].': '.$e->getMessage());
                    hc_log_failure((int)$task['id'],'调度执行异常，请检查 PHP 错误日志');
                }
            }
        }
        hc_query('DELETE FROM hc_cron_run WHERE scheduled_minute < ?',[$now->modify('-7 days')->format('Y-m-d H:i:s')]);
    } catch (Throwable $e) {
        $result['failed']++; $result['errors'][]='调度异常，请检查数据库权限与 PHP 错误日志';
        error_log('HeartCron scheduler: '.$e->getMessage());
    } finally {
        try { hc_query("INSERT INTO hc_runtime (name,value) VALUES ('cron_result',?) ON DUPLICATE KEY UPDATE value=VALUES(value)",[json_encode($result,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE)]); }
        finally { hc_query('SELECT RELEASE_LOCK(?)',[$lock]); }
    }
    return $result;
}
