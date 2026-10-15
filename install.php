<?php
define('HC_ROOT', __DIR__);
require __DIR__ . '/php/bootstrap.php';
require __DIR__ . '/php/install.php';
header('Cache-Control: no-store');
if (hc_installed()) { header('Location: ./'); exit; }
hc_session();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    hc_csrf();
    try {
        $body = hc_body();
        if (($body['action'] ?? '') === 'test') {
            $db = hc_install_connect(hc_install_db($body));
            hc_ok(['version'=>$db->query('SELECT VERSION()')->fetchColumn()], '数据库连接成功');
        }
        if (($body['action'] ?? '') !== 'install') hc_fail('未知操作');
        hc_perform_install($body);
        session_regenerate_id(true);
        hc_ok([], '安装完成');
    } catch (PDOException $e) {
        error_log('HeartCron install: ' . $e->getMessage());
        hc_fail('MySQL 连接或建表失败，请核对数据库名、账号、密码及建表权限。请先在宝塔创建 MySQL 数据库。');
    } catch (Throwable $e) { hc_error($e); }
}
$checks = hc_checks();
$ready = !in_array(false,array_column($checks,'ok'),true);
?>
<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>安装 · HeartCron 心时</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:36px 16px;background:#fff5f7;color:#303133;font:15px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{max-width:740px;margin:auto}h1{margin:0;color:#d94d79;font-size:28px}p{color:#717781}section{background:white;border:1px solid #f1e4e8;border-radius:16px;padding:24px;margin:18px 0}h2{font-size:18px;margin:0 0 16px}.checks{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ok{color:#24825c}.bad{color:#cf3e50}.fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}label{display:block;font-size:14px}input{display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #dcdfe6;border-radius:8px;font:inherit}button,.link{padding:11px 20px;border:0;border-radius:8px;background:#e65a85;color:white;font:inherit;cursor:pointer}button.secondary{background:#fbe9ef;color:#a7395d}button:disabled{opacity:.5;cursor:wait}.actions{display:flex;gap:12px;flex-wrap:wrap}#message{white-space:pre-wrap}.tip{font-size:13px}a{color:#bd3d67}@media(max-width:520px){.fields,.checks{grid-template-columns:1fr}section{padding:18px}}
</style></head><body><main>
<h1>♥ HeartCron 心时</h1><p>填好数据库与后台账号，让心意准时抵达。</p>
<section><h2>① 环境检测</h2><div class="checks">
<?php foreach ($checks as $check): ?><div class="<?= $check['ok'] ? 'ok' : 'bad' ?>" title="<?= hc_escape($check['detail']) ?>"><?= $check['ok'] ? '✓' : '✕' ?> <?= hc_escape($check['name']) ?></div><?php endforeach; ?>
</div><?php if (!$ready): ?><p class="bad">请在宝塔 PHP 设置中补齐扩展，确认站点目录归属 www 且可写，然后刷新本页。</p><?php endif; ?></section>
<form id="install-form"><section><h2>② MySQL 数据库</h2><p class="tip">填写宝塔「数据库」中创建的数据库与专用账号，系统会自动建表。已有 HeartCron 数据会保留。</p><div class="fields">
<label>数据库主机<input name="dbHost" value="127.0.0.1" required></label><label>端口<input name="dbPort" type="number" min="1" max="65535" value="3306" required></label>
<label>数据库名称<input name="dbName" placeholder="例如 heartcron" required></label><label>数据库用户名<input name="dbUser" placeholder="宝塔创建的数据库账号" required></label>
<label>数据库密码<input name="dbPassword" type="password" autocomplete="new-password"></label>
</div></section><section><h2>③ 后台管理员</h2><div class="fields">
<label>登录账号<input name="adminUsername" value="admin" minlength="3" maxlength="32" autocomplete="username" required></label>
<label>登录密码<input name="adminPassword" type="password" minlength="8" maxlength="72" autocomplete="new-password" required></label>
<label>再次输入密码<input name="adminPasswordConfirm" type="password" minlength="8" maxlength="72" autocomplete="new-password" required></label>
</div><p class="tip">推送通道、天气、示例模板可在安装后进入「全局配置」填写。</p></section>
<div class="actions"><button type="button" class="secondary" id="test" <?= $ready ? '' : 'disabled' ?>>测试数据库连接</button><button type="submit" <?= $ready ? '' : 'disabled' ?>>开始安装</button></div>
<p id="message" role="status"></p></form>
<section id="done" hidden><h2>安装完成</h2><p>可以登录后台了。在仪表盘复制计划任务命令，粘贴到宝塔并设为每分钟执行一次，即可开启自动推送。</p><a class="link" href="./#/login">进入后台</a></section>
<p class="tip">PHP + MySQL · <a href="https://github.com/dou-jiang/heartcron-reminder" target="_blank" rel="noopener">GitHub 项目</a></p>
</main><script>
const csrf=<?= json_encode($_SESSION['csrf']) ?>;
const form=document.getElementById('install-form'), message=document.getElementById('message');
async function submit(action){
 const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);message.textContent=action==='test'?'正在连接数据库…':'正在安装，请稍候…';
 try{const response=await fetch('install.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({...Object.fromEntries(new FormData(form)),action})});
 const result=await response.json();if(!result.success)throw new Error(result.message);message.textContent=result.message;
 if(action==='install'){form.hidden=true;document.getElementById('done').hidden=false;}
 }catch(e){message.textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}
}
form.addEventListener('submit',e=>{e.preventDefault();submit('install')});document.getElementById('test').addEventListener('click',()=>submit('test'));
</script></body></html>
