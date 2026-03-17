<?php

class AchievementService
{
    private PDO $pdo;
    private bool $schemaReady = false;
    private bool $legacyBootstrapRunning = false;
    private ?array $rankCache = null;
    private ?array $achievementCache = null;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function ensureSchema(): void
    {
        if ($this->schemaReady) {
            return;
        }

        $schemaPath = __DIR__ . '/../../db/achievement_schema.sql';
        if (!is_file($schemaPath)) {
            throw new RuntimeException('Missing achievement schema file');
        }
        $schemaSql = file_get_contents($schemaPath);
        if (!is_string($schemaSql)) {
            throw new RuntimeException('Unable to read achievement schema file');
        }

        $statements = array_filter(array_map('trim', explode(';', $schemaSql)));
        foreach ($statements as $statement) {
            if ($statement !== '') {
                $this->pdo->exec($statement);
            }
        }

        $this->ensureUsersPointsColumn();
        $this->seedRankDefinitions();
        $this->seedAchievementDefinitions();
        $this->schemaReady = true;
    }

    public function handleSessionStart(int $userId, ?int $sessionId = null): array
    {
        $this->ensureSchema();
        $result = $this->awardPoints($userId, 'session_start', 'session', $sessionId ?: 'none', [
            'session_id' => $sessionId
        ]);

        $lastDate = $this->getMostRecentQualifyingDate($userId);
        $today = gmdate('Y-m-d');
        if ($lastDate && $lastDate < $today) {
            $gapDays = (int) floor((strtotime($today . ' 00:00:00 UTC') - strtotime($lastDate . ' 00:00:00 UTC')) / 86400);
            if ($gapDays >= 3) {
                $this->awardPoints($userId, 'return_after_inactivity', 'comeback', $today, [
                    'days_inactive' => $gapDays,
                    'skip_weekly_update' => true
                ]);
            }
        }

        return $result;
    }

    public function handleQuizAnswer(
        int $userId,
        int $quizId,
        bool $isCorrect,
        ?int $lessonId = null,
        ?int $levelId = null,
        ?int $chapterId = null
    ): array {
        $this->ensureSchema();
        $this->ensureUserSummaryRow($userId);

        if ($lessonId === null || $levelId === null || $chapterId === null) {
            $mapStmt = $this->pdo->prepare("
                SELECT q.lesson_id, l.level_id, lv.chapter_id
                FROM quizzes q
                INNER JOIN lessons l ON l.id = q.lesson_id
                INNER JOIN levels lv ON lv.id = l.level_id
                WHERE q.id = ?
                LIMIT 1
            ");
            $mapStmt->execute([$quizId]);
            $map = $mapStmt->fetch(PDO::FETCH_ASSOC);
            if ($map) {
                $lessonId = (int) $map['lesson_id'];
                $levelId = (int) $map['level_id'];
                $chapterId = (int) $map['chapter_id'];
            }
        }

        $attempt = $this->pdo->prepare("
            INSERT INTO quiz_attempts (user_id, quiz_id, lesson_id, is_correct, attempted_at)
            VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
        ");
        $attempt->execute([$userId, $quizId, $lessonId, $isCorrect ? 1 : 0]);

        if (!$isCorrect) {
            return [
                'success' => true,
                'is_correct' => false,
                'points_awarded' => 0,
                'summary' => $this->recalculateUserSummary($userId)
            ];
        }

        $insertCompletion = $this->pdo->prepare("
            INSERT IGNORE INTO completed_quizzes (user_id, quiz_id, lesson_id, completed_at)
            VALUES (?, ?, ?, UTC_TIMESTAMP())
        ");
        $insertCompletion->execute([$userId, $quizId, $lessonId]);
        $isNew = $insertCompletion->rowCount() > 0;
        $points = 0;

        if ($isNew) {
            $meta = [
                'quiz_id' => $quizId,
                'lesson_id' => $lessonId,
                'level_id' => $levelId,
                'chapter_id' => $chapterId
            ];
            $points += (int) $this->awardPoints($userId, 'quiz_completed', 'quiz', $quizId, $meta)['points_awarded'];
            $points += (int) $this->awardPoints($userId, 'quiz_correct', 'quiz', $quizId, $meta)['points_awarded'];
            $this->updateStreak($userId, true);
        }

        if ($chapterId) {
            $this->updateChapterMastery($userId, (int) $chapterId);
        }

        return [
            'success' => true,
            'is_correct' => true,
            'new_completion' => $isNew,
            'points_awarded' => $points,
            'summary' => $this->recalculateUserSummary($userId)
        ];
    }

    public function handleLessonCompletion(int $userId, int $lessonId, array $context = []): array
    {
        $this->ensureSchema();
        $this->ensureUserSummaryRow($userId);

        $lessonStmt = $this->pdo->prepare("
            SELECT l.id, l.title, l.level_id, lv.chapter_id
            FROM lessons l
            INNER JOIN levels lv ON lv.id = l.level_id
            WHERE l.id = ?
            LIMIT 1
        ");
        $lessonStmt->execute([$lessonId]);
        $lesson = $lessonStmt->fetch(PDO::FETCH_ASSOC);
        if (!$lesson) {
            throw new RuntimeException('Lesson not found');
        }

        $insertCompletion = $this->pdo->prepare("
            INSERT IGNORE INTO completed_lessons (user_id, lesson_id, completed_at)
            VALUES (?, ?, UTC_TIMESTAMP())
        ");
        $insertCompletion->execute([$userId, $lessonId]);
        $isNew = $insertCompletion->rowCount() > 0;
        $points = 0;

        if ($isNew) {
            $chapterId = (int) $lesson['chapter_id'];
            $levelId = (int) $lesson['level_id'];
            $meta = [
                'lesson_id' => $lessonId,
                'lesson_title' => $lesson['title'],
                'level_id' => $levelId,
                'chapter_id' => $chapterId
            ];
            $points += (int) $this->awardPoints($userId, 'lesson_completed', 'lesson', $lessonId, $meta)['points_awarded'];
            $points += (int) $this->awardPoints($userId, 'first_lesson_of_day_bonus', 'day', gmdate('Y-m-d'), [
                'lesson_id' => $lessonId
            ])['points_awarded'];

            if (!empty($context['is_recommended'])) {
                $points += (int) $this->awardPoints($userId, 'recommended_lesson_bonus', 'lesson', $lessonId, [
                    'lesson_id' => $lessonId
                ])['points_awarded'];
            }

            if ($this->isFirstChapterLessonForUser($userId, $chapterId)) {
                $points += (int) $this->awardPoints($userId, 'new_chapter_bonus', 'chapter', $chapterId, [
                    'chapter_id' => $chapterId
                ])['points_awarded'];
            }

            $points += (int) $this->processHierarchyCompletion($userId, $levelId, $chapterId)['points_awarded'];
            $this->updateChapterMastery($userId, $chapterId);
            $this->updateStreak($userId, true);
        }

        return [
            'success' => true,
            'new_completion' => $isNew,
            'points_awarded' => $points,
            'summary' => $this->recalculateUserSummary($userId)
        ];
    }

    public function awardPoints(int $userId, string $actionCode, string $sourceType, $sourceId, array $metadata = []): array
    {
        $this->ensureSchema();
        $this->ensureUserSummaryRow($userId);
        if ($actionCode !== 'legacy_import') {
            $this->bootstrapLegacyPoints($userId);
        }

        $config = $this->actionConfig($actionCode);
        $points = array_key_exists('points_override', $metadata)
            ? (int) $metadata['points_override']
            : (int) $config['points'];

        $dedupeMode = isset($metadata['dedupe_mode']) ? (string) $metadata['dedupe_mode'] : $config['dedupe'];
        $dedupeKey = isset($metadata['dedupe_key'])
            ? (string) $metadata['dedupe_key']
            : $this->buildDedupeKey($actionCode, $sourceType, $sourceId, $dedupeMode);

        if ($dedupeKey !== null) {
            $existing = $this->pdo->prepare("SELECT id FROM points_log WHERE user_id = ? AND dedupe_key = ? LIMIT 1");
            $existing->execute([$userId, $dedupeKey]);
            if ($existing->fetch(PDO::FETCH_ASSOC)) {
                return [
                    'awarded' => false,
                    'duplicate' => true,
                    'action_code' => $actionCode,
                    'points_awarded' => 0,
                    'summary' => $this->recalculateUserSummary($userId)
                ];
            }
        }

        $insert = $this->pdo->prepare("
            INSERT INTO points_log (
                user_id, action_code, source_type, source_id, points_awarded, metadata_json, dedupe_key, awarded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
        ");
        $insert->execute([
            $userId,
            $actionCode,
            $sourceType,
            $this->stringOrNull($sourceId),
            $points,
            ($clean = $this->publicMetadata($metadata)) ? json_encode($clean, JSON_UNESCAPED_UNICODE) : null,
            $dedupeKey
        ]);

        $summary = $this->recalculateUserSummary($userId);
        if (empty($metadata['skip_weekly_update'])) {
            $this->updateWeeklyTargetProgress($userId);
        }
        if (empty($metadata['skip_evaluate'])) {
            $this->evaluateAchievements($userId);
            $summary = $this->recalculateUserSummary($userId);
        }

        return [
            'awarded' => true,
            'duplicate' => false,
            'action_code' => $actionCode,
            'points_awarded' => $points,
            'summary' => $summary
        ];
    }

    public function calculateRank(int $points): array
    {
        $this->ensureSchema();
        $ranks = $this->getRankDefinitions();
        if (!$ranks) {
            return [
                'current_rank' => 'Seed',
                'next_rank' => null,
                'points_to_next_rank' => 0,
                'next_rank_min_points' => null
            ];
        }

        $current = $ranks[0];
        $next = null;
        foreach ($ranks as $index => $rank) {
            $min = (int) $rank['min_points'];
            $max = $rank['max_points'] === null ? null : (int) $rank['max_points'];
            if ($points >= $min && ($max === null || $points <= $max)) {
                $current = $rank;
                $next = $ranks[$index + 1] ?? null;
                break;
            }
        }

        if ($next) {
            $nextMin = (int) $next['min_points'];
            return [
                'current_rank' => $current['rank_name'],
                'next_rank' => $next['rank_name'],
                'points_to_next_rank' => max(0, $nextMin - $points),
                'next_rank_min_points' => $nextMin
            ];
        }

        return [
            'current_rank' => $current['rank_name'],
            'next_rank' => null,
            'points_to_next_rank' => 0,
            'next_rank_min_points' => null
        ];
    }

    public function recalculateUserSummary(int $userId): array
    {
        $this->ensureSchema();
        $this->ensureUserSummaryRow($userId);

        $existingStmt = $this->pdo->prepare("SELECT current_rank, best_rank FROM user_points WHERE user_id = ? LIMIT 1");
        $existingStmt->execute([$userId]);
        $existing = $existingStmt->fetch(PDO::FETCH_ASSOC) ?: ['current_rank' => 'Seed', 'best_rank' => 'Seed'];

        $totalPoints = (int) $this->singleValue("SELECT COALESCE(SUM(points_awarded), 0) FROM points_log WHERE user_id = ?", [$userId]);
        $totalLessons = (int) $this->singleValue("SELECT COUNT(*) FROM completed_lessons WHERE user_id = ?", [$userId]);
        $totalLevels = (int) $this->singleValue("SELECT COUNT(*) FROM completed_levels WHERE user_id = ?", [$userId]);
        $totalQuizzes = (int) $this->singleValue("SELECT COUNT(*) FROM completed_quizzes WHERE user_id = ?", [$userId]);
        $totalMinutes = (int) floor((int) $this->singleValue("SELECT COALESCE(SUM(seconds_active), 0) FROM time_entries WHERE user_id = ?", [$userId]) / 60);
        $streak = $this->updateStreak($userId, false);
        $rank = $this->calculateRank($totalPoints);

        $currentRank = $rank['current_rank'];
        $bestRank = $this->rankSort($currentRank) >= $this->rankSort((string) $existing['best_rank'])
            ? $currentRank
            : (string) $existing['best_rank'];

        $upsert = $this->pdo->prepare("
            INSERT INTO user_points (
                user_id,
                total_points,
                current_rank,
                best_rank,
                current_streak_days,
                best_streak_days,
                total_lessons_completed,
                total_levels_completed,
                total_quizzes_completed,
                total_active_minutes,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE
                total_points = VALUES(total_points),
                current_rank = VALUES(current_rank),
                best_rank = VALUES(best_rank),
                current_streak_days = VALUES(current_streak_days),
                best_streak_days = VALUES(best_streak_days),
                total_lessons_completed = VALUES(total_lessons_completed),
                total_levels_completed = VALUES(total_levels_completed),
                total_quizzes_completed = VALUES(total_quizzes_completed),
                total_active_minutes = VALUES(total_active_minutes),
                updated_at = UTC_TIMESTAMP()
        ");
        $upsert->execute([
            $userId,
            $totalPoints,
            $currentRank,
            $bestRank,
            (int) $streak['current_streak_days'],
            (int) $streak['best_streak_days'],
            $totalLessons,
            $totalLevels,
            $totalQuizzes,
            $totalMinutes
        ]);

        $this->pdo->prepare("UPDATE users SET points = ? WHERE id = ?")->execute([$totalPoints, $userId]);

        if ((string) $existing['current_rank'] !== $currentRank && $this->rankSort($currentRank) > $this->rankSort((string) $existing['current_rank'])) {
            $this->awardPoints($userId, 'rank_up', 'rank', $currentRank, [
                'points_override' => 0,
                'from_rank' => (string) $existing['current_rank'],
                'to_rank' => $currentRank,
                'skip_evaluate' => true,
                'skip_weekly_update' => true
            ]);
        }

        return [
            'total_points' => $totalPoints,
            'current_rank' => $currentRank,
            'best_rank' => $bestRank,
            'next_rank' => $rank['next_rank'],
            'points_to_next_rank' => (int) $rank['points_to_next_rank'],
            'next_rank_min_points' => $rank['next_rank_min_points'],
            'current_streak_days' => (int) $streak['current_streak_days'],
            'best_streak_days' => (int) $streak['best_streak_days'],
            'total_lessons_completed' => $totalLessons,
            'total_levels_completed' => $totalLevels,
            'total_quizzes_completed' => $totalQuizzes,
            'total_active_minutes' => $totalMinutes
        ];
    }

    public function updateWeeklyTargetProgress(int $userId): array
    {
        $this->ensureSchema();
        $target = $this->ensureWeeklyTarget($userId);

        $minutes = (int) floor((int) $this->singleValue("
            SELECT COALESCE(SUM(seconds_active), 0)
            FROM time_entries
            WHERE user_id = ?
              AND date_key BETWEEN ? AND ?
        ", [$userId, $target['week_start'], $target['week_end']]) / 60);

        $lessons = (int) $this->singleValue("
            SELECT COUNT(*)
            FROM completed_lessons
            WHERE user_id = ?
              AND DATE(completed_at) BETWEEN ? AND ?
        ", [$userId, $target['week_start'], $target['week_end']]);

        $quizzes = (int) $this->singleValue("
            SELECT COUNT(*)
            FROM completed_quizzes
            WHERE user_id = ?
              AND DATE(completed_at) BETWEEN ? AND ?
        ", [$userId, $target['week_start'], $target['week_end']]);

        $achieved = $minutes >= (int) $target['target_minutes']
            && $lessons >= (int) $target['target_lessons']
            && $quizzes >= (int) $target['target_quizzes'];
        $alreadyAchieved = (int) $target['achieved_flag'] === 1;

        $this->pdo->prepare("
            UPDATE weekly_targets
            SET progress_minutes = ?,
                progress_lessons = ?,
                progress_quizzes = ?,
                achieved_flag = ?,
                achieved_at = CASE
                    WHEN ? = 1 AND achieved_at IS NULL THEN UTC_TIMESTAMP()
                    WHEN ? = 0 THEN NULL
                    ELSE achieved_at
                END,
                updated_at = UTC_TIMESTAMP()
            WHERE id = ?
        ")->execute([
            $minutes,
            $lessons,
            $quizzes,
            $achieved ? 1 : 0,
            $achieved ? 1 : 0,
            $achieved ? 1 : 0,
            (int) $target['id']
        ]);

        if ($achieved && !$alreadyAchieved) {
            $this->awardPoints($userId, 'weekly_target_achieved', 'weekly_target', (int) $target['id'], [
                'week_start' => $target['week_start'],
                'week_end' => $target['week_end'],
                'skip_weekly_update' => true
            ]);
        }

        return [
            'id' => (int) $target['id'],
            'week_start' => $target['week_start'],
            'week_end' => $target['week_end'],
            'target_minutes' => (int) $target['target_minutes'],
            'target_lessons' => (int) $target['target_lessons'],
            'target_quizzes' => (int) $target['target_quizzes'],
            'progress_minutes' => $minutes,
            'progress_lessons' => $lessons,
            'progress_quizzes' => $quizzes,
            'achieved_flag' => $achieved ? 1 : 0,
            'reward_points' => (int) $target['reward_points']
        ];
    }

    public function updateChapterMastery(int $userId, int $chapterId): array
    {
        $lessons = (int) $this->singleValue("
            SELECT COUNT(*)
            FROM completed_lessons cl
            INNER JOIN lessons l ON l.id = cl.lesson_id
            INNER JOIN levels lv ON lv.id = l.level_id
            WHERE cl.user_id = ?
              AND lv.chapter_id = ?
        ", [$userId, $chapterId]);
        $levels = (int) $this->singleValue("
            SELECT COUNT(*)
            FROM completed_levels cl
            INNER JOIN levels lv ON lv.id = cl.level_id
            WHERE cl.user_id = ?
              AND lv.chapter_id = ?
        ", [$userId, $chapterId]);
        $quizzes = (int) $this->singleValue("
            SELECT COUNT(*)
            FROM completed_quizzes cq
            INNER JOIN quizzes q ON q.id = cq.quiz_id
            INNER JOIN lessons l ON l.id = q.lesson_id
            INNER JOIN levels lv ON lv.id = l.level_id
            WHERE cq.user_id = ?
              AND lv.chapter_id = ?
        ", [$userId, $chapterId]);
        $chapterCompleted = (int) $this->singleValue("
            SELECT COUNT(*)
            FROM completed_chapters
            WHERE user_id = ?
              AND chapter_id = ?
        ", [$userId, $chapterId]) > 0;

        $chapterPoints = ($lessons * 25) + ($quizzes * 20) + ($levels * 80) + ($chapterCompleted ? 150 : 0);
        $masteryRank = $this->chapterMasteryRank($chapterPoints);

        $this->pdo->prepare("
            INSERT INTO chapter_mastery (
                user_id, chapter_id, chapter_points, completed_lessons, completed_levels, mastery_rank, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE
                chapter_points = VALUES(chapter_points),
                completed_lessons = VALUES(completed_lessons),
                completed_levels = VALUES(completed_levels),
                mastery_rank = VALUES(mastery_rank),
                updated_at = UTC_TIMESTAMP()
        ")->execute([$userId, $chapterId, $chapterPoints, $lessons, $levels, $masteryRank]);

        return [
            'chapter_id' => $chapterId,
            'chapter_points' => $chapterPoints,
            'completed_lessons' => $lessons,
            'completed_levels' => $levels,
            'mastery_rank' => $masteryRank
        ];
    }

    public function updateStreak(int $userId, bool $awardMilestones = false): array
    {
        $dates = $this->getQualifyingActivityDates($userId);
        $today = gmdate('Y-m-d');
        $set = array_fill_keys($dates, true);

        $current = 0;
        $cursor = $today;
        while (isset($set[$cursor])) {
            $current++;
            $cursor = gmdate('Y-m-d', strtotime($cursor . ' -1 day'));
        }

        $best = 0;
        $run = 0;
        $prev = null;
        foreach ($dates as $day) {
            if ($prev === null) {
                $run = 1;
            } else {
                $diff = (int) floor((strtotime($prev . ' 00:00:00 UTC') - strtotime($day . ' 00:00:00 UTC')) / 86400);
                $run = $diff === 1 ? ($run + 1) : 1;
            }
            $best = max($best, $run);
            $prev = $day;
        }

        $this->pdo->prepare("
            UPDATE user_points
            SET current_streak_days = ?,
                best_streak_days = GREATEST(best_streak_days, ?),
                updated_at = UTC_TIMESTAMP()
            WHERE user_id = ?
        ")->execute([$current, $best, $userId]);

        if ($awardMilestones) {
            if ($current >= 3) {
                $this->awardPoints($userId, 'streak_3_day', 'streak', '3', ['skip_weekly_update' => true]);
            }
            if ($current >= 7) {
                $this->awardPoints($userId, 'streak_7_day', 'streak', '7', ['skip_weekly_update' => true]);
            }
        }

        return ['current_streak_days' => $current, 'best_streak_days' => $best];
    }

    public function evaluateAchievements(int $userId): array
    {
        $this->ensureSchema();
        $definitions = $this->getAchievementDefinitions();
        $metrics = $this->collectMetrics($userId);

        $existingStmt = $this->pdo->prepare("SELECT achievement_id FROM user_achievements WHERE user_id = ?");
        $existingStmt->execute([$userId]);
        $existing = array_flip(array_map('intval', $existingStmt->fetchAll(PDO::FETCH_COLUMN)));

        $unlocked = [];
        foreach ($definitions as $definition) {
            $id = (int) $definition['id'];
            if (isset($existing[$id])) {
                continue;
            }
            $progress = (int) ($metrics[$definition['threshold_type']] ?? 0);
            if ($progress < (int) $definition['threshold_value']) {
                continue;
            }

            $this->pdo->prepare("
                INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, progress_value, metadata_json)
                VALUES (?, ?, UTC_TIMESTAMP(), ?, ?)
            ")->execute([
                $userId,
                $id,
                $progress,
                json_encode([
                    'code' => $definition['code'],
                    'title' => $definition['title']
                ], JSON_UNESCAPED_UNICODE)
            ]);

            $this->awardPoints($userId, 'achievement_unlocked', 'achievement', $definition['code'], [
                'points_override' => 0,
                'title' => $definition['title'],
                'description' => $definition['description'],
                'skip_evaluate' => true,
                'skip_weekly_update' => true
            ]);

            if ((int) $definition['points_reward'] > 0) {
                $this->awardPoints($userId, 'achievement_reward', 'achievement', $definition['code'], [
                    'points_override' => (int) $definition['points_reward'],
                    'title' => $definition['title'],
                    'skip_evaluate' => true,
                    'skip_weekly_update' => true
                ]);
            }
            $unlocked[] = $definition['code'];
        }

        return ['unlocked_count' => count($unlocked), 'unlocked_codes' => $unlocked];
    }

    public function getWeeklyTarget(int $userId): array
    {
        return $this->updateWeeklyTargetProgress($userId);
    }

    public function getChapterMastery(int $userId): array
    {
        $this->ensureSchema();
        $chapters = $this->pdo->query("SELECT id, title FROM chapters ORDER BY order_index ASC")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($chapters as $chapter) {
            $this->updateChapterMastery($userId, (int) $chapter['id']);
        }

        $stmt = $this->pdo->prepare("
            SELECT
                c.id AS chapter_id,
                c.title AS chapter_name,
                COALESCE(cm.chapter_points, 0) AS chapter_points,
                COALESCE(cm.completed_lessons, 0) AS completed_lessons,
                COALESCE(cm.completed_levels, 0) AS completed_levels,
                COALESCE(cm.mastery_rank, 'Beginner') AS mastery_rank,
                cm.updated_at
            FROM chapters c
            LEFT JOIN chapter_mastery cm
                ON cm.chapter_id = c.id
               AND cm.user_id = ?
            ORDER BY c.order_index ASC
        ");
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getRecentWins(int $userId, int $limit = 20): array
    {
        $this->ensureSchema();
        $limit = max(1, min(100, $limit));
        $stmt = $this->pdo->prepare("
            SELECT id, action_code, source_type, source_id, points_awarded, metadata_json, awarded_at
            FROM points_log
            WHERE user_id = ?
            ORDER BY awarded_at DESC, id DESC
            LIMIT {$limit}
        ");
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $wins = [];

        foreach ($rows as $row) {
            $meta = [];
            if (!empty($row['metadata_json'])) {
                $decoded = json_decode($row['metadata_json'], true);
                if (is_array($decoded)) {
                    $meta = $decoded;
                }
            }
            $message = $this->formatRecentWinMessage((string) $row['action_code'], (int) $row['points_awarded'], $meta);
            if ($message === null) {
                continue;
            }
            $wins[] = [
                'id' => (int) $row['id'],
                'action_code' => $row['action_code'],
                'points_awarded' => (int) $row['points_awarded'],
                'message' => $message,
                'awarded_at' => $row['awarded_at']
            ];
        }

        return $wins;
    }

    public function getAchievementsForUser(int $userId): array
    {
        $this->ensureSchema();
        $this->evaluateAchievements($userId);
        $definitions = $this->getAchievementDefinitions();
        $metrics = $this->collectMetrics($userId);

        $stmt = $this->pdo->prepare("
            SELECT achievement_id, unlocked_at, progress_value
            FROM user_achievements
            WHERE user_id = ?
        ");
        $stmt->execute([$userId]);
        $unlocked = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $unlocked[(int) $row['achievement_id']] = $row;
        }

        $items = [];
        foreach ($definitions as $def) {
            $id = (int) $def['id'];
            $progress = (int) ($metrics[$def['threshold_type']] ?? 0);
            $items[] = [
                'id' => $id,
                'code' => $def['code'],
                'title' => $def['title'],
                'description' => $def['description'],
                'icon' => $def['icon'],
                'category' => $def['category'],
                'points_reward' => (int) $def['points_reward'],
                'threshold_value' => (int) $def['threshold_value'],
                'threshold_type' => $def['threshold_type'],
                'sort_order' => (int) $def['sort_order'],
                'is_unlocked' => isset($unlocked[$id]),
                'unlocked_at' => $unlocked[$id]['unlocked_at'] ?? null,
                'progress_value' => isset($unlocked[$id]) ? (int) $unlocked[$id]['progress_value'] : $progress
            ];
        }
        return $items;
    }

    public function buildAchievementSummary(int $userId): array
    {
        $summary = $this->recalculateUserSummary($userId);
        $weekly = $this->updateWeeklyTargetProgress($userId);
        $achievements = $this->getAchievementsForUser($userId);
        $summary = $this->recalculateUserSummary($userId);
        $weekly = $this->updateWeeklyTargetProgress($userId);
        $chapterMastery = $this->getChapterMastery($userId);
        $recentWins = $this->getRecentWins($userId, 15);
        $rank = $this->calculateRank((int) $summary['total_points']);

        $progress = null;
        if ($rank['next_rank_min_points'] !== null) {
            $nextMin = (int) $rank['next_rank_min_points'];
            $progress = [
                'current_points' => (int) $summary['total_points'],
                'next_rank_points' => $nextMin,
                'percent' => $nextMin > 0 ? max(0, min(100, (int) floor(((int) $summary['total_points'] / $nextMin) * 100))) : 100
            ];
        }

        $unlockedCount = count(array_filter($achievements, static fn($a) => !empty($a['is_unlocked'])));
        $panda = $this->buildPandaSuggestion($summary, $weekly, $achievements);

        return [
            'total_points' => (int) $summary['total_points'],
            'current_rank' => $summary['current_rank'],
            'next_rank' => $rank['next_rank'],
            'points_to_next_rank' => (int) $rank['points_to_next_rank'],
            'rank_progress' => $progress,
            'total_lessons_completed' => (int) $summary['total_lessons_completed'],
            'total_levels_completed' => (int) $summary['total_levels_completed'],
            'total_quizzes_completed' => (int) $summary['total_quizzes_completed'],
            'total_active_minutes' => (int) $summary['total_active_minutes'],
            'current_streak_days' => (int) $summary['current_streak_days'],
            'best_streak_days' => (int) $summary['best_streak_days'],
            'badge_count_unlocked' => $unlockedCount,
            'weekly_target' => $weekly,
            'recent_wins' => $recentWins,
            'chapter_mastery' => $chapterMastery,
            'panda_suggestion' => $panda
        ];
    }

    private function processHierarchyCompletion(int $userId, int $levelId, int $chapterId): array
    {
        $points = 0;
        $levelTotal = (int) $this->singleValue("SELECT COUNT(*) FROM lessons WHERE level_id = ?", [$levelId]);
        $levelDone = (int) $this->singleValue("
            SELECT COUNT(*)
            FROM completed_lessons cl
            INNER JOIN lessons l ON l.id = cl.lesson_id
            WHERE cl.user_id = ? AND l.level_id = ?
        ", [$userId, $levelId]);

        if ($levelTotal > 0 && $levelDone >= $levelTotal) {
            $insLevel = $this->pdo->prepare("
                INSERT IGNORE INTO completed_levels (user_id, level_id, completed_at)
                VALUES (?, ?, UTC_TIMESTAMP())
            ");
            $insLevel->execute([$userId, $levelId]);
            if ($insLevel->rowCount() > 0) {
                $points += (int) $this->awardPoints($userId, 'level_completed', 'level', $levelId, [
                    'chapter_id' => $chapterId
                ])['points_awarded'];
            }
        }

        $chapterTotal = (int) $this->singleValue("
            SELECT COUNT(*)
            FROM lessons l
            INNER JOIN levels lv ON lv.id = l.level_id
            WHERE lv.chapter_id = ?
        ", [$chapterId]);
        $chapterDone = (int) $this->singleValue("
            SELECT COUNT(*)
            FROM completed_lessons cl
            INNER JOIN lessons l ON l.id = cl.lesson_id
            INNER JOIN levels lv ON lv.id = l.level_id
            WHERE cl.user_id = ? AND lv.chapter_id = ?
        ", [$userId, $chapterId]);

        if ($chapterTotal > 0 && $chapterDone >= $chapterTotal) {
            $insChapter = $this->pdo->prepare("
                INSERT IGNORE INTO completed_chapters (user_id, chapter_id, completed_at)
                VALUES (?, ?, UTC_TIMESTAMP())
            ");
            $insChapter->execute([$userId, $chapterId]);
            if ($insChapter->rowCount() > 0) {
                $points += (int) $this->awardPoints($userId, 'chapter_milestone_completed', 'chapter', $chapterId)['points_awarded'];
            }
        }

        return ['points_awarded' => $points];
    }

    private function collectMetrics(int $userId): array
    {
        $summaryStmt = $this->pdo->prepare("SELECT current_streak_days, best_streak_days FROM user_points WHERE user_id = ? LIMIT 1");
        $summaryStmt->execute([$userId]);
        $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC) ?: ['current_streak_days' => 0, 'best_streak_days' => 0];

        $metrics = [
            'lessons_completed_count' => (int) $this->singleValue("SELECT COUNT(*) FROM completed_lessons WHERE user_id = ?", [$userId]),
            'levels_completed_count' => (int) $this->singleValue("SELECT COUNT(*) FROM completed_levels WHERE user_id = ?", [$userId]),
            'chapters_completed_count' => (int) $this->singleValue("SELECT COUNT(*) FROM completed_chapters WHERE user_id = ?", [$userId]),
            'quizzes_completed_count' => (int) $this->singleValue("SELECT COUNT(*) FROM completed_quizzes WHERE user_id = ?", [$userId]),
            'current_streak_days' => (int) $summary['current_streak_days'],
            'best_streak_days' => (int) $summary['best_streak_days'],
            'streak_days' => (int) $summary['best_streak_days'],
            'total_active_minutes' => (int) floor((int) $this->singleValue("SELECT COALESCE(SUM(seconds_active), 0) FROM time_entries WHERE user_id = ?", [$userId]) / 60),
            'unique_chapters_completed' => (int) $this->singleValue("
                SELECT COUNT(DISTINCT lv.chapter_id)
                FROM completed_lessons cl
                INNER JOIN lessons l ON l.id = cl.lesson_id
                INNER JOIN levels lv ON lv.id = l.level_id
                WHERE cl.user_id = ?
            ", [$userId]),
            'weekly_wins_count' => (int) $this->singleValue("SELECT COUNT(*) FROM weekly_targets WHERE user_id = ? AND achieved_flag = 1", [$userId]),
            'retried_quiz_count' => (int) $this->singleValue("
                SELECT COUNT(DISTINCT qa.quiz_id)
                FROM quiz_attempts qa
                WHERE qa.user_id = ?
                  AND EXISTS (
                    SELECT 1 FROM quiz_attempts x WHERE x.user_id = qa.user_id AND x.quiz_id = qa.quiz_id AND x.is_correct = 0
                  )
                  AND EXISTS (
                    SELECT 1 FROM quiz_attempts y WHERE y.user_id = qa.user_id AND y.quiz_id = qa.quiz_id AND y.is_correct = 1
                  )
            ", [$userId]),
            'hard_lessons_completed_count' => (int) $this->singleValue("
                SELECT COUNT(*)
                FROM completed_lessons cl
                WHERE cl.user_id = ?
                  AND cl.lesson_id IN (
                    SELECT q.lesson_id FROM quizzes q GROUP BY q.lesson_id HAVING COUNT(*) >= 3
                  )
            ", [$userId]),
            'recommended_lessons_completed_count' => (int) $this->singleValue("
                SELECT COUNT(*) FROM points_log WHERE user_id = ? AND action_code = 'recommended_lesson_bonus'
            ", [$userId]),
            'returned_after_break_count' => (int) $this->singleValue("
                SELECT COUNT(*) FROM points_log WHERE user_id = ? AND action_code = 'return_after_inactivity'
            ", [$userId]),
            'panda_used_count' => 0
        ];

        try {
            $metrics['panda_used_count'] = (int) $this->singleValue("SELECT COUNT(*) FROM coach_events WHERE user_id = ?", [$userId]);
        } catch (\Throwable $e) {
            $metrics['panda_used_count'] = 0;
        }
        return $metrics;
    }

    private function ensureUsersPointsColumn(): void
    {
        $check = $this->pdo->query("SHOW COLUMNS FROM users LIKE 'points'");
        if (!$check->fetch(PDO::FETCH_ASSOC)) {
            $this->pdo->exec("ALTER TABLE users ADD COLUMN points INT NOT NULL DEFAULT 0");
        }
    }

    private function seedRankDefinitions(): void
    {
        if ((int) $this->singleValue("SELECT COUNT(*) FROM rank_definitions") > 0) {
            return;
        }

        $rows = [
            ['Seed', 0, 99, 1],
            ['Starter', 100, 249, 2],
            ['Explorer', 250, 499, 3],
            ['Achiever', 500, 899, 4],
            ['Rising Star', 900, 1499, 5],
            ['Champion', 1500, 2499, 6],
            ['Master Learner', 2500, null, 7]
        ];
        $stmt = $this->pdo->prepare("INSERT INTO rank_definitions (rank_name, min_points, max_points, sort_order) VALUES (?, ?, ?, ?)");
        foreach ($rows as $row) {
            $stmt->execute($row);
        }
        $this->rankCache = null;
    }

    private function seedAchievementDefinitions(): void
    {
        if ((int) $this->singleValue("SELECT COUNT(*) FROM achievement_definitions") > 0) {
            return;
        }

        $rows = [
            ['first_lesson_completed', 'First Lesson Completed', 'You completed your first lesson.', 'badge-lesson-1', 'completion', 20, 1, 'lessons_completed_count', 0, 10],
            ['five_lessons_completed', '5 Lessons Completed', 'You completed 5 lessons.', 'badge-lesson-5', 'completion', 30, 5, 'lessons_completed_count', 0, 20],
            ['ten_lessons_completed', '10 Lessons Completed', 'You completed 10 lessons.', 'badge-lesson-10', 'completion', 40, 10, 'lessons_completed_count', 0, 30],
            ['first_quiz_passed', 'First Quiz Passed', 'You passed your first quiz.', 'badge-quiz-1', 'completion', 20, 1, 'quizzes_completed_count', 0, 40],
            ['first_level_completed', 'First Level Completed', 'You completed your first level.', 'badge-level-1', 'completion', 35, 1, 'levels_completed_count', 0, 50],
            ['three_levels_completed', '3 Levels Completed', 'You completed 3 levels.', 'badge-level-3', 'completion', 45, 3, 'levels_completed_count', 0, 60],
            ['first_day_active', 'First Day Active', 'You were active today.', 'badge-day-1', 'consistency', 10, 1, 'best_streak_days', 0, 70],
            ['three_day_streak_badge', '3 Day Streak', 'You kept going for 3 days.', 'badge-streak-3', 'consistency', 30, 3, 'best_streak_days', 0, 80],
            ['seven_day_streak_badge', '7 Day Streak', 'You kept going for 7 days.', 'badge-streak-7', 'consistency', 50, 7, 'best_streak_days', 0, 90],
            ['ten_minutes_learned', '10 Minutes Learned', 'You spent 10 minutes learning.', 'badge-time-10m', 'time', 10, 10, 'total_active_minutes', 0, 100],
            ['one_hour_learner', '1 Hour Learner', 'You reached 1 hour of learning time.', 'badge-time-1h', 'time', 20, 60, 'total_active_minutes', 0, 110],
            ['tried_new_chapter', 'Tried a New Chapter', 'You explored a new chapter.', 'badge-chapter-new', 'exploration', 20, 1, 'unique_chapters_completed', 0, 120],
            ['three_chapter_explorer', '3 Chapters Explorer', 'You learned across 3 chapters.', 'badge-chapter-3', 'exploration', 35, 3, 'unique_chapters_completed', 0, 130],
            ['tried_again', 'Tried Again', 'You kept trying and got it right.', 'badge-resilience-try', 'resilience', 25, 1, 'retried_quiz_count', 0, 140],
            ['came_back_after_break', 'Came Back After a Break', 'You returned and continued learning.', 'badge-resilience-return', 'resilience', 25, 1, 'returned_after_break_count', 0, 150],
            ['first_weekly_goal', 'First Weekly Goal', 'You completed your first weekly target.', 'badge-weekly-1', 'weekly', 30, 1, 'weekly_wins_count', 0, 160]
        ];

        $stmt = $this->pdo->prepare("
            INSERT INTO achievement_definitions (
                code, title, description, icon, category, points_reward, threshold_value, threshold_type, is_repeatable, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())
        ");
        foreach ($rows as $row) {
            $stmt->execute($row);
        }
        $this->achievementCache = null;
    }

    private function ensureUserSummaryRow(int $userId): void
    {
        $this->pdo->prepare("
            INSERT IGNORE INTO user_points (
                user_id,
                total_points,
                current_rank,
                best_rank,
                current_streak_days,
                best_streak_days,
                total_lessons_completed,
                total_levels_completed,
                total_quizzes_completed,
                total_active_minutes,
                created_at,
                updated_at
            ) VALUES (?, 0, 'Seed', 'Seed', 0, 0, 0, 0, 0, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())
        ")->execute([$userId]);
    }

    private function ensureWeeklyTarget(int $userId): array
    {
        [$weekStart, $weekEnd] = $this->currentWeekRange();
        $this->pdo->prepare("
            INSERT IGNORE INTO weekly_targets (
                user_id, week_start, week_end, target_minutes, target_lessons, target_quizzes, reward_points, achieved_flag, created_at, updated_at
            ) VALUES (?, ?, ?, 90, 3, 1, 100, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())
        ")->execute([$userId, $weekStart, $weekEnd]);

        $stmt = $this->pdo->prepare("SELECT * FROM weekly_targets WHERE user_id = ? AND week_start = ? LIMIT 1");
        $stmt->execute([$userId, $weekStart]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new RuntimeException('Unable to load weekly target');
        }
        return $row;
    }

    private function currentWeekRange(): array
    {
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $weekday = (int) $now->format('N');
        $start = $now->modify('-' . ($weekday - 1) . ' days')->setTime(0, 0, 0);
        $end = $start->modify('+6 days')->setTime(23, 59, 59);
        return [$start->format('Y-m-d'), $end->format('Y-m-d')];
    }

    private function bootstrapLegacyPoints(int $userId): void
    {
        if ($this->legacyBootstrapRunning) {
            return;
        }
        $has = (int) $this->singleValue("SELECT COUNT(*) FROM points_log WHERE user_id = ?", [$userId]);
        if ($has > 0) {
            return;
        }
        $legacy = (int) $this->singleValue("SELECT COALESCE(points, 0) FROM users WHERE id = ?", [$userId]);
        if ($legacy <= 0) {
            return;
        }
        $this->legacyBootstrapRunning = true;
        try {
            $this->awardPoints($userId, 'legacy_import', 'system', 'legacy', [
                'points_override' => $legacy,
                'dedupe_mode' => 'once_user',
                'skip_evaluate' => true,
                'skip_weekly_update' => true
            ]);
        } finally {
            $this->legacyBootstrapRunning = false;
        }
    }

    private function actionConfig(string $actionCode): array
    {
        $map = [
            'session_start' => ['points' => 5, 'dedupe' => 'daily'],
            'lesson_completed' => ['points' => 25, 'dedupe' => 'once_source'],
            'quiz_completed' => ['points' => 15, 'dedupe' => 'once_source'],
            'quiz_correct' => ['points' => 5, 'dedupe' => 'once_source'],
            'level_completed' => ['points' => 80, 'dedupe' => 'once_source'],
            'chapter_milestone_completed' => ['points' => 150, 'dedupe' => 'once_source'],
            'weekly_target_achieved' => ['points' => 100, 'dedupe' => 'once_source'],
            'streak_3_day' => ['points' => 40, 'dedupe' => 'once_source'],
            'streak_7_day' => ['points' => 100, 'dedupe' => 'once_source'],
            'replay_improvement' => ['points' => 20, 'dedupe' => 'daily'],
            'first_lesson_of_day_bonus' => ['points' => 10, 'dedupe' => 'daily'],
            'recommended_lesson_bonus' => ['points' => 15, 'dedupe' => 'once_source'],
            'new_chapter_bonus' => ['points' => 20, 'dedupe' => 'once_source'],
            'return_after_inactivity' => ['points' => 15, 'dedupe' => 'daily'],
            'quick_win_completed' => ['points' => 10, 'dedupe' => 'daily'],
            'achievement_reward' => ['points' => 0, 'dedupe' => 'once_source'],
            'achievement_unlocked' => ['points' => 0, 'dedupe' => 'once_source'],
            'rank_up' => ['points' => 0, 'dedupe' => 'once_source'],
            'manual_points' => ['points' => 0, 'dedupe' => 'none'],
            'legacy_import' => ['points' => 0, 'dedupe' => 'once_user']
        ];
        return $map[$actionCode] ?? ['points' => 0, 'dedupe' => 'none'];
    }

    private function buildDedupeKey(string $actionCode, string $sourceType, $sourceId, string $mode): ?string
    {
        $sid = $this->stringOrNull($sourceId) ?? 'none';
        if ($mode === 'once_source') {
            return $actionCode . '|' . $sourceType . '|' . $sid;
        }
        if ($mode === 'once_user') {
            return $actionCode;
        }
        if ($mode === 'daily') {
            return $actionCode . '|' . gmdate('Y-m-d');
        }
        if ($mode === 'weekly') {
            return $actionCode . '|' . gmdate('o-\WW');
        }
        return null;
    }

    private function publicMetadata(array $metadata): array
    {
        foreach (['points_override', 'dedupe_mode', 'dedupe_key', 'skip_evaluate', 'skip_weekly_update', 'skip_summary'] as $key) {
            unset($metadata[$key]);
        }
        return $metadata;
    }

    private function getRankDefinitions(): array
    {
        if ($this->rankCache !== null) {
            return $this->rankCache;
        }
        $this->rankCache = $this->pdo->query("
            SELECT rank_name, min_points, max_points, sort_order
            FROM rank_definitions
            ORDER BY sort_order ASC
        ")->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return $this->rankCache;
    }

    private function getAchievementDefinitions(): array
    {
        if ($this->achievementCache !== null) {
            return $this->achievementCache;
        }
        $this->achievementCache = $this->pdo->query("
            SELECT *
            FROM achievement_definitions
            ORDER BY sort_order ASC, id ASC
        ")->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return $this->achievementCache;
    }

    private function rankSort(string $rankName): int
    {
        foreach ($this->getRankDefinitions() as $rank) {
            if ($rank['rank_name'] === $rankName) {
                return (int) $rank['sort_order'];
            }
        }
        return 0;
    }

    private function getMostRecentQualifyingDate(int $userId): ?string
    {
        $dates = $this->getQualifyingActivityDates($userId);
        return $dates[0] ?? null;
    }

    private function getQualifyingActivityDates(int $userId): array
    {
        $stmt = $this->pdo->prepare("
            SELECT DISTINCT day_key
            FROM (
                SELECT DATE(completed_at) AS day_key FROM completed_lessons WHERE user_id = ?
                UNION
                SELECT DATE(completed_at) AS day_key FROM completed_quizzes WHERE user_id = ?
                UNION
                SELECT date_key AS day_key
                FROM (
                    SELECT date_key, SUM(seconds_active) AS total_seconds
                    FROM time_entries
                    WHERE user_id = ?
                    GROUP BY date_key
                    HAVING SUM(seconds_active) >= 600
                ) t
            ) x
            ORDER BY day_key DESC
        ");
        $stmt->execute([$userId, $userId, $userId]);
        return array_values(array_filter($stmt->fetchAll(PDO::FETCH_COLUMN), static fn($d) => !empty($d)));
    }

    private function isFirstChapterLessonForUser(int $userId, int $chapterId): bool
    {
        $count = (int) $this->singleValue("
            SELECT COUNT(*)
            FROM completed_lessons cl
            INNER JOIN lessons l ON l.id = cl.lesson_id
            INNER JOIN levels lv ON lv.id = l.level_id
            WHERE cl.user_id = ?
              AND lv.chapter_id = ?
        ", [$userId, $chapterId]);
        return $count === 1;
    }

    private function chapterMasteryRank(int $points): string
    {
        if ($points >= 900) return 'Master';
        if ($points >= 500) return 'Explorer';
        if ($points >= 250) return 'Builder';
        if ($points >= 100) return 'Learner';
        return 'Beginner';
    }

    private function buildPandaSuggestion(array $summary, array $weekly, array $achievements): array
    {
        $remainingPoints = (int) ($summary['points_to_next_rank'] ?? 0);
        $remainingMinutes = max(0, (int) $weekly['target_minutes'] - (int) $weekly['progress_minutes']);
        $remainingLessons = max(0, (int) $weekly['target_lessons'] - (int) $weekly['progress_lessons']);
        $remainingQuizzes = max(0, (int) $weekly['target_quizzes'] - (int) $weekly['progress_quizzes']);

        if ((int) $weekly['achieved_flag'] === 0 && $remainingMinutes <= 20 && $remainingLessons <= 1 && $remainingQuizzes <= 1) {
            return [
                'message' => 'You are very close to your weekly goal. One short learning step can finish it.',
                'focus' => 'weekly_target',
                'next_hint' => 'Complete one lesson or quiz to reach this week\'s target.'
            ];
        }

        if ($remainingPoints > 0 && $remainingPoints <= 40 && !empty($summary['next_rank'])) {
            return [
                'message' => 'You are ' . $remainingPoints . ' points away from ' . $summary['next_rank'] . '.',
                'focus' => 'rank_progress',
                'next_hint' => 'Try one lesson or quiz to move up your rank.'
            ];
        }

        $locked = array_values(array_filter($achievements, static fn($a) => empty($a['is_unlocked'])));
        if ($locked) {
            usort($locked, static function ($a, $b) {
                $ar = ((int) $a['threshold_value']) > 0 ? ((int) $a['progress_value'] / (int) $a['threshold_value']) : 0;
                $br = ((int) $b['threshold_value']) > 0 ? ((int) $b['progress_value'] / (int) $b['threshold_value']) : 0;
                if ($ar === $br) {
                    return ((int) $a['sort_order']) <=> ((int) $b['sort_order']);
                }
                return $ar < $br ? 1 : -1;
            });
            $next = $locked[0];
            $need = max(0, (int) $next['threshold_value'] - (int) $next['progress_value']);
            return [
                'message' => 'Keep going. Your next badge is ' . $next['title'] . '.',
                'focus' => 'badge_progress',
                'next_hint' => $need > 0
                    ? 'Only ' . $need . ' more step(s) are needed for this badge.'
                    : 'You are very close to unlocking this badge.'
            ];
        }

        if ((int) $summary['current_streak_days'] === 0 && (int) $summary['best_streak_days'] > 0) {
            return [
                'message' => 'You paused your streak. Let us begin again today.',
                'focus' => 'streak_restart',
                'next_hint' => 'One completed lesson can restart your streak.'
            ];
        }

        return [
            'message' => 'Great progress. One short lesson today keeps your momentum strong.',
            'focus' => 'encouragement',
            'next_hint' => 'Choose one manageable next step and continue.'
        ];
    }

    private function formatRecentWinMessage(string $actionCode, int $points, array $meta): ?string
    {
        switch ($actionCode) {
            case 'lesson_completed': return 'You earned ' . $points . ' points for finishing a lesson.';
            case 'quiz_completed': return 'You earned ' . $points . ' points for completing a quiz.';
            case 'quiz_correct': return 'You earned ' . $points . ' points for a correct answer.';
            case 'level_completed': return 'You completed a level and earned ' . $points . ' points.';
            case 'chapter_milestone_completed': return 'You completed a chapter milestone and earned ' . $points . ' points.';
            case 'weekly_target_achieved': return 'You completed your weekly target and earned ' . $points . ' points.';
            case 'streak_3_day':
            case 'streak_7_day': return 'You reached a streak milestone and earned ' . $points . ' points.';
            case 'first_lesson_of_day_bonus': return 'You received a daily bonus of ' . $points . ' points.';
            case 'recommended_lesson_bonus': return 'You completed a recommended lesson and earned ' . $points . ' bonus points.';
            case 'new_chapter_bonus': return 'You explored a new chapter and earned ' . $points . ' bonus points.';
            case 'return_after_inactivity': return 'Welcome back. You earned ' . $points . ' points for returning.';
            case 'achievement_unlocked':
                return !empty($meta['title']) ? 'You unlocked the "' . $meta['title'] . '" badge.' : 'You unlocked a new badge.';
            case 'achievement_reward':
                return !empty($meta['title']) ? 'Badge reward: "' . $meta['title'] . '" gave you ' . $points . ' points.' : 'You earned ' . $points . ' points from a badge reward.';
            case 'rank_up':
                return !empty($meta['to_rank']) ? 'You reached the ' . $meta['to_rank'] . ' rank.' : 'You reached a new rank.';
            case 'quick_win_completed': return 'You finished a quick win and earned ' . $points . ' points.';
            case 'session_start': return 'You started learning today and earned ' . $points . ' points.';
            default: return $points > 0 ? 'You earned ' . $points . ' points.' : null;
        }
    }

    private function singleValue(string $sql, array $params = [])
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    private function stringOrNull($value): ?string
    {
        if ($value === null) {
            return null;
        }
        if (is_string($value)) {
            $trim = trim($value);
            return $trim === '' ? null : $trim;
        }
        return (string) $value;
    }
}
