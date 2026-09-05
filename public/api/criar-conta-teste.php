<?php
/**
 * Cria conta Contador de teste sem Mercado Pago.
 * Protegido por chave de seed OU sessão master.
 * Remova este arquivo do servidor depois de usar.
 */
declare(strict_types=1);
ob_start();
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) === "OPTIONS") {
  http_response_code(204);
  exit;
}

require __DIR__ . "/paylib.php";

const PODMEI_TEST_SEED_KEY = "PodmeiContadorTeste2026";

function seed_bearer(): string {
  $hdr = $_SERVER["HTTP_AUTHORIZATION"] ?? "";
  if (preg_match("/Bearer\\s+(.+)/i", $hdr, $m)) return trim($m[1]);
  $in = pay_body();
  return (string) ($in["token"] ?? $_GET["token"] ?? "");
}

function seed_token_user_id(string $token): ?string {
  $cfg = pay_cfg();
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

function seed_authorized(array $in): bool {
  $key = trim((string) ($in["key"] ?? $_GET["key"] ?? ""));
  if ($key !== "" && hash_equals(PODMEI_TEST_SEED_KEY, $key)) return true;

  $uid = seed_token_user_id(seed_bearer());
  if (!$uid) return false;
  $store = pay_load_store();
  foreach ($store["users"] as $u) {
    if (($u["id"] ?? "") === $uid && ($u["role"] ?? "") === "master") return true;
  }
  $cfg = pay_cfg();
  return $uid === pay_master_id($cfg);
}

$method = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));
if ($method !== "GET" && $method !== "POST") {
  pay_json_err("Método não suportado.", 405);
}

$in = $method === "POST" ? pay_body() : [];
if (!seed_authorized($in)) {
  pay_json_err("Não autorizado. Use key de seed ou token master.", 401);
}

$plan = (($in["plan"] ?? $_GET["plan"] ?? "") === "pro") ? "pro" : "contador";
$out = pay_criar_conta_teste([
  "plan" => $plan,
  "email" => $in["email"] ?? $_GET["email"] ?? null,
  "username" => $in["username"] ?? $_GET["username"] ?? null,
  "nome" => $in["nome"] ?? $_GET["nome"] ?? null,
  "password" => $in["password"] ?? $_GET["password"] ?? "Contador@Teste26",
]);

pay_json_ok($out);
