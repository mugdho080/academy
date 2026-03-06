fetch("http://localhost:5173/api/test_db5")
    .then(r => r.text())
    .then(console.log)
    .catch(console.error);
