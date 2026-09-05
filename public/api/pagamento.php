<?php
/**
 * Pagamento PODMEI — espelho do EDB public/api/pagamento.php
 * Webhook MP + poll sid/payment_id/preapproval_id → ativa conta + mail().
 */
declare(strict_types=1);
ob_start();
require __DIR__ . "/paylib.php";

$method = strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET"));
$in = pay_body();
if (!$in) $in = $_POST;

$topic = trim((string) ($in["type"] ?? $in["topic"] ?? $_GET["type"] ?? $_GET["topic"] ?? ""));
$id = trim((string) (
  ($in["data"]["id"] ?? "")
  ?: ($in["id"] ?? "")
  ?: ($_GET["data_id"] ?? "")
  ?: ($_GET["id"] ?? "")
));
if ($id === "" && isset($_GET["data.id"])) $id = trim((string) $_GET["data.id"]);

$sid = trim((string) ($_GET["sid"] ?? $_GET["external_reference"] ?? $in["sid"] ?? $in["id"] ?? ""));
$paymentId = trim((string) (
  $_GET["payment_id"]
  ?? $_GET["collection_id"]
  ?? $in["payment_id"]
  ?? $in["paymentId"]
  ?? ""
));
$preapprovalId = trim((string) (
  $_GET["preapproval_id"]
  ?? $in["preapproval_id"]
  ?? $in["preapprovalId"]
  ?? ""
));

if ($topic !== "" && $id !== "") {
  pay_processar_notificacao($topic, $id);
  pay_json_ok(["ok" => true]);
}

if ($method === "POST" && $id !== "" && $sid === "" && $preapprovalId === "") {
  pay_processar_notificacao($topic !== "" ? $topic : "payment", $id);
  pay_json_ok(["ok" => true]);
}

if ($preapprovalId !== "") {
  pay_processar_preapproval($preapprovalId);
  if ($sid === "") {
    $pdo = pay_db();
    $st = $pdo->prepare("SELECT id FROM signups WHERE mp_preapproval_id = ? LIMIT 1");
    $st->execute([$preapprovalId]);
    $row = $st->fetch();
    if ($row) $sid = (string) $row["id"];
  }
}

if ($sid !== "") {
  if ($paymentId !== "") {
    pay_processar_pagamento_mp($paymentId);
  } elseif ($preapprovalId === "") {
    // Sem payment_id: tenta achar pagamento aprovado pelo external_reference
    $res = pay_mp_request("GET", "/v1/payments/search?" . http_build_query([
      "sort" => "date_created",
      "criteria" => "desc",
      "external_reference" => $sid,
      "status" => "approved",
    ]));
    if ($res["ok"] && !empty($res["data"]["results"][0]["id"])) {
      pay_processar_pagamento_mp((string) $res["data"]["results"][0]["id"]);
    } else {
      // Assinatura: tenta pelo preapproval gravado
      $pdo = pay_db();
      $st = $pdo->prepare("SELECT mp_preapproval_id FROM signups WHERE id = ?");
      $st->execute([$sid]);
      $row = $st->fetch();
      if ($row && trim((string) ($row["mp_preapproval_id"] ?? "")) !== "") {
        pay_processar_preapproval((string) $row["mp_preapproval_id"]);
      }
    }
  }
  pay_json_ok(pay_status_publico($sid));
}

if ($paymentId !== "") {
  pay_processar_pagamento_mp($paymentId);
  pay_json_ok(["ok" => true]);
}

if ($id !== "") {
  pay_processar_notificacao($topic !== "" ? $topic : "payment", $id);
}

pay_json_ok(["ok" => true]);
