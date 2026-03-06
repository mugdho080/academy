<?php
// learner/chapters.php
// Returns chapters with their levels


// learner/chapters.php
// Returns chapters with their levels

require_once __DIR__ . '/../db_connect.php';

$stmt = $pdo->query("SELECT * FROM chapters ORDER BY order_index ASC");
$chapters = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($chapters as &$chapter) {
    $stmt = $pdo->prepare("SELECT * FROM levels WHERE chapter_id = ? ORDER BY order_index ASC");
    $stmt->execute([$chapter['id']]);
    $chapter['levels'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

echo json_encode($chapters);
?>