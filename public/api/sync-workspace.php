<?php
/**
 * Grava a área do cliente (lançamentos, empresa…) direto no SQLite.
 * Não reescreve o banco inteiro — evita perda de dados e HTTP 500.
 */
declare(strict_types=1);
ob_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) === "OPTIONS") {
  http_response_code(204);
  exit;
}

function respond($code, $payload) {
  while (ob_get_level() > 0) ob_end_clean();
  header("Content-Type: application/json; charset=utf-8");
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "POST") {
  respond(405, ["error" => "Use POST."]);
}

try {
  require_once __DIR__ . "/db.php";
  $config = podmei_cfg();
  $pdo = podmei_db();
} catch (Throwable $e) {
  respond(500, ["error" => "Banco de dados indisponível."]);
}

$in = json_decode(file_get_contents("php://input") ?: "{}", true);
if (!is_array($in)) $in = [];
$ws = $in["workspace"] ?? null;
if (!$ws || !is_array($ws)) respond(400, ["error" => "Workspace ausente."]);

$hdr = $_SERVER["HTTP_AUTHORIZATION"] ?? "";
$token = "";
if (preg_match("/Bearer\\s+(.+)/i", $hdr, $m)) $token = trim($m[1]);
if ($token === "") $token = (string) ($in["token"] ?? "");
if ($token === "") respond(401, ["error" => "Sessão inválida."]);

$raw = base64_decode(strtr($token, "-_", "+/"));
if (!$raw) respond(401, ["error" => "Sessão inválida."]);
$parts = explode(".", $raw);
if (count($parts) !== 3) respond(401, ["error" => "Sessão inválida."]);
[$userId, $exp, $sig] = $parts;
$expect = hash_hmac("sha256", $userId . "." . $exp, (string) $config["secret"]);
if (!hash_equals($expect, $sig) || intval($exp) < time()) {
  respond(401, ["error" => "Sessão expirada. Entre de novo."]);
}

$st = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
$st->execute([$userId]);
$user = $st->fetch();
if (!$user) respond(401, ["error" => "Usuário não encontrado."]);
if (($user["status"] ?? "ativo") !== "ativo") respond(403, ["error" => "Conta bloqueada."]);
if (($user["role"] ?? "") === "master") respond(400, ["error" => "Conta master não sincroniza área de cliente."]);

try {
  $updatedAt = podmei_upsert_workspace(
    (string) $user["id"],
    (string) ($user["nome"] ?? ""),
    (string) ($user["email"] ?? ""),
    (string) ($user["plan"] ?? "pro"),
    $ws
  );
} catch (Throwable $e) {
  respond(500, ["error" => "Não foi possível gravar os dados na nuvem."]);
}

respond(200, ["ok" => true, "updatedAt" => $updatedAt]);
