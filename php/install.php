<?php
if (!defined('HC_ROOT')) { http_response_code(404); exit; }

function hc_checks(): array {
    $checks = [['name'=>'PHP 7.4 或以上','ok'=>PHP_VERSION_ID >= 70400,'detail'=>PHP_VERSION]];
    foreach (['pdo_mysql','curl','mbstring','openssl','session','json'] as $ext) {
        $checks[] = ['name'=>$ext . ' 扩展','ok'=>extension_loaded($ext),'detail'=>extension_loaded($ext) ? '已开启' : '请在宝塔 PHP 设置中安装或开启'];
    }
    $checks[] = ['name'=>'站点目录可写','ok'=>is_writable(HC_ROOT),'detail'=>'用于自动生成 config.php'];
    $checks[] = ['name'=>'管理后台文件','ok'=>is_file(HC_ROOT . '/frontend/dist/index.html'),'detail'=>'frontend/dist/index.html'];
    return $checks;
}
function hc_install_db(array $body): array {
    return ['host'=>trim((string)($body['dbHost'] ?? '127.0.0.1')),'port'=>(int)($body['dbPort'] ?? 3306),
        'database'=>trim((string)($body['dbName'] ?? '')),'user'=>trim((string)($body['dbUser'] ?? '')),
        'password'=>(string)($body['dbPassword'] ?? '')];
}
function hc_install_connect(array $db): PDO {
    try { return hc_connect($db); }
    catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Unknown database') === false && strpos($e->getMessage(), '1049') === false) throw $e;
        $server = new PDO('mysql:host='.$db['host'].';port='.$db['port'].';charset=utf8mb4', $db['user'], $db['password'],
            [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT=>5]);
        $server->exec('CREATE DATABASE IF NOT EXISTS `'.str_replace('`','``',$db['database']).'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        return hc_connect($db);
    }
}
function hc_install_schema(PDO $db): void {
    $sql = require __DIR__ . '/schema.php';
    $sql = preg_replace('/^--.*$/m', '', $sql);
    foreach (explode(';', $sql) as $statement) if (trim($statement)) $db->exec($statement);
    // Also accepts databases created by the earlier Node edition.
    $columns = $db->query('SHOW COLUMNS FROM system_config')->fetchAll(PDO::FETCH_COLUMN);
    $migrations = ['push_mode'=>"VARCHAR(16) NOT NULL DEFAULT 'ai'",'push_template'=>'TEXT NULL',
        'love_start_date'=>"VARCHAR(10) NOT NULL DEFAULT ''",'birthday'=>"VARCHAR(10) NOT NULL DEFAULT ''",
        'pay_day'=>'TINYINT UNSIGNED NOT NULL DEFAULT 0','love_message'=>'TEXT NULL',
        'qweather_host'=>"VARCHAR(255) NOT NULL DEFAULT ''"];
    foreach ($migrations as $name=>$type) if (!in_array($name,$columns,true)) $db->exec("ALTER TABLE system_config ADD COLUMN `$name` $type");
    require_once __DIR__.'/migrations.php';
    hc_migrate($db);
    $db->exec('CREATE TABLE IF NOT EXISTS hc_runtime (`name` VARCHAR(128) PRIMARY KEY, `value` TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $db->exec('CREATE TABLE IF NOT EXISTS hc_cron_run (task_id INT UNSIGNED NOT NULL, scheduled_minute DATETIME NOT NULL, PRIMARY KEY(task_id,scheduled_minute)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $defaults = require __DIR__ . '/defaults.php';
    $stmt = $db->prepare('INSERT IGNORE INTO system_config (id,push_mode,push_template,ai_prompt_template,love_message) VALUES (1,?,?,?,?)');
    $stmt->execute(['template',$defaults['samples'][0]['content'],$defaults['DEFAULT_PROMPT_TEMPLATE'],'今天也要开心呀！']);
}
function hc_perform_install(array $body): void {
    foreach (hc_checks() as $check) if (!$check['ok']) throw new InvalidArgumentException('环境检测未通过：' . $check['name']);
    $username = trim((string)($body['adminUsername'] ?? ''));
    $password = (string)($body['adminPassword'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_.@-]{3,32}$/D', $username)) throw new InvalidArgumentException('账号需为 3~32 位字母、数字或 _ . @ -');
    if (strlen($password) < 8 || strlen($password) > 72) throw new InvalidArgumentException('密码需为 8~72 字节');
    if ($password !== ($body['adminPasswordConfirm'] ?? '')) throw new InvalidArgumentException('两次密码不一致');
    // Lock the existing PHP file instead of leaving a public lock/credential file.
    $lock = fopen(HC_ROOT . '/install.php', 'r');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) throw new InvalidArgumentException('另一个安装正在进行，请稍后刷新');
    try {
        clearstatcache();
        if (hc_installed()) throw new InvalidArgumentException('系统已安装，不能重复安装');
        $dbConfig = hc_install_db($body);
        $db = hc_install_connect($dbConfig);
        hc_install_schema($db);
        $settings = ['db'=>$dbConfig,'admin'=>['username'=>$username,'password_hash'=>password_hash($password, PASSWORD_DEFAULT)],
            'installed_at'=>date(DATE_ATOM)];
        // Temp file retains a PHP suffix and guard even if interrupted during installation.
        $temp = HC_ROOT . '/config.' . bin2hex(random_bytes(8)) . '.php';
        $content = "<?php\nif (!defined('HC_ROOT')) { http_response_code(404); exit; }\nreturn " . var_export($settings,true) . ";\n";
        if (file_put_contents($temp,$content,LOCK_EX) !== strlen($content)) throw new RuntimeException('配置文件写入失败');
        @chmod($temp,0640);
        if (!rename($temp,HC_ROOT . '/config.php')) { @unlink($temp); throw new RuntimeException('无法保存 config.php'); }
    } finally { flock($lock,LOCK_UN); fclose($lock); }
}
