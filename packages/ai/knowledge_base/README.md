# Tanzania Knowledge Base

Optimized structured knowledge base for Tanzanian secondary education (Form 1-6) covering TIE syllabi, NECTA exams, schemes of work, lesson plans, and exam formats for **Mathematics (Basic & Advanced), Chemistry, and Physics**.

## Structure

```
knowledge_base/
├── index.json                      # Master index (fast lookup)
├── syllabi/
│   ├── o_level/                    # 4 subjects (Form 1-4): Basic Mathematics, Chemistry, Mathematics, Physics
│   │   └── *.json                  # Parsed syllabus (units, topics, lessons)
│   └── a_level/                    # 3 subjects (Form 5-6): Chemistry, Mathematics (Advanced), Physics
│       └── *.json
├── exams/
│   ├── ftna/                       # 69 FTNA exams (Form 2)
│   ├── csee/                       # 56 CSEE exams (Form 4)
│   ├── acsee/                      # 16 ACSEE exams (Form 6)
│   └── internal/                   # 360 school exams (per form per subject: chemistry, mathematics, physics)
├── schemes/
│   └── form1/ (6) form2/ (7) form3/ (4) form4/ (3) form5/ (3)   # Schemes of work
├── lessons/
│   └── form1/ (3) form2/ (3) form3/ (3) form4/ (3) form5/ (3) form6/ (3)   # Lesson plans
├── exam_formats/
│   ├── parsed/                     # 5 parsed NECTA format books (13 kept-subject entries)
│   ├── templates/                  # 20 pilot templates (10 JSON + 10 HTML)
│   └── index.json
├── marking_schemes/
│   └── *MARKING_2026.html/json     # 10 marking schemes (5 JSON + 5 HTML: Chemistry/Mathematics/Physics)
└── references/
    ├── syllabus_references.json    # syllabus bibliography entries
    └── tie_official_textbooks.json # TIE textbooks (APA)
```

## Usage

```python
import json

# Fast lookup via index
idx = json.load(open("knowledge_base/index.json"))
print(idx["syllabi"]["o_level"])

# Load specific syllabus
phys = json.load(open("knowledge_base/syllabi/o_level/physics_f1_f4.json"))
print(phys["units"][0]["topics"][0])

# Load internal exam (NECTA pilot style)
exam = json.load(open("knowledge_base/exams/internal/physics/physics_form1_necta_pilot_01_2026.json"))
print(exam["sections"][0]["questions"][0])

# Load marking scheme
mark = json.load(open("knowledge_base/marking_schemes/PHYSICS_CSEE_MARKING_2026.json"))
print(mark["sections"][0])
```

## Exam Formats

- **FTNA (Form 2)**: 2:30 Hours, 10 Qs, 15/70/15 marks, Sections A (MCQ+Matching) B (structured) C (15)
- **CSEE (Form 4)**: 3:00 Hours, 8 Qs (A 16, B 54, C 30) or 14 Qs Basic Math 60/40
- **ACSEE (Form 6)**: 3:00 Hours, 7-11 Qs per subject
- Pilot templates: `exam_formats/templates/PHYSICS_F2_NECTA_PILOT_2026.html` etc. with SVG diagrams

## Performance

- Full KB: 574 JSON files, built via `node scripts/build-kb.mjs` → `kb-data/index.json` (+`knowledge.tar.gz`)
- Runtime loads the single index once at boot for sub-ms keyword retrieval and instant RAG chunk rendering

## Sources

- TIE Syllabi 2019-2025
- NECTA Formats 2019-2026
- Maktaba TETEA past papers
- LearningHubTZ reviews
- Generated internal exams: syllabus-driven, NECTA pilot rubrics