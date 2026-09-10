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


def generate():
    with open(REF_DIR / "mathematics_form_one_scheme.json", "w", encoding="utf-8") as f:
        json.dump(math_scheme, f, indent=2, ensure_ascii=False)
    print("Generated mathematics_form_one_scheme.json")


if __name__ == "__main__":
    generate()
