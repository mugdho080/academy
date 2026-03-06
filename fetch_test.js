const http = require('http');

http.get('http://localhost:5173/api/test_db5', (resp) => {
    let data = '';

    resp.on('data', (chunk) => {
        data += chunk;
    });

    resp.on('end', () => {
        console.log(data);
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
