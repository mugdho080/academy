<?php
echo "CWD: " . getcwd() . "\n";
echo "DIR: " . __DIR__ . "\n";
$contentsPath = __DIR__ . '/../../contents';
echo "Contents Path: " . realpath($contentsPath) . "\n";

if (is_dir($contentsPath)) {
    echo "Files in contents:\n";
    print_r(scandir($contentsPath));
} else {
    echo "Contents dir not found via relative path.\n";
}
