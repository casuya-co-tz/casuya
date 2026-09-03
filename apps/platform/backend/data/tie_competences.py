"""Verbatim TIE CBC (2023) Main and Specific Competence statements.

Extracted manually from the official TIE "Mathematics Syllabus for Ordinary
Secondary Education" (Form I-IV) published at tie.go.tz.

Each platform teaching topic (old TIE 2005 content unit, e.g. "INDICES AND
LOGARITHMS") is mapped to the TIE 2023 CBC Main Competence and the Specific
Competence that covers that content. Both English ("en") and Kiswahili ("sw")
statements are provided.

Structure:
    TIE_COMPETENCES[subject_slug][form_level][topic_title_upper] =
        {"main_code": str, "main": {"en": str, "sw": str},
         "specific_code": str, "specific": {"en": str, "sw": str}}

Note: TIE reuses the same specific-competence numbering across forms, but the
Specific Competence *text* is form-specific, so entries are keyed by form too.
"""

TIE_MATHEMATICS = {
    # =====================================================================
    # FORM I
    # =====================================================================
    1: {
        "NUMBERS": {
            "main_code": "1.0",
            "main": {
                "en": "Demonstrate mastery of mathematical language",
                "sw": "Kuonyesha ustadi wa lugha ya hisabati",
            },
            "specific_code": "1.1",
            "specific": {
                "en": "Use numerical skills in different contexts",
                "sw": "Kutumia ujuzi wa namba katika miktadha mbalimbali",
            },
        },
        "FRACTIONS": {
            "main_code": "1.0",
            "main": {
                "en": "Demonstrate mastery of mathematical language",
                "sw": "Kuonyesha ustadi wa lugha ya hisabati",
            },
            "specific_code": "1.1",
            "specific": {
                "en": "Use numerical skills in different contexts",
                "sw": "Kutumia ujuzi wa namba katika miktadha mbalimbali",
            },
        },
        "DECIMALS AND APPROXIMATIONS": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.1",
            "specific": {
                "en": "Use geometry, approximations, relations and functions in various contexts",
                "sw": "Kutumia jiometri, makadirio, mahusiano na michakato katika miktadha mbalimbali",
            },
        },
        "RATIOS, PROPORTIONS AND PERCENTAGES": {
            "main_code": "1.0",
            "main": {
                "en": "Demonstrate mastery of mathematical language",
                "sw": "Kuonyesha ustadi wa lugha ya hisabati",
            },
            "specific_code": "1.2",
            "specific": {
                "en": "Use ratios and proportions in daily life",
                "sw": "Kutumia uwiano na kadiri katika maisha ya kila siku",
            },
        },
        "COMMERCIAL ARITHMETIC": {
            "main_code": "1.0",
            "main": {
                "en": "Demonstrate mastery of mathematical language",
                "sw": "Kuonyesha ustadi wa lugha ya hisabati",
            },
            "specific_code": "1.3",
            "specific": {
                "en": "Use rates and variations in different contexts",
                "sw": "Kutumia viwango na mabadiliko katika miktadha mbalimbali",
            },
        },
        "SETS": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.3",
            "specific": {
                "en": "Use sets, sequences and series in problem solving",
                "sw": "Kutumia seti, mfuatano na mfululizo katika kutatua matatizo",
            },
        },
        "ALGEBRA": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.2",
            "specific": {
                "en": "Use algebra and matrices in problem solving",
                "sw": "Kutumia algebra na matriksi katika kutatua matatizo",
            },
        },
        "COORDINATE GEOMETRY": {
            "main_code": "3.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in coordinate geometry, trigonometry, circles, vectors, probability and statistics",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri ya kuratibu, trigonometria, miduara, vekta, uwezekano na takwimu",
            },
            "specific_code": "3.1",
            "specific": {
                "en": "Use basic coordinate geometry, trigonometry and vectors skills in daily life",
                "sw": "Kutumia ujuzi wa msingi wa jiometri ya kuratibu, trigonometria na vekta katika maisha ya kila siku",
            },
        },
        "MENSURATION": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.1",
            "specific": {
                "en": "Use geometry, approximations, relations and functions in various contexts",
                "sw": "Kutumia jiometri, makadirio, mahusiano na michakato katika miktadha mbalimbali",
            },
        },
        "ANGLES AND LINES": {
            "main_code": "3.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in coordinate geometry, trigonometry, circles, vectors, probability and statistics",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri ya kuratibu, trigonometria, miduara, vekta, uwezekano na takwimu",
            },
            "specific_code": "3.1",
            "specific": {
                "en": "Use basic coordinate geometry, trigonometry and vectors skills in daily life",
                "sw": "Kutumia ujuzi wa msingi wa jiometri ya kuratibu, trigonometria na vekta katika maisha ya kila siku",
            },
        },
    },
    # =====================================================================
    # FORM II
    # =====================================================================
    2: {
        "INDICES AND LOGARITHMS": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.2",
            "specific": {
                "en": "Use algebra and matrices in problem solving",
                "sw": "Kutumia algebra na matriksi katika kutatua matatizo",
            },
        },
        "ALGEBRAIC EXPRESSIONS": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.2",
            "specific": {
                "en": "Use algebra and matrices in problem solving",
                "sw": "Kutumia algebra na matriksi katika kutatua matatizo",
            },
        },
        "EQUATIONS": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.2",
            "specific": {
                "en": "Use algebra and matrices in problem solving",
                "sw": "Kutumia algebra na matriksi katika kutatua matatizo",
            },
        },
        "TRIGONOMETRY": {
            "main_code": "3.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in coordinate geometry, trigonometry, circles, vectors, probability and statistics",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri ya kuratibu, trigonometria, miduara, vekta, uwezekano na takwimu",
            },
            "specific_code": "3.1",
            "specific": {
                "en": "Use basic coordinate geometry, trigonometry and vectors skills in daily life",
                "sw": "Kutumia ujuzi wa msingi wa jiometri ya kuratibu, trigonometria na vekta katika maisha ya kila siku",
            },
        },
        "POLYGONS": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.1",
            "specific": {
                "en": "Use geometry, approximations, relations and functions in various contexts",
                "sw": "Kutumia jiometri, makadirio, mahusiano na michakato katika miktadha mbalimbali",
            },
        },
        "MATHEMATICAL ECONOMICS": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.2",
            "specific": {
                "en": "Use algebra and matrices in problem solving",
                "sw": "Kutumia algebra na matriksi katika kutatua matatizo",
            },
        },
        "TRANSFORMATIONS": {
            "main_code": "3.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in coordinate geometry, trigonometry, circles, vectors, probability and statistics",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri ya kuratibu, trigonometria, miduara, vekta, uwezekano na takwimu",
            },
            "specific_code": "3.1",
            "specific": {
                "en": "Use basic coordinate geometry, trigonometry and vectors skills in daily life",
                "sw": "Kutumia ujuzi wa msingi wa jiometri ya kuratibu, trigonometria na vekta katika maisha ya kila siku",
            },
        },
    },
    # =====================================================================
    # FORM III
    # =====================================================================
    3: {
        "NUMBER BASES": {
            "main_code": "1.0",
            "main": {
                "en": "Demonstrate mastery of mathematical language",
                "sw": "Kuonyesha ustadi wa lugha ya hisabati",
            },
            "specific_code": "1.1",
            "specific": {
                "en": "Use numerical skills in different contexts",
                "sw": "Kutumia ujuzi wa namba katika miktadha mbalimbali",
            },
        },
        "RATES AND VARIATIONS": {
            "main_code": "1.0",
            "main": {
                "en": "Demonstrate mastery of mathematical language",
                "sw": "Kuonyesha ustadi wa lugha ya hisabati",
            },
            "specific_code": "1.3",
            "specific": {
                "en": "Use rates and variations in different contexts",
                "sw": "Kutumia viwango na mabadiliko katika miktadha mbalimbali",
            },
        },
        "SEQUENCES AND SERIES": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.3",
            "specific": {
                "en": "Use sets, sequences and series in problem solving",
                "sw": "Kutumia seti, mfuatano na mfululizo katika kutatua matatizo",
            },
        },
        "QUADRATIC EQUATIONS": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.2",
            "specific": {
                "en": "Use algebra and matrices in problem solving",
                "sw": "Kutumia algebra na matriksi katika kutatua matatizo",
            },
        },
        "SIMULTANEOUS EQUATIONS": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.2",
            "specific": {
                "en": "Use algebra and matrices in problem solving",
                "sw": "Kutumia algebra na matriksi katika kutatua matatizo",
            },
        },
        "LOGARITHMS AND ANTLOGARITHMS": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.2",
            "specific": {
                "en": "Use algebra and matrices in problem solving",
                "sw": "Kutumia algebra na matriksi katika kutatua matatizo",
            },
        },
        "MENSURATION III": {
            "main_code": "3.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in coordinate geometry, trigonometry, circles, vectors, probability and statistics",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri ya kuratibu, trigonometria, miduara, vekta, uwezekano na takwimu",
            },
            "specific_code": "3.1",
            "specific": {
                "en": "Use basic coordinate geometry, trigonometry and vectors skills in daily life",
                "sw": "Kutumia ujuzi wa msingi wa jiometri ya kuratibu, trigonometria na vekta katika maisha ya kila siku",
            },
        },
        "GEOMETRICAL AND TRANSFORMATIONS": {
            "main_code": "3.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in coordinate geometry, trigonometry, circles, vectors, probability and statistics",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri ya kuratibu, trigonometria, miduara, vekta, uwezekano na takwimu",
            },
            "specific_code": "3.1",
            "specific": {
                "en": "Use basic coordinate geometry, trigonometry and vectors skills in daily life",
                "sw": "Kutumia ujuzi wa msingi wa jiometri ya kuratibu, trigonometria na vekta katika maisha ya kila siku",
            },
        },
    },
    # =====================================================================
    # FORM IV
    # =====================================================================
    4: {
        "COORDINATE GEOMETRY II": {
            "main_code": "3.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in coordinate geometry, trigonometry, circles, vectors, probability and statistics",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri ya kuratibu, trigonometria, miduara, vekta, uwezekano na takwimu",
            },
            "specific_code": "3.1",
            "specific": {
                "en": "Use basic coordinate geometry, trigonometry and vectors skills in daily life",
                "sw": "Kutumia ujuzi wa msingi wa jiometri ya kuratibu, trigonometria na vekta katika maisha ya kila siku",
            },
        },
        "AREA AND PERIMETER": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.1",
            "specific": {
                "en": "Use geometry, approximations, relations and functions in various contexts",
                "sw": "Kutumia jiometri, makadirio, mahusiano na michakato katika miktadha mbalimbali",
            },
        },
        "THREE DIMENSIONAL FIGURES": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.1",
            "specific": {
                "en": "Use geometry, approximations, relations and functions in various contexts",
                "sw": "Kutumia jiometri, makadirio, mahusiano na michakato katika miktadha mbalimbali",
            },
        },
        "PROBABILITY": {
            "main_code": "3.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in coordinate geometry, trigonometry, circles, vectors, probability and statistics",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri ya kuratibu, trigonometria, miduara, vekta, uwezekano na takwimu",
            },
            "specific_code": "3.2",
            "specific": {
                "en": "Use probability in problem solving",
                "sw": "Kutumia uwezekano katika kutatua matatizo",
            },
        },
        "TRIGONOMETRY II": {
            "main_code": "3.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in coordinate geometry, trigonometry, circles, vectors, probability and statistics",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri ya kuratibu, trigonometria, miduara, vekta, uwezekano na takwimu",
            },
            "specific_code": "3.1",
            "specific": {
                "en": "Use basic coordinate geometry, trigonometry and vectors skills in daily life",
                "sw": "Kutumia ujuzi wa msingi wa jiometri ya kuratibu, trigonometria na vekta katika maisha ya kila siku",
            },
        },
        "VECTORS": {
            "main_code": "3.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in coordinate geometry, trigonometry, circles, vectors, probability and statistics",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri ya kuratibu, trigonometria, miduara, vekta, uwezekano na takwimu",
            },
            "specific_code": "3.1",
            "specific": {
                "en": "Use basic coordinate geometry, trigonometry and vectors skills in daily life",
                "sw": "Kutumia ujuzi wa msingi wa jiometri ya kuratibu, trigonometria na vekta katika maisha ya kila siku",
            },
        },
        "MATRICES": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.2",
            "specific": {
                "en": "Use algebra and matrices in problem solving",
                "sw": "Kutumia algebra na matriksi katika kutatua matatizo",
            },
        },
        "LINEAR PROGRAMMING": {
            "main_code": "2.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in geometry and algebra",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri na algebra",
            },
            "specific_code": "2.2",
            "specific": {
                "en": "Use algebra and matrices in problem solving",
                "sw": "Kutumia algebra na matriksi katika kutatua matatizo",
            },
        },
        "STATISTICS AND DATA REPRESENTATION": {
            "main_code": "3.0",
            "main": {
                "en": "Demonstrate mastery of basic concepts in coordinate geometry, trigonometry, circles, vectors, probability and statistics",
                "sw": "Kuonyesha ustadi wa dhana za msingi za jiometri ya kuratibu, trigonometria, miduara, vekta, uwezekano na takwimu",
            },
            "specific_code": "3.3",
            "specific": {
                "en": "Use statistics in problem solving",
                "sw": "Kutumia takwimu katika kutatua matatizo",
            },
        },
    },
}

TIE_COMPETENCES = {
    "mathematics": TIE_MATHEMATICS,
}


def lookup_competence(subject_slug: str, form_level: int, topic_title: str):
    """Return the TIE competence record for a subject/form/topic, or None.

    Matching is case-insensitive on the topic title.
    """
    by_form = TIE_COMPETENCES.get((subject_slug or "").strip().lower())
    if not by_form:
        return None
    records = by_form.get(form_level)
    if not records:
        return None
    key = (topic_title or "").strip().upper()
    return records.get(key)
