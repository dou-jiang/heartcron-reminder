<?php
// A real PHP entry point: works with the standard PHP-site configuration.
if (!is_file(__DIR__ . '/config.php')) { header('Location: install.php'); exit; }
$file = __DIR__ . '/frontend/dist/index.html';
if (!is_file($file)) { http_response_code(503); exit('缺少 frontend/dist，请上传完整的 HeartCron 发布包。'); }
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
$html = file_get_contents($file);
// Vite uses relative asset URLs. Keep PHP and Node deployments on the same build.
$html = str_replace(['"./assets/', "'./assets/"], ['"./frontend/dist/assets/', "'./frontend/dist/assets/"], $html);
echo str_replace('<head>', '<head><script>window.HEARTCRON_PHP = true;</script>', $html);
