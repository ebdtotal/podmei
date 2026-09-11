<?php
/**
 * Lembretes: DAS (5 dias antes / em atraso) e limite 70% / 90% / teto.
 * POST autenticado: envia o que ainda não foi enviado para a conta.
 * GET ?cron=1&key=... : varre as áreas na nuvem (cron HostGator).
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

function alert_json(int $code, array $payload): void {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function alert_body(): array {
  $raw = file_get_contents("php://input");
  $data = json_decode($raw ?: "{}", true);
  return is_array($data) ? $data : [];
}

function alert_user_id(): ?string {
  $hdr = $_SERVER["HTTP_AUTHORIZATION"] ?? "";
  $token = "";
  if (preg_match("/Bearer\\s+(.+)/i", $hdr, $m)) $token = trim($m[1]);
  if ($token === "") $token = (string) (alert_body()["token"] ?? "");
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
  return $userId;
}

function alert_cron_key(): string {
  $cfg = podmei_cfg();
  return substr(hash_hmac("sha256", "podmei-reminders", (string) $cfg["secret"]), 0, 24);
}

function alert_money(float $n): string {
  return "R$ " . number_format($n, 2, ",", ".");
}

function alert_date(string $iso): string {
  if (!preg_match("/^(\\d{4})-(\\d{2})-(\\d{2})/", $iso, $m)) return $iso;
  return $m[3] . "/" . $m[2] . "/" . $m[1];
}

function alert_due(int $year, int $month): string {
  $d = new DateTime(sprintf("%04d-%02d-01", $year, $month + 1));
  $d->modify("first day of next month");
  $d->setDate((int) $d->format("Y"), (int) $d->format("m"), 20);
  return $d->format("Y-m-d");
}

function alert_das_paid(array $entries): array {
  $map = [];
  foreach ($entries as $entry) {
    if (!is_array($entry)) continue;
    if (($entry["kind"] ?? "") !== "despesa") continue;
    $blob = strtolower((string) ($entry["descricao"] ?? "") . " " . (string) ($entry["documento"] ?? "") . " " . (string) ($entry["contraparte"] ?? ""));
    if (!preg_match("/\\bdas\\b|simei|guia mei/", $blob)) continue;
    $doc = (string) ($entry["documento"] ?? "") . " " . (string) ($entry["descricao"] ?? "");
    if (preg_match("/(\\d{1,2})\\s*[\\/.-]\\s*(\\d{4})/", $doc, $m)) {
      $map[sprintf("%04d-%02d", (int) $m[2], (int) $m[1])] = true;
    }
  }
  return $map;
}

function alert_opened(array $company, int $year, int $month): bool {
  $opened = (string) ($company["dataAbertura"] ?? "");
  if ($opened === "") return true;
  return substr($opened, 0, 7) <= sprintf("%04d-%02d", $year, $month + 1);
}

function alert_active_client(array $ws): ?array {
  $clients = $ws["clients"] ?? [];
  if (!is_array($clients) || !$clients) return null;
  $active = (string) ($ws["activeClientId"] ?? "");
  foreach ($clients as $c) {
    if (is_array($c) && (string) ($c["id"] ?? "") === $active) return $c;
  }
  return is_array($clients[0]) ? $clients[0] : null;
}

/** @return list<array{key:string,subject:string,body:string}> */
function alert_compute(array $ws, string $today): array {
  $client = alert_active_client($ws);
  if (!$client) return [];
  $company = is_array($client["company"] ?? null) ? $client["company"] : [];
  $entries = is_array($client["entries"] ?? null) ? $client["entries"] : [];
  $nome = trim((string) ($company["nome"] ?? "sua empresa"));
  if ($nome === "" || $nome === "Novo MEI") return [];
  $out = [];
  $paid = alert_das_paid($entries);
  $year = (int) substr($today, 0, 4);
  $months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  $late = null;
  foreach ([$year - 1, $year] as $y) {
    for ($month = 0; $month < 12; $month++) {
      if (!alert_opened($company, $y, $month)) continue;
      $due = alert_due($y, $month);
      if ($due === "") continue;
      $diff = (int) round((strtotime($due . " 12:00:00") - strtotime($today . " 12:00:00")) / 86400);
      if ($diff > 5) continue;
      $key = sprintf("%04d-%02d", $y, $month + 1);
      if (!empty($paid[$key])) continue;
      $ref = $months[$month] . "/" . $y;
      if ($diff < 0) {
        // Exercício anterior não gera e-mail de atraso (lançamento retroativo continua permitido).
        if ($y < $year) continue;
        $late = [
          "key" => "das-late:" . $key,
          "subject" => "DAS de {$ref} em atraso — PODMEI",
          "body" => "Olá,\n\nO DAS de {$ref} de {$nome} venceu em " . alert_date($due) . " e ainda não está lançado como pago no PODMEI.\n\nEmita a guia e registre o pagamento:\nhttps://podmei.com/app/das\n\nPODMEI",
        ];
        continue;
      }
      $quando = $diff === 0 ? "hoje" : "em {$diff} dia" . ($diff === 1 ? "" : "s");
      $out[] = [
        "key" => "das:" . $key,
        "subject" => "DAS de {$ref} vence {$quando} — PODMEI",
        "body" => "Olá,\n\nO DAS de {$ref} de {$nome} vence {$quando} (" . alert_date($due) . ") e a competência ainda está em aberto.\n\nEmita a guia e, depois de pagar, lance o pagamento no app:\nhttps://podmei.com/app/das\n\nPODMEI",
      ];
    }
  }
  if ($late) $out[] = $late;

  $billed = 0.0;
  foreach ($entries as $entry) {
    if (!is_array($entry)) continue;
    if (($entry["kind"] ?? "") !== "venda") continue;
    $data = (string) ($entry["data"] ?? "");
    if (strpos($data, (string) $year) !== 0) continue;
    $billed += (float) ($entry["valor"] ?? 0);
  }
  $annual = (float) ($company["limiteFaturamento"] ?? 81000);
  if ($annual <= 0) $annual = 81000;
  $opened = (string) ($company["dataAbertura"] ?? "");
  $monthsOpen = 12;
  if (preg_match("/^(\\d{4})-(\\d{2})/", $opened, $om)) {
    $oy = (int) $om[1];
    $omth = (int) $om[2];
    if ($oy === $year) $monthsOpen = max(0, 13 - $omth);
    if ($oy > $year) $monthsOpen = 0;
  }
  $limit = ($annual / 12) * $monthsOpen;
  if ($limit > 0 && $billed > 0) {
    $pct = ($billed / $limit) * 100;
    $band = $pct >= 100 ? 100 : ($pct >= 90 ? 90 : ($pct >= 70 ? 70 : 0));
    if ($band) {
      $titulo = $band >= 100 ? "Limite de faturamento do MEI estourou" : "Faturamento em {$band}% do limite";
      $out[] = [
        "key" => "limite:{$year}:{$band}",
        "subject" => "{$titulo} — PODMEI",
        "body" => "Olá,\n\n{$nome} faturou " . alert_money($billed) . " de " . alert_money($limit) . " neste ano (" . number_format($pct, 1, ",", ".") . "% do teto proporcional).\n\nAcompanhe em:\nhttps://podmei.com/app/limites\n\nPODMEI",
      ];
    }
  }
  return $out;
}

function alert_send_for_user(string $userId): array {
  $pdo = podmei_db();
  $st = $pdo->prepare("SELECT email FROM users WHERE id = ? LIMIT 1");
  $st->execute([$userId]);
  $user = $st->fetch();
  $email = strtolower(trim((string) ($user["email"] ?? "")));
  $row = podmei_get_workspace($userId);
  $ws = is_array($row["workspace"] ?? null) ? $row["workspace"] : null;
  if (!$ws) return ["sent" => []];
  if ($email === "" && is_array($ws["clients"][0]["company"] ?? null)) {
    $email = strtolower(trim((string) ($ws["clients"][0]["company"]["email"] ?? "")));
  }
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return ["sent" => []];

  $today = date("Y-m-d");
  $sent = [];
  foreach (alert_compute($ws, $today) as $item) {
    $chk = $pdo->prepare("SELECT id FROM alert_mails WHERE user_id = ? AND alert_key = ? LIMIT 1");
    $chk->execute([$userId, $item["key"]]);
    if ($chk->fetch()) continue;
    $ok = podmei_mail($email, $item["subject"], $item["body"]);
    podmei_log_email($email, $item["subject"], $ok, $ok ? "" : "mail() retornou false");
    if (!$ok) continue;
    $pdo->prepare("INSERT OR IGNORE INTO alert_mails (id,user_id,alert_key,sent_at) VALUES (?,?,?,?)")->execute([
      podmei_uid("alr"), $userId, $item["key"], gmdate("Y-m-d\\TH:i:s\\Z"),
    ]);
    $sent[] = $item["key"];
  }
  return ["sent" => $sent];
}

$method = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));
if ($method === "GET" && (string) ($_GET["cron"] ?? "") === "1") {
  if (!hash_equals(alert_cron_key(), (string) ($_GET["key"] ?? ""))) {
    alert_json(401, ["error" => "Chave inválida."]);
  }
  $pdo = podmei_db();
  $n = 0;
  foreach ($pdo->query("SELECT user_id FROM workspaces") as $row) {
    $result = alert_send_for_user((string) $row["user_id"]);
    $n += count($result["sent"]);
  }
  alert_json(200, ["ok" => true, "sent" => $n]);
}

$uid = alert_user_id();
if (!$uid) alert_json(401, ["error" => "Sessão inválida."]);
alert_json(200, ["ok" => true] + alert_send_for_user($uid));
