
import xml.etree.ElementTree as ET
import json
import re
import os

namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def get_text_from_xml(xml_path):
    print(f"Reading {xml_path}...")
    try:
        tree = ET.parse(xml_path)
    except Exception as e:
        print(f"Error: {e}")
        return []
    root = tree.getroot()
    body = root.find('w:body', namespaces)
    content = []
    for p in body.findall('w:p', namespaces):
        text_elems = p.findall('.//w:t', namespaces)
        text = "".join([t.text for t in text_elems if t.text])
        if text.strip():
            content.append(text.strip())
    return content

def parse_lines(lines, default_chapter="AI & Digital Skills"):
    chapters = {} 
    
    current_chapter = default_chapter
    current_level = 1
    current_lesson = None
    current_quiz = None
    capture_quiz = False
    
    # Initialize default chapter
    if current_chapter not in chapters:
        chapters[current_chapter] = {}
        
    for i, line in enumerate(lines):
        # Detect Chapter/Module
        # "Module 2" or "Maths & Numbers Level 1"
        mod_match = re.match(r"Module\s+(\d+)", line, re.IGNORECASE)
        if mod_match:
            # Look ahead for title
            next_line = lines[i+1] if i+1 < len(lines) else ""
            # Heuristic: Title is next line
            # Clean title
            clean_title = next_line.replace("Level 1", "").strip()
            if clean_title:
                current_chapter = clean_title
                if current_chapter not in chapters:
                    chapters[current_chapter] = {}
                current_level = 1 # Reset to Level 1 for new module
                current_lesson = None # Reset lesson
            continue

        # Detect Lesson
        lesson_match = re.search(r"Lesson\s+(\d+)\s*[—\-]\s*(.+)", line, re.IGNORECASE)
        # Also handle "Lesson 1 Knowing Myself" (no dash)
        if not lesson_match:
             lesson_match = re.search(r"Lesson\s+(\d+)\s+(.+)", line, re.IGNORECASE)

        if lesson_match and "QUIZ" not in line and "covered" not in line and "Content" not in line:
            # Save previous lesson
            if current_lesson:
                if current_level not in chapters[current_chapter]:
                    chapters[current_chapter][current_level] = []
                chapters[current_chapter][current_level].append(current_lesson)
            
            title = lesson_match.group(2).replace("(Fun & Interactive)", "").strip()
            current_lesson = {
                "number": int(lesson_match.group(1)),
                "title": title,
                "content": "",
                "quizzes": []
            }
            capture_quiz = False
            continue

        # Detect Quiz
        if "QUIZ" in line and ("Level" in line or "Lesson" in line):
            capture_quiz = True
            continue

        if current_lesson:
            if capture_quiz:
                # Question detection
                # "1. ..." or "Question 1"
                q_match = re.match(r"^(\d+)\.\s*(.+)", line)
                if q_match:
                    current_quiz = {
                        "question": q_match.group(2),
                        "options": [],
                        "correct": 0
                    }
                    current_lesson["quizzes"].append(current_quiz)
                elif current_quiz:
                    if len(line.strip()) < 2: continue
                    is_correct = "✔" in line
                    opt_text = line.replace("✔", "").strip()
                    # Remove "A. ", "B. ", "○ "
                    opt_text = re.sub(r"^[A-Z]\.\s*", "", opt_text)
                    opt_text = re.sub(r"^[○•]\s*", "", opt_text)
                    
                    if opt_text:
                        current_quiz["options"].append(opt_text)
                        if is_correct:
                            current_quiz["correct"] = len(current_quiz["options"]) - 1
            else:
                 if not line.startswith("Lesson") and "QUIZ" not in line and "Module" not in line:
                    current_lesson["content"] += line + "\n"

    # Save last lesson
    if current_lesson:
        if current_level not in chapters[current_chapter]:
            chapters[current_chapter][current_level] = []
        chapters[current_chapter][current_level].append(current_lesson)
        
    return chapters

base_dir = "c:/Users/user/Downloads/academy"
lines1 = get_text_from_xml(f'{base_dir}/temp_level1_extracted/word/document.xml')
lines2 = get_text_from_xml(f'{base_dir}/temp_level2_extracted/word/document.xml')

# Parse
all_data = {}

# File 1 is explicitly AI & Digital Skills Level 1
chapters1 = parse_lines(lines1, "AI & Digital Skills")
all_data.update(chapters1)

# File 2 contains others
chapters2 = parse_lines(lines2, "Maths & Numbers") # Default if not found
all_data.update(chapters2)

# Reformat for JSON export
export_list = []
for chap_title, levels in all_data.items():
    if not levels: continue
    for lvl_num, lessons in levels.items():
        export_list.append({
            "chapter_title": chap_title,
            "level_number": lvl_num,
            "lessons": lessons
        })

output_path = f'{base_dir}/final_content.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(export_list, f, indent=2, ensure_ascii=False)

print(f"Saved to {output_path}")
for item in export_list:
    print(f"Chapter: {item['chapter_title']}, Level: {item['level_number']}, Lessons: {len(item['lessons'])}")
