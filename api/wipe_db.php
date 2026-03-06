<?php
// Connect without selecting the DB first to allow dropping it
$host = '127.0.0.1';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // 1. Drop and recreate database
    echo "Dropping database ndis_lms...\n";
    $pdo->exec("DROP DATABASE IF EXISTS ndis_lms");
    echo "Creating database ndis_lms...\n";
    $pdo->exec("CREATE DATABASE ndis_lms");
    $pdo->exec("USE ndis_lms");

    // 2. Read and execute schema.sql
    $schemaFile = __DIR__ . '/../db/schema.sql';
    if (!file_exists($schemaFile)) {
        die("Schema file not found at: $schemaFile\n");
    }

    $sql = file_get_contents($schemaFile);

    // MariaDB/MySQL doesn't always like multiple statements in one exec without special flags,
    // so let's split by semicolon or use a loop, OR use unbuffered queries.
    // Actually, PDO::exec CAN run multiple statements if emulated prepares are on or if the driver supports it.
    // But it's safer to split or just run it as one block if supported. Let's try one block.
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);

    echo "Applying schema.sql...\n";
    try {
        $pdo->exec($sql);
        echo "Schema applied successfully.\n";
    } catch (PDOException $e) {
        echo "Error applying schema: " . $e->getMessage() . "\n";
        // Let's try splitting if it failed
        $statements = array_filter(array_map('trim', explode(';', $sql)));
        foreach ($statements as $statement) {
            if (!empty($statement)) {
                try {
                    $pdo->exec($statement);
                } catch (Exception $e2) {
                    echo "Statement error: " . $e2->getMessage() . "\n";
                }
            }
        }
    }

} catch (PDOException $e) {
    echo "Connection error: " . $e->getMessage() . "\n";
}
