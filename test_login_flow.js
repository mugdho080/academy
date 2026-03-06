const fs = require('fs');

async function run() {
    const startRes = await fetch("http://localhost:5173/api/learner/start_session.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
    });

    const startText = await startRes.text();
    fs.writeFileSync('output.json', startText);
    console.log("Wrote the raw API 404 response to output.json");
}
run();
