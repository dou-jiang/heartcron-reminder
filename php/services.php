<?php
if (!defined('HC_ROOT')) { http_response_code(404); exit; }

function hc_render(string $template, array $vars): string {
    return preg_replace_callback('/\{\{\s*(\w+)\s*(?:\.\s*DATA\s*)?\}\}/',fn($m)=>(string)($vars[$m[1]] ?? ''),$template);
}
function hc_fixed_vars(array $cfg, array $data=[], ?array $weather=null, ?DateTimeImmutable $now=null): array {
    $now=$now ?? new DateTimeImmutable(); $today=$now->format('Y-m-d'); $year=(int)$now->format('Y');
    $vars=$data + ['love'=>'—','anniversary'=>'—','birthday'=>'—','individual'=>'—','pay'=>'—'];
    $start=$cfg['love_start_date'] ?? '';
    if ($start && hc_date_valid($start) && $start<=$today) {
        $vars['love']=(string)(hc_days($start,$today)+1);
        [$y,$m,$d]=array_map('intval',explode('-',$start));
        $vars['anniversary']=(string)($year-$y-($today<hc_safe_date($year,$m,$d) ? 1 : 0));
    }
    $birthday=$cfg['birthday'] ?? '';
    if (preg_match('/^(?:(\d{4})-)?(\d{2})-(\d{2})$/D',$birthday,$b) && checkdate((int)$b[2],(int)$b[3],$b[1] ? (int)$b[1] : 2000)) {
        $nextYear=$year; $next=hc_safe_date($year,(int)$b[2],(int)$b[3]);
        if ($next<$today) $next=hc_safe_date(++$nextYear,(int)$b[2],(int)$b[3]);
        $vars['birthday']=(string)hc_days($today,$next);
        if ($b[1]) $vars['individual']=(string)($nextYear-(int)$b[1]+1);
    }
    $pay=(int)($cfg['pay_day'] ?? 0);
    if ($pay>=1 && $pay<=31) {
        $next=hc_safe_date($year,(int)$now->format('n'),$pay);
        if ($next<$today) { $month=$now->modify('first day of next month'); $next=hc_safe_date((int)$month->format('Y'),(int)$month->format('n'),$pay); }
        $vars['pay']=(string)hc_days($today,$next);
    }
    $w=$weather['now'] ?? []; $lines=array_values(array_filter(array_map('trim',preg_split('/\r?\n/',$cfg['love_message'] ?? ''))));
    return array_merge($vars,['dateTime'=>hc_date_cn($now),'date'=>$today,'time'=>$now->format('Y-m-d H:i:s'),
        'city'=>$weather['cityName'] ?? '—','weather'=>$w['text'] ?? '—','temp'=>$w['temp'] ?? '—','humidity'=>$w['humidity'] ?? '—',
        'wind'=>isset($w['windDir']) ? $w['windDir'] . (!empty($w['windScale']) ? $w['windScale'].'级' : '') : '—',
        'message'=>$lines ? $lines[random_int(0,count($lines)-1)] : '—']);
}
function hc_upstream_error(array $data,array $secrets=[]): string {
    $value=$data['error']['message'] ?? $data['message'] ?? $data['error'] ?? '';
    if (!is_string($value)) return '';
    foreach ($secrets as $secret) if ($secret!=='') $value=str_replace($secret,'[已隐藏]',$value);
    $value=preg_replace('#https?://[^\s]+#i','[接口地址]',$value);
    $value=preg_replace('/Bearer\s+[^\s,;]+/i','Bearer [已隐藏]',$value);
    return mb_substr(preg_replace('/[\r\n\x00-\x1f]+/',' ',$value),0,500);
}
function hc_http(string $url, ?array $body=null, array $headers=[],int $timeout=15,bool $diagnostic=false): array {
    if (!preg_match('#^https?://#i',$url)) throw new RuntimeException('接口地址必须使用 HTTP 或 HTTPS');
    $ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>$timeout,
        CURLOPT_ENCODING=>'',CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTP|CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER=>array_merge(['Content-Type: application/json'],$headers)]);
    if ($body !== null) curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body,JSON_UNESCAPED_UNICODE)]);
    $response=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); $errno=curl_errno($ch); $failed=$response===false; curl_close($ch);
    // Network errors omit URLs; AI diagnostics expose only sanitized error messages.
    if ($failed) {
        $reasons=[6=>'域名解析失败，请检查接口域名与服务器 DNS',7=>'无法连接接口，请检查服务器出站网络与端口',28=>'请求超时，请检查网络或稍后重试',35=>'TLS 握手失败，请检查 PHP cURL/OpenSSL',60=>'证书验证失败，请检查服务器 CA 证书'];
        throw new RuntimeException(($reasons[$errno] ?? '外部接口连接失败，请检查网络与证书').'（cURL '.$errno.'）');
    }
    if ($status<200 || $status>=300) {
        $hints=[400=>'请检查模型名称及请求参数',401=>'API Key 无效或未获授权',403=>'账号或模型没有调用权限',404=>'接口路径或模型不存在',429=>'请求过频或账户额度不足'];
        $message='外部接口返回 HTTP '.$status.($diagnostic ? '，'.($hints[$status] ?? '请检查服务商状态') : '');
        if ($diagnostic) {
            $secrets=[];
            foreach ($headers as $header) if (stripos($header,'Authorization: Bearer ')===0) $secrets[]=substr($header,22);
            $decoded=json_decode($response,true);
            $detail=hc_upstream_error(is_array($decoded) ? $decoded : [],$secrets);
            if ($detail) $message.='：'.$detail;
        }
        throw new RuntimeException($message,$status);
    }
    $data=json_decode($response,true);
    if (!is_array($data)) throw new RuntimeException('外部接口返回了无效 JSON');
    return $data;
}
function hc_ai_url(string $url): string {
    $url=rtrim(trim($url),'/');
    $parsed=parse_url($url);
    if (!$parsed || !in_array(strtolower($parsed['scheme'] ?? ''),['http','https'],true) || empty($parsed['host']) ||
        isset($parsed['query']) || isset($parsed['fragment']) || isset($parsed['user']) || isset($parsed['pass'])) {
        throw new InvalidArgumentException('AI 地址需为 http(s) 接口地址，不含查询参数、账号或片段');
    }
    $path=$parsed['path'] ?? '';
    if (substr($path,-strlen('/chat/completions'))==='/chat/completions') return $url;
    return $url.'/chat/completions';
}
function hc_ai_generate(array $cfg,string $prompt): string {
    if (empty($cfg['ai_api_key'])) throw new InvalidArgumentException('请填写 AI API Key');
    if (empty($cfg['ai_model'])) throw new InvalidArgumentException('请填写 AI 模型名称');
    if (empty($cfg['ai_api_url'])) throw new InvalidArgumentException('请填写 AI 接口地址');
    $response=hc_http(hc_ai_url($cfg['ai_api_url']),['model'=>$cfg['ai_model'],
        'messages'=>[['role'=>'user','content'=>$prompt]],'temperature'=>(float)$cfg['ai_temperature'],
        'max_tokens'=>(int)$cfg['ai_max_tokens'],'stream'=>false],['Authorization: Bearer '.$cfg['ai_api_key']],60,true);
    if (!empty($response['error'])) throw new RuntimeException('AI 返回错误：'.hc_upstream_error($response,[$cfg['ai_api_key']]));
    $content=$response['choices'][0]['message']['content'] ?? $response['choices'][0]['text'] ?? '';
    if (is_array($content)) $content=implode('',array_map(fn($part)=>is_array($part) ? ($part['text'] ?? '') : '',$content));
    if (!is_string($content) || !trim($content)) throw new RuntimeException('AI 返回内容为空，请确认接口使用 Chat Completions 格式且模型支持文本输出');
    return trim(preg_replace('/^```\w*\s*|\s*```$/u','',trim($content)));
}
function hc_weather(array $cfg): array {
    if (!$cfg['qweather_key'] || !$cfg['qweather_city_id']) return ['text'=>'（未配置和风天气，本次不含天气信息）','raw'=>null];
    $host=trim($cfg['qweather_host'] ?? '');
    if (!$host) return ['text'=>'（请填写和风天气控制台的 API Host）','raw'=>null];
    $host=preg_replace('#^https://#','',rtrim($host,'/'));
    if (!preg_match('/^[a-zA-Z0-9.-]+\.qweatherapi\.com$/D',$host)) throw new RuntimeException('和风天气 API Host 格式不正确');
    $request=function(string $path) use($host,$cfg): array {
        $r=hc_http('https://'.$host.$path.'?location='.rawurlencode($cfg['qweather_city_id']),null,['X-QW-Api-Key: '.$cfg['qweather_key']]);
        if ((string)($r['code'] ?? '')!=='200') throw new RuntimeException('和风天气返回错误码 '.(string)($r['code'] ?? '未知'));
        return $r;
    };
    $now=$request('/v7/weather/now')['now'] ?? [];
    $today=null; $warnings=[]; $city=$cfg['qweather_city_id'];
    try { $today=$request('/v7/weather/3d')['daily'][0] ?? null; } catch (Throwable $e) {}
    try { $warnings=$request('/v7/warning/now')['warning'] ?? []; } catch (Throwable $e) {}
    try { $city=$request('/geo/v2/city/lookup')['location'][0]['name'] ?? $city; } catch (Throwable $e) {}
    $parts=[$city.' '.($now['text'] ?? '').' '.($now['temp'] ?? '--').'℃'];
    if (isset($now['humidity'])) $parts[]='湿度 '.$now['humidity'].'%';
    if (isset($now['windDir'])) $parts[]=$now['windDir'].($now['windScale'] ?? '').'级';
    if ($today) $parts[]='今日 '.$today['tempMin'].'~'.$today['tempMax'].'℃，'.$today['textDay'];
    if ($warnings) $parts[]='⚠ 天气预警：'.implode('、',array_column($warnings,'title'));
    return ['text'=>implode('，',$parts),'raw'=>['cityName'=>$city,'now'=>$now,'today'=>$today,'warnings'=>$warnings]];
}
function hc_collect(string $period='',string $style='',?array $cfg=null): array {
    $cfg=$cfg ?? hc_config(); $now=new DateTimeImmutable(); $today=$now->format('Y-m-d');
    try { $weather=hc_weather($cfg); } catch (Throwable $e) { $weather=['text'=>'（天气信息获取失败，请检查 API Host、Key 与城市 ID）','raw'=>null]; }
    $anniversaries=[];
    foreach (hc_rows('SELECT * FROM anniversary WHERE enable=1') as $row) {
        $days=hc_days($today,$row['target_date']);
        if ($days===0) { $anniversaries[]='今天是'.$row['name']; continue; }
        if (!(int)$row['show_countdown']) continue;
        if ($days>0) $anniversaries[]='距离'.$row['name'].'还有 '.$days.' 天';
        else {
            [$y,$m,$d]=array_map('intval',explode('-',$row['target_date'])); $year=(int)$now->format('Y');
            $next=hc_safe_date($year,$m,$d); if ($next<$today) $next=hc_safe_date($year+1,$m,$d);
            $anniversaries[]=$row['name'].'已过去 '.abs($days).' 天（距下一个周年还有 '.hc_days($today,$next).' 天）';
        }
    }
    $todos=[];
    foreach (hc_rows('SELECT * FROM todo_item WHERE enable=1') as $row) if (!(int)$row['only_workday'] || (int)$now->format('N')<6) $todos[]=$row['content'];
    $data=['boy_name'=>$cfg['boy_name'] ?: '我','girl_name'=>$cfg['girl_name'] ?: '宝贝','today_date'=>hc_date_cn($now),
        'weather_info'=>$weather['text'],'anniversary_list'=>$anniversaries ? implode('；',$anniversaries) : '暂无纪念日',
        'todo_list'=>$todos ? implode('；',$todos) : '今日暂无待办','push_time_period'=>$period ?: '早安','style_type'=>$style ?: $cfg['default_style']];
    return ['cfg'=>$cfg,'data'=>$data,'weatherInfo'=>$weather['text'],'weatherRaw'=>$weather['raw']];
}
function hc_task_config(array $cfg, ?array $task=null): array {
    if (!$task) return $cfg;
    $mode=$task['push_mode'] ?? 'inherit';
    if ($mode!=='inherit') {
        $cfg['push_mode']=$mode;
        $cfg['push_template']=$task['push_template'] ?? '';
        $cfg['ai_prompt_template']=$task['ai_prompt_template'] ?? '';
    }
    foreach (['push_title'=>'wx_pusher_title','style_type'=>'default_style','wx_pusher_uid'=>'wx_pusher_uid'] as $field=>$target) {
        if (trim((string)($task[$field] ?? ''))!=='') $cfg[$target]=$task[$field];
    }
    return $cfg;
}
function hc_message(array $cfg,string $period='',string $style=''): array {
        $result=['content'=>'','title'=>'','weatherInfo'=>'','errorMsg'=>'','mode'=>$cfg['push_mode']==='template' ? 'template' : 'ai'];
        $collected=hc_collect($period,$style,$cfg); $data=$collected['data']; $result['weatherInfo']=$collected['weatherInfo'];
        $vars=hc_fixed_vars($cfg,$data,$collected['weatherRaw']);
        $result['title']=hc_render($cfg['wx_pusher_title'],$vars);
        $defaults=require __DIR__.'/defaults.php'; $result['mode']=$cfg['push_mode']==='template' ? 'template' : 'ai';
        if ($result['mode']==='template') $result['content']=hc_render($cfg['push_template'] ?: $defaults['samples'][0]['content'],$vars);
        else {
            try {
                $result['content']=hc_ai_generate($cfg,hc_render($cfg['ai_prompt_template'] ?: $defaults['DEFAULT_PROMPT_TEMPLATE'],$vars));
            } catch (Throwable $e) {
                $result['errorMsg']='AI 调用失败，已使用备用文案：'.$e->getMessage();
                $result['content']=$data['push_time_period'].'好呀 '.$data['girl_name'].'，这是 '.$data['boy_name'].' 的今日份关心。';
                $result['content'].=strpos($data['weather_info'],'（')===0 ? $defaults['FALLBACK_WEATHER_EMPTY'] : '今天'.$data['weather_info'].'。';
                if ($data['anniversary_list']!=='暂无纪念日') $result['content'].=$data['anniversary_list'].'，我替你记着呢。';
                if ($data['todo_list']!=='今日暂无待办') $result['content'].='别忘了：'.$data['todo_list'].'。';
                $result['content'].=$defaults['FALLBACK_ENDINGS'][random_int(0,3)];
            }
        }
        if (!trim($result['content'])) throw new RuntimeException('推送内容为空');
        return $result;
}
function hc_log_failure(?int $taskId,string $message,string $source='schedule'): void {
    hc_query('INSERT INTO push_log (create_time,status,error_msg,task_id,source) VALUES (?,0,?,?,?)',[date('Y-m-d H:i:s'),$message,$taskId,$source]);
}
function hc_push(?int $taskId=null,string $period='',string $style='',string $source='manual'): array {
    $result=['success'=>false,'content'=>'','title'=>'','weatherInfo'=>'','errorMsg'=>'','createTime'=>date('Y-m-d H:i:s'),'source'=>$source,'mode'=>'template','taskId'=>$taskId];
    // Record the attempt before any external I/O, so timeouts never silently erase it.
    hc_query('INSERT INTO push_log (create_time,status,error_msg,task_id,source) VALUES (?,2,?,?,?)',[$result['createTime'],'正在生成文案并推送',$taskId,$source]);
    $logId=(int)hc_db()->lastInsertId();
    try {
        $task=$taskId ? hc_row('SELECT * FROM remind_task WHERE id=?',[$taskId]) : null;
        if ($taskId && !$task) throw new RuntimeException('任务不存在');
        $cfg=hc_task_config(hc_config(),$task);
        $period=$period ?: ($task['push_time_period'] ?? '提醒');
        if (!$cfg['wx_pusher_apptoken'] || !$cfg['wx_pusher_uid']) throw new RuntimeException('请在全局配置填写并保存 WxPusher AppToken 与接收 UID（也可在任务中单独指定 UID）');
        $result=array_merge($result,hc_message($cfg,$period,$style));
        // Persist generated text before sending; a killed worker still leaves useful evidence.
        hc_query('UPDATE push_log SET ai_content=?,weather_info=?,push_title=? WHERE id=?',[$result['content'],$result['weatherInfo'],$result['title'],$logId]);
        $uids=preg_split('/[,，;；\s]+/u',trim($cfg['wx_pusher_uid']),-1,PREG_SPLIT_NO_EMPTY);
        $response=hc_http('https://wxpusher.zjiecode.com/api/send/message',['appToken'=>$cfg['wx_pusher_apptoken'],'uids'=>$uids,
            'title'=>$result['title'],'content'=>$result['content'],'contentType'=>1]);
        if ((int)($response['code'] ?? 0)!==1000) throw new RuntimeException('WxPusher 推送失败，错误码 '.(string)($response['code'] ?? '未知'));
        foreach ($response['data'] ?? [] as $item) if (isset($item['code']) && (int)$item['code']!==1000) throw new RuntimeException('部分接收用户推送失败，请检查 UID 与订阅状态');
        $result['success']=true;
    } catch (Throwable $e) { $result['errorMsg']=$e instanceof PDOException ? '读取数据库失败' : $e->getMessage(); }
    hc_query('UPDATE push_log SET weather_info=?,ai_content=?,push_title=?,status=?,error_msg=? WHERE id=?',
        [$result['weatherInfo'],$result['content'],$result['title'],$result['success'] ? 1 : 0,$result['errorMsg'],$logId]);
    return $result;
}
