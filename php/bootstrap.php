<?php
declare(strict_types=1);

// Included by public entry points. Direct requests reveal no application data.
if (!defined('HC_ROOT')) { http_response_code(404); exit; }
date_default_timezone_set('Asia/Shanghai');
ini_set('display_errors', '0');

function hc_installed(): bool { return is_file(HC_ROOT . '/config.php'); }
function hc_settings(): array {
    static $settings;
    if ($settings === null) {
        if (!hc_installed()) throw new RuntimeException('请先完成安装');
        $settings = require HC_ROOT . '/config.php';
    }
    return $settings;
}
function hc_connect(array $db): PDO {
    if (!preg_match('/^[a-zA-Z0-9_.:-]+$/D', $db['host'] ?? '') ||
        !preg_match('/^[a-zA-Z0-9_]+$/D', $db['database'] ?? '') ||
        (int)($db['port'] ?? 0) < 1 || (int)$db['port'] > 65535) {
        throw new InvalidArgumentException('数据库主机、端口或库名格式不正确');
    }
    if (empty($db['user'])) throw new InvalidArgumentException('数据库账号不能为空');
    $connection = new PDO('mysql:host=' . $db['host'] . ';port=' . $db['port'] . ';dbname=' . $db['database'] . ';charset=utf8mb4',
        $db['user'], $db['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 5]);
    $connection->exec("SET time_zone = '+08:00'");
    return $connection;
}
function hc_db(): PDO {
    static $db;
    if ($db===null) {
        $connection=hc_connect(hc_settings()['db']);
        require_once __DIR__.'/migrations.php';
        hc_migrate($connection);
        $db=$connection;
    }
    return $db;
}
function hc_query(string $sql, array $args = []): PDOStatement {
    $stmt = hc_db()->prepare($sql);
    foreach (array_values($args) as $i => $value) {
        $stmt->bindValue($i + 1, $value, is_int($value) ? PDO::PARAM_INT : ($value === null ? PDO::PARAM_NULL : PDO::PARAM_STR));
    }
    $stmt->execute();
    return $stmt;
}
function hc_row(string $sql, array $args = []): ?array { return hc_query($sql, $args)->fetch() ?: null; }
function hc_rows(string $sql, array $args = []): array { return hc_query($sql, $args)->fetchAll(); }
function hc_config(): array { return hc_row('SELECT * FROM system_config WHERE id=1') ?? []; }
function hc_json(array $data, int $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE); exit;
}
function hc_ok(array $data = [], string $message = '') { hc_json(['success'=>true,'data'=>$data,'message'=>$message]); }
function hc_fail(string $message, int $status = 400) { hc_json(['success'=>false,'message'=>$message], $status); }
function hc_body(): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 1048576) hc_fail('请求内容过大', 413);
    $raw = file_get_contents('php://input', false, null, 0, 1048577);
    if (strlen($raw) > 1048576) hc_fail('请求内容过大', 413);
    $body = json_decode($raw ?: '{}', true);
    if (!is_array($body)) hc_fail('请求必须为 JSON 对象');
    return $body;
}
function hc_session(): void {
    session_name('heartcron_php');
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params(['httponly'=>true,'samesite'=>'Strict','secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off','path'=>'/']);
    if (!session_start()) throw new RuntimeException('无法创建会话，请检查 PHP session 目录权限');
    if (!isset($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
function hc_csrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!$token || !hash_equals($_SESSION['csrf'] ?? '', $token)) hc_fail('页面已过期，请刷新后重试', 403);
}
function hc_escape(string $text): string { return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function hc_date_valid(string $value): bool {
    $d = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    return $d && $d->format('Y-m-d') === $value;
}
function hc_days(string $from, string $to): int { return (int)(new DateTimeImmutable($from))->diff(new DateTimeImmutable($to))->format('%r%a'); }
function hc_safe_date(int $year, int $month, int $day): string {
    $first = new DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month));
    return $first->format('Y-m-') . sprintf('%02d', min($day, (int)$first->format('t')));
}
function hc_date_cn(DateTimeImmutable $now): string {
    return $now->format('Y年m月d日') . ' ' . ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][(int)$now->format('w')];
}
function hc_options(): array {
    $defaults = require __DIR__ . '/defaults.php';
    return ['pushTimePeriods'=>['早安','午间关心','晚安提醒'],'styleTypes'=>['温柔治愈','简短清爽','俏皮可爱'],
        'pushModes'=>[['value'=>'ai','label'=>'AI 生成文案'],['value'=>'template','label'=>'固定模板文案']],
        'templateSamples'=>$defaults['samples']];
}
function hc_error(Throwable $e) {
    if ($e instanceof InvalidArgumentException) hc_fail($e->getMessage());
    error_log('HeartCron: ' . $e->getMessage());
    hc_fail($e instanceof PDOException ? '数据库操作失败，请检查 config.php 中的连接信息与数据表，详情见 PHP 错误日志' : '操作失败，请查看 PHP 错误日志', 500);
}
