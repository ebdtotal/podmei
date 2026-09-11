<?php
/**
 * Banco online PODMEI (SQLite em api/data/podmei.sqlite).
 * Fonte única de verdade — evita perda de clientes do store.json.
 */
declare(strict_types=1);

function podmei_cfg(): array {
  static $cfg = null;
  if ($cfg !== null) return $cfg;
  $cfg = require __DIR__ . "/config.php";
  $mailFile = __DIR__ . "/mail-config.php";
  if (is_file($mailFile)) {
    $mail = require $mailFile;
    if (is_array($mail)) $cfg = array_merge($cfg, $mail);
  }
  return $cfg;
}

function podmei_master_id(array $cfg): string {
  return "usr_master_" . substr(hash_hmac("sha256", (string) $cfg["master_username"], (string) $cfg["secret"]), 0, 16);
}

function podmei_db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  $dataDir = __DIR__ . "/data";
  if (!is_dir($dataDir)) @mkdir($dataDir, 0750, true);
  $file = $dataDir . "/podmei.sqlite";
  $pdo = new PDO("sqlite:" . $file, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  $pdo->exec("PRAGMA journal_mode=WAL");
  $pdo->exec("PRAGMA busy_timeout=8000");
  $pdo->exec("PRAGMA foreign_keys=ON");
  podmei_migrate($pdo);
  podmei_import_legacy($pdo);
  podmei_ensure_master($pdo);
  return $pdo;
}

function podmei_migrate(PDO $pdo): void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    nome TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'pro',
    plan TEXT DEFAULT 'pro',
    status TEXT DEFAULT 'ativo',
    must_change_password INTEGER DEFAULT 0,
    telefone TEXT DEFAULT '',
    cnpj TEXT DEFAULT '',
    empresa TEXT DEFAULT '',
    created_at TEXT NOT NULL
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT DEFAULT '',
    cnpj TEXT DEFAULT '',
    empresa TEXT DEFAULT '',
    plan TEXT DEFAULT 'pro',
    cycle TEXT DEFAULT 'month',
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'aguardando_pagamento',
    payment_url TEXT DEFAULT '',
    mp_preference_id TEXT DEFAULT '',
    mp_init_point TEXT DEFAULT '',
    mp_payment_id TEXT DEFAULT '',
    paid_at TEXT DEFAULT '',
    user_id TEXT DEFAULT '',
    json TEXT DEFAULT ''
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    lead_id TEXT DEFAULT '',
    nome TEXT DEFAULT '',
    email TEXT DEFAULT '',
    plan TEXT DEFAULT 'pro',
    cycle TEXT DEFAULT 'month',
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'ativa',
    started_at TEXT DEFAULT '',
    next_due TEXT DEFAULT '',
    last_paid_at TEXT DEFAULT ''
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    lead_id TEXT DEFAULT '',
    user_id TEXT DEFAULT '',
    nome TEXT DEFAULT '',
    email TEXT DEFAULT '',
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    method TEXT DEFAULT 'mercadopago',
    mp_payment_id TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    confirmed_at TEXT DEFAULT ''
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    destin TEXT NOT NULL,
    subject TEXT DEFAULT '',
    at TEXT NOT NULL,
    ok INTEGER DEFAULT 0,
    error TEXT DEFAULT ''
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS workspaces (
    user_id TEXT PRIMARY KEY,
    nome TEXT DEFAULT '',
    email TEXT DEFAULT '',
    plan TEXT DEFAULT 'pro',
    updated_at TEXT NOT NULL,
    workspace_json TEXT NOT NULL
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS signups (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT DEFAULT '',
    cnpj TEXT DEFAULT '',
    empresa TEXT DEFAULT '',
    plan TEXT DEFAULT 'pro',
    cycle TEXT DEFAULT 'month',
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    mp_preference_id TEXT DEFAULT '',
    mp_payment_id TEXT DEFAULT '',
    user_id TEXT DEFAULT '',
    username TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    pago_em TEXT DEFAULT ''
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS meta (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS alert_mails (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    alert_key TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    UNIQUE(user_id, alert_key)
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS accountant_invites (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    owner_user_id TEXT NOT NULL,
    owner_email TEXT DEFAULT '',
    owner_nome TEXT DEFAULT '',
    company_nome TEXT DEFAULT '',
    cnpj TEXT DEFAULT '',
    accountant_email TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    accountant_user_id TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    accepted_at TEXT DEFAULT ''
  )");

  podmei_ensure_column($pdo, "signups", "mp_preapproval_id", "TEXT DEFAULT ''");
  podmei_ensure_column($pdo, "subscriptions", "mp_preapproval_id", "TEXT DEFAULT ''");
}

function podmei_ensure_column(PDO $pdo, string $table, string $column, string $definition): void {
  $st = $pdo->query("PRAGMA table_info(" . $table . ")");
  foreach ($st->fetchAll() as $row) {
    if (($row["name"] ?? "") === $column) return;
  }
  $pdo->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
}

function podmei_meta_get(PDO $pdo, string $k): string {
  $st = $pdo->prepare("SELECT v FROM meta WHERE k = ?");
  $st->execute([$k]);
  $row = $st->fetch();
  return $row ? (string) $row["v"] : "";
}

function podmei_meta_set(PDO $pdo, string $k, string $v): void {
  $pdo->prepare("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)")->execute([$k, $v]);
}

function podmei_ensure_master(PDO $pdo): void {
  $cfg = podmei_cfg();
  $mid = podmei_master_id($cfg);
  $st = $pdo->prepare("SELECT id FROM users WHERE role = 'master' LIMIT 1");
  $st->execute();
  $row = $st->fetch();
  if ($row) {
    if ((string) $row["id"] !== $mid) {
      $pdo->prepare("UPDATE users SET id = ? WHERE id = ?")->execute([$mid, $row["id"]]);
    }
    return;
  }
  $pdo->prepare("INSERT INTO users (id,username,email,nome,password_hash,role,plan,status,must_change_password,created_at)
    VALUES (?,?,?,?,?,?,?,?,0,?)")->execute([
    $mid,
    $cfg["master_username"],
    $cfg["master_email"],
    $cfg["master_name"],
    password_hash($cfg["master_password"], PASSWORD_DEFAULT),
    "master",
    "master",
    "ativo",
    gmdate("Y-m-d\\TH:i:s\\Z"),
  ]);
}

function podmei_import_legacy(PDO $pdo): void {
  if (podmei_meta_get($pdo, "imported_store") === "1") return;
  $storeFile = __DIR__ . "/data/store.json";
  if (is_file($storeFile)) {
    $store = json_decode((string) @file_get_contents($storeFile), true);
    if (is_array($store)) {
      foreach (($store["users"] ?? []) as $u) {
        if (!is_array($u) || empty($u["id"])) continue;
        try {
          $pdo->prepare("INSERT OR IGNORE INTO users (id,username,email,nome,password_hash,role,plan,status,must_change_password,telefone,cnpj,empresa,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
            $u["id"],
            $u["username"] ?? $u["email"],
            strtolower((string) ($u["email"] ?? "")),
            $u["nome"] ?? "",
            $u["passwordHash"] ?? password_hash(bin2hex(random_bytes(4)), PASSWORD_DEFAULT),
            $u["role"] ?? "pro",
            $u["plan"] ?? ($u["role"] ?? "pro"),
            $u["status"] ?? "ativo",
            !empty($u["mustChangePassword"]) ? 1 : 0,
            $u["telefone"] ?? "",
            $u["cnpj"] ?? "",
            $u["empresa"] ?? "",
            $u["createdAt"] ?? gmdate("Y-m-d\\TH:i:s\\Z"),
          ]);
        } catch (Throwable $e) { /* ignore */ }
      }
      foreach (($store["leads"] ?? []) as $L) {
        if (!is_array($L) || empty($L["id"])) continue;
        try {
          $pdo->prepare("INSERT OR IGNORE INTO leads (id,created_at,nome,email,telefone,cnpj,empresa,plan,cycle,amount,status,payment_url,mp_preference_id,mp_init_point,mp_payment_id,paid_at,user_id,json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
            $L["id"],
            $L["createdAt"] ?? gmdate("Y-m-d\\TH:i:s\\Z"),
            $L["nome"] ?? "",
            strtolower((string) ($L["email"] ?? "")),
            $L["telefone"] ?? "",
            $L["cnpj"] ?? "",
            $L["empresa"] ?? "",
            $L["plan"] ?? "pro",
            $L["cycle"] ?? "month",
            floatval($L["amount"] ?? 0),
            $L["status"] ?? "aguardando_pagamento",
            $L["paymentUrl"] ?? "",
            $L["mpPreferenceId"] ?? "",
            $L["mpInitPoint"] ?? "",
            $L["mpPaymentId"] ?? "",
            $L["paidAt"] ?? "",
            $L["userId"] ?? "",
            json_encode($L, JSON_UNESCAPED_UNICODE),
          ]);
        } catch (Throwable $e) { /* ignore */ }
      }
      foreach (($store["subscriptions"] ?? []) as $s) {
        if (!is_array($s) || empty($s["id"])) continue;
        try {
          $pdo->prepare("INSERT OR IGNORE INTO subscriptions (id,user_id,lead_id,nome,email,plan,cycle,amount,status,started_at,next_due,last_paid_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
            $s["id"],
            $s["userId"] ?? "",
            $s["leadId"] ?? "",
            $s["nome"] ?? "",
            $s["email"] ?? "",
            $s["plan"] ?? "pro",
            $s["cycle"] ?? "month",
            floatval($s["amount"] ?? 0),
            $s["status"] ?? "ativa",
            $s["startedAt"] ?? "",
            $s["nextDue"] ?? "",
            $s["lastPaidAt"] ?? "",
          ]);
        } catch (Throwable $e) { /* ignore */ }
      }
      foreach (($store["payments"] ?? []) as $p) {
        if (!is_array($p) || empty($p["id"])) continue;
        try {
          $pdo->prepare("INSERT OR IGNORE INTO payments (id,lead_id,user_id,nome,email,amount,status,method,mp_payment_id,created_at,confirmed_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)")->execute([
            $p["id"],
            $p["leadId"] ?? "",
            $p["userId"] ?? "",
            $p["nome"] ?? "",
            $p["email"] ?? "",
            floatval($p["amount"] ?? 0),
            $p["status"] ?? "pendente",
            $p["method"] ?? "mercadopago",
            $p["mpPaymentId"] ?? "",
            $p["createdAt"] ?? gmdate("Y-m-d\\TH:i:s\\Z"),
            $p["confirmedAt"] ?? "",
          ]);
        } catch (Throwable $e) { /* ignore */ }
      }
      foreach (($store["emails"] ?? []) as $m) {
        if (!is_array($m) || empty($m["id"])) continue;
        try {
          $pdo->prepare("INSERT OR IGNORE INTO emails (id,destin,subject,at,ok,error) VALUES (?,?,?,?,?,?)")->execute([
            $m["id"],
            $m["to"] ?? "",
            $m["subject"] ?? "",
            $m["at"] ?? gmdate("Y-m-d\\TH:i:s\\Z"),
            !empty($m["ok"]) ? 1 : 0,
            $m["error"] ?? "",
          ]);
        } catch (Throwable $e) { /* ignore */ }
      }
      foreach (($store["workspaces"] ?? []) as $w) {
        if (!is_array($w) || empty($w["userId"])) continue;
        try {
          $pdo->prepare("INSERT OR IGNORE INTO workspaces (user_id,nome,email,plan,updated_at,workspace_json) VALUES (?,?,?,?,?,?)")->execute([
            $w["userId"],
            $w["nome"] ?? "",
            $w["email"] ?? "",
            $w["plan"] ?? "pro",
            $w["updatedAt"] ?? gmdate("Y-m-d\\TH:i:s\\Z"),
            json_encode($w["workspace"] ?? new stdClass(), JSON_UNESCAPED_UNICODE),
          ]);
        } catch (Throwable $e) { /* ignore */ }
      }
    }
  }

  $oldPay = __DIR__ . "/data/podmei-pay.sqlite";
  if (is_file($oldPay)) {
    try {
      $old = new PDO("sqlite:" . $oldPay, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
      foreach ($old->query("SELECT * FROM signups") as $row) {
        $pdo->prepare("INSERT OR IGNORE INTO signups (id,nome,email,telefone,cnpj,empresa,plan,cycle,amount,status,mp_preference_id,mp_payment_id,user_id,username,created_at,pago_em)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
          $row["id"], $row["nome"], $row["email"], $row["telefone"] ?? "", $row["cnpj"] ?? "", $row["empresa"] ?? "",
          $row["plan"] ?? "pro", $row["cycle"] ?? "month", floatval($row["amount"] ?? 0), $row["status"] ?? "pendente",
          $row["mp_preference_id"] ?? "", $row["mp_payment_id"] ?? "", $row["user_id"] ?? "", $row["username"] ?? "",
          $row["created_at"] ?? gmdate("Y-m-d\\TH:i:s\\Z"), $row["pago_em"] ?? "",
        ]);
      }
    } catch (Throwable $e) { /* ignore */ }
  }

  podmei_meta_set($pdo, "imported_store", "1");
}

/** Converte DB → estrutura store usada pelo index.php */
function podmei_store_array(PDO $pdo = null): array {
  $pdo = $pdo ?: podmei_db();
  $users = [];
  foreach ($pdo->query("SELECT * FROM users ORDER BY created_at ASC") as $u) {
    $users[] = [
      "id" => $u["id"],
      "username" => $u["username"],
      "email" => $u["email"],
      "nome" => $u["nome"],
      "passwordHash" => $u["password_hash"],
      "role" => $u["role"],
      "plan" => $u["plan"],
      "status" => $u["status"],
      "mustChangePassword" => !empty($u["must_change_password"]),
      "telefone" => $u["telefone"],
      "cnpj" => $u["cnpj"],
      "empresa" => $u["empresa"],
      "createdAt" => $u["created_at"],
    ];
  }
  $leads = [];
  foreach ($pdo->query("SELECT * FROM leads ORDER BY created_at ASC") as $L) {
    $extra = [];
    if (!empty($L["json"])) {
      $decoded = json_decode((string) $L["json"], true);
      if (is_array($decoded)) $extra = $decoded;
    }
    $leads[] = array_merge($extra, [
      "id" => $L["id"],
      "createdAt" => $L["created_at"],
      "nome" => $L["nome"],
      "email" => $L["email"],
      "telefone" => $L["telefone"],
      "cnpj" => $L["cnpj"],
      "empresa" => $L["empresa"],
      "plan" => $L["plan"],
      "cycle" => $L["cycle"],
      "amount" => floatval($L["amount"]),
      "status" => $L["status"],
      "paymentUrl" => $L["payment_url"] ?: ($L["mp_init_point"] ?? ""),
      "mpPreferenceId" => $L["mp_preference_id"],
      "mpInitPoint" => $L["mp_init_point"],
      "mpPaymentId" => $L["mp_payment_id"],
      "paidAt" => $L["paid_at"] ?: null,
      "userId" => $L["user_id"] ?: null,
    ]);
  }
  $subscriptions = [];
  foreach ($pdo->query("SELECT * FROM subscriptions ORDER BY started_at ASC") as $s) {
    $subscriptions[] = [
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
    ];
  }
  $payments = [];
  foreach ($pdo->query("SELECT * FROM payments ORDER BY created_at ASC") as $p) {
    $payments[] = [
      "id" => $p["id"],
      "leadId" => $p["lead_id"],
      "userId" => $p["user_id"] ?: null,
      "nome" => $p["nome"],
      "email" => $p["email"],
      "amount" => floatval($p["amount"]),
      "status" => $p["status"],
      "method" => $p["method"],
      "mpPaymentId" => $p["mp_payment_id"],
      "createdAt" => $p["created_at"],
      "confirmedAt" => $p["confirmed_at"] ?: null,
    ];
  }
  $emails = [];
  foreach ($pdo->query("SELECT * FROM emails ORDER BY at ASC") as $m) {
    $emails[] = [
      "id" => $m["id"],
      "to" => $m["destin"],
      "subject" => $m["subject"],
      "at" => $m["at"],
      "ok" => !empty($m["ok"]),
      "error" => $m["error"],
    ];
  }
  $workspaces = [];
  foreach ($pdo->query("SELECT * FROM workspaces") as $w) {
    $ws = json_decode((string) $w["workspace_json"], true);
    $workspaces[] = [
      "userId" => $w["user_id"],
      "nome" => $w["nome"],
      "email" => $w["email"],
      "plan" => $w["plan"],
      "updatedAt" => $w["updated_at"],
      "workspace" => is_array($ws) ? $ws : null,
    ];
  }
  return compact("users", "leads", "subscriptions", "payments", "emails", "workspaces");
}

function podmei_save_store_array(array $store): void {
  $pdo = podmei_db();
  podmei_ensure_column($pdo, "subscriptions", "mp_preapproval_id", "TEXT DEFAULT ''");
  podmei_ensure_column($pdo, "signups", "mp_preapproval_id", "TEXT DEFAULT ''");
  $pdo->beginTransaction();
  try {
    $pdo->exec("DELETE FROM users");
    $pdo->exec("DELETE FROM leads");
    $pdo->exec("DELETE FROM subscriptions");
    $pdo->exec("DELETE FROM payments");
    $pdo->exec("DELETE FROM emails");
    $pdo->exec("DELETE FROM workspaces");
    foreach ($store["users"] ?? [] as $u) {
      $pdo->prepare("INSERT INTO users (id,username,email,nome,password_hash,role,plan,status,must_change_password,telefone,cnpj,empresa,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
        $u["id"], $u["username"], strtolower((string) $u["email"]), $u["nome"] ?? "",
        $u["passwordHash"], $u["role"], $u["plan"] ?? $u["role"], $u["status"] ?? "ativo",
        !empty($u["mustChangePassword"]) ? 1 : 0, $u["telefone"] ?? "", $u["cnpj"] ?? "", $u["empresa"] ?? "",
        $u["createdAt"] ?? gmdate("Y-m-d\\TH:i:s\\Z"),
      ]);
    }
    foreach ($store["leads"] ?? [] as $L) {
      $pdo->prepare("INSERT INTO leads (id,created_at,nome,email,telefone,cnpj,empresa,plan,cycle,amount,status,payment_url,mp_preference_id,mp_init_point,mp_payment_id,paid_at,user_id,json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
        $L["id"], $L["createdAt"] ?? gmdate("Y-m-d\\TH:i:s\\Z"), $L["nome"], strtolower((string) $L["email"]),
        $L["telefone"] ?? "", $L["cnpj"] ?? "", $L["empresa"] ?? "", $L["plan"] ?? "pro", $L["cycle"] ?? "month",
        floatval($L["amount"] ?? 0), $L["status"] ?? "aguardando_pagamento", $L["paymentUrl"] ?? "",
        $L["mpPreferenceId"] ?? "", $L["mpInitPoint"] ?? "", $L["mpPaymentId"] ?? "", $L["paidAt"] ?? "",
        $L["userId"] ?? "", json_encode($L, JSON_UNESCAPED_UNICODE),
      ]);
    }
    foreach ($store["subscriptions"] ?? [] as $s) {
      $pdo->prepare("INSERT INTO subscriptions (id,user_id,lead_id,nome,email,plan,cycle,amount,status,started_at,next_due,last_paid_at,mp_preapproval_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
        $s["id"], $s["userId"], $s["leadId"] ?? "", $s["nome"] ?? "", $s["email"] ?? "",
        $s["plan"], $s["cycle"], floatval($s["amount"]), $s["status"], $s["startedAt"] ?? "",
        $s["nextDue"] ?? "", $s["lastPaidAt"] ?? "", $s["mpPreapprovalId"] ?? "",
      ]);
    }
    foreach ($store["payments"] ?? [] as $p) {
      $pdo->prepare("INSERT INTO payments (id,lead_id,user_id,nome,email,amount,status,method,mp_payment_id,created_at,confirmed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)")->execute([
        $p["id"], $p["leadId"] ?? "", $p["userId"] ?? "", $p["nome"] ?? "", $p["email"] ?? "",
        floatval($p["amount"]), $p["status"], $p["method"] ?? "mercadopago", $p["mpPaymentId"] ?? "",
        $p["createdAt"] ?? gmdate("Y-m-d\\TH:i:s\\Z"), $p["confirmedAt"] ?? "",
      ]);
    }
    foreach ($store["emails"] ?? [] as $m) {
      $pdo->prepare("INSERT INTO emails (id,destin,subject,at,ok,error) VALUES (?,?,?,?,?,?)")->execute([
        $m["id"], $m["to"], $m["subject"] ?? "", $m["at"] ?? gmdate("Y-m-d\\TH:i:s\\Z"),
        !empty($m["ok"]) ? 1 : 0, $m["error"] ?? "",
      ]);
    }
    foreach ($store["workspaces"] ?? [] as $w) {
      $pdo->prepare("INSERT INTO workspaces (user_id,nome,email,plan,updated_at,workspace_json) VALUES (?,?,?,?,?,?)")->execute([
        $w["userId"], $w["nome"] ?? "", $w["email"] ?? "", $w["plan"] ?? "pro",
        $w["updatedAt"] ?? gmdate("Y-m-d\\TH:i:s\\Z"),
        json_encode($w["workspace"] ?? new stdClass(), JSON_UNESCAPED_UNICODE),
      ]);
    }
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
}

function podmei_uid(string $prefix): string {
  return $prefix . "_" . bin2hex(random_bytes(6));
}

function podmei_mail(string $para, string $assunto, string $texto): bool {
  if (!filter_var($para, FILTER_VALIDATE_EMAIL)) return false;
  $cfg = podmei_cfg();
  $from = trim((string) ($cfg["from_email"] ?? "naoresponda@podmei.com"));
  if ($from === "") $from = "naoresponda@podmei.com";
  $fromName = trim((string) ($cfg["from_name"] ?? "PODMEI"));
  $encoded = "=?UTF-8?B?" . base64_encode($assunto) . "?=";
  $headers = "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nFrom: {$fromName} <{$from}>\r\nReply-To: {$from}\r\nX-Mailer: PODMEI\r\n";
  return @mail($para, $encoded, $texto, $headers, "-f" . $from);
}

function podmei_log_email(string $to, string $subject, bool $ok, string $error = ""): void {
  $pdo = podmei_db();
  $pdo->prepare("INSERT INTO emails (id,destin,subject,at,ok,error) VALUES (?,?,?,?,?,?)")->execute([
    podmei_uid("mail"), $to, $subject, gmdate("Y-m-d\\TH:i:s\\Z"), $ok ? 1 : 0, $error,
  ]);
}

/** Grava a área do cliente (empresa, logo, lançamentos…) sem reescrever o banco inteiro.
 * Last-write-wins por updatedAt do cliente: rejeita snapshot mais antigo que o já gravado.
 * @return array{updatedAt: string, accepted: bool}
 */
function podmei_upsert_workspace(
  string $userId,
  string $nome,
  string $email,
  string $plan,
  $workspace,
  ?string $updatedAt = null
): array {
  $clientAt = null;
  if (is_array($workspace) && !empty($workspace["updatedAt"]) && is_string($workspace["updatedAt"])) {
    $clientAt = $workspace["updatedAt"];
  }
  $at = $updatedAt ?: ($clientAt ?: gmdate("Y-m-d\\TH:i:s\\Z"));
  $json = json_encode($workspace ?? new stdClass(), JSON_UNESCAPED_UNICODE);
  if ($json === false) {
    throw new RuntimeException("Workspace inválido para JSON.");
  }
  $pdo = podmei_db();

  $st = $pdo->prepare("SELECT updated_at, workspace_json FROM workspaces WHERE user_id = ? LIMIT 1");
  $st->execute([$userId]);
  $existing = $st->fetch();
  if ($existing) {
    $existingAt = (string) ($existing["updated_at"] ?? "");
    $incomingTs = strtotime($at) ?: 0;
    $existingTs = strtotime($existingAt) ?: 0;
    // Se o servidor já tem versão mais nova, mantém a atual (evita celular lento sobrescrever web).
    if ($existingTs > 0 && $incomingTs > 0 && $incomingTs < $existingTs) {
      return ["updatedAt" => $existingAt, "accepted" => false];
    }
  }

  $pdo->prepare(
    "INSERT INTO workspaces (user_id,nome,email,plan,updated_at,workspace_json) VALUES (?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET
       nome = excluded.nome,
       email = excluded.email,
       plan = excluded.plan,
       updated_at = excluded.updated_at,
       workspace_json = excluded.workspace_json"
  )->execute([$userId, $nome, $email, $plan, $at, $json]);
  return ["updatedAt" => $at, "accepted" => true];
}

/** Lê o snapshot da área do cliente no SQLite. */
function podmei_get_workspace(string $userId): ?array {
  $pdo = podmei_db();
  $st = $pdo->prepare("SELECT * FROM workspaces WHERE user_id = ? LIMIT 1");
  $st->execute([$userId]);
  $w = $st->fetch();
  if (!$w) return null;
  $ws = json_decode((string) $w["workspace_json"], true);
  return [
    "userId" => $w["user_id"],
    "nome" => $w["nome"],
    "email" => $w["email"],
    "plan" => $w["plan"],
    "updatedAt" => $w["updated_at"],
    "workspace" => is_array($ws) ? $ws : null,
  ];
}
