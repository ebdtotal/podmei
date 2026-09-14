<?php
/**
 * Lembretes: DAS, limites e folha. Contador recebe avisos de todos os MEIs da carteira.
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

function alert_business_day(string $iso): string {
  $ts = strtotime($iso . " 12:00:00");
  if ($ts === false) return $iso;
  $dow = (int) date("w", $ts);
  if ($dow === 0) $ts = strtotime("+1 day", $ts);
  if ($dow === 6) $ts = strtotime("+2 days", $ts);
  return date("Y-m-d", $ts);
}

function alert_labor_paid(array $payrolls, int $year, int $month): bool {
  $keyMonth = $month;
  foreach ($payrolls as $run) {
    if (!is_array($run)) continue;
    if ((string) ($run["kind"] ?? "") !== "mensal") continue;
    if ((int) ($run["year"] ?? 0) !== $year) continue;
    if ((int) ($run["month"] ?? -1) !== $keyMonth) continue;
    return !empty($run["daePaid"]);
  }
  return false;
}

function alert_employed(array $employee, int $year, int $month): bool {
  $key = sprintf("%04d-%02d", $year, $month + 1);
  $start = substr((string) ($employee["dataAdmissao"] ?? ""), 0, 7);
  if ($start !== "" && $start > $key) return false;
  $end = substr((string) ($employee["dataDesligamento"] ?? ""), 0, 7);
  if ($end !== "" && $end < $key) return false;
  return true;
}

/** @return list<array{key:string,subject:string,body:string}> */
function alert_labor(array $employee, array $payrolls, string $today, int $year, array $months, string $empresa): array {
  $out = [];
  $nome = trim((string) ($employee["nome"] ?? "colaborador"));
  foreach ([$year - 1, $year] as $y) {
    for ($month = 0; $month < 12; $month++) {
      if (!alert_employed($employee, $y, $month)) continue;
      if (alert_labor_paid($payrolls, $y, $month)) continue;
      $ref = $months[$month] . "/" . $y;
      $next = strtotime(sprintf("%04d-%02d-01", $y, $month + 1) . " +1 month");
      if ($next === false) continue;
      $duties = [
        ["id" => "fgts", "title" => "guia de FGTS", "due" => alert_business_day(date("Y-m-07", $next))],
        ["id" => "inss", "title" => "INSS", "due" => alert_business_day(date("Y-m-20", $next))],
      ];
      foreach ($duties as $duty) {
        $due = $duty["due"];
        $diff = (int) round((strtotime($due . " 12:00:00") - strtotime($today . " 12:00:00")) / 86400);
        if ($diff > 5) continue;
        if ($diff < 0 && $y < $year) continue;
        $late = $diff < 0;
        $quando = $diff === 0 ? "vence hoje" : "vence em {$diff} dia" . ($diff === 1 ? "" : "s");
        $dutyId = (string) $duty["id"];
        $dutyTitle = (string) $duty["title"];
        $comp = sprintf("%04d-%02d", $y, $month + 1);
        $out[] = [
          "key" => ($late ? "folha-{$dutyId}-late:" : "folha-{$dutyId}:") . $comp,
          "subject" => ($late ? "Pagar {$dutyTitle} de {$ref} em atraso" : "Pagar {$dutyTitle} de {$ref} {$quando}") . " — {$empresa} — PODMEI",
          "body" => "Olá,\n\n{$empresa} tem colaborador cadastrado ({$nome}). A {$dutyTitle} de {$ref} " . ($late ? "venceu em " : "vence em ") . alert_date($due) . ".\n\nQuite a guia no eSocial e lance o pagamento na folha:\nhttps://podmei.com/app/folha\n\nPODMEI",
        ];
      }
    }
  }
  return $out;
}

/** @return list<array{key:string,subject:string,body:string}> */
function alert_limit_mail(
  float $used,
  float $limit,
  int $year,
  string $empresa,
  string $prefix,
  string $titleAt,
  string $titleNear,
  string $verb,
  string $ceiling
): array {
  if ($limit <= 0 || $used <= 0) return [];
  $pct = ($used / $limit) * 100;
  $band = $pct >= 100 ? 100 : ($pct >= 90 ? 90 : ($pct >= 70 ? 70 : 0));
  if (!$band) return [];
  $titulo = $band >= 100 ? $titleAt : sprintf($titleNear, $band);
  $shown = number_format($pct, 1, ",", ".");
  return [[
    "key" => "{$prefix}:{$year}:{$band}",
    "subject" => "{$titulo} — {$empresa} — PODMEI",
    "body" => "Olá,\n\n{$empresa} {$verb} " . alert_money($used) . " de " . alert_money($limit) . " neste ano ({$shown}% {$ceiling}).\n\nAcompanhe em:\nhttps://podmei.com/app/limites\n\nPODMEI",
  ]];
}

function alert_workspace_clients(array $ws): array {
  $clients = $ws["clients"] ?? [];
  if (!is_array($clients) || !$clients) return [];
  $out = [];
  foreach ($clients as $c) {
    if (!is_array($c)) continue;
    if ((string) ($c["status"] ?? "ativo") === "arquivado") continue;
    $out[] = $c;
  }
  return $out;
}

/** @return list<array{key:string,subject:string,body:string}> */
function alert_compute_for_client(array $client, string $today, bool $premium = false): array {
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
        if ($y < $year) continue;
        $late = [
          "key" => "das-late:" . $key,
          "subject" => "DAS de {$ref} em atraso — {$nome} — PODMEI",
          "body" => "Olá,\n\nO DAS de {$ref} de {$nome} venceu em " . alert_date($due) . " e ainda não está lançado como pago no PODMEI.\n\nEmita a guia e registre o pagamento:\nhttps://podmei.com/app/das\n\nPODMEI",
        ];
        continue;
      }
      $quando = $diff === 0 ? "hoje" : "em {$diff} dia" . ($diff === 1 ? "" : "s");
      $out[] = [
        "key" => "das:" . $key,
        "subject" => "DAS de {$ref} vence {$quando} — {$nome} — PODMEI",
        "body" => "Olá,\n\nO DAS de {$ref} de {$nome} vence {$quando} (" . alert_date($due) . ") e a competência ainda está em aberto.\n\nEmita a guia e, depois de pagar, lance o pagamento no app:\nhttps://podmei.com/app/das\n\nPODMEI",
      ];
    }
  }
  if ($late) $out[] = $late;

  $billed = 0.0;
  $bought = 0.0;
  foreach ($entries as $entry) {
    if (!is_array($entry)) continue;
    $data = (string) ($entry["data"] ?? "");
    if (strpos($data, (string) $year) !== 0) continue;
    $kind = (string) ($entry["kind"] ?? "");
    $valor = (float) ($entry["valor"] ?? 0);
    if ($kind === "venda") $billed += $valor;
    if ($kind === "compra") $bought += $valor;
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
  $employee = is_array($client["employee"] ?? null) ? $client["employee"] : null;
  $payrolls = is_array($client["payrolls"] ?? null) ? $client["payrolls"] : [];
  if (is_array($employee) && (string) ($employee["status"] ?? "") === "ativo") {
    $out = array_merge($out, alert_labor($employee, $payrolls, $today, $year, $months, $nome));
  }

  $regime = (string) ($company["regimeTributario"] ?? "mei");
  if ($regime !== "simples_nacional") {
    $out = array_merge($out, alert_limit_mail(
      $billed,
      $limit,
      $year,
      $nome,
      "limite",
      "Limite de faturamento do MEI estourou",
      "Faturamento em %d%% do limite",
      "faturou",
      "do teto proporcional"
    ));
    $out = array_merge($out, alert_limit_mail(
      $bought,
      $limit * 0.8,
      $year,
      $nome,
      "limite-compras",
      "Limite de compras do MEI estourou",
      "Compras em %d%% do limite",
      "comprou",
      "do teto de compras (80% do limite proporcional)"
    ));
  }

  // Premium: lembrete de eventos/agendamentos no dia (e-mail a partir das 06h, via cron ou app).
  if ($premium) {
    date_default_timezone_set("America/Sao_Paulo");
    $hour = (int) date("G");
    if ($hour >= 6) {
      $events = is_array($client["events"] ?? null) ? $client["events"] : [];
      foreach ($events as $ev) {
        if (!is_array($ev)) continue;
        $date = (string) ($ev["date"] ?? "");
        if ($date !== $today) continue;
        $eid = (string) ($ev["id"] ?? "");
        if ($eid === "") continue;
        $title = trim((string) ($ev["title"] ?? "Evento"));
        if ($title === "") $title = "Evento";
        $note = trim((string) ($ev["note"] ?? ""));
        $valor = (float) ($ev["valor"] ?? 0);
        $extra = $note !== "" ? "\n\nObservação: {$note}" : "";
        if ($valor > 0) $extra .= "\nValor: " . alert_money($valor);
        $out[] = [
          "key" => "evento:{$eid}:{$date}",
          "subject" => "Lembrete: {$title} — {$nome} — PODMEI",
          "body" => "Olá,\n\nHoje (" . alert_date($date) . ") você tem o agendamento \"{$title}\" no calendário do PODMEI.{$extra}\n\nVeja no app:\nhttps://podmei.com/app/calendario\n\nPODMEI",
        ];
      }
    }
  }

  return $out;
}

function alert_contact_email(array $entry, array $contacts): string {
  $contactId = (string) ($entry["contactId"] ?? "");
  $name = strtolower(trim((string) ($entry["contraparte"] ?? "")));
  foreach ($contacts as $c) {
    if (!is_array($c)) continue;
    if ($contactId !== "" && (string) ($c["id"] ?? "") === $contactId) {
      return strtolower(trim((string) ($c["email"] ?? "")));
    }
  }
  foreach ($contacts as $c) {
    if (!is_array($c)) continue;
    if ((string) ($c["kind"] ?? "") !== "cliente") continue;
    if (strtolower(trim((string) ($c["nome"] ?? ""))) === $name) {
      return strtolower(trim((string) ($c["email"] ?? "")));
    }
  }
  return "";
}

/**
 * Cobrança automática do contador: e-mail ao cliente 3 dias antes, no dia e 3 dias depois.
 * @return list<array{key:string,subject:string,body:string,to:string}>
 */
function alert_cobranca_mails(array $client, string $today, string $escritorio): array {
  $company = is_array($client["company"] ?? null) ? $client["company"] : [];
  $entries = is_array($client["entries"] ?? null) ? $client["entries"] : [];
  $contacts = is_array($client["contacts"] ?? null) ? $client["contacts"] : [];
  $empresa = trim((string) ($company["nome"] ?? $escritorio));
  if ($empresa === "") $empresa = "Escritório contábil";
  $out = [];
  foreach ($entries as $entry) {
    if (!is_array($entry)) continue;
    if ((string) ($entry["status"] ?? "") !== "a_receber") continue;
    $eid = (string) ($entry["id"] ?? "");
    if ($eid === "") continue;
    $due = (string) ($entry["vencimento"] ?? $entry["data"] ?? "");
    if (!preg_match("/^\\d{4}-\\d{2}-\\d{2}/", $due)) continue;
    $due = substr($due, 0, 10);
    $diff = (int) round((strtotime($due . " 12:00:00") - strtotime($today . " 12:00:00")) / 86400);
    $stage = null;
    if ($diff === 3) $stage = "m3";
    elseif ($diff === 0) $stage = "d0";
    elseif ($diff === -3) $stage = "p3";
    if ($stage === null) continue;
    $to = alert_contact_email($entry, $contacts);
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) continue;
    $valor = alert_money((float) ($entry["valor"] ?? 0));
    $cli = trim((string) ($entry["contraparte"] ?? "cliente"));
    $desc = trim((string) ($entry["descricao"] ?? "honorários / serviços"));
    if ($stage === "m3") {
      $subject = "Lembrete: vencimento em 3 dias — {$empresa}";
      $body = "Olá, {$cli}.\n\nEm 3 dias (" . alert_date($due) . ") vence o valor de {$valor} referente a {$desc}, junto a {$empresa}.\n\nSe já pagou, desconsidere este aviso.\n\nPODMEI — mensagem automática do escritório.";
    } elseif ($stage === "d0") {
      $subject = "Vence hoje — {$empresa}";
      $body = "Olá, {$cli}.\n\nHoje (" . alert_date($due) . ") vence o valor de {$valor} referente a {$desc}, junto a {$empresa}.\n\nSe já pagou, desconsidere este aviso.\n\nPODMEI — mensagem automática do escritório.";
    } else {
      $subject = "Em atraso há 3 dias — {$empresa}";
      $body = "Olá, {$cli}.\n\nO valor de {$valor} referente a {$desc} venceu em " . alert_date($due) . " e ainda consta em aberto junto a {$empresa}.\n\nSe já pagou, desconsidere este aviso.\n\nPODMEI — mensagem automática do escritório.";
    }
    $out[] = [
      "key" => "cobranca:{$eid}:{$stage}",
      "subject" => $subject,
      "body" => $body,
      "to" => $to,
    ];
  }
  return $out;
}

/** @return list<array{key:string,subject:string,body:string,to?:string}> */
function alert_compute(array $ws, string $today, bool $premium = false, bool $contador = false): array {
  $clients = alert_workspace_clients($ws);
  if (!$clients) return [];
  $multi = count($clients) > 1;
  $accountant = is_array($ws["accountant"] ?? null) ? $ws["accountant"] : [];
  $escritorio = trim((string) ($accountant["escritorio"] ?? $accountant["nome"] ?? ""));
  $out = [];
  foreach ($clients as $client) {
    $cid = (string) ($client["id"] ?? "");
    foreach (alert_compute_for_client($client, $today, $premium) as $item) {
      if ($multi && $cid !== "") {
        $item["key"] = $cid . ":" . $item["key"];
      }
      $out[] = $item;
    }
    if ($contador) {
      foreach (alert_cobranca_mails($client, $today, $escritorio) as $item) {
        if ($multi && $cid !== "") {
          $item["key"] = $cid . ":" . $item["key"];
        }
        $out[] = $item;
      }
    }
  }
  return $out;
}

function alert_send_for_user(string $userId): array {
  $pdo = podmei_db();
  $st = $pdo->prepare("SELECT email, plan, role FROM users WHERE id = ? LIMIT 1");
  $st->execute([$userId]);
  $user = $st->fetch();
  $email = strtolower(trim((string) ($user["email"] ?? "")));
  $plan = strtolower(trim((string) ($user["plan"] ?? "pro")));
  $role = strtolower(trim((string) ($user["role"] ?? "")));
  $premium = $plan === "premium" || $plan === "contador" || $plan === "contador_premium";
  $contador = $plan === "contador" || $plan === "contador_premium" || $role === "contador";
  $row = podmei_get_workspace($userId);
  $ws = is_array($row["workspace"] ?? null) ? $row["workspace"] : null;
  if (!$ws) return ["sent" => []];
  if ($email === "" && is_array($ws["clients"][0]["company"] ?? null)) {
    $email = strtolower(trim((string) ($ws["clients"][0]["company"]["email"] ?? "")));
  }

  $today = date("Y-m-d");
  date_default_timezone_set("America/Sao_Paulo");
  $today = date("Y-m-d");
  $sent = [];
  foreach (alert_compute($ws, $today, $premium, $contador) as $item) {
    $to = strtolower(trim((string) ($item["to"] ?? $email)));
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) continue;
    $chk = $pdo->prepare("SELECT id FROM alert_mails WHERE user_id = ? AND alert_key = ? LIMIT 1");
    $chk->execute([$userId, $item["key"]]);
    if ($chk->fetch()) continue;
    $ok = podmei_mail($to, $item["subject"], $item["body"]);
    podmei_log_email($to, $item["subject"], $ok, $ok ? "" : "mail() retornou false");
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
