<?php
// Let's require index.php but spoof the SERVER request
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['REQUEST_URI'] = '/academy/api/learner/start_session.php';
$_SERVER['SCRIPT_NAME'] = '/academy/api/index.php';

// Now capture the output
ob_start();
require 'index.php';
$output = ob_get_clean();

echo "INDEX.PHP OUTPUT for start_session:\n";
echo $output;
echo "\n=====\n";
?>