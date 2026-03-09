<?php
$pdo = new PDO("mysql:host=localhost;dbname=ndis_lms;charset=utf8mb4", "root", "");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$row = $pdo->query("SHOW CREATE TABLE invoices")->fetch(PDO::FETCH_ASSOC);
print_r($row);
?>
