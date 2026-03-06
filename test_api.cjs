const http = require('http');

const options = {
    hostname: 'localhost',
    port: 80,
    path: '/academy/api/admin/add_level_json',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Body:", body);
    });
});

req.on('error', error => console.error(error));
req.write(JSON.stringify({ chapter_id: 1, level: {} }));
req.end();
