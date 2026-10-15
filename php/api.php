<?php
if (!defined('HC_ROOT')) { http_response_code(404); exit; }

function hc_safe_config(array $row): array {
    foreach (['wx_pusher_apptoken','qweather_key','ai_api_key'] as $field) {
        $secret=(string)($row[$field] ?? ''); $row[$field.'_configured']=$secret!=='';
        $row[$field]=$secret==='' ? '' : (strlen($secret)<=8 ? '********' : substr($secret,0,4).'****'.substr($secret,-4));
    }
    $row['ai_temperature']=(float)$row['ai_temperature'];
    $row['ai_max_tokens']=(int)$row['ai_max_tokens']; $row['pay_day']=(int)$row['pay_day'];
    return $row;
}
function hc_update_config(array $body): array {
    $limits=['wx_pusher_apptoken'=>255,'wx_pusher_uid'=>500,'wx_pusher_title'=>255,'push_mode'=>16,'push_template'=>16000,
        'qweather_key'=>255,'qweather_city_id'=>64,'qweather_host'=>255,'ai_api_url'=>500,'ai_api_key'=>255,'ai_model'=>128,
        'ai_temperature'=>20,'ai_max_tokens'=>20,'ai_prompt_template'=>16000,'boy_name'=>64,'girl_name'=>64,'default_style'=>32,
        'love_start_date'=>10,'birthday'=>10,'pay_day'=>2,'love_message'=>16000];
    $updates=[]; $args=[];
    foreach ($limits as $field=>$limit) {
        if (!array_key_exists($field,$body)) continue;
        if (!is_scalar($body[$field]) && $body[$field]!==null) throw new InvalidArgumentException('配置字段格式不正确');
        $value=trim((string)($body[$field] ?? ''));
        if (in_array($field,['wx_pusher_apptoken','qweather_key','ai_api_key'],true) && strpos($value,'****')!==false) continue;
        if (mb_strlen($value)>$limit) throw new InvalidArgumentException($field.' 内容过长');
        if (in_array($field,['ai_temperature','ai_max_tokens','pay_day'],true)) {
            if (!is_numeric($value)) throw new InvalidArgumentException($field.' 必须是数字');
            $n=(float)$value;
            if (($field==='ai_temperature' && ($n<0 || $n>1)) || ($field==='ai_max_tokens' && ($n<1 || $n>100000 || floor($n)!==$n)) ||
                ($field==='pay_day' && ($n<0 || $n>31 || floor($n)!==$n))) throw new InvalidArgumentException($field.' 超出有效范围');
            $value=$field==='ai_temperature' ? $n : (int)$n;
        }
        if ($field==='push_mode' && !in_array($value,['ai','template'],true)) throw new InvalidArgumentException('内容模式不正确');
        if ($field==='default_style' && !in_array($value,hc_options()['styleTypes'],true)) throw new InvalidArgumentException('文案风格不正确');
        if ($field==='love_start_date' && $value && !hc_date_valid($value)) throw new InvalidArgumentException('相恋日期不正确');
        if ($field==='birthday' && $value && !hc_date_valid($value) && !hc_date_valid('2000-'.$value)) throw new InvalidArgumentException('生日不正确');
        if ($field==='qweather_host' && $value) {
            $value=preg_replace('#^https://#','',rtrim($value,'/'));
            if (!preg_match('/^[a-zA-Z0-9.-]+\.qweatherapi\.com$/D',$value)) throw new InvalidArgumentException('请填写和风天气控制台提供的 API Host（xxx.qweatherapi.com）');
        }
        if ($field==='ai_api_url' && $value && !preg_match('#^https?://[^\s]+$#i',$value)) throw new InvalidArgumentException('大模型接口地址不正确');
        if (in_array($field,['qweather_key','ai_api_key'],true) && preg_match('/[\r\n]/',$value)) throw new InvalidArgumentException('密钥不能包含换行');
        $updates[]="`$field`=?"; $args[]=$value;
    }
    if (!$updates) return hc_safe_config(hc_config());
    hc_query('UPDATE system_config SET '.implode(',',$updates).' WHERE id=1',$args);
    return hc_safe_config(hc_config());
}
function hc_view(string $resource,array $row): array {
    foreach (['id','enable','show_countdown','only_workday','status'] as $key) if (isset($row[$key])) $row[$key]=(int)$row[$key];
    if ($resource==='task') {
        $row['next_run']=$row['enable'] ? hc_cron_next($row['cron_expr']) : null;
        try { hc_cron_parse($row['cron_expr']); $row['schedule_error']=''; } catch (InvalidArgumentException $e) { $row['schedule_error']=$e->getMessage(); }
    }
    if ($resource==='anniversary') $row['days_left']=hc_days(date('Y-m-d'),$row['target_date']);
    return $row;
}
function hc_crud(string $resource, ?int $id, string $method,array $body) {
    $table=['task'=>'remind_task','anniversary'=>'anniversary','todo'=>'todo_item'][$resource];
    if ($method==='GET' && !$id) {
        $order=$resource==='anniversary' ? 'target_date,id' : 'id';
        hc_ok(['list'=>array_map(fn($r)=>hc_view($resource,$r),hc_rows("SELECT * FROM $table ORDER BY $order"))]);
    }
    if (!in_array($method,['POST','PUT','DELETE'],true) || ($method==='POST' && $id) || ($method!=='POST' && !$id)) hc_fail('接口方法不支持',405);
    if ($id && !hc_row("SELECT id FROM $table WHERE id=?",[$id])) hc_fail('记录不存在',404);
    if ($method==='DELETE') { hc_query("DELETE FROM $table WHERE id=?",[$id]); hc_ok(['id'=>$id],'已删除'); }
    $enable=isset($body['enable']) && (int)$body['enable']===0 ? 0 : 1;
    $text=function(string $key,int $max,bool $required=true) use($body): string {
        if (isset($body[$key]) && !is_scalar($body[$key])) throw new InvalidArgumentException('字段格式错误');
        $s=trim((string)($body[$key] ?? ''));
        if (($required && !$s) || mb_strlen($s)>$max) throw new InvalidArgumentException($key.' 不能为空且不能超过 '.$max.' 字');
        return $s;
    };
    if ($resource==='task') {
        $name=$text('task_name',128); $expr=$text('cron_expr',128); $parsed=hc_cron_parse($expr);
        $expr=implode(' ',$parsed['parts']);
        if (!hc_cron_next($expr)) throw new InvalidArgumentException('此 cron 在未来八年没有执行时间，请检查日期');
        $period=$body['push_time_period'] ?? '早安';
        if (!in_array($period,hc_options()['pushTimePeriods'],true)) throw new InvalidArgumentException('推送时段不正确');
        $row=['task_name'=>$name,'cron_expr'=>$expr,'push_time_period'=>$period,'enable'=>$enable,'remark'=>$text('remark',255,false)];
    } elseif ($resource==='anniversary') {
        $name=$text('name',128); $date=$text('target_date',10);
        if (!hc_date_valid($date)) throw new InvalidArgumentException('日期必须是有效的 YYYY-MM-DD');
        $row=['name'=>$name,'target_date'=>$date,'enable'=>$enable,'show_countdown'=>isset($body['show_countdown']) && (int)$body['show_countdown']===0 ? 0 : 1];
    } else $row=['content'=>$text('content',200),'enable'=>$enable,'only_workday'=>(int)($body['only_workday'] ?? 0)===1 ? 1 : 0];
    if ($id) hc_query("UPDATE $table SET ".implode(',',array_map(fn($f)=>"$f=?",array_keys($row))).' WHERE id=?',array_merge(array_values($row),[$id]));
    else { hc_query("INSERT INTO $table (".implode(',',array_keys($row)).') VALUES ('.implode(',',array_fill(0,count($row),'?')).')',array_values($row)); $id=(int)hc_db()->lastInsertId(); }
    hc_ok([$resource=>hc_view($resource,hc_row("SELECT * FROM $table WHERE id=?",[$id]))],'已保存');
}
function hc_login(array $body) {
    $username=$body['username'] ?? ''; $password=$body['password'] ?? '';
    if (!is_string($username) || !is_string($password) || !$username || !$password || strlen($password)>256) hc_fail('请输入账号与密码');
    $key='login:'.hash('sha256',$_SERVER['REMOTE_ADDR'] ?? 'unknown'); $db=hc_db();
    // Persistent per-IP limit, independent of browser cookies; updates serialized by InnoDB.
    $db->beginTransaction();
    try {
        hc_query('INSERT IGNORE INTO hc_runtime (name,value) VALUES (?,?)',[$key,'{}']);
        $record=json_decode(hc_row('SELECT value FROM hc_runtime WHERE name=? FOR UPDATE',[$key])['value'],true) ?: [];
        if (($record['until'] ?? 0)>time()) { $db->commit(); hc_fail('登录失败次数过多，请 5 分钟后重试',429); }
        $admin=hc_settings()['admin'];
        $valid=password_verify($password,$admin['password_hash']) && hash_equals($admin['username'],$username);
        if (!$valid) {
            $count=(($record['updated'] ?? 0)<time()-300 ? 0 : ($record['count'] ?? 0))+1;
            hc_query('UPDATE hc_runtime SET value=? WHERE name=?',[json_encode(['count'=>$count,'until'=>$count>=10 ? time()+300 : 0,'updated'=>time()]),$key]);
            $db->commit(); hc_fail('账号或密码错误',401);
        }
        hc_query('DELETE FROM hc_runtime WHERE name=?',[$key]); $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
    session_regenerate_id(true); $_SESSION['user']=$username; $_SESSION['expires']=time()+43200;
    hc_ok(['username'=>$username,'csrfToken'=>$_SESSION['csrf']]);
}
function hc_api() {
    $path=trim((string)($_GET['route'] ?? ''),'/'); $method=$_SERVER['REQUEST_METHOD'];
    if (!hc_installed()) hc_fail('系统尚未安装，请打开 install.php',503);
    hc_session(); header('X-CSRF-Token: '.$_SESSION['csrf']);
    $body=in_array($method,['POST','PUT','DELETE'],true) ? hc_body() : [];
    if (in_array($method,['POST','PUT','DELETE'],true)) hc_csrf();
    if (isset($_SESSION['user']) && ($_SESSION['expires'] ?? 0)<time()) unset($_SESSION['user']);
    if ($path==='session' && $method==='GET') hc_ok(['loggedIn'=>isset($_SESSION['user']),'username'=>$_SESSION['user'] ?? '','csrfToken'=>$_SESSION['csrf']]);
    if ($path==='login' && $method==='POST') hc_login($body);
    if (!isset($_SESSION['user'])) hc_fail('未登录或登录已过期，请重新登录',401);
    $_SESSION['expires']=time()+43200;
    if ($path==='logout' && $method==='POST') { $_SESSION=[]; session_destroy(); hc_ok([],'已退出登录'); }
    // Long-running network calls must not block other requests from the same session.
    session_write_close();
    if ($path==='config') {
        if ($method==='GET') hc_ok(['config'=>hc_safe_config(hc_config()),'options'=>hc_options()]);
        if ($method==='PUT') hc_ok(['config'=>hc_update_config($body)],'配置已保存');
    }
    if (preg_match('#^(task|anniversary|todo)(?:/([1-9]\d*))?$#D',$path,$m)) hc_crud($m[1],isset($m[2]) ? (int)$m[2] : null,$method,$body);
    if ($path==='log' && $method==='GET') {
        $page=max(1,min(1000000,(int)($_GET['page'] ?? 1))); $size=max(1,min(100,(int)($_GET['size'] ?? 10)));
        $list=hc_rows('SELECT l.*,t.task_name FROM push_log l LEFT JOIN remind_task t ON l.task_id=t.id ORDER BY l.id DESC LIMIT ? OFFSET ?',[$size,($page-1)*$size]);
        hc_ok(['total'=>(int)hc_row('SELECT COUNT(*) total FROM push_log')['total'],'page'=>$page,'size'=>$size,'list'=>array_map(fn($r)=>hc_view('log',$r),$list)]);
    }
    if ($path==='test-push' && $method==='POST') {
        $id=!empty($body['task_id']) ? (int)$body['task_id'] : null; $period=(string)($body['push_time_period'] ?? '');
        if ($id) { $task=hc_row('SELECT * FROM remind_task WHERE id=?',[$id]); if (!$task) hc_fail('任务不存在',404); $period=$period ?: $task['push_time_period']; }
        hc_ok(hc_push($id,$period,(string)($body['style_type'] ?? ''),'manual'));
    }
    if ($path==='meta' && $method==='GET') hc_ok(array_merge(hc_options(),['appName'=>'HeartCron 心时','version'=>'2.0.0','runtime'=>'php','timezone'=>'Asia/Shanghai','scheduler'=>hc_scheduler_info(),'now'=>date(DATE_ATOM)]));
    if ($path==='preview' && $method==='GET') {
        $collected=hc_collect(); $cfg=$collected['cfg']; $data=$collected['data']; $defaults=require __DIR__.'/defaults.php';
        $stats=[];
        foreach (['taskTotal'=>'remind_task','taskEnabled'=>'remind_task WHERE enable=1','anniversaryEnabled'=>'anniversary WHERE enable=1','todoEnabled'=>'todo_item WHERE enable=1'] as $key=>$table) $stats[$key]=(int)hc_row('SELECT COUNT(*) total FROM '.$table)['total'];
        $scheduler=hc_scheduler_info(); $stats['runningJobs']=$scheduler['healthy'] ? $stats['taskEnabled'] : 0;
        hc_ok(array_merge($data,['push_mode'=>$cfg['push_mode'],'preview_title'=>hc_render($cfg['wx_pusher_title'],$data),
            'preview_content'=>$cfg['push_mode']==='template' ? hc_render($cfg['push_template'] ?: $defaults['samples'][0]['content'],hc_fixed_vars($cfg,$data,$collected['weatherRaw'])) : '',
            'stats'=>$stats,'scheduler'=>$scheduler,'recentLogs'=>array_map(fn($r)=>hc_view('log',$r),hc_rows('SELECT * FROM push_log ORDER BY id DESC LIMIT 5'))]));
    }
    hc_fail('接口不存在或方法不支持',404);
}
