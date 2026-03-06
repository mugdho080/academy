<?php
$host = '127.0.0.1';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // 1. Find datadir
    $stmt = $pdo->query("SELECT @@datadir as dir");
    $datadir = $stmt->fetch()['dir'];
    $dbDir = $datadir . 'ndis_lms';

    // 2. Try normal drop
    echo "Attempting to drop database normally...\n";
    try {
        $pdo->exec("DROP DATABASE IF EXISTS ndis_lms");
    } catch (Exception $e) {
        echo "Normal drop failed: " . $e->getMessage() . "\n";
    }

    // 3. Force delete directory if exists
    if (is_dir($dbDir)) {
        echo "Directory $dbDir still exists. Force deleting contents...\n";
        $files = array_diff(scandir($dbDir), array('.', '..'));
        foreach ($files as $file) {
            $path = "$dbDir/$file";
            if (is_file($path)) {
                unlink($path);
                echo "Deleted $file\n";
            }
        }
        rmdir($dbDir);
        echo "Deleted directory $dbDir\n";
    }

    // 4. Recreate database
    echo "Creating database ndis_lms...\n";
    $pdo->exec("CREATE DATABASE ndis_lms");
    $pdo->exec("USE ndis_lms");

    // 5. Apply schema
    $schemaFile = __DIR__ . '/../db/schema.sql';
    if (!file_exists($schemaFile)) {
        die("Schema file not found at: $schemaFile\n");
    }

    $sql = file_get_contents($schemaFile);

    // Split schema into individual queries
    $statements = array_filter(array_map('trim', explode(';', $sql)));
    echo "Applying schema...\n";
    foreach ($statements as $statement) {
        if (!empty($statement)) {
            try {
                $pdo->exec($statement);
            } catch (Exception $e) {
                echo "Statement error on: " . substr($statement, 0, 50) . "... => " . $e->getMessage() . "\n";
            }
        }
    }
    echo "Schema applied successfully.\n";

} catch (PDOException $e) {
    echo "Connection error: " . $e->getMessage() . "\n";
}
