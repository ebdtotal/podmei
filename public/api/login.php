<?php
/**
 * Login via SQLite (podmei.sqlite) — sem flock / store.json.
 */
ob_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
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

try {
  require_once __DIR__ . "/db.php";
  $config = podmei_cfg();
  $pdo = podmei_db();
  require_once __DIR__ . "/backup-lib.php";
  podmei_maybe_daily_backup_lazy();
} catch (Throwable $e) {
  respond(500, ["error" => "Banco de dados indisponível."]);
}

$in = json_decode(file_get_contents("php://input") ?: "{}", true);
if (!is_array($in)) $in = [];
$login = trim((string) ($in["username"] ?? ""));
$pass = trim((string) ($in["password"] ?? ""));
$pass = preg_replace('/[\x{200B}-\x{200D}\x{FEFF}]/u', "", $pass) ?? $pass;
if ($login === "" || $pass === "") respond(400, ["error" => "Informe usuário e senha."]);

function token_make_login($config, $userId) {
  $exp = time() + 60 * 60 * 24 * 30;
  $payload = $userId . "." . $exp;
  $sig = hash_hmac("sha256", $payload, $config["secret"]);
  return rtrim(strtr(base64_encode($payload . "." . $sig), "+/", "-_"), "=");
}

function public_user_row($u) {
  return [
    "id" => $u["id"],
    "username" => $u["username"],
    "email" => $u["email"],
    "nome" => $u["nome"],
    "role" => $u["role"],
    "plan" => $u["plan"] ?? $u["role"],
    "mustChangePassword" => !empty($u["must_change_password"]),
    "telefone" => $u["telefone"] ?? "",
    "cnpj" => $u["cnpj"] ?? "",
    "empresa" => $u["empresa"] ?? "",
  ];
}

$mid = podmei_master_id($config);
$isMasterLogin = strcasecmp($login, (string) $config["master_username"]) === 0
  || strcasecmp($login, (string) $config["master_email"]) === 0;
if ($isMasterLogin && hash_equals((string) $config["master_password"], $pass)) {
  $st = $pdo->prepare("SELECT * FROM users WHERE role = 'master' LIMIT 1");
  $st->execute();
  $u = $st->fetch();
  if (!$u) {
    podmei_ensure_master($pdo);
    $st->execute();
    $u = $st->fetch();
  }
  $pdo->prepare("UPDATE users SET id=?, password_hash=?, status='ativo' WHERE role='master'")
    ->execute([$mid, password_hash($config["master_password"], PASSWORD_DEFAULT)]);
  $u["id"] = $mid;
  $u["password_hash"] = password_hash($config["master_password"], PASSWORD_DEFAULT);
  respond(200, ["token" => token_make_login($config, $mid), "user" => public_user_row($u)]);
}

$st = $pdo->prepare("SELECT * FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?) LIMIT 1");
$st->execute([$login, $login]);
$u = $st->fetch();
if ($u) {
  if (($u["status"] ?? "ativo") !== "ativo") respond(403, ["error" => "Conta bloqueada."]);
  if (!empty($u["password_hash"]) && password_verify($pass, $u["password_hash"])) {
    respond(200, ["token" => token_make_login($config, $u["id"]), "user" => public_user_row($u)]);
  }
}

// Conta paga sem senha válida → reemite
$st = $pdo->prepare("SELECT * FROM signups WHERE status = 'pago' AND (lower(email) = lower(?) OR lower(username) = lower(?)) ORDER BY pago_em DESC LIMIT 1");
$st->execute([$login, $login]);
$signup = $st->fetch();
if ($signup) {
  $email = strtolower(trim((string) $signup["email"]));
  $username = trim((string) ($signup["username"] ?: $email));
  $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  $temp = "";
  for ($i = 0; $i < 10; $i++) $temp .= $chars[random_int(0, strlen($chars) - 1)];
  $hash = password_hash($temp, PASSWORD_DEFAULT);
  $plan = (($signup["plan"] ?? "") === "contador") ? "contador" : "pro";

  $ust = $pdo->prepare("SELECT * FROM users WHERE id = ? OR lower(email) = lower(?) LIMIT 1");
  $ust->execute([(string) ($signup["user_id"] ?? ""), $email]);
  $user = $ust->fetch();
  if ($user && ($user["role"] ?? "") !== "master") {
    $pdo->prepare("UPDATE users SET password_hash=?, status='ativo', must_change_password=0 WHERE id=?")
      ->execute([$hash, $user["id"]]);
    $username = (string) $user["username"];
  } else {
    $userId = podmei_uid("usr");
    $pdo->prepare("INSERT INTO users (id,username,email,nome,password_hash,role,plan,status,must_change_password,telefone,cnpj,empresa,created_at)
      VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?)")->execute([
      $userId, $username, $email, $signup["nome"], $hash, $plan, $plan, "ativo",
      $signup["telefone"] ?? "", $signup["cnpj"] ?? "", $signup["empresa"] ?? "", gmdate("Y-m-d\\TH:i:s\\Z"),
    ]);
    $pdo->prepare("UPDATE signups SET user_id=?, username=? WHERE id=?")->execute([$userId, $username, $signup["id"]]);
  }
  $url = rtrim((string) ($config["app_url"] ?? "https://podmei.com"), "/") . "/entrar";
  $body = "Olá, {$signup["nome"]}.\n\nGeramos uma nova senha para o seu acesso ao PODMEI.\n\nSite: {$url}\nUsuário: {$username}\nSenha: {$temp}\n\nPODMEI\n";
  $ok = podmei_mail($email, "Seu acesso PODMEI (nova senha)", $body);
  podmei_log_email($email, "Seu acesso PODMEI (nova senha)", $ok, $ok ? "" : "mail() falhou");
  respond(401, ["error" => "A senha antiga não vale mais. Enviamos uma nova senha para {$email}. Confira a caixa de entrada e o spam."]);
}

respond(401, ["error" => "Usuário ou senha inválidos."]);
