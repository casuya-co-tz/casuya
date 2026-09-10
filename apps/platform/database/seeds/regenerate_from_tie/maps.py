"""Enrichment maps (ENGLISH / KISWAHILI) and the sparser competency-pool
subject maps (Mathematics, Chemistry, Biology).

The KB O-Level JSON for English/Kiswahili collapsed all Forms 1-4 into a
single pool of competency units (no per-form signal), so we keep the curated
per-form "skeleton" topics (preserving form distribution + period totals) and
inject every authentic KB competence lesson into the best-matching seed
topic. Keys are the exact ``_clean()``-ed competence (topic_name) from the KB;
values are the exact seed topic title to enrich. A-Level is never touched.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Enrichment maps (ENGLISH / KISWAHILI)
# ---------------------------------------------------------------------------
ENGLISH_TOPIC_MAP = {
    "Read texts for comprehension": "Reading for Comprehension (Part I)",
    "Comprehend oral messages with increasing difficulty": "Listening and Speaking (Oral Communication)",
    "Respond appropriately in a variety of oral and written communication contexts": "Reading for Fluency and Critical Inference",
    "Construct meaning from a variety of texts": "Complex Reading and Summary Compilations",
    "Use ICT tools to search for information from different sources": "Reading for Fluency and Critical Inference",
    "Organise information obtained from different sources": "Complex Reading and Summary Compilations",
    ". Develop listening skills": "Listening and Speaking (Oral Communication)",
    "Develop listening skills": "Listening and Speaking (Oral Communication)",
    "Produce short and coherent oral messages with intelligible pronunciation and fluency": "Spoken English and Debate Mechanics",
    "Use appropriate grammar and vocabulary for oral communication in a variety of contexts": "Spoken English and Debate Mechanics",
    "Use appropriate grammar and vocabulary in oral and in written language tasks": "Grammar Patterns (Part I)",
    "Develop vocabulary from conversations and written texts": "Vocabulary Building and Expressions",
    "Create a variety of texts for different communicative purposes using the appropriate tone and register": "Writing Skills (Part I)",
    "Conduct a socio- cultural analysis of functional texts": "Professional and Academic Writing",
    "Apply principles of editing and proofreading in a variety of texts": "Translation and Interpretation Fundamentals",
    "Apply principles of interpretation to provide simple authentic interpretations": "Translation and Interpretation Fundamentals",
    "Apply principles of translation to produce simple authentic translation": "Translation and Interpretation Fundamentals",
    "Manage short translation and editing projects using Computer- Assisted Tools": "Translation and Interpretation Fundamentals",
    "Appreciate the aesthetics and value of literature": "Introduction to Literature",
    "Evaluate the context in which literary texts are written, read and understood": "Introduction to Literary Analysis",
    "Analyse genres of literature and appreciate their conventions": "Literary Critique: Selected Plays",
    "Create simple literary works": "Creative and Digital Writing",
}

KISWAHILI_TOPIC_MAP = {
    "Kutambua Kiswahili kama kielelezo cha utaifa na utambulisho wa Mtanzania": "Dhana ya Lugha na Mawasiliano",
    "Kukuza uelewa wa sarufi ya Kiswahili": "Sarufi ya Kiswahili: Sauti na Maneno",
    "Kusikiliza na kuelewa mazungumzo": "Ustadi wa Kusikiliza na Kuzungumza",
    "Kuwasiliana kwa ufasaha kwa njia ya mazungumzo": "Ustadi wa Kusikiliza na Kuzungumza",
    "Kusoma matini kwa ufasaha na ufahamu": "Ustadi wa Kusoma",
    "Kutumia kamusi katika miktadha mbalimbali": "Uundaji wa Maneno na Ukuzaji wa Kamusi",
    "Kuwasiliana kwa njia ya maandishi katika miktadha mbalimbali": "Ustadi wa Kuandika",
    "Kukuza uelewa wa misingi ya fasihi ya Kiswahili": "Utangulizi wa Fasihi na Fasihi Simulizi",
    "Kuhakiki kazi za fasihi ya Kiswahili": "Uhakiki wa Vitabu Teule: Riwaya na Tamthilia",
    "Kubuni kazi za fasihi ya Kiswahili": "Uandishi wa Ubunifu na Dijitali",
    "Kufanya tafsiri sahili katika lugha ya Kiswahili": "Utafsiri na Ukalimani",
    "Kuhariri matini mbalimbali za Kiswahili": "Utafsiri na Ukalimani",
    "Kufanya ukalimani sahili kwa lugha ya Kiswahili": "Utafsiri na Ukalimani",
}

# Enrichment maps for the sparser competency-pool subjects (Basic Mathematics,
# Chemistry, Biology). These keep the richer existing per-form skeleton and
# inject the authentic KB lessons into matching topics.
MATHS_TOPIC_MAP = {
    "Use numerical skills in different contexts": "NUMBERS",
    "Use ratios and proportions in daily life": "RATIOS, PROPORTIONS AND PERCENTAGES",
    "Use rates and variations in different contexts": "RATES AND VARIATIONS",
    "Use geometry, approximations, relations and functions in various contexts": "DECIMALS AND APPROXIMATIONS",
    "Use algebra and matrices in problem solving": "ALGEBRA",
    "Use basic coordinate geometry, trigonometry and vectors skills in daily life": "COORDINATE GEOMETRY",
    "Use basic coordinate geometry, trigonometry, and vectors skills in daily life": "TRIGONOMETRY II",
    "Use basic skills of circles in daily life": "MENSURATION",
    "Use sets, sequences and series in problem solving": "SEQUENCES AND SERIES",
    "Use probability in problem solving": "PROBABILITY",
    "Use statistics in problem solving": "STATISTICS AND DATA REPRESENTATION",
}

CHEMISTRY_TOPIC_MAP = {
    "Demonstrate mastery of concepts, theories and principles in Chemistry": "INTRODUCTION TO CHEMISTRY",
    ". Demonstrate mastery of concepts, theories and principles in Chemistry": "SALTS",
    "Demonstrate an understanding of the physical and chemical properties of elements on the basis of their arrangements in the periodic table": "ATOMIC STRUCTURE",
    "Conduct experiments in Chemistry": "INTRODUCTION TO CHEMISTRY",
    "Conduct a project in Chemistry": "INTRODUCTION TO CHEMISTRY",
    "Demonstrate mastery of the principles of extraction of metals": "CHEMICAL REACTIONS",
    "Use the International Union of Pure and Applied Chemistry nomenclature to name chemical species": "ORGANIC CHEMISTRY",
    "Use chemical symbols, formulae and equations to represent chemical reaction": "CHEMICAL REACTIONS",
}

BIOLOGY_TOPIC_MAP = {
    "Describe the physiological, anatomical and ecological processes of living organisms": "BIOLOGY AND ITS APPLICATIONS",
    "Demonstrate mastery of scientific biological terminologies": "BIOLOGY AND ITS APPLICATIONS",
    "Demonstrate mastery of basic skills for conducting biological investigations": "BIOLOGY AND ITS APPLICATIONS",
    "Prepare and present results of biological investigations": "CELL STRUCTURE AND ORGANIZATION",
    "Carry out a biological project work using biological principles": "BIOLOGY AND ITS APPLICATIONS",
}


# Official NECTA subject codes (authoritative; never overridden by KB JSON).
OFFICIAL_NECTA_CODE = {
    "mathematics": "021",
    "english": "011",
    "kiswahili": "012",
    "physics": "031",
    "chemistry": "032",
    "biology": "033",
}

# knowledge-base JSON file name per casuya slug for O-Level.
KB_OLEVEL_FILE = {
    "mathematics": "mathematics_olevel.json",
    "english": "english_olevel.json",
    "kiswahili": "kiswahili_olevel.json",
    "physics": "physics_f1_f4.json",
    "chemistry": "chemistry_olevel.json",
    "biology": "biology_olevel.json",
}