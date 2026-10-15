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
    $command = '/www/server/php/' . PHP_MAJOR_VERSION . PHP_MINOR_VERSION . '/bin/php ' . escapeshellarg(HC_ROOT . '/cron.php');
    $age=$last ? time()-strtotime($last) : null;
    return ['lastRun'=>$last,'healthy'=>$age!==null && $age>=0 && $age<180,'command'=>$command];
}
