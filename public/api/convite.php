<?php
/**
 * Convite do MEI para o escritório (plano Contador).
 * POST invite | accept | list | snapshot
 */
declare(strict_types=1);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) === "OPTIONS") {
  http_response_code(204);
  exit;
}

require __DIR__ . "/db.php";

function cv_json(int $code, array $payload): void {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function cv_body(): array {
  static $cached = null;
  if ($cached !== null) return $cached;
  $raw = file_get_contents("php://input");
  $cached = json_decode($raw ?: "{}", true);
  return is_array($cached) ? $cached : [];
}

function cv_user(): ?array {
  $hdr = $_SERVER["HTTP_AUTHORIZATION"] ?? "";
  $token = "";
  if (preg_match("/Bearer\\s+(.+)/i", $hdr, $m)) $token = trim($m[1]);
  if ($token === "") $token = (string) (cv_body()["token"] ?? $_GET["token_auth"] ?? "");
  if ($token === "") return null;
  $cfg = podmei_cfg();
  $raw = base64_decode(strtr($token, "-_", "+/"));
  if (!$raw) return null;
  $parts = explode(".", $raw);
  if (count($parts) !== 3) return null;
  [$userId, $exp, $sig] = $parts;
  $expect = hash_hmac("sha256", $userId . "." . $exp, (string) $cfg["secret"]);
  if (!hash_equals($expect, $sig)) return null;
  if (intval($exp) < time()) return null;
  $pdo = podmei_db();
  $st = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
  $st->execute([$userId]);
  $u = $st->fetch();
  if (!$u || ($u["status"] ?? "ativo") !== "ativo") return null;
  return $u;
}

function cv_public(array $row): array {
  return [
    "id" => $row["id"],
    "token" => $row["token"],
    "ownerEmail" => $row["owner_email"] ?? "",
    "ownerNome" => $row["owner_nome"] ?? "",
    "companyNome" => $row["company_nome"] ?? "",
    "cnpj" => $row["cnpj"] ?? "",
    "accountantEmail" => $row["accountant_email"] ?? "",
    "status" => $row["status"] ?? "pendente",
    "createdAt" => $row["created_at"] ?? "",
    "acceptedAt" => $row["accepted_at"] ?? "",
  ];
}

function cv_active_client(array $ws): ?array {
  $clients = $ws["clients"] ?? [];
  if (!is_array($clients) || !$clients) return null;
  $active = (string) ($ws["activeClientId"] ?? "");
  foreach ($clients as $c) {
    if (is_array($c) && (string) ($c["id"] ?? "") === $active) return $c;
  }
  return is_array($clients[0]) ? $clients[0] : null;
}

function cv_owner_client(string $ownerId, string $cnpj): ?array {
  $row = podmei_get_workspace($ownerId);
  $ws = is_array($row["workspace"] ?? null) ? $row["workspace"] : null;
  if (!$ws) return null;
  $clients = $ws["clients"] ?? [];
  $digits = preg_replace("/\\D/", "", $cnpj);
  if ($digits !== "" && is_array($clients)) {
    foreach ($clients as $c) {
      if (!is_array($c)) continue;
      $cd = preg_replace("/\\D/", "", (string) ($c["company"]["cnpj"] ?? ""));
      if ($cd !== "" && $cd === $digits) return $c;
    }
  }
  return cv_active_client($ws);
}

$in = cv_body();
$action = (string) ($in["action"] ?? $_GET["action"] ?? "");
$method = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));

if ($method === "GET" && (string) ($_GET["token"] ?? "") !== "" && $action === "") {
  $pdo = podmei_db();
  $st = $pdo->prepare("SELECT * FROM accountant_invites WHERE token = ? LIMIT 1");
  $st->execute([(string) $_GET["token"]]);
  $row = $st->fetch();
  if (!$row) cv_json(404, ["error" => "Convite não encontrado."]);
  cv_json(200, ["invite" => cv_public($row)]);
}

$user = cv_user();
if (!$user) cv_json(401, ["error" => "Sessão inválida."]);
$pdo = podmei_db();

if ($action === "list") {
  $email = strtolower(trim((string) ($user["email"] ?? "")));
  $mine = $pdo->prepare("SELECT * FROM accountant_invites WHERE owner_user_id = ? ORDER BY created_at DESC");
  $mine->execute([(string) $user["id"]]);
  $incoming = $pdo->prepare("SELECT * FROM accountant_invites WHERE lower(accountant_email) = lower(?) OR accountant_user_id = ? ORDER BY created_at DESC");
  $incoming->execute([$email, (string) $user["id"]]);
  cv_json(200, [
    "sent" => array_map("cv_public", $mine->fetchAll()),
    "incoming" => array_map("cv_public", $incoming->fetchAll()),
  ]);
}

if ($action === "invite") {
  $email = strtolower(trim((string) ($in["email"] ?? "")));
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) cv_json(400, ["error" => "E-mail do contador inválido."]);
  $row = podmei_get_workspace((string) $user["id"]);
  $ws = is_array($row["workspace"] ?? null) ? $row["workspace"] : [];
  $client = cv_active_client($ws) ?? [];
  $company = is_array($client["company"] ?? null) ? $client["company"] : [];
  $nome = trim((string) ($company["nome"] ?? $user["nome"] ?? "MEI"));
  $cnpj = trim((string) ($company["cnpj"] ?? ""));

  $dup = $pdo->prepare("SELECT * FROM accountant_invites WHERE owner_user_id = ? AND lower(accountant_email) = lower(?) AND status IN ('pendente','aceito') ORDER BY created_at DESC LIMIT 1");
  $dup->execute([(string) $user["id"], $email]);
  $existing = $dup->fetch();
  if ($existing && ($existing["status"] ?? "") === "aceito") {
    cv_json(200, ["invite" => cv_public($existing), "already" => true]);
  }
  if ($existing && ($existing["status"] ?? "") === "pendente") {
    $token = (string) $existing["token"];
  } else {
    $token = bin2hex(random_bytes(16));
    $id = podmei_uid("cnv");
    $pdo->prepare("INSERT INTO accountant_invites (id,token,owner_user_id,owner_email,owner_nome,company_nome,cnpj,accountant_email,status,created_at)
      VALUES (?,?,?,?,?,?,?,?, 'pendente', ?)")->execute([
      $id, $token, (string) $user["id"], (string) ($user["email"] ?? ""), (string) ($user["nome"] ?? ""),
      $nome, $cnpj, $email, gmdate("Y-m-d\\TH:i:s\\Z"),
    ]);
    $existing = ["id" => $id, "token" => $token, "owner_email" => $user["email"] ?? "", "owner_nome" => $user["nome"] ?? "", "company_nome" => $nome, "cnpj" => $cnpj, "accountant_email" => $email, "status" => "pendente", "created_at" => gmdate("Y-m-d\\TH:i:s\\Z")];
  }

  $link = "https://podmei.com/convite/" . $token;
  $body = "Olá,\n\n{$nome}" . ($cnpj !== "" ? " (CNPJ {$cnpj})" : "") . " convidou este e-mail para acompanhar o MEI no PODMEI Contador.\n\nAceite o convite (entre com a conta do escritório):\n{$link}\n\nPODMEI";
  $ok = podmei_mail($email, "Convite para acompanhar {$nome} no PODMEI", $body);
  podmei_log_email($email, "Convite PODMEI Contador", $ok, $ok ? "" : "mail() retornou false");
  cv_json(200, ["invite" => cv_public($existing ?: []), "emailSent" => $ok, "link" => $link]);
}

if ($action === "accept") {
  $token = trim((string) ($in["token"] ?? ""));
  if ($token === "") cv_json(400, ["error" => "Convite inválido."]);
  $plan = (string) ($user["plan"] ?? "");
  $role = (string) ($user["role"] ?? "");
  if ($plan !== "contador" && $plan !== "contador_premium" && $role !== "master") {
    cv_json(403, ["error" => "Aceite o convite com uma conta PODMEI Contador."]);
  }
  $st = $pdo->prepare("SELECT * FROM accountant_invites WHERE token = ? LIMIT 1");
  $st->execute([$token]);
  $row = $st->fetch();
  if (!$row) cv_json(404, ["error" => "Convite não encontrado."]);
  $email = strtolower(trim((string) ($user["email"] ?? "")));
  if (strtolower((string) $row["accountant_email"]) !== $email && $role !== "master") {
    cv_json(403, ["error" => "Este convite foi enviado para outro e-mail."]);
  }
  if (($row["status"] ?? "") !== "aceito") {
    $pdo->prepare("UPDATE accountant_invites SET status='aceito', accountant_user_id=?, accepted_at=? WHERE id=?")->execute([
      (string) $user["id"], gmdate("Y-m-d\\TH:i:s\\Z"), (string) $row["id"],
    ]);
    $row["status"] = "aceito";
    $row["accountant_user_id"] = (string) $user["id"];
  }
  $client = cv_owner_client((string) $row["owner_user_id"], (string) ($row["cnpj"] ?? ""));
  if ($client) {
    $client["id"] = "share_" . $row["id"];
    $client["sharedInviteId"] = $row["id"];
    $client["notes"] = trim((string) ($client["notes"] ?? "") . " Cópia compartilhada pelo MEI.");
  }
  cv_json(200, ["invite" => cv_public($row), "client" => $client]);
}

if ($action === "snapshot") {
  $id = trim((string) ($in["id"] ?? $_GET["id"] ?? ""));
  $st = $pdo->prepare("SELECT * FROM accountant_invites WHERE id = ? LIMIT 1");
  $st->execute([$id]);
  $row = $st->fetch();
  if (!$row || ($row["status"] ?? "") !== "aceito") cv_json(404, ["error" => "Compartilhamento não encontrado."]);
  if ((string) ($row["accountant_user_id"] ?? "") !== (string) $user["id"] && (string) ($user["role"] ?? "") !== "master") {
    cv_json(403, ["error" => "Sem acesso a este MEI."]);
  }
  $client = cv_owner_client((string) $row["owner_user_id"], (string) ($row["cnpj"] ?? ""));
  if (!$client) cv_json(404, ["error" => "O MEI ainda não tem dados na nuvem."]);
  $client["id"] = "share_" . $row["id"];
  $client["sharedInviteId"] = $row["id"];
  cv_json(200, ["client" => $client, "invite" => cv_public($row)]);
}

cv_json(400, ["error" => "Ação inválida."]);
