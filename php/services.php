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
function hc_http(string $url, ?array $body=null, array $headers=[]): array {
    if (!preg_match('#^https?://#i',$url)) throw new RuntimeException('接口地址必须使用 HTTP 或 HTTPS');
    $ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,
        CURLOPT_ENCODING=>'',CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTP|CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER=>array_merge(['Content-Type: application/json'],$headers)]);
    if ($body !== null) curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body,JSON_UNESCAPED_UNICODE)]);
    $response=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); $failed=$response===false; curl_close($ch);
    // Never include request URLs, credentials or upstream response bodies in logs.
    if ($failed) throw new RuntimeException('外部接口连接失败或超时，请检查网络与证书');
    if ($status<200 || $status>=300) throw new RuntimeException('外部接口返回 HTTP ' . $status);
    $data=json_decode($response,true);
    if (!is_array($data)) throw new RuntimeException('外部接口返回了无效 JSON');
    return $data;
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
function hc_push(?int $taskId=null,string $period='',string $style='',string $source='manual'): array {
    $result=['success'=>false,'content'=>'','weatherInfo'=>'','errorMsg'=>'','createTime'=>date('Y-m-d H:i:s'),'source'=>$source,'mode'=>'ai','taskId'=>$taskId];
    try {
        $cfg=hc_config();
        if (!$cfg['wx_pusher_apptoken'] || !$cfg['wx_pusher_uid']) throw new RuntimeException('请在全局配置填写并保存 WxPusher AppToken 与接收 UID');
        $collected=hc_collect($period,$style,$cfg); $data=$collected['data']; $result['weatherInfo']=$collected['weatherInfo'];
        $defaults=require __DIR__.'/defaults.php'; $result['mode']=$cfg['push_mode']==='template' ? 'template' : 'ai';
        if ($result['mode']==='template') $result['content']=hc_render($cfg['push_template'] ?: $defaults['samples'][0]['content'],hc_fixed_vars($cfg,$data,$collected['weatherRaw']));
        else {
            try {
                if (!$cfg['ai_api_key'] || !$cfg['ai_api_url'] || !$cfg['ai_model']) throw new RuntimeException('大模型配置不完整');
                $url=rtrim($cfg['ai_api_url'],'/'); if (substr($url,-16)!=='/chat/completions') $url.='/chat/completions';
                $response=hc_http($url,['model'=>$cfg['ai_model'],'messages'=>[['role'=>'user','content'=>hc_render($cfg['ai_prompt_template'] ?: $defaults['DEFAULT_PROMPT_TEMPLATE'],$data)]],
                    'temperature'=>(float)$cfg['ai_temperature'],'max_tokens'=>(int)$cfg['ai_max_tokens'],'stream'=>false],['Authorization: Bearer '.$cfg['ai_api_key']]);
                $content=$response['choices'][0]['message']['content'] ?? '';
                if (!is_string($content) || !trim($content)) throw new RuntimeException('大模型返回内容为空');
                $result['content']=trim(preg_replace('/^```\w*\s*|\s*```$/u','',trim($content)));
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
        $uids=preg_split('/[,，;；\s]+/u',trim($cfg['wx_pusher_uid']),-1,PREG_SPLIT_NO_EMPTY);
        $response=hc_http('https://wxpusher.zjiecode.com/api/send/message',['appToken'=>$cfg['wx_pusher_apptoken'],'uids'=>$uids,
            'title'=>hc_render($cfg['wx_pusher_title'],$data),'content'=>$result['content'],'contentType'=>1]);
        if ((int)($response['code'] ?? 0)!==1000) throw new RuntimeException('WxPusher 推送失败，错误码 '.(string)($response['code'] ?? '未知'));
        foreach ($response['data'] ?? [] as $item) if (isset($item['code']) && (int)$item['code']!==1000) throw new RuntimeException('部分接收用户推送失败，请检查 UID 与订阅状态');
        $result['success']=true;
    } catch (Throwable $e) { $result['errorMsg']=$e instanceof PDOException ? '读取数据库失败' : $e->getMessage(); }
    hc_query('INSERT INTO push_log (create_time,weather_info,ai_content,status,error_msg,task_id) VALUES (?,?,?,?,?,?)',
        [$result['createTime'],$result['weatherInfo'],$result['content'],$result['success'] ? 1 : 0,$result['errorMsg'],$taskId]);
    return $result;
}
