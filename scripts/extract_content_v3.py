
import zipfile
import xml.etree.ElementTree as ET
import json
import re
import sys
import os

def get_docx_text(docx_path):
    try:
        with zipfile.ZipFile(docx_path) as z:
            xml_content = z.read('word/document.xml')
    except:
        print(f"Error reading docx: {docx_path}")
        return []

    tree = ET.fromstring(xml_content)
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    paragraphs = []
    
    for p in tree.iter(f'{{{ns["w"]}}}p'):
        texts = [node.text for node in p.iter(f'{{{ns["w"]}}}t') if node.text]
        if texts:
            full_text = ''.join(texts)
            paragraphs.append(full_text)
            
    return paragraphs

def clean_text(text):
    return text.strip().replace('“', '"').replace('”', '"').replace('’', "'").replace('–', '-').replace('—', '-')

def parse_content(file_path):
    lines = get_docx_text(file_path)
    
    structure = {
        "source_document_name": os.path.basename(file_path),
        "chapters": [],
        "warnings": []
    }
    
    current_chapter = None
    current_level = None
    current_lesson = None
    current_quiz = None
    
    def attach_lesson_if_valid(level, lesson):
        if not lesson: return
        has_body = len(lesson["lesson_body"]["paragraphs"]) > 0 or len(lesson["lesson_body"]["bullets"]) > 0
        has_quiz = len(lesson["quizzes"]) > 0
        if has_body or has_quiz:
            if "_last_header" in lesson: del lesson["_last_header"]
            existing = next((l for l in level["lessons"] if l["lesson_number"] == lesson["lesson_number"]), None)
            if existing:
                if existing["lesson_title"] != lesson["lesson_title"] and "Interactive" in lesson["lesson_title"]:
                     existing["lesson_title"] = lesson["lesson_title"]
                
                # Check for reference identity to avoid self-merge
                if existing is not lesson: 
                    existing["lesson_body"]["paragraphs"].extend(lesson["lesson_body"]["paragraphs"])
                    existing["lesson_body"]["bullets"].extend(lesson["lesson_body"]["bullets"])
                    existing["quizzes"].extend(lesson["quizzes"])
                    if lesson["mini_activity"]: existing["mini_activity"] = lesson["mini_activity"]
                    if lesson["fun_reminder"]: existing["fun_reminder"] = lesson["fun_reminder"]
            else:
                level["lessons"].append(lesson)

    def parse_inline_quiz_question(line, quiz_obj):
        # Check if this line looks like a question
        # Must start with number and contain ? or :
        if not (re.match(r'^\d+\.', line) and ("?" in line or ":" in line)):
            return False

        # 1. Split by question mark or colon to get prompt
        if "?" in line:
            parts = line.split("?", 1)
            prompt = parts[0].strip() + "?"
            remaining = parts[1].strip()
        elif ":" in line:
            parts = line.split(":", 1)
            prompt = parts[0].strip() + ":"
            remaining = parts[1].strip()
        else:
            return False
        
        # Remove numbers from prompt
        prompt = re.sub(r'^\d+\.\s*', '', prompt)

        question = {
            "prompt": prompt,
            "options": [],
            "correct_index": -1, 
            "explanation": ""
        }
        
        # 2. Tokenize options based on Emoji/Symbol delimiters
        tokens = []
        current_token = ""
        chars = list(remaining)
        
        for c in chars:
            # Check if C is a likely delimiter (Emoji or special symbol)
            # Exclude space, dot, comma, #, checkmark, question mark, brackets, quotes
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

        # If no tokens found, it might be a single line answer or failed parse
        if not tokens and remaining:
             tokens = [remaining]

        for i, opt in enumerate(tokens):
            is_correct = "✔" in opt
            clean_opt = opt.replace("✔", "").strip()
            question["options"].append(clean_opt)
            if is_correct:
                question["correct_index"] = i
        
        # Only add if we actually found options or if it's a valid open question?
        # Assuming all quizzes here have options
        if len(question["options"]) > 0:
            quiz_obj["questions"].append(question)
            return True
            
        return False


    for line in lines:
        line = clean_text(line)
        if not line: continue
        
        # Module
        if re.search(r'^Module\s+\d+', line, re.IGNORECASE):
            attach_lesson_if_valid(current_level, current_lesson)
            mod_num = int(re.search(r'\d+', line).group())
            current_chapter = { "module_number": mod_num, "chapter_key": f"module_{mod_num}", "chapter_title": "", "chapter_icon": "📚", "levels": [] }
            structure["chapters"].append(current_chapter)
            current_level = None
            current_lesson = None
            continue

        if current_chapter and not current_chapter["chapter_title"] and not line.startswith("Level"):
             if "Level" in line:
                 parts = line.split("Level")
                 current_chapter["chapter_title"] = parts[0].strip(" -–")
             else:
                 current_chapter["chapter_title"] = line
                 continue
        
        # Level
        if "Level" in line and not line.startswith("Module"):
            attach_lesson_if_valid(current_level, current_lesson)
            match = re.search(r'Level\s+(\d+)', line, re.IGNORECASE)
            if match:
                level_num = int(match.group(1))
                current_level = { "level_number": level_num, "level_title": line, "youtube_url": None, "lessons": [] }
                if current_chapter: current_chapter["levels"].append(current_level)
                current_lesson = None
                continue

        # Lesson
        lesson_match = re.search(r'(?:🎉\s*)?Lesson\s+(\d+)', line, re.IGNORECASE)
        if lesson_match:
            attach_lesson_if_valid(current_level, current_lesson)
            l_num = int(lesson_match.group(1))
            raw_title = re.sub(r'(?:🎉\s*)?Lesson\s+\d+\s*[-—–:]?\s*', '', line, flags=re.IGNORECASE).strip()
            
            existing = None
            if current_level: existing = next((l for l in current_level["lessons"] if l["lesson_number"] == l_num), None)
            
            if existing:
                current_lesson = existing
                if "Fun & Interactive" in raw_title: existing["lesson_title"] = raw_title
            else:
                new_lesson = { 
                    "lesson_number": l_num, "lesson_title": raw_title, "lesson_format": "standard", 
                    "lesson_body": { "paragraphs": [], "bullets": [] }, "mini_activity": "", "fun_reminder": "", "quizzes": [] 
                }
                if current_level: current_level["lessons"].append(new_lesson)
                current_lesson = new_lesson
            current_quiz = None
            continue

        if current_lesson:
            # Inline Quiz Question Detection
            if re.match(r'^\d+\.', line):
                # Check/Create Quiz Container
                if len(current_lesson["quizzes"]) == 0:
                    current_lesson["quizzes"].append({ "quiz_title": "Quiz", "questions": [] })
                
                # Attempt to parse as quiz
                is_quiz = parse_inline_quiz_question(line, current_lesson["quizzes"][-1])
                
                if is_quiz:
                    continue
                # If returns False, it falls through to content parsing (it's just a numbered list)
            
            # Content Parsing
            if "Mini-Activity" in line:
                val = line.split(":", 1)[-1].strip()
                current_lesson["mini_activity"] = val
                current_lesson["_last_header"] = "Mini-Activity"
            elif "Fun Reminder" in line:
                val = line.split(":", 1)[-1].strip()
                current_lesson["fun_reminder"] = val
                current_lesson["_last_header"] = "Fun Reminder"
            elif line.startswith("✔") or line.startswith("•") or line.startswith("- "):
                 current_lesson["lesson_body"]["bullets"].append(line)
            else:
                 if current_lesson.get("_last_header") == "Mini-Activity":
                     current_lesson["mini_activity"] += " " + line
                 elif current_lesson.get("_last_header") == "Fun Reminder":
                     current_lesson["fun_reminder"] += " " + line
                 else:
                     current_lesson["lesson_body"]["paragraphs"].append(line)
                     current_lesson["_last_header"] = ""

    attach_lesson_if_valid(current_level, current_lesson)
    return structure

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_content_v3.py <docx_path>")
        sys.exit(1)
    fpath = sys.argv[1]
    data = parse_content(fpath)
    out_path = os.path.join(os.path.dirname(fpath), "final_v3_content.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Extraction complete. JSON saved to {out_path}")
