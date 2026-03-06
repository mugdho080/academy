<?php
// api/ai/chat.php
require_once __DIR__ . '/../db_connect.php';

$data = json_decode(file_get_contents('php://input'), true);
$userMessage = $data['message'] ?? '';

// WARNING: DO NOT COMMIT REAL API KEY TO REPO
$apiKey = 'AIzaSyBh-jDANoAg3ta-ulDQLkmahoh29ua7g4s'; // Provided by user

if ($apiKey === 'YOUR_GEMINI_API_KEY') {
    // ... (This block will now be skipped)
}

$systemPrompt = "You are a friendly, encouraging AI Buddy named 'Gemini Friend' for a special education learning platform.
- You are talking to a student.
- Your personality is cute, cheerful, and patient.
- Keep your answers VERY short (max 2 sentences) and easy to read.
- Use simple words and lots of emojis 🌟 🐢 💖.
- If asked about the lesson, try to explain it simply based on the context provided.
- Sound like a supportive friend, not a robot.";

$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . $apiKey;

$payload = [
    "contents" => [
        [
            "role" => "user",
            "parts" => [
                ["text" => $systemPrompt . "\n\nUser says: " . $userMessage]
            ]
        ]
    ]
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    $result = json_decode($response, true);
    $reply = $result['candidates'][0]['content']['parts'][0]['text'] ?? "I'm a little sleepy right now, can we talk again in a second? 🐨✨";
} else {
    $reply = "I'm having a little trouble connecting to my brain! Let's try again in a bit. 🌈";
}

echo json_encode(['reply' => $reply]);
?>