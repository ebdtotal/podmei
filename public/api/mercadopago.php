<?php

function mp_enabled($config) {
  return trim($config["mp_access_token"] ?? "") !== "";
}

function plan_label($plan, $cycle) {
  $name = $plan === "contador" ? "PODMEI Contador" : "PODMEI Pro";
  return $name . " — " . ($cycle === "year" ? "anual" : "mensal");
}

function mp_request($config, $method, $path, $body = null, $idempotency = "") {
  $token = trim($config["mp_access_token"] ?? "");
  if ($token === "") {
    return [null, "Access Token do Mercado Pago não configurado."];
  }
  $url = "https://api.mercadopago.com" . $path;
  $headers = [
    "Authorization: Bearer " . $token,
    "Content-Type: application/json",
    "Accept: application/json",
  ];
  if ($idempotency !== "") {
    $headers[] = "X-Idempotency-Key: " . $idempotency;
  }
  $payload = $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE);
  if (function_exists("curl_init")) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
    curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    if ($payload !== null && $method !== "GET") {
      curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    }
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false) return [null, $err ?: "Falha ao falar com o Mercado Pago."];
  } else {
    $opts = [
      "http" => [
        "method" => $method,
        "header" => implode("\r\n", $headers),
        "timeout" => 25,
        "ignore_errors" => true,
      ],
    ];
    if ($payload !== null && $method !== "GET") $opts["http"]["content"] = $payload;
    $raw = @file_get_contents($url, false, stream_context_create($opts));
    if ($raw === false) return [null, "Falha ao falar com o Mercado Pago."];
    $code = 0;
    if (isset($http_response_header[0]) && preg_match("/\s(\d{3})\s/", $http_response_header[0], $m)) {
      $code = intval($m[1]);
    }
  }
  $data = json_decode($raw, true);
  if (!is_array($data)) $data = ["raw" => $raw];
  if ($code >= 400) {
    $msg = $data["message"] ?? $data["error"] ?? "Mercado Pago recusou a solicitação.";
    if (!empty($data["cause"][0]["description"])) $msg = $data["cause"][0]["description"];
    return [null, $msg];
  }
  return [$data, null];
}

function mp_create_preference($config, $lead) {
  $origin = rtrim($config["app_url"], "/");
  // Mesmo padrão do EDB Total: páginas de retorno dedicadas + webhook.
  $notify = $origin . "/api/pagamento.php";
  $body = [
    "items" => [[
      "id" => $lead["plan"],
      "title" => $lead["title"] ?? plan_label($lead["plan"], $lead["cycle"]),
      "description" => "Assinatura PODMEI — " . ($lead["nome"] ?? ""),
      "quantity" => 1,
      "currency_id" => "BRL",
      "unit_price" => round(floatval($lead["amount"]), 2),
    ]],
    "payer" => [
      "name" => $lead["nome"],
      "email" => $lead["email"],
    ],
    "back_urls" => [
      "success" => $origin . "/assinar/sucesso",
      "pending" => $origin . "/assinar/pendente",
      "failure" => $origin . "/assinar/falha",
    ],
    "auto_return" => "approved",
    "external_reference" => $lead["id"],
    "notification_url" => $notify,
    "statement_descriptor" => "PODMEI",
    "metadata" => [
      "lead_id" => $lead["id"],
      "plan" => $lead["plan"],
      "cycle" => $lead["cycle"],
    ],
  ];
  [$data, $err] = mp_request($config, "POST", "/checkout/preferences", $body, $lead["id"]);
  if ($err && (stripos($err, "auto_return") !== false || stripos($err, "back_url") !== false)) {
    unset($body["auto_return"]);
    [$data, $err] = mp_request($config, "POST", "/checkout/preferences", $body, $lead["id"] . "-2");
  }
  if ($err) return [null, $err];
  $sandbox = !empty($config["mp_sandbox"]);
  $init = $sandbox
    ? ($data["sandbox_init_point"] ?? $data["init_point"] ?? "")
    : ($data["init_point"] ?? $data["sandbox_init_point"] ?? "");
  if ($init === "") return [null, "O Mercado Pago não devolveu o link de pagamento."];
  return [[
    "id" => $data["id"] ?? "",
    "init_point" => $init,
  ], null];
}

function mp_get_payment($config, $paymentId) {
  $paymentId = preg_replace("/[^0-9]/", "", (string) $paymentId);
  if ($paymentId === "") return [null, "Pagamento inválido."];
  return mp_request($config, "GET", "/v1/payments/" . $paymentId);
}

function mp_search_approved($config, $leadId) {
  $qs = http_build_query([
    "sort" => "date_created",
    "criteria" => "desc",
    "external_reference" => $leadId,
    "status" => "approved",
  ]);
  [$data, $err] = mp_request($config, "GET", "/v1/payments/search?" . $qs);
  if ($err) return [null, $err];
  $results = $data["results"] ?? [];
  return [is_array($results) && count($results) ? $results[0] : null, null];
}

function mp_get_merchant_order($config, $orderId) {
  $orderId = preg_replace("/[^0-9]/", "", (string) $orderId);
  if ($orderId === "") return [null, "Pedido inválido."];
  return mp_request($config, "GET", "/merchant_orders/" . $orderId);
}

function mp_notification_ref() {
  $in = json_input();
  $type = $_GET["topic"] ?? $_GET["type"] ?? $in["type"] ?? $in["topic"] ?? "";
  $id = $_GET["data_id"] ?? $_GET["id"] ?? $in["data"]["id"] ?? $_POST["id"] ?? "";
  if ($id === "" && isset($_GET["data"]) && is_array($_GET["data"])) {
    $id = $_GET["data"]["id"] ?? "";
  }
  if ($type === "" && !empty($in["action"]) && strpos($in["action"], "payment") !== false) {
    $type = "payment";
  }
  if ($type === "" && $id !== "") $type = "payment";
  return [$type, (string) $id];
}

function mp_payment_matches_lead($payment, $lead) {
  if (($payment["status"] ?? "") !== "approved") return false;
  $ref = (string) ($payment["external_reference"] ?? $payment["metadata"]["lead_id"] ?? "");
  if ($ref !== "" && $ref !== (string) $lead["id"]) return false;
  $paid = floatval($payment["transaction_amount"] ?? 0);
  if (abs($paid - floatval($lead["amount"])) > 0.5) return false;
  return true;
}

function mp_mark_payment(&$store, $leadId, $mpPaymentId, $method = "mercadopago") {
  foreach ($store["payments"] as $p => $pay) {
    if ($pay["leadId"] === $leadId) {
      $store["payments"][$p]["method"] = $method;
      $store["payments"][$p]["mpPaymentId"] = $mpPaymentId;
    }
  }
}
