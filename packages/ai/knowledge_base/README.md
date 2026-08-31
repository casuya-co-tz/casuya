# Tanzania Knowledge Base

Optimized structured knowledge base for Tanzanian secondary education (Form 1-6) covering TIE syllabi, NECTA exams, schemes of work, lesson plans, and exam formats.

## Structure

```
knowledge_base/
├── index.json                      # Master index (fast lookup, 600KB)
├── syllabi/
│   ├── o_level/                    # 11 O-Level subjects (Form 1-4)
│   │   ├── *.json                  # Parsed syllabus (units, topics, lessons)
│   │   └── pdfs/                   # 11 original TIE PDFs
│   └── a_level/                    # 14 A-Level subjects (Form 5-6)
│       ├── *.json
│       └── pdfs/                   # 14 original TIE PDFs
├── exams/
│   ├── ftna/                       # 259 FTNA exams (Form 2)
│   ├── csee/                       # 242 CSEE exams (Form 4)
│   ├── acsee/                      # 57 ACSEE exams (Form 6)
│   ├── internal/                   # 1,840 school exams (20 per form per subject)
│   │   ├── form1/ (320) form2/ (320) form3/ (320) form4/ (320) form5/ (280) form6/ (280)
│   │   └── topics: topical 8 + midterm1 4 + midterm2 4 + terminal 2 + annual 2 + NECTA pilot 20
│   └── pdfs/                       # 228 original NECTA PDFs (Maktaba TETEA)
├── schemes/
│   ├── form1/ (20) form2/ (20) form3/ (14) form4/ (12) form5/ (14)  # Schemes of work
├── lessons/
│   ├── form1/ (9) form2/ (9) form3/ (10) form4/ (10) form5/ (16) form6/ (16)  # Lesson plans
├── exam_formats/
│   ├── *.pdf                       # 5 NECTA format PDFs (CSEE 2022, ACSEE 2019, FTNA 2022/2026, Vocational 2025)
│   ├── parsed/                     # 5 parsed JSON (146 subjects)
│   ├── templates/                  # 14 pilot templates (7 HTML +7 JSON)
│   └── index.json
├── marking_schemes/
│   ├── BIOLOGY_CSEE_MARKING_SCHEME_2026.html/json  # Sample 033 Biology (100 marks)
│   └── *MARKING_2026.html/json     # 14 marking schemes (Physics/Chemistry/Biology/Math pilots)
└── references/
    ├── syllabus_references.json    # 625 syllabus bibliography entries
    └── tie_official_textbooks.json # 113 TIE textbooks (APA)
```

## Usage

```python
import json

# Fast lookup via index
idx = json.load(open("knowledge_base/index.json"))
print(idx["exams"]["internal"][:2])

# Load specific syllabus
bio = json.load(open("knowledge_base/syllabi/o_level/biology_olevel.json"))
print(bio["units"][0]["topics"][0])

# Load internal exam (NECTA pilot style)
exam = json.load(open("knowledge_base/exams/internal/form1/physics_form1_necta_pilot_01_2026.json"))
print(exam["sections"][0]["questions"][0])  # MCQ i-x with answer boxes

# Load marking scheme
mark = json.load(open("knowledge_base/marking_schemes/BIOLOGY_CSEE_MARKING_SCHEME_2026.json"))
print(mark["sections"][0])
```

## Exam Formats

- **FTNA (Form 2)**: 2:30 Hours, 10 Qs, 15/70/15 marks, Sections A (MCQ+Matching) B (structured) C (15)
- **CSEE (Form 4)**: 3:00 Hours, 11 Qs (A 16, B 54, C 30) or 14 Qs Basic Math 60/40
- **ACSEE (Form 6)**: 3:00 Hours, 7-11 Qs per subject
- Pilot templates: `exam_formats/templates/PHYSICS_F2_NECTA_PILOT_2026.html` etc. with SVG diagrams

## Performance

- Full KB: 2,579 JSON files, ~11 MB, median 0.56s full parse (0.22 ms/file)
- Via `index.json`: 1.3 ms to locate any file (lazy load)

## Sources

- TIE Syllabi 2023-2025 (25 PDFs)
- NECTA Formats 2022-2026 (5 PDFs)
- Maktaba TETEA past papers (228 PDFs)
- LearningHubTZ reviews (345 exams)
- Generated internal exams: syllabus-driven, NECTA pilot rubrics

## Version

- v1.10 - Added marking schemes, Form5/6 lessons, PDFs, templates
