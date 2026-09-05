<?php
/**
 * Assinaturas / master confirm — espelho parcial do EDB clientes.php
 * GET: lista signups | PATCH confirmar_signup | POST inicia checkout
 */
declare(strict_types=1);
ob_start();
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) === "OPTIONS") {
  http_response_code(204);
  exit;
}

require __DIR__ . "/paylib.php";

function pay_bearer(): string {
  $hdr = $_SERVER["HTTP_AUTHORIZATION"] ?? "";
  if (preg_match("/Bearer\\s+(.+)/i", $hdr, $m)) return trim($m[1]);
  $in = pay_body();
  return (string) ($in["token"] ?? $_GET["token"] ?? "");
}

function pay_token_user_id(string $token): ?string {
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

function pay_require_master(): array {
  $uid = pay_token_user_id(pay_bearer());
  if (!$uid) pay_json_err("Sessão inválida.", 401);
  $store = pay_load_store();
  foreach ($store["users"] as $u) {
    if (($u["id"] ?? "") === $uid) {
      if (($u["role"] ?? "") !== "master") pay_json_err("Acesso master necessário.", 403);
      if (($u["status"] ?? "ativo") !== "ativo") pay_json_err("Conta bloqueada.", 403);
      return $u;
    }
  }
  // Master estável: se token é do id canônico, aceita após garantir store
  $cfg = pay_cfg();
  if ($uid === pay_master_id($cfg)) {
    pay_save_store($store);
    return ["id" => $uid, "role" => "master"];
  }
  pay_json_err("Usuário não encontrado. Saia e entre de novo no master.", 401);
}

$method = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));

if ($method === "POST") {
  $in = pay_body();
  $acao = (string) ($in["acao"] ?? $in["action"] ?? "");
  if ($acao === "confirmar_signup" || $acao === "confirm-payment") {
    pay_require_master();
    $id = trim((string) ($in["id"] ?? ""));
    if ($id === "") pay_json_err("Assinatura inválida.");
    $out = pay_ativar_signup($id, "manual");
    pay_json_ok($out);
  }
  if ($acao === "criar_conta_teste" || $acao === "create-test-account") {
    pay_require_master();
    pay_json_ok(pay_criar_conta_teste($in));
  }
  // Checkout público (também disponível em checkout.php)
  pay_json_ok(pay_iniciar_assinatura($in));
}

if ($method === "PATCH") {
  pay_require_master();
  $in = pay_body();
  $acao = (string) ($in["acao"] ?? "");
  if ($acao === "confirmar_signup") {
    $id = trim((string) ($in["id"] ?? ""));
    if ($id === "") pay_json_err("Assinatura inválida.");
    pay_json_ok(pay_ativar_signup($id, "manual"));
  }
  pay_json_err("Ação inválida.");
}

if ($method === "GET") {
  pay_require_master();
  $rows = pay_list_signups();
  $leads = array_map("pay_signup_to_lead", $rows);
  pay_json_ok([
    "assinaturas" => $rows,
    "leads" => $leads,
  ]);
}

pay_json_err("Método não suportado.", 405);
