import json
from pathlib import Path

REF_DIR = Path(r"c:\Users\Admin\Desktop\casuya\apps\platform\database\seeds\data\reference")
REF_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------------------
# BIOLOGY FORM ONE SCHEME OF WORK
# -----------------------------------------------------------------------------
bio_scheme_term1 = [
    {
        "topic": "Introduction to Biology",
        "one": "1.0 Demonstrate mastery of foundational biological concepts",
        "two": "1.1 Explain basic biological concepts, terminologies, importance, and relationships of Biology",
        "three": "Explain the concept, importance, and relationships of Biology",
        "four": "Define Biology and basic terminologies (organism, species, habitat); discuss the importance of studying Biology (health, agriculture, environment, careers); relate Biology to Chemistry, Physics, Geography, and Agriculture (2 periods)",
        "five": "",
        "six": "Week 1",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Interactive lecture, brainstorming, concept mapping, career discussion",
        "ten": "Textbook, terminology flashcards, interdisciplinary chart, career pictures",
        "eleven": "Oral Questions, Concept Map Evaluation, Chapter 1 Review Test",
        "twelve": ""
    },
    {
        "topic": "Scientific Processes",
        "one": "2.0 Demonstrate mastery of scientific processes and laboratory skills",
        "two": "2.1 Identify laboratory apparatus/equipment and demonstrate basic scientific skills",
        "three": "Identify laboratory apparatus and demonstrate basic scientific skills",
        "four": "Identify and state uses of common Biology apparatus (microscope, hand lens, forceps, Petri dish, test tubes); practice observation, measurement, recording, and specimen drawing (2 periods)",
        "five": "",
        "six": "Week 2",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Apparatus display/identification drill, hands-on skill practice, guided observation",
        "ten": "Real/labelled apparatus, microscope, hand lens, specimen samples",
        "eleven": "Apparatus Identification Test, Skills Practical Checklist",
        "twelve": ""
    },
    {
        "topic": "Scientific Processes",
        "one": "2.0 Demonstrate mastery of scientific processes and laboratory skills",
        "two": "2.2 Explain scientific methods and conduct simple biological experiments",
        "three": "Explain scientific methods and carry out simple experiments",
        "four": "Describe steps of the scientific method (observation, hypothesis, experiment, conclusion); carry out simple experiments (e.g., starch test, effect of light on plants) following the method (2 periods)",
        "five": "",
        "six": "Week 3",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Step-by-step demonstration, guided practical experiment, group hypothesis writing",
        "ten": "Simple experiment materials (iodine solution, leaves, potted plants), scientific method chart",
        "eleven": "Practical Report, Hypothesis-Writing Exercise, Chapter 2 Review Test",
        "twelve": ""
    },
    {
        "topic": "Cell Structure and Organization",
        "one": "3.0 Demonstrate mastery of cell structure and organization",
        "two": "3.1 Describe the cell as the basic unit of life",
        "three": "Explain the concept of the cell",
        "four": "Define a cell; describe cell theory; identify and label parts of a generalized cell using the microscope/diagrams (2 periods)",
        "five": "",
        "six": "Week 4",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Microscope demonstration/observation, diagram labeling, guided discussion",
        "ten": "Microscope, prepared slides, cell diagram chart",
        "eleven": "Diagram Labeling Test, Practical Observation Checklist",
        "twelve": ""
    },
    {
        "topic": "Cell Structure and Organization",
        "one": "3.0 Demonstrate mastery of cell structure and organization",
        "two": "3.2 Distinguish types of cells",
        "three": "Compare types of cells",
        "four": "Distinguish plant and animal cells; distinguish prokaryotic and eukaryotic cells based on structure (2 periods)",
        "five": "",
        "six": "Week 6",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Comparative diagram drawing, microscope observation of plant/animal cells, T-chart construction",
        "ten": "Microscope, onion/cheek cell slides, comparison chart",
        "eleven": "T-Chart Evaluation, Diagram Comparison Test",
        "twelve": ""
    },
    {
        "topic": "Cell Structure and Organization",
        "one": "3.0 Demonstrate mastery of cell structure and organization",
        "two": "3.3 Explain cell organization into tissues, organs, and systems",
        "three": "Explain levels of cell organization",
        "four": "Describe organization from cell → tissue → organ → organ system → organism, with examples (2 periods)",
        "five": "",
        "six": "Week 7",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Sequence diagram construction, guided discussion, human/plant body examples",
        "ten": "Organization-level chart, textbook",
        "eleven": "Sequence Diagram Test, Chapter 3 Review Test",
        "twelve": ""
    }
]

bio_scheme_term2 = [
    {
        "topic": "Classification of Living Things",
        "one": "4.0 Demonstrate mastery of classification of living things",
        "two": "4.1 Explain the concept and systems of classification",
        "three": "Explain the concept and systems of classification",
        "four": "Define classification; explain reasons for classifying organisms; describe artificial and natural classification systems (2 periods)",
        "five": "",
        "six": "Week 1",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Sorting/grouping activity with objects/organisms, guided discussion",
        "ten": "Assorted specimen pictures, classification chart",
        "eleven": "Sorting Exercise, Oral Questions",
        "twelve": ""
    },
    {
        "topic": "Classification of Living Things",
        "one": "4.0 Demonstrate mastery of classification of living things",
        "two": "4.2 Describe major groups of living things and apply binomial nomenclature",
        "three": "Describe major groups of living things and apply binomial nomenclature",
        "four": "Outline the major groups/kingdoms of living things; state and apply rules of binomial nomenclature to name organisms (2 periods)",
        "five": "",
        "six": "Week 2",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Group classification chart activity, naming-rules drill, pair practice",
        "ten": "Five-kingdom chart, naming rule examples, textbook",
        "eleven": "Naming Exercise, Chapter 4 Review Test",
        "twelve": ""
    },
    {
        "topic": "Viruses and Major Groups of Living Things",
        "one": "5.0 Demonstrate mastery of viruses and the major groups of living things",
        "two": "5.1 Describe viruses and Kingdom Monera",
        "three": "Explain viruses and Kingdom Monera",
        "four": "Describe structure, characteristics, and effects of viruses; describe characteristics and examples of Kingdom Monera (bacteria) (2 periods)",
        "five": "",
        "six": "Week 3",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Diagram drawing, picture/video observation, guided discussion",
        "ten": "Virus/bacteria diagrams and pictures, textbook",
        "eleven": "Diagram Labeling Test, Oral Questions",
        "twelve": ""
    },
    {
        "topic": "Viruses and Major Groups of Living Things",
        "one": "5.0 Demonstrate mastery of viruses and the major groups of living things",
        "two": "5.2 Describe Kingdom Protoctista and Kingdom Fungi",
        "three": "Explain characteristics of Kingdom Protoctista and Kingdom Fungi",
        "four": "Describe characteristics/examples of Protoctista (e.g., Amoeba, algae) and Fungi (e.g., mushroom, yeast, mould) (2 periods)",
        "five": "",
        "six": "Week 4",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Microscope/picture observation, comparative chart, group discussion",
        "ten": "Protoctista/fungi specimens or pictures, microscope",
        "eleven": "Comparison Chart Evaluation, Short Quiz",
        "twelve": ""
    },
    {
        "topic": "Viruses and Major Groups of Living Things",
        "one": "5.0 Demonstrate mastery of viruses and the major groups of living things",
        "two": "5.3 Describe Kingdom Plantae and classes of Angiospermophyta",
        "three": "Explain Kingdom Plantae and classify Angiospermophyta",
        "four": "Describe characteristics of Kingdom Plantae; distinguish Monocotyledonae and Dicotyledonae classes with examples (2 periods)",
        "five": "",
        "six": "Week 5",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Plant specimen observation, comparative table construction, field/garden examples",
        "ten": "Plant specimens (monocot/dicot samples), classification chart",
        "eleven": "Comparison Table, Specimen Identification Test",
        "twelve": ""
    },
    {
        "topic": "Viruses and Major Groups of Living Things",
        "one": "5.0 Demonstrate mastery of viruses and the major groups of living things",
        "two": "5.4 Describe Kingdom Animalia",
        "three": "Explain characteristics of Kingdom Animalia",
        "four": "Describe characteristics of invertebrates and vertebrates; classify examples into major animal phyla/classes (2 periods)",
        "five": "",
        "six": "Week 6",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Picture/specimen sorting, classification chart activity, group presentation",
        "ten": "Animal group pictures/charts, textbook",
        "eleven": "Classification Test, Group Presentation Rubric, Chapter 5 Review Test",
        "twelve": ""
    },
    {
        "topic": "Nutrition in Plants",
        "one": "6.0 Demonstrate mastery of nutrition in plants",
        "two": "6.1 Explain the concept of nutrition and essential/non-essential elements in plants",
        "three": "Explain nutrition and elements required by plants",
        "four": "Define nutrition; distinguish essential and non-essential elements (macro/micro nutrients) and their roles/deficiency symptoms (2 periods)",
        "five": "",
        "six": "Week 8",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Guided discussion, deficiency-symptom picture matching, chart study",
        "ten": "Plant nutrient chart, deficiency symptom pictures",
        "eleven": "Matching Exercise, Oral Questions",
        "twelve": ""
    },
    {
        "topic": "Nutrition in Plants",
        "one": "6.0 Demonstrate mastery of nutrition in plants",
        "two": "6.2 Explain the process of photosynthesis",
        "three": "Explain the process of photosynthesis",
        "four": "State the word and chemical equation of photosynthesis; describe requirements (light, water, CO2, chlorophyll) (2 periods)",
        "five": "",
        "six": "Week 9",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Demonstration/experiment (testing leaf for starch), diagram illustration, guided discussion",
        "ten": "Iodine solution, leaves, photosynthesis equation chart",
        "eleven": "Practical Report, Equation Writing Test",
        "twelve": ""
    },
    {
        "topic": "Nutrition in Plants",
        "one": "6.0 Demonstrate mastery of nutrition in plants",
        "two": "6.3 Relate leaf structure to photosynthesis and explain its importance",
        "three": "Relate leaf structure to photosynthesis and its importance",
        "four": "Describe internal/external leaf structure in relation to photosynthesis (stomata, palisade/spongy mesophyll, chlorophyll); explain importance of photosynthesis to plants and other living things (2 periods)",
        "five": "",
        "six": "Week 10",
        "seven": "2",
        "eight": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Leaf cross-section diagram labeling, microscope observation, guided discussion",
        "ten": "Microscope, leaf cross-section slides/diagram, textbook",
        "eleven": "Diagram Labeling Test, Chapter 6 Review Test",
        "twelve": ""
    }
]

bio_scheme = {
    "subject_name": "Biology",
    "subject_slug": "biology",
    "form_level": 1,
    "standard": "Form 1",
    "tie_reference": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
    "source_note": "Verified Biology Form One scheme of work for Term I and Term II (TIE curriculum). Verbatim educator-verified table (Arusha Catholic Seminary). Term I covers Introduction to Biology, Scientific Processes, and Cell Structure and Organization. Term II covers Classification of Living Things, Viruses and Major Groups, and Nutrition in Plants.",
    "schemes": [
        {
            "title": "BIOLOGY FORM ONE SCHEME OF WORK TERM 1 (2026)",
            "term": 1,
            "standard": "Form 1",
            "source_id": "biology-form-one-scheme-term-1",
            "scheme_of_work_details": bio_scheme_term1
        },
        {
            "title": "BIOLOGY FORM ONE SCHEME OF WORK TERM 2 (2026)",
            "term": 2,
            "standard": "Form 1",
            "source_id": "biology-form-one-scheme-term-2",
            "scheme_of_work_details": bio_scheme_term2
        }
    ]
}

# -----------------------------------------------------------------------------
# BIOLOGY FORM ONE LESSON PLANS (30 Lesson Plans)
# -----------------------------------------------------------------------------
bio_lessons_data = [
    # Term I - Week 1
    (1, "1", "EXPLAIN BASIC BIOLOGICAL CONCEPTS AND TERMINOLOGIES",
     "1.0 Demonstrate mastery of foundational biological concepts",
     "1.1 Explain basic biological concepts and terminologies",
     "Explain the concept of Biology and basic terminologies",
     "Define Biology; define and give examples of basic terminologies (organism, species, habitat)",
     "Textbook, terminology flashcards",
     [
         ("Introduction", "10 min", "Asks learners to name living things they saw on the way to school.", "Share examples.", "Engagement"),
         ("Competence Development", "25 min", "Defines Biology; introduces key terms (organism, species, habitat) using flashcards with examples of each.", "Take notes; match flashcards to definitions.", "Correct use of terminology"),
         ("Design", "30 min", "Guides a matching/sorting activity where groups classify local plants and animals by species and habitat.", "Sort examples in groups by species/habitat.", "Accuracy of classification"),
         ("Realization", "15 min", "Poses oral questions on the terms covered.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (2, "2", "EXPLAIN THE IMPORTANCE AND INTERDISCIPLINARY RELATIONSHIPS OF BIOLOGY",
     "1.0 Demonstrate mastery of foundational biological concepts",
     "1.1 Explain the importance and interdisciplinary relationships of Biology",
     "Explain the importance of Biology and its relationship with other disciplines",
     "Discuss the importance of studying Biology (health, agriculture, environment, careers); relate Biology to Chemistry, Physics, Geography, and Agriculture",
     "Interdisciplinary chart, career pictures",
     [
         ("Introduction", "10 min", "Recaps basic terminology; asks why a farmer might need to understand Biology.", "Recall previous lesson; give a reason.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains the importance of Biology and its links to Chemistry, Physics, Geography, and Agriculture using the interdisciplinary chart.", "Take notes; give own examples.", "Correct identification of at least 2 links"),
         ("Design", "30 min", "Assigns groups a career picture (doctor, farmer, conservationist, lab technician) to prepare a short case study on how that career uses Biology.", "Discuss in groups; prepare and present a case study.", "Quality of group presentation"),
         ("Realization", "15 min", "Facilitates discussion comparing presentations; administers the Chapter 1 Review Test.", "Listen to peers; complete review test.", "Chapter 1 Review Test score")
     ]),
    # Term I - Week 2
    (3, "3", "IDENTIFY LABORATORY APPARATUS AND EQUIPMENT",
     "2.0 Demonstrate mastery of scientific processes and laboratory skills",
     "2.1 Identify laboratory apparatus and equipment",
     "Identify common Biology laboratory apparatus and state their uses",
     "Identify and state uses of common Biology apparatus (microscope, hand lens, forceps, Petri dish, test tubes)",
     "Real/labelled apparatus, microscope, hand lens",
     [
         ("Introduction", "10 min", "Displays a microscope and asks if learners know its use.", "Share initial ideas.", "Engagement"),
         ("Competence Development", "25 min", "Displays each apparatus item and explains its name, use, and safe handling.", "Observe and record uses in notebooks.", "Correct identification of apparatus"),
         ("Design", "30 min", "Guides an apparatus identification drill where groups rotate through stations naming and demonstrating correct handling of each item.", "Rotate through stations identifying apparatus.", "Apparatus Identification Test accuracy"),
         ("Realization", "15 min", "Administers the apparatus identification test.", "Complete identification test.", "Apparatus Identification Test score")
     ]),
    (4, "4", "DEMONSTRATE BASIC SCIENTIFIC SKILLS",
     "2.0 Demonstrate mastery of scientific processes and laboratory skills",
     "2.1 Demonstrate basic scientific skills",
     "Practice observation, measurement, recording, and specimen drawing",
     "Practice careful observation, accurate measurement, systematic recording, and labelled specimen drawing using real specimens",
     "Specimen samples, microscope, hand lens",
     [
         ("Introduction", "10 min", "Recaps apparatus names briefly; asks what makes a \"good\" scientific drawing.", "Recall previous lesson; share ideas.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates the skills of observation, measurement, recording, and specimen drawing using a sample specimen.", "Observe demonstration; take notes on skill standards.", "Correct application of each skill"),
         ("Design", "30 min", "Guides hands-on practice where groups observe, measure, and draw a given specimen following the demonstrated standards.", "Practice all four skills with specimens in groups.", "Skills Practical Checklist score"),
         ("Realization", "15 min", "Reviews sample drawings and measurements against the checklist criteria.", "Present work for feedback.", "Skills Practical Checklist score")
     ]),
    # Term I - Week 3
    (5, "5", "EXPLAIN THE STEPS OF THE SCIENTIFIC METHOD",
     "2.0 Demonstrate mastery of scientific processes and laboratory skills",
     "2.2 Explain the steps of the scientific method",
     "Explain the scientific method",
     "Describe the steps of the scientific method (observation, hypothesis, experiment, conclusion) with everyday examples",
     "Scientific method chart, textbook",
     [
         ("Introduction", "10 min", "Asks how a doctor figures out what is wrong with a patient.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Explains the steps of the scientific method using the chart and everyday examples.", "Take notes on each step.", "Correct sequencing of steps"),
         ("Design", "30 min", "Guides group practice writing a hypothesis and outlining an experiment for a given everyday question (e.g. \"Do plants need light?\").", "Write a hypothesis and outline an experiment in groups.", "Hypothesis-Writing Exercise accuracy"),
         ("Realization", "15 min", "Facilitates sharing of group hypotheses and gives feedback.", "Present hypotheses; receive feedback.", "Quality of hypothesis-writing")
     ]),
    (6, "6", "CONDUCT SIMPLE BIOLOGICAL EXPERIMENTS",
     "2.0 Demonstrate mastery of scientific processes and laboratory skills",
     "2.2 Conduct simple biological experiments",
     "Carry out a simple biological experiment following the scientific method",
     "Carry out a simple experiment (e.g. starch test on a leaf, or effect of light on plant growth) following the scientific method steps",
     "Iodine solution, leaves, potted plants",
     [
         ("Introduction", "10 min", "Recaps the scientific method steps and the hypothesis written in Period 1.", "Recall previous lesson.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates the starch test/light experiment step by step, following the scientific method.", "Observe demonstration; note each step.", "Correct following of method steps"),
         ("Design", "30 min", "Guides groups to carry out the experiment themselves and record observations and conclusions.", "Perform experiment in groups; record results.", "Practical Report quality"),
         ("Realization", "15 min", "Administers the Chapter 2 Review Test.", "Complete review test.", "Chapter 2 Review Test score")
     ]),
    # Term I - Week 4
    (7, "7", "DEFINE THE CELL AND DESCRIBE CELL THEORY",
     "3.0 Demonstrate mastery of cell structure and organization",
     "3.1 Define the cell and describe cell theory",
     "Explain the concept of the cell and cell theory",
     "Define a cell; describe the main points of cell theory (all living things are made of cells; the cell is the basic unit of life)",
     "Cell diagram chart, textbook",
     [
         ("Introduction", "10 min", "Asks learners what they think the smallest unit of a living thing is.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Defines a cell; explains cell theory using the chart.", "Take notes on cell theory.", "Correct statement of cell theory"),
         ("Design", "30 min", "Guides group discussion linking cell theory to real examples (single-celled vs multicellular organisms).", "Discuss examples in groups.", "Quality of group discussion"),
         ("Realization", "15 min", "Poses oral questions reviewing cell theory.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (8, "8", "IDENTIFY AND LABEL PARTS OF A GENERALIZED CELL",
     "3.0 Demonstrate mastery of cell structure and organization",
     "3.1 Identify and label parts of a generalized cell",
     "Identify and label parts of a generalized cell using the microscope and diagrams",
     "Identify and label the parts of a generalized cell (nucleus, cytoplasm, cell membrane, cell wall) using prepared slides and diagrams",
     "Microscope, prepared slides, cell diagram chart",
     [
         ("Introduction", "10 min", "Recaps cell theory briefly; asks what parts learners expect to see inside a cell.", "Recall and predict.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates using the microscope to view a prepared slide, pointing out and naming visible structures.", "Observe demonstration; take notes on parts.", "Correct naming of cell parts"),
         ("Design", "30 min", "Guides groups to use the microscope themselves and label a blank cell diagram based on their observations.", "Use microscope in groups; label diagrams.", "Diagram Labeling Test accuracy"),
         ("Realization", "15 min", "Reviews with a practical observation checklist.", "Complete checklist.", "Practical Observation Checklist score")
     ]),
    # Term I - Week 6
    (9, "9", "DISTINGUISH PLANT AND ANIMAL CELLS",
     "3.0 Demonstrate mastery of cell structure and organization",
     "3.2 Distinguish plant and animal cells",
     "Compare plant and animal cells",
     "Distinguish plant and animal cells based on structure (cell wall, chloroplast, vacuole) using onion and cheek cell slides",
     "Microscope, onion/cheek cell slides",
     [
         ("Introduction", "10 min", "Asks if a plant cell and an animal cell look the same.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Explains structural differences between plant and animal cells using the comparison chart.", "Take notes; observe comparison chart.", "Correct differentiation"),
         ("Design", "30 min", "Guides microscope observation of onion cells (plant) and cheek cells (animal), with comparative diagram drawing.", "Observe slides in groups; draw comparative diagrams.", "Diagram Comparison Test accuracy"),
         ("Realization", "15 min", "Reviews with a T-chart evaluation comparing plant and animal cells.", "Complete T-chart.", "T-Chart Evaluation score")
     ]),
    (10, "10", "DISTINGUISH PROKARYOTIC AND EUKARYOTIC CELLS",
     "3.0 Demonstrate mastery of cell structure and organization",
     "3.2 Distinguish prokaryotic and eukaryotic cells",
     "Compare prokaryotic and eukaryotic cells",
     "Distinguish prokaryotic and eukaryotic cells based on the presence/absence of a true nucleus and other membrane-bound organelles",
     "Comparison chart, textbook",
     [
         ("Introduction", "10 min", "Recaps plant vs animal cells; asks if bacteria have the same cell structure.", "Recall and predict.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains the key difference between prokaryotic (no true nucleus) and eukaryotic (true nucleus) cells using the comparison chart.", "Take notes; copy comparison chart.", "Correct differentiation"),
         ("Design", "30 min", "Guides group construction of a T-chart comparing prokaryotic and eukaryotic cells, using bacteria and plant/animal cells as examples.", "Build T-chart in groups.", "T-Chart Evaluation accuracy"),
         ("Realization", "15 min", "Administers a diagram comparison test covering all cell type distinctions from the week.", "Complete comparison test.", "Diagram Comparison Test score")
     ]),
    # Term I - Week 7
    (11, "11", "EXPLAIN ORGANIZATION FROM CELL TO TISSUE TO ORGAN",
     "3.0 Demonstrate mastery of cell structure and organization",
     "3.3 Explain organization from cell to tissue to organ",
     "Explain the levels of organization from cell to organ",
     "Describe organization from cell → tissue → organ, with human and plant examples (e.g. muscle cells → muscle tissue → heart)",
     "Organization-level chart, textbook",
     [
         ("Introduction", "10 min", "Asks learners to name body parts (organs) they know.", "Share examples.", "Engagement"),
         ("Competence Development", "25 min", "Explains the levels cell → tissue → organ with the chart, using the heart and a leaf as examples.", "Take notes; give own examples.", "Correct sequencing of first three levels"),
         ("Design", "30 min", "Guides pair construction of a partial sequence diagram (cell to organ) using given examples.", "Build sequence diagram in pairs.", "Sequence Diagram accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing the sequence.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (12, "12", "EXPLAIN ORGANIZATION FROM ORGAN SYSTEM TO ORGANISM",
     "3.0 Demonstrate mastery of cell structure and organization",
     "3.3 Explain organization from organ system to organism",
     "Explain the complete levels of organization up to the organism",
     "Describe organization from organ → organ system → organism, with human/plant examples; consolidate the full sequence from cell to organism",
     "Organization-level chart, textbook",
     [
         ("Introduction", "10 min", "Recaps cell → tissue → organ; asks what other organs work with the heart.", "Recall previous lesson; respond.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains organ → organ system → organism with examples (heart + blood vessels = circulatory system).", "Take notes; give own examples.", "Correct sequencing of full hierarchy"),
         ("Design", "30 min", "Guides pair/group construction of the complete sequence diagram from cell to organism using human and plant examples.", "Build the full sequence diagram in groups.", "Sequence Diagram Test accuracy"),
         ("Realization", "15 min", "Administers the Chapter 3 Review Test.", "Complete review test.", "Chapter 3 Review Test score")
     ]),
    # Term II - Week 1
    (13, "13", "DEFINE CLASSIFICATION AND EXPLAIN ITS REASONS",
     "4.0 Demonstrate mastery of classification of living things",
     "4.1 Define classification and explain its reasons",
     "Explain the concept and reasons for classification",
     "Define classification; explain reasons for classifying organisms (identification, study, understanding relationships)",
     "Assorted specimen pictures, textbook",
     [
         ("Introduction", "10 min", "Asks how learners might sort a mixed pile of objects at home.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Defines classification; explains the reasons for classifying living things.", "Take notes.", "Correct explanation of reasons"),
         ("Design", "30 min", "Guides a sorting/grouping activity using specimen pictures, letting groups create their own sorting criteria first.", "Sort specimens into groups; explain their criteria.", "Sorting Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions comparing group sorting criteria.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (14, "14", "DESCRIBE ARTIFICIAL AND NATURAL CLASSIFICATION SYSTEMS",
     "4.0 Demonstrate mastery of classification of living things",
     "4.1 Describe artificial and natural classification systems",
     "Compare artificial and natural classification systems",
     "Describe artificial classification (based on convenience, e.g. size/colour) versus natural classification (based on evolutionary relationships)",
     "Classification chart, textbook",
     [
         ("Introduction", "10 min", "Recaps their own sorting criteria from Period 1; asks if scientists sort organisms the same way.", "Recall previous lesson; predict.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains artificial vs natural classification systems with the chart and examples.", "Take notes.", "Correct differentiation of systems"),
         ("Design", "30 min", "Guides group discussion re-sorting the Period 1 specimens using natural classification criteria instead of their own.", "Re-sort specimens using natural classification in groups.", "Sorting Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions consolidating both systems.", "Answer oral questions.", "Accuracy of responses")
     ]),
    # Term II - Week 2
    (15, "15", "OUTLINE THE MAJOR GROUPS OF LIVING THINGS",
     "4.0 Demonstrate mastery of classification of living things",
     "4.2 Outline the major groups/kingdoms of living things",
     "Describe the major groups of living things",
     "Outline the five kingdoms of living things (Monera, Protoctista, Fungi, Plantae, Animalia) with one distinguishing feature and example of each",
     "Five-kingdom chart, textbook",
     [
         ("Introduction", "10 min", "Asks learners to name any groups they think living things fall into.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Outlines the five kingdoms using the chart, giving one feature and example of each.", "Take notes; copy chart.", "Correct outline of the five kingdoms"),
         ("Design", "30 min", "Guides a group classification chart activity sorting given organism cards into the correct kingdom.", "Sort organism cards into kingdoms in groups.", "Classification accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing kingdom features.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (16, "16", "APPLY BINOMIAL NOMENCLATURE",
     "4.0 Demonstrate mastery of classification of living things",
     "4.2 Apply binomial nomenclature",
     "State and apply the rules of binomial nomenclature",
     "State the rules of binomial nomenclature (genus capitalized, species lowercase, italicized/underlined); apply the rules to correctly name given organisms",
     "Naming rule examples, textbook",
     [
         ("Introduction", "10 min", "Recaps the five kingdoms; asks learners if they know a scientific name for any organism (e.g. Homo sapiens).", "Recall previous lesson; share known names.", "Recall accuracy"),
         ("Competence Development", "25 min", "States and explains the binomial nomenclature rules with worked examples.", "Take notes; practice writing examples correctly.", "Correct application of naming rules"),
         ("Design", "30 min", "Guides a naming-rules drill in pairs where learners correct improperly written scientific names and name given organisms correctly.", "Practice naming organisms in pairs.", "Naming Exercise accuracy"),
         ("Realization", "15 min", "Administers the Chapter 4 Review Test.", "Complete review test.", "Chapter 4 Review Test score")
     ]),
    # Term II - Week 3
    (17, "17", "DESCRIBE THE STRUCTURE AND EFFECTS OF VIRUSES",
     "5.0 Demonstrate mastery of viruses and the major groups of living things",
     "5.1 Describe the structure and effects of viruses",
     "Explain viruses",
     "Describe the structure of a virus; explain its characteristics and effects on living organisms (e.g. common cold, influenza)",
     "Virus diagrams and pictures, textbook",
     [
         ("Introduction", "10 min", "Asks what learners know about diseases caused by tiny organisms (e.g. flu).", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Describes virus structure (protein coat, genetic material) and characteristics using diagrams and pictures.", "Observe pictures; take notes.", "Correct description of virus structure"),
         ("Design", "30 min", "Guides diagram drawing and group discussion on the effects of specific viral diseases learners may know.", "Draw virus diagram; discuss disease effects in groups.", "Diagram Labeling Test accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing virus structure and effects.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (18, "18", "DESCRIBE KINGDOM MONERA",
     "5.0 Demonstrate mastery of viruses and the major groups of living things",
     "5.1 Describe Kingdom Monera",
     "Explain the characteristics of Kingdom Monera",
     "Describe the characteristics of Kingdom Monera (bacteria) and give examples of beneficial and harmful bacteria",
     "Bacteria diagrams and pictures, textbook",
     [
         ("Introduction", "10 min", "Recaps viruses briefly; asks if bacteria are the same as viruses.", "Recall previous lesson; respond.", "Recall accuracy"),
         ("Competence Development", "25 min", "Describes characteristics of Kingdom Monera using pictures, distinguishing bacteria from viruses.", "Observe pictures; take notes.", "Correct description of bacterial characteristics"),
         ("Design", "30 min", "Guides group discussion classifying given examples into beneficial (yoghurt-making) or harmful (disease-causing) bacteria.", "Classify examples in groups; discuss.", "Oral Questions accuracy"),
         ("Realization", "15 min", "Administers a short quiz on viruses and Kingdom Monera.", "Complete short quiz.", "Quiz score")
     ]),
    # Term II - Week 4
    (19, "19", "DESCRIBE KINGDOM PROTOCTISTA",
     "5.0 Demonstrate mastery of viruses and the major groups of living things",
     "5.2 Describe Kingdom Protoctista",
     "Explain the characteristics of Kingdom Protoctista",
     "Describe characteristics of Kingdom Protoctista with examples (Amoeba, algae) and their habitats",
     "Protoctista specimens or pictures, microscope",
     [
         ("Introduction", "10 min", "Shows a picture of pond water and asks what tiny living things might be in it.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Describes Protoctista characteristics using Amoeba and algae as examples, with pictures/microscope images.", "Observe pictures/specimens; take notes.", "Correct description of characteristics"),
         ("Design", "30 min", "Guides microscope/picture observation of Protoctista examples and group discussion of their habitats.", "Observe specimens in groups; discuss habitats.", "Comparison Chart Evaluation quality"),
         ("Realization", "15 min", "Poses oral questions reviewing Protoctista features.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (20, "20", "DESCRIBE KINGDOM FUNGI",
     "5.0 Demonstrate mastery of viruses and the major groups of living things",
     "5.2 Describe Kingdom Fungi",
     "Explain the characteristics of Kingdom Fungi",
     "Describe characteristics of Kingdom Fungi with examples (mushroom, yeast, mould) and compare with Protoctista",
     "Fungi specimens or pictures, microscope",
     [
         ("Introduction", "10 min", "Shows a picture of mould on bread and asks what it is.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Describes Kingdom Fungi characteristics using mushroom, yeast, and mould as examples.", "Observe specimens/pictures; take notes.", "Correct description of fungal characteristics"),
         ("Design", "30 min", "Guides construction of a comparative chart contrasting Protoctista and Fungi based on both lessons this week.", "Build comparative chart in groups.", "Comparison Chart Evaluation quality"),
         ("Realization", "15 min", "Administers a short quiz covering Protoctista and Fungi.", "Complete short quiz.", "Quiz score")
     ]),
    # Term II - Week 5
    (21, "21", "DESCRIBE CHARACTERISTICS OF KINGDOM PLANTAE",
     "5.0 Demonstrate mastery of viruses and the major groups of living things",
     "5.3 Describe characteristics of Kingdom Plantae",
     "Explain the characteristics of Kingdom Plantae",
     "Describe general characteristics of Kingdom Plantae (multicellular, chlorophyll-containing, cell wall present)",
     "Plant specimens, textbook",
     [
         ("Introduction", "10 min", "Asks what all plants around the school compound have in common.", "Share observations.", "Engagement"),
         ("Competence Development", "25 min", "Describes the general characteristics of Kingdom Plantae with plant specimens as examples.", "Take notes; examine plant specimens.", "Correct description of plant characteristics"),
         ("Design", "30 min", "Guides group observation of various plant specimens, identifying the shared characteristics discussed.", "Examine specimens in groups; record shared features.", "Observation accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing Kingdom Plantae characteristics.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (22, "22", "CLASSIFY CLASSES OF ANGIOSPERMOPHYTA",
     "5.0 Demonstrate mastery of viruses and the major groups of living things",
     "5.3 Classify classes of Angiospermophyta",
     "Distinguish Monocotyledonae and Dicotyledonae",
     "Distinguish Monocotyledonae and Dicotyledonae classes based on leaf venation, root type, and seed structure, using field/garden examples",
     "Plant specimens (monocot/dicot samples), classification chart",
     [
         ("Introduction", "10 min", "Shows a maize leaf and a bean leaf; asks if they look the same.", "Share observations.", "Engagement"),
         ("Competence Development", "25 min", "Explains distinguishing features of monocots and dicots (leaf venation, roots, seeds) using the classification chart.", "Take notes; compare sample leaves.", "Correct distinction of classes"),
         ("Design", "30 min", "Guides plant specimen observation and comparative table construction using monocot/dicot samples brought from the school garden/field.", "Observe specimens in groups; build comparison table.", "Comparison Table accuracy"),
         ("Realization", "15 min", "Administers a specimen identification test.", "Complete identification test.", "Specimen Identification Test score")
     ]),
    # Term II - Week 6
    (23, "23", "DESCRIBE CHARACTERISTICS OF INVERTEBRATES",
     "5.0 Demonstrate mastery of viruses and the major groups of living things",
     "5.4 Describe characteristics of invertebrates",
     "Explain the characteristics of invertebrates",
     "Describe characteristics of invertebrates (no backbone) and classify examples into major invertebrate phyla (insects, worms, molluscs)",
     "Animal group pictures/charts, textbook",
     [
         ("Introduction", "10 min", "Asks learners to name animals without a backbone that they've seen (insects, worms).", "Share examples.", "Engagement"),
         ("Competence Development", "25 min", "Describes invertebrate characteristics and major phyla using picture charts.", "Observe pictures; take notes.", "Correct differentiation of phyla"),
         ("Design", "30 min", "Guides picture/specimen sorting where groups classify given invertebrate examples into their correct phylum.", "Sort animals into groups; justify classification.", "Classification Test accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing invertebrate classification.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (24, "24", "DESCRIBE CHARACTERISTICS OF VERTEBRATES",
     "5.0 Demonstrate mastery of viruses and the major groups of living things",
     "5.4 Describe characteristics of vertebrates",
     "Explain the characteristics of vertebrates",
     "Describe characteristics of vertebrates (backbone present) and classify examples into major vertebrate classes (fish, amphibians, reptiles, birds, mammals)",
     "Animal group pictures/charts, textbook",
     [
         ("Introduction", "10 min", "Recaps invertebrates briefly; asks learners to name animals with a backbone.", "Recall previous lesson; give examples.", "Recall accuracy"),
         ("Competence Development", "25 min", "Describes the five vertebrate classes and their distinguishing features using picture charts.", "Observe pictures; take notes.", "Correct differentiation of classes"),
         ("Design", "30 min", "Guides group classification chart activity sorting vertebrate examples into their classes, followed by a group presentation summarizing invertebrates vs vertebrates.", "Sort animals into classes; prepare group presentation.", "Group Presentation Rubric score"),
         ("Realization", "15 min", "Administers the Chapter 5 Review Test.", "Complete review test.", "Chapter 5 Review Test score")
     ]),
    # Term II - Week 8
    (25, "25", "EXPLAIN THE CONCEPT OF NUTRITION",
     "6.0 Demonstrate mastery of nutrition in plants",
     "6.1 Explain the concept of nutrition",
     "Explain the concept of nutrition in plants",
     "Define nutrition; explain how plants obtain and use nutrients differently from animals",
     "Plant nutrient chart, textbook",
     [
         ("Introduction", "10 min", "Asks how plants \"eat\" since they have no mouths.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Defines nutrition; explains how plants absorb nutrients through roots and manufacture food via photosynthesis.", "Take notes.", "Correct explanation of plant nutrition"),
         ("Design", "30 min", "Guides group discussion comparing plant and animal nutrition methods using the nutrient chart.", "Discuss comparisons in groups.", "Quality of group discussion"),
         ("Realization", "15 min", "Poses oral questions reviewing the concept of nutrition.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (26, "26", "DISTINGUISH ESSENTIAL AND NON-ESSENTIAL ELEMENTS",
     "6.0 Demonstrate mastery of nutrition in plants",
     "6.1 Distinguish essential and non-essential elements",
     "Explain essential and non-essential elements and their deficiency symptoms",
     "Distinguish essential and non-essential elements (macro/micro nutrients) in plants and their roles; identify deficiency symptoms",
     "Deficiency symptom pictures, plant nutrient chart",
     [
         ("Introduction", "10 min", "Shows a picture of a yellowing plant and asks why it looks unhealthy.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Explains essential vs non-essential elements, macro/micro nutrients, and their roles in plant growth.", "Take notes.", "Correct classification of nutrients"),
         ("Design", "30 min", "Guides a deficiency-symptom picture matching activity, linking symptoms (yellowing, stunted growth) to missing nutrients.", "Match symptoms to deficiencies in pairs.", "Matching Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions consolidating nutrient roles and deficiencies.", "Answer oral questions.", "Accuracy of responses")
     ]),
    # Term II - Week 9
    (27, "27", "STATE THE EQUATION AND REQUIREMENTS OF PHOTOSYNTHESIS",
     "6.0 Demonstrate mastery of nutrition in plants",
     "6.2 State the equation and requirements of photosynthesis",
     "Explain the process of photosynthesis",
     "State the word and chemical equation of photosynthesis; describe its requirements (light, water, carbon dioxide, chlorophyll)",
     "Photosynthesis equation chart, textbook",
     [
         ("Introduction", "10 min", "Asks how plants make their own food.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "States the word and chemical equation of photosynthesis; explains each requirement using the equation chart.", "Take notes; copy the equation.", "Correct writing of the equation"),
         ("Design", "30 min", "Guides group discussion identifying where each requirement (light, water, CO2, chlorophyll) comes from in a real plant.", "Discuss requirements in groups.", "Equation Writing Test accuracy"),
         ("Realization", "15 min", "Administers an equation-writing test.", "Complete equation-writing test.", "Equation Writing Test score")
     ]),
    (28, "28", "TEST A LEAF FOR STARCH AS EVIDENCE OF PHOTOSYNTHESIS",
     "6.0 Demonstrate mastery of nutrition in plants",
     "6.2 Test a leaf for starch as evidence of photosynthesis",
     "Carry out a leaf starch test experiment",
     "Perform the iodine starch test on a leaf, following correct experimental steps, and relate the colour change result to photosynthesis",
     "Iodine solution, leaves, Bunsen burner/hot water bath",
     [
         ("Introduction", "10 min", "Recaps the photosynthesis equation briefly; asks how one could prove a leaf has made starch.", "Recall previous lesson; predict a method.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates the starch test procedure step by step (boiling leaf, decolorizing, applying iodine).", "Observe demonstration; note each step.", "Correct sequencing of test steps"),
         ("Design", "30 min", "Guides groups to carry out the starch test themselves and record the colour change observed.", "Perform the test in groups; record results.", "Practical Report quality"),
         ("Realization", "15 min", "Leads discussion relating the result to the photosynthesis equation; reviews the week's learning.", "Discuss findings; contribute to review.", "Accuracy of interpretation")
     ]),
    # Term II - Week 10
    (29, "29", "RELATE LEAF STRUCTURE TO PHOTOSYNTHESIS",
     "6.0 Demonstrate mastery of nutrition in plants",
     "6.3 Relate leaf structure to photosynthesis",
     "Describe internal and external leaf structure in relation to photosynthesis",
     "Describe internal/external leaf structure (stomata, palisade/spongy mesophyll, chlorophyll) and relate each part's function to photosynthesis",
     "Microscope, leaf cross-section slides/diagram",
     [
         ("Introduction", "10 min", "Asks why leaves are usually broad, thin, and green.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Describes internal/external leaf structures and their functions using the leaf cross-section diagram.", "Take notes; observe diagram.", "Correct labeling of leaf structures"),
         ("Design", "30 min", "Guides microscope observation of leaf cross-section slides and diagram labeling in groups.", "Observe slides in groups; label diagrams.", "Diagram Labeling Test accuracy"),
         ("Realization", "15 min", "Poses oral questions linking leaf structure to photosynthesis function.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (30, "30", "EXPLAIN THE IMPORTANCE OF PHOTOSYNTHESIS",
     "6.0 Demonstrate mastery of nutrition in plants",
     "6.3 Explain the importance of photosynthesis",
     "Explain the importance of photosynthesis to plants and other living things",
     "Explain the importance of photosynthesis (food production, oxygen release, energy source for food chains) to plants and to other living things, including humans",
     "Textbook, photosynthesis importance chart",
     [
         ("Introduction", "10 min", "Recaps leaf structure briefly; asks what would happen if all plants disappeared.", "Recall previous lesson; predict consequences.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains the importance of photosynthesis for plants, oxygen supply, and food chains, using the importance chart.", "Take notes.", "Correct explanation of importance"),
         ("Design", "30 min", "Guides group discussion/poster activity summarizing why photosynthesis matters to all living things, drawing on the whole chapter (nutrition, elements, equation, leaf structure).", "Discuss and summarize in groups; create a simple summary poster.", "Quality of group summary"),
         ("Realization", "15 min", "Administers the Chapter 6 Review Test, concluding the Biology syllabus for the year.", "Complete review test.", "Chapter 6 Review Test score")
     ])
]

bio_lessons = []
for num, sr, topic, mc, sc, ma, sa, res, stages in bio_lessons_data:
    bio_lessons.append({
        "title": f"BIOLOGY FORM ONE LESSON PLAN NO. {num}: {topic}",
        "sr_no": sr,
        "time": "80 min",
        "main_competence": mc,
        "specific_competence": sc,
        "main_activity": ma,
        "specific_activity": sa,
        "teaching_learning_resources": res,
        "references": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: Tanzania Institute of Education.",
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

bio_doc = {
    "subject_name": "Biology",
    "subject_slug": "biology",
    "form_level": 1,
    "standard": "Form 1",
    "tie_reference": "TIE (2026). Biology for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
    "source_note": "Verified Biology Form One lesson plans (Arusha Catholic Seminary). 30 lesson plans (80 min double periods, 2 per week) covering Term I (Introduction to Biology, Laboratory Apparatus & Scientific Skills, Scientific Method & Experiments, The Cell, Types of Cells, Cell Organization) and Term II (Concept & Systems of Classification, Major Groups & Binomial Nomenclature, Viruses & Kingdom Monera, Kingdoms Protoctista & Fungi, Kingdom Plantae & Angiospermophyta, Kingdom Animalia, Nutrition & Elements in Plants, Photosynthesis, Leaf Structure & Importance).",
    "lessons": bio_lessons
}

with open(REF_DIR / "biology_form_one_scheme.json", "w", encoding="utf-8") as f:
    json.dump(bio_scheme, f, indent=2, ensure_ascii=False)

with open(REF_DIR / "biology_form_one.json", "w", encoding="utf-8") as f:
    json.dump(bio_doc, f, indent=2, ensure_ascii=False)

print("Generated biology_form_one_scheme.json and biology_form_one.json")
