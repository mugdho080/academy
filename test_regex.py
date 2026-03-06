
import re

lines = [
    "1. AI is like:🤔 A person with feelings🤖 A helpful robot in your device ✔🎈 A balloon",
    "2. Can AI get sad or angry?😭 Yes😎 No ✔",
    "3. Which one uses AI?📱 Google Maps ✔🍔 A cheeseburger🧹 A broom",
    "3. Is your camera's auto-brighten AI?✔ Yes○ No",
    "1. Which one is a strong password?🐶 Dog123🦁 RedLion#34 ✔🎂 1998",
    "2. Someone sends you a weird link. What do you do?👉 Click it fast👉 Send it to everyone👉❌ Ask for help or delete ✔"
]

def parse_inline_quiz_question(line):
    print(f"\nProcessing: {line}")
    
    # Relaxed detection: ? or :
    if not (re.match(r'^\d+\.', line) and ("?" in line or ":" in line)):
        print("SKIPPED: Not a question")
        return

    # Split by ? first, if not then :
    if "?" in line:
        parts = line.split("?", 1)
        prompt = parts[0].strip() + "?"
        remaining = parts[1].strip()
    elif ":" in line:
        parts = line.split(":", 1)
        prompt = parts[0].strip() + ":"
        remaining = parts[1].strip()
    else:
        print("ERROR: Should not happen")
        return

    prompt = re.sub(r'^\d+\.\s*', '', prompt)
    print(f"Prompt: {prompt}")
    print(f"Remaining: {remaining}")

    options = []
    
    # Tokenization logic
    # Split by unicode char categories? Or just simple regex for "non-word + text"
    # The delimiters are emojis or symbols: 🤔, 🤖, 🎈, 😭, 😎, 📱, 🍔, 🧹, ✔, ○, 👉, ❌
    
    # Logic: Iterating and detecting "Start of option"
    # Start of option = Emoji/Symbol that is NOT a checkmark used for correctness
    
    # We can try to split by a regex that matches emojis
    # But python re doesn't support \p{Emoji} easily without regex module.
    # We can use the logic "If char is not alphanumeric and not standard punctuation"
    
    tokens = []
    current_token = ""
    
    # Custom split
    chars = list(remaining)
    for c in chars:
        # Check if C is a likely delimiter (Emoji or special symbol)
        # Exclude space, dot, comma, #, checkmark, question mark, specific chars
        is_delimiter = not c.isalnum() and c not in [" ", ".", ",", "#", "-", "'", '"', "(", ")", "’", "“", "”"]
        
        # Checkmark "✔" is a suffix, so treat it as part of content, NOT a start delimiter
        if c == "✔": is_delimiter = False
        
        if is_delimiter:
            if current_token.strip():
                tokens.append(current_token.strip())
            current_token = c # Start new token with the delimiter
        else:
            current_token += c
    
    if current_token.strip():
        tokens.append(current_token.strip())

    # Now verify correctness
    questions_opts = []
    correct_idx = -1
    
    for i, opt in enumerate(tokens):
        is_correct = "✔" in opt
        clean_opt = opt.replace("✔", "").strip()
        questions_opts.append(clean_opt)
        if is_correct:
            correct_idx = i
            
    print(f"Options: {questions_opts}")
    print(f"Correct Index: {correct_idx}")

for l in lines:
    parse_inline_quiz_question(l)
