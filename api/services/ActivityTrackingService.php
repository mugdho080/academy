<?php

function at_json_input(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function at_format_hms(int $seconds): string
{
    $safe = max(0, $seconds);
    $hours = floor($safe / 3600);
    $minutes = floor(($safe % 3600) / 60);
    $secs = $safe % 60;
    return sprintf('%02d:%02d:%02d', $hours, $minutes, $secs);
}

function at_session_summary(array $session): string
{
    $login = $session['login_at'] ?? null;
    $logout = $session['logout_at'] ?? null;
    $total = (int) ($session['total_seconds_active'] ?? 0);

    $loginText = $login ? date('H:i:s', strtotime($login)) : '--:--:--';
    $logoutText = $logout ? date('H:i:s', strtotime($logout)) : 'active';

    return "Logged in {$loginText}, Logged out {$logoutText}, Total active " . at_format_hms($total);
}

function at_validate_date(string $value, string $fallback): string
{
    $dt = DateTime::createFromFormat('Y-m-d', $value);
    $isValid = $dt && $dt->format('Y-m-d') === $value;
    return $isValid ? $value : $fallback;
}

function at_validate_context(array $payload): array
{
    $type = $payload['context_type'] ?? 'dashboard';
    $allowed = ['dashboard', 'chapter', 'level', 'lesson'];
    if (!in_array($type, $allowed, true)) {
        $type = 'dashboard';
    }

    $chapterId = isset($payload['chapter_id']) && $payload['chapter_id'] !== '' ? (int) $payload['chapter_id'] : null;
    $levelId = isset($payload['level_id']) && $payload['level_id'] !== '' ? (int) $payload['level_id'] : null;
    $lessonId = isset($payload['lesson_id']) && $payload['lesson_id'] !== '' ? (int) $payload['lesson_id'] : null;

    if ($type !== 'chapter') {
        $chapterId = $chapterId ?: null;
    }
    if ($type !== 'level' && $type !== 'lesson') {
        $levelId = $levelId ?: null;
    }
    if ($type !== 'lesson') {
        $lessonId = null;
    }

    return [
        'context_type' => $type,
        'chapter_id' => $chapterId,
        'level_id' => $levelId,
        'lesson_id' => $lessonId
    ];
}

function at_context_equals(array $row, array $context): bool
{
    return ($row['context_type'] ?? null) === $context['context_type']
        && ((int) ($row['chapter_id'] ?? 0)) === ((int) ($context['chapter_id'] ?? 0))
        && ((int) ($row['level_id'] ?? 0)) === ((int) ($context['level_id'] ?? 0))
        && ((int) ($row['lesson_id'] ?? 0)) === ((int) ($context['lesson_id'] ?? 0));
}

function at_ensure_tracking_schema(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $tableExists = static function (string $table) use ($pdo): bool {
        $q = $pdo->quote($table);
        $stmt = $pdo->query("SHOW TABLES LIKE {$q}");
        return (bool) $stmt->fetchColumn();
    };

    $columnExists = static function (string $table, string $column) use ($pdo): bool {
        if (!$table) return false;
        $q = $pdo->quote($column);
        $stmt = $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE {$q}");
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    };

    $indexExists = static function (string $table, string $indexName) use ($pdo): bool {
        $q = $pdo->quote($indexName);
        $stmt = $pdo->query("SHOW INDEX FROM `{$table}` WHERE Key_name = {$q}");
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    };

    // Resolve historical collision where CRM used the "sessions" table name.
    if ($tableExists('sessions') && !$columnExists('sessions', 'user_id')) {
        $target = $tableExists('crm_sessions')
            ? 'crm_sessions_legacy_' . date('YmdHis')
            : 'crm_sessions';
        $pdo->exec("RENAME TABLE `sessions` TO `{$target}`");
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            login_at DATETIME NOT NULL,
            logout_at DATETIME NULL,
            total_seconds_active INT NOT NULL DEFAULT 0,
            last_ping_at DATETIME NOT NULL,
            status ENUM('active','closed','expired') NOT NULL DEFAULT 'active',
            CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_sessions_user_login (user_id, login_at),
            INDEX idx_sessions_user_status (user_id, status)
        )
    ");

    $sessionColumns = [
        'user_id' => "INT NULL",
        'login_at' => "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
        'logout_at' => "DATETIME NULL",
        'total_seconds_active' => "INT NOT NULL DEFAULT 0",
        'last_ping_at' => "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
        'status' => "ENUM('active','closed','expired') NOT NULL DEFAULT 'active'"
    ];
    foreach ($sessionColumns as $name => $definition) {
        if (!$columnExists('sessions', $name)) {
            $pdo->exec("ALTER TABLE sessions ADD COLUMN {$name} {$definition}");
        }
    }

    if (!$indexExists('sessions', 'idx_sessions_user_login')) {
        $pdo->exec("CREATE INDEX idx_sessions_user_login ON sessions (user_id, login_at)");
    }
    if (!$indexExists('sessions', 'idx_sessions_user_status')) {
        $pdo->exec("CREATE INDEX idx_sessions_user_status ON sessions (user_id, status)");
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS time_entries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            session_id INT NOT NULL,
            user_id INT NOT NULL,
            context_type ENUM('dashboard','chapter','level','lesson') NOT NULL,
            chapter_id INT NULL,
            level_id INT NULL,
            lesson_id INT NULL,
            start_at DATETIME NOT NULL,
            end_at DATETIME NULL,
            seconds_active INT NOT NULL DEFAULT 0,
            date_key DATE NOT NULL,
            CONSTRAINT fk_time_entries_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
            CONSTRAINT fk_time_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_time_entries_user_date (user_id, date_key),
            INDEX idx_time_entries_context (context_type, chapter_id, level_id, lesson_id),
            INDEX idx_time_entries_session (session_id)
        )
    ");

    $entryColumns = [
        'session_id' => "INT NULL",
        'user_id' => "INT NULL",
        'context_type' => "ENUM('dashboard','chapter','level','lesson') NOT NULL DEFAULT 'dashboard'",
        'chapter_id' => "INT NULL",
        'level_id' => "INT NULL",
        'lesson_id' => "INT NULL",
        'start_at' => "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
        'end_at' => "DATETIME NULL",
        'seconds_active' => "INT NOT NULL DEFAULT 0",
        'date_key' => "DATE NOT NULL DEFAULT '2000-01-01'"
    ];
    foreach ($entryColumns as $name => $definition) {
        if (!$columnExists('time_entries', $name)) {
            $pdo->exec("ALTER TABLE time_entries ADD COLUMN {$name} {$definition}");
        }
    }

    if (!$indexExists('time_entries', 'idx_time_entries_user_date')) {
        $pdo->exec("CREATE INDEX idx_time_entries_user_date ON time_entries (user_id, date_key)");
    }
    if (!$indexExists('time_entries', 'idx_time_entries_context')) {
        $pdo->exec("CREATE INDEX idx_time_entries_context ON time_entries (context_type, chapter_id, level_id, lesson_id)");
    }
    if (!$indexExists('time_entries', 'idx_time_entries_session')) {
        $pdo->exec("CREATE INDEX idx_time_entries_session ON time_entries (session_id)");
    }
    if (!$indexExists('time_entries', 'idx_time_entries_bucket')) {
        $pdo->exec("CREATE INDEX idx_time_entries_bucket ON time_entries (session_id, date_key, context_type, chapter_id, level_id, lesson_id)");
    }

    $fkStmt = $pdo->query("
        SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'time_entries'
          AND COLUMN_NAME = 'session_id'
          AND REFERENCED_TABLE_NAME IS NOT NULL
    ");
    $sessionFks = $fkStmt ? $fkStmt->fetchAll(PDO::FETCH_ASSOC) : [];
    $hasCorrectSessionFk = false;
    foreach ($sessionFks as $fk) {
        if (($fk['REFERENCED_TABLE_NAME'] ?? '') === 'sessions') {
            $hasCorrectSessionFk = true;
            continue;
        }
        $constraintName = $fk['CONSTRAINT_NAME'] ?? '';
        if ($constraintName) {
            $pdo->exec("ALTER TABLE time_entries DROP FOREIGN KEY `{$constraintName}`");
        }
    }
    if (!$hasCorrectSessionFk) {
        $pdo->exec("
            ALTER TABLE time_entries
            ADD CONSTRAINT fk_time_entries_session
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        ");
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS activity_events (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            event_id VARCHAR(64) NOT NULL,
            session_id INT NOT NULL,
            user_id INT NOT NULL,
            client_event VARCHAR(32) NOT NULL,
            client_ts DATETIME NULL,
            processed_at DATETIME NOT NULL,
            UNIQUE KEY uniq_activity_event_id (event_id),
            INDEX idx_activity_events_session (session_id),
            INDEX idx_activity_events_user_time (user_id, processed_at),
            CONSTRAINT fk_activity_events_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
            CONSTRAINT fk_activity_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ");

    $ready = true;
}

function at_expire_stale_sessions(PDO $pdo, ?int $userId = null, int $staleMinutes = 10): void
{
    $staleMinutes = max(1, $staleMinutes);
    $params = [];
    $whereUser = '';

    if ($userId !== null) {
        $whereUser = ' AND user_id = ?';
        $params[] = $userId;
    }

    $findSql = "
        SELECT id, COALESCE(last_ping_at, login_at, UTC_TIMESTAMP()) AS close_time
        FROM sessions
        WHERE status = 'active'
          AND last_ping_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL {$staleMinutes} MINUTE)
          {$whereUser}
    ";

    $findStmt = $pdo->prepare($findSql);
    $findStmt->execute($params);
    $stale = $findStmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$stale) {
        return;
    }

    $closeSession = $pdo->prepare("
        UPDATE sessions
        SET status = 'expired',
            logout_at = COALESCE(logout_at, ?)
        WHERE id = ? AND status = 'active'
    ");

    $closeEntries = $pdo->prepare("
        UPDATE time_entries
        SET end_at = ?
        WHERE session_id = ? AND end_at IS NULL
    ");

    foreach ($stale as $row) {
        $closeAt = $row['close_time'];
        $sessionId = (int) $row['id'];
        $closeSession->execute([$closeAt, $sessionId]);
        $closeEntries->execute([$closeAt, $sessionId]);
    }
}

function at_fetch_time_summary(PDO $pdo, int $userId, string $startDate, string $endDate): array
{
    $sessionStmt = $pdo->prepare("
        SELECT id, login_at, logout_at, total_seconds_active, status
        FROM sessions
        WHERE user_id = ?
          AND login_at >= ?
          AND login_at < DATE_ADD(?, INTERVAL 1 DAY)
        ORDER BY login_at DESC
    ");
    $sessionStmt->execute([$userId, $startDate, $endDate]);
    $sessions = $sessionStmt->fetchAll(PDO::FETCH_ASSOC);

    $sessionTotalSeconds = 0;
    foreach ($sessions as &$session) {
        $session['total_seconds_active'] = (int) $session['total_seconds_active'];
        $session['summary'] = at_session_summary($session);
        $sessionTotalSeconds += $session['total_seconds_active'];
    }
    unset($session);

    // Canonical range total comes from time_entries for analytics consistency.
    $entryTotalStmt = $pdo->prepare("
        SELECT COALESCE(SUM(seconds_active), 0) AS total_seconds
        FROM time_entries
        WHERE user_id = ?
          AND date_key BETWEEN ? AND ?
    ");
    $entryTotalStmt->execute([$userId, $startDate, $endDate]);
    $totalActiveSeconds = (int) $entryTotalStmt->fetchColumn();

    $dailyStmt = $pdo->prepare("
        SELECT date_key, SUM(seconds_active) AS total_seconds
        FROM time_entries
        WHERE user_id = ?
          AND date_key BETWEEN ? AND ?
        GROUP BY date_key
        ORDER BY date_key ASC
    ");
    $dailyStmt->execute([$userId, $startDate, $endDate]);
    $dailyTotals = $dailyStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($dailyTotals as &$day) {
        $day['total_seconds'] = (int) $day['total_seconds'];
    }
    unset($day);

    $contextTotalsStmt = $pdo->prepare("
        SELECT context_type, SUM(seconds_active) AS total_seconds
        FROM time_entries
        WHERE user_id = ?
          AND date_key BETWEEN ? AND ?
        GROUP BY context_type
    ");
    $contextTotalsStmt->execute([$userId, $startDate, $endDate]);
    $contextRows = $contextTotalsStmt->fetchAll(PDO::FETCH_ASSOC);
    $contextTotals = [
        'dashboard' => 0,
        'chapter' => 0,
        'level' => 0,
        'lesson' => 0
    ];
    foreach ($contextRows as $row) {
        $type = $row['context_type'];
        if (array_key_exists($type, $contextTotals)) {
            $contextTotals[$type] = (int) $row['total_seconds'];
        }
    }

    $chaptersStmt = $pdo->prepare("
        SELECT
            t.chapter_id,
            c.title AS chapter_title,
            SUM(t.seconds_active) AS total_seconds
        FROM time_entries t
        LEFT JOIN chapters c ON c.id = t.chapter_id
        WHERE t.user_id = ?
          AND t.context_type = 'chapter'
          AND t.date_key BETWEEN ? AND ?
        GROUP BY t.chapter_id, c.title
        ORDER BY total_seconds DESC
    ");
    $chaptersStmt->execute([$userId, $startDate, $endDate]);
    $chapters = $chaptersStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($chapters as &$chapter) {
        $chapter['chapter_id'] = $chapter['chapter_id'] !== null ? (int) $chapter['chapter_id'] : null;
        $chapter['total_seconds'] = (int) $chapter['total_seconds'];
    }
    unset($chapter);

    $levelsStmt = $pdo->prepare("
        SELECT
            t.level_id,
            l.title AS level_title,
            l.chapter_id,
            c.title AS chapter_title,
            SUM(t.seconds_active) AS total_seconds
        FROM time_entries t
        LEFT JOIN levels l ON l.id = t.level_id
        LEFT JOIN chapters c ON c.id = l.chapter_id
        WHERE t.user_id = ?
          AND t.context_type = 'level'
          AND t.date_key BETWEEN ? AND ?
        GROUP BY t.level_id, l.title, l.chapter_id, c.title
        ORDER BY total_seconds DESC
    ");
    $levelsStmt->execute([$userId, $startDate, $endDate]);
    $levels = $levelsStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($levels as &$level) {
        $level['level_id'] = $level['level_id'] !== null ? (int) $level['level_id'] : null;
        $level['chapter_id'] = $level['chapter_id'] !== null ? (int) $level['chapter_id'] : null;
        $level['total_seconds'] = (int) $level['total_seconds'];
    }
    unset($level);

    $lessonsStmt = $pdo->prepare("
        SELECT
            t.lesson_id,
            les.title AS lesson_title,
            les.level_id,
            lv.title AS level_title,
            lv.chapter_id,
            ch.title AS chapter_title,
            SUM(t.seconds_active) AS total_seconds
        FROM time_entries t
        LEFT JOIN lessons les ON les.id = t.lesson_id
        LEFT JOIN levels lv ON lv.id = les.level_id
        LEFT JOIN chapters ch ON ch.id = lv.chapter_id
        WHERE t.user_id = ?
          AND t.context_type = 'lesson'
          AND t.date_key BETWEEN ? AND ?
        GROUP BY t.lesson_id, les.title, les.level_id, lv.title, lv.chapter_id, ch.title
        ORDER BY total_seconds DESC
    ");
    $lessonsStmt->execute([$userId, $startDate, $endDate]);
    $lessons = $lessonsStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($lessons as &$lesson) {
        $lesson['lesson_id'] = $lesson['lesson_id'] !== null ? (int) $lesson['lesson_id'] : null;
        $lesson['level_id'] = $lesson['level_id'] !== null ? (int) $lesson['level_id'] : null;
        $lesson['chapter_id'] = $lesson['chapter_id'] !== null ? (int) $lesson['chapter_id'] : null;
        $lesson['total_seconds'] = (int) $lesson['total_seconds'];
    }
    unset($lesson);

    return [
        'total_active_seconds' => $totalActiveSeconds,
        'session_total_seconds' => $sessionTotalSeconds,
        'sessions' => $sessions,
        'daily_totals' => $dailyTotals,
        'context_totals' => $contextTotals,
        'breakdown' => [
            'chapters' => $chapters,
            'levels' => $levels,
            'lessons' => $lessons
        ]
    ];
}

function at_normalize_event_id($value): ?string
{
    if (!is_string($value)) {
        return null;
    }

    $candidate = trim($value);
    if ($candidate === '') {
        return null;
    }

    if (!preg_match('/^[a-zA-Z0-9._:-]{8,64}$/', $candidate)) {
        return null;
    }

    return $candidate;
}

function at_validate_client_event($value): string
{
    $allowed = [
        'heartbeat',
        'context_switch',
        'blur',
        'hidden',
        'idle',
        'logout',
        'pagehide',
        'manual',
        'recover_queue'
    ];

    if (!is_string($value)) {
        return 'manual';
    }

    return in_array($value, $allowed, true) ? $value : 'manual';
}

function at_parse_client_ts($value): ?string
{
    if (!is_string($value) || trim($value) === '') {
        return null;
    }

    try {
        $dt = new DateTime($value, new DateTimeZone('UTC'));
        return $dt->format('Y-m-d H:i:s');
    } catch (\Throwable $e) {
        return null;
    }
}

function at_bucket_add_seconds(PDO $pdo, int $sessionId, int $userId, array $context, int $deltaSeconds): void
{
    if ($deltaSeconds <= 0) {
        return;
    }

    $findStmt = $pdo->prepare("
        SELECT id
        FROM time_entries
        WHERE session_id = ?
          AND user_id = ?
          AND date_key = UTC_DATE()
          AND context_type = ?
          AND chapter_id <=> ?
          AND level_id <=> ?
          AND lesson_id <=> ?
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $findStmt->execute([
        $sessionId,
        $userId,
        $context['context_type'],
        $context['chapter_id'],
        $context['level_id'],
        $context['lesson_id']
    ]);
    $existingId = $findStmt->fetchColumn();

    if ($existingId) {
        $updateStmt = $pdo->prepare("
            UPDATE time_entries
            SET seconds_active = seconds_active + ?,
                end_at = UTC_TIMESTAMP()
            WHERE id = ?
        ");
        $updateStmt->execute([$deltaSeconds, (int) $existingId]);
        return;
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO time_entries (
            session_id,
            user_id,
            context_type,
            chapter_id,
            level_id,
            lesson_id,
            start_at,
            end_at,
            seconds_active,
            date_key
        ) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), ?, UTC_DATE())
    ");
    $insertStmt->execute([
        $sessionId,
        $userId,
        $context['context_type'],
        $context['chapter_id'],
        $context['level_id'],
        $context['lesson_id'],
        $deltaSeconds
    ]);
}
