<?php
/**
 * Esqueci a senha — SQLite + mail() automático.
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
$acao = strtolower(trim((string) ($in["acao"] ?? "esqueci")));
$busca = strtolower(trim((string) ($in["usuario"] ?? $in["username"] ?? $in["email"] ?? "")));
if ($acao !== "esqueci") respond(400, ["error" => "Ação inválida."]);
if ($busca === "") respond(400, ["error" => "Informe o usuário ou o e-mail cadastrado."]);

$generic = "Se este cadastro existir, enviamos uma senha nova para o e-mail cadastrado. Confira a caixa de entrada e o spam.";

$st = $pdo->prepare("SELECT * FROM users WHERE lower(username) = ? OR lower(email) = ? LIMIT 1");
$st->execute([$busca, $busca]);
$user = $st->fetch();
if (!$user || ($user["status"] ?? "ativo") !== "ativo") {
  respond(200, ["ok" => true, "mensagem" => $generic]);
}

$email = strtolower(trim((string) ($user["email"] ?? "")));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  respond(400, ["error" => "Este acesso não tem e-mail cadastrado. Fale com o suporte."]);
}

$chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
$senha = "";
for ($i = 0; $i < 10; $i++) $senha .= $chars[random_int(0, strlen($chars) - 1)];

$pdo->prepare("UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?")
  ->execute([password_hash($senha, PASSWORD_DEFAULT), $user["id"]]);

$username = (string) $user["username"];
$nome = (string) ($user["nome"] ?: $username);
$url = rtrim((string) ($config["app_url"] ?? "https://podmei.com"), "/") . "/entrar";
$body = "Olá, {$nome}.\n\nRecebemos um pedido de nova senha para o usuário {$username}.\n\nSite: {$url}\nUsuário: {$username}\nSenha provisória: {$senha}\n\nEntre e, se quiser, altere a senha depois.\n\nPODMEI\n";
$ok = podmei_mail($email, "Senha provisória — PODMEI", $body);
podmei_log_email($email, "Senha provisória — PODMEI", $ok, $ok ? "" : "mail() falhou");

if (!$ok) {
  respond(502, ["error" => "Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos."]);
}
respond(200, ["ok" => true, "mensagem" => "Enviamos uma senha nova para {$email}. Confira a caixa de entrada e o spam."]);
