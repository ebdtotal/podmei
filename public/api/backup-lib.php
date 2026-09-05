<?php
/**
 * Biblioteca de backup diário PODMEI.
 */
declare(strict_types=1);

require_once __DIR__ . "/db.php";

/**
 * @return array<string, mixed>
 */
function podmei_run_daily_backup(bool $force = false): array {
  $tz = new DateTimeZone("America/Sao_Paulo");
  $now = new DateTimeImmutable("now", $tz);
  $day = $now->format("Y-m-d");
  $dataDir = __DIR__ . "/data";
  $backupRoot = $dataDir . "/backups";
  $dayDir = $backupRoot . "/" . $day;
  $keepDays = 30;

  if (!is_dir($dataDir)) {
    return ["ok" => false, "error" => "Pasta data inexistente.", "day" => $day];
  }
  if (!is_dir($backupRoot) && !@mkdir($backupRoot, 0750, true)) {
    return ["ok" => false, "error" => "Não foi possível criar pasta de backups.", "day" => $day];
  }

  $deny = $backupRoot . "/.htaccess";
  if (!is_file($deny)) {
    @file_put_contents($deny, "Require all denied\nDeny from all\n");
  }

  $marker = $dayDir . "/manifest.json";
  if (!$force && is_file($marker)) {
    $prev = json_decode((string) @file_get_contents($marker), true);
    return [
      "ok" => true,
      "skipped" => true,
      "day" => $day,
      "path" => $dayDir,
      "message" => "Backup de hoje já existe.",
      "manifest" => is_array($prev) ? $prev : null,
    ];
  }

  if (!is_dir($dayDir) && !@mkdir($dayDir, 0750, true)) {
    return ["ok" => false, "error" => "Não foi possível criar pasta do dia.", "day" => $day];
  }

  $copied = [];
  $errors = [];

  try {
    $pdo = podmei_db();
    try {
      $pdo->exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch (Throwable $e) {
      /* ok */
    }

    $dbFile = $dataDir . "/podmei.sqlite";
    if (!is_file($dbFile)) {
      return ["ok" => false, "error" => "Arquivo podmei.sqlite não encontrado.", "day" => $day];
    }

    $destDb = $dayDir . "/podmei.sqlite";
    if (!@copy($dbFile, $destDb)) {
      try {
        $pdo->exec("VACUUM INTO " . $pdo->quote($destDb));
      } catch (Throwable $e) {
        $errors[] = "Falha ao copiar SQLite: " . $e->getMessage();
      }
    }
    if (is_file($destDb)) {
      $copied[] = ["file" => "podmei.sqlite", "bytes" => filesize($destDb)];
    }

    foreach (["podmei.sqlite-wal", "podmei.sqlite-shm", "store.json", "store.json.retry.json"] as $extra) {
      $src = $dataDir . "/" . $extra;
      if (!is_file($src)) continue;
      $dst = $dayDir . "/" . $extra;
      if (@copy($src, $dst)) {
        $copied[] = ["file" => $extra, "bytes" => filesize($dst)];
      }
    }

    $stats = podmei_backup_stats($pdo);
    $manifest = [
      "app" => "PODMEI",
      "day" => $day,
      "createdAt" => $now->format("c"),
      "timezone" => "America/Sao_Paulo",
      "files" => $copied,
      "stats" => $stats,
      "forced" => $force,
    ];
    $manifestJson = json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($manifestJson === false || @file_put_contents($marker, $manifestJson) === false) {
      $errors[] = "Falha ao gravar manifest.json";
    }

    podmei_meta_set($pdo, "backup_last_day", $day);
    podmei_meta_set($pdo, "backup_last_at", $now->format("c"));
    podmei_meta_set($pdo, "backup_last_ok", empty($errors) && is_file($destDb) ? "1" : "0");
    podmei_meta_set($pdo, "backup_last_path", $dayDir);

    $pruned = podmei_prune_backups($backupRoot, $keepDays, $tz);
    $ok = is_file($destDb) && is_file($marker) && empty($errors);

    return [
      "ok" => $ok,
      "skipped" => false,
      "day" => $day,
      "path" => $dayDir,
      "files" => $copied,
      "stats" => $stats,
      "pruned" => $pruned,
      "errors" => $errors,
      "message" => $ok
        ? "Backup diário concluído ({$day})."
        : "Backup incompleto.",
    ];
  } catch (Throwable $e) {
    return [
      "ok" => false,
      "day" => $day,
      "error" => $e->getMessage(),
    ];
  }
}

/**
 * @return array<string, int>
 */
function podmei_backup_stats(PDO $pdo): array {
  $count = static function (string $table) use ($pdo): int {
    try {
      return (int) $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
    } catch (Throwable $e) {
      return 0;
    }
  };
  return [
    "users" => $count("users"),
    "subscriptions" => $count("subscriptions"),
    "signups" => $count("signups"),
    "leads" => $count("leads"),
    "workspaces" => $count("workspaces"),
    "payments" => $count("payments"),
  ];
}

/**
 * @return list<string>
 */
function podmei_prune_backups(string $backupRoot, int $keepDays, DateTimeZone $tz): array {
  $cut = (new DateTimeImmutable("today", $tz))->modify("-{$keepDays} days");
  $pruned = [];
  $dirs = @scandir($backupRoot);
  if (!is_array($dirs)) return $pruned;
  foreach ($dirs as $name) {
    if ($name === "." || $name === ".." || $name === ".htaccess") continue;
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $name)) continue;
    $dir = $backupRoot . "/" . $name;
    if (!is_dir($dir)) continue;
    try {
      $d = new DateTimeImmutable($name, $tz);
    } catch (Throwable $e) {
      continue;
    }
    if ($d >= $cut) continue;
    if (podmei_backup_rrmdir($dir)) $pruned[] = $name;
  }
  return $pruned;
}

function podmei_backup_rrmdir(string $dir): bool {
  if (!is_dir($dir)) return false;
  $items = @scandir($dir);
  if (!is_array($items)) return false;
  foreach ($items as $item) {
    if ($item === "." || $item === "..") continue;
    $path = $dir . "/" . $item;
    if (is_dir($path)) podmei_backup_rrmdir($path);
    else @unlink($path);
  }
  return @rmdir($dir);
}

/**
 * Dispara o backup do dia se ainda não existir (rede de segurança sem cron).
 * Seguro chamar em qualquer request: só grava 1x por dia.
 */
function podmei_maybe_daily_backup_lazy(): void {
  try {
    date_default_timezone_set("America/Sao_Paulo");
    $day = (new DateTimeImmutable("now", new DateTimeZone("America/Sao_Paulo")))->format("Y-m-d");
    $marker = __DIR__ . "/data/backups/{$day}/manifest.json";
    if (is_file($marker)) return;

    $lockDir = __DIR__ . "/data";
    if (!is_dir($lockDir)) @mkdir($lockDir, 0750, true);
    $lockFile = $lockDir . "/.backup-lock";
    $fh = @fopen($lockFile, "c+");
    if (!$fh) return;
    if (!@flock($fh, LOCK_EX | LOCK_NB)) {
      fclose($fh);
      return;
    }
    try {
      if (is_file($marker)) return;
      podmei_run_daily_backup(false);
    } finally {
      @flock($fh, LOCK_UN);
      fclose($fh);
    }
  } catch (Throwable $e) {
    /* nunca quebra o app por falha de backup */
  }
}

/**
 * @return list<array<string, mixed>>
 */
function podmei_list_backups(int $limit = 14): array {
  $backupRoot = __DIR__ . "/data/backups";
  $days = [];
  if (!is_dir($backupRoot)) return $days;
  $names = @scandir($backupRoot) ?: [];
  rsort($names);
  foreach ($names as $name) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $name)) continue;
    $manifestFile = $backupRoot . "/" . $name . "/manifest.json";
    $dbFile = $backupRoot . "/" . $name . "/podmei.sqlite";
    $manifest = is_file($manifestFile)
      ? json_decode((string) @file_get_contents($manifestFile), true)
      : null;
    $days[] = [
      "day" => $name,
      "hasDb" => is_file($dbFile),
      "bytes" => is_file($dbFile) ? filesize($dbFile) : 0,
      "manifest" => is_array($manifest) ? $manifest : null,
    ];
    if (count($days) >= $limit) break;
  }
  return $days;
}
