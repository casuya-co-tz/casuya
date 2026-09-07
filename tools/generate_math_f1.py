import json
from pathlib import Path

REF_DIR = Path(r"c:\Users\Admin\Desktop\casuya\apps\platform\database\seeds\data\reference")
REF_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------------------
# MATHEMATICS FORM ONE SCHEME OF WORK
# -----------------------------------------------------------------------------
math_scheme_term1 = [
    {
        "topic": "Concept of Mathematics",
        "one": "1.0 Demonstrate mastery of foundational mathematical concepts",
        "two": "1.1 Explain the meaning, branches, and importance of Mathematics",
        "three": "Explain the concept, branches, and importance of Mathematics",
        "four": "Define Mathematics, classify branches (Arithmetic, Algebra, Geometry, Statistics), relate to other subjects and daily life (2 periods)",
        "five": "",
        "six": "Week 1",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Interactive lecture, concept-mapping activity, career case studies",
        "ten": "Textbook, branch-classification chart, career flashcards",
        "eleven": "Oral Questions, Presentation rubric, Chapter 1 Review Test",
        "twelve": ""
    },
    {
        "topic": "Numbers: Classification",
        "one": "2.0 Demonstrate mastery of the number system",
        "two": "2.1 Classify natural numbers, whole numbers, integers, rational and irrational numbers",
        "three": "Explain the concept of numbers and their classifications",
        "four": "Classify natural, whole, integers on number line; define rational and irrational numbers (2 periods)",
        "five": "",
        "six": "Week 2",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Number line demonstration, card sorting drill, pair classification exercises",
        "ten": "Number classification chart, number line, textbook",
        "eleven": "Notebook Check, Classification Test",
        "twelve": ""
    },
    {
        "topic": "Real Numbers and Inequalities",
        "one": "2.0 Demonstrate mastery of the number system",
        "two": "2.2 Explain real numbers and represent inequalities",
        "three": "Describe real numbers and represent inequalities on number line",
        "four": "Describe real number system (union of rational & irrational); solve and represent inequalities using <, >, <=, >= (2 periods)",
        "five": "",
        "six": "Week 3",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Venn diagram illustration, pair problem-solving, number line graphing",
        "ten": "Real number system diagram, number line chart, textbook",
        "eleven": "Oral Questions, Written Exercise, Short Quiz",
        "twelve": ""
    },
    {
        "topic": "Absolute Value",
        "one": "2.0 Demonstrate mastery of the number system",
        "two": "2.3 Define and determine absolute value and solve related problems",
        "three": "Explain meaning of absolute value and apply to problem-solving",
        "four": "Define absolute value as distance from zero; calculate |x| and solve simple equations/word problems (2 periods)",
        "five": "",
        "six": "Week 4",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Board demonstration, pair worksheet practice, consolidation drills",
        "ten": "Number line, worked example sheets, textbook",
        "eleven": "Calculation Exercise, Chapter 2 Review Test",
        "twelve": ""
    },
    {
        "topic": "Approximation and Rounding",
        "one": "3.0 Demonstrate mastery of approximation techniques",
        "two": "3.1 Explain meaning of approximation and round off numbers",
        "three": "Explain purpose of approximation and round off numbers",
        "four": "Define approximation; round off to nearest whole number, tens, hundreds, and decimal places (2 periods)",
        "five": "",
        "six": "Week 6",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Real-life estimation scenarios, rounding drills in pairs, board demonstration",
        "ten": "Rounding rules chart, textbook, worked examples",
        "eleven": "Oral Questions, Rounding Exercise",
        "twelve": ""
    },
    {
        "topic": "Significant Figures and Applied Approximation",
        "one": "3.0 Demonstrate mastery of approximation techniques",
        "two": "3.2 Determine significant figures and apply approximations in calculations",
        "three": "Apply rules for significant figures and solve real-life estimation problems",
        "four": "State rules for significant figures, round to given sig figs, and solve multi-step estimation tasks (2 periods)",
        "five": "",
        "six": "Week 7",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Worked examples, pair rounding drills, estimation task cards in groups",
        "ten": "Significant-figure rules chart, textbook, real-life task cards",
        "eleven": "Significant Figures Test, Estimation Exercise, Chapter 3 Review Test",
        "twelve": ""
    }
]

math_scheme_term2 = [
    {
        "topic": "Ratios",
        "one": "4.0 Demonstrate mastery of ratios and proportions",
        "two": "4.1 Define, express, and apply ratios",
        "three": "Explain the concept of ratio and solve sharing problems",
        "four": "Define ratio, simplify to lowest terms, and solve real-life sharing problems (2 periods)",
        "five": "",
        "six": "Week 1",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Concrete sharing with counters, worked examples, group problem-solving",
        "ten": "Counters/objects, ratio worked examples, textbook",
        "eleven": "Oral Questions, Ratio Problem-Solving Exercise",
        "twelve": ""
    },
    {
        "topic": "Proportions",
        "one": "4.0 Demonstrate mastery of ratios and proportions",
        "two": "4.2 Explain direct and inverse proportions",
        "three": "Explain and solve problems involving direct and inverse proportions",
        "four": "Define direct & inverse proportion; solve recipe/cost and speed/time/worker problems (2 periods)",
        "five": "",
        "six": "Week 2",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Real-life proportional scenarios, worked examples, comparative pair work",
        "ten": "Proportion worked examples, textbook",
        "eleven": "Oral Questions, Proportion Problem-Solving Exercise, Chapter 4 Review Test",
        "twelve": ""
    },
    {
        "topic": "Algebraic Expressions",
        "one": "5.0 Demonstrate mastery of algebraic manipulation and equations",
        "two": "5.1 Form and simplify algebraic expressions",
        "three": "Form algebraic expressions from word statements and simplify by collecting like terms",
        "four": "Define term/coefficient/variable; translate word problems; identify and combine like terms (2 periods)",
        "five": "",
        "six": "Week 3",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Symbolic representation drills, pair matching of word problems to expressions, practice worksheets",
        "ten": "Algebra worked examples, textbook",
        "eleven": "Matching accuracy, Simplification Exercise, Short Quiz",
        "twelve": ""
    },
    {
        "topic": "Algebraic Equations",
        "one": "5.0 Demonstrate mastery of algebraic manipulation and equations",
        "two": "5.2 Form and solve linear equations",
        "three": "Form linear equations from word problems and solve using inverse operations",
        "four": "Translate word problems into linear equations in one unknown; solve equations step by step (2 periods)",
        "five": "",
        "six": "Week 4",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Word problem translation demonstration, pair practice, inverse operation drills",
        "ten": "Equation worked examples, textbook",
        "eleven": "Equation formation accuracy, Equation-Solving Exercise, Short Quiz",
        "twelve": ""
    },
    {
        "topic": "Simultaneous Equations",
        "one": "5.0 Demonstrate mastery of algebraic manipulation and equations",
        "two": "5.3 Solve linear simultaneous equations by elimination and substitution",
        "three": "Solve simultaneous equations using elimination and substitution methods",
        "four": "Apply elimination method; apply substitution method; compare both methods for efficiency (2 periods)",
        "five": "",
        "six": "Week 5",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Step-by-step board demonstrations, pair problem sets, method comparison discussion",
        "ten": "Simultaneous equation worked examples, textbook",
        "eleven": "Oral Questions, Problem-Solving Exercise, Written Test",
        "twelve": ""
    },
    {
        "topic": "Linear Inequalities",
        "one": "5.0 Demonstrate mastery of algebraic manipulation and equations",
        "two": "5.4 Solve linear inequalities and represent solutions on a number line",
        "three": "Solve simple linear inequalities and represent solution sets graphically",
        "four": "Solve inequalities with sign-flip rule for negatives; represent with open/closed circles on number line (2 periods)",
        "five": "",
        "six": "Week 6",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Sign-flip rule demonstration, number line graphing drills, pair worksheet practice",
        "ten": "Inequality worked examples, number line chart, textbook",
        "eleven": "Inequality-Solving Exercise, Chapter 5 Review Test",
        "twelve": ""
    },
    {
        "topic": "Coordinate Geometry Basics and Gradient",
        "one": "6.0 Demonstrate mastery of coordinate geometry",
        "two": "6.1 Describe Cartesian plane, plot points, and determine gradient",
        "three": "Explain Cartesian plane, plot points, and calculate line gradient",
        "four": "Describe axes and origin; plot points on graph paper; calculate gradient using formula (2 periods)",
        "five": "",
        "six": "Week 8",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Classroom grid analogy, graph paper plotting in pairs, slope comparison and gradient calculation",
        "ten": "Graph papers, Cartesian plane chart, textbook",
        "eleven": "Plotting Exercise, Gradient Calculation Test",
        "twelve": ""
    },
    {
        "topic": "Equation of a Straight Line",
        "one": "6.0 Demonstrate mastery of coordinate geometry",
        "two": "6.2 Derive and express equation of a straight line",
        "three": "Derive equation in slope-intercept form and express in general form",
        "four": "Derive y = mx + c from gradient/intercept and 2 points; convert between y = mx + c and ax + by + c = 0 (2 periods)",
        "five": "",
        "six": "Week 9",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Guided algebraic derivation, pair practice converting forms, board Q&A",
        "ten": "Graph papers, worked example sheets, textbook",
        "eleven": "Equation Derivation Exercise, Written Test",
        "twelve": ""
    },
    {
        "topic": "Graphing Linear Equations and Graphical Solutions",
        "one": "6.0 Demonstrate mastery of coordinate geometry",
        "two": "6.3 Graph linear equations and solve simultaneous equations graphically",
        "three": "Draw graphs using tables of values and solve simultaneous equations by intersection",
        "four": "Construct table of values and draw linear graph; find intersection point of two linear graphs (2 periods)",
        "five": "",
        "six": "Week 10",
        "seven": "2",
        "eight": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
        "nine": "Table construction demonstration, pair graph drawing with rulers, graphical verification of solutions",
        "ten": "Graph papers, rulers, textbook",
        "eleven": "Graph Plotting Exercise, Chapter 6 Review Test",
        "twelve": ""
    }
]

math_scheme = {
    "subject_name": "Mathematics",
    "subject_slug": "mathematics",
    "form_level": 1,
    "standard": "Form 1",
    "tie_reference": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
    "source_note": "Verified Basic Mathematics Form One scheme of work for Term I and Term II (TIE curriculum). Verbatim educator-verified table (Arusha Catholic Seminary). Term I covers Concept of Mathematics, Numbers Classification, Real Numbers and Inequalities, Absolute Value, Approximation & Rounding, and Significant Figures. Term II covers Ratios, Proportions, Algebraic Expressions, Linear Equations, Simultaneous Equations, Inequalities, and Coordinate Geometry (Cartesian Plane, Gradient, Equation of Straight Line, Graphing Linear Equations).",
    "schemes": [
        {
            "title": "BASIC MATHEMATICS FORM ONE SCHEME OF WORK TERM 1 (2026)",
            "term": 1,
            "standard": "Form 1",
            "source_id": "basic-mathematics-form-one-scheme-term-1",
            "scheme_of_work_details": math_scheme_term1
        },
        {
            "title": "BASIC MATHEMATICS FORM ONE SCHEME OF WORK TERM 2 (2026)",
            "term": 2,
            "standard": "Form 1",
            "source_id": "basic-mathematics-form-one-scheme-term-2",
            "scheme_of_work_details": math_scheme_term2
        }
    ]
}

# -----------------------------------------------------------------------------
# MATHEMATICS FORM ONE LESSON PLANS (30 Lesson Plans)
# -----------------------------------------------------------------------------
math_lessons_data = [
    # Term I - Week 1
    (1, "1", "MEANING AND BRANCHES OF MATHEMATICS",
     "1.0 Demonstrate mastery of foundational mathematical concepts",
     "1.1 Explain the meaning and branches of Mathematics",
     "Explain the meaning and branches of Mathematics",
     "Define Mathematics; classify its branches (Arithmetic, Algebra, Geometry, Statistics) with examples of what each branch studies",
     "Textbook, branch-classification chart",
     [
         ("Introduction", "10 min", "Asks learners where they used numbers or shapes on their way to school.", "Share examples.", "Engagement"),
         ("Competence Development", "25 min", "Defines Mathematics; introduces the four branches with the classification chart and one example problem per branch.", "Take notes; copy branch chart.", "Correct definition and branch listing"),
         ("Design", "30 min", "Guides a concept-mapping activity where groups sort given problems (e.g. \"measuring a plot,\" \"solving for x,\" \"average rainfall\") under the correct branch.", "Build concept map in groups matching problems to branches.", "Correct placement under branches"),
         ("Realization", "15 min", "Poses oral questions asking learners to justify their group's placements.", "Answer oral questions.", "Accuracy and reasoning of responses")
     ]),
    (2, "2", "RELATE MATHEMATICS TO OTHER SUBJECTS AND EXPLAIN ITS IMPORTANCE",
     "1.0 Demonstrate mastery of foundational mathematical concepts",
     "1.1 Relate Mathematics to other subjects and explain its importance",
     "Explain the relationship between Mathematics and other subjects and its importance",
     "Relate Mathematics to Science, Economics, and Geography; discuss the importance of Mathematics in daily life and in careers",
     "Career flashcards, textbook",
     [
         ("Introduction", "10 min", "Recaps the four branches; asks how a shopkeeper uses Mathematics daily.", "Recall previous lesson; give an example.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains links between Mathematics and Science, Economics, and Geography with concrete examples of each.", "Take notes; give own examples.", "Correct identification of at least 2 links"),
         ("Design", "30 min", "Assigns groups a career flashcard (engineer, accountant, pilot, nurse) to prepare a short case study on how that career uses Mathematics.", "Discuss in groups; prepare and present a case study.", "Quality of group presentation"),
         ("Realization", "15 min", "Facilitates discussion comparing presentations; administers the Chapter 1 Review Test.", "Listen to peers; complete review test.", "Chapter 1 Review Test score")
     ]),
    # Term I - Week 2
    (3, "3", "CLASSIFY NATURAL NUMBERS, WHOLE NUMBERS, AND INTEGERS",
     "2.0 Demonstrate mastery of the number system",
     "2.1 Classify natural numbers, whole numbers, and integers",
     "Explain the concept of numbers and their basic classifications",
     "Define a number; classify natural numbers, whole numbers, and integers with examples on a number line",
     "Number classification chart, number line",
     [
         ("Introduction", "10 min", "Asks learners to list any five numbers they use in a typical day.", "Give examples.", "Engagement"),
         ("Competence Development", "25 min", "Defines natural numbers, whole numbers, and integers, showing each set on the number line.", "Take notes; plot examples on number line.", "Correct classification of given numbers"),
         ("Design", "30 min", "Guides a number classification sorting activity where groups place number cards into the correct set (natural/whole/integer).", "Sort number cards in groups.", "Sorting accuracy"),
         ("Realization", "15 min", "Checks notebooks and asks oral questions on the three sets.", "Respond to questions.", "Notebook Check score")
     ]),
    (4, "4", "DEFINE AND CLASSIFY RATIONAL AND IRRATIONAL NUMBERS",
     "2.0 Demonstrate mastery of the number system",
     "2.1 Define and classify rational and irrational numbers",
     "Explain rational and irrational numbers",
     "Define rational numbers with examples (fractions, terminating/recurring decimals); define irrational numbers with examples (√2, π)",
     "Number classification chart, textbook",
     [
         ("Introduction", "10 min", "Recaps natural/whole/integer numbers; asks if ½ fits any of those sets.", "Recall previous lesson; respond.", "Recall accuracy"),
         ("Competence Development", "25 min", "Defines rational numbers (fractions, terminating/recurring decimals) and irrational numbers (√2, π) with worked examples.", "Take notes; try converting fractions to decimals.", "Correct classification of examples"),
         ("Design", "30 min", "Guides pair work sorting a mixed list of numbers into rational and irrational categories, justifying each choice.", "Sort numbers in pairs; justify classification.", "Classification Test accuracy"),
         ("Realization", "15 min", "Administers a short classification test.", "Complete classification test.", "Classification Test score")
     ]),
    # Term I - Week 3
    (5, "5", "EXPLAIN THE REAL NUMBER SYSTEM",
     "2.0 Demonstrate mastery of the number system",
     "2.2 Explain the real number system",
     "Describe the real number system",
     "Describe the real number system as the union of rational and irrational numbers; place a variety of numbers correctly within the real number system diagram",
     "Real number system diagram, textbook",
     [
         ("Introduction", "10 min", "Asks learners to recall rational and irrational numbers from the previous lesson.", "Recall and give examples.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains the real number system as the union of rational and irrational numbers using a Venn-style diagram.", "Take notes; copy diagram.", "Correct description of the real number system"),
         ("Design", "30 min", "Guides pair work placing a list of mixed numbers correctly onto the real number system diagram.", "Place numbers on diagram in pairs.", "Placement accuracy"),
         ("Realization", "15 min", "Poses oral questions confirming understanding of the real number system.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (6, "6", "REPRESENT INEQUALITIES IN REAL NUMBERS",
     "2.0 Demonstrate mastery of the number system",
     "2.2 Represent inequalities in real numbers",
     "Represent and solve simple inequalities on a number line",
     "Represent and solve simple inequalities using <, >, ≤, ≥ on a number line",
     "Number line chart, textbook",
     [
         ("Introduction", "10 min", "Asks learners to compare their heights using \"greater than\" or \"less than.\"", "Compare and respond.", "Engagement"),
         ("Competence Development", "25 min", "Introduces the symbols <, >, ≤, ≥ and demonstrates representing simple inequalities on a number line.", "Take notes; copy number line examples.", "Correct symbol usage"),
         ("Design", "30 min", "Guides pair work solving and representing a set of inequality statements on the number line.", "Work in pairs on inequality problems.", "Written Exercise accuracy"),
         ("Realization", "15 min", "Administers a short quiz on inequalities.", "Complete short quiz.", "Quiz score")
     ]),
    # Term I - Week 4
    (7, "7", "DEFINE AND DETERMINE THE ABSOLUTE VALUE OF A REAL NUMBER",
     "2.0 Demonstrate mastery of the number system",
     "2.3 Define and determine the absolute value of a real number",
     "Explain the meaning of absolute value",
     "Define absolute value as distance from zero; calculate |x| for a range of positive and negative real numbers",
     "Number line, worked example sheets",
     [
         ("Introduction", "10 min", "Asks how far -5 and 5 are from zero on a number line.", "Give initial ideas.", "Engagement"),
         ("Competence Development", "25 min", "Defines absolute value as distance from zero; works through examples calculating |x| for various numbers on the board.", "Take notes; observe worked examples.", "Correct definition and calculation"),
         ("Design", "30 min", "Guides pair practice calculating absolute values using the number-line distance illustration for a worksheet of numbers.", "Solve problems in pairs using number line.", "Calculation Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing the definition and calculation method.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (8, "8", "SOLVE PROBLEMS INVOLVING ABSOLUTE VALUE",
     "2.0 Demonstrate mastery of the number system",
     "2.3 Solve problems involving absolute value",
     "Apply absolute value to solve simple problems",
     "Solve simple word and equation problems involving absolute value; consolidate the full number system (natural, whole, integer, rational, irrational, real, absolute value)",
     "Worked example sheets, textbook",
     [
         ("Introduction", "10 min", "Recaps absolute value calculation briefly with a quick example.", "Recall and answer.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates solving simple equations/word problems involving absolute value step by step.", "Follow worked examples; take notes.", "Correct method application"),
         ("Design", "30 min", "Guides pair problem-solving on a worksheet combining absolute value with the full number classification learned across the chapter.", "Solve mixed problems in pairs.", "Problem-solving accuracy"),
         ("Realization", "15 min", "Administers the Chapter 2 Review Test.", "Complete Chapter 2 Review Test.", "Chapter 2 Review Test score")
     ]),
    # Term I - Week 6
    (9, "9", "EXPLAIN THE MEANING OF APPROXIMATION",
     "3.0 Demonstrate mastery of approximation techniques",
     "3.1 Explain the meaning of approximation",
     "Explain the meaning and purpose of approximation",
     "Define approximation; explain why and when estimation is used in daily life",
     "Rounding rules chart, textbook",
     [
         ("Introduction", "10 min", "Asks learners to estimate the total cost of items in a shopping basket without a calculator.", "Give estimates.", "Engagement"),
         ("Competence Development", "25 min", "Defines approximation; discusses everyday situations requiring estimation (shopping, time, distance).", "Take notes; give own examples.", "Correct explanation of approximation's purpose"),
         ("Design", "30 min", "Guides a discussion activity where groups estimate answers to given real-life scenario cards before calculating exactly.", "Estimate then verify in groups.", "Quality of group estimates"),
         ("Realization", "15 min", "Poses oral questions on when approximation is appropriate.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (10, "10", "ROUND OFF NUMBERS",
     "3.0 Demonstrate mastery of approximation techniques",
     "3.1 Round off numbers",
     "Round off numbers to given place values",
     "Round off numbers to the nearest whole number, tens, hundreds, and decimal places",
     "Rounding rules chart, worked examples",
     [
         ("Introduction", "10 min", "Recaps why estimation matters; asks learners to round 47 to the nearest ten mentally.", "Recall and attempt.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates rounding rules for whole numbers, tens, hundreds, and decimal places with worked examples.", "Follow worked examples; take notes.", "Correct application of rounding rules"),
         ("Design", "30 min", "Guides rounding drills in pairs across a range of place values.", "Practice rounding drills in pairs.", "Rounding Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing rounding rules.", "Answer oral questions.", "Accuracy of responses")
     ]),
    # Term I - Week 7
    (11, "11", "DETERMINE SIGNIFICANT FIGURES",
     "3.0 Demonstrate mastery of approximation techniques",
     "3.2 Determine significant figures",
     "State and apply rules for significant figures",
     "State the rules for significant figures; round numbers to a given number of significant figures",
     "Significant-figure rules chart, textbook",
     [
         ("Introduction", "10 min", "Asks why \"300\" might mean different levels of precision.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "States and explains the rules for identifying significant figures with worked examples.", "Follow worked examples; take notes.", "Correct identification of significant figures"),
         ("Design", "30 min", "Guides pair drills rounding numbers to a specified number of significant figures.", "Complete pair drills.", "Significant Figures Test accuracy"),
         ("Realization", "15 min", "Administers the Significant Figures Test.", "Complete test.", "Significant Figures Test score")
     ]),
    (12, "12", "APPLY APPROXIMATIONS IN CALCULATIONS",
     "3.0 Demonstrate mastery of approximation techniques",
     "3.2 Apply approximations in calculations",
     "Apply approximation in everyday estimation and calculations",
     "Apply rounding and significant figures to solve real-life estimation problems (shopping totals, measurements, distances)",
     "Textbook, real-life estimation task cards",
     [
         ("Introduction", "10 min", "Recaps significant figures briefly with a rapid example.", "Recall and respond.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates applying approximation to solve a multi-step real-life estimation problem.", "Follow demonstration; take notes.", "Correct method application"),
         ("Design", "30 min", "Guides groups through real-life estimation task cards requiring rounding and significant figures.", "Solve estimation tasks in groups.", "Estimation Exercise accuracy"),
         ("Realization", "15 min", "Administers the Chapter 3 Review Test.", "Complete review test.", "Chapter 3 Review Test score")
     ]),
    # Term II - Week 1
    (13, "13", "DEFINE AND EXPRESS RATIOS",
     "4.0 Demonstrate mastery of ratios and proportions",
     "4.1 Define and express ratios",
     "Explain the concept of ratio",
     "Define ratio; express given quantities as ratios; simplify ratios to their lowest terms",
     "Ratio worked examples, counters/objects",
     [
         ("Introduction", "10 min", "Asks how learners would fairly share 12 sweets between 3 friends.", "Give suggestions.", "Engagement"),
         ("Competence Development", "25 min", "Defines ratio; demonstrates expressing quantities as ratios and simplifying them using counters.", "Follow worked examples using counters.", "Correct simplification of ratios"),
         ("Design", "30 min", "Guides group practice expressing and simplifying a variety of quantity comparisons as ratios.", "Practice in groups with objects/counters.", "Ratio Problem-Solving Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing ratio simplification.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (14, "14", "APPLY RATIOS TO REAL-LIFE SHARING PROBLEMS",
     "4.0 Demonstrate mastery of ratios and proportions",
     "4.1 Apply ratios to real-life sharing problems",
     "Apply ratios to solve real-life sharing problems",
     "Solve real-life problems involving sharing a quantity according to a given ratio",
     "Ratio worked examples, textbook",
     [
         ("Introduction", "10 min", "Recaps simplifying ratios briefly with a quick example.", "Recall and respond.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates solving a real-life sharing problem step by step using a given ratio.", "Follow worked examples; take notes.", "Correct method application"),
         ("Design", "30 min", "Guides group activity solving several real-life sharing problems (money, land, ingredients) using ratios.", "Solve sharing problems in groups.", "Ratio Problem-Solving Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions consolidating the topic.", "Answer oral questions.", "Accuracy of responses")
     ]),
    # Term II - Week 2
    (15, "15", "EXPLAIN DIRECT PROPORTION",
     "4.0 Demonstrate mastery of ratios and proportions",
     "4.2 Explain direct proportion",
     "Explain and solve problems involving direct proportion",
     "Define direct proportion; solve problems where two quantities increase or decrease together (e.g. recipes, cost per item)",
     "Proportion worked examples, textbook",
     [
         ("Introduction", "10 min", "Asks how the cost of sugar changes if you buy double the amount.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Defines direct proportion; works through recipe/cost examples showing quantities increasing together.", "Follow worked examples; take notes.", "Correct identification of direct proportion"),
         ("Design", "30 min", "Guides pair work solving direct proportion problems from real-life scenarios (recipes, shopping).", "Solve problems in pairs.", "Proportion Problem-Solving Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing direct proportion.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (16, "16", "EXPLAIN INVERSE PROPORTION",
     "4.0 Demonstrate mastery of ratios and proportions",
     "4.2 Explain inverse proportion",
     "Explain and solve problems involving inverse proportion",
     "Define inverse proportion; solve problems where one quantity increases as another decreases (e.g. speed/time, workers/days)",
     "Proportion worked examples, textbook",
     [
         ("Introduction", "10 min", "Asks how travel time changes if speed doubles over the same distance.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Defines inverse proportion; works through speed/time and workers/days examples.", "Follow worked examples; take notes.", "Correct identification of inverse proportion"),
         ("Design", "30 min", "Guides pair work solving inverse proportion problems and comparing them with direct proportion problems from Period 1.", "Solve problems in pairs; compare with direct proportion cases.", "Proportion Problem-Solving Exercise accuracy"),
         ("Realization", "15 min", "Administers the Chapter 4 Review Test.", "Complete review test.", "Chapter 4 Review Test score")
     ]),
    # Term II - Week 3
    (17, "17", "FORM ALGEBRAIC EXPRESSIONS",
     "5.0 Demonstrate mastery of algebraic manipulation and equations",
     "5.1 Form algebraic expressions",
     "Define algebraic terms and form expressions from word statements",
     "Define algebraic expression, term, coefficient, and variable; form expressions from given word statements",
     "Algebra worked examples, textbook",
     [
         ("Introduction", "10 min", "Asks learners to represent \"a number plus 3\" symbolically.", "Attempt representation.", "Engagement"),
         ("Competence Development", "25 min", "Defines expression, term, coefficient, and variable with guided examples on the board.", "Take notes; copy definitions.", "Correct use of terminology"),
         ("Design", "30 min", "Guides pair work matching given word problems to their correct algebraic expressions.", "Match word problems to expressions in pairs.", "Matching accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing key terms.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (18, "18", "SIMPLIFY ALGEBRAIC EXPRESSIONS",
     "5.0 Demonstrate mastery of algebraic manipulation and equations",
     "5.1 Simplify algebraic expressions",
     "Simplify algebraic expressions by collecting like terms",
     "Identify like and unlike terms; simplify expressions by collecting like terms",
     "Algebra worked examples, textbook",
     [
         ("Introduction", "10 min", "Recaps forming expressions; asks if 3x and 5x can be combined.", "Recall and respond.", "Recall accuracy"),
         ("Competence Development", "25 min", "Explains identifying like terms and demonstrates simplification step by step.", "Follow worked examples; take notes.", "Correct identification of like terms"),
         ("Design", "30 min", "Guides pair practice simplifying a worksheet of expressions by collecting like terms.", "Practice simplification in pairs.", "Simplification Exercise accuracy"),
         ("Realization", "15 min", "Administers a short quiz on simplification.", "Complete short quiz.", "Quiz score")
     ]),
    # Term II - Week 4
    (19, "19", "FORM LINEAR EQUATIONS FROM WORD PROBLEMS",
     "5.0 Demonstrate mastery of algebraic manipulation and equations",
     "5.2 Form linear equations from word problems",
     "Form linear equations from word problems",
     "Translate word problems into linear equations in one unknown",
     "Equation worked examples, textbook",
     [
         ("Introduction", "10 min", "Poses a simple word problem requiring an unknown number (\"I think of a number, add 5, I get 12\").", "Attempt to solve mentally.", "Engagement"),
         ("Competence Development", "25 min", "Demonstrates translating word problems into algebraic equations step by step.", "Follow demonstration; take notes.", "Correct equation formation"),
         ("Design", "30 min", "Guides pair practice forming equations from a set of word problems.", "Practice forming equations in pairs.", "Equation formation accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing the translation process.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (20, "20", "SOLVE LINEAR EQUATIONS",
     "5.0 Demonstrate mastery of algebraic manipulation and equations",
     "5.2 Solve linear equations",
     "Solve linear equations in one unknown",
     "Solve linear equations in one unknown using inverse operations",
     "Equation worked examples, textbook",
     [
         ("Introduction", "10 min", "Recaps forming equations; presents one formed in Period 1 to solve.", "Recall and attempt to solve.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates solving linear equations step by step using inverse operations.", "Follow step-by-step solving.", "Correct application of inverse operations"),
         ("Design", "30 min", "Guides pair problem-solving on a worksheet of linear equations, including those formed from word problems.", "Solve equations in pairs.", "Equation-Solving Exercise accuracy"),
         ("Realization", "15 min", "Administers a short quiz.", "Complete short quiz.", "Quiz score")
     ]),
    # Term II - Week 5
    (21, "21", "SOLVE SIMULTANEOUS EQUATIONS BY ELIMINATION",
     "5.0 Demonstrate mastery of algebraic manipulation and equations",
     "5.3 Solve simultaneous equations by elimination",
     "Solve linear simultaneous equations using the elimination method",
     "Solve simultaneous equations in two unknowns using the elimination method",
     "Simultaneous equation worked examples, textbook",
     [
         ("Introduction", "10 min", "Poses a problem involving two unknowns (e.g. two numbers' sum and difference).", "Attempt to reason it out.", "Engagement"),
         ("Competence Development", "25 min", "Demonstrates the elimination method step by step on the board.", "Follow demonstration; take notes.", "Correct use of elimination method"),
         ("Design", "30 min", "Guides pair practice solving simultaneous equations using elimination.", "Practice elimination method in pairs.", "Problem-Solving Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions checking understanding of each elimination step.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (22, "22", "SOLVE SIMULTANEOUS EQUATIONS BY SUBSTITUTION",
     "5.0 Demonstrate mastery of algebraic manipulation and equations",
     "5.3 Solve simultaneous equations by substitution",
     "Solve linear simultaneous equations using the substitution method",
     "Solve simultaneous equations in two unknowns using the substitution method; compare with the elimination method",
     "Simultaneous equation worked examples, textbook",
     [
         ("Introduction", "10 min", "Recaps elimination method briefly; asks if there's another way to solve the same equations.", "Recall previous lesson.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates the substitution method step by step, then compares it with elimination.", "Follow demonstration; take notes on both methods.", "Correct use of substitution method"),
         ("Design", "30 min", "Guides pair practice solving a mixed set of simultaneous equations, choosing either method.", "Solve problems in pairs.", "Problem-Solving Exercise accuracy"),
         ("Realization", "15 min", "Administers a written test covering both methods.", "Complete written test.", "Written Test score")
     ]),
    # Term II - Week 6
    (23, "23", "SOLVE LINEAR INEQUALITIES WITH ONE UNKNOWN",
     "5.0 Demonstrate mastery of algebraic manipulation and equations",
     "5.4 Solve linear inequalities with one unknown",
     "Solve simple linear inequalities",
     "Solve simple inequalities in one unknown using inverse operations, noting the effect of multiplying/dividing by a negative number",
     "Inequality worked examples, textbook",
     [
         ("Introduction", "10 min", "Asks learners for numbers that satisfy \"x is greater than 3.\"", "Suggest examples.", "Engagement"),
         ("Competence Development", "25 min", "Demonstrates solving simple inequalities step by step, highlighting the sign-flip rule when dividing by a negative.", "Follow worked examples; take notes.", "Correct solving of inequalities"),
         ("Design", "30 min", "Guides pair practice solving a worksheet of inequalities.", "Solve inequalities in pairs.", "Inequality-Solving Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing the sign-flip rule.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (24, "24", "REPRESENT INEQUALITY SOLUTIONS ON A NUMBER LINE",
     "5.0 Demonstrate mastery of algebraic manipulation and equations",
     "5.4 Represent inequality solutions on a number line",
     "Represent solutions of inequalities on a number line",
     "Represent solution sets of linear inequalities on a number line, distinguishing open and closed circles",
     "Number line chart, textbook",
     [
         ("Introduction", "10 min", "Recaps solving inequalities; asks how to show \"x > 3\" on a number line.", "Recall and attempt.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates representing solutions on a number line, explaining open circles (<, >) vs closed circles (≤, ≥).", "Follow demonstration; take notes.", "Correct use of open/closed circles"),
         ("Design", "30 min", "Guides pair practice solving inequalities and representing each solution on a number line.", "Solve and represent solutions in pairs.", "Inequality-Solving Exercise accuracy"),
         ("Realization", "15 min", "Administers the Chapter 5 Review Test.", "Complete review test.", "Chapter 5 Review Test score")
     ]),
    # Term II - Week 8
    (25, "25", "DESCRIBE THE CARTESIAN PLANE AND PLOT POINTS",
     "6.0 Demonstrate mastery of coordinate geometry",
     "6.1 Describe the Cartesian plane and plot points",
     "Explain the Cartesian plane and plot points",
     "Describe the Cartesian plane, axes, and origin; plot given points accurately on graph paper",
     "Graph papers, Cartesian plane chart",
     [
         ("Introduction", "10 min", "Asks learners how to describe a seat position in a classroom grid (row and column).", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Introduces the Cartesian plane, x- and y-axes, and origin; demonstrates plotting points.", "Take notes; observe plotting examples.", "Correct description of the Cartesian plane"),
         ("Design", "30 min", "Guides pair practice plotting a set of given coordinate points on graph paper.", "Plot points in pairs on graph paper.", "Plotting Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions on reading coordinates from plotted points.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (26, "26", "DETERMINE THE GRADIENT OF A STRAIGHT LINE",
     "6.0 Demonstrate mastery of coordinate geometry",
     "6.1 Determine the gradient of a straight line",
     "Calculate the gradient of a line joining two points",
     "Calculate the gradient of a straight line joining two given points using the gradient formula",
     "Graph papers, textbook",
     [
         ("Introduction", "10 min", "Recaps plotting points; asks which of two plotted lines looks \"steeper.\"", "Recall and observe.", "Recall accuracy"),
         ("Competence Development", "25 min", "Introduces the gradient formula and demonstrates calculating gradient between two points.", "Follow worked examples; take notes.", "Correct application of gradient formula"),
         ("Design", "30 min", "Guides pair practice calculating gradients for several pairs of points on graph paper.", "Practice gradient calculation in pairs.", "Gradient Calculation Test accuracy"),
         ("Realization", "15 min", "Administers a gradient calculation test.", "Complete test.", "Gradient Calculation Test score")
     ]),
    # Term II - Week 9
    (27, "27", "DERIVE THE EQUATION OF A STRAIGHT LINE",
     "6.0 Demonstrate mastery of coordinate geometry",
     "6.2 Derive the equation of a straight line",
     "Derive the equation of a straight line in the form y = mx + c",
     "Derive the equation of a line given its gradient and y-intercept, and given two points, in the form y = mx + c",
     "Graph papers, worked example sheets",
     [
         ("Introduction", "10 min", "Reviews gradient calculation from the previous week briefly.", "Recall previous lesson.", "Recall accuracy"),
         ("Competence Development", "25 min", "Derives the equation y = mx + c using guided steps, showing how gradient and intercept build the equation.", "Follow derivation; take notes.", "Correct derivation of equation"),
         ("Design", "30 min", "Guides pair practice deriving equations of lines from given gradient/intercept and from two points.", "Practice derivations in pairs.", "Equation Derivation Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions reviewing the derivation steps.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (28, "28", "EXPRESS THE GENERAL EQUATION OF A STRAIGHT LINE",
     "6.0 Demonstrate mastery of coordinate geometry",
     "6.2 Express the general equation of a straight line",
     "Express equations in general form ax + by + c = 0",
     "Convert equations between the form y = mx + c and the general form ax + by + c = 0",
     "Worked example sheets, textbook",
     [
         ("Introduction", "10 min", "Recaps y = mx + c briefly; shows an equation and asks learners to identify m and c.", "Recall and respond.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates converting y = mx + c into general form ax + by + c = 0 and vice versa.", "Follow worked examples; take notes.", "Correct conversion between forms"),
         ("Design", "30 min", "Guides pair practice converting a set of equations between the two forms.", "Practice conversions in pairs.", "Equation Derivation Exercise accuracy"),
         ("Realization", "15 min", "Administers a written test.", "Complete written test.", "Written Test score")
     ]),
    # Term II - Week 10
    (29, "29", "GRAPH LINEAR EQUATIONS USING A TABLE OF VALUES",
     "6.0 Demonstrate mastery of coordinate geometry",
     "6.3 Graph linear equations using a table of values",
     "Draw graphs of linear equations",
     "Construct a table of values for a linear equation and draw its graph on graph paper",
     "Graph papers, rulers",
     [
         ("Introduction", "10 min", "Asks learners how many points are needed to draw a straight line.", "Share ideas.", "Engagement"),
         ("Competence Development", "25 min", "Demonstrates constructing a table of values and plotting the resulting line graph.", "Follow demonstration; construct own table.", "Correct construction of table of values"),
         ("Design", "30 min", "Guides pair practice constructing tables and drawing graphs for a set of given linear equations.", "Draw graphs in pairs using rulers.", "Graph Plotting Exercise accuracy"),
         ("Realization", "15 min", "Poses oral questions on reading values from the graphs drawn.", "Answer oral questions.", "Accuracy of responses")
     ]),
    (30, "30", "SOLVE SIMULTANEOUS EQUATIONS GRAPHICALLY",
     "6.0 Demonstrate mastery of coordinate geometry",
     "6.3 Solve simultaneous equations graphically",
     "Solve simultaneous equations by finding the point of intersection of two graphs",
     "Draw two linear equations on the same axes and identify the point of intersection as the solution to the simultaneous equations",
     "Graph papers, rulers, textbook",
     [
         ("Introduction", "10 min", "Recaps drawing a single line graph; asks what it means if two lines cross.", "Recall and predict.", "Recall accuracy"),
         ("Competence Development", "25 min", "Demonstrates drawing two linear equations on the same axes and reading off the intersection point as the solution.", "Follow demonstration; take notes.", "Correct identification of intersection point"),
         ("Design", "30 min", "Guides pair drawing of two graphs for a given pair of simultaneous equations, verifying the solution algebraically.", "Draw graphs; verify solution in pairs.", "Graph Plotting Exercise accuracy"),
         ("Realization", "15 min", "Administers the Chapter 6 Review Test.", "Complete review test.", "Chapter 6 Review Test score")
     ])
]

math_lessons = []
for num, sr, topic, mc, sc, ma, sa, res, stages in math_lessons_data:
    math_lessons.append({
        "title": f"MATHEMATICS FORM ONE LESSON PLAN NO. {num}: {topic}",
        "sr_no": sr,
        "time": "80 min",
        "main_competence": mc,
        "specific_competence": sc,
        "main_activity": ma,
        "specific_activity": sa,
        "teaching_learning_resources": res,
        "references": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: Tanzania Institute of Education.",
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

math_doc = {
    "subject_name": "Mathematics",
    "subject_slug": "mathematics",
    "form_level": 1,
    "standard": "Form 1",
    "tie_reference": "TIE (2026). Mathematics for Secondary Schools Student's Book Form 1. Dar es Salaam: TIE.",
    "source_note": "Verified Basic Mathematics Form One lesson plans (Arusha Catholic Seminary). 30 lesson plans (80 min double periods, 2 per week) covering Term I (Concept of Mathematics, Numbers Classification, Real Numbers and Inequalities, Absolute Value, Approximation & Rounding, Significant Figures) and Term II (Ratios, Proportions, Algebraic Expressions, Linear Equations, Simultaneous Equations, Inequalities, Coordinate Geometry: Cartesian Plane, Gradient, Equation of Straight Line, Graphing Linear Equations).",
    "lessons": math_lessons
}

with open(REF_DIR / "mathematics_form_one_scheme.json", "w", encoding="utf-8") as f:
    json.dump(math_scheme, f, indent=2, ensure_ascii=False)

with open(REF_DIR / "mathematics_form_one.json", "w", encoding="utf-8") as f:
    json.dump(math_doc, f, indent=2, ensure_ascii=False)

print("Generated mathematics_form_one_scheme.json and mathematics_form_one.json")
