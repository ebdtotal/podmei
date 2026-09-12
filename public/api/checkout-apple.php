<?php
/**
 * Checkout Apple IAP (StoreKit) — cria/ativa conta após purchaseProduct.
 */
declare(strict_types=1);
ob_start();
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) === "OPTIONS") {
  http_response_code(204);
  exit;
}

require __DIR__ . "/paylib.php";

if (strtoupper((string) ($_SERVER["REQUEST_METHOD"] ?? "GET")) !== "POST") {
  pay_json_err("Use POST.", 405);
}

$in = pay_body();
if (!$in) $in = $_POST;
pay_json_ok(pay_checkout_apple($in));
