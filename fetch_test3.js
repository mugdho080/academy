fetch("http://localhost/academy/test_db.php")
    .then(r => r.text())
    .then(console.log)
    .catch(console.error);
