"""Enrichment maps for the competency-pool subjects (Mathematics, Chemistry).

The KB O-Level JSON for Mathematics collapsed all Forms 1-4 into a single pool
of competency units (no per-form signal), so we keep the curated per-form
"skeleton" topics (preserving form distribution + period totals) and inject
every authentic KB competence lesson into the best-matching seed topic. Keys
are the exact ``_clean()``-ed competence (topic_name) from the KB; values are
the exact seed topic title to enrich. A-Level is never touched.
"""

from __future__ import annotations

# Enrichment maps for the competency-pool subjects (Basic Mathematics,
# Chemistry). These keep the richer existing per-form skeleton and
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


# Official NECTA subject codes (authoritative; never overridden by KB JSON).
OFFICIAL_NECTA_CODE = {
    "mathematics": "021",
    "physics": "031",
    "chemistry": "032",
}

# knowledge-base JSON file name per casuya slug for O-Level.
KB_OLEVEL_FILE = {
    "mathematics": "mathematics_olevel.json",
    "physics": "physics_f1_f4.json",
    "chemistry": "chemistry_olevel.json",
}