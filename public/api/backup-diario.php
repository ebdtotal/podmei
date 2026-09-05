<?php
/**
 * Backup diário automático PODMEI (America/Sao_Paulo).
 *
 * Cron HostGator — meia-noite (horário do servidor; ajuste se o painel estiver em UTC):
 *   0 0 * * * /usr/local/bin/php /home1/jricon98/podmei.com/api/backup-diario.php
 *
 * Rede de segurança (a cada hora; só grava 1x por dia):
 *   5 * * * * /usr/local/bin/php /home1/jricon98/podmei.com/api/backup-diario.php
 *
 * HTTP (opcional):
 *   https://podmei.com/api/backup-diario.php?key=CHAVE
 *   CHAVE = hash_hmac('sha256', 'backup-diario', secret do config)
 */
declare(strict_types=1);

date_default_timezone_set("America/Sao_Paulo");

require_once __DIR__ . "/backup-lib.php";

$cli = (PHP_SAPI === "cli" || PHP_SAPI === "phpdbg");
$force = false;

if ($cli) {
  foreach (array_slice($argv ?? [], 1) as $arg) {
    if ($arg === "--force" || $arg === "-f") $force = true;
  }
  $result = podmei_run_daily_backup($force);
  fwrite(STDOUT, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL);
  exit(!empty($result["ok"]) ? 0 : 1);
}

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
header("Access-Control-Allow-Origin: *");

$cfg = podmei_cfg();
$key = (string) ($_GET["key"] ?? $_POST["key"] ?? "");
$expect = hash_hmac("sha256", "backup-diario", (string) ($cfg["secret"] ?? ""));
if ($key === "" || !hash_equals($expect, $key)) {
  http_response_code(403);
  echo json_encode(["ok" => false, "error" => "Não autorizado."], JSON_UNESCAPED_UNICODE);
  exit;
}
$force = !empty($_GET["force"]) || !empty($_POST["force"]);
$result = podmei_run_daily_backup($force);
http_response_code(!empty($result["ok"]) ? 200 : 500);
echo json_encode($result, JSON_UNESCAPED_UNICODE);
