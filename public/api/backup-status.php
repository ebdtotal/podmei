<?php
/**
 * Status / disparo manual do backup diário (somente master).
 * GET  → status + lista recente
 * POST → { "action": "run" } executa backup agora
 */
declare(strict_types=1);
ob_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) === "OPTIONS") {
  http_response_code(204);
  exit;
}

require_once __DIR__ . "/backup-lib.php";

function respond($code, $payload): void {
  while (ob_get_level() > 0) ob_end_clean();
  http_response_code($code);
  header("Content-Type: application/json; charset=utf-8");
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function bearer(): string {
  $hdr = $_SERVER["HTTP_AUTHORIZATION"] ?? "";
  if (preg_match("/Bearer\\s+(.+)/i", $hdr, $m)) return trim($m[1]);
  $raw = file_get_contents("php://input") ?: "";
  $in = json_decode($raw, true);
  if (is_array($in) && !empty($in["token"])) return (string) $in["token"];
  return (string) ($_GET["token"] ?? "");
}

function token_user_id(string $token, array $cfg): ?string {
  $raw = base64_decode(strtr($token, "-_", "+/"));
  if (!$raw) return null;
  $parts = explode(".", $raw);
  if (count($parts) !== 3) return null;
  [$userId, $exp, $sig] = $parts;
  $payload = $userId . "." . $exp;
  $expect = hash_hmac("sha256", $payload, $cfg["secret"]);
  if (!hash_equals($expect, $sig)) return null;
  if (intval($exp) < time()) return null;
  return $userId;
}

try {
  $cfg = podmei_cfg();
  $pdo = podmei_db();
} catch (Throwable $e) {
  respond(500, ["error" => "Banco indisponível."]);
}

$uid = token_user_id(bearer(), $cfg);
if (!$uid) respond(401, ["error" => "Sessão inválida."]);

$st = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
$st->execute([$uid]);
$user = $st->fetch();
$mid = podmei_master_id($cfg);
if (!$user || (($user["role"] ?? "") !== "master" && $uid !== $mid)) {
  respond(403, ["error" => "Acesso master necessário."]);
}

$method = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));
$docRootHint = __DIR__ . "/backup-diario.php";
$appUrl = rtrim((string) ($cfg["app_url"] ?? "https://podmei.com"), "/");

if ($method === "POST") {
  $in = json_decode(file_get_contents("php://input") ?: "{}", true);
  if (!is_array($in)) $in = [];
  $action = (string) ($in["action"] ?? "run");
  if ($action !== "run") respond(400, ["error" => "Ação inválida."]);
  $result = podmei_run_daily_backup(true);
  respond(200, ["ok" => !empty($result["ok"]), "result" => $result]);
}

if ($method !== "GET") respond(405, ["error" => "Método não suportado."]);

respond(200, [
  "ok" => true,
  "timezone" => "America/Sao_Paulo",
  "schedule" => "00:00 diário",
  "keepDays" => 30,
  "lastDay" => podmei_meta_get($pdo, "backup_last_day"),
  "lastAt" => podmei_meta_get($pdo, "backup_last_at"),
  "lastOk" => podmei_meta_get($pdo, "backup_last_ok") === "1",
  "backups" => podmei_list_backups(14),
  "cron" => [
    "midnight" => "0 0 * * * /usr/local/bin/php {$docRootHint}",
    "hourlySafety" => "5 * * * * /usr/local/bin/php {$docRootHint}",
    "note" => "No painel HostGator, use o caminho absoluto do PHP e do site. Se o servidor estiver em UTC, use 0 3 * * * para 00:00 de Brasília.",
  ],
  "appUrl" => $appUrl,
]);
