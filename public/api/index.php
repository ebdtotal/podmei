<?php
ob_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

$config = require __DIR__ . "/config.php";
$mailConfigFile = __DIR__ . "/mail-config.php";
if (is_file($mailConfigFile)) {
  $mailCfg = require $mailConfigFile;
  if (is_array($mailCfg)) $config = array_merge($config, $mailCfg);
}
require_once __DIR__ . "/mercadopago.php";
require_once __DIR__ . "/db.php";
require_once __DIR__ . "/paylib.php";
require_once __DIR__ . "/backup-lib.php";
@podmei_maybe_daily_backup_lazy();
$dataDir = __DIR__ . "/data";
$storeFile = $dataDir . "/store.json"; // legado — dados vivos estão em podmei.sqlite

if (!is_dir($dataDir)) {
  mkdir($dataDir, 0750, true);
}

function respond($code, $payload) {
  while (ob_get_level() > 0) {
    ob_end_clean();
  }
  header("Content-Type: application/json; charset=utf-8");
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function uid($prefix) {
  return $prefix . "_" . bin2hex(random_bytes(5)) . dechex(time());
}

function now_iso() {
  return gmdate("Y-m-d\\TH:i:s\\Z");
}

function today() {
  return date("Y-m-d");
}

function add_months($iso, $months) {
  $d = DateTime::createFromFormat("Y-m-d", $iso) ?: new DateTime();
  $d->modify("+" . intval($months) . " month");
  return $d->format("Y-m-d");
}

function emv($id, $value) {
  return $id . str_pad(strlen($value), 2, "0", STR_PAD_LEFT) . $value;
}

function crc16($payload) {
  $crc = 0xFFFF;
  $len = strlen($payload);
  for ($i = 0; $i < $len; $i++) {
    $crc ^= ord($payload[$i]) << 8;
    for ($b = 0; $b < 8; $b++) {
      $crc = ($crc & 0x8000) ? (($crc << 1) ^ 0x1021) : ($crc << 1);
      $crc &= 0xFFFF;
    }
  }
  return strtoupper(str_pad(dechex($crc), 4, "0", STR_PAD_LEFT));
}

function pix_payload($config, $amount, $txid) {
  $key = trim($config["pix_key"] ?? "");
  if ($key === "") return "";
  $merchant = emv("00", "BR.GOV.BCB.PIX") . emv("01", $key);
  $name = substr($config["pix_name"] ?: "POD MEI", 0, 25);
  $city = substr($config["pix_city"] ?: "SAO PAULO", 0, 15);
  $txid = substr(preg_replace("/[^A-Za-z0-9]/", "", $txid) ?: "PODMEI", 0, 25);
  $body = emv("00", "01")
    . emv("26", $merchant)
    . emv("52", "0000")
    . emv("53", "986")
    . emv("54", number_format($amount, 2, ".", ""))
    . emv("58", "BR")
    . emv("59", $name)
    . emv("60", $city)
    . emv("62", emv("05", $txid))
    . "6304";
  return $body . crc16($body);
}

function plan_price($plan, $cycle) {
  $prices = [
    "pro" => ["month" => 29.9, "year" => 299],
    "premium" => ["month" => 49.9, "year" => 499],
    "contador" => ["month" => 97.9, "year" => 977],
  ];
  if (!isset($prices[$plan])) $plan = "pro";
  return $cycle === "year" ? $prices[$plan]["year"] : $prices[$plan]["month"];
}

function load_store($file, $config) {
  try {
    return podmei_store_array();
  } catch (Throwable $e) {
    respond(500, ["error" => "Banco de dados indisponível. Verifique api/data no servidor."]);
  }
}

/** Só leitura — SQLite (sem flock de arquivo). */
function load_store_readonly($file, $config) {
  return load_store($file, $config);
}

function save_store($file, $store) {
  try {
    podmei_save_store_array($store);
  } catch (Throwable $e) {
    // tenta backup JSON se SQLite falhar
    @file_put_contents($file . ".retry.json", json_encode($store, JSON_UNESCAPED_UNICODE));
  }
}

function master_stable_id($config) {
  return "usr_master_" . substr(hash_hmac("sha256", (string) $config["master_username"], (string) $config["secret"]), 0, 16);
}

function empty_store($config) {
  $id = master_stable_id($config);
  return [
    "users" => [[
      "id" => $id,
      "username" => $config["master_username"],
      "email" => $config["master_email"],
      "nome" => $config["master_name"],
      "passwordHash" => password_hash($config["master_password"], PASSWORD_DEFAULT),
      "role" => "master",
      "plan" => "master",
      "status" => "ativo",
      "mustChangePassword" => false,
      "createdAt" => now_iso(),
    ]],
    "leads" => [],
    "subscriptions" => [],
    "payments" => [],
    "emails" => [],
    "workspaces" => [],
  ];
}

function public_user($u) {
  return [
    "id" => $u["id"],
    "username" => $u["username"],
    "email" => $u["email"],
    "nome" => $u["nome"],
    "role" => $u["role"],
    "plan" => $u["plan"],
    "mustChangePassword" => !empty($u["mustChangePassword"]),
    "telefone" => $u["telefone"] ?? "",
    "cnpj" => $u["cnpj"] ?? "",
    "empresa" => $u["empresa"] ?? "",
    "status" => $u["status"] ?? "ativo",
    "createdAt" => $u["createdAt"] ?? "",
  ];
}

function token_make($config, $userId) {
  $exp = time() + 60 * 60 * 24 * 30;
  $payload = $userId . "." . $exp;
  $sig = hash_hmac("sha256", $payload, $config["secret"]);
  return rtrim(strtr(base64_encode($payload . "." . $sig), "+/", "-_"), "=");
}

function token_read($config, $token) {
  $raw = base64_decode(strtr($token, "-_", "+/"));
  if (!$raw) return null;
  $parts = explode(".", $raw);
  if (count($parts) !== 3) return null;
  [$userId, $exp, $sig] = $parts;
  if (hash_hmac("sha256", $userId . "." . $exp, $config["secret"]) !== $sig) return null;
  if (intval($exp) < time()) return null;
  return $userId;
}

function bearer() {
  $hdr = $_SERVER["HTTP_AUTHORIZATION"] ?? "";
  if (preg_match("/Bearer\\s+(.+)/i", $hdr, $m)) return trim($m[1]);
  $in = json_input();
  return $in["token"] ?? ($_GET["token"] ?? "");
}

function json_input() {
  static $cached = null;
  if ($cached !== null) return $cached;
  $raw = file_get_contents("php://input");
  $cached = json_decode($raw ?: "{}", true);
  return is_array($cached) ? $cached : [];
}

function find_user(&$store, $id) {
  foreach ($store["users"] as $i => $u) {
    if ($u["id"] === $id) return $i;
  }
  return -1;
}

function auth_user($config, &$store) {
  $userId = token_read($config, bearer());
  if (!$userId) respond(401, ["error" => "Sessão inválida."]);
  $i = find_user($store, $userId);
  if ($i < 0) respond(401, ["error" => "Usuário não encontrado."]);
  if (($store["users"][$i]["status"] ?? "ativo") !== "ativo") {
    respond(403, ["error" => "Conta bloqueada."]);
  }
  return $i;
}

function require_master($config, &$store) {
  $i = auth_user($config, $store);
  if ($store["users"][$i]["role"] !== "master") respond(403, ["error" => "Acesso master necessário."]);
  return $i;
}

function temp_password() {
  $alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  $out = "";
  for ($i = 0; $i < 10; $i++) $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
  return $out . "#1";
}

function smtp_read($fp) {
  $data = "";
  while ($line = fgets($fp, 1024)) {
    $data .= $line;
    if (preg_match("/^\d{3} /", $line)) break;
  }
  return $data;
}

function smtp_cmd($fp, $cmd, $expect) {
  if ($cmd !== null) fwrite($fp, $cmd . "\r\n");
  $data = smtp_read($fp);
  return intval(substr($data, 0, 3)) === $expect;
}

function smtp_send($config, $to, $subject, $body, &$error = null) {
  $host = trim($config["smtp_host"] ?? "");
  $user = trim($config["smtp_user"] ?? $config["from_email"] ?? "");
  $pass = (string) ($config["smtp_pass"] ?? "");
  $port = intval($config["smtp_port"] ?? 587);
  if ($host === "" || $user === "" || trim($pass) === "") {
    $error = "SMTP não configurado.";
    return false;
  }
  $from = trim((string) ($config["from_email"] ?? $user));
  $fromName = $config["from_name"] ?? "PODMEI";
  $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";
  $payload = "From: {$fromName} <{$from}>\r\n"
    . "To: {$to}\r\n"
    . "Reply-To: {$from}\r\n"
    . "Subject: {$encodedSubject}\r\n"
    . "MIME-Version: 1.0\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n"
    . "\r\n"
    . $body;
  $remote = $port === 465 ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
  $fp = @stream_socket_client($remote, $errno, $errstr, 20, STREAM_CLIENT_CONNECT);
  if (!$fp) {
    $error = "Conexão SMTP falhou: {$errstr}";
    return false;
  }
  stream_set_timeout($fp, 20);
  if (!smtp_cmd($fp, null, 220) || !smtp_cmd($fp, "EHLO podmei.com", 250)) {
    $error = "SMTP recusou o EHLO inicial.";
    fclose($fp);
    return false;
  }
  if ($port !== 465) {
    if (!smtp_cmd($fp, "STARTTLS", 220)) {
      $error = "STARTTLS recusado.";
      fclose($fp);
      return false;
    }
    $crypto = defined("STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT")
      ? STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT
      : STREAM_CRYPTO_METHOD_TLS_CLIENT;
    if (!stream_socket_enable_crypto($fp, true, $crypto)) {
      $error = "Falha no TLS do SMTP.";
      fclose($fp);
      return false;
    }
    if (!smtp_cmd($fp, "EHLO podmei.com", 250)) {
      $error = "SMTP recusou o EHLO após TLS.";
      fclose($fp);
      return false;
    }
  }
  $ok = smtp_cmd($fp, "AUTH LOGIN", 334)
    && smtp_cmd($fp, base64_encode($user), 334)
    && smtp_cmd($fp, base64_encode($pass), 235)
    && smtp_cmd($fp, "MAIL FROM:<{$from}>", 250)
    && smtp_cmd($fp, "RCPT TO:<{$to}>", 250)
    && smtp_cmd($fp, "DATA", 354);
  if ($ok) {
    fwrite($fp, $payload . "\r\n.\r\n");
    $ok = smtp_cmd($fp, null, 250);
  }
  if (!$ok) $error = "Autenticação ou envio SMTP recusado.";
  smtp_cmd($fp, "QUIT", 221);
  fclose($fp);
  return $ok;
}

function access_email_body($config, $nome, $username, $password) {
  $url = rtrim($config["app_url"], "/") . "/entrar";
  $subject = "Seu acesso PODMEI está pronto";
  $body = "Olá {$nome},\n\n"
    . "Recebemos a confirmação do seu pagamento no Mercado Pago.\n"
    . "Seu acesso ao PODMEI já está liberado.\n\n"
    . "Site: {$url}\n"
    . "Usuário: {$username}\n"
    . "Senha: {$password}\n\n"
    . "Guarde estes dados. Depois de entrar, você pode alterar a senha se quiser.\n\n"
    . "PODMEI — O poder de cuidar do seu negócio.\n";
  return [$subject, $body];
}

function deliver_access_email($config, $to, $nome, $username, $password, &$error = null) {
  if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    $error = "E-mail inválido.";
    return false;
  }
  [$subject, $body] = access_email_body($config, $nome, $username, $password);
  $from = trim((string) ($config["from_email"] ?? "naoresponda@podmei.com"));
  $fromName = trim((string) ($config["from_name"] ?? "PODMEI"));
  $encoded = "=?UTF-8?B?" . base64_encode($subject) . "?=";
  $headers = "MIME-Version: 1.0\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n"
    . "From: {$fromName} <{$from}>\r\n"
    . "Reply-To: {$from}\r\n"
    . "X-Mailer: PODMEI\r\n";
  // Preferir SMTP autenticado da caixa HostGator (naoresponda@podmei.com); mail() como fallback.
  $smtpError = "";
  if (smtp_send($config, $to, $subject, $body, $smtpError)) return true;
  $ok = @mail($to, $encoded, $body, $headers, "-f" . $from);
  if ($ok) return true;
  $error = $smtpError ?: "Falha ao enviar e-mail.";
  return false;
}

function send_access_email($config, &$store, $to, $nome, $username, $password) {
  $err = "";
  $ok = deliver_access_email($config, $to, $nome, $username, $password, $err);
  [$subject] = access_email_body($config, $nome, $username, $password);
  $store["emails"][] = [
    "id" => uid("mail"),
    "to" => $to,
    "subject" => $subject,
    "at" => now_iso(),
    "ok" => (bool) $ok,
    "error" => $ok ? "" : $err,
  ];
  return (bool) $ok;
}

function log_email_event($storeFile, $config, $to, $subject, $ok, $error = "") {
  $fp = @fopen($storeFile, "c+");
  if (!$fp || !flock($fp, LOCK_EX | LOCK_NB)) {
    if ($fp) fclose($fp);
    return;
  }
  try {
    $store = load_store($storeFile, $config);
    $store["emails"][] = [
      "id" => uid("mail"),
      "to" => $to,
      "subject" => $subject,
      "at" => now_iso(),
      "ok" => (bool) $ok,
      "error" => $ok ? "" : (string) $error,
    ];
    save_store($storeFile, $store);
  } finally {
    flock($fp, LOCK_UN);
    fclose($fp);
  }
}

/** Ativa lead sem enviar e-mail (e-mail sai fora do lock, como no EDB). */
function activate_lead(&$store, $config, $leadIndex) {
  $lead = $store["leads"][$leadIndex];
  if (($lead["status"] ?? "") === "ativo" && !empty($lead["userId"])) {
    return ["lead" => $lead, "emailSent" => true, "alreadyActive" => true];
  }
  $temp = temp_password();
  $username = $lead["email"];
  foreach ($store["users"] as $u) {
    if (strcasecmp($u["email"], $lead["email"]) === 0 || strcasecmp($u["username"], $username) === 0) {
      $username = preg_replace("/@.*/", "", $lead["email"]) . substr($lead["id"], -4);
      break;
    }
  }
  $userId = uid("usr");
  $store["users"][] = [
    "id" => $userId,
    "username" => $username,
    "email" => $lead["email"],
    "nome" => $lead["nome"],
    "passwordHash" => password_hash($temp, PASSWORD_DEFAULT),
    "role" => $lead["plan"] === "contador" ? "contador" : "pro",
    "plan" => $lead["plan"],
    "status" => "ativo",
    "mustChangePassword" => false,
    "createdAt" => now_iso(),
    "telefone" => $lead["telefone"],
    "cnpj" => $lead["cnpj"],
    "empresa" => $lead["empresa"],
  ];
  $started = today();
  $months = $lead["cycle"] === "year" ? 12 : 1;
  $store["subscriptions"][] = [
    "id" => uid("sub"),
    "userId" => $userId,
    "leadId" => $lead["id"],
    "nome" => $lead["nome"],
    "email" => $lead["email"],
    "plan" => $lead["plan"],
    "cycle" => $lead["cycle"],
    "amount" => $lead["amount"],
    "status" => "ativa",
    "startedAt" => $started,
    "nextDue" => add_months($started, $months),
    "lastPaidAt" => $started,
  ];
  foreach ($store["payments"] as $p => $pay) {
    if ($pay["leadId"] === $lead["id"]) {
      $store["payments"][$p]["status"] = "confirmado";
      $store["payments"][$p]["confirmedAt"] = now_iso();
      $store["payments"][$p]["userId"] = $userId;
    }
  }
  $store["leads"][$leadIndex]["status"] = "ativo";
  $store["leads"][$leadIndex]["paidAt"] = now_iso();
  $store["leads"][$leadIndex]["userId"] = $userId;
  return [
    "lead" => $store["leads"][$leadIndex],
    "tempPassword" => $temp,
    "emailSent" => false,
    "username" => $username,
    "mailTo" => $lead["email"],
    "mailNome" => $lead["nome"],
  ];
}

function finish_access_email($config, $storeFile, $result) {
  if (!empty($result["alreadyActive"]) || empty($result["tempPassword"])) {
    $result["emailSent"] = !empty($result["emailSent"]);
    return $result;
  }
  $err = "";
  $ok = deliver_access_email(
    $config,
    (string) ($result["mailTo"] ?? ""),
    (string) ($result["mailNome"] ?? ""),
    (string) ($result["username"] ?? ""),
    (string) $result["tempPassword"],
    $err
  );
  [$subject] = access_email_body($config, (string) ($result["mailNome"] ?? ""), (string) ($result["username"] ?? ""), (string) $result["tempPassword"]);
  log_email_event($storeFile, $config, (string) ($result["mailTo"] ?? ""), $subject, $ok, $err);
  $result["emailSent"] = $ok;
  unset($result["mailTo"], $result["mailNome"]);
  return $result;
}

function pending_dir($dataDir) {
  $dir = $dataDir . "/pending";
  if (!is_dir($dir)) @mkdir($dir, 0750, true);
  return $dir;
}

function save_pending_checkout($dataDir, $lead, $payment) {
  $dir = pending_dir($dataDir);
  $payload = ["lead" => $lead, "payment" => $payment];
  @file_put_contents($dir . "/" . $lead["id"] . ".json", json_encode($payload, JSON_UNESCAPED_UNICODE));
}

function merge_pending_checkouts($dataDir, &$store, $consume = false) {
  $dir = $dataDir . "/pending";
  if (!is_dir($dir)) return;
  foreach (glob($dir . "/*.json") ?: [] as $file) {
    $raw = @file_get_contents($file);
    $row = json_decode((string) $raw, true);
    if (!is_array($row) || empty($row["lead"]["id"])) {
      if ($consume) @unlink($file);
      continue;
    }
    $id = $row["lead"]["id"];
    $exists = false;
    foreach ($store["leads"] as $lead) {
      if (($lead["id"] ?? "") === $id) { $exists = true; break; }
    }
    if (!$exists) {
      $store["leads"][] = $row["lead"];
      if (!empty($row["payment"]) && is_array($row["payment"])) {
        $payExists = false;
        foreach ($store["payments"] as $pay) {
          if (($pay["id"] ?? "") === ($row["payment"]["id"] ?? "") || ($pay["leadId"] ?? "") === $id) {
            $payExists = true;
            break;
          }
        }
        if (!$payExists) $store["payments"][] = $row["payment"];
      }
    }
    // Só apaga o pending depois de gravar no store (consume=true)
    if ($consume) @unlink($file);
  }
}

function persist_pending_into_store($storeFile, $dataDir, $config) {
  $fp = store_try_lock($storeFile, 8);
  if (!$fp) return false;
  try {
    $store = load_store($storeFile, $config);
    merge_pending_checkouts($dataDir, $store, false);
    save_store($storeFile, $store);
    merge_pending_checkouts($dataDir, $store, true);
    return true;
  } finally {
    flock($fp, LOCK_UN);
    fclose($fp);
  }
}

$action = $_GET["action"] ?? "";
if ($action === "") {
  $inAction = json_input()["action"] ?? "";
  $known = ["ping", "login", "me", "change-password", "checkout", "checkout-test", "lead", "confirm-payment", "payment-status", "leads", "accounts", "subscriptions", "finance", "set-subscription", "update-subscription", "delete-payment", "delete-account", "delete-my-account", "resend-password", "sync-workspace", "my-workspace", "workspaces", "my-subscription", "cancel-subscription", "mp-webhook"];
  if (in_array($inAction, $known, true)) {
    $action = $inAction;
  } else {
    $typeHint = $_GET["topic"] ?? $_GET["type"] ?? (json_input()["type"] ?? "");
    if ($typeHint !== "" || !empty(json_input()["data"]["id"]) || strpos((string) $inAction, "payment") === 0) {
      $action = "mp-webhook";
    }
  }
}

function store_open_lock($storeFile, $waitSeconds = 8) {
  // Persistência é SQLite; handle só para compatibilidade do finally
  $fp = fopen("php://memory", "r+");
  if (!$fp) respond(500, ["error" => "Sem memória para gravar dados."]);
  return $fp;
}

function store_try_lock($storeFile, $waitSeconds = 3) {
  return @fopen("php://memory", "r+");
}

// Healthcheck sem lock — o front usa isso para saber se a API PHP está no ar
if ($action === "ping") {
  respond(200, ["ok" => true, "app" => "podmei", "mp" => mp_enabled($config)]);
}

// Checkout estilo EDB: preferencial via checkout.php; fallback aqui usa a mesma recorrência
if ($action === "checkout" || $action === "checkout-test") {
  $in = json_input();
  if ($action === "checkout-test") {
    $in["test"] = true;
    $in["action"] = "checkout-test";
  }
  $out = pay_iniciar_assinatura($in);
  respond(200, $out);
}

// Poll de retorno (como pagamento.php?sid= do EDB)
if ($action === "payment-status") {
  $in = json_input();
  $id = trim((string) ($_GET["id"] ?? $_GET["sid"] ?? $_GET["external_reference"] ?? $in["id"] ?? $in["sid"] ?? ""));
  $paymentId = trim((string) ($_GET["payment_id"] ?? $_GET["collection_id"] ?? $in["paymentId"] ?? $in["payment_id"] ?? ""));
  if ($id === "") respond(400, ["error" => "Assinatura não encontrada."]);

  $payment = null;
  if (mp_enabled($config) && $paymentId !== "") {
    [$payment] = mp_get_payment($config, $paymentId);
  } elseif (mp_enabled($config)) {
    [$payment] = mp_search_approved($config, $id);
  }

  $fp = store_try_lock($storeFile, 12);
  if (!$fp) {
    // Leitura sem lock exclusivo: não trava o retorno do cliente
    $store = load_store_readonly($storeFile, $config);
    merge_pending_checkouts($dataDir, $store, false);
    $lead = null;
    foreach ($store["leads"] as $row) {
      if (($row["id"] ?? "") === $id) { $lead = $row; break; }
    }
    if (!$lead) respond(404, ["error" => "Assinatura não encontrada."]);
    $status = (($lead["status"] ?? "") === "ativo") ? "pago" : "pendente";
    respond(200, [
      "status" => $status,
      "signupId" => $id,
      "leadId" => $id,
      "email" => $lead["email"] ?? "",
      "nome" => $lead["nome"] ?? "",
      "lead" => $lead,
      "busy" => true,
    ]);
  }
  try {
    $store = load_store($storeFile, $config);
    merge_pending_checkouts($dataDir, $store, false);
    $leadIndex = -1;
    foreach ($store["leads"] as $i => $lead) {
      if ($lead["id"] === $id) { $leadIndex = $i; break; }
    }
    if ($leadIndex < 0) respond(404, ["error" => "Assinatura não encontrada."]);
    $lead = $store["leads"][$leadIndex];
    if (($lead["status"] ?? "") === "ativo") {
      save_store($storeFile, $store);
      merge_pending_checkouts($dataDir, $store, true);
      respond(200, [
        "status" => "pago",
        "signupId" => $id,
        "leadId" => $id,
        "email" => $lead["email"],
        "nome" => $lead["nome"],
        "lead" => $lead,
      ]);
    }
    $result = null;
    if ($payment && mp_payment_matches_lead($payment, $lead)) {
      $store["leads"][$leadIndex]["mpPaymentId"] = (string) ($payment["id"] ?? $paymentId);
      mp_mark_payment($store, $id, $store["leads"][$leadIndex]["mpPaymentId"]);
      $result = activate_lead($store, $config, $leadIndex);
      save_store($storeFile, $store);
      merge_pending_checkouts($dataDir, $store, true);
    } else {
      respond(200, [
        "status" => "pendente",
        "signupId" => $id,
        "leadId" => $id,
        "email" => $lead["email"],
        "nome" => $lead["nome"],
        "lead" => $lead,
      ]);
    }
  } finally {
    flock($fp, LOCK_UN);
    fclose($fp);
  }
  if ($result) {
    $result = finish_access_email($config, $storeFile, $result);
    respond(200, [
      "status" => "pago",
      "signupId" => $id,
      "leadId" => $id,
      "email" => $result["lead"]["email"] ?? "",
      "nome" => $result["lead"]["nome"] ?? "",
      "lead" => $result["lead"],
      "emailSent" => $result["emailSent"] ?? false,
      "username" => $result["username"] ?? null,
    ]);
  }
}

// Leituras sem lock exclusivo — painel master / login não podem depender de flock
$readActions = ["login", "me", "lead", "leads", "accounts", "subscriptions", "finance", "workspaces", "my-workspace", "my-subscription"];
if (in_array($action, $readActions, true)) {
  $store = load_store_readonly($storeFile, $config);
  // Inclui pending na resposta sem apagar (consume=false) — assim o master vê quem pagou/testou
  merge_pending_checkouts($dataDir, $store, false);
  if ($action === "my-subscription") {
    $i = auth_user($config, $store);
    $u = $store["users"][$i];
    respond(200, ["subscription" => pay_minha_assinatura((string) $u["id"])]);
  }
  if ($action === "login") {
    $in = json_input();
    $login = trim($in["username"] ?? "");
    $pass = $in["password"] ?? "";
    foreach ($store["users"] as $u) {
      $match = strcasecmp($u["username"], $login) === 0 || strcasecmp($u["email"], $login) === 0;
      if ($match && password_verify($pass, $u["passwordHash"])) {
        if (($u["status"] ?? "ativo") !== "ativo") respond(403, ["error" => "Conta bloqueada."]);
        respond(200, ["token" => token_make($config, $u["id"]), "user" => public_user($u)]);
      }
    }
    respond(401, ["error" => "Usuário ou senha inválidos."]);
  }
  if ($action === "me") {
    $i = auth_user($config, $store);
    respond(200, ["user" => public_user($store["users"][$i])]);
  }
  if ($action === "lead") {
    $id = $_GET["id"] ?? json_input()["id"] ?? "";
    foreach ($store["leads"] as $lead) {
      if ($lead["id"] === $id) respond(200, ["lead" => $lead]);
    }
    respond(404, ["error" => "Pagamento não encontrado."]);
  }
  if ($action === "leads") {
    require_master($config, $store);
    respond(200, ["leads" => array_reverse($store["leads"])]);
  }
  if ($action === "accounts") {
    require_master($config, $store);
    $out = [];
    foreach ($store["users"] as $u) $out[] = public_user($u);
    respond(200, ["accounts" => $out]);
  }
  if ($action === "subscriptions") {
    require_master($config, $store);
    respond(200, ["subscriptions" => array_reverse($store["subscriptions"])]);
  }
  if ($action === "finance") {
    require_master($config, $store);
    $payments = array_reverse($store["payments"]);
    $mrr = 0;
    foreach ($store["subscriptions"] as $s) {
      if (($s["status"] ?? "") !== "ativa") continue;
      $mrr += $s["cycle"] === "year" ? $s["amount"] / 12 : $s["amount"];
    }
    $month = date("Y-m");
    $received = 0;
    foreach ($store["payments"] as $p) {
      if (($p["status"] ?? "") === "confirmado" && strpos($p["confirmedAt"] ?? "", $month) === 0) {
        $received += $p["amount"];
      }
    }
    respond(200, [
      "mrr" => round($mrr, 2),
      "receivedThisMonth" => round($received, 2),
      "payments" => $payments,
      "emails" => array_reverse($store["emails"]),
    ]);
  }
  if ($action === "my-workspace") {
    $i = auth_user($config, $store);
    $u = $store["users"][$i];
    $row = podmei_get_workspace((string) $u["id"]);
    if ($row && !empty($row["workspace"])) {
      respond(200, ["snapshot" => $row]);
    }
    respond(200, ["snapshot" => null, "onboarding" => public_user($u)]);
  }
  if ($action === "workspaces") {
    require_master($config, $store);
    respond(200, ["workspaces" => $store["workspaces"]]);
  }
}

// Troca de senha: UPDATE direto (não regrava o SQLite inteiro — evita HTTP 500)
if ($action === "change-password") {
  $store = load_store_readonly($storeFile, $config);
  $i = auth_user($config, $store);
  $in = json_input();
  $next = (string) ($in["password"] ?? "");
  if (strlen($next) < 8) respond(400, ["error" => "A senha precisa ter pelo menos 8 caracteres."]);
  $hash = password_hash($next, PASSWORD_DEFAULT);
  $uid = (string) $store["users"][$i]["id"];
  try {
    $pdo = podmei_db();
    $pdo->prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?")
      ->execute([$hash, $uid]);
  } catch (Throwable $e) {
    respond(500, ["error" => "Não foi possível gravar a nova senha. Tente de novo."]);
  }
  $store["users"][$i]["passwordHash"] = $hash;
  $store["users"][$i]["mustChangePassword"] = false;
  respond(200, ["user" => public_user($store["users"][$i])]);
}

// Sync da área do cliente sem reescrever o banco (lançamentos / empresa)
if ($action === "sync-workspace") {
  $store = load_store_readonly($storeFile, $config);
  $i = auth_user($config, $store);
  $u = $store["users"][$i];
  $in = json_input();
  $ws = $in["workspace"] ?? null;
  if (!$ws || !is_array($ws)) respond(400, ["error" => "Workspace ausente."]);
  try {
    $result = podmei_upsert_workspace(
      (string) $u["id"],
      (string) ($u["nome"] ?? ""),
      (string) ($u["email"] ?? ""),
      (string) ($u["plan"] ?? "pro"),
      $ws,
      is_array($ws) && !empty($ws["updatedAt"]) ? (string) $ws["updatedAt"] : null
    );
  } catch (Throwable $e) {
    respond(500, ["error" => "Não foi possível gravar os dados na nuvem."]);
  }
  respond(200, [
    "ok" => true,
    "accepted" => (bool) ($result["accepted"] ?? true),
    "updatedAt" => (string) ($result["updatedAt"] ?? ""),
  ]);
}

$fp = store_open_lock($storeFile, 8);
$store = load_store($storeFile, $config);
merge_pending_checkouts($dataDir, $store, false);
save_store($storeFile, $store);
merge_pending_checkouts($dataDir, $store, true);

try {
  if ($action === "confirm-payment") {
    $in = json_input();
    $id = $in["id"] ?? "";
    $paymentId = $in["paymentId"] ?? $in["payment_id"] ?? "";
    // Garante pending no store antes de procurar
    merge_pending_checkouts($dataDir, $store, true);
    save_store($storeFile, $store);
    $leadIndex = -1;
    foreach ($store["leads"] as $i => $lead) {
      if ($lead["id"] === $id) { $leadIndex = $i; break; }
    }
    if ($leadIndex < 0) respond(404, ["error" => "Pagamento não encontrado."]);
    $asMaster = false;
    $token = bearer();
    if ($token) {
      $uid = token_read($config, $token);
      $ui = $uid ? find_user($store, $uid) : -1;
      $asMaster = $ui >= 0 && $store["users"][$ui]["role"] === "master";
    }
    if (mp_enabled($config) && !$asMaster) {
      flock($fp, LOCK_UN);
      $payment = null;
      $mpErr = null;
      if ($paymentId !== "") {
        [$payment, $mpErr] = mp_get_payment($config, $paymentId);
      } else {
        [$payment, $mpErr] = mp_search_approved($config, $id);
      }
      flock($fp, LOCK_EX);
      $store = load_store($storeFile, $config);
      merge_pending_checkouts($dataDir, $store, true);
      $leadIndex = -1;
      foreach ($store["leads"] as $i => $lead) {
        if ($lead["id"] === $id) { $leadIndex = $i; break; }
      }
      if ($leadIndex < 0) respond(404, ["error" => "Pagamento não encontrado."]);
      if ($mpErr) respond(502, ["error" => $mpErr]);
      if (!$payment || !mp_payment_matches_lead($payment, $store["leads"][$leadIndex])) {
        $store["leads"][$leadIndex]["status"] = "aguardando_confirmacao";
        save_store($storeFile, $store);
        respond(200, ["lead" => $store["leads"][$leadIndex], "pending" => true]);
      }
      $store["leads"][$leadIndex]["mpPaymentId"] = (string) ($payment["id"] ?? $paymentId);
      mp_mark_payment($store, $id, $store["leads"][$leadIndex]["mpPaymentId"]);
      $result = activate_lead($store, $config, $leadIndex);
      save_store($storeFile, $store);
      flock($fp, LOCK_UN);
      $result = finish_access_email($config, $storeFile, $result);
      respond(200, $result);
    }
    if (!$config["auto_confirm"] && !$asMaster && ($store["leads"][$leadIndex]["status"] ?? "") !== "ativo") {
      $store["leads"][$leadIndex]["status"] = "aguardando_confirmacao";
      save_store($storeFile, $store);
      respond(200, ["lead" => $store["leads"][$leadIndex], "pending" => true]);
    }
    $result = activate_lead($store, $config, $leadIndex);
    save_store($storeFile, $store);
    flock($fp, LOCK_UN);
    $result = finish_access_email($config, $storeFile, $result);
    respond(200, $result);
  }

  if ($action === "mp-webhook") {
    if (!mp_enabled($config)) respond(200, ["ok" => true, "ignored" => "mp_disabled"]);
    [$type, $refId] = mp_notification_ref();
    flock($fp, LOCK_UN);
    $payment = null;
    $mpErr = null;
    if ($type === "merchant_order" || $type === "topic_merchant_order_wh") {
      [$order, $mpErr] = mp_get_merchant_order($config, $refId);
      if (!$mpErr) {
        foreach (($order["payments"] ?? []) as $row) {
          if (($row["status"] ?? "") === "approved" && !empty($row["id"])) {
            [$payment] = mp_get_payment($config, $row["id"]);
            if ($payment && ($payment["status"] ?? "") === "approved") break;
          }
        }
      }
    } else {
      if ($refId === "") {
        flock($fp, LOCK_EX);
        $store = load_store($storeFile, $config);
        respond(200, ["ok" => true, "ignored" => "empty"]);
      }
      [$payment, $mpErr] = mp_get_payment($config, $refId);
    }
    flock($fp, LOCK_EX);
    $store = load_store($storeFile, $config);
    merge_pending_checkouts($dataDir, $store, true);
    if ($mpErr) respond(500, ["error" => $mpErr]);
    if (!$payment || ($payment["status"] ?? "") !== "approved") {
      respond(200, ["ok" => true, "ignored" => "not_approved"]);
    }
    $leadId = (string) ($payment["external_reference"] ?? $payment["metadata"]["lead_id"] ?? "");
    $leadIndex = -1;
    foreach ($store["leads"] as $i => $lead) {
      if ($lead["id"] === $leadId) { $leadIndex = $i; break; }
    }
    if ($leadIndex < 0) respond(200, ["ok" => true, "ignored" => "lead_not_found"]);
    if (!mp_payment_matches_lead($payment, $store["leads"][$leadIndex])) {
      respond(200, ["ok" => true, "ignored" => "mismatch"]);
    }
    if (($store["leads"][$leadIndex]["status"] ?? "") === "ativo") {
      respond(200, ["ok" => true, "status" => "ativo"]);
    }
    $store["leads"][$leadIndex]["mpPaymentId"] = (string) ($payment["id"] ?? "");
    mp_mark_payment($store, $leadId, $store["leads"][$leadIndex]["mpPaymentId"]);
    $result = activate_lead($store, $config, $leadIndex);
    save_store($storeFile, $store);
    flock($fp, LOCK_UN);
    finish_access_email($config, $storeFile, $result);
    respond(200, ["ok" => true, "status" => $result["lead"]["status"] ?? "ativo"]);
  }

  if ($action === "set-subscription") {
    require_master($config, $store);
    $in = json_input();
    $id = $in["id"] ?? "";
    $status = $in["status"] ?? "";
    foreach ($store["subscriptions"] as $i => $s) {
      if ($s["id"] === $id) {
        if ($status === "cancelada") {
          $pre = trim((string) ($s["mpPreapprovalId"] ?? ""));
          if ($pre !== "") pay_mp_cancelar_preapproval($pre);
        }
        $store["subscriptions"][$i]["status"] = $status;
        if ($status === "cancelada" || $status === "ativa" || $status === "atrasada") {
          foreach ($store["users"] as $u => $user) {
            if ($user["id"] === $s["userId"] && $user["role"] !== "master") {
              $store["users"][$u]["status"] = $status === "cancelada" ? "bloqueado" : "ativo";
            }
          }
        }
        save_store($storeFile, $store);
        respond(200, ["subscription" => $store["subscriptions"][$i]]);
      }
    }
    respond(404, ["error" => "Assinatura não encontrada."]);
  }

  if ($action === "cancel-subscription") {
    $i = auth_user($config, $store);
    $u = $store["users"][$i];
    if (($u["role"] ?? "") === "master") respond(400, ["error" => "Conta master não tem assinatura para cancelar."]);
    $out = pay_cancelar_assinatura_usuario((string) $u["id"]);
    // espelha no store em memória (save via SQLite já feito nas funções pay_*)
    respond(200, $out);
  }

  if ($action === "update-subscription") {
    require_master($config, $store);
    $in = json_input();
    $id = trim((string) ($in["id"] ?? ""));
    if ($id === "") respond(400, ["error" => "Assinatura inválida."]);
    foreach ($store["subscriptions"] as $i => $s) {
      if (($s["id"] ?? "") !== $id) continue;
      if (isset($in["status"]) && $in["status"] !== "") {
        if ($in["status"] === "cancelada") {
          $pre = trim((string) ($s["mpPreapprovalId"] ?? ""));
          if ($pre !== "") pay_mp_cancelar_preapproval($pre);
        }
        $store["subscriptions"][$i]["status"] = $in["status"];
      }
      if (isset($in["plan"]) && in_array($in["plan"], ["pro", "premium", "contador"], true)) {
        $store["subscriptions"][$i]["plan"] = $in["plan"];
        foreach ($store["users"] as $u => $user) {
          if (($user["id"] ?? "") === ($s["userId"] ?? "") && ($user["role"] ?? "") !== "master") {
            $store["users"][$u]["plan"] = $in["plan"];
            $store["users"][$u]["role"] = $in["plan"] === "contador" ? "contador" : "pro";
          }
        }
      }
      if (isset($in["cycle"]) && in_array($in["cycle"], ["month", "year"], true)) {
        $store["subscriptions"][$i]["cycle"] = $in["cycle"];
      }
      if (isset($in["amount"]) && is_numeric($in["amount"])) {
        $store["subscriptions"][$i]["amount"] = floatval($in["amount"]);
      }
      if (isset($in["nextDue"]) && preg_match("/^\d{4}-\d{2}-\d{2}$/", (string) $in["nextDue"])) {
        $store["subscriptions"][$i]["nextDue"] = $in["nextDue"];
      }
      $status = (string) ($store["subscriptions"][$i]["status"] ?? "");
      if ($status === "cancelada" || $status === "ativa" || $status === "atrasada" || $status === "pendente") {
        foreach ($store["users"] as $u => $user) {
          if (($user["id"] ?? "") === ($s["userId"] ?? "") && ($user["role"] ?? "") !== "master") {
            $store["users"][$u]["status"] = $status === "cancelada" ? "bloqueado" : "ativo";
          }
        }
      }
      save_store($storeFile, $store);
      respond(200, ["subscription" => $store["subscriptions"][$i]]);
    }
    respond(404, ["error" => "Assinatura não encontrada."]);
  }

  if ($action === "delete-account") {
    require_master($config, $store);
    $in = json_input();
    $userId = trim((string) ($in["userId"] ?? $in["id"] ?? ""));
    if ($userId === "") respond(400, ["error" => "Conta inválida."]);
    $idx = find_user($store, $userId);
    if ($idx < 0) respond(404, ["error" => "Conta não encontrada."]);
    if (($store["users"][$idx]["role"] ?? "") === "master") {
      respond(403, ["error" => "A conta master não pode ser excluída."]);
    }
    array_splice($store["users"], $idx, 1);
    $store["subscriptions"] = array_values(array_filter(
      $store["subscriptions"],
      function ($s) use ($userId) { return ($s["userId"] ?? "") !== $userId; }
    ));
    $store["workspaces"] = array_values(array_filter(
      $store["workspaces"],
      function ($w) use ($userId) { return ($w["userId"] ?? "") !== $userId; }
    ));
    save_store($storeFile, $store);
    respond(200, ["ok" => true, "userId" => $userId]);
  }

  if ($action === "delete-my-account") {
    $i = auth_user($config, $store);
    $u = $store["users"][$i];
    if (($u["role"] ?? "") === "master") {
      respond(403, ["error" => "A conta master não pode ser excluída."]);
    }
    $userId = (string) $u["id"];
    // Cancela cobrança recorrente no Mercado Pago, se houver
    try {
      pay_cancelar_assinatura_usuario($userId);
    } catch (Throwable $e) {
      // segue com a exclusão mesmo se o MP falhar
    }
    array_splice($store["users"], $i, 1);
    $store["subscriptions"] = array_values(array_filter(
      $store["subscriptions"],
      function ($s) use ($userId) { return ($s["userId"] ?? "") !== $userId; }
    ));
    $store["workspaces"] = array_values(array_filter(
      $store["workspaces"],
      function ($w) use ($userId) { return ($w["userId"] ?? "") !== $userId; }
    ));
    save_store($storeFile, $store);
    respond(200, ["ok" => true, "userId" => $userId]);
  }

  if ($action === "delete-payment") {
    require_master($config, $store);
    $in = json_input();
    $id = trim((string) ($in["id"] ?? ""));
    if ($id === "") respond(400, ["error" => "Pagamento inválido."]);
    $found = false;
    $next = [];
    foreach ($store["payments"] as $pay) {
      if (($pay["id"] ?? "") === $id) {
        $found = true;
        continue;
      }
      $next[] = $pay;
    }
    if (!$found) respond(404, ["error" => "Pagamento não encontrado."]);
    $store["payments"] = $next;
    save_store($storeFile, $store);
    respond(200, ["ok" => true, "id" => $id]);
  }

  if ($action === "resend-password") {
    require_master($config, $store);
    $in = json_input();
    $userId = $in["userId"] ?? "";
    $i = find_user($store, $userId);
    if ($i < 0) respond(404, ["error" => "Conta não encontrada."]);
    $temp = temp_password();
    $store["users"][$i]["passwordHash"] = password_hash($temp, PASSWORD_DEFAULT);
    $store["users"][$i]["mustChangePassword"] = true;
    $u = $store["users"][$i];
    $emailSent = send_access_email($config, $store, $u["email"], $u["nome"], $u["username"], $temp);
    save_store($storeFile, $store);
    respond(200, ["ok" => true, "emailSent" => $emailSent, "tempPassword" => $temp, "username" => $u["username"]]);
  }

  respond(404, ["error" => "Ação inválida."]);
} finally {
  flock($fp, LOCK_UN);
  fclose($fp);
}
