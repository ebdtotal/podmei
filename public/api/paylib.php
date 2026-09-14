<?php
/**
 * Fluxo de assinatura PODMEI — SQLite online (podmei.sqlite) + mail() + MP.
 */
declare(strict_types=1);

require_once __DIR__ . "/db.php";

function pay_cfg(): array { return podmei_cfg(); }

function pay_json_ok($data, int $code = 200): void {
  while (ob_get_level() > 0) ob_end_clean();
  http_response_code($code);
  header("Content-Type: application/json; charset=utf-8");
  header("Cache-Control: no-store");
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function pay_json_err(string $msg, int $code = 400): void {
  pay_json_ok(["error" => $msg, "erro" => $msg], $code);
}

function pay_body(): array {
  $raw = file_get_contents("php://input") ?: "";
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function pay_uid(string $prefix): string { return podmei_uid($prefix); }
function pay_now(): string { return gmdate("Y-m-d\\TH:i:s\\Z"); }
function pay_today(): string { return date("Y-m-d"); }
function pay_add_months(string $iso, int $months): string {
  $d = DateTime::createFromFormat("Y-m-d", $iso) ?: new DateTime();
  $d->modify("+" . $months . " month");
  return $d->format("Y-m-d");
}
function pay_email_ok(string $email): bool { return (bool) filter_var($email, FILTER_VALIDATE_EMAIL); }
function pay_senha(): string {
  $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  $out = "";
  for ($i = 0; $i < 10; $i++) $out .= $chars[random_int(0, strlen($chars) - 1)];
  return $out;
}
function pay_site_url(): string {
  $cfg = pay_cfg();
  $u = rtrim((string) ($cfg["app_url"] ?? ""), "/");
  if ($u !== "") return $u;
  $https = (!empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off")
    || strtolower((string) ($_SERVER["HTTP_X_FORWARDED_PROTO"] ?? "")) === "https";
  $host = (string) ($_SERVER["HTTP_HOST"] ?? "podmei.com");
  return ($https ? "https" : "http") . "://" . $host;
}
function pay_plan_price(string $plan, string $cycle, bool $test = false): float {
  if ($test || $plan === "teste") return 2.0;
  $prices = [
    "pro" => ["month" => 29.9, "year" => 299.0],
    "premium" => ["month" => 49.9, "year" => 499.0],
    "contador" => ["month" => 97.9, "year" => 977.0],
    "contador_premium" => ["month" => 147.9, "year" => 1477.0],
  ];
  if (!isset($prices[$plan])) $plan = "pro";
  return $cycle === "year" ? $prices[$plan]["year"] : $prices[$plan]["month"];
}
function pay_plan_title(string $plan, string $cycle, bool $test = false): string {
  if ($test || $plan === "teste") return "Teste PODMEI R$ 2,00";
  $names = [
    "pro" => "PODMEI Pro",
    "premium" => "PODMEI Premium",
    "contador" => "PODMEI Contador",
    "contador_premium" => "PODMEI Contador Premium",
  ];
  $name = $names[$plan] ?? "PODMEI Pro";
  return $name . " — " . ($cycle === "year" ? "anual" : "mensal");
}
function pay_db(): PDO { return podmei_db(); }
function pay_load_store(): array { return podmei_store_array(); }
function pay_save_store(array $store): void { podmei_save_store_array($store); }
function pay_enviar_email(string $para, string $assunto, string $texto): bool { return podmei_mail($para, $assunto, $texto); }
function pay_email_acesso(string $nome, string $username, string $senha): string {
  $url = pay_site_url() . "/entrar";
  return "Olá, {$nome}.\n\nRecebemos a confirmação do seu pagamento no Mercado Pago.\nSeu acesso ao PODMEI já está liberado.\n\nSite: {$url}\nUsuário: {$username}\nSenha: {$senha}\n\nGuarde estes dados. Depois de entrar, você pode alterar a senha se quiser.\nEsta mensagem é automática (naoresponda@podmei.com). Não responda este e-mail.\n\nPODMEI — O poder de cuidar do seu negócio.\n";
}
function pay_master_id(array $cfg): string { return podmei_master_id($cfg); }
function pay_mp_request(string $method, string $path, $body = null): array {
  $cfg = pay_cfg();
  $token = trim((string) ($cfg["mp_access_token"] ?? ""));
  if ($token === "") return ["ok" => false, "data" => ["message" => "MP nÃ£o configurado"]];
  $url = "https://api.mercadopago.com" . $path;
  $headers = [
    "Authorization: Bearer " . $token,
    "Content-Type: application/json",
    "Accept: application/json",
  ];
  $payload = $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE);
  if (function_exists("curl_init")) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
    curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
    if ($payload !== null && $method !== "GET") curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false) return ["ok" => false, "data" => ["message" => "Falha MP"]];
  } else {
    $opts = ["http" => ["method" => $method, "header" => implode("\r\n", $headers), "timeout" => 25, "ignore_errors" => true]];
    if ($payload !== null && $method !== "GET") $opts["http"]["content"] = $payload;
    $raw = @file_get_contents($url, false, stream_context_create($opts));
    if ($raw === false) return ["ok" => false, "data" => ["message" => "Falha MP"]];
    $code = 0;
    if (isset($http_response_header[0]) && preg_match("/\s(\d{3})\s/", $http_response_header[0], $m)) {
      $code = (int) $m[1];
    }
  }
  $data = json_decode((string) $raw, true);
  if (!is_array($data)) $data = ["raw" => $raw];
  return ["ok" => $code < 400, "data" => $data, "code" => $code];
}

function pay_mp_criar_preferencia(array $signup): array {
  $base = pay_site_url();
  $body = [
    "items" => [[
      "id" => $signup["plan"],
      "title" => pay_plan_title($signup["plan"], $signup["cycle"], floatval($signup["amount"]) <= 2.01),
      "description" => "Assinatura PODMEI — " . $signup["nome"],
      "quantity" => 1,
      "currency_id" => "BRL",
      "unit_price" => round(floatval($signup["amount"]), 2),
    ]],
    "payer" => [
      "name" => $signup["nome"],
      "email" => $signup["email"],
    ],
    "back_urls" => [
      "success" => $base . "/assinar/sucesso",
      "failure" => $base . "/assinar/falha",
      "pending" => $base . "/assinar/pendente",
    ],
    "auto_return" => "approved",
    "external_reference" => $signup["id"],
    "notification_url" => $base . "/api/pagamento.php",
    "statement_descriptor" => "PODMEI",
    "metadata" => [
      "signup_id" => $signup["id"],
      "lead_id" => $signup["id"],
      "plan" => $signup["plan"],
      "cycle" => $signup["cycle"],
    ],
  ];
  $res = pay_mp_request("POST", "/checkout/preferences", $body);
  if (!$res["ok"] && (stripos((string) ($res["data"]["message"] ?? ""), "auto_return") !== false
    || stripos((string) ($res["data"]["message"] ?? ""), "back_url") !== false)) {
    unset($body["auto_return"]);
    $res = pay_mp_request("POST", "/checkout/preferences", $body);
  }
  if (!$res["ok"]) {
    $msg = (string) ($res["data"]["message"] ?? $res["data"]["error"] ?? "Não foi possível abrir o pagamento.");
    pay_json_err($msg, 502);
  }
  $cfg = pay_cfg();
  $sandbox = !empty($cfg["mp_sandbox"]) || strncmp(trim((string) ($cfg["mp_access_token"] ?? "")), "TEST-", 5) === 0;
  $url = $sandbox
    ? (string) ($res["data"]["sandbox_init_point"] ?? $res["data"]["init_point"] ?? "")
    : (string) ($res["data"]["init_point"] ?? $res["data"]["sandbox_init_point"] ?? "");
  if ($url === "") pay_json_err("O Mercado Pago não devolveu o link de pagamento.", 502);
  return ["id" => (string) ($res["data"]["id"] ?? ""), "init_point" => $url, "kind" => "preference"];
}

/**
 * Assinatura recorrente MP (preapproval) — cobra até o cliente cancelar.
 * Sem end_date = vigência aberta.
 */
function pay_mp_criar_preapproval(array $signup): array {
  $base = pay_site_url();
  $cycle = (($signup["cycle"] ?? "") === "year") ? "year" : "month";
  $freq = $cycle === "year" ? 12 : 1;
  $sid = (string) $signup["id"];
  $body = [
    "reason" => pay_plan_title((string) $signup["plan"], $cycle, false),
    "external_reference" => $sid,
    "payer_email" => (string) $signup["email"],
    "auto_recurring" => [
      "frequency" => $freq,
      "frequency_type" => "months",
      "transaction_amount" => round(floatval($signup["amount"]), 2),
      "currency_id" => "BRL",
    ],
    "back_url" => $base . "/assinar/sucesso?sid=" . rawurlencode($sid),
    "status" => "pending",
    "notification_url" => $base . "/api/pagamento.php",
  ];
  $res = pay_mp_request("POST", "/preapproval", $body);
  if (!$res["ok"]) {
    // Alguns tokens/contas não aceitam notification_url no preapproval
    unset($body["notification_url"]);
    $res = pay_mp_request("POST", "/preapproval", $body);
  }
  if (!$res["ok"]) {
    $msg = (string) ($res["data"]["message"] ?? $res["data"]["error"] ?? "Não foi possível criar a assinatura recorrente.");
    if (!empty($res["data"]["cause"][0]["description"])) {
      $msg = (string) $res["data"]["cause"][0]["description"];
    }
    pay_json_err($msg, 502);
  }
  $url = (string) ($res["data"]["init_point"] ?? $res["data"]["sandbox_init_point"] ?? "");
  if ($url === "") pay_json_err("O Mercado Pago não devolveu o link da assinatura.", 502);
  return [
    "id" => (string) ($res["data"]["id"] ?? ""),
    "init_point" => $url,
    "kind" => "preapproval",
  ];
}

function pay_mp_cancelar_preapproval(string $preapprovalId): bool {
  $preapprovalId = trim($preapprovalId);
  if ($preapprovalId === "") return false;
  $res = pay_mp_request("PUT", "/preapproval/" . rawurlencode($preapprovalId), ["status" => "cancelled"]);
  return !empty($res["ok"]);
}

/** Igual EDB iniciar_assinatura: grava signup no SQLite e devolve checkoutUrl. */
function pay_iniciar_assinatura(array $in): array {
  $pdo = pay_db();
  $cfg = pay_cfg();
  $nome = trim((string) ($in["nome"] ?? ""));
  $email = strtolower(trim((string) ($in["email"] ?? "")));
  $telefone = trim((string) ($in["telefone"] ?? ""));
  $cnpj = trim((string) ($in["cnpj"] ?? ""));
  $empresa = trim((string) ($in["empresa"] ?? ""));
  $rawPlan = (string) ($in["plan"] ?? "pro");
  $plan = in_array($rawPlan, ["pro", "premium", "contador", "contador_premium"], true) ? $rawPlan : "pro";
  $cycle = ($in["cycle"] ?? "") === "year" ? "year" : "month";
  $isTest = !empty($in["test"]) || ($in["plan"] ?? "") === "teste" || ($in["action"] ?? "") === "checkout-test";
  if ($nome === "") pay_json_err("Informe o nome completo.");
  if (!pay_email_ok($email)) {
    pay_json_err("Informe um e-mail vÃ¡lido. Enviaremos o login e a senha apÃ³s o pagamento.");
  }
  $amount = pay_plan_price($plan, $cycle, $isTest);
  if ($isTest) $plan = "pro";

  $st = $pdo->prepare("SELECT * FROM signups WHERE email = ? AND status = 'pendente' ORDER BY created_at DESC LIMIT 1");
  $st->execute([$email]);
  $exist = $st->fetch();
  $sid = $exist ? (string) $exist["id"] : pay_uid("ass");
  $now = pay_now();
  if ($exist) {
    $pdo->prepare("UPDATE signups SET nome=?, telefone=?, cnpj=?, empresa=?, plan=?, cycle=?, amount=? WHERE id=?")
      ->execute([$nome, $telefone, $cnpj, $empresa, $plan, $cycle, $amount, $sid]);
  } else {
    $pdo->prepare("INSERT INTO signups (id,nome,email,telefone,cnpj,empresa,plan,cycle,amount,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      ->execute([$sid, $nome, $email, $telefone, $cnpj, $empresa, $plan, $cycle, $amount, "pendente", $now]);
  }

  if (trim((string) ($cfg["mp_access_token"] ?? "")) === "") {
    pay_json_err("O pagamento online ainda estÃ¡ sendo configurado. Seu cadastro foi recebido.", 503);
  }

  $signup = [
    "id" => $sid,
    "nome" => $nome,
    "email" => $email,
    "plan" => $plan,
    "cycle" => $cycle,
    "amount" => $amount,
  ];
  // Teste R$ 2 = pagamento único. Planos reais = recorrência até cancelar.
  if ($isTest) {
    $pref = pay_mp_criar_preferencia($signup);
    $pdo->prepare("UPDATE signups SET mp_preference_id = ?, mp_preapproval_id = '' WHERE id = ?")
      ->execute([$pref["id"], $sid]);
  } else {
    $pref = pay_mp_criar_preapproval($signup);
    $pdo->prepare("UPDATE signups SET mp_preapproval_id = ?, mp_preference_id = ? WHERE id = ?")
      ->execute([$pref["id"], $pref["id"], $sid]);
  }

  return [
    "checkoutUrl" => $pref["init_point"],
    "signupId" => $sid,
    "leadId" => $sid,
    "preco" => $amount,
    "plano" => $plan,
    "email" => $email,
    "nome" => $nome,
    "recurring" => !$isTest,
    "preapprovalId" => $isTest ? null : $pref["id"],
    "lead" => [
      "id" => $sid,
      "nome" => $nome,
      "email" => $email,
      "telefone" => $telefone,
      "plan" => $plan,
      "cycle" => $cycle,
      "amount" => $amount,
      "status" => "aguardando_pagamento",
      "mpInitPoint" => $pref["init_point"],
      "paymentUrl" => $pref["init_point"],
      "checkoutUrl" => $pref["init_point"],
      "mpPreapprovalId" => $isTest ? "" : $pref["id"],
    ],
  ];
}

function pay_status_publico(string $sid): array {
  $pdo = pay_db();
  $st = $pdo->prepare("SELECT * FROM signups WHERE id = ?");
  $st->execute([$sid]);
  $row = $st->fetch();
  if (!$row) pay_json_err("Assinatura nÃ£o encontrada.", 404);
  $pago = (string) $row["status"] === "pago";
  return [
    "status" => $pago ? "pago" : "pendente",
    "signupId" => $row["id"],
    "leadId" => $row["id"],
    "email" => $row["email"],
    "nome" => $row["nome"],
    "username" => $pago ? (string) $row["username"] : null,
    "emailSent" => $pago,
    "lead" => [
      "id" => $row["id"],
      "nome" => $row["nome"],
      "email" => $row["email"],
      "status" => $pago ? "ativo" : "aguardando_pagamento",
      "plan" => $row["plan"],
      "cycle" => $row["cycle"],
      "amount" => floatval($row["amount"]),
      "userId" => $row["user_id"] ?: null,
    ],
  ];
}

/** Cria conta no SQLite + e-mail (mail), marca signup pago. */
function pay_ativar_signup(string $signupId, string $paymentId): array {
  $pdo = pay_db();

  $pdo->beginTransaction();
  try {
    $st = $pdo->prepare("SELECT * FROM signups WHERE id = ?");
    $st->execute([$signupId]);
    $row = $st->fetch();
    if (!$row) {
      $pdo->rollBack();
      pay_json_err("Cadastro de assinatura não encontrado.", 404);
    }

    if ((string) $row["status"] === "pago" && (string) $row["user_id"] !== "") {
      $pdo->commit();
      return [
        "jaPago" => true,
        "status" => "pago",
        "signupId" => $row["id"],
        "leadId" => $row["id"],
        "email" => $row["email"],
        "nome" => $row["nome"],
        "username" => $row["username"],
        "emailSent" => true,
        "tempPassword" => null,
        "lead" => [
          "id" => $row["id"],
          "nome" => $row["nome"],
          "email" => $row["email"],
          "status" => "ativo",
          "userId" => $row["user_id"],
          "plan" => $row["plan"],
          "cycle" => $row["cycle"],
          "amount" => floatval($row["amount"]),
        ],
      ];
    }

    if ((string) $row["status"] === "processando") {
      $pdo->commit();
      return [
        "jaPago" => false,
        "status" => "pendente",
        "signupId" => $row["id"],
        "leadId" => $row["id"],
        "email" => $row["email"],
        "nome" => $row["nome"],
        "emailSent" => false,
      ];
    }

    $claim = $pdo->prepare("UPDATE signups SET status = 'processando', mp_payment_id = ? WHERE id = ? AND status IN ('pendente','processando')");
    $claim->execute([$paymentId, $signupId]);
    if ($claim->rowCount() < 1 && (string) $row["status"] !== "processando") {
      $st->execute([$signupId]);
      $row = $st->fetch();
      $pdo->commit();
      if ($row && (string) $row["status"] === "pago" && (string) ($row["user_id"] ?? "") !== "") {
        return pay_ativar_signup($signupId, $paymentId);
      }
      return [
        "jaPago" => false,
        "status" => "pendente",
        "signupId" => $signupId,
        "leadId" => $signupId,
        "email" => $row["email"] ?? "",
        "nome" => $row["nome"] ?? "",
        "emailSent" => false,
      ];
    }
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }

  $st = $pdo->prepare("SELECT * FROM signups WHERE id = ?");
  $st->execute([$signupId]);
  $row = $st->fetch();
  if (!$row) pay_json_err("Cadastro de assinatura não encontrado.", 404);

  $temp = pay_senha();
  $email = strtolower(trim((string) $row["email"]));
  $username = $email;
  $rawPlan = (string) ($row["plan"] ?? "pro");
  $plan = in_array($rawPlan, ["pro", "premium", "contador", "contador_premium"], true) ? $rawPlan : "pro";
  $role = ($plan === "contador" || $plan === "contador_premium") ? "contador" : "pro";
  $cycle = (($row["cycle"] ?? "") === "year") ? "year" : "month";
  $amount = floatval($row["amount"]);
  $hash = password_hash($temp, PASSWORD_DEFAULT);
  $now = pay_now();
  $started = pay_today();
  $months = $cycle === "year" ? 12 : 1;
  $nextDue = pay_add_months($started, $months);

  $existing = $pdo->prepare("SELECT * FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?) LIMIT 1");
  $existing->execute([$email, $username]);
  $u = $existing->fetch();

  if ($u && ($u["role"] ?? "") === "master") {
    $username = preg_replace("/@.*/", "", $email) . substr($signupId, -4);
    $u = false;
  }

  if ($u) {
    $userId = (string) $u["id"];
    $username = (string) $u["username"];
    $pdo->prepare("UPDATE users SET password_hash=?, status='ativo', must_change_password=0, nome=?, telefone=?, cnpj=?, empresa=?, plan=?, role=? WHERE id=?")
      ->execute([$hash, $row["nome"], $row["telefone"] ?? "", $row["cnpj"] ?? "", $row["empresa"] ?? "", $plan, $role, $userId]);
  } else {
    $userId = pay_uid("usr");
    // evita username duplicado
    $chk = $pdo->prepare("SELECT id FROM users WHERE lower(username) = lower(?)");
    $chk->execute([$username]);
    if ($chk->fetch()) $username = preg_replace("/@.*/", "", $email) . substr($signupId, -4);
    $pdo->prepare("INSERT INTO users (id,username,email,nome,password_hash,role,plan,status,must_change_password,telefone,cnpj,empresa,created_at)
      VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?)")->execute([
      $userId, $username, $email, $row["nome"], $hash, $role, $plan, "ativo",
      $row["telefone"] ?? "", $row["cnpj"] ?? "", $row["empresa"] ?? "", $now,
    ]);
  }

  $subId = pay_uid("sub");
  $preapprovalId = (string) ($row["mp_preapproval_id"] ?? "");
  $pdo->prepare("DELETE FROM subscriptions WHERE user_id = ?")->execute([$userId]);
  $pdo->prepare("INSERT INTO subscriptions (id,user_id,lead_id,nome,email,plan,cycle,amount,status,started_at,next_due,last_paid_at,mp_preapproval_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
    $subId, $userId, $signupId, $row["nome"], $email, $plan, $cycle, $amount, "ativa", $started, $nextDue, $started, $preapprovalId,
  ]);

  $payId = pay_uid("pay");
  $pdo->prepare("INSERT INTO payments (id,lead_id,user_id,nome,email,amount,status,method,mp_payment_id,created_at,confirmed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)")->execute([
    $payId, $signupId, $userId, $row["nome"], $email, $amount, "confirmado", "mercadopago", $paymentId, $now, $now,
  ]);

  $leadChk = $pdo->prepare("SELECT id FROM leads WHERE id = ?");
  $leadChk->execute([$signupId]);
  if ($leadChk->fetch()) {
    $pdo->prepare("UPDATE leads SET status='ativo', paid_at=?, user_id=?, mp_payment_id=?, amount=?, plan=?, cycle=? WHERE id=?")
      ->execute([$now, $userId, $paymentId, $amount, $plan, $cycle, $signupId]);
  } else {
    $pdo->prepare("INSERT INTO leads (id,created_at,nome,email,telefone,cnpj,empresa,plan,cycle,amount,status,mp_payment_id,paid_at,user_id,json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
      $signupId, $row["created_at"] ?? $now, $row["nome"], $email, $row["telefone"] ?? "", $row["cnpj"] ?? "", $row["empresa"] ?? "",
      $plan, $cycle, $amount, "ativo", $paymentId, $now, $userId, "",
    ]);
  }

  $pdo->prepare("UPDATE signups SET status=?, mp_payment_id=?, user_id=?, username=?, pago_em=? WHERE id=?")
    ->execute(["pago", $paymentId, $userId, $username, $now, $signupId]);

  $emailOk = pay_enviar_email(
    $email,
    "Seu acesso PODMEI está pronto",
    pay_email_acesso((string) $row["nome"], $username, $temp)
  );
  podmei_log_email($email, "Seu acesso PODMEI está pronto", $emailOk, $emailOk ? "" : "mail() retornou false");

  return [
    "jaPago" => false,
    "status" => "pago",
    "signupId" => $signupId,
    "leadId" => $signupId,
    "email" => $email,
    "nome" => $row["nome"],
    "username" => $username,
    "emailSent" => $emailOk,
    "tempPassword" => $emailOk ? null : $temp,
    "lead" => [
      "id" => $signupId,
      "nome" => $row["nome"],
      "email" => $email,
      "status" => "ativo",
      "userId" => $userId,
      "plan" => $plan,
      "cycle" => $cycle,
      "amount" => $amount,
    ],
  ];
}

/**
 * Cria/atualiza conta de teste sem Mercado Pago (master ou seed).
 * Senha conhecida — útil para QA do módulo Contador.
 */
function pay_criar_conta_teste(array $in = []): array {
  $pdo = pay_db();
  $rawPlan = (string) ($in["plan"] ?? "pro");
  $plan = in_array($rawPlan, ["pro", "premium", "contador", "contador_premium"], true) ? $rawPlan : "pro";
  $role = ($plan === "contador" || $plan === "contador_premium") ? "contador" : "pro";
  $defaults = [
    "pro" => [
      "email" => "pro.teste@podmei.com",
      "username" => "pro.teste",
      "nome" => "Pro Teste PODMEI",
      "password" => "Contador@Teste26",
      "empresa" => "Escritório Teste",
    ],
    "premium" => [
      "email" => "premium.demo@podmei.com",
      "username" => "premium.demo",
      "nome" => "Premium Demo PODMEI",
      "password" => "Premium@Teste26",
      "empresa" => "MEI Demo Premium",
    ],
    "contador" => [
      "email" => "contador.teste@podmei.com",
      "username" => "contador.teste",
      "nome" => "Contador Teste PODMEI",
      "password" => "Contador@Teste26",
      "empresa" => "Escritório Teste",
    ],
    "contador_premium" => [
      "email" => "contador.premium@podmei.com",
      "username" => "contador.premium",
      "nome" => "Contador Premium Demo",
      "password" => "ContadorPremium@Teste26",
      "empresa" => "Escritório Contábil Demo",
    ],
  ];
  $def = $defaults[$plan];
  $email = strtolower(trim((string) ($in["email"] ?? $def["email"])));
  $username = trim((string) ($in["username"] ?? $def["username"]));
  $nome = trim((string) ($in["nome"] ?? $def["nome"]));
  $password = (string) ($in["password"] ?? $def["password"]);
  if (strlen($password) < 8) pay_json_err("Senha de teste precisa ter pelo menos 8 caracteres.");
  if (!pay_email_ok($email)) pay_json_err("E-mail de teste inválido.");
  if ($username === "") $username = $email;

  $cycle = (($in["cycle"] ?? "") === "year") ? "year" : "month";
  $amount = pay_plan_price($plan, $cycle, false);
  $hash = password_hash($password, PASSWORD_DEFAULT);
  $now = pay_now();
  $started = pay_today();
  $nextDue = pay_add_months($started, $cycle === "year" ? 12 : 1);
  $signupId = pay_uid("ass");
  $empresa = $def["empresa"];

  $existing = $pdo->prepare("SELECT * FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?) LIMIT 1");
  $existing->execute([$email, $username]);
  $u = $existing->fetch();
  if ($u && ($u["role"] ?? "") === "master") {
    pay_json_err("Não é possível sobrescrever a conta master.");
  }

  if ($u) {
    $userId = (string) $u["id"];
    $username = (string) $u["username"];
    $pdo->prepare("UPDATE users SET password_hash=?, status='ativo', must_change_password=0, nome=?, plan=?, role=?, email=?, empresa=? WHERE id=?")
      ->execute([$hash, $nome, $plan, $role, $email, $empresa, $userId]);
  } else {
    $userId = pay_uid("usr");
    $chk = $pdo->prepare("SELECT id FROM users WHERE lower(username) = lower(?)");
    $chk->execute([$username]);
    if ($chk->fetch()) $username = preg_replace("/@.*/", "", $email) . "_teste";
    $pdo->prepare("INSERT INTO users (id,username,email,nome,password_hash,role,plan,status,must_change_password,telefone,cnpj,empresa,created_at)
      VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?)")->execute([
      $userId, $username, $email, $nome, $hash, $role, $plan, "ativo", "", "", $empresa, $now,
    ]);
  }

  $pdo->prepare("DELETE FROM subscriptions WHERE user_id = ?")->execute([$userId]);
  $subId = pay_uid("sub");
  $pdo->prepare("INSERT INTO subscriptions (id,user_id,lead_id,nome,email,plan,cycle,amount,status,started_at,next_due,last_paid_at,mp_preapproval_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
    $subId, $userId, $signupId, $nome, $email, $plan, $cycle, $amount, "ativa", $started, $nextDue, $started, "",
  ]);

  $pdo->prepare("INSERT INTO signups (id,nome,email,telefone,cnpj,empresa,plan,cycle,amount,status,created_at,user_id,username,pago_em,mp_payment_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
    $signupId, $nome, $email, "", "", $empresa, $plan, $cycle, $amount, "pago", $now, $userId, $username, $now, "manual_teste",
  ]);

  return [
    "ok" => true,
    "username" => $username,
    "email" => $email,
    "password" => $password,
    "plan" => $plan,
    "userId" => $userId,
    "loginUrl" => pay_site_url() . "/entrar",
  ];
}

function pay_processar_pagamento_mp(string $paymentId): bool {
  $paymentId = preg_replace("/[^0-9]/", "", $paymentId);
  if ($paymentId === "") return false;
  $res = pay_mp_request("GET", "/v1/payments/" . rawurlencode($paymentId));
  if (!$res["ok"]) return false;
  $pay = $res["data"];
  if ((string) ($pay["status"] ?? "") !== "approved") return false;
  $ref = (string) ($pay["external_reference"] ?? "");
  if ($ref === "") $ref = (string) ($pay["metadata"]["signup_id"] ?? $pay["metadata"]["lead_id"] ?? "");
  // Cobranças de assinatura às vezes trazem o preapproval_id
  $preapprovalId = (string) ($pay["metadata"]["preapproval_id"] ?? $pay["point_of_interaction"]["transaction_data"]["subscription_id"] ?? "");
  if ($ref === "" && $preapprovalId !== "") {
    $pdo = pay_db();
    $st = $pdo->prepare("SELECT id FROM signups WHERE mp_preapproval_id = ? LIMIT 1");
    $st->execute([$preapprovalId]);
    $found = $st->fetch();
    if ($found) $ref = (string) $found["id"];
  }
  if ($ref === "") return false;
  $amount = floatval($pay["transaction_amount"] ?? 0);
  $pdo = pay_db();
  $st = $pdo->prepare("SELECT * FROM signups WHERE id = ?");
  $st->execute([$ref]);
  $row = $st->fetch();
  if (!$row) return false;
  if ($amount + 0.5 < floatval($row["amount"])) return false;
  if ($preapprovalId !== "" && (string) ($row["mp_preapproval_id"] ?? "") === "") {
    $pdo->prepare("UPDATE signups SET mp_preapproval_id = ? WHERE id = ?")->execute([$preapprovalId, $ref]);
  }
  // Já ativo = renovação recorrente (não reenvia senha)
  if ((string) $row["status"] === "pago" && (string) ($row["user_id"] ?? "") !== "") {
    pay_registrar_cobranca_recorrente($row, $paymentId);
    return true;
  }
  pay_ativar_signup($ref, $paymentId);
  return true;
}

/** Renova nextDue e registra pagamento sem resetar a senha. */
function pay_registrar_cobranca_recorrente(array $row, string $paymentId): array {
  $pdo = pay_db();
  $chk = $pdo->prepare("SELECT id FROM payments WHERE mp_payment_id = ? LIMIT 1");
  $chk->execute([$paymentId]);
  if ($chk->fetch()) {
    return [
      "jaPago" => true,
      "status" => "pago",
      "signupId" => $row["id"],
      "leadId" => $row["id"],
      "email" => $row["email"],
      "nome" => $row["nome"],
      "username" => $row["username"] ?? null,
      "emailSent" => true,
      "renewed" => false,
    ];
  }
  $userId = (string) $row["user_id"];
  $cycle = (($row["cycle"] ?? "") === "year") ? "year" : "month";
  $months = $cycle === "year" ? 12 : 1;
  $today = pay_today();
  $nextDue = pay_add_months($today, $months);
  $amount = floatval($row["amount"]);
  $now = pay_now();
  $preapprovalId = (string) ($row["mp_preapproval_id"] ?? "");

  $pdo->prepare("UPDATE users SET status='ativo' WHERE id = ? AND role != 'master'")->execute([$userId]);
  $pdo->prepare("UPDATE subscriptions SET status='ativa', last_paid_at=?, next_due=?, amount=?, mp_preapproval_id=COALESCE(NULLIF(mp_preapproval_id,''), ?) WHERE user_id = ?")
    ->execute([$today, $nextDue, $amount, $preapprovalId, $userId]);

  $payId = pay_uid("pay");
  $pdo->prepare("INSERT INTO payments (id,lead_id,user_id,nome,email,amount,status,method,mp_payment_id,created_at,confirmed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)")->execute([
    $payId, $row["id"], $userId, $row["nome"], $row["email"], $amount, "confirmado", "mercadopago_recorrente", $paymentId, $now, $now,
  ]);

  return [
    "jaPago" => true,
    "status" => "pago",
    "signupId" => $row["id"],
    "leadId" => $row["id"],
    "email" => $row["email"],
    "nome" => $row["nome"],
    "username" => $row["username"] ?? null,
    "emailSent" => true,
    "renewed" => true,
    "nextDue" => $nextDue,
  ];
}

function pay_processar_preapproval(string $preapprovalId): bool {
  $preapprovalId = trim($preapprovalId);
  if ($preapprovalId === "") return false;
  $res = pay_mp_request("GET", "/preapproval/" . rawurlencode($preapprovalId));
  if (!$res["ok"]) return false;
  $data = $res["data"];
  $status = strtolower((string) ($data["status"] ?? ""));
  $ref = (string) ($data["external_reference"] ?? "");
  $pdo = pay_db();

  if ($ref === "") {
    $st = $pdo->prepare("SELECT id FROM signups WHERE mp_preapproval_id = ? LIMIT 1");
    $st->execute([$preapprovalId]);
    $found = $st->fetch();
    if ($found) $ref = (string) $found["id"];
  } else {
    $pdo->prepare("UPDATE signups SET mp_preapproval_id = ? WHERE id = ?")->execute([$preapprovalId, $ref]);
  }

  if ($ref === "") return false;

  if ($status === "cancelled") {
    pay_cancelar_assinatura_local($ref, true);
    return true;
  }

  if ($status === "paused") {
    $st = $pdo->prepare("SELECT user_id FROM signups WHERE id = ?");
    $st->execute([$ref]);
    $row = $st->fetch();
    if ($row && (string) ($row["user_id"] ?? "") !== "") {
      $pdo->prepare("UPDATE subscriptions SET status='atrasada' WHERE user_id = ?")->execute([(string) $row["user_id"]]);
    }
    return true;
  }

  if ($status === "authorized" || $status === "pending") {
    $search = pay_mp_request("GET", "/v1/payments/search?" . http_build_query([
      "sort" => "date_created",
      "criteria" => "desc",
      "external_reference" => $ref,
      "status" => "approved",
    ]));
    if (!empty($search["ok"]) && !empty($search["data"]["results"][0]["id"])) {
      return pay_processar_pagamento_mp((string) $search["data"]["results"][0]["id"]);
    }
  }
  return false;
}

/** Cancela no MP (se houver) e bloqueia acesso local. */
function pay_cancelar_assinatura_usuario(string $userId): array {
  $pdo = pay_db();
  $st = $pdo->prepare("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY started_at DESC LIMIT 1");
  $st->execute([$userId]);
  $sub = $st->fetch();
  if (!$sub) pay_json_err("Assinatura não encontrada.", 404);

  $preId = trim((string) ($sub["mp_preapproval_id"] ?? ""));
  if ($preId === "") {
    // tenta pelo signup
    $s2 = $pdo->prepare("SELECT mp_preapproval_id FROM signups WHERE user_id = ? AND mp_preapproval_id != '' ORDER BY pago_em DESC LIMIT 1");
    $s2->execute([$userId]);
    $sr = $s2->fetch();
    if ($sr) $preId = trim((string) $sr["mp_preapproval_id"]);
  }
  $mpOk = $preId !== "" ? pay_mp_cancelar_preapproval($preId) : true;

  $pdo->prepare("UPDATE subscriptions SET status='cancelada' WHERE user_id = ?")->execute([$userId]);
  $pdo->prepare("UPDATE users SET status='bloqueado' WHERE id = ? AND role != 'master'")->execute([$userId]);

  return [
    "ok" => true,
    "mpCancelled" => $mpOk,
    "subscription" => [
      "id" => $sub["id"],
      "userId" => $userId,
      "status" => "cancelada",
      "plan" => $sub["plan"],
      "cycle" => $sub["cycle"],
      "amount" => floatval($sub["amount"]),
      "nextDue" => $sub["next_due"],
      "mpPreapprovalId" => $preId,
    ],
  ];
}

function pay_cancelar_assinatura_local(string $signupId, bool $fromMp = false): void {
  $pdo = pay_db();
  $st = $pdo->prepare("SELECT user_id, mp_preapproval_id FROM signups WHERE id = ?");
  $st->execute([$signupId]);
  $row = $st->fetch();
  if (!$row) return;
  $userId = (string) ($row["user_id"] ?? "");
  if ($userId === "") return;
  if (!$fromMp) {
    $preId = trim((string) ($row["mp_preapproval_id"] ?? ""));
    if ($preId !== "") pay_mp_cancelar_preapproval($preId);
  }
  $pdo->prepare("UPDATE subscriptions SET status='cancelada' WHERE user_id = ?")->execute([$userId]);
  $pdo->prepare("UPDATE users SET status='bloqueado' WHERE id = ? AND role != 'master'")->execute([$userId]);
}

function pay_minha_assinatura(string $userId): ?array {
  $pdo = pay_db();
  $st = $pdo->prepare("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY started_at DESC LIMIT 1");
  $st->execute([$userId]);
  $s = $st->fetch();
  if (!$s) return null;
  return [
    "id" => $s["id"],
    "userId" => $s["user_id"],
    "leadId" => $s["lead_id"],
    "nome" => $s["nome"],
    "email" => $s["email"],
    "plan" => $s["plan"],
    "cycle" => $s["cycle"],
    "amount" => floatval($s["amount"]),
    "status" => $s["status"],
    "startedAt" => $s["started_at"],
    "nextDue" => $s["next_due"],
    "lastPaidAt" => $s["last_paid_at"] ?: null,
    "mpPreapprovalId" => $s["mp_preapproval_id"] ?? "",
    "recurring" => trim((string) ($s["mp_preapproval_id"] ?? "")) !== "",
  ];
}

function pay_processar_notificacao(string $topic, string $id): void {
  $topic = strtolower(trim($topic));
  $id = trim($id);
  if ($id === "") return;
  if (
    $topic === "subscription_preapproval"
    || $topic === "subscription_preapproval_updated"
    || strpos($topic, "subscription_preapproval") !== false
    || $topic === "preapproval"
  ) {
    pay_processar_preapproval($id);
    return;
  }
  if (
    $topic === "subscription_authorized_payment"
    || strpos($topic, "authorized_payment") !== false
  ) {
    // authorized_payment → busca pagamento vinculado
    $res = pay_mp_request("GET", "/authorized_payments/" . rawurlencode($id));
    if ($res["ok"]) {
      $payId = (string) ($res["data"]["payment"]["id"] ?? $res["data"]["payment_id"] ?? "");
      $preId = (string) ($res["data"]["preapproval_id"] ?? "");
      if ($payId !== "") {
        pay_processar_pagamento_mp($payId);
        return;
      }
      if ($preId !== "") {
        pay_processar_preapproval($preId);
        return;
      }
    }
    return;
  }
  if ($topic === "payment" || $topic === "payment.updated" || $topic === "payment.created" || $topic === "") {
    pay_processar_pagamento_mp($id);
    return;
  }
  if (strpos($topic, "merchant_order") !== false) {
    $res = pay_mp_request("GET", "/merchant_orders/" . rawurlencode($id));
    if (!$res["ok"]) return;
    foreach (($res["data"]["payments"] ?? []) as $p) {
      if (!is_array($p)) continue;
      if ((string) ($p["status"] ?? "") === "approved" && !empty($p["id"])) {
        pay_processar_pagamento_mp((string) $p["id"]);
      }
    }
  }
}

function pay_list_signups(): array {
  $pdo = pay_db();
  return $pdo->query("SELECT * FROM signups ORDER BY created_at DESC")->fetchAll();
}

function pay_signup_to_lead(array $row): array {
  $pago = (string) ($row["status"] ?? "") === "pago";
  return [
    "id" => $row["id"],
    "createdAt" => $row["created_at"] ?? "",
    "nome" => $row["nome"],
    "email" => $row["email"],
    "telefone" => $row["telefone"] ?? "",
    "cnpj" => $row["cnpj"] ?? "",
    "empresa" => $row["empresa"] ?? "",
    "plan" => $row["plan"] ?? "pro",
    "cycle" => $row["cycle"] ?? "month",
    "amount" => floatval($row["amount"] ?? 0),
    "status" => $pago ? "ativo" : "aguardando_pagamento",
    "userId" => $row["user_id"] ?: null,
    "mpPaymentId" => $row["mp_payment_id"] ?? "",
    "paidAt" => $row["pago_em"] ?? null,
  ];
}

/** Ativa assinatura após compra StoreKit (IAP) no app iOS. */
function pay_product_to_plan(string $productId): array {
  $map = [
    "br.com.podmei.app.pro.month" => ["plan" => "pro", "cycle" => "month"],
    "br.com.podmei.app.pro.year" => ["plan" => "pro", "cycle" => "year"],
    "br.com.podmei.app.premium.month" => ["plan" => "premium", "cycle" => "month"],
    "br.com.podmei.app.premium.year" => ["plan" => "premium", "cycle" => "year"],
    "br.com.podmei.app.contador.month" => ["plan" => "contador", "cycle" => "month"],
    "br.com.podmei.app.contador.year" => ["plan" => "contador", "cycle" => "year"],
    "br.com.podmei.app.contadorpremium.month" => ["plan" => "contador_premium", "cycle" => "month"],
    "br.com.podmei.app.contadorpremium.year" => ["plan" => "contador_premium", "cycle" => "year"],
  ];
  if (!isset($map[$productId])) {
    pay_json_err("Produto Apple inválido: " . $productId);
  }
  return $map[$productId];
}

function pay_checkout_apple(array $in): array {
  $nome = trim((string) ($in["nome"] ?? ""));
  $email = strtolower(trim((string) ($in["email"] ?? "")));
  $telefone = trim((string) ($in["telefone"] ?? ""));
  $cnpj = trim((string) ($in["cnpj"] ?? ""));
  $empresa = trim((string) ($in["empresa"] ?? ""));
  $productId = trim((string) ($in["productId"] ?? ""));
  $transactionId = trim((string) ($in["transactionId"] ?? ""));
  if ($nome === "") pay_json_err("Informe o nome completo.");
  if (!pay_email_ok($email)) pay_json_err("Informe um e-mail válido.");
  if ($productId === "" || $transactionId === "") pay_json_err("Compra Apple incompleta.");

  $mapped = pay_product_to_plan($productId);
  $plan = $mapped["plan"];
  $cycle = $mapped["cycle"];
  $amount = pay_plan_price($plan, $cycle, false);
  $paymentId = "apple_" . preg_replace("/[^a-zA-Z0-9_-]/", "", $transactionId);

  $pdo = pay_db();
  $dup = $pdo->prepare("SELECT id, status, user_id, username, email, nome FROM signups WHERE mp_payment_id = ? LIMIT 1");
  $dup->execute([$paymentId]);
  $already = $dup->fetch();
  if ($already && (string) ($already["status"] ?? "") === "pago" && (string) ($already["user_id"] ?? "") !== "") {
    return pay_ativar_signup((string) $already["id"], $paymentId);
  }

  $st = $pdo->prepare("SELECT * FROM signups WHERE email = ? AND status = 'pendente' ORDER BY created_at DESC LIMIT 1");
  $st->execute([$email]);
  $exist = $st->fetch();
  $sid = $exist ? (string) $exist["id"] : pay_uid("ass");
  $now = pay_now();
  if ($exist) {
    $pdo->prepare("UPDATE signups SET nome=?, telefone=?, cnpj=?, empresa=?, plan=?, cycle=?, amount=? WHERE id=?")
      ->execute([$nome, $telefone, $cnpj, $empresa, $plan, $cycle, $amount, $sid]);
  } else {
    $pdo->prepare("INSERT INTO signups (id,nome,email,telefone,cnpj,empresa,plan,cycle,amount,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      ->execute([$sid, $nome, $email, $telefone, $cnpj, $empresa, $plan, $cycle, $amount, "pendente", $now]);
  }

  return pay_ativar_signup($sid, $paymentId);
}

