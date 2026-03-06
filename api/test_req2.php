<?php
$result = file_get_contents('http://localhost/academy/api/check_corrupt.php');
file_put_contents('test_out2.txt', $result);
echo "Done";
