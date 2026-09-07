import json
from pathlib import Path

REF_DIR = Path(r"c:\Users\Admin\Desktop\casuya\apps\platform\database\seeds\data\reference")
REF_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------------------
# CHEMISTRY FORM ONE SCHEME OF WORK
# -----------------------------------------------------------------------------
chem_scheme = {
    "subject_name": "Chemistry",
    "subject_slug": "chemistry",
    "form_level": 1,
    "standard": "Form 1",
    "tie_reference": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
    "source_note": "Verified Chemistry Form One scheme of work for Term I (TIE curriculum). Week rows structured from official syllabus and educator-verified plans (Arusha Catholic Seminary). 10 teaching weeks with 2 periods per week (one 80-min double period block per week).",
    "schemes": [
        {
            "title": "CHEMISTRY FORM ONE SCHEME OF WORK TERM 1 (2026)",
            "term": 1,
            "standard": "Form 1",
            "source_id": "chemistry-form-one-scheme-term-1",
            "scheme_of_work_details": [
                {
                    "topic": "Introduction to Chemistry",
                    "one": "1.0 Demonstrate mastery of foundational chemistry concepts",
                    "two": "1.1 Define chemistry and its branches",
                    "three": "Explain the concept and branches of chemistry",
                    "four": "Define chemistry; classify its branches with real-world examples (2 periods)",
                    "five": "",
                    "six": "Week 1",
                    "seven": "2",
                    "eight": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
                    "nine": "Interactive lecture, brainstorming, concept mapping",
                    "ten": "Textbook, branch-classification chart, industry pictures",
                    "eleven": "Oral questions, Chapter 1 Review Test",
                    "twelve": ""
                },
                {
                    "topic": "Laboratory Safety and Practices",
                    "one": "2.0 Demonstrate mastery of laboratory safety and practices",
                    "two": "2.1–2.2 Explain laboratory rules, hazard symbols, safe handling and first aid",
                    "three": "Explain lab safety rules, hazard symbols, chemical handling, and first aid",
                    "four": "State rules, identify hazard symbols, safe handling/storage/disposal and first aid response (2 periods)",
                    "five": "",
                    "six": "Week 2",
                    "seven": "2",
                    "eight": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
                    "nine": "Lab tour/demonstration, hazard-symbol matching game, first aid role play",
                    "ten": "Lab safety poster, PPE samples, hazard symbol charts, first aid kit",
                    "eleven": "Rules checklist, Role play rubric, Practical checklist",
                    "twelve": ""
                },
                {
                    "topic": "First Aid Kit and Laboratory Apparatus",
                    "one": "2.0 Demonstrate mastery of laboratory safety and practices",
                    "two": "2.2–2.3 Identify first aid kit contents and basic laboratory apparatus",
                    "three": "Apply first aid kit use and identify basic laboratory apparatus",
                    "four": "Identify first aid items; identify and state uses of basic lab apparatus (2 periods)",
                    "five": "",
                    "six": "Week 3",
                    "seven": "2",
                    "eight": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
                    "nine": "Apparatus display drill, measurement rotation stations, rapid-fire Q&A",
                    "ten": "First aid kit, real laboratory apparatus, charts, measuring instruments",
                    "eleven": "Apparatus Identification Test, Diagram Labeling Test",
                    "twelve": ""
                },
                {
                    "topic": "Fire and Flames",
                    "one": "3.0 Demonstrate mastery of fire, flames, and firefighting",
                    "two": "3.1–3.2 Explain concept and conditions for fire; classify fires and flames",
                    "three": "Explain fire triangle, causes/effects, fire classes, and luminous/non-luminous flames",
                    "four": "Define fire triangle, classify fires (A–D, electrical), compare luminous/non-luminous flames (2 periods)",
                    "five": "",
                    "six": "Week 5",
                    "seven": "2",
                    "eight": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
                    "nine": "Fire triangle demonstration, case study analysis, Bunsen burner observation",
                    "ten": "Fire triangle chart, news clippings, Bunsen burner, fire class chart",
                    "eleven": "Observation Record, Classification Test",
                    "twelve": ""
                },
                {
                    "topic": "Flame Structure and Firefighting",
                    "one": "3.0 Demonstrate mastery of fire, flames, and firefighting",
                    "two": "3.2–3.3 Describe flame structure and explain firefighting methods/equipment",
                    "three": "Describe zones of non-luminous flame and explain firefighting methods/prevention",
                    "four": "Identify 3 flame zones; explain cooling/smothering/starving/inhibition and extinguisher types (2 periods)",
                    "five": "",
                    "six": "Week 6",
                    "seven": "2",
                    "eight": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
                    "nine": "Flame zone temperature testing, extinguisher identification drill, poster design",
                    "ten": "Flame structure diagram, Bunsen burner, extinguishers, fire prevention posters",
                    "eleven": "Diagram Labeling Test, Matching exercise, Identification Test",
                    "twelve": ""
                },
                {
                    "topic": "States of Matter",
                    "one": "4.0 Demonstrate mastery of the states and changes of matter",
                    "two": "4.1 Explain states of matter, particle theory, and changes of state",
                    "three": "Explain states of matter, particle arrangement, and changes of state",
                    "four": "Describe solid/liquid/gas properties, kinetic theory, melting/freezing/evaporation/sublimation (2 periods)",
                    "five": "",
                    "six": "Week 7",
                    "seven": "2",
                    "eight": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
                    "nine": "Bead model demonstration, sample handling, state-change experiment",
                    "ten": "Solid/liquid/gas samples, bead model, state-change chart, data tables",
                    "eleven": "Property Comparison Table, Diagram Labeling Test, Cycle Diagram Labeling",
                    "twelve": ""
                },
                {
                    "topic": "Physical and Chemical Changes",
                    "one": "4.0 Demonstrate mastery of the states and changes of matter",
                    "two": "4.2 Explain physical and chemical changes",
                    "three": "Identify physical and chemical changes and compare them",
                    "four": "Define physical change; define chemical change, signs of reaction, compare on T-chart (2 periods)",
                    "five": "",
                    "six": "Week 8",
                    "seven": "2",
                    "eight": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
                    "nine": "Hands-on stations (cutting/melting/dissolving), burning candle demonstration, T-chart comparison",
                    "ten": "Paper, ice, salt/sugar, rusted nail, candle, comparison chart",
                    "eleven": "Observation record, T-Chart Evaluation, Signs-of-reaction Checklist, Chapter Review Test",
                    "twelve": ""
                },
                {
                    "topic": "Elements and Chemical Symbols",
                    "one": "5.0 Demonstrate mastery of elements, compounds, and mixtures",
                    "two": "5.1 Classify elements, apply chemical symbols, and compare properties/uses",
                    "three": "Define elements, apply symbol rules, compare properties, and describe uses",
                    "four": "Classify metals/non-metals/metalloids, write symbols, test conductivity, examine uses (2 periods)",
                    "five": "",
                    "six": "Week 9",
                    "seven": "2",
                    "eight": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
                    "nine": "Symbol memorization drill, sample sorting tray activity, conductivity testing",
                    "ten": "Metal/non-metal samples, periodic table, conductivity tester, use-case studies",
                    "eleven": "Symbol Quiz, Comparison Table, Presentation Rubric",
                    "twelve": ""
                },
                {
                    "topic": "Compounds and Mixtures",
                    "one": "5.0 Demonstrate mastery of elements, compounds, and mixtures",
                    "two": "5.2 Explain concept of compounds and mixtures and compare them",
                    "three": "Explain compound formation and compare mixtures with compounds",
                    "four": "Define compound formation (water/CO2); define mixtures (homo/hetero), compare properties (2 periods)",
                    "five": "",
                    "six": "Week 10",
                    "seven": "2",
                    "eight": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
                    "nine": "Compound card matching, practical mixing activity (sand/salt/water), T-chart analysis",
                    "ten": "Compound formation chart, sand, salt, water, comparison chart, substance cards",
                    "eleven": "Oral questions, T-Chart Evaluation, Classification Worksheet",
                    "twelve": ""
                },
                {
                    "topic": "Separating Mixtures",
                    "one": "5.0 Demonstrate mastery of elements, compounds, and mixtures",
                    "two": "5.3 Explain methods of separating mixtures and select appropriate methods",
                    "three": "Demonstrate filtration, decantation, evaporation, crystallization, distillation, sublimation, and magnetic separation",
                    "four": "Demonstrate simple and advanced separation techniques; select methods using decision matrix (2 periods)",
                    "five": "",
                    "six": "Week 11",
                    "seven": "2",
                    "eight": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
                    "nine": "Practical filtration and evaporation experiments, distillation setup study, decision-matrix exercise",
                    "ten": "Filter paper, funnel, evaporating dish, distillation diagram, magnet, iron filings",
                    "eleven": "Practical checklist, Diagram Labeling Test, Chapter Review Test",
                    "twelve": ""
                }
            ]
        }
    ]
}

# -----------------------------------------------------------------------------
# CHEMISTRY FORM ONE LESSON PLANS
# -----------------------------------------------------------------------------
chem_lessons_data = [
    (1, "1", "EXPLAIN THE CONCEPT AND BRANCHES OF CHEMISTRY",
     "1.0 Demonstrate mastery of foundational chemistry concepts",
     "1.1 Define chemistry and its branches",
     "Explain the concept and branches of chemistry",
     "Define chemistry; classify its branches (organic, inorganic, physical, analytical, biochemistry) with examples of what each studies",
     "Textbook, branch-classification chart",
     [
         ("Introduction", "10 min", "Asks learners what images come to mind when they hear \"chemistry\"; records responses on the board.", "Share initial ideas in a quick brainstorm.", "Engagement and relevance of ideas"),
         ("Competence Development", "25 min", "Defines chemistry formally; introduces the five branches with the classification chart, giving one real-world example per branch.", "Take notes; copy branch chart into notebooks.", "Correct statement of the definition"),
         ("Design", "30 min", "Organises a concept-mapping activity where groups place given topics (e.g., \"rusting,\" \"digestion,\" \"rocket fuel\") under the correct branch.", "Work in groups to build a concept map matching topics to branches.", "Correct placement of topics under branches"),
         ("Realization", "15 min", "Poses oral questions asking learners to justify their group's placements.", "Answer oral questions individually.", "Accuracy and reasoning of responses")
     ]),
    (2, "2", "INTERDISCIPLINARY LINKS AND APPLICATIONS OF CHEMISTRY",
     "1.0 Demonstrate mastery of foundational chemistry concepts",
     "1.2–1.3 Explain chemistry's links with other disciplines and its applications",
     "Explain the interdisciplinary links and applications of chemistry",
     "Link chemistry to Biology, Physics, Mathematics, Geography, and Agriculture; discuss applications of chemistry in medicine, agriculture, industry, and careers",
     "Interdisciplinary chart, career flashcards, industry pictures",
     [
         ("Introduction", "10 min", "Recaps Period 1's branches briefly; asks how a Biology teacher might also use chemistry.", "Recall previous lesson; give a guess.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains, with the interdisciplinary chart, how chemistry links to each subject; shows industry pictures illustrating applications.", "Take notes; observe pictures.", "Correct identification of at least 3 links"),
         ("Design", "30 min", "Assigns groups a career flashcard (doctor, farmer, engineer, forensic officer) and asks them to prepare a 2-minute case study on how that career uses chemistry.", "Discuss in groups; prepare and present a short case study.", "Quality and accuracy of group presentation"),
         ("Realization", "15 min", "Facilitates whole-class discussion comparing the presentations; administers the Chapter 1 Review Test.", "Listen to peers; complete review test.", "Chapter 1 Review Test score")
     ]),
    (3, "3", "LABORATORY RULES AND HAZARD SYMBOLS",
     "2.0 Demonstrate mastery of laboratory safety and practices",
     "2.1 Explain laboratory rules and hazard symbols",
     "Explain laboratory rules, dress code, and hazard symbols",
     "State laboratory rules and correct dress code; identify hazard symbols (toxic, corrosive, flammable, irritant)",
     "Lab safety poster, PPE samples, hazard symbol charts",
     [
         ("Introduction", "10 min", "Asks what could go wrong entering a lab without following any rules.", "Share views.", "Engagement"),
         ("Competence Development", "25 min", "Conducts a lab tour/demonstration explaining each safety rule and correct PPE use.", "Observe demonstration; try on PPE samples; record rules.", "Correct listing of at least 5 rules"),
         ("Design", "30 min", "Runs a hazard-symbol matching game: groups match symbol cards to their meaning and an example substance.", "Play matching game in groups; justify matches.", "Accuracy of symbol matching"),
         ("Realization", "15 min", "Distributes a rules checklist for learners to self-assess their understanding.", "Complete rules checklist.", "Rules Checklist score")
     ]),
    (4, "4", "SAFE CHEMICAL HANDLING AND FIRST AID PROCEDURES",
     "2.0 Demonstrate mastery of laboratory safety and practices",
     "2.2 Explain safe chemical handling and first aid procedures",
     "Explain safe handling/storage/disposal of chemicals and first aid response",
     "Describe safe handling, storage, and disposal of chemicals; explain first aid for cuts, burns, chemical splashes, and poisoning",
     "First aid box/kit, PPE samples, lab safety poster",
     [
         ("Introduction", "10 min", "Recaps hazard symbols from Period 1; asks what to do if acid splashes on skin.", "Recall symbols; attempt an answer.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates safe handling, storage, and disposal procedures for common lab chemicals.", "Observe demonstration; note key safety steps.", "Correct sequencing of handling steps"),
         ("Design", "30 min", "Leads a first-aid role play: groups act out responding to a cut, a burn, a chemical splash, and suspected poisoning.", "Perform role play in groups, applying correct first aid steps.", "Role Play Rubric score"),
         ("Realization", "15 min", "Observes and scores each group's practical response using a checklist.", "Receive feedback; complete self/peer checklist.", "Practical Checklist score")
     ]),
    (5, "5", "FIRST AID KIT CONTENTS AND EMERGENCY PROCEDURES",
     "2.0 Demonstrate mastery of laboratory safety and practices",
     "2.2 Identify first aid kit contents and emergency procedures",
     "Apply first aid kit use in emergencies",
     "Identify first aid kit contents (bandages, antiseptic, gloves, scissors, eyewash) and describe the correct emergency procedure for each type of injury",
     "First aid kit, lab safety poster",
     [
         ("Introduction", "10 min", "Opens the first aid kit and asks learners to name any items they recognise.", "Name visible items.", "Engagement"),
         ("Competence Development", "25 min", "Explains the use of each item and the correct emergency sequence (assess, protect, treat, refer).", "Observe; take notes on procedure sequence.", "Correct sequencing of emergency steps"),
         ("Design", "30 min", "Guides a practical demonstration where groups practice locating and using specific kit items for a given scenario card.", "Practice using kit items per scenario in groups.", "Practical Demonstration Checklist score"),
         ("Realization", "15 min", "Reviews with rapid-fire oral questions on which item suits which injury.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (6, "6", "BASIC CHEMISTRY LABORATORY APPARATUS",
     "2.0 Demonstrate mastery of laboratory safety and practices",
     "2.3 Identify basic chemistry laboratory apparatus",
     "Identify and use basic laboratory apparatus",
     "Identify test tubes, beakers, flasks, funnels, burettes, Bunsen burner, tripod stand, wire gauze, measuring cylinder, pipette, thermometer, and balance; state the use of each",
     "Real laboratory apparatus, apparatus charts, measuring instruments",
     [
         ("Introduction", "10 min", "Displays 3–4 pieces of apparatus and asks learners to guess their names/uses.", "Guess names and uses.", "Engagement"),
         ("Competence Development", "25 min", "Introduces each remaining apparatus item, stating its name, use, and safe handling.", "Observe; label a diagram sheet as items are introduced.", "Correct naming of apparatus"),
         ("Design", "30 min", "Runs an apparatus identification and measurement drill in groups (measuring set volumes with cylinder/pipette, reading a thermometer, using a balance).", "Rotate through stations identifying apparatus and taking measurements.", "Practical Skills Checklist score"),
         ("Realization", "15 min", "Administers an apparatus identification test with labelled diagrams.", "Complete identification test.", "Apparatus Identification Test / Diagram Labeling Test score")
     ]),
    (7, "7", "CONCEPT AND CONDITIONS FOR FIRE",
     "3.0 Demonstrate mastery of fire, flames, and firefighting",
     "3.1 Explain the concept and conditions for fire",
     "Explain fire, the fire triangle, and its causes/effects",
     "Define fire and the fire triangle (fuel, heat, oxygen); discuss causes and effects of fire using real case studies",
     "Fire triangle chart, case studies/news clippings",
     [
         ("Introduction", "10 min", "Asks learners the three things needed to start and sustain a fire.", "Give initial ideas.", "Engagement"),
         ("Competence Development", "25 min", "Explains the fire triangle and demonstrates removing one element to show a fire dies (e.g., smothering a candle).", "Observe demonstration; label the fire triangle diagram.", "Correct labeling of fire triangle"),
         ("Design", "30 min", "Distributes case studies/news clippings on real fire incidents; groups identify the fuel, heat source, and effects in each case.", "Analyse case studies in groups; discuss findings.", "Discussion Rubric score"),
         ("Realization", "15 min", "Leads whole-class sharing of case study findings and clarifies misconceptions.", "Present findings; ask questions.", "Diagram Labeling accuracy")
     ]),
    (8, "8", "CLASSIFICATION OF FIRES AND TYPES OF FLAMES",
     "3.0 Demonstrate mastery of fire, flames, and firefighting",
     "3.1–3.2 Classify fires and explain the concept of flames",
     "Classify fires and distinguish types of flames",
     "Classify fires into classes A, B, C, D, and electrical; define flame and distinguish luminous from non-luminous flames using the Bunsen burner",
     "Fire class chart, Bunsen burner",
     [
         ("Introduction", "10 min", "Recaps the fire triangle; asks if all fires are put out the same way.", "Recall previous lesson.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains the five fire classes with examples of each fuel type, using the fire class chart.", "Take notes; match examples to classes.", "Correct classification of examples"),
         ("Design", "30 min", "Demonstrates the Bunsen burner with air-hole open and closed; groups record observations of luminous vs non-luminous flames.", "Observe demonstration in groups; record flame characteristics.", "Observation Record accuracy"),
         ("Realization", "15 min", "Administers a fire classification test.", "Complete classification test.", "Classification Test score")
     ]),
    (9, "9", "FLAME STRUCTURE AND ZONES",
     "3.0 Demonstrate mastery of fire, flames, and firefighting",
     "3.2 Describe flame structure",
     "Describe the zones of a non-luminous flame",
     "Identify and describe the three zones of a non-luminous Bunsen flame (dark zone, luminous zone, outer/hottest zone)",
     "Flame structure diagram, Bunsen burner",
     [
         ("Introduction", "10 min", "Asks which part of a candle flame is hottest and why they think so.", "Share predictions.", "Engagement"),
         ("Competence Development", "25 min", "Draws and explains the three flame zones on the board using the flame structure diagram.", "Copy and label the flame diagram.", "Correct labeling of flame zones"),
         ("Design", "30 min", "Demonstrates testing the temperature of each zone (e.g., holding a matchstick briefly across the flame) for groups to observe and record.", "Observe demonstration in groups; record which zone chars the matchstick fastest.", "Diagram Labeling Test accuracy"),
         ("Realization", "15 min", "Reviews with a diagram-based matching exercise on flame zones.", "Complete matching exercise.", "Matching Exercise score")
     ]),
    (10, "10", "FIREFIGHTING METHODS AND EQUIPMENT",
     "3.0 Demonstrate mastery of fire, flames, and firefighting",
     "3.3 Explain methods and equipment used in firefighting",
     "Explain firefighting methods, equipment, and prevention",
     "Explain cooling, smothering, starving, and chain-reaction-interruption methods; identify fire extinguisher types and their appropriate use; discuss fire prevention measures",
     "Firefighting method chart, sample extinguishers, fire prevention posters",
     [
         ("Introduction", "10 min", "Asks how learners would put out a small kitchen fire at home.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Explains the four firefighting methods, linking each to the fire triangle; introduces extinguisher types and their matching fire classes.", "Take notes; match extinguisher types to fire classes.", "Correct method-to-class matching"),
         ("Design", "30 min", "Guides groups in an equipment identification drill using sample extinguishers, followed by designing a fire-prevention poster/slogan for the school.", "Identify extinguishers in groups; design a poster/slogan.", "Poster/Slogan Rubric score"),
         ("Realization", "15 min", "Administers an identification test on methods and equipment.", "Complete identification test.", "Identification Test score")
     ]),
    (11, "11", "STATES OF MATTER AND PARTICLE THEORY",
     "4.0 Demonstrate mastery of the states and changes of matter",
     "4.1 Explain the states of matter and particle theory",
     "Explain matter, its states, and particle arrangement",
     "Define matter; describe properties of solids, liquids, and gases; explain particle arrangement and movement using the kinetic theory",
     "Solid/liquid/gas samples, particle diagrams/bead model",
     [
         ("Introduction", "10 min", "Shows ice, water, and an inflated balloon; asks what is common and different among them.", "Observe and respond.", "Engagement"),
         ("Competence Development", "25 min", "Defines matter; explains properties of the three states and demonstrates particle arrangement using the bead model.", "Observe bead model demonstration; take notes.", "Correct description of particle arrangement per state"),
         ("Design", "30 min", "Guides groups to handle the solid/liquid/gas samples and complete a property-comparison table (shape, volume, compressibility).", "Handle samples; complete comparison table in groups.", "Property Comparison Table accuracy"),
         ("Realization", "15 min", "Reviews with a diagram labeling test on particle arrangement.", "Complete diagram labeling test.", "Diagram Labeling Test score")
     ]),
    (12, "12", "CHANGES OF STATE",
     "4.0 Demonstrate mastery of the states and changes of matter",
     "4.1 Explain changes of state",
     "Explain melting, freezing, evaporation, condensation, and sublimation",
     "Describe melting, freezing, evaporation, condensation, and sublimation; explain factors affecting the rate of change of state (temperature, surface area, pressure)",
     "State-change chart, data tables",
     [
         ("Introduction", "10 min", "Recaps particle arrangement briefly; asks what happens to ice left in the sun.", "Recall previous lesson; predict outcome.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates ice melting and water boiling, naming each change of state as it occurs.", "Observe demonstration; record each change and its name.", "Correct naming of each change"),
         ("Design", "30 min", "Guides a guided discussion and data-table activity on factors affecting rate of change (comparing melting times under different conditions).", "Complete data table in groups; discuss factors.", "Problem-Solving Exercise accuracy"),
         ("Realization", "15 min", "Sets a cycle-diagram labeling task showing all changes of state in sequence.", "Complete cycle diagram labeling.", "Cycle Diagram Labeling score")
     ]),
    (13, "13", "PHYSICAL CHANGE",
     "4.0 Demonstrate mastery of the states and changes of matter",
     "4.2 Explain physical change",
     "Identify and explain physical changes",
     "Define physical change; demonstrate and identify examples (cutting paper, melting ice, dissolving salt/sugar in water)",
     "Paper, ice, salt/sugar and water",
     [
         ("Introduction", "10 min", "Tears a piece of paper in front of the class and asks if it is still paper.", "Respond and justify.", "Engagement"),
         ("Competence Development", "25 min", "Defines physical change; explains why cutting, melting, and dissolving are physical (no new substance formed).", "Take notes; give own examples.", "Correct definition and reasoning"),
         ("Design", "30 min", "Guides groups through practical stations: cutting paper, observing ice melt, dissolving salt/sugar in water.", "Perform each activity in groups; record observations.", "Observation Record accuracy"),
         ("Realization", "15 min", "Leads discussion confirming each activity is reversible/no new substance formed.", "Contribute to discussion.", "Quality of reasoning given")
     ]),
    (14, "14", "CHEMICAL CHANGE AND COMPARISON",
     "4.0 Demonstrate mastery of the states and changes of matter",
     "4.2 Explain and apply chemical change",
     "Identify chemical changes and compare them with physical changes",
     "Define chemical change with examples (burning, rusting, cooking); identify signs of a chemical reaction; compare physical and chemical change; apply to real-life situations",
     "Rusted nail sample, candle, comparison chart",
     [
         ("Introduction", "10 min", "Shows a rusted nail and asks if it can be turned back into shiny metal.", "Give initial ideas.", "Engagement"),
         ("Competence Development", "25 min", "Defines chemical change; explains signs of reaction (colour change, gas production, heat, new substance) using the burning candle as a live example.", "Observe candle burning; take notes on signs of reaction.", "Correct listing of signs of reaction"),
         ("Design", "30 min", "Guides groups to build a T-chart comparing physical vs chemical change using examples from both lessons, then apply the concept to real-life scenarios (cooking, rusting cars).", "Build T-chart in groups; discuss real-life applications.", "T-Chart Evaluation accuracy"),
         ("Realization", "15 min", "Administers the signs-of-reaction checklist and Chapter Review Test.", "Complete checklist and review test.", "Signs-of-Reaction Checklist / Chapter Review Test score")
     ]),
    (15, "15", "ELEMENTS AND CHEMICAL SYMBOLS",
     "5.0 Demonstrate mastery of elements, compounds, and mixtures",
     "5.1 Classify elements and apply chemical symbols",
     "Define elements and apply chemical symbol rules",
     "Define an element; classify metals, non-metals, and metalloids; state chemical symbols and the rules for writing them",
     "Metal/non-metal samples, periodic table",
     [
         ("Introduction", "10 min", "Shows a metal spoon and a piece of sulfur; asks how they differ.", "Share observations.", "Engagement"),
         ("Competence Development", "25 min", "Defines an element; explains classification into metals, non-metals, metalloids using the periodic table; states symbol-writing rules (capital first letter, lowercase second).", "Take notes; identify sample elements on the periodic table.", "Correct classification of samples"),
         ("Design", "30 min", "Runs a symbol memorization drill and sample-sorting activity in groups (sorting samples into metal/non-metal/metalloid trays).", "Sort samples in groups; practice writing symbols correctly.", "Symbol Quiz accuracy"),
         ("Realization", "15 min", "Administers a short symbol quiz.", "Complete symbol quiz.", "Symbol Quiz score")
     ]),
    (16, "16", "PROPERTIES AND USES OF ELEMENTS",
     "5.0 Demonstrate mastery of elements, compounds, and mixtures",
     "5.1 Compare properties and uses of elements",
     "Compare properties of elements and describe their uses",
     "Compare properties of elements (lustre, electrical conductivity, malleability); describe practical uses of common elements",
     "Conductivity tester, use-case studies",
     [
         ("Introduction", "10 min", "Recaps metal/non-metal classification; asks why wires are made of copper, not wood.", "Recall previous lesson; give a reason.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains lustre, conductivity, and malleability as distinguishing properties, demonstrating a conductivity test.", "Observe demonstration; take notes.", "Correct property definitions"),
         ("Design", "30 min", "Guides groups to practically test conductivity of different samples and study use-case cards on real applications (aluminium in cans, copper in wiring, iron in construction).", "Test conductivity in groups; discuss use-case studies.", "Comparison Table accuracy"),
         ("Realization", "15 min", "Facilitates a group presentation on one element's properties and uses.", "Present findings to class.", "Presentation Rubric score")
     ]),
    (17, "17", "CONCEPT OF COMPOUNDS",
     "5.0 Demonstrate mastery of elements, compounds, and mixtures",
     "5.2 Explain the concept of compounds",
     "Explain compound formation from elements",
     "Define a compound; explain how compounds form from elements chemically combining, using water and carbon dioxide as examples",
     "Compound formation chart",
     [
         ("Introduction", "10 min", "Asks learners to name a substance made of more than one element.", "Share examples.", "Engagement"),
         ("Competence Development", "25 min", "Defines a compound; explains formation from elements using the compound formation chart (e.g., hydrogen + oxygen → water).", "Take notes; copy formation examples.", "Correct explanation of compound formation"),
         ("Design", "30 min", "Guides group discussion identifying more compound examples and their constituent elements from given substance cards.", "Identify constituent elements of given compounds in groups.", "Oral Questions accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing compound formation.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (18, "18", "MIXTURES AND COMPARISON WITH COMPOUNDS",
     "5.0 Demonstrate mastery of elements, compounds, and mixtures",
     "5.2 Explain mixtures and compare with compounds",
     "Explain mixtures and compare them with compounds",
     "Define a mixture (homogeneous/heterogeneous); compare compounds and mixtures by composition, properties, and separability; classify given substances",
     "Sand/salt/water, comparison chart, sample substance cards",
     [
         ("Introduction", "10 min", "Recaps compounds; shows a cup of sand and water and asks if it's a compound.", "Recall previous lesson; respond.", "Recall accuracy"),
         ("Competence Development", "25 min", "Defines mixture types (homogeneous/heterogeneous) and explains differences from compounds (no fixed ratio, physically combined, separable).", "Take notes; observe sand+water and salt+water examples.", "Correct differentiation"),
         ("Design", "30 min", "Guides a practical mixing activity (sand+water, salt+water) followed by building a T-chart comparing compounds and mixtures.", "Mix substances in groups; complete T-chart.", "T-Chart Evaluation accuracy"),
         ("Realization", "15 min", "Sets a classification worksheet using sample substance cards.", "Complete classification worksheet.", "Classification Worksheet / Practical Checklist score")
     ]),
    (19, "19", "SEPARATION METHODS - FILTRATION, DECANTATION, EVAPORATION, CRYSTALLIZATION",
     "5.0 Demonstrate mastery of elements, compounds, and mixtures",
     "5.3 Explain filtration, decantation, evaporation, and crystallization",
     "Explain and demonstrate simple separation methods",
     "Describe and practically demonstrate filtration, decantation, evaporation, and crystallization as methods of separating mixtures",
     "Filter paper/funnel, evaporating dish",
     [
         ("Introduction", "10 min", "Asks how one would separate sand from water at home.", "Give suggestions.", "Engagement"),
         ("Competence Development", "25 min", "Explains filtration, decantation, evaporation, and crystallization, describing when each is appropriate.", "Take notes on each method.", "Correct description of each method"),
         ("Design", "30 min", "Demonstrates filtration (sand from water) and evaporation (salt from water) practically; groups observe and record each step.", "Observe and assist demonstration in groups; record observations.", "Practical Checklist / Observation Record accuracy"),
         ("Realization", "15 min", "Reviews with oral questions comparing the four methods.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (20, "20", "SEPARATION METHODS - DISTILLATION, SUBLIMATION, MAGNETIC SEPARATION",
     "5.0 Demonstrate mastery of elements, compounds, and mixtures",
     "5.3 Explain distillation, sublimation, and magnetic separation; select appropriate methods",
     "Explain and apply distillation, sublimation, and magnetic separation",
     "Describe distillation, sublimation, and magnetic separation; select the appropriate separation method for a given mixture",
     "Distillation diagram, magnet/iron filings",
     [
         ("Introduction", "10 min", "Recaps filtration/evaporation briefly; asks how to separate iron filings from sand.", "Recall previous lesson; predict a method.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains distillation using the diagram; demonstrates sublimation (if a suitable substance is available) and magnetic separation of iron filings from sand.", "Observe demonstrations; take notes.", "Correct diagram labeling of distillation set-up"),
         ("Design", "30 min", "Sets a decision-matrix exercise where groups are given mixture cards and must select and justify the correct separation method for each.", "Complete decision-matrix exercise in groups.", "Diagram Labeling Test accuracy"),
         ("Realization", "15 min", "Administers the Chapter Review Test covering all separation methods.", "Complete Chapter Review Test.", "Chapter Review Test score")
     ])
]

chem_lessons = []
for num, sr, topic, mc, sc, ma, sa, res, stages in chem_lessons_data:
    chem_lessons.append({
        "title": f"CHEMISTRY FORM ONE LESSON PLAN NO. {num}: {topic}",
        "sr_no": sr,
        "time": "80 min",
        "main_competence": mc,
        "specific_competence": sc,
        "main_activity": ma,
        "specific_activity": sa,
        "teaching_learning_resources": res,
        "references": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: Tanzania Institute of Education.",
        "teaching_structure": [
            {
                "stage": st_name,
                "time": st_time,
                "teaching_activities": t_act,
                "learning_activities": l_act,
                "assessment_criteria": a_crit
            }
            for st_name, st_time, t_act, l_act, a_crit in stages
        ]
    })

chem_doc = {
    "subject_name": "Chemistry",
    "subject_slug": "chemistry",
    "form_level": 1,
    "standard": "Form 1",
    "tie_reference": "TIE (2026). Chemistry for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
    "source_note": "Verified Chemistry Form One lesson plans (Arusha Catholic Seminary). 20 lesson plans (80 min double periods, 2 per week) covering Introduction to Chemistry (Week 1), Laboratory Rules and Safety (Week 2), First Aid & Apparatus (Week 3), Fire & Flames (Week 5), Flame Structure & Firefighting (Week 6), States of Matter (Week 7), Physical & Chemical Changes (Week 8), Elements & Symbols (Week 9), Compounds & Mixtures (Week 10), and Separating Mixtures (Week 11).",
    "lessons": chem_lessons
}

with open(REF_DIR / "chemistry_form_one_scheme.json", "w", encoding="utf-8") as f:
    json.dump(chem_scheme, f, indent=2, ensure_ascii=False)

with open(REF_DIR / "chemistry_form_one.json", "w", encoding="utf-8") as f:
    json.dump(chem_doc, f, indent=2, ensure_ascii=False)

print("Generated chemistry_form_one_scheme.json and chemistry_form_one.json")
