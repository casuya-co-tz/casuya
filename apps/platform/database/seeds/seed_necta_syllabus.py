"""Seed the database with the official NECTA/TIE syllabus for all CSEE core subjects.

This module contains the EXACT topic and subtopic structure from the Tanzania
Institute of Education (TIE) syllabus for Ordinary Secondary Education (Form I-IV).
The AI agent uses this data to serve curriculum-aligned content to students.

Sources:
- TIE Basic Mathematics Syllabus Form I-IV (2005, Reprinted 2017)
- TIE Physics Syllabus Form I-IV
- TIE Chemistry Syllabus Form I-IV
- TIE Biology Syllabus Form I-IV
- TIE English Language Syllabus Form I-IV
- TIE Kiswahili Syllabus Form I-IV
- NECTA CSEE Examination Formats 2022/2023
"""

from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from backend.config.database import get_db, init_db
from backend.models.syllabus import (
    LearningOutcome,
    SyllabusSubject,
    SyllabusSubtopic,
    SyllabusTopic,
)


def _uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Complete NECTA/TIE syllabus data for all core CSEE subjects.
# Each entry: (subject_name, code, slug, necta_code, is_core, topics)
# Each topic: (title, code, form_level, order, periods, weight, subtopics)
# Each subtopic: (title, code, order, periods, outcomes)
# Each outcome: (description, cognitive_level, order)
# ---------------------------------------------------------------------------

NECTA_SYLLABUS: list[dict] = [
    # ========================================================================
    # MATHEMATICS (Basic Mathematics) — NECTA Code 021
    # Source: TIE Basic Mathematics Syllabus Form I-IV (2005, Reprint 2017)
    # ========================================================================
    {
        "name": "Basic Mathematics",
        "code": "MATH",
        "slug": "mathematics",
        "necta_code": "021",
        "is_core": True,
        "description": "Mathematics for Ordinary Secondary Education, Form I-IV. Covers number systems, algebra, geometry, trigonometry, statistics, and mensuration.",
        "form_start": 1,
        "form_end": 4,
        "topics": [
            # ── FORM I ──────────────────────────────────────────────────────
            {
                "title": "NUMBERS",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 50,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Base ten numeration",
                        "code": "1.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Identify the place value of each digit in base ten numeration", "knowledge", 1),
                            ("Read numbers in base ten numeration up to one billion", "knowledge", 2),
                            ("Write numbers in base ten numeration up to one billion", "application", 3),
                            ("Apply numbers in daily life situations", "application", 4),
                        ],
                    },
                    {
                        "title": "Natural and whole numbers",
                        "code": "1.2",
                        "order": 2,
                        "periods": 14,
                        "outcomes": [
                            ("Distinguish between natural numbers and whole numbers", "comprehension", 1),
                            ("Identify even, odd and prime numbers", "knowledge", 2),
                            ("Show even, odd and prime numbers on number line", "application", 3),
                            ("Find factors of a given number", "application", 4),
                            ("Use factors to find the Greatest Common Factor (GCF)", "application", 5),
                            ("Use factors or multiples to find the Lowest Common Multiple (LCM)", "application", 6),
                        ],
                    },
                    {
                        "title": "Integers",
                        "code": "1.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Identify integers in real life situations", "comprehension", 1),
                            ("Add integers", "application", 2),
                            ("Subtract integers", "application", 3),
                            ("Multiply integers", "application", 4),
                            ("Divide integers", "application", 5),
                            ("Perform mixed operations on integers using BODMAS", "analysis", 6),
                        ],
                    },
                ],
            },
            {
                "title": "FRACTIONS",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Proper, improper and mixed numbers",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe a fraction", "comprehension", 1),
                            ("Distinguish proper, improper fractions and mixed numbers", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Comparison of fractions",
                        "code": "2.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Simplify a fraction to its lowest terms", "application", 1),
                            ("Compare and order fractions", "application", 2),
                        ],
                    },
                    {
                        "title": "Operations on fractions",
                        "code": "2.3",
                        "order": 3,
                        "periods": 10,
                        "outcomes": [
                            ("Add fractions", "application", 1),
                            ("Subtract fractions", "application", 2),
                            ("Multiply fractions", "application", 3),
                            ("Divide fractions", "application", 4),
                        ],
                    },
                ],
            },
            {
                "title": "DECIMALS AND APPROXIMATIONS",
                "code": "3.0",
                "form_level": 1,
                "order": 3,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Place value of decimals",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Identify the place value of digits in decimal numbers", "knowledge", 1),
                            ("Convert fractions to decimals and vice versa", "application", 2),
                        ],
                    },
                    {
                        "title": "Operations on decimals",
                        "code": "3.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Perform addition and subtraction of decimals", "application", 1),
                            ("Perform multiplication and division of decimals", "application", 2),
                        ],
                    },
                    {
                        "title": "Approximations",
                        "code": "3.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Round off numbers to given degrees of accuracy", "application", 1),
                            ("Estimate results of computations", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "RATIOS, PROPORTIONS AND PERCENTAGES",
                "code": "4.0",
                "form_level": 1,
                "order": 4,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Ratio and ratio calculations",
                        "code": "4.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Simplify ratios", "application", 1),
                            ("Solve problems involving ratios", "application", 2),
                        ],
                    },
                    {
                        "title": "Direct and inverse proportions",
                        "code": "4.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Solve problems involving direct proportion", "application", 1),
                            ("Solve problems involving inverse proportion", "application", 2),
                        ],
                    },
                    {
                        "title": "Percentages",
                        "code": "4.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Convert fractions and decimals to percentages and vice versa", "application", 1),
                            ("Solve problems involving percentages including profit, loss, discount and simple interest", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "COMMERCIAL ARITHMETIC",
                "code": "5.0",
                "form_level": 1,
                "order": 5,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Profit and loss",
                        "code": "5.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate profit and loss", "application", 1),
                            ("Calculate profit/loss percentage", "application", 2),
                        ],
                    },
                    {
                        "title": "Simple interest",
                        "code": "5.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate simple interest using I = PRT/100", "application", 1),
                            ("Solve problems involving simple interest", "application", 2),
                        ],
                    },
                    {
                        "title": "Discount and tax",
                        "code": "5.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate discount and selling price", "application", 1),
                            ("Calculate VAT and total cost", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "SETS",
                "code": "6.0",
                "form_level": 1,
                "order": 6,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Definition and notation of sets",
                        "code": "6.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define a set and describe sets using roster and set-builder notation", "comprehension", 1),
                            ("Identify types of sets: empty, universal, finite, infinite, equal, equivalent", "knowledge", 2),
                        ],
                    },
                    {
                        "title": "Operations on sets",
                        "code": "6.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Perform union of sets", "application", 1),
                            ("Perform intersection of sets", "application", 2),
                            ("Find the complement of a set", "application", 3),
                        ],
                    },
                    {
                        "title": "Venn diagrams",
                        "code": "6.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Draw Venn diagrams for two and three sets", "application", 1),
                            ("Solve problems using Venn diagrams", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "ALGEBRA",
                "code": "7.0",
                "form_level": 1,
                "order": 7,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Algebraic expressions",
                        "code": "7.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Identify variables, constants, coefficients and terms in algebraic expressions", "knowledge", 1),
                            ("Simplify algebraic expressions", "application", 2),
                        ],
                    },
                    {
                        "title": "Linear equations in one unknown",
                        "code": "7.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Solve linear equations in one unknown", "application", 1),
                            ("Formulate linear equations from word problems", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Linear inequalities in one unknown",
                        "code": "7.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Solve linear inequalities in one unknown", "application", 1),
                            ("Represent solutions of inequalities on a number line", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "COORDINATE GEOMETRY",
                "code": "8.0",
                "form_level": 1,
                "order": 8,
                "periods": 12,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "The Cartesian plane",
                        "code": "8.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Locate points on the Cartesian plane", "application", 1),
                            ("Identify coordinates of points on the Cartesian plane", "knowledge", 2),
                        ],
                    },
                    {
                        "title": "Linear equations in two variables",
                        "code": "8.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Draw graphs of linear equations in two variables", "application", 1),
                            ("Determine the gradient and intercepts of a straight line", "analysis", 2),
                            ("Find the equation of a straight line given two points", "synthesis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MENSURATION",
                "code": "9.0",
                "form_level": 1,
                "order": 9,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Length and perimeter",
                        "code": "9.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate perimeter of triangles, rectangles, parallelograms and circles", "application", 1),
                        ],
                    },
                    {
                        "title": "Area",
                        "code": "9.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate area of triangles, rectangles, parallelograms, trapeziums and circles", "application", 1),
                            ("Solve problems involving area of combined shapes", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Volume",
                        "code": "9.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate volume of cubes, cuboids, cylinders and triangular prisms", "application", 1),
                            ("Calculate capacity of containers", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "ANGLES AND LINES",
                "code": "10.0",
                "form_level": 1,
                "order": 10,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Types of angles and angle properties",
                        "code": "10.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Identify types of angles: acute, right, obtuse, straight, reflex", "knowledge", 1),
                            ("Calculate angles on a straight line and at a point", "application", 2),
                        ],
                    },
                    {
                        "title": "Angles formed by parallel lines and a transversal",
                        "code": "10.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Identify corresponding, alternate and co-interior angles", "knowledge", 1),
                            ("Calculate angles formed by parallel lines and a transversal", "application", 2),
                        ],
                    },
                    {
                        "title": "Construction of angles",
                        "code": "10.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Construct angles of given sizes using a compass and ruler", "application", 1),
                        ],
                    },
                ],
            },
            # ── FORM II ──────────────────────────────────────────────────────
            {
                "title": "INDICES AND LOGARITHMS",
                "code": "1.0",
                "form_level": 2,
                "order": 11,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Indices (laws of exponents)",
                        "code": "1.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("State and apply the laws of indices: product, quotient, power, zero and negative indices", "application", 1),
                            ("Express numbers in standard form using indices", "application", 2),
                        ],
                    },
                    {
                        "title": "Logarithms",
                        "code": "1.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Define logarithms and relate them to indices", "comprehension", 1),
                            ("Find logarithms of numbers using tables and calculators", "application", 2),
                            ("Apply logarithms to solve multiplication, division and power problems", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "ALGEBRAIC EXPRESSIONS",
                "code": "2.0",
                "form_level": 2,
                "order": 12,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Expansion and factorization",
                        "code": "2.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Expand algebraic expressions using distributive property", "application", 1),
                            ("Factorize algebraic expressions by taking common factors", "application", 2),
                            ("Factorize quadratic expressions of the form ax^2 + bx + c", "application", 3),
                        ],
                    },
                    {
                        "title": "Algebraic fractions",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Simplify algebraic fractions", "application", 1),
                            ("Perform operations on algebraic fractions", "application", 2),
                        ],
                    },
                    {
                        "title": "Binary operations",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Define and evaluate binary operations", "comprehension", 1),
                            ("Solve problems involving defined binary operations", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "EQUATIONS",
                "code": "3.0",
                "form_level": 2,
                "order": 13,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Linear equations in two unknowns",
                        "code": "3.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Solve simultaneous linear equations in two unknowns by substitution and elimination", "application", 1),
                            ("Formulate simultaneous equations from word problems", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Quadratic equations",
                        "code": "3.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Solve quadratic equations by factoring, completing the square and formula", "application", 1),
                            ("Formulate quadratic equations from practical problems", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Linear inequalities",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Solve simultaneous linear inequalities in two unknowns", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "TRIGONOMETRY",
                "code": "4.0",
                "form_level": 2,
                "order": 14,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Trigonometric ratios",
                        "code": "4.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Define sine, cosine and tangent of an angle", "knowledge", 1),
                            ("Calculate trigonometric ratios of angles using tables and calculators", "application", 2),
                        ],
                    },
                    {
                        "title": "Trigonometric ratios of special angles",
                        "code": "4.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Determine trigonometric ratios of 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330 and 360 degrees", "application", 1),
                        ],
                    },
                    {
                        "title": "Applications of trigonometry",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Solve problems involving angles of elevation and depression", "application", 1),
                            ("Solve problems involving bearings", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "POLYGONS",
                "code": "5.0",
                "form_level": 2,
                "order": 15,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Types and properties of polygons",
                        "code": "5.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Identify types of polygons: triangles, quadrilaterals, pentagons, hexagons etc.", "knowledge", 1),
                            ("Calculate interior and exterior angles of polygons", "application", 2),
                        ],
                    },
                    {
                        "title": "Congruence and similarity",
                        "code": "5.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Identify conditions for congruence of triangles: SSS, SAS, ASA, RHS", "knowledge", 1),
                            ("Identify conditions for similarity of triangles", "knowledge", 2),
                            ("Solve problems using congruence and similarity", "application", 3),
                        ],
                    },
                    {
                        "title": "Pythagoras theorem",
                        "code": "5.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Apply Pythagoras theorem to find unknown sides of right-angled triangles", "application", 1),
                            ("Solve real-life problems using Pythagoras theorem", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "MATHEMATICAL ECONOMICS",
                "code": "6.0",
                "form_level": 2,
                "order": 16,
                "periods": 12,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Compound interest",
                        "code": "6.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate compound interest using A = P(1 + R/100)^n", "application", 1),
                            ("Solve problems involving compound interest", "application", 2),
                        ],
                    },
                    {
                        "title": "Hire purchase",
                        "code": "6.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate hire purchase price including deposit and interest", "application", 1),
                            ("Compare cash price and hire purchase price", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "TRANSFORMATIONS",
                "code": "7.0",
                "form_level": 2,
                "order": 17,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Reflection",
                        "code": "7.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Identify and draw reflections of shapes in given mirror lines", "application", 1),
                            ("Identify properties preserved under reflection", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Rotation",
                        "code": "7.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Rotate shapes about a given centre through given angles", "application", 1),
                        ],
                    },
                    {
                        "title": "Translation",
                        "code": "7.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Translate shapes by given vectors", "application", 1),
                        ],
                    },
                    {
                        "title": "Enlargement",
                        "code": "7.4",
                        "order": 4,
                        "periods": 2,
                        "outcomes": [
                            ("Enlarge shapes with a given scale factor and centre", "application", 1),
                        ],
                    },
                ],
            },
            # ── FORM III ─────────────────────────────────────────────────────
            {
                "title": "NUMBER BASES",
                "code": "1.0",
                "form_level": 3,
                "order": 18,
                "periods": 12,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Number bases other than base ten",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Convert numbers from base ten to other bases and vice versa", "application", 1),
                            ("Perform arithmetic operations in different bases", "application", 2),
                        ],
                    },
                    {
                        "title": "Application of number bases in computers",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Convert between binary, octal, hexadecimal and decimal systems", "application", 1),
                            ("Perform binary arithmetic: addition, subtraction, multiplication and division", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "RATES AND VARIATIONS",
                "code": "2.0",
                "form_level": 3,
                "order": 19,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Rates",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Solve problems involving rates of work, speed, flow and other rates", "application", 1),
                            ("Convert units of rates", "application", 2),
                        ],
                    },
                    {
                        "title": "Direct and inverse variations",
                        "code": "2.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Identify and solve problems involving direct variation", "application", 1),
                            ("Identify and solve problems involving inverse variation", "application", 2),
                            ("Identify and solve problems involving joint variation", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "SEQUENCES AND SERIES",
                "code": "3.0",
                "form_level": 3,
                "order": 20,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Arithmetic progressions (AP)",
                        "code": "3.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Identify and describe arithmetic progressions", "comprehension", 1),
                            ("Find the nth term of an AP", "application", 2),
                            ("Find the sum of the first n terms of an AP", "application", 3),
                        ],
                    },
                    {
                        "title": "Geometric progressions (GP)",
                        "code": "3.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Identify and describe geometric progressions", "comprehension", 1),
                            ("Find the nth term of a GP", "application", 2),
                            ("Find the sum of the first n terms and sum to infinity of a GP", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "QUADRATIC EQUATIONS",
                "code": "4.0",
                "form_level": 3,
                "order": 21,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Solving quadratic equations",
                        "code": "4.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Solve quadratic equations by factorization, completing the square and quadratic formula", "application", 1),
                            ("Determine the nature of roots using the discriminant", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Quadratic functions and graphs",
                        "code": "4.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Draw graphs of quadratic functions and identify the vertex, axis of symmetry and intercepts", "application", 1),
                            ("Solve quadratic equations graphically", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "SIMULTANEOUS EQUATIONS",
                "code": "5.0",
                "form_level": 3,
                "order": 22,
                "periods": 12,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Simultaneous linear equations",
                        "code": "5.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Solve simultaneous equations involving one linear and one quadratic equation", "application", 1),
                        ],
                    },
                    {
                        "title": "Simultaneous non-linear equations",
                        "code": "5.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Solve problems modeled by simultaneous equations", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "LOGARITHMS AND ANTLOGARITHMS",
                "code": "6.0",
                "form_level": 3,
                "order": 23,
                "periods": 12,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Logarithmic equations",
                        "code": "6.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Solve equations involving logarithms", "application", 1),
                            ("Use logarithm tables and antilog tables", "application", 2),
                        ],
                    },
                    {
                        "title": "Application of logarithms",
                        "code": "6.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Apply logarithms to solve real-life problems involving exponential growth and decay", "analysis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "MENSURATION III",
                "code": "7.0",
                "form_level": 3,
                "order": 24,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Surface area and volume of solids",
                        "code": "7.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Calculate surface area and volume of spheres, hemispheres, cones and pyramids", "application", 1),
                            ("Solve composite solid problems", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Arc length and sector area",
                        "code": "7.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate arc length of a circle", "application", 1),
                            ("Calculate area of a sector and segment", "application", 2),
                        ],
                    },
                    {
                        "title": "Length of chords and areas of segments",
                        "code": "7.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate the length of chords and areas of minor and major segments", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "GEOMETRICAL AND TRANSFORMATIONS",
                "code": "8.0",
                "form_level": 3,
                "order": 25,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Scale drawing",
                        "code": "8.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Make and interpret scale drawings", "application", 1),
                            ("Calculate actual distances from scale drawings", "application", 2),
                        ],
                    },
                    {
                        "title": "Bearings",
                        "code": "8.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate true bearings and compass directions", "application", 1),
                            ("Solve problems involving three-figure bearings", "application", 2),
                        ],
                    },
                    {
                        "title": "Construction of triangles",
                        "code": "8.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Construct triangles given: SSS, SAS, ASA, AAS and RHS", "application", 1),
                            ("Construct bisectors of angles and perpendicular bisectors", "application", 2),
                        ],
                    },
                ],
            },
            # ── FORM IV ──────────────────────────────────────────────────────
            {
                "title": "COORDINATE GEOMETRY II",
                "code": "1.0",
                "form_level": 4,
                "order": 26,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Distance and midpoint formulae",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate the distance between two points using the distance formula", "application", 1),
                            ("Find the midpoint of a line segment", "application", 2),
                        ],
                    },
                    {
                        "title": "Gradients and equations of lines",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate the gradient of a line segment", "application", 1),
                            ("Determine the equation of a straight line in various forms", "application", 2),
                            ("Determine parallel and perpendicular lines using gradients", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Area of triangles and quadrilaterals",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate the area of a triangle given coordinates of vertices", "application", 1),
                            ("Calculate the area of a quadrilateral given coordinates of vertices", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "AREA AND PERIMETER",
                "code": "2.0",
                "form_level": 4,
                "order": 27,
                "periods": 12,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Area of regular polygons",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate area of regular polygons using the formula A = 1/2 × perimeter × apothem", "application", 1),
                        ],
                    },
                    {
                        "title": "Surface area of solids",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate the surface area of composite solids", "analysis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "THREE DIMENSIONAL FIGURES",
                "code": "3.0",
                "form_level": 4,
                "order": 28,
                "periods": 14,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Three dimensional figures",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Identify properties of 3D figures: faces, edges, vertices", "knowledge", 1),
                            ("Draw 3D figures using isometric projection", "application", 2),
                        ],
                    },
                    {
                        "title": "Volume of composite solids",
                        "code": "3.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Calculate volume and capacity of composite 3D figures", "application", 1),
                            ("Solve real-world problems involving 3D figures", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PROBABILITY",
                "code": "4.0",
                "form_level": 4,
                "order": 29,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Basic probability",
                        "code": "4.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Define and calculate theoretical probability of simple events", "application", 1),
                            ("Use experiments to estimate probability", "application", 2),
                        ],
                    },
                    {
                        "title": "Combined events",
                        "code": "4.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate probability of combined events using addition and multiplication rules", "application", 1),
                            ("Use tree diagrams and Venn diagrams to solve probability problems", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Conditional probability",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate conditional probability", "analysis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "TRIGONOMETRY II",
                "code": "5.0",
                "form_level": 4,
                "order": 30,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "General angles and trigonometric functions",
                        "code": "5.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Determine trigonometric ratios of any angle", "application", 1),
                            ("Use the sine and cosine rules to solve triangles", "application", 2),
                        ],
                    },
                    {
                        "title": "Graphs of trigonometric functions",
                        "code": "5.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Draw graphs of y = sin x, y = cos x and y = tan x", "application", 1),
                            ("Solve trigonometric equations using graphs", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Trigonometric identities",
                        "code": "5.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Prove and apply the identity sin²θ + cos²θ = 1", "evaluation", 1),
                            ("Use compound angle formulae", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "VECTORS",
                "code": "6.0",
                "form_level": 4,
                "order": 31,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Introduction to vectors",
                        "code": "6.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Define and represent vectors using column and position notation", "comprehension", 1),
                            ("Add and subtract vectors", "application", 2),
                        ],
                    },
                    {
                        "title": "Magnitudes and directions",
                        "code": "6.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate the magnitude of a vector", "application", 1),
                            ("Determine the unit vector in the direction of a given vector", "application", 2),
                        ],
                    },
                    {
                        "title": "Applications of vectors",
                        "code": "6.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Solve problems involving position vectors and displacement", "analysis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "MATRICES",
                "code": "7.0",
                "form_level": 4,
                "order": 32,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Operations on matrices",
                        "code": "7.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Add, subtract and multiply matrices", "application", 1),
                            ("Find the determinant of 2×2 and 3×3 matrices", "application", 2),
                        ],
                    },
                    {
                        "title": "Inverse matrices",
                        "code": "7.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Find the inverse of a 2×2 matrix", "application", 1),
                            ("Use matrices to solve simultaneous equations", "application", 2),
                        ],
                    },
                    {
                        "title": "Transformations using matrices",
                        "code": "7.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Represent transformations using matrices", "application", 1),
                            ("Solve problems using matrix transformations", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "LINEAR PROGRAMMING",
                "code": "8.0",
                "form_level": 4,
                "order": 33,
                "periods": 10,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Inequalities in two unknowns",
                        "code": "8.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Graph linear inequalities in two unknowns", "application", 1),
                        ],
                    },
                    {
                        "title": "Linear programming problems",
                        "code": "8.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Formulate and solve linear programming problems graphically", "analysis", 1),
                            ("Find the optimal solution (maximum and minimum) of the objective function", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "STATISTICS AND DATA REPRESENTATION",
                "code": "9.0",
                "form_level": 4,
                "order": 34,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Data collection and presentation",
                        "code": "9.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Collect, organize and present data using tables, bar charts, histograms, frequency polygons and pie charts", "application", 1),
                        ],
                    },
                    {
                        "title": "Measures of central tendency",
                        "code": "9.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate mean, median, mode and their uses", "application", 1),
                            ("Calculate weighted mean and estimated mean from grouped data", "application", 2),
                        ],
                    },
                    {
                        "title": "Measures of dispersion",
                        "code": "9.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate range, variance and standard deviation", "application", 1),
                            ("Interpret data using measures of central tendency and dispersion", "analysis", 2),
                        ],
                    },
                ],
            },
        ],
    },

    # ========================================================================
    # ADVANCED MATHEMATICS (A-Level) — NECTA Code 021
    # Source: TIE Advanced Mathematics Syllabus Form V-VI (CBC 2023)
    # ========================================================================
    {
        "name": "Advanced Mathematics",
        "code": "AMATH",
        "slug": "advanced-mathematics",
        "necta_code": "021",
        "is_core": True,
        "description": "Advanced Mathematics for Advanced Secondary Education, Form V-VI. Covers calculus, complex numbers, vectors, statistics, differential equations, and advanced algebra.",
        "form_start": 5,
        "form_end": 6,
        "topics": [
            # ── FORM V ──────────────────────────────────────────────────────
            {
                "title": "CALCULATING DEVICES",
                "code": "1.0",
                "form_level": 5,
                "order": 1,
                "periods": 10,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "Operation of scientific calculators",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Operate non-programmable scientific calculators (Casio fx-991EX/ES series)", "knowledge", 1),
                            ("Use memory registers and computation modes", "application", 2),
                        ],
                    },
                    {
                        "title": "Computation modes and engineering notation",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Switch between computation, base-n, matrix, vector and statistics modes", "application", 1),
                            ("Evaluate complex functions and express results in engineering notation", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "SETS",
                "code": "2.0",
                "form_level": 5,
                "order": 2,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Advanced set identities and laws",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Prove set identities using De Morgan's Laws", "evaluation", 1),
                            ("Apply distributive, associative and commutative properties of sets", "application", 2),
                        ],
                    },
                    {
                        "title": "Three-set Venn diagrams",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Formulate and solve problems using three-set Venn diagrams", "analysis", 1),
                            ("Process census and survey data using set operations", "application", 2),
                        ],
                    },
                    {
                        "title": "Algebra of sets",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Use set laws to simplify expressions", "application", 1),
                            ("Verify set identities using element-wise arguments", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "LOGIC",
                "code": "3.0",
                "form_level": 5,
                "order": 3,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Propositions and truth tables",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Define propositions and determine their truth values", "knowledge", 1),
                            ("Construct truth tables for compound propositions", "application", 2),
                        ],
                    },
                    {
                        "title": "Logical connectives",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Use conjunction, disjunction, implication, biconditional and negation", "application", 1),
                            ("Translate English sentences into logical form", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Tautologies and contradictions",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify tautologies and contradictions using truth tables", "analysis", 1),
                            ("Simplify switching network circuits using logic", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "COORDINATE GEOMETRY I",
                "code": "4.0",
                "form_level": 5,
                "order": 4,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Locus concepts",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define and identify loci of points satisfying given conditions", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Straight lines",
                        "code": "4.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate perpendicular distances from points to lines", "application", 1),
                            ("Find angles between two intersecting lines", "application", 2),
                            ("Determine equations of angle bisectors", "application", 3),
                        ],
                    },
                    {
                        "title": "Ratio theorem",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Apply internal and external division using the ratio theorem", "application", 1),
                            ("Find coordinates of points dividing line segments in given ratios", "application", 2),
                        ],
                    },
                    {
                        "title": "The circle",
                        "code": "4.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Write the general equation of a circle and find centre and radius", "application", 1),
                            ("Determine equations of tangents to circles", "application", 2),
                            ("Solve problems involving intersection of lines and circles", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "FUNCTIONS",
                "code": "5.0",
                "form_level": 5,
                "order": 5,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Types of functions",
                        "code": "5.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Distinguish between inverse, composite, identity and constant functions", "comprehension", 1),
                            ("Determine domain and range from graphs and algebraic rules", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Graphing specialized functions",
                        "code": "5.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Graph piecewise functions and rational functions", "application", 1),
                            ("Identify asymptotes and evaluate symmetry of functions", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Composite and inverse functions",
                        "code": "5.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Find composite functions f(g(x)) and g(f(x))", "application", 1),
                            ("Determine inverse functions and state their domains", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "ALGEBRA",
                "code": "6.0",
                "form_level": 5,
                "order": 6,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Indices and logarithmic proofs",
                        "code": "6.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Prove laws of indices and logarithms", "evaluation", 1),
                        ],
                    },
                    {
                        "title": "The binomial theorem",
                        "code": "6.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Expand expressions using the binomial theorem", "application", 1),
                            ("Find specific terms and coefficients in binomial expansions", "application", 2),
                            ("Apply binomial theorem to numerical approximations", "application", 3),
                        ],
                    },
                    {
                        "title": "Partial fractions",
                        "code": "6.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Decompose rational functions with linear factors into partial fractions", "application", 1),
                            ("Handle repeated linear factors and irreducible quadratic factors", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Polynomial roots",
                        "code": "6.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Apply factor and remainder theorems to polynomials", "application", 1),
                            ("Find quadratic and cubic roots using algebraic methods", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "TRIGONOMETRY",
                "code": "7.0",
                "form_level": 5,
                "order": 7,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Compound and double angle formulas",
                        "code": "7.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Apply sin(A +/- B), cos(A +/- B) and tan(A +/- B) formulas", "application", 1),
                            ("Use double angle formulas for sin(2A), cos(2A) and tan(2A)", "application", 2),
                        ],
                    },
                    {
                        "title": "Factor formulas",
                        "code": "7.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Convert between product-to-sum and sum-to-product forms", "application", 1),
                        ],
                    },
                    {
                        "title": "Trigonometric equations",
                        "code": "7.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Find general solutions for trigonometric equations", "application", 1),
                            ("Solve conditional trigonometric expressions", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Inverse trigonometric functions",
                        "code": "7.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define and evaluate arcsin(x), arccos(x) and arctan(x)", "application", 1),
                            ("Determine domains and ranges of inverse trigonometric functions", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "LINEAR PROGRAMMING",
                "code": "8.0",
                "form_level": 5,
                "order": 8,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Advanced linear constraints",
                        "code": "8.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Formulate multivariable linear constraint inequalities", "application", 1),
                        ],
                    },
                    {
                        "title": "Feasible regions and optimization",
                        "code": "8.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Graph complex boundary parameters and identify feasible regions", "application", 1),
                            ("Determine empty, bounded or unbounded solution spaces", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Simplex method",
                        "code": "8.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Apply the simplex/vertex method to optimize objective functions", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "DIFFERENTIATION",
                "code": "9.0",
                "form_level": 5,
                "order": 9,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Limits and continuity",
                        "code": "9.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Evaluate limits of functions from first principles", "comprehension", 1),
                            ("Determine continuity of functions at given points", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Differentiation techniques",
                        "code": "9.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Apply the product rule, quotient rule and chain rule", "application", 1),
                            ("Perform implicit differentiation", "application", 2),
                            ("Differentiate parametric equations", "application", 3),
                        ],
                    },
                    {
                        "title": "Applications of differentiation",
                        "code": "9.3",
                        "order": 3,
                        "periods": 10,
                        "outcomes": [
                            ("Find equations of tangents and normals to curves", "application", 1),
                            ("Solve rates of change problems", "application", 2),
                            ("Determine stationary points and classify as maxima, minima or inflection points", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "INTEGRATION",
                "code": "10.0",
                "form_level": 5,
                "order": 10,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Integration as reverse differentiation",
                        "code": "10.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Find indefinite integrals of standard functions", "application", 1),
                            ("Apply the constant of integration", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Integration techniques",
                        "code": "10.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Use substitution method for integration", "application", 1),
                            ("Apply integration by parts", "application", 2),
                            ("Integrate using partial fraction decompositions", "application", 3),
                        ],
                    },
                    {
                        "title": "Definite integrals and areas",
                        "code": "10.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Evaluate definite integrals using the fundamental theorem of calculus", "application", 1),
                            ("Calculate bounded areas between curves and axes", "application", 2),
                        ],
                    },
                ],
            },
            # ── FORM VI ──────────────────────────────────────────────────────
            {
                "title": "COORDINATE GEOMETRY II",
                "code": "1.0",
                "form_level": 6,
                "order": 11,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The parabola",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Write standard equations of parabolas and identify focus, vertex and directrix", "application", 1),
                            ("Find equations of tangents and normals to parabolas", "application", 2),
                        ],
                    },
                    {
                        "title": "The ellipse",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Determine eccentricity and focus parameters of ellipses", "application", 1),
                            ("Write equations of major and minor axes", "application", 2),
                        ],
                    },
                    {
                        "title": "The hyperbola",
                        "code": "1.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Identify asymptotes and focus locations of hyperbolas", "application", 1),
                            ("Analyze rectangular hyperbola parameters", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "HYPERBOLIC FUNCTIONS",
                "code": "2.0",
                "form_level": 6,
                "order": 12,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Definitions and identities",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Define sinh(x), cosh(x), tanh(x), sech(x), cosech(x) and coth(x)", "knowledge", 1),
                            ("State and prove hyperbolic identities", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Log-form conversions",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Convert inverse hyperbolic functions to logarithmic form", "application", 1),
                        ],
                    },
                    {
                        "title": "Calculus of hyperbolic functions",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Differentiate hyperbolic functions", "application", 1),
                            ("Integrate hyperbolic functions", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "VECTORS",
                "code": "3.0",
                "form_level": 6,
                "order": 13,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "3D vector operations",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Represent vectors in 3D Cartesian space using i, j, k configurations", "comprehension", 1),
                            ("Perform addition, subtraction and scalar multiplication in 3D", "application", 2),
                        ],
                    },
                    {
                        "title": "Scalar and vector products",
                        "code": "3.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate dot (scalar) product of two vectors", "application", 1),
                            ("Calculate cross (vector) product of two vectors", "application", 2),
                        ],
                    },
                    {
                        "title": "Scalar triple product",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Compute scalar triple product and interpret volume of parallelepipeds", "application", 1),
                        ],
                    },
                    {
                        "title": "Lines and planes in 3D",
                        "code": "3.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Write equations of lines and planes in 3D space", "application", 1),
                            ("Calculate angles of intersection between planes", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "COMPLEX NUMBERS",
                "code": "4.0",
                "form_level": 6,
                "order": 14,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Algebra of complex numbers",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Perform addition, subtraction, multiplication and division of complex numbers", "application", 1),
                            ("Find the conjugate and modulus of a complex number", "application", 2),
                        ],
                    },
                    {
                        "title": "Argand diagram",
                        "code": "4.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Represent complex numbers on the Argand diagram", "application", 1),
                            ("Determine modulus and argument of complex numbers", "application", 2),
                        ],
                    },
                    {
                        "title": "Polar and exponential forms",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Convert complex numbers to polar form z = r(cos theta + i sin theta)", "application", 1),
                            ("Convert to exponential (Euler's) form z = re^(itheta)", "application", 2),
                        ],
                    },
                    {
                        "title": "De Moivre's Theorem",
                        "code": "4.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Apply De Moivre's Theorem to find powers of complex numbers", "application", 1),
                            ("Calculate nth roots of complex numbers", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "NUMERICAL METHODS",
                "code": "5.0",
                "form_level": 6,
                "order": 15,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Root-finding methods",
                        "code": "5.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Locate roots using graphical sign changes", "application", 1),
                            ("Apply bisection, secant and Newton-Raphson methods", "application", 2),
                        ],
                    },
                    {
                        "title": "Iterative approximations",
                        "code": "5.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Formulate iterative sequences for root approximation", "application", 1),
                            ("Determine convergence of iterative methods", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Numerical integration",
                        "code": "5.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Apply the trapezoidal rule for area approximation", "application", 1),
                            ("Apply Simpson's rule for area approximation under curves", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "DIFFERENTIAL EQUATIONS",
                "code": "6.0",
                "form_level": 6,
                "order": 16,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "First-order differential equations",
                        "code": "6.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Solve separable variable differential equations", "application", 1),
                            ("Solve homogeneous differential equations", "application", 2),
                            ("Apply integrating factors for linear differential equations", "application", 3),
                        ],
                    },
                    {
                        "title": "Second-order differential equations",
                        "code": "6.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Form auxiliary equations for second-order linear homogeneous equations", "application", 1),
                            ("Solve second-order equations with constant coefficients", "application", 2),
                        ],
                    },
                    {
                        "title": "Applications of differential equations",
                        "code": "6.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Model real-world phenomena using differential equations", "analysis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "STATISTICS",
                "code": "7.0",
                "form_level": 6,
                "order": 17,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Measures of central tendency for grouped data",
                        "code": "7.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate mean, median and mode for grouped frequency distributions", "application", 1),
                            ("Estimate missing values using measures of central tendency", "application", 2),
                        ],
                    },
                    {
                        "title": "Measures of dispersion",
                        "code": "7.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate mean deviation, variance and standard deviation for grouped data", "application", 1),
                            ("Interpret data spread using measures of dispersion", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Coding methods",
                        "code": "7.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Apply step-deviation techniques to handle large data sets", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "PROBABILITY DISTRIBUTIONS",
                "code": "8.0",
                "form_level": 6,
                "order": 18,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Permutations and combinations",
                        "code": "8.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate permutations nPr and combinations nCr", "application", 1),
                        ],
                    },
                    {
                        "title": "Conditional probability and Bayes' Theorem",
                        "code": "8.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate conditional probability P(A|B)", "application", 1),
                            ("Apply Bayes' Theorem to revise probabilities", "application", 2),
                        ],
                    },
                    {
                        "title": "Discrete random variables",
                        "code": "8.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Determine probability mass functions", "application", 1),
                            ("Calculate expected value E(X) and variance V(X)", "application", 2),
                        ],
                    },
                    {
                        "title": "Probability distributions",
                        "code": "8.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Apply binomial distribution to model discrete events", "application", 1),
                            ("Apply Poisson distribution to model rare events", "application", 2),
                            ("Apply normal distribution and use z-score standardization", "application", 3),
                        ],
                    },
                ],
            },
        ],
    },

    # ========================================================================
    # PHYSICS — NECTA Code 031
    # Source: TIE Physics Syllabus Form I-IV
    # ========================================================================
    {
        "name": "Physics",
        "code": "PHYS",
        "slug": "physics",
        "necta_code": "031",
        "is_core": True,
        "description": "Physics for Ordinary and Advanced Secondary Education, Form I-VI. Covers mechanics, waves, electricity, magnetism, thermodynamics, modern physics and advanced electromagnetism.",
        "form_start": 1,
        "form_end": 6,
        "topics": [
            {
                "title": "INTRODUCTION TO PHYSICS",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 10,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "What is Physics?",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define Physics and its branches", "knowledge", 1),
                            ("Identify careers related to Physics", "knowledge", 2),
                        ],
                    },
                    {
                        "title": "Physics laboratory and safety",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Identify common laboratory apparatus and their uses", "knowledge", 1),
                            ("Observe laboratory safety rules", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "MEASUREMENT",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Physical quantities and SI units",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Identify and state SI units of basic physical quantities", "knowledge", 1),
                            ("Use prefixes and standard form for large and small measurements", "application", 2),
                        ],
                    },
                    {
                        "title": "Length, mass, time and temperature measurements",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Measure length using vernier calipers, micrometers and metre rules", "application", 1),
                            ("Measure mass using beam balance and electronic balance", "application", 2),
                            ("Measure time using stopwatches and tickers timers", "application", 3),
                            ("Measure temperature using thermometers", "application", 4),
                        ],
                    },
                    {
                        "title": "Errors and uncertainties",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify and classify errors: systematic, random and gross errors", "knowledge", 1),
                            ("Calculate absolute, relative and percentage errors", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "FORCE",
                "code": "3.0",
                "form_level": 1,
                "order": 3,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Types of forces",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Identify types of forces: gravitational, friction, elastic, magnetic, electrostatic", "knowledge", 1),
                            ("Distinguish between contact and non-contact forces", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Effects of forces",
                        "code": "3.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the effects of forces on the shape, size and motion of objects", "comprehension", 1),
                            ("Apply Hooke's law F = kx", "application", 2),
                        ],
                    },
                    {
                        "title": "Friction",
                        "code": "3.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the advantages and disadvantages of friction", "comprehension", 1),
                            ("Explain methods of reducing friction", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "MOTION",
                "code": "4.0",
                "form_level": 1,
                "order": 4,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Distance-time and speed-time graphs",
                        "code": "4.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Interpret distance-time graphs", "analysis", 1),
                            ("Interpret speed-time graphs", "analysis", 2),
                            ("Calculate acceleration and deceleration from speed-time graphs", "application", 3),
                        ],
                    },
                    {
                        "title": "Equations of motion",
                        "code": "4.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Derive and apply the equations of motion: v = u + at, s = ut + ½at², v² = u² + 2as", "application", 1),
                            ("Solve problems involving uniformly accelerated motion", "application", 2),
                        ],
                    },
                    {
                        "title": "Free fall",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe motion under gravity (free fall)", "comprehension", 1),
                            ("Solve problems involving bodies falling freely under gravity", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "DENSITY AND PRESSURE",
                "code": "5.0",
                "form_level": 1,
                "order": 5,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Density",
                        "code": "5.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Define density ρ = m/V and calculate it", "application", 1),
                            ("Measure density of regular and irregular solids and liquids", "application", 2),
                        ],
                    },
                    {
                        "title": "Pressure in fluids",
                        "code": "5.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Define pressure P = F/A", "knowledge", 1),
                            ("Calculate atmospheric pressure and its effects", "application", 2),
                            ("Explain how hydraulic systems work using Pascal's principle", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Pressure in solids",
                        "code": "5.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate pressure due to solids", "application", 1),
                        ],
                    },
                ],
            },
            # ── FORM II ──────────────────────────────────────────────────────
            {
                "title": "WORK, ENERGY AND POWER",
                "code": "1.0",
                "form_level": 2,
                "order": 6,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Work",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Define work W = Fs cosθ and calculate it", "application", 1),
                            ("Calculate work done against gravity and friction", "application", 2),
                        ],
                    },
                    {
                        "title": "Energy",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Identify forms of energy: kinetic, potential, chemical, heat, electrical, light, sound, nuclear", "knowledge", 1),
                            ("Apply conservation of energy", "application", 2),
                        ],
                    },
                    {
                        "title": "Power",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Define power P = W/t and calculate it in watts and horsepower", "application", 1),
                            ("Solve problems involving power in machines", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "MACHINE",
                "code": "2.0",
                "form_level": 2,
                "order": 7,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Simple machines",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Identify simple machines: lever, pulley, inclined plane, wheel and axle, screw, wedge", "knowledge", 1),
                            ("Calculate mechanical advantage MA = Load/Effort", "application", 2),
                        ],
                    },
                    {
                        "title": "Velocity ratio, efficiency and mechanical advantage",
                        "code": "2.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Calculate velocity ratio VR = distance moved by effort/distance moved by load", "application", 1),
                            ("Calculate efficiency η = MA/VR × 100%", "application", 2),
                            ("Explain why efficiency is always less than 100%", "comprehension", 3),
                        ],
                    },
                ],
            },
            {
                "title": "SOLIDS, LIQUIDS AND GASES",
                "code": "3.0",
                "form_level": 2,
                "order": 8,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Kinetic theory of matter",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the three states of matter using kinetic theory", "comprehension", 1),
                            ("Explain Brownian motion", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Thermal expansion",
                        "code": "3.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe expansion of solids, liquids and gases when heated", "comprehension", 1),
                            ("Give practical applications and problems of thermal expansion", "application", 2),
                        ],
                    },
                    {
                        "title": "Gas laws",
                        "code": "3.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("State and apply Boyle's law P₁V₁ = P₂V₂", "application", 1),
                            ("State and apply Charles's law V₁/T₁ = V₂/T₂", "application", 2),
                            ("State and apply Pressure law P₁/T₁ = P₂/T₂", "application", 3),
                        ],
                    },
                ],
            },
            # ── FORM III ─────────────────────────────────────────────────────
            {
                "title": "HEAT",
                "code": "1.0",
                "form_level": 3,
                "order": 9,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Heat capacity and specific heat capacity",
                        "code": "1.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Define heat capacity and specific heat capacity", "knowledge", 1),
                            ("Calculate heat energy Q = mcΔθ", "application", 2),
                            ("Solve calorimetry problems", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Change of state and latent heat",
                        "code": "1.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe change of state: melting, freezing, evaporation, condensation, sublimation", "comprehension", 1),
                            ("Calculate latent heat Q = mL", "application", 2),
                        ],
                    },
                    {
                        "title": "Ideal gas law",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("State and apply the ideal gas law PV = nRT", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "LIGHT",
                "code": "2.0",
                "form_level": 3,
                "order": 10,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Reflection of light",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("State and apply the laws of reflection", "application", 1),
                            ("Draw ray diagrams for plane mirrors", "application", 2),
                            ("Describe image formation by plane, concave and convex mirrors", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Refraction of light",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("State and apply Snell's law n₁sinθ₁ = n₂sinθ₂", "application", 1),
                            ("Explain total internal reflection and its applications", "comprehension", 2),
                            ("Describe image formation by lenses", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Dispersion of light",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe dispersion of white light using a prism", "comprehension", 1),
                            ("Identify the visible spectrum and invisible radiations", "knowledge", 2),
                        ],
                    },
                ],
            },
            {
                "title": "SOUND",
                "code": "3.0",
                "form_level": 3,
                "order": 11,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Production and propagation of sound",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe how sound is produced and propagated", "comprehension", 1),
                            ("Describe characteristics of sound: pitch, loudness and quality", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Speed of sound and echo",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate speed of sound using s = d/t", "application", 1),
                            ("Solve problems involving echo and reverberation", "application", 2),
                        ],
                    },
                    {
                        "title": "Ultrasonics and noise pollution",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Define ultrasonics and describe its applications", "comprehension", 1),
                            ("Explain noise pollution and its control", "comprehension", 2),
                        ],
                    },
                ],
            },
            # ── FORM IV ──────────────────────────────────────────────────────
            {
                "title": "ELECTROSTATICS",
                "code": "1.0",
                "form_level": 4,
                "order": 12,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Electric charge and Coulomb's law",
                        "code": "1.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Identify types of charges and their interactions", "knowledge", 1),
                            ("State and apply Coulomb's law F = kq₁q₂/r²", "application", 2),
                        ],
                    },
                    {
                        "title": "Electric field and potential",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe electric fields and draw field lines", "comprehension", 1),
                            ("Calculate electric potential and potential difference", "application", 2),
                        ],
                    },
                    {
                        "title": "Capacitors",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Define capacitance and calculate energy stored in a capacitor E = ½CV²", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "CURRENT ELECTRICITY",
                "code": "2.0",
                "form_level": 4,
                "order": 13,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Electric current, potential difference and resistance",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Define electric current, potential difference and resistance", "knowledge", 1),
                            ("State and apply Ohm's law V = IR", "application", 2),
                        ],
                    },
                    {
                        "title": "Circuit diagrams and components",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Draw and interpret circuit diagrams using standard symbols", "application", 1),
                            ("Connect resistors in series and parallel and calculate total resistance", "application", 2),
                        ],
                    },
                    {
                        "title": "Electrical energy and power",
                        "code": "2.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Calculate electrical energy E = VIt = I²Rt = V²t/R", "application", 1),
                            ("Calculate electrical power P = VI = I²R = V²/R", "application", 2),
                            ("Calculate cost of electrical energy", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MAGNETISM AND ELECTROMAGNETISM",
                "code": "3.0",
                "form_level": 4,
                "order": 14,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Properties of magnets and magnetic fields",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe properties of magnets and magnetic materials", "comprehension", 1),
                            ("Draw magnetic field lines around bar magnets", "application", 2),
                        ],
                    },
                    {
                        "title": "Electromagnetism",
                        "code": "3.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the magnetic effect of electric current", "comprehension", 1),
                            ("Apply the right-hand grip rule", "application", 2),
                            ("Describe the force on a current-carrying conductor in a magnetic field", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Electromagnetic induction",
                        "code": "3.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe electromagnetic induction and Faraday's law", "comprehension", 1),
                            ("Explain how generators and transformers work", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "MODERN PHYSICS",
                "code": "4.0",
                "form_level": 4,
                "order": 15,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "X-rays and radioactivity",
                        "code": "4.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the production and uses of X-rays", "comprehension", 1),
                            ("Describe alpha, beta and gamma radiation", "comprehension", 2),
                            ("Explain half-life and radioactive decay", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Photoelectric effect and energy levels",
                        "code": "4.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the photoelectric effect", "comprehension", 1),
                            ("Apply E = hf and Einstein's photoelectric equation", "application", 2),
                            ("Describe Bohr's model of the atom and energy levels", "comprehension", 3),
                        ],
                    },
                ],
            },
            # ── FORM V (Advanced Physics I) ──────────────────────────────────
            {
                "title": "MEASUREMENT AND ERROR ANALYSIS",
                "code": "1.0",
                "form_level": 5,
                "order": 16,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Dimensions and dimensional analysis",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("State dimensions of physical quantities", "knowledge", 1),
                            ("Use dimensional analysis to verify equations", "application", 2),
                        ],
                    },
                    {
                        "title": "Error estimation and propagation",
                        "code": "1.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Distinguish systematic and random errors", "comprehension", 1),
                            ("Calculate absolute, relative and fractional errors", "application", 2),
                            ("Compute propagation of errors in compound equations", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MECHANICS I",
                "code": "2.0",
                "form_level": 5,
                "order": 17,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Kinematics and equations of motion",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Derive equations of motion under constant acceleration", "application", 1),
                            ("Define velocity and acceleration using calculus", "application", 2),
                        ],
                    },
                    {
                        "title": "Projectile motion",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Derive trajectory, time of flight, range and maximum height", "application", 1),
                        ],
                    },
                    {
                        "title": "Newton's laws and momentum",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Apply Newton's laws of motion", "application", 1),
                            ("Solve problems on impulse and conservation of linear momentum", "application", 2),
                            ("Analyze elastic and inelastic collisions in two dimensions", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Circular motion",
                        "code": "2.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Apply centripetal acceleration and force formulas", "application", 1),
                            ("Analyze conical pendulums and banking of roads", "application", 2),
                        ],
                    },
                    {
                        "title": "Rotational dynamics",
                        "code": "2.5",
                        "order": 5,
                        "periods": 6,
                        "outcomes": [
                            ("Define moment of inertia and torque", "application", 1),
                            ("Apply conservation of angular momentum", "application", 2),
                            ("Calculate rotational kinetic energy", "application", 3),
                        ],
                    },
                    {
                        "title": "Gravitation",
                        "code": "2.6",
                        "order": 6,
                        "periods": 6,
                        "outcomes": [
                            ("Apply Newton's law of gravitation and gravitational field strength", "application", 1),
                            ("Analyze satellite orbital mechanics and escape velocity", "application", 2),
                            ("Apply Kepler's laws of planetary motion", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "FLUID MECHANICS",
                "code": "3.0",
                "form_level": 5,
                "order": 18,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Fluid flow and equation of continuity",
                        "code": "3.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Distinguish streamline and turbulent flow", "comprehension", 1),
                            ("Apply the equation of continuity", "application", 2),
                        ],
                    },
                    {
                        "title": "Bernoulli's principle",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Derive and apply Bernoulli's equation", "application", 1),
                            ("Explain applications in Venturi meter, Pitot tubes and lift", "application", 2),
                        ],
                    },
                    {
                        "title": "Viscosity",
                        "code": "3.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Apply Poiseuille's formula and Stokes' law", "application", 1),
                            ("Determine terminal velocity", "application", 2),
                        ],
                    },
                    {
                        "title": "Surface tension",
                        "code": "3.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Explain surface energy and capillary rise", "comprehension", 1),
                            ("Solve problems on angle of contact and capillarity", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PROPERTIES OF MATTER",
                "code": "4.0",
                "form_level": 5,
                "order": 19,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Elasticity",
                        "code": "4.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Apply Hooke's law and define stress and strain", "application", 1),
                            ("Calculate Young's, bulk and shear moduli", "application", 2),
                        ],
                    },
                    {
                        "title": "Elastic potential energy",
                        "code": "4.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Calculate work done in stretching a wire", "application", 1),
                            ("Apply elastic potential energy parameters", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "KINETIC THEORY AND GAS LAWS",
                "code": "5.0",
                "form_level": 5,
                "order": 20,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Ideal gas theory",
                        "code": "5.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("State ideal gas assumptions", "knowledge", 1),
                            ("Derive ideal gas pressure from kinetic theory", "application", 2),
                        ],
                    },
                    {
                        "title": "Molecular speed distribution",
                        "code": "5.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe Maxwell-Boltzmann distribution of molecular speeds", "comprehension", 1),
                            ("Calculate root-mean-square velocity", "application", 2),
                        ],
                    },
                    {
                        "title": "Real gases",
                        "code": "5.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Compare real and ideal gases", "analysis", 1),
                            ("Apply the Van der Waals equation of state", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "THERMODYNAMICS",
                "code": "6.0",
                "form_level": 5,
                "order": 21,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Laws of thermodynamics",
                        "code": "6.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("State the zeroth, first and second laws of thermodynamics", "knowledge", 1),
                            ("Apply the first law delta Q = delta U + delta W", "application", 2),
                        ],
                    },
                    {
                        "title": "Thermodynamic processes",
                        "code": "6.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze isothermal, adiabatic, isobaric and isochoric processes", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Heat engines and entropy",
                        "code": "6.3",
                        "order": 3,
                        "periods": 10,
                        "outcomes": [
                            ("Analyze heat engines and refrigerators", "application", 1),
                            ("Calculate Carnot cycle efficiencies", "application", 2),
                            ("Explain entropy concepts", "comprehension", 3),
                        ],
                    },
                ],
            },
            {
                "title": "WAVE MOTION AND OSCILLATIONS",
                "code": "7.0",
                "form_level": 5,
                "order": 22,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Simple harmonic motion",
                        "code": "7.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Set up and solve SHM differential equations", "application", 1),
                            ("Analyze displacement, velocity and acceleration in SHM", "analysis", 2),
                            ("Explain energy transformations in springs and torsion pendulums", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Progressive wave equations",
                        "code": "7.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Write the equation of a progressive wave", "application", 1),
                        ],
                    },
                    {
                        "title": "Superposition of waves",
                        "code": "7.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze stationary waves in strings and air columns", "analysis", 1),
                            ("Identify harmonics and overtones", "knowledge", 2),
                        ],
                    },
                    {
                        "title": "Acoustic phenomena",
                        "code": "7.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Explain beats formation", "comprehension", 1),
                            ("Apply the Doppler effect for sound waves", "application", 2),
                        ],
                    },
                ],
            },
            # ── FORM VI (Advanced Physics II) ────────────────────────────────
            {
                "title": "ELECTROSTATICS",
                "code": "1.0",
                "form_level": 6,
                "order": 23,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Coulomb's law",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Apply Coulomb's law for point charges in vacuum and dielectrics", "application", 1),
                        ],
                    },
                    {
                        "title": "Electric fields and Gauss's law",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Define electric field strength and flux", "knowledge", 1),
                            ("Apply Gauss's law to spheres, cylinders and planes", "application", 2),
                        ],
                    },
                    {
                        "title": "Electric potential",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Define potential difference and equipotential surfaces", "knowledge", 1),
                            ("Analyze electric potential energy profiles", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Capacitance",
                        "code": "1.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze parallel plate capacitors and dielectrics", "analysis", 1),
                            ("Calculate energy stored in capacitors and RC circuits", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "CURRENT ELECTRICITY (ADVANCED)",
                "code": "2.0",
                "form_level": 6,
                "order": 24,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Kirchhoff's laws",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze circuits using loop and junction rules", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Measuring instruments",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Apply Wheatstone bridge and meter bridge methods", "application", 1),
                            ("Use potentiometer to compare e.m.f. and find internal resistance", "application", 2),
                        ],
                    },
                    {
                        "title": "Thermoelectricity",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Explain Seebeck, Peltier and Thomson effects", "comprehension", 1),
                            ("Apply thermocouple concepts", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "ELECTROMAGNETISM AND MAGNETIC FIELDS",
                "code": "3.0",
                "form_level": 6,
                "order": 25,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Biot-Savart and Ampere's laws",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Apply Biot-Savart law and Ampere's circuital law", "application", 1),
                            ("Calculate fields around conductors, solenoids and toroids", "application", 2),
                        ],
                    },
                    {
                        "title": "Lorentz force",
                        "code": "3.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Apply the Lorentz force on moving charges", "application", 1),
                            ("Analyze cyclotron motion parameters", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Magnetic properties of materials",
                        "code": "3.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Compare diamagnetic, paramagnetic and ferromagnetic materials", "analysis", 1),
                            ("Interpret hysteresis loops", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "ALTERNATING CURRENT CIRCUITS",
                "code": "4.0",
                "form_level": 6,
                "order": 26,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "A.C. generation and r.m.s. values",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Describe A.C. generation", "comprehension", 1),
                            ("Distinguish r.m.s. and peak values", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Reactance in A.C. circuits",
                        "code": "4.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Analyze resistive, inductive and capacitive A.C. circuits", "analysis", 1),
                            ("Calculate reactance parameters", "application", 2),
                        ],
                    },
                    {
                        "title": "LCR series circuits",
                        "code": "4.3",
                        "order": 3,
                        "periods": 10,
                        "outcomes": [
                            ("Calculate impedance and use phasor diagrams", "application", 1),
                            ("Analyze power factor and resonance frequency", "analysis", 2),
                            ("Compute Q-factor", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "WAVE OPTICS",
                "code": "5.0",
                "form_level": 6,
                "order": 27,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Huygens' principle",
                        "code": "5.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Explain wavefronts and Huygens' principle", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Interference of light",
                        "code": "5.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze Young's double slit experiment", "analysis", 1),
                            ("Derive fringe width and analyze thin film interference", "application", 2),
                        ],
                    },
                    {
                        "title": "Diffraction",
                        "code": "5.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Analyze single-slit diffraction and diffraction gratings", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Polarization",
                        "code": "5.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Apply Brewster's law and Malus's law", "application", 1),
                            ("Explain production and detection of polarized light", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "MODERN PHYSICS AND QUANTUM MECHANICS",
                "code": "6.0",
                "form_level": 6,
                "order": 28,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Photoelectric effect",
                        "code": "6.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Apply Einstein's photoelectric equation", "application", 1),
                            ("Determine work function, threshold frequency and stopping potential", "application", 2),
                        ],
                    },
                    {
                        "title": "Wave-particle duality",
                        "code": "6.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Apply the de Broglie wavelength formula", "application", 1),
                            ("Explain the Heisenberg uncertainty principle", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Atomic models and spectra",
                        "code": "6.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Apply Bohr's theory of the hydrogen atom", "application", 1),
                            ("Analyze energy level transitions and line spectra series", "analysis", 2),
                        ],
                    },
                    {
                        "title": "X-ray physics",
                        "code": "6.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Describe X-ray production in a Coolidge tube", "comprehension", 1),
                            ("Distinguish continuous and characteristic spectra and apply Bragg's law", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "SOLID STATE ELECTRONICS",
                "code": "7.0",
                "form_level": 6,
                "order": 29,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Energy band theory",
                        "code": "7.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Classify insulators, semiconductors and conductors using band theory", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Bipolar junction transistors",
                        "code": "7.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Analyze NPN and PNP transistor arrangements", "analysis", 1),
                            ("Interpret common-emitter configurations and characteristics", "comprehension", 2),
                            ("Design transistor switching circuits", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "Operational amplifiers",
                        "code": "7.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Apply ideal op-amp properties", "application", 1),
                            ("Analyze inverting and non-inverting configurations", "analysis", 2),
                        ],
                    },
                ],
            },
        ],
    },

    # ========================================================================
    # CHEMISTRY — NECTA Code 032
    # Source: TIE Chemistry Syllabus Form I-IV
    # ========================================================================
    {
        "name": "Chemistry",
        "code": "CHEM",
        "slug": "chemistry",
        "necta_code": "032",
        "is_core": True,
        "description": "Chemistry for Ordinary and Advanced Secondary Education, Form I-VI. Covers matter, atomic structure, chemical bonding, reactions, organic chemistry, physical chemistry and industrial chemistry.",
        "form_start": 1,
        "form_end": 6,
        "topics": [
            {
                "title": "INTRODUCTION TO CHEMISTRY",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 10,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "What is Chemistry?",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define Chemistry and its importance in daily life", "comprehension", 1),
                            ("Identify careers related to Chemistry", "knowledge", 2),
                        ],
                    },
                    {
                        "title": "Laboratory apparatus and safety",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Identify common chemistry laboratory apparatus and their uses", "knowledge", 1),
                            ("Observe laboratory safety rules", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "SIMPLE CLASSIFICATION OF MATTER",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "States of matter and changes of state",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the three states of matter and their properties", "comprehension", 1),
                            ("Explain changes of state: melting, freezing, evaporation, condensation, sublimation", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Elements, compounds and mixtures",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Distinguish between elements, compounds and mixtures", "analysis", 1),
                            ("Separate mixtures using: filtration, distillation, chromatography, sublimation, magnetic separation", "application", 2),
                        ],
                    },
                    {
                        "title": "Solutions",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Define solute, solvent and solution", "knowledge", 1),
                            ("Describe saturation and solubility", "comprehension", 2),
                            ("Calculate concentration of solutions in g/dm³ and mol/dm³", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "AIR AND COMBUSTION",
                "code": "3.0",
                "form_level": 1,
                "order": 3,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Composition of air",
                        "code": "3.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("State the composition of air: nitrogen (78%), oxygen (21%), other gases (1%)", "knowledge", 1),
                            ("Describe the role of oxygen in combustion and respiration", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Rusting and its prevention",
                        "code": "3.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Explain the conditions necessary for rusting", "comprehension", 1),
                            ("Describe methods of preventing rusting", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Air pollution",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify causes and effects of air pollution", "knowledge", 1),
                            ("Suggest methods of controlling air pollution", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "WATER AND HYDROGEN",
                "code": "4.0",
                "form_level": 1,
                "order": 4,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Properties and uses of water",
                        "code": "4.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe physical and chemical properties of water", "comprehension", 1),
                            ("Explain water pollution and purification methods", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Hydrogen",
                        "code": "4.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe laboratory preparation of hydrogen gas", "comprehension", 1),
                            ("Describe the properties and uses of hydrogen", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Hard and soft water",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Distinguish between temporary and permanent hard water", "analysis", 1),
                            ("Describe methods of softening hard water", "comprehension", 2),
                        ],
                    },
                ],
            },
            # ── FORM II ──────────────────────────────────────────────────────
            {
                "title": "ATOMIC STRUCTURE",
                "code": "1.0",
                "form_level": 2,
                "order": 5,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Atomic models",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe Dalton's, Thomson's, Rutherford's and Bohr's atomic models", "comprehension", 1),
                            ("State the structure of an atom: protons, neutrons and electrons", "knowledge", 2),
                        ],
                    },
                    {
                        "title": "Atomic number and mass number",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Define atomic number Z and mass number A", "knowledge", 1),
                            ("Determine number of protons, neutrons and electrons in atoms and ions", "application", 2),
                            ("Write electronic configurations of elements", "application", 3),
                        ],
                    },
                    {
                        "title": "The Periodic Table",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the arrangement of elements in the periodic table", "comprehension", 1),
                            ("Identify trends in the periodic table: atomic radius, ionization energy, electronegativity", "analysis", 2),
                            ("Classify elements as metals, non-metals and metalloids", "classification", 3),
                        ],
                    },
                ],
            },
            {
                "title": "CHEMICAL BONDING",
                "code": "2.0",
                "form_level": 2,
                "order": 6,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Ionic bonding",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe ionic bonding with dot-and-cross diagrams", "comprehension", 1),
                            ("Explain the properties of ionic compounds", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Covalent bonding",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe covalent bonding with dot-and-cross diagrams", "comprehension", 1),
                            ("Explain the properties of covalent compounds", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Metallic bonding",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe metallic bonding using the sea of electrons model", "comprehension", 1),
                            ("Explain properties of metals using metallic bonding", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Coordinate bonding and intermolecular forces",
                        "code": "2.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Describe coordinate (dative) covalent bonding", "comprehension", 1),
                            ("Explain intermolecular forces: van der Waals and hydrogen bonding", "comprehension", 2),
                        ],
                    },
                ],
            },
            # ── FORM III ─────────────────────────────────────────────────────
            {
                "title": "CHEMICAL REACTIONS",
                "code": "1.0",
                "form_level": 3,
                "order": 7,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Types of chemical reactions",
                        "code": "1.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Classify reactions: combination, decomposition, displacement, double decomposition, combustion", "classification", 1),
                            ("Write word and balanced chemical equations", "application", 2),
                        ],
                    },
                    {
                        "title": "Acids, bases and salts",
                        "code": "1.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Define acids, bases and salts", "knowledge", 1),
                            ("Describe the preparation of salts: neutralization, precipitation, titration", "application", 2),
                            ("Use indicators and pH scale to measure acidity and alkalinity", "application", 3),
                        ],
                    },
                    {
                        "title": "Mole concept and stoichiometry",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Define the mole and Avogadro's constant", "knowledge", 1),
                            ("Calculate molar mass, molar volume of gas at STP", "application", 2),
                            ("Perform stoichiometric calculations from balanced equations", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "GASES",
                "code": "2.0",
                "form_level": 3,
                "order": 8,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Molar gas volume",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the molar volume of a gas at STP (22.4 dm³)", "knowledge", 1),
                            ("Calculate the volume of gases using molar volume", "application", 2),
                        ],
                    },
                    {
                        "title": "Ideal gas equation",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Apply PV = nRT to solve gas problems", "application", 1),
                            ("Describe gas preparation and collection methods", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Gas laws",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Apply Boyle's, Charles's and Pressure laws to chemical problems", "application", 1),
                        ],
                    },
                ],
            },
            # ── FORM IV ──────────────────────────────────────────────────────
            {
                "title": "ORGANIC CHEMISTRY",
                "code": "1.0",
                "form_level": 4,
                "order": 9,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Introduction to organic chemistry",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Define organic chemistry and identify characteristics of organic compounds", "comprehension", 1),
                            ("Name and draw structural formulae of first six alkanes", "application", 2),
                        ],
                    },
                    {
                        "title": "Homologous series: alkanes, alkenes, alcohols",
                        "code": "1.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe properties and reactions of alkanes (substitution)", "comprehension", 1),
                            ("Describe properties and reactions of alkenes (addition)", "comprehension", 2),
                            ("Describe properties and reactions of alcohols (oxidation, esterification)", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Hydrocarbons and their derivatives",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe cracking and reforming of hydrocarbons", "comprehension", 1),
                            ("Explain the uses of organic compounds in daily life", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Polymers",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Describe addition and condensation polymerization", "comprehension", 1),
                            ("Identify uses and environmental effects of polymers", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "SALTS",
                "code": "2.0",
                "form_level": 4,
                "order": 10,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Preparation of salts",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Prepare soluble salts by neutralization and titration", "application", 1),
                            ("Prepare insoluble salts by precipitation", "application", 2),
                        ],
                    },
                    {
                        "title": "Properties of salts",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe thermal decomposition of salts", "comprehension", 1),
                            ("Use salt analysis to identify unknown salts", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Water of crystallization",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Determine the formula of a salt containing water of crystallization", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "ELECTROLYSIS",
                "code": "3.0",
                "form_level": 4,
                "order": 11,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Electrolytic cells and electrolysis",
                        "code": "3.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Define electrolysis and distinguish electrolytic cells from electrochemical cells", "comprehension", 1),
                            ("Describe the electrolysis of molten compounds and aqueous solutions", "comprehension", 2),
                            ("Apply Faraday's laws of electrolysis", "application", 3),
                        ],
                    },
                    {
                        "title": "Applications of electrolysis",
                        "code": "3.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe electroplating and its applications", "comprehension", 1),
                            ("Describe purification of metals by electrolysis", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Electrochemical cells",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe primary cells (Leclanché, dry cell)", "comprehension", 1),
                            ("Describe secondary cells (lead-acid accumulator, lithium-ion)", "comprehension", 2),
                        ],
                    },
                ],
            },
            # ── FORM V (Advanced Chemistry I) ────────────────────────────────
            {
                "title": "DOMAIN A: PHYSICAL CHEMISTRY I",
                "code": "1.0",
                "form_level": 5,
                "order": 12,
                "periods": 40,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Atomic structure and periodicity",
                        "code": "1.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Describe modern atomic models and quantum numbers", "comprehension", 1),
                            ("Analyze electron configurations and the Aufbau principle", "analysis", 2),
                            ("Explain periodic trends in ionization energy, electronegativity and atomic radius", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Chemical energetics",
                        "code": "1.2",
                        "order": 2,
                        "periods": 14,
                        "outcomes": [
                            ("Apply Hess's law to calculate reaction enthalpies", "application", 1),
                            ("Calculate bond energies and hydration enthalpies", "application", 2),
                            ("Analyze enthalpy and entropy contributions to spontaneity via Gibbs free energy", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Chemical kinetics",
                        "code": "1.3",
                        "order": 3,
                        "periods": 14,
                        "outcomes": [
                            ("Define reaction rate and rate law coefficients", "knowledge", 1),
                            ("Apply the Arrhenius equation and activation energy concepts", "application", 2),
                            ("Interpret zero, first and second order reactions", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "DOMAIN B: INORGANIC CHEMISTRY I",
                "code": "2.0",
                "form_level": 5,
                "order": 13,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Bonding and structure of solids",
                        "code": "2.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Compare ionic, covalent, metallic and hydrogen bonds", "analysis", 1),
                            ("Relate crystal lattices to physical properties", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "s-block and p-block elements",
                        "code": "2.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Describe reactions of Group 1 and Group 2 metals", "comprehension", 1),
                            ("Analyze trends in Groups 13-18 elements and their compounds", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Oxidation-reduction and electrochemistry",
                        "code": "2.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Balance redox equations using oxidation numbers", "application", 1),
                            ("Apply electrochemical series and Nernst equation", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "DOMAIN C: ORGANIC CHEMISTRY I",
                "code": "3.0",
                "form_level": 5,
                "order": 14,
                "periods": 38,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Structural and stereochemistry",
                        "code": "3.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Name compounds using IUPAC nomenclature", "application", 1),
                            ("Distinguish structural and stereoisomers (geometric and optical)", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Hydrocarbons and their derivatives",
                        "code": "3.2",
                        "order": 2,
                        "periods": 14,
                        "outcomes": [
                            ("Predict reactions of alkanes, alkenes, alkynes and arenas", "application", 1),
                            ("Describe reactions of haloalkanes and alcohols", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Reaction mechanisms",
                        "code": "3.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Classify substitution, addition, elimination and rearrangement reactions", "analysis", 1),
                            ("Illustrate nucleophilic and electrophilic substitution mechanisms", "synthesis", 2),
                        ],
                    },
                ],
            },
            # ── FORM VI (Advanced Chemistry II) ──────────────────────────────
            {
                "title": "DOMAIN A: PHYSICAL CHEMISTRY II",
                "code": "1.0",
                "form_level": 6,
                "order": 15,
                "periods": 40,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Chemical equilibria",
                        "code": "1.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("State the equilibrium law and interpret equilibrium constants", "knowledge", 1),
                            ("Apply Le Chatelier's principle to shifts in equilibrium", "application", 2),
                            ("Analyze acid-base and solubility equilibria", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Electrochemistry and thermodynamics",
                        "code": "1.2",
                        "order": 2,
                        "periods": 14,
                        "outcomes": [
                            ("Apply Faraday's laws of electrolysis", "application", 1),
                            ("Relate Gibbs free energy to electromotive force", "application", 2),
                            ("Analyze electrolytic cells and fuel cells", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Quantum chemistry",
                        "code": "1.3",
                        "order": 3,
                        "periods": 14,
                        "outcomes": [
                            ("Describe atomic orbitals and wave functions", "comprehension", 1),
                            ("Apply molecular orbital theory to diatomic molecules", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "DOMAIN B: INORGANIC CHEMISTRY II",
                "code": "2.0",
                "form_level": 6,
                "order": 16,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Transition metal chemistry",
                        "code": "2.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Describe variable oxidation states and colour of transition metals", "comprehension", 1),
                            ("Explain crystal field theory and complex ion formation", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Environmental and industrial chemistry",
                        "code": "2.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Analyze pollution and green chemistry principles", "analysis", 1),
                            ("Describe extraction of metals (sodium, aluminium, iron)", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Qualitative and quantitative analysis",
                        "code": "2.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Apply analytical techniques for cation and anion identification", "application", 1),
                            ("Perform volumetric and gravimetric calculations", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "DOMAIN C: ORGANIC CHEMISTRY II",
                "code": "3.0",
                "form_level": 6,
                "order": 17,
                "periods": 38,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Carbonyl compounds and carboxylic acids",
                        "code": "3.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Predict reactions of aldehydes and ketones", "application", 1),
                            ("Describe reactions of carboxylic acids and their derivatives", "application", 2),
                        ],
                    },
                    {
                        "title": "Nitrogen compounds and polymers",
                        "code": "3.2",
                        "order": 2,
                        "periods": 14,
                        "outcomes": [
                            ("Describe amines, amides, nitriles and diazonium salts", "comprehension", 1),
                            ("Explain polymerization and the structure of macromolecules", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Spectroscopy of organic compounds",
                        "code": "3.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Interpret infrared spectra to identify functional groups", "analysis", 1),
                            ("Use mass spectrometry and NMR to deduce structure", "analysis", 2),
                        ],
                    },
                ],
            },
        ],
    },

    # ========================================================================
    # BIOLOGY — NECTA Code 033
    # Source: TIE Biology Syllabus Form I-IV
    # ========================================================================
    {
        "name": "Biology",
        "code": "BIO",
        "slug": "biology",
        "necta_code": "033",
        "is_core": True,
        "description": "Biology for Ordinary and Advanced Secondary Education, Form I-VI. Covers cell biology, genetics, ecology, human physiology, plants, microorganisms, biochemistry and evolution.",
        "form_start": 1,
        "form_end": 6,
        "topics": [
            {
                "title": "BIOLOGY AND ITS APPLICATIONS",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 10,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "What is Biology?",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Define Biology and its branches: botany, zoology, microbiology, genetics, ecology", "knowledge", 1),
                            ("Identify biology-related careers", "knowledge", 2),
                        ],
                    },
                    {
                        "title": "Cell biology basics",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the cell theory", "comprehension", 1),
                            ("Identify structures of plant and animal cells", "knowledge", 2),
                        ],
                    },
                ],
            },
            {
                "title": "CELL STRUCTURE AND ORGANIZATION",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Cell structure",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Identify organelles: nucleus, mitochondria, ribosomes, endoplasmic reticulum, Golgi apparatus, lysosomes, vacuoles, cell membrane, cell wall, chloroplasts", "knowledge", 1),
                            ("Distinguish between plant and animal cells", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Levels of organization",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe levels of organization: cell → tissue → organ → organ system → organism", "comprehension", 1),
                            ("Identify tissues: epithelial, connective, muscular, nervous", "knowledge", 2),
                        ],
                    },
                    {
                        "title": "Cell division",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe mitosis and its significance", "comprehension", 1),
                            ("Describe meiosis and its significance", "comprehension", 2),
                            ("Compare mitosis and meiosis", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "NUTRITION",
                "code": "3.0",
                "form_level": 1,
                "order": 3,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Modes of nutrition",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe autotrophic and heterotrophic nutrition", "comprehension", 1),
                            ("Identify types of heterotrophic nutrition: holozoic, saprophytic, parasitic, symbiotic", "knowledge", 2),
                        ],
                    },
                    {
                        "title": "Plant nutrition",
                        "code": "3.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe photosynthesis: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂", "comprehension", 1),
                            ("Explain factors affecting photosynthesis", "analysis", 2),
                            ("Describe mineral nutrition in plants", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Human nutrition",
                        "code": "3.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Identify classes of food and their functions", "knowledge", 1),
                            ("Describe the human alimentary canal and functions of its parts", "comprehension", 2),
                            ("Describe nutrition disorders: kwashiorkor, marasmus, rickets, scurvy, goitre", "comprehension", 3),
                        ],
                    },
                ],
            },
            # ── FORM II ──────────────────────────────────────────────────────
            {
                "title": "GASEOUS EXCHANGE",
                "code": "1.0",
                "form_level": 2,
                "order": 4,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Gaseous exchange in humans",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the structure of the human respiratory system", "comprehension", 1),
                            ("Explain the mechanism of breathing: inspiration and expiration", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Gaseous exchange in plants",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe gaseous exchange through stomata and lenticels", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Respiratory disorders",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify respiratory disorders: asthma, bronchitis, pneumonia, emphysema", "knowledge", 1),
                            ("Explain the effects of smoking on the respiratory system", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "CIRCULATION",
                "code": "2.0",
                "form_level": 2,
                "order": 5,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The human circulatory system",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the structure and function of the heart", "comprehension", 1),
                            ("Trace the path of blood through the body: pulmonary and systemic circulation", "comprehension", 2),
                            ("Describe blood composition: red blood cells, white blood cells, platelets, plasma", "knowledge", 3),
                        ],
                    },
                    {
                        "title": "Blood vessels and blood pressure",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Distinguish between arteries, veins and capillaries", "analysis", 1),
                            ("Describe blood pressure and its regulation", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Heart disorders",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify heart disorders: hypertension, heart attack, atherosclerosis", "knowledge", 1),
                        ],
                    },
                ],
            },
            # ── FORM III ─────────────────────────────────────────────────────
            {
                "title": "EXCRETION",
                "code": "1.0",
                "form_level": 3,
                "order": 6,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Excretory organs and systems",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Identify excretory organs: kidneys, lungs, skin, liver", "knowledge", 1),
                            ("Describe the structure of the kidney and nephron", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Urine formation",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the process of urine formation: filtration, reabsorption, secretion", "comprehension", 1),
                            ("Explain osmoregulation", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Kidney disorders",
                        "code": "1.3",
                        "order": 3,
                        "periods": 2,
                        "outcomes": [
                            ("Describe kidney disorders: kidney stones, kidney failure, dialysis", "comprehension", 1),
                        ],
                    },
                ],
            },
            {
                "title": "REPRODUCTION",
                "code": "2.0",
                "form_level": 3,
                "order": 7,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Human reproductive system",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the male and female reproductive systems", "comprehension", 1),
                            ("Explain the menstrual cycle and hormonal control", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Fertilization and development",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe internal and external fertilization", "comprehension", 1),
                            ("Describe embryonic development and the role of the placenta", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Reproduction in plants",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe sexual and asexual reproduction in plants", "comprehension", 1),
                            ("Describe pollination and its types: self, cross, wind, insect", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Reproductive health",
                        "code": "2.4",
                        "order": 4,
                        "periods": 2,
                        "outcomes": [
                            ("Describe STIs: HIV/AIDS, gonorrhoea, syphilis and their prevention", "comprehension", 1),
                            ("Describe contraceptive methods", "comprehension", 2),
                        ],
                    },
                ],
            },
            # ── FORM IV ──────────────────────────────────────────────────────
            {
                "title": "GENETICS",
                "code": "1.0",
                "form_level": 4,
                "order": 8,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Mendelian genetics",
                        "code": "1.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Define gene, allele, genotype and phenotype", "knowledge", 1),
                            ("Apply monohybrid and dihybrid crosses using Punnett squares", "application", 2),
                            ("Explain the laws of segregation and independent assortment", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Inheritance patterns",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Explain Mendelian and non-Mendelian inheritance: incomplete dominance, codominance, sex-linkage", "comprehension", 1),
                            ("Use genetic crosses to predict outcomes of inherited traits", "application", 2),
                        ],
                    },
                    {
                        "title": "DNA and biotechnology",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the structure of DNA and its role in protein synthesis", "comprehension", 1),
                            ("Explain genetic engineering and its applications", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "ECOLOGY",
                "code": "2.0",
                "form_level": 4,
                "order": 9,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Ecosystems",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Define ecosystem and identify its biotic and abiotic components", "knowledge", 1),
                            ("Describe food chains and food webs", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Energy flow and nutrient cycling",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe energy flow through ecosystems: producers, consumers, decomposers", "comprehension", 1),
                            ("Explain carbon, nitrogen and water cycles", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Environmental conservation",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe human activities that damage the environment: deforestation, pollution, overgrazing", "comprehension", 1),
                            ("Explain conservation methods: afforestation, recycling, protected areas", "comprehension", 2),
                            ("Describe the effects of global warming and ozone depletion", "comprehension", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MAN AND HIS ENVIRONMENT",
                "code": "3.0",
                "form_level": 4,
                "order": 10,
                "periods": 12,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Parasitism, symbiosis and commensalism",
                        "code": "3.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Distinguish between parasitism, mutualism and commensalism", "analysis", 1),
                            ("Identify examples of each relationship in ecosystems", "knowledge", 2),
                        ],
                    },
                    {
                        "title": "Adaptations",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe structural, physiological and behavioral adaptations of organisms", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Evolution",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Explain theories of evolution: Lamarckism and Darwinism", "comprehension", 1),
                            ("Describe evidence for evolution: fossils, comparative anatomy, biogeography", "comprehension", 2),
                        ],
                    },
                ],
            },
            # ── FORM V (Advanced Biology I) ──────────────────────────────────
            {
                "title": "CYTOGENETICS AND MOLECULAR BIOLOGY",
                "code": "1.0",
                "form_level": 5,
                "order": 11,
                "periods": 34,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Cytogenetics",
                        "code": "1.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the structure and behaviour of chromosomes", "analysis", 1),
                            ("Describe linkage, crossing-over and gene maps", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Nucleic acids and gene expression",
                        "code": "1.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Explain DNA replication and transcription and translation", "comprehension", 1),
                            ("Describe gene regulation mechanisms", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Protein synthesis",
                        "code": "1.3",
                        "order": 3,
                        "periods": 10,
                        "outcomes": [
                            ("Trace the steps of protein synthesis and the genetic code", "application", 1),
                            ("Describe the effects of mutations on gene products", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "GROWTH AND DEVELOPMENT",
                "code": "2.0",
                "form_level": 5,
                "order": 12,
                "periods": 26,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Growth in plants",
                        "code": "2.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Describe meristematic activity and cell differentiation in plants", "comprehension", 1),
                            ("Explain physiological and morphological responses of plants to stimuli", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Growth in animals",
                        "code": "2.2",
                        "order": 2,
                        "periods": 14,
                        "outcomes": [
                            ("Describe the role of hormones in animal growth and development", "comprehension", 1),
                            ("Compare human growth and development patterns across life stages", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "COORDINATION, IRRITABILITY AND MOVEMENT",
                "code": "3.0",
                "form_level": 5,
                "order": 13,
                "periods": 28,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Nervous coordination",
                        "code": "3.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Describe the transmission of nerve impulses across synapses", "comprehension", 1),
                            ("Analyze reflex actions and their centre", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Chemical and sensory coordination",
                        "code": "3.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe endocrine regulation and pheromone function", "comprehension", 1),
                            ("Describe sensory receptors and perception", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Movement and locomotion",
                        "code": "3.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Describe mechanisms of movement in animals and plants", "comprehension", 1),
                            ("Relate muscle structure to contraction", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "GASEOUS EXCHANGE AND RESPIRATION",
                "code": "4.0",
                "form_level": 5,
                "order": 14,
                "periods": 26,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Gaseous exchange mechanisms",
                        "code": "4.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Describe gaseous exchange in plants, insects, fish and mammals", "comprehension", 1),
                            ("Compare transport structures supporting gas exchange", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Cellular respiration",
                        "code": "4.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Summarize glycolysis, the Krebs cycle and the electron transport chain", "comprehension", 1),
                            ("Compare aerobic and anaerobic respiration and ATP yield", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Respiratory diseases",
                        "code": "4.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe causes and prevention of common respiratory diseases", "comprehension", 1),
                        ],
                    },
                ],
            },
            {
                "title": "EXCRETION AND HOMEOSTASIS",
                "code": "5.0",
                "form_level": 5,
                "order": 15,
                "periods": 26,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Excretory organs",
                        "code": "5.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Describe the structure and function of excretory organs (kidney, liver, lungs, skin)", "comprehension", 1),
                            ("Describe the formation of urine and kidney homeostasis", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Homeostatic regulation",
                        "code": "5.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Describe regulation of temperature, water, glucose and pH balance", "comprehension", 1),
                            ("Explain the role of feedback mechanisms in homeostasis", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Homeostatic disorders",
                        "code": "5.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe diabetes, kidney failure, acidosis and osmoregulation disorders", "comprehension", 1),
                        ],
                    },
                ],
            },
            # ── FORM VI (Advanced Biology II) ────────────────────────────────
            {
                "title": "NUTRITION, METABOLISM AND SUPPORT",
                "code": "1.0",
                "form_level": 6,
                "order": 16,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Nutrients, vitamins and metabolism",
                        "code": "1.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Describe the classes and functions of nutrients and vitamins", "comprehension", 1),
                            ("Analyze metabolism, mineral nutrition and vitamins in the body", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Principles of nutrition in living organisms",
                        "code": "1.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Compare autotrophic and heterotrophic modes of nutrition", "analysis", 1),
                            ("Describe balanced diet, food preparation and preservation", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Plant and animal support systems",
                        "code": "1.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Describe support systems in plants (turgidity, wood, fibers)", "comprehension", 1),
                            ("Describe support systems in animals (skeletons, hydrostatic)", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "TRANSPORT IN LIVING ORGANISMS",
                "code": "2.0",
                "form_level": 6,
                "order": 17,
                "periods": 26,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Transport in plants",
                        "code": "2.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Describe uptake of water and minerals by roots", "comprehension", 1),
                            ("Explain cohesion-tension and pressure-flow hypotheses of translocation", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Transport in mammals",
                        "code": "2.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Describe circulation of blood and lymph", "comprehension", 1),
                            ("Describe blood groups and systemic circulation", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Cardiovascular and transport disorders",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe hypertension, anemia and other transport disorders", "comprehension", 1),
                        ],
                    },
                ],
            },
            {
                "title": "NUTRITION, DIGESTION AND ENZYMES",
                "code": "3.0",
                "form_level": 6,
                "order": 18,
                "periods": 26,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Enzymes and catalysis",
                        "code": "3.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Describe the mechanism of enzyme action", "comprehension", 1),
                            ("Analyze factors affecting enzyme activity", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Digestion and absorption",
                        "code": "3.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Trace the digestive process in the gastrointestinal tract", "comprehension", 1),
                            ("Describe absorption of digested products", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Nutritional disorders",
                        "code": "3.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe deficiency diseases such as kwashiorkor and marasmus", "comprehension", 1),
                        ],
                    },
                ],
            },
            {
                "title": "GENETICS, EVOLUTION AND CLASSIFICATION",
                "code": "4.0",
                "form_level": 6,
                "order": 19,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Regulation of gene expression",
                        "code": "4.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Explain operon models and gene regulation in prokaryotes and eukaryotes", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Variation, mutation and genetics defects",
                        "code": "4.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe causes and effects of genetic chromosome defects", "comprehension", 1),
                            ("Apply probability to solve genetics problems", "application", 2),
                        ],
                    },
                    {
                        "title": "DNA technology and genetic engineering",
                        "code": "4.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Describe recombinant DNA technology and gene cloning", "comprehension", 1),
                            ("Discuss ethical issues of genetic engineering and biotechnology", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Modern taxonomy",
                        "code": "4.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Describe classification systems and phylogenetics", "comprehension", 1),
                            ("Apply dichotomous keys for identification", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "ORGANISMS AND THEIR ENVIRONMENT",
                "code": "5.0",
                "form_level": 6,
                "order": 20,
                "periods": 26,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Ecosystem organization",
                        "code": "5.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the components and functioning of ecosystems", "comprehension", 1),
                            ("Describe energy flow and nutrient cycles", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Population ecology",
                        "code": "5.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze population growth models and carrying capacity", "analysis", 1),
                            ("Describe population structure and sampling methods", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Applied ecology",
                        "code": "5.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Explain succession, parasitism and co-evolution", "analysis", 1),
                            ("Apply ecology to land, water and field studies", "application", 2),
                            ("Describe conservation strategies for biodiversity", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "REPRODUCTION AND DEVELOPMENT",
                "code": "6.0",
                "form_level": 6,
                "order": 21,
                "periods": 26,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Reproduction in plants and animals",
                        "code": "6.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Describe the reproductive structures of flowering plants", "comprehension", 1),
                            ("Describe reproductive processes in animals", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Hormonal regulation of reproduction",
                        "code": "6.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Explain the hormonal control of the menstrual cycle", "comprehension", 1),
                            ("Describe contraception and family planning methods", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Pregnancy and development",
                        "code": "6.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Describe fertilization, implantation and embryonic development", "comprehension", 1),
                            ("Describe childbirth and the protection of the embryo", "comprehension", 2),
                        ],
                    },
                ],
            },
        ],
    },

    # ========================================================================
    # ENGLISH LANGUAGE — NECTA Code 011
    # Source: TIE English Language Syllabus Form I-IV
    # ========================================================================
    {
        "name": "English Language",
        "code": "ENG",
        "slug": "english",
        "necta_code": "011",
        "is_core": True,
        "description": "English Language for Ordinary and Advanced Secondary Education, Form I-VI. Covers grammar, vocabulary, composition, comprehension, literature, translation and advanced linguistics.",
        "form_start": 1,
        "form_end": 6,
        "topics": [
            {
                "order": 1,
                "code": "1.0",
                "form_level": 1,
                "title": "Listening and Speaking (Oral Communication)",
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Listen attentively to spoken information and respond appropriately", "comprehension", 1),
                            ("Express ideas and information clearly in spoken English", "application", 2)
                        ],
                        "title": "Expressing Information"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Engage in polite social interactions using appropriate register", "application", 3),
                            ("Initiate and sustain conversations in familiar contexts", "application", 4)
                        ],
                        "title": "Social Interactions"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Identify basic speech sounds and sound patterns in English", "knowledge", 5),
                            ("Pronounce English phonemes with reasonable accuracy", "application", 6)
                        ],
                        "title": "Phonetics Foundations"
                    }
                ]
            },
            {
                "order": 2,
                "code": "2.0",
                "form_level": 1,
                "title": "Grammar Patterns (Part I)",
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Identify nouns and pronouns and their functions in sentences", "knowledge", 7),
                            ("Use nouns and pronouns correctly in writing and speech", "application", 8)
                        ],
                        "title": "Nouns and Pronouns"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Recognize main verb forms and tense patterns", "knowledge", 9),
                            ("Conjugate verbs accurately across basic tenses", "application", 10)
                        ],
                        "title": "Verbs and Tenses"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Identify adjectives and prepositions and their uses", "knowledge", 11),
                            ("Apply adjectives and prepositions appropriately in sentences", "application", 12)
                        ],
                        "title": "Adjectives and Prepositions"
                    }
                ]
            },
            {
                "order": 3,
                "code": "3.0",
                "form_level": 1,
                "title": "Reading for Comprehension (Part I)",
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Read texts aloud with correct pacing and expression", "application", 13),
                            ("Demonstrate fluency in oral reading passages", "application", 14)
                        ],
                        "title": "Reading aloud and pacing"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Read silently to locate specific details in a text", "comprehension", 15),
                            ("Answer comprehension questions based on locating details", "comprehension", 16)
                        ],
                        "title": "Silent reading and locating details"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Infer the meaning of new words from context", "comprehension", 17),
                            ("Build a personal vocabulary from reading materials", "application", 18)
                        ],
                        "title": "Expanding vocabulary"
                    }
                ]
            },
            {
                "order": 4,
                "code": "4.0",
                "form_level": 1,
                "title": "Writing Skills (Part I)",
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Apply basic punctuation marks correctly", "application", 19),
                            ("Use capitalization and punctuation to clarify meaning", "application", 20)
                        ],
                        "title": "Punctuation mechanics"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Construct simple Subject-Verb-Object sentences", "application", 21),
                            ("Join sentences to form coherent paragraphs", "synthesis", 22)
                        ],
                        "title": "Sentence formations (SVO)"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Write functional texts such as letters and invitations", "synthesis", 23),
                            ("Complete forms with accurate personal information", "application", 24)
                        ],
                        "title": "Functional writing (letters, invitations, forms)"
                    }
                ]
            },
            {
                "order": 5,
                "code": "5.0",
                "form_level": 1,
                "title": "Vocabulary Building and Expressions",
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Use expressions to state preferences and needs clearly", "application", 25),
                            ("Respond to expressions of preference and need appropriately", "application", 26)
                        ],
                        "title": "Expressions for preferences and needs"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Categorize vocabulary clusters for numbers and time", "application", 27),
                            ("Use vocabulary related to school and occupations in context", "application", 28)
                        ],
                        "title": "Vocabulary clusters (school, occupations, time, numbers)"
                    }
                ]
            },
            {
                "order": 6,
                "code": "6.0",
                "form_level": 1,
                "title": "Introduction to Literature",
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 6,
                        "outcomes": [
                            ("Define literature and explain its purposes", "knowledge", 29),
                            ("Discuss the value of literature in society", "comprehension", 30)
                        ],
                        "title": "Definition and purpose of literature"
                    },
                    {
                        "periods": 4,
                        "outcomes": [
                            ("Distinguish between oral and written literature", "analysis", 31),
                            ("Give examples of oral and written literary works", "comprehension", 32)
                        ],
                        "title": "Oral vs Written literature"
                    },
                    {
                        "periods": 6,
                        "outcomes": [
                            ("Identify primary literary genres", "knowledge", 33),
                            ("Differentiate plays, novels, and poetry", "analysis", 34)
                        ],
                        "title": "Primary genres (plays, novels, poetry)"
                    }
                ]
            },
            {
                "order": 7,
                "code": "1.0",
                "form_level": 2,
                "title": "Structural Grammar (Part II)",
                "periods": 26,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Use tenses and modal verbs accurately in context", "application", 35),
                            ("Distinguish shades of meaning among modals", "analysis", 36)
                        ],
                        "title": "Tenses and modals"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Use adverbs and conjunctions to connect ideas", "application", 37),
                            ("Arrange adverbial and conjunctional structures correctly", "synthesis", 38)
                        ],
                        "title": "Adverbs and conjunctions"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Convert direct speech to indirect speech accurately", "application", 38),
                            ("Apply backshifting rules in reported speech", "application", 39)
                        ],
                        "title": "Direct and indirect speech"
                    }
                ]
            },
            {
                "order": 8,
                "code": "2.0",
                "form_level": 2,
                "title": "Professional and Academic Writing",
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Write official correspondence following standard formats", "application", 40),
                            ("Compose formal letters with appropriate tone", "synthesis", 41)
                        ],
                        "title": "Official correspondence"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Draft resumes and application letters", "application", 42),
                            ("Present qualifications and experience effectively", "synthesis", 43)
                        ],
                        "title": "Resumes and application letters"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Take notes from spoken and written sources", "application", 44),
                            ("Organize notes into useful summaries", "application", 45)
                        ],
                        "title": "Note-taking"
                    }
                ]
            },
            {
                "order": 9,
                "code": "3.0",
                "form_level": 2,
                "title": "Reading for Fluency and Critical Inference",
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Apply skimming and scanning techniques to texts", "application", 46),
                            ("Locate both general and specific information efficiently", "comprehension", 47)
                        ],
                        "title": "Skimming and scanning"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Differentiate fact from opinion in texts", "analysis", 48),
                            ("Evaluate claims based on textual evidence", "evaluation", 49)
                        ],
                        "title": "Fact vs opinion"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Expand vocabulary across specific fields of study", "application", 50),
                            ("Use field-specific vocabulary in written contexts", "application", 51)
                        ],
                        "title": "Vocabulary growth fields"
                    }
                ]
            },
            {
                "order": 10,
                "code": "4.0",
                "form_level": 2,
                "title": "Spoken English and Debate Mechanics",
                "periods": 22,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 6,
                        "outcomes": [
                            ("Construct coherent arguments and counterarguments", "synthesis", 52),
                            ("Support positions with reasons and evidence", "application", 53)
                        ],
                        "title": "Arguments and counterarguments"
                    },
                    {
                        "periods": 6,
                        "outcomes": [
                            ("Participate in panel debates and presentations", "application", 54),
                            ("Moderate and follow debate procedures", "application", 55)
                        ],
                        "title": "Panel debates and presentations"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Apply word stress patterns in spoken English", "application", 56),
                            ("Use appropriate telephone etiquette in conversations", "application", 57)
                        ],
                        "title": "Word stress and telephone etiquette"
                    }
                ]
            },
            {
                "order": 11,
                "code": "5.0",
                "form_level": 2,
                "title": "Introduction to Literary Analysis",
                "periods": 22,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 12,
                        "outcomes": [
                            ("Identify plot, themes, characters, and settings in literary works", "comprehension", 58),
                            ("Analyze the relationship between literary elements", "analysis", 59)
                        ],
                        "title": "Plot, themes, characters, settings"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Analyze short stories for meaning and technique", "analysis", 60),
                            ("Write short analyses of a story's key elements", "synthesis", 61)
                        ],
                        "title": "Analyzing short stories"
                    }
                ]
            },
            {
                "order": 12,
                "code": "6.0",
                "form_level": 2,
                "title": "Idiomatic Expressions and Word Combinations",
                "periods": 18,
                "weight": "low",
                "subtopics": [
                    {
                        "periods": 6,
                        "outcomes": [
                            ("Recognize and explain common idioms", "comprehension", 62),
                            ("Use idioms appropriately in context", "application", 63)
                        ],
                        "title": "Common idioms"
                    },
                    {
                        "periods": 6,
                        "outcomes": [
                            ("Identify phrasal verbs and their meanings", "knowledge", 64),
                            ("Use phrasal verbs correctly in sentences", "application", 65)
                        ],
                        "title": "Phrasal verbs"
                    },
                    {
                        "periods": 6,
                        "outcomes": [
                            ("Recognize common collocations in English", "comprehension", 66),
                            ("Produce natural-sounding collocations in writing", "application", 67)
                        ],
                        "title": "Collocations"
                    }
                ]
            },
            {
                "order": 13,
                "code": "1.0",
                "form_level": 3,
                "title": "Advanced Analytical Grammar",
                "periods": 26,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Transform active sentences into the passive voice", "application", 68),
                            ("Explain when the passive voice is appropriate", "analysis", 69)
                        ],
                        "title": "The passive voice"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Form conditional sentences of Types 0 to 3", "application", 70),
                            ("Distinguish the meaning of each conditional type", "analysis", 71)
                        ],
                        "title": "Conditional sentences (Type 0-3)"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Use relative clauses to combine and enrich sentences", "application", 72),
                            ("Distinguish defining and non-defining clauses", "analysis", 73)
                        ],
                        "title": "Relative clauses"
                    }
                ]
            },
            {
                "order": 14,
                "code": "2.0",
                "form_level": 3,
                "title": "Creative and Digital Writing",
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Write descriptive compositions with vivid detail", "synthesis", 74),
                            ("Write narrative compositions with coherent plot", "synthesis", 75)
                        ],
                        "title": "Descriptive and narrative compositions"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Write effective emails and blog posts", "application", 76),
                            ("Adapt tone and style for digital audiences", "synthesis", 77)
                        ],
                        "title": "Digital communication (emails, blogs)"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Record minutes of meetings in standard format", "application", 78),
                            ("Summarize deliberations and resolutions accurately", "synthesis", 79)
                        ],
                        "title": "Minutes of meetings"
                    }
                ]
            },
            {
                "order": 15,
                "code": "3.0",
                "form_level": 3,
                "title": "Literary Critique: Selected Plays",
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Read and understand the two class plays", "comprehension", 80),
                            ("Summarize the plot of each play", "comprehension", 81)
                        ],
                        "title": "Two class plays"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Analyze plots, dramatic irony, and character motivations", "analysis", 82),
                            ("Evaluate the effectiveness of dramatic techniques", "evaluation", 83)
                        ],
                        "title": "Plots, dramatic irony, character motivations"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Examine themes of corruption, class, and gender", "analysis", 84),
                            ("Relate play themes to contemporary society", "evaluation", 85)
                        ],
                        "title": "Core themes (corruption, class, gender)"
                    }
                ]
            },
            {
                "order": 16,
                "code": "4.0",
                "form_level": 3,
                "title": "Literary Critique: Selected Novels",
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Read and understand the two class novels", "comprehension", 86),
                            ("Trace the development of characters across the narrative", "analysis", 87)
                        ],
                        "title": "Two novels"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Analyze characterization in the novels", "analysis", 88),
                            ("Evaluate character development and motivations", "evaluation", 89)
                        ],
                        "title": "Characterization"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Identify stylistic devices such as flashbacks and symbolism", "analysis", 90),
                            ("Analyze the effects of point of view on narrative", "analysis", 91)
                        ],
                        "title": "Styles (flashbacks, symbolism, point of view)"
                    }
                ]
            },
            {
                "order": 17,
                "code": "5.0",
                "form_level": 3,
                "title": "Complex Reading and Summary Compilations",
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 12,
                        "outcomes": [
                            ("Read argumentative texts and identify the main thesis", "comprehension", 92),
                            ("Critically examine arguments and supporting evidence", "analysis", 93)
                        ],
                        "title": "Argumentative text reading"
                    },
                    {
                        "periods": 12,
                        "outcomes": [
                            ("Write summaries within a specified word count", "application", 94),
                            ("Condense texts while preserving key ideas", "synthesis", 95)
                        ],
                        "title": "Summary writing within word count"
                    }
                ]
            },
            {
                "order": 18,
                "code": "6.0",
                "form_level": 3,
                "title": "Lexical Formations and Syntactic Shifts",
                "periods": 18,
                "weight": "low",
                "subtopics": [
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Identify prefixes and suffixes and their meanings", "knowledge", 96),
                            ("Form new words through affixation", "application", 97)
                        ],
                        "title": "Prefixes and suffixes"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Convert words from one class to another", "application", 98),
                            ("Explain the effects of word-class conversion", "analysis", 99)
                        ],
                        "title": "Word-class conversion"
                    }
                ]
            },
            {
                "order": 19,
                "code": "1.0",
                "form_level": 4,
                "title": "Mastery of Structural Syntax",
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 12,
                        "outcomes": [
                            ("Refine phonological and syntactic accuracy in production", "application", 100),
                            ("Analyze complex sentence structures", "analysis", 101)
                        ],
                        "title": "Phonological and syntactic refinement"
                    },
                    {
                        "periods": 12,
                        "outcomes": [
                            ("Form and respond to tag questions correctly", "application", 102),
                            ("Use inverted structures for emphasis and questions", "application", 103)
                        ],
                        "title": "Tag questions and inverted structures"
                    }
                ]
            },
            {
                "order": 20,
                "code": "2.0",
                "form_level": 4,
                "title": "Literary Critique: Selected Poetry",
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 4,
                        "outcomes": [
                            ("Read the prescribed poetry books", "comprehension", 104),
                            ("Identify the poems' subjects and speakers", "comprehension", 105)
                        ],
                        "title": "Poetry books"
                    },
                    {
                        "periods": 6,
                        "outcomes": [
                            ("Distinguish traditional from free verse", "analysis", 106),
                            ("Examine the effects of each verse form", "analysis", 107)
                        ],
                        "title": "Traditional vs free verse"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Identify poetic devices such as imagery and rhyme", "knowledge", 108),
                            ("Analyze how poetic devices create meaning", "analysis", 109)
                        ],
                        "title": "Poetic devices"
                    },
                    {
                        "periods": 6,
                        "outcomes": [
                            ("Interpret the social messages of poems", "comprehension", 110),
                            ("Evaluate poems' relevance to society", "evaluation", 111)
                        ],
                        "title": "Social messages of poems"
                    }
                ]
            },
            {
                "order": 21,
                "code": "3.0",
                "form_level": 4,
                "title": "Translation and Interpretation Fundamentals",
                "periods": 22,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Define translation and interpretation concepts", "knowledge", 112),
                            ("Distinguish translation from interpretation", "comprehension", 113)
                        ],
                        "title": "Concepts of translation and interpretation"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Translate paragraphs between languages with fidelity", "application", 114),
                            ("Preserve meaning and style in translation", "analysis", 115)
                        ],
                        "title": "Translating paragraphs"
                    },
                    {
                        "periods": 6,
                        "outcomes": [
                            ("Translate idioms and cultural expressions accurately", "application", 116),
                            ("Explain cultural challenges in translation", "analysis", 117)
                        ],
                        "title": "Idioms and cultural expressions"
                    }
                ]
            },
            {
                "order": 22,
                "code": "4.0",
                "form_level": 4,
                "title": "English as an International Language",
                "periods": 18,
                "weight": "low",
                "subtopics": [
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Explain the role of English as a global lingua franca", "comprehension", 118),
                            ("Discuss the implications of English's global status", "evaluation", 119)
                        ],
                        "title": "English as global lingua franca"
                    },
                    {
                        "periods": 8,
                        "outcomes": [
                            ("Analyze the relationship between English and Swahili in Tanzania", "analysis", 120),
                            ("Evaluate language policy and its effects", "evaluation", 121)
                        ],
                        "title": "English and Swahili in Tanzania"
                    }
                ]
            },
            {
                "order": 23,
                "code": "5.0",
                "form_level": 4,
                "title": "Exam Preparation and Synthesized Production",
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Practice a comprehensive range of exam-style questions", "application", 122),
                            ("Manage time effectively in examination conditions", "application", 123)
                        ],
                        "title": "Comprehensive practice"
                    },
                    {
                        "periods": 18,
                        "outcomes": [
                            ("Write structured essays under time constraints", "synthesis", 124),
                            ("Perform error analysis on written work", "analysis", 125),
                            ("Produce summaries and literary evaluations", "synthesis", 126)
                        ],
                        "title": "Essay, error analysis, summaries, literary evaluation"
                    }
                ]
            },
            {
                "order": 24,
                "code": "1.0",
                "form_level": 5,
                "title": "Advanced Phonology and Phonetics (Paper 1)",
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Transcribe English words using the IPA", "application", 127),
                            ("Interpret phonemic transcription accurately", "comprehension", 128)
                        ],
                        "title": "Phonemic transcription and IPA"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Explain articulation of speech sounds", "comprehension", 129),
                            ("Apply word stress patterns correctly", "application", 130)
                        ],
                        "title": "Articulation and word stress"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Describe sentence stress, intonation, and rhythm", "comprehension", 131),
                            ("Analyze the communicative functions of intonation", "analysis", 132)
                        ],
                        "title": "Sentence stress, intonation and rhythm"
                    }
                ]
            },
            {
                "order": 25,
                "code": "2.0",
                "form_level": 5,
                "title": "Advanced Morphology and Syntax (Paper 1)",
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Distinguish free from bound morphemes", "analysis", 133),
                            ("Identify morpheme types in complex words", "analysis", 134)
                        ],
                        "title": "Free vs bound morphemes"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Differentiate derivation from inflection", "analysis", 135),
                            ("Apply morphological processes in word formation", "application", 136)
                        ],
                        "title": "Derivation vs inflection"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Parse sentence constituents grammatically", "analysis", 137),
                            ("Construct tree diagrams for complex sentences", "synthesis", 138)
                        ],
                        "title": "Sentence parsing and tree diagrams"
                    }
                ]
            },
            {
                "order": 26,
                "code": "3.0",
                "form_level": 5,
                "title": "Rhetoric and Stylistics (Paper 1)",
                "periods": 28,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 12,
                        "outcomes": [
                            ("Identify registers and styles across different contexts", "analysis", 139),
                            ("Analyze stylistic choices in various text types", "analysis", 140)
                        ],
                        "title": "Registers and styles across contexts"
                    },
                    {
                        "periods": 16,
                        "outcomes": [
                            ("Write academic essays following scholarly conventions", "synthesis", 141),
                            ("Conduct and present research writing systematically", "synthesis", 142)
                        ],
                        "title": "Academic essays and research writing"
                    }
                ]
            },
            {
                "order": 27,
                "code": "4.0",
                "form_level": 5,
                "title": "Theories of Literature and Criticism (Paper 2)",
                "periods": 32,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 16,
                        "outcomes": [
                            ("Explain major literary theories", "comprehension", 143),
                            ("Apply Marxist and feminist criticism to texts", "analysis", 144),
                            ("Apply post-colonial, psychoanalytic and structuralist criticism", "analysis", 145)
                        ],
                        "title": "Marxist, Feminist, Post-colonial, Psychoanalytic, Structuralism"
                    }
                ]
            },
            {
                "order": 28,
                "code": "5.0",
                "form_level": 5,
                "title": "Advanced Drama Evaluation (Paper 2)",
                "periods": 30,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Analyze complex African and international plays", "analysis", 146),
                            ("Evaluate plays within their cultural contexts", "evaluation", 147)
                        ],
                        "title": "Complex African and international plays"
                    },
                    {
                        "periods": 20,
                        "outcomes": [
                            ("Examine tragedy and comedy as dramatic forms", "analysis", 148),
                            ("Analyze alienation and satire as techniques", "analysis", 149)
                        ],
                        "title": "Tragedy, comedy, alienation, satire"
                    }
                ]
            },
            {
                "order": 29,
                "code": "6.0",
                "form_level": 5,
                "title": "Advanced African and World Prose (Paper 2)",
                "periods": 30,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 16,
                        "outcomes": [
                            ("Read and analyze heavy selected global works", "comprehension", 150),
                            ("Critically evaluate themes in world prose", "evaluation", 151)
                        ],
                        "title": "Heavy selected global works"
                    },
                    {
                        "periods": 14,
                        "outcomes": [
                            ("Analyze stream-of-consciousness narration", "analysis", 152),
                            ("Evaluate modern stylistic techniques in prose", "evaluation", 153)
                        ],
                        "title": "Stream-of-consciousness and modern stylistics"
                    }
                ]
            },
            {
                "order": 30,
                "code": "1.0",
                "form_level": 6,
                "title": "Advanced Semantics and Pragmatics (Paper 1)",
                "periods": 32,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 12,
                        "outcomes": [
                            ("Explain theories of meaning and sense relations", "comprehension", 154),
                            ("Analyze sense relations such as synonymy and antonymy", "analysis", 155)
                        ],
                        "title": "Theories of meaning and sense relations"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Identify speech acts and their functions", "comprehension", 156),
                            ("Analyze illocutionary force in utterances", "analysis", 157)
                        ],
                        "title": "Speech acts"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Apply the cooperative principle to discourse", "application", 158),
                            ("Analyze conversational implicature", "analysis", 159)
                        ],
                        "title": "Cooperative principle"
                    }
                ]
            },
            {
                "order": 31,
                "code": "2.0",
                "form_level": 6,
                "title": "Sociolinguistics and Historical Tracking (Paper 1)",
                "periods": 30,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Describe language variation across social factors", "comprehension", 160),
                            ("Analyze regional and social dialects", "analysis", 161)
                        ],
                        "title": "Language variation"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Explain code-switching and code-mixing", "comprehension", 162),
                            ("Analyze the functions of code choice in discourse", "analysis", 163)
                        ],
                        "title": "Code-switching and code-mixing"
                    },
                    {
                        "periods": 10,
                        "outcomes": [
                            ("Describe world Englishes and their features", "comprehension", 164),
                            ("Trace the historical expansion of English", "comprehension", 165)
                        ],
                        "title": "World Englishes and historical expansion"
                    }
                ]
            },
            {
                "order": 32,
                "code": "3.0",
                "form_level": 6,
                "title": "Advanced Practical Application (Paper 1)",
                "periods": 28,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 28,
                        "outcomes": [
                            ("Translate technical, legal, and political documents accurately", "application", 166),
                            ("Analyze terminology challenges in specialized translation", "analysis", 167),
                            ("Produce culturally appropriate translations of complex documents", "synthesis", 168)
                        ],
                        "title": "Complex translation of technical, legal and political documents"
                    }
                ]
            },
            {
                "order": 33,
                "code": "4.0",
                "form_level": 6,
                "title": "Advanced Poetic Analysis (Paper 2)",
                "periods": 30,
                "weight": "medium",
                "subtopics": [
                    {
                        "periods": 16,
                        "outcomes": [
                            ("Trace poetic movements from Romanticism to Modernism", "analysis", 169),
                            ("Analyze representative poems from each movement", "analysis", 170)
                        ],
                        "title": "Romanticism to Modernism"
                    },
                    {
                        "periods": 14,
                        "outcomes": [
                            ("Analyze post-colonial African poetry", "analysis", 171),
                            ("Evaluate themes and techniques in African poetry", "evaluation", 172)
                        ],
                        "title": "Post-colonial African poetry"
                    }
                ]
            },
            {
                "order": 34,
                "code": "5.0",
                "form_level": 6,
                "title": "Synthesized Creative Production (Paper 2)",
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "periods": 14,
                        "outcomes": [
                            ("Write analytical literary essays of depth and rigor", "synthesis", 173),
                            ("Evaluate critical arguments in essay form", "evaluation", 174)
                        ],
                        "title": "Analytical literary essays"
                    },
                    {
                        "periods": 16,
                        "outcomes": [
                            ("Compose original creative scripts", "synthesis", 175),
                            ("Compose original verse demonstrating poetic craft", "synthesis", 176)
                        ],
                        "title": "Creative scripts and verse"
                    }
                ]
            }
        ]
    },

    # ========================================================================
    # KISWAHILI — NECTA Code 012
    # Source: TIE Kiswahili Syllabus Form I-IV
    # ========================================================================
    {
        "name": "Kiswahili",
        "code": "KISW",
        "slug": "kiswahili",
        "necta_code": "012",
        "is_core": True,
        "description": "Kiswahili kwa elimu ya sekondari, Kidato cha I-VI. Hujumuisha sarufi, fasihi simulizi na andishi, uandishi, utafsiri, na isimu ya Kiswahili.",
        "form_start": 1,
        "form_end": 6,
        "topics": [
            {
                "title": "Dhana ya Lugha na Mawasiliano",
                "code": "1.0",
                "order": 1,
                "form_level": 1,
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Maana ya lugha na sifa zake",
                        "periods": 8,
                        "order": 1,
                        "outcomes": [
                            ("Kufasiri maana ya lugha na kubaini sifa zake msingi", "knowledge", 1),
                            ("Kutambua umuhimu wa lugha katika maisha ya kila siku", "comprehension", 2),
                        ]
                    },
                    {
                        "title": "Dhima na kazi za lugha",
                        "periods": 8,
                        "order": 2,
                        "outcomes": [
                            ("Kujadili dhima ya lugha katika jamii na elimu", "comprehension", 1),
                            ("Kuchambua kazi za lugha katika mawasiliano", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Mawasiliano (vipengele na vikwazo)",
                        "periods": 8,
                        "order": 3,
                        "outcomes": [
                            ("Kubaini vipengele vinavyoshiriki katika mawasiliano", "knowledge", 1),
                            ("Kujadili vikwazo vinavyokwamisha mawasiliano", "analysis", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Ustadi wa Kusikiliza na Kuzungumza",
                "code": "2.0",
                "order": 2,
                "form_level": 1,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Kusikiliza kwa makini",
                        "periods": 5,
                        "order": 1,
                        "outcomes": [
                            ("Kuonyesha uwezo wa kusikiliza kwa makini na kufahamu ujumbe", "application", 1),
                        ]
                    },
                    {
                        "title": "Matamshi bora ya sauti za Kiswahili",
                        "periods": 5,
                        "order": 2,
                        "outcomes": [
                            ("Kutamka sauti za Kiswahili kwa usahihi", "application", 1),
                            ("Kubaini tofauti za sauti za Kiswahili", "knowledge", 2),
                        ]
                    },
                    {
                        "title": "Kutoa maelezo na hotuba fupi",
                        "periods": 5,
                        "order": 3,
                        "outcomes": [
                            ("Kutoa maelezo ya wazi na yenye muundo", "application", 1),
                            ("Kuandaa na kusimulia hotuba fupi kwa ufasaha", "synthesis", 2),
                        ]
                    },
                    {
                        "title": "Mifumo ya salamu na adabu",
                        "periods": 5,
                        "order": 4,
                        "outcomes": [
                            ("Kutumia mifumo ya salamu na adabu katika mawasiliano", "application", 1),
                        ]
                    },
                ]
            },
            {
                "title": "Sarufi ya Kiswahili: Sauti na Maneno",
                "code": "3.0",
                "order": 3,
                "form_level": 1,
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Sauti za Kiswahili (konsonanti na irabu)",
                        "periods": 14,
                        "order": 1,
                        "outcomes": [
                            ("Kubaini na kutamka konsonanti za Kiswahili", "knowledge", 1),
                            ("Kueleza jukumu la irabu katika lugha ya Kiswahili", "comprehension", 2),
                        ]
                    },
                    {
                        "title": "Aina za maneno ngazi ya kwanza (Nomino, Viwakilishi, Vitenzi, Vivumishi)",
                        "periods": 14,
                        "order": 2,
                        "outcomes": [
                            ("Kutambua na kugawanya maneno kulingana na aina zake", "knowledge", 1),
                            ("Kutumia aina za maneno katika kuunda sentensi", "application", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Ustadi wa Kusoma",
                "code": "4.0",
                "order": 4,
                "form_level": 1,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Kusoma kwa sauti na kwa kimya",
                        "periods": 8,
                        "order": 1,
                        "outcomes": [
                            ("Kusoma kwa sauti kwa ufasaha na usahihi", "application", 1),
                            ("Kusoma kwa kimya kwa kuzingatia maana", "comprehension", 2),
                        ]
                    },
                    {
                        "title": "Kusoma kwa ufahamu",
                        "periods": 8,
                        "order": 2,
                        "outcomes": [
                            ("Kuchambua maana ya maandishi kwa kina", "analysis", 1),
                            ("Kujibu maswali kuhusu maandishi yaliyosomwa", "comprehension", 2),
                        ]
                    },
                    {
                        "title": "Kusoma kwa burudani na kupanua msamiati",
                        "periods": 8,
                        "order": 3,
                        "outcomes": [
                            ("Kusoma kwa kufurahia na kujenga mapendeleo ya kusoma", "comprehension", 1),
                            ("Kupanua msamiati wa Kiswahili kupitia usomaji", "application", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Ustadi wa Kuandika",
                "code": "5.0",
                "order": 5,
                "form_level": 1,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Mwandiko nadhifu na alama za uandishi",
                        "periods": 6,
                        "order": 1,
                        "outcomes": [
                            ("Kutumia mwandiko nadhifu na alama za uandishi kwa usahihi", "application", 1),
                            ("Kubaini makosa ya kawaida katika uandishi", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Insha za maelezo, masimulizi na hoja",
                        "periods": 8,
                        "order": 2,
                        "outcomes": [
                            ("Kuandika insha za maelezo kwa mfumo sahihi", "application", 1),
                            ("Kuandika insha za masimulizi kwa kuwasilisha hadithi", "synthesis", 2),
                            ("Kuandika insha za hoja kwa kutoa dalili na uthibitisho", "synthesis", 3),
                        ]
                    },
                    {
                        "title": "Barua za kirafiki na kadi za mialiko",
                        "periods": 6,
                        "order": 3,
                        "outcomes": [
                            ("Kuandika barua za kirafiki kwa mtindo unaofaa", "application", 1),
                            ("Kuandika kadi za mialiko kwa muundo wa kawaida", "application", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Utangulizi wa Fasihi na Fasihi Simulizi",
                "code": "6.0",
                "order": 6,
                "form_level": 1,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Maana ya fasihi na mgawanyo wake",
                        "periods": 6,
                        "order": 1,
                        "outcomes": [
                            ("Kufasiri maana ya fasihi na kubaini mgawanyo wake", "knowledge", 1),
                            ("Kutambua tofauti kati ya fasihi simulizi na fasihi andishi", "comprehension", 2),
                        ]
                    },
                    {
                        "title": "Fasihi Simulizi (maana, sifa, umuhimu)",
                        "periods": 8,
                        "order": 2,
                        "outcomes": [
                            ("Kueleza maana na sifa za fasihi simulizi", "comprehension", 1),
                            ("Kujadili umuhimu wa fasihi simulizi katika jamii", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Mighani na tanzu za hadithi (ngano, hekaya, hurafa, kisa)",
                        "periods": 10,
                        "order": 3,
                        "outcomes": [
                            ("Kubaini mighani mbalimbali ya fasihi simulizi", "knowledge", 1),
                            ("Kutambua tanzu za hadithi: ngano, hekaya, hurafa, na kisa", "comprehension", 2),
                            ("Kulinganisha sifa za tanzu tofauti za hadithi", "analysis", 3),
                        ]
                    },
                ]
            },
            {
                "title": "Sarufi: Muundo wa Sentensi na Aina za Maneno (II)",
                "code": "1.0",
                "order": 7,
                "form_level": 2,
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Viunganishi, Viingizi na Viwakilishi",
                        "periods": 10,
                        "order": 1,
                        "outcomes": [
                            ("Kubaini aina za viunganishi na matumizi yao", "knowledge", 1),
                            ("Kutumia viingizi na viwakilishi katika sentensi", "application", 2),
                        ]
                    },
                    {
                        "title": "Mofimu (huru na tegemezi)",
                        "periods": 10,
                        "order": 2,
                        "outcomes": [
                            ("Kufasiri dhana ya mofimu huru na tegemezi", "comprehension", 1),
                            ("Kubaini mofimu huru na tegemezi katika sentensi", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Mnyambuliko wa vitenzi (kauli)",
                        "periods": 8,
                        "order": 3,
                        "outcomes": [
                            ("Kueleza mfumo wa mnyambuliko wa vitenzi", "comprehension", 1),
                            ("Kutumia kauli tofauti katika kuunda sentensi", "application", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Uandishi wa Kiofisi na Kitaaluma",
                "code": "2.0",
                "order": 8,
                "form_level": 2,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Barua za Kiofisi",
                        "periods": 7,
                        "order": 1,
                        "outcomes": [
                            ("Kueleza miundo na mapokezi ya barua za kiofisi", "comprehension", 1),
                            ("Kuandika barua za kiofisi kwa mtindo unaokubalika", "application", 2),
                        ]
                    },
                    {
                        "title": "Wasifu Kazi (CV) na barua za maombi",
                        "periods": 7,
                        "order": 2,
                        "outcomes": [
                            ("Kuandika wasifu kazi (CV) kwa muundo wa kisasa", "application", 1),
                            ("Kuandika barua za maombi ya kazi na elimu", "application", 2),
                        ]
                    },
                    {
                        "title": "Kumbukumbu za mikutano",
                        "periods": 6,
                        "order": 3,
                        "outcomes": [
                            ("Kueleza muundo wa kumbukumbu za mikutano", "comprehension", 1),
                            ("Kuandika kumbukumbu za mikutano kwa usahihi", "application", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Fasihi Simulizi: Semi na Maigizo",
                "code": "3.0",
                "order": 9,
                "form_level": 2,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Semi (methali, vitendawili, misemo, nahau, mizungu)",
                        "periods": 12,
                        "order": 1,
                        "outcomes": [
                            ("Kubaini aina za semi: methali, vitendawili, misemo, nahau, na mizungu", "knowledge", 1),
                            ("Kutumia semi katika mawasiliano ya kila siku", "application", 2),
                            ("Kufasiri maana ya semi mbalimbali", "comprehension", 3),
                        ]
                    },
                    {
                        "title": "Maigizo Simulizi (michezo ya jukwaani, matambiko, ngoma)",
                        "periods": 12,
                        "order": 2,
                        "outcomes": [
                            ("Kutambua aina za maigizo simulizi", "knowledge", 1),
                            ("Kueleza sifa na umuhimu wa maigizo simulizi", "comprehension", 2),
                            ("Kushiriki katika michezo ya jukwaani na matambiko", "application", 3),
                        ]
                    },
                ]
            },
            {
                "title": "Utangulizi wa Fasihi Andishi",
                "code": "4.0",
                "order": 10,
                "form_level": 2,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Maana na sifa za Fasihi Andishi",
                        "periods": 8,
                        "order": 1,
                        "outcomes": [
                            ("Kueleza maana na sifa za fasihi andishi", "comprehension", 1),
                            ("Kulinganisha fasihi andishi na fasihi simulizi", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Tanzu (Riwaya, Tamthilia, Ushairi)",
                        "periods": 8,
                        "order": 2,
                        "outcomes": [
                            ("Kubaini tanzu tatu za fasihi andishi: riwaya, tamthilia, na ushairi", "knowledge", 1),
                            ("Kutambua sifa za kila tanzu la fasihi andishi", "comprehension", 2),
                        ]
                    },
                    {
                        "title": "Vipengele vya uhakiki (Fomu/Dhamira na Fani)",
                        "periods": 8,
                        "order": 3,
                        "outcomes": [
                            ("Kufasiri dhana za fomu na dhamira katika fasihi", "comprehension", 1),
                            ("Kubaini vipengele vya fani katika uundaji wa fasihi", "analysis", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Sarufi: Ngeli za Nomino na Upatanisho wa Kisarufi",
                "code": "1.0",
                "order": 11,
                "form_level": 3,
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Mfumo wa ngeli za nomino (M-WA, KI-VI, LI-YA, U-I, U-ZI)",
                        "periods": 16,
                        "order": 1,
                        "outcomes": [
                            ("Kubaini ngeli tano za nomino katika Kiswahili", "knowledge", 1),
                            ("Kutumia ngeli za nomino katika kuunda sentensi", "application", 2),
                            ("Kujadili changamoto za upatanisho wa ngeli", "analysis", 3),
                        ]
                    },
                    {
                        "title": "Upatanisho wa kisarufi",
                        "periods": 12,
                        "order": 2,
                        "outcomes": [
                            ("Kueleza kanuni za upatanisho wa kisarufi", "comprehension", 1),
                            ("Kutumia kanuni za upatanisho katika uandishi", "application", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Uandishi wa Ubunifu na Dijitali",
                "code": "2.0",
                "order": 12,
                "form_level": 3,
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Makala ya magazetini na majarida",
                        "periods": 8,
                        "order": 1,
                        "outcomes": [
                            ("Kubaini sifa za makala ya magazetini na majarida", "knowledge", 1),
                            ("Kuandika makala kwa mtindo wa magazeti", "application", 2),
                        ]
                    },
                    {
                        "title": "Uandishi wa kidijitali (E-mail, mitandao ya kijamii, blogu)",
                        "periods": 8,
                        "order": 2,
                        "outcomes": [
                            ("Kuandika barua pepe (e-mail) kwa mtindo wa kiofisi", "application", 1),
                            ("Kutumia mitandao ya kijamii na blogu kwa uandishi bora", "application", 2),
                        ]
                    },
                    {
                        "title": "Hotuba rasmi",
                        "periods": 8,
                        "order": 3,
                        "outcomes": [
                            ("Kueleza vipengele vya hotuba rasmi", "comprehension", 1),
                            ("Kuandika na kusoma hotuba rasmi kwa ufasaha", "synthesis", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Uhakiki wa Vitabu Teule: Riwaya na Tamthilia",
                "code": "3.0",
                "order": 13,
                "form_level": 3,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Uhakiki wa riwaya mbili",
                        "periods": 10,
                        "order": 1,
                        "outcomes": [
                            ("Kuchambua mada na viungo vya riwaya mbili zilizoteuliwa", "analysis", 1),
                            ("Kujadili mitindo ya uandishi ya waandishi", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Uhakiki wa tamthilia mbili",
                        "periods": 10,
                        "order": 2,
                        "outcomes": [
                            ("Kuchambua migogoro na mada za tamthilia mbili", "analysis", 1),
                            ("Kujadili majukumu ya wahusika na misingi ya tamthilia", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Uchambuzi wa dhamira na vipengele vya fani",
                        "periods": 10,
                        "order": 3,
                        "outcomes": [
                            ("Kufasiri dhamira za vitabu vilivyoteuliwa", "comprehension", 1),
                            ("Kuchambua vipengele vya fani katika vitabu vya fasihi", "analysis", 2),
                            ("Kutumia nadharia za uhakiki katika uchambuzi wa fasihi", "evaluation", 3),
                        ]
                    },
                ]
            },
            {
                "title": "Fasihi Simulizi: Ushairi Simulizi na Maghani",
                "code": "4.0",
                "order": 14,
                "form_level": 3,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Maghani na tanzu zake (tongozo, bembeleza, tanzu za sifa)",
                        "periods": 14,
                        "order": 1,
                        "outcomes": [
                            ("Kubaini aina za maghani na tanzu zake", "knowledge", 1),
                            ("Kutambua sifa za tongozo, bembeleza, na tanzu za sifa", "comprehension", 2),
                        ]
                    },
                    {
                        "title": "Nyimbo (za kazi, harusi, kilio)",
                        "periods": 10,
                        "order": 2,
                        "outcomes": [
                            ("Kubaini aina za nyimbo: za kazi, harusi, na kilio", "knowledge", 1),
                            ("Kueleza umuhimu wa nyimbo katika jamii ya Kiswahili", "comprehension", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Uundaji wa Maneno na Ukuzaji wa Kamusi",
                "code": "1.0",
                "order": 15,
                "form_level": 4,
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Njia za uundaji wa maneno (kunyambua, kuunganisha, kukopesha, kufupisha)",
                        "periods": 14,
                        "order": 1,
                        "outcomes": [
                            ("Kubaini njia za uundaji wa maneno katika Kiswahili", "knowledge", 1),
                            ("Kutumia njia za kunyambua, kuunganisha, kukopesha, na kufupisha", "application", 2),
                        ]
                    },
                    {
                        "title": "Ukuzaji na matumizi ya kamusi",
                        "periods": 10,
                        "order": 2,
                        "outcomes": [
                            ("Kutumia kamusi kwa usahihi katika utafiti", "application", 1),
                            ("Kujadili changamoto za ukuzaji wa kamusi za Kiswahili", "analysis", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Utafsiri na Ukalimani",
                "code": "2.0",
                "order": 16,
                "form_level": 4,
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Dhana ya utafsiri na ukalimani",
                        "periods": 8,
                        "order": 1,
                        "outcomes": [
                            ("Kufasiri tofauti kati ya utafsiri na ukalimani", "comprehension", 1),
                            ("Kutambua umuhimu wa utafsiri katika jamii", "comprehension", 2),
                        ]
                    },
                    {
                        "title": "Misingi na kanuni za utafsiri",
                        "periods": 8,
                        "order": 2,
                        "outcomes": [
                            ("Kubaini kanuni za utafsiri bora", "knowledge", 1),
                            ("Kutumia kanuni za utafsiri katika tafsiri ya maandishi", "application", 2),
                        ]
                    },
                    {
                        "title": "Changamoto za utafsiri",
                        "periods": 8,
                        "order": 3,
                        "outcomes": [
                            ("Kujadili changamoto za utafsiri wa lugha na utamaduni", "analysis", 1),
                            ("Kupendekeza suluhisho la changamoto za utafsiri", "synthesis", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Uhakiki wa Ushairi Andishi",
                "code": "3.0",
                "order": 17,
                "form_level": 4,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Diwani mbili teule",
                        "periods": 12,
                        "order": 1,
                        "outcomes": [
                            ("Kuchambua mada na dhamira za diwani mbili zilizoteuliwa", "analysis", 1),
                            ("Kujadili mtindo na lugha ya washairi", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Mashairi ya mapokeo na ya masivina",
                        "periods": 10,
                        "order": 2,
                        "outcomes": [
                            ("Kulinganisha mashairi ya mapokeo na ya masivina", "analysis", 1),
                            ("Kujadili mada na mtindo wa mashairi mbalimbali", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Lugha ya ushairi (tamathali, mbinu, ishara)",
                        "periods": 8,
                        "order": 3,
                        "outcomes": [
                            ("Kubaini tamathali za lugha katika mashairi", "knowledge", 1),
                            ("Kuchambua mbinu za ushairi: tamathali, mbinu, na ishara", "analysis", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Lugha ya Kiswahili katika Maendeleo ya Taifa",
                "code": "4.0",
                "order": 18,
                "form_level": 4,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Historia ya kuenea kwa Kiswahili",
                        "periods": 10,
                        "order": 1,
                        "outcomes": [
                            ("Kueleza historia ya kuenea kwa Kiswahili katika Afrika Mashariki", "comprehension", 1),
                            ("Kujadili majukumu ya Kiswahili katika historia", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Kiswahili kama lugha ya taifa, elimu, ukombozi na diplomasia",
                        "periods": 10,
                        "order": 2,
                        "outcomes": [
                            ("Kujadili jukumu la Kiswahili katika taifa, elimu, ukombozi na diplomasia", "analysis", 1),
                            ("Kupendekeza mikakati ya kuendeleza Kiswahili", "synthesis", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Fonetiki na Fonolojia ya Kiswahili",
                "code": "1.0",
                "order": 19,
                "form_level": 5,
                "periods": 32,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Foni na fonimu",
                        "periods": 8,
                        "order": 1,
                        "outcomes": [
                            ("Kufasiri dhana za foni na fonimu katika Kiswahili", "comprehension", 1),
                            ("Kubaini tofauti kati ya foni na fonimu", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Ala za sauti",
                        "periods": 8,
                        "order": 2,
                        "outcomes": [
                            ("Kubaini ala za sauti katika Kiswahili", "knowledge", 1),
                            ("Kueleza jukumu la ala za sauti katika matamshi", "comprehension", 2),
                        ]
                    },
                    {
                        "title": "Mahali na namna ya kutamkia",
                        "periods": 8,
                        "order": 3,
                        "outcomes": [
                            ("Kubaini mahali pa kutamkia sauti", "knowledge", 1),
                            ("Kueleza namna ya kutamkia sauti mbalimbali", "application", 2),
                        ]
                    },
                    {
                        "title": "Mabadiliko ya kifonolojia",
                        "periods": 8,
                        "order": 4,
                        "outcomes": [
                            ("Kujadili mabadiliko ya kifonolojia katika Kiswahili", "analysis", 1),
                            ("Kuchambua athari za mabadiliko ya kifonolojia katika lugha", "synthesis", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Mofolojia ya Kiswahili (Muundo wa Maneno)",
                "code": "2.0",
                "order": 20,
                "form_level": 5,
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Viambishi (awali na tamati)",
                        "periods": 10,
                        "order": 1,
                        "outcomes": [
                            ("Kubaini viambishi vya awali na tamati katika Kiswahili", "knowledge", 1),
                            ("Kueleza jukumu la viambishi katika uundaji wa maneno", "comprehension", 2),
                        ]
                    },
                    {
                        "title": "Mzizi na shina",
                        "periods": 9,
                        "order": 2,
                        "outcomes": [
                            ("Kufasiri dhana ya mzizi na shina katika Kiswahili", "comprehension", 1),
                            ("Kubaini mzizi na shina katika maneno mbalimbali", "application", 2),
                        ]
                    },
                    {
                        "title": "Unyambulishaji na unyumbufu",
                        "periods": 9,
                        "order": 3,
                        "outcomes": [
                            ("Kujadili kanuni za unyambulishaji katika Kiswahili", "analysis", 1),
                            ("Kutumia kanuni za unyumbufu katika uundaji wa maneno", "application", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Utumizi wa Lugha na Mtindo",
                "code": "3.0",
                "order": 21,
                "form_level": 5,
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Sajili (sheria, biashara, kidini, kitaaluma, michezo)",
                        "periods": 24,
                        "order": 1,
                        "outcomes": [
                            ("Kubaini tofauti za sajili za Kiswahili: sheria, biashara, kidini, kitaaluma, na michezo", "knowledge", 1),
                            ("Kutumia sajili mbalimbali kulingana na muktadha", "application", 2),
                            ("Kujadili umuhimu wa sajili katika mawasiliano ya kitaalamu", "analysis", 3),
                        ]
                    },
                ]
            },
            {
                "title": "Uandishi wa Insha za Kiakademia",
                "code": "4.0",
                "order": 22,
                "form_level": 5,
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Wasifu, insha za kiuhakiki, makala za utafiti",
                        "periods": 24,
                        "order": 1,
                        "outcomes": [
                            ("Kuandika wasifu wa kielimu kwa mfumo wa kiakademia", "application", 1),
                            ("Kuandika insha za kiuhakiki kwa msimamo thabiti", "synthesis", 2),
                            ("Kuandika makala za utafiti kwa kanuni za kiakademia", "synthesis", 3),
                        ]
                    },
                ]
            },
            {
                "title": "Nadharia ya Fasihi",
                "code": "5.0",
                "order": 23,
                "form_level": 5,
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Maana ya sanaa, chimbuko la fasihi, uhusiano wa fasihi na jamii",
                        "periods": 14,
                        "order": 1,
                        "outcomes": [
                            ("Kufasiri dhana za sanaa na chimbuko la fasihi", "comprehension", 1),
                            ("Kujadili uhusiano kati ya fasihi na jamii", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Nadharia za uhakiki (Umarx, Ufeministi, Uhalisia, Ushabiki)",
                        "periods": 14,
                        "order": 2,
                        "outcomes": [
                            ("Kubaini nadharia nne za uhakiki la fasihi", "knowledge", 1),
                            ("Kulinganisha nadharia za Umarx, Ufeministi, Uhalisia, na Ushabiki", "analysis", 2),
                            ("Kutumia nadharia za uhakiki katika uchambuzi wa fasihi", "evaluation", 3),
                        ]
                    },
                ]
            },
            {
                "title": "Fasihi Simulizi kwa Kina",
                "code": "6.0",
                "order": 24,
                "form_level": 5,
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Mbinu za utafiti wa nyanjani",
                        "periods": 10,
                        "order": 1,
                        "outcomes": [
                            ("Kubaini mbinu za utafiti wa nyanjani katika fasihi simulizi", "knowledge", 1),
                            ("Kutumia mbinu za utafiti wa nyanjani katika ukusanyaji wa data", "application", 2),
                        ]
                    },
                    {
                        "title": "Ukusanyaji na uhifadhi wa data",
                        "periods": 9,
                        "order": 2,
                        "outcomes": [
                            ("Kueleza kanuni za ukusanyaji na uhifadhi wa data", "comprehension", 1),
                            ("Kutumia kanuni za uhifadhi wa data katika utafiti wa fasihi", "application", 2),
                        ]
                    },
                    {
                        "title": "Uhakiki wa tanzu za fasihi simulizi",
                        "periods": 9,
                        "order": 3,
                        "outcomes": [
                            ("Kuchambua tanzu za fasihi simulizi kwa kina", "analysis", 1),
                            ("Kutumia mbinu za uhakiki katika uchambuzi wa fasihi simulizi", "evaluation", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Uhakiki wa Riwaya (Ngazi ya Juu)",
                "code": "7.0",
                "order": 25,
                "form_level": 5,
                "periods": 32,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Uhakiki wa riwaya mbili za A-Level kwa nadharia za fasihi",
                        "periods": 32,
                        "order": 1,
                        "outcomes": [
                            ("Kuchambua riwaya mbili kwa kutumia nadharia za uhakiki", "analysis", 1),
                            ("Kujadili mada, mhusika, na mtindo wa riwaya", "synthesis", 2),
                            ("Kutoa ukiri wa fasihi kwa kutumia nadharia za fasihi", "evaluation", 3),
                        ]
                    },
                ]
            },
            {
                "title": "Sintaksia ya Kiswahili (Muundo wa Sentensi)",
                "code": "1.0",
                "order": 26,
                "form_level": 6,
                "periods": 32,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Kirai, kishazi na sentensi",
                        "periods": 10,
                        "order": 1,
                        "outcomes": [
                            ("Kubaini dhana za kirai, kishazi, na sentensi", "knowledge", 1),
                            ("Kuchambua muundo wa kirai na kishazi katika Kiswahili", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Aina za sentensi (sahili, ambatano, changamano)",
                        "periods": 12,
                        "order": 2,
                        "outcomes": [
                            ("Kubaini aina tatu za sentensi: sahili, ambatano, changamano", "knowledge", 1),
                            ("Kujadili tofauti kati ya sentensi sahili, ambatano, na changamano", "analysis", 2),
                            ("Kuunda sentensi za aina mbalimbali kwa usahihi", "application", 3),
                        ]
                    },
                    {
                        "title": "Uchambuzi wa sentensi kwa mishale/bano",
                        "periods": 10,
                        "order": 3,
                        "outcomes": [
                            ("Kutumia mishale na bano katika uchambuzi wa sentensi", "application", 1),
                            ("Kuchambua muundo wa sentensi kwa njia ya mishale na bano", "analysis", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Semantiki na Pragmashia",
                "code": "2.0",
                "order": 27,
                "form_level": 6,
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Maana ya maneno (kileksika na muktadha)",
                        "periods": 10,
                        "order": 1,
                        "outcomes": [
                            ("Kufasiri dhana za kileksika na muktadha katika semantiki", "comprehension", 1),
                            ("Kujadili jukumu la muktadha katika kubaini maana ya maneno", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Uhusiano wa kimaana (visawe, vinyume, homonimu, polisemia)",
                        "periods": 10,
                        "order": 2,
                        "outcomes": [
                            ("Kubaini uhusiano wa kimaana: visawe, vinyume, homonimu, polisemia", "knowledge", 1),
                            ("Kujadili maana za maneno kulingana na muktadha", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Pragmashia na vitendo vya usemi",
                        "periods": 8,
                        "order": 3,
                        "outcomes": [
                            ("Kufasiri dhana za pragmashia na vitendo vya usemi", "comprehension", 1),
                            ("Kuchambua matumizi ya lugha katika muktadha wa jamii", "analysis", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Maendeleo na Ukuaji wa Kiswahili",
                "code": "3.0",
                "order": 28,
                "form_level": 6,
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "usanifishaji wa Kiswahili 1930",
                        "periods": 8,
                        "order": 1,
                        "outcomes": [
                            ("Kueleza historia ya usanifishaji wa Kiswahili mwaka 1930", "comprehension", 1),
                            ("Kujadili athari za usanifishaji wa Kiswahili", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Kamati ya lugha ya Afrika Mashariki",
                        "periods": 8,
                        "order": 2,
                        "outcomes": [
                            ("Kubaini jukumu la Kamati ya Lugha ya Afrika Mashariki", "knowledge", 1),
                            ("Kujadili mafanikio ya Kamati katika ukuaji wa Kiswahili", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Changamoto za utandawazi",
                        "periods": 8,
                        "order": 3,
                        "outcomes": [
                            ("Kujadili changamoto za utandawazi kwa Kiswahili", "analysis", 1),
                            ("Kupendekeza mikakati ya kukabiliana na changamoto za utandawazi", "synthesis", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Uhakiki wa Tamthilia za Kina",
                "code": "4.0",
                "order": 29,
                "form_level": 6,
                "periods": 32,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Tamthilia mbili za juu",
                        "periods": 12,
                        "order": 1,
                        "outcomes": [
                            ("Kuchambua mada na migogoro katika tamthilia mbili", "analysis", 1),
                            ("Kujadili mtindo wa uandishi wa warembo wa tamthilia", "analysis", 2),
                        ]
                    },
                    {
                        "title": "Migogoro na falsafa ya mwandishi",
                        "periods": 10,
                        "order": 2,
                        "outcomes": [
                            ("Kubaini migogoro kuu katika tamthilia zilizoteuliwa", "knowledge", 1),
                            ("Kujadili falsafa na maono ya mwandishi", "synthesis", 2),
                        ]
                    },
                    {
                        "title": "Mbinu za kimtindo (rejeshi, kinaya, tanzia, vichekesho)",
                        "periods": 10,
                        "order": 3,
                        "outcomes": [
                            ("Kubaini mbinu za kimtindo: rejeshi, kinaya, tanzia, na vichekesho", "knowledge", 1),
                            ("Kuchambua matumizi ya mbinu za kimtindo katika tamthilia", "analysis", 2),
                            ("Kutumia mbinu za kimtindo katika uchambuzi wa tamthilia", "evaluation", 3),
                        ]
                    },
                ]
            },
            {
                "title": "Uhakiki wa Diwani (Ushairi wa Kina)",
                "code": "5.0",
                "order": 30,
                "form_level": 6,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Diwani mbili (mizani na vina dhidi ya huria)",
                        "periods": 16,
                        "order": 1,
                        "outcomes": [
                            ("Kuchambua mizani na vina katika diwani mbili zilizoteuliwa", "analysis", 1),
                            ("Kulinganisha mtindo wa ushairi wa mizani na huria", "analysis", 2),
                            ("Kujadili lugha na tamathali za ushairi katika diwani", "synthesis", 3),
                        ]
                    },
                    {
                        "title": "Mgogoro wa wana-mapokeo na wana-kisasa",
                        "periods": 14,
                        "order": 2,
                        "outcomes": [
                            ("Kujadili mgogoro kati ya wana-mapokeo na wana-kisasa katika ushairi", "analysis", 1),
                            ("Kutoa maoni ya ukatili kuhusu mapinduzi ya ushairi wa Kiswahili", "evaluation", 2),
                        ]
                    },
                ]
            },
            {
                "title": "Uandishi wa Kifasihi",
                "code": "6.0",
                "order": 31,
                "form_level": 6,
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Kazi za ubunifu (mashairi, michezo, hadithi fupi)",
                        "periods": 24,
                        "order": 1,
                        "outcomes": [
                            ("Kuandika mashairi kwa kutumia mbinu za ushairi", "synthesis", 1),
                            ("Kuandika michezo midogo ya jukwaani", "synthesis", 2),
                            ("Kuandika hadithi fupi kwa mtindo wa kifasihi", "synthesis", 3),
                        ]
                    },
                ]
            },
        ]
    },
    # ========================================================================
    # HISTORY — NECTA Code 013
    # Source: TIE History Syllabus Form I-VI
    # ========================================================================
    {
        "name": "History",
        "code": "HIST",
        "slug": "history",
        "necta_code": "013",
        "is_core": True,
        "description": "History for Ordinary and Advanced Secondary Education, Form I-VI. Covers Tanzania and Africa from prehistory to independence, the world since 1500, and advanced approaches to the study of history.",
        "form_start": 1,
        "form_end": 6,
        "topics": [
            {
                "title": "SOURCES AND IMPORTANCE OF HISTORY",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and importance of studying history",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Explain the meaning and reasons for studying history", "comprehension", 1),
                            ("Explain the importance of studying history", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Sources of history",
                        "code": "1.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Identify written, unwritten and electronic sources of history", "knowledge", 1),
                            ("Describe the methods of collecting historical information", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Preservation of historical sources",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Explain the ways of preserving historical sources and information", "comprehension", 1),
                        ],
                    },
                ],
            },
            {
                "title": "EVOLUTION OF MAN, TECHNOLOGY AND ENVIRONMENT",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Evolution of man",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Explain the theories of the origin of man", "comprehension", 1),
                            ("Trace the stages of human evolution", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Development of early technology",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe early tools and technology of man", "comprehension", 1),
                            ("Analyze the impact of early technology on human development", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Early man and the environment",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Explain the relationship between early man, technology and the environment", "comprehension", 1),
                            ("Describe the economic activities of early man", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "DEVELOPMENT OF ECONOMIC ACTIVITIES AND THEIR IMPACT",
                "code": "3.0",
                "form_level": 1,
                "order": 3,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Agriculture in pre-colonial Africa",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the development of agriculture in Africa", "comprehension", 1),
                            ("Explain the impact of agriculture on African societies", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Mining and industries",
                        "code": "3.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the development of mining and industries in Africa", "comprehension", 1),
                            ("Analyze the impact of craft industries on society", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Trade in pre-colonial Africa",
                        "code": "3.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe local, regional and long-distance trade in Africa", "comprehension", 1),
                            ("Analyze the impact of the long-distance trade on East African societies", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "SOCIAL AND CULTURAL DEVELOPMENT IN TANZANIA AND AFRICA",
                "code": "4.0",
                "form_level": 1,
                "order": 4,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Social organization of African societies",
                        "code": "4.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the social organization of pre-colonial African societies", "comprehension", 1),
                            ("Explain the structure of kinship, clan and age-set systems", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Cultural practices and material culture",
                        "code": "4.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the cultural practices of African societies", "comprehension", 1),
                            ("Explain the importance of preserving African cultural heritage", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "INTERACTIONS AMONG THE PEOPLE OF AFRICA",
                "code": "5.0",
                "form_level": 1,
                "order": 5,
                "periods": 14,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "Forms of interaction",
                        "code": "5.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the forms of interaction: trade, migration, war and intermarriage", "comprehension", 1),
                            ("Analyze the impact of these interactions on the development of societies", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Formation of states",
                        "code": "5.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the formation of early states in Tanzania and Africa", "comprehension", 1),
                        ],
                    },
                ],
            },
            {
                "title": "INTERACTION AMONG THE PEOPLE OF AFRICA (CONTINUED)",
                "code": "1.0",
                "form_level": 2,
                "order": 6,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Factors for the rise of states",
                        "code": "1.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Explain the political, social and economic factors for the rise and fall of states", "comprehension", 1),
                            ("Analyze the impact of European invasion on African societies", "analysis", 2),
                        ],
                    },
                    {
                        "title": "The Ngoni invasion and its impact",
                        "code": "1.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Explain the causes and course of the Ngoni migration", "comprehension", 1),
                            ("Analyze the impact of the Ngoni invasion on East and Central Africa", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "AFRICA AND EXTERNAL WORLD",
                "code": "2.0",
                "form_level": 2,
                "order": 7,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Contact between Africa and the external world",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe early trade and contacts across the Indian Ocean", "comprehension", 1),
                            ("Explain the impact of external contacts on African societies", "analysis", 2),
                        ],
                    },
                    {
                        "title": "The slave trade",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Explain the causes and characteristics of the Trans-Atlantic and East African slave trade", "comprehension", 1),
                            ("Analyze the impact of the slave trade on African societies", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Abolition of the slave trade",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Explain the factors that led to the abolition of the slave trade", "comprehension", 1),
                            ("Describe the effects of abolition on East African coastal societies", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "AFRICA AND EUROPE FROM 1500-1800",
                "code": "3.0",
                "form_level": 2,
                "order": 8,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "European exploration and conquest",
                        "code": "3.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the motives and methods of European explorers and conquest in Africa", "comprehension", 1),
                            ("Explain the impact of European exploration on Africa", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Development of colonial rule",
                        "code": "3.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Describe the establishment of colonial rule in Africa", "comprehension", 1),
                            ("Analyze the methods and impact of indirect and direct rule", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "AFRICA AND THE WORLD WARS",
                "code": "4.0",
                "form_level": 2,
                "order": 9,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Africa and the First World War",
                        "code": "4.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Explain the causes of the First World War and Africa's involvement", "comprehension", 1),
                            ("Analyze the impact of the First World War on Africa", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Africa and the Second World War",
                        "code": "4.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Explain the causes of the Second World War and Africa's participation", "comprehension", 1),
                            ("Analyze the impact of the Second World War on African nationalism", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "SOCIAL, POLITICAL AND ECONOMIC DEVELOPMENT IN TANZANIA",
                "code": "5.0",
                "form_level": 2,
                "order": 10,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "German colonial administration",
                        "code": "5.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the German colonial administration in Tanganyika", "comprehension", 1),
                            ("Explain German economic and social policies", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "British colonial administration",
                        "code": "5.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe British administration in Tanganyika after the First World War", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "African resistance to colonial rule",
                        "code": "5.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe early and organized resistance such as the Maji Maji war", "comprehension", 1),
                            ("Analyze the impact of the Maji Maji uprising", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "ESTABLISHMENT OF COLONIALISM IN AFRICA",
                "code": "1.0",
                "form_level": 3,
                "order": 11,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Scramble for and partition of Africa",
                        "code": "1.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Explain the causes of the scramble for and partition of Africa", "comprehension", 1),
                            ("Analyze the Berlin Conference of 1884-1885 and its impact", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Occupation of colonial territories",
                        "code": "1.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Describe the methods used to occupy and establish colonial rule", "comprehension", 1),
                            ("Explain colonial administration systems: assimilation, indirect rule and settler systems", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "ESTABLISHMENT OF COLONIALISM IN AFRICA (CONTINUED)",
                "code": "2.0",
                "form_level": 3,
                "order": 12,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "colonial economy",
                        "code": "2.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Describe the colonial economic policies: production of cash crops, mining and labour", "comprehension", 1),
                            ("Analyze the impact of the colonial economy on African societies", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Social and cultural changes",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe social and cultural changes under colonialism", "comprehension", 1),
                            ("Explain the growth of mission schools and urbanization", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "COLONIAL SOCIAL SERVICES",
                "code": "3.0",
                "form_level": 3,
                "order": 13,
                "periods": 14,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "Education, health and communication",
                        "code": "3.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe colonial education and its impact on Africans", "comprehension", 1),
                            ("Describe the development of health and transport services under colonialism", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Colonial legacy",
                        "code": "3.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze the legacy of colonial social services in independent Africa", "analysis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "THE NATIONAL STRUGGLE FOR INDEPENDENCE IN AFRICA",
                "code": "4.0",
                "form_level": 3,
                "order": 14,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Rise of African nationalism",
                        "code": "4.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Explain the factors for the rise of nationalism in Africa", "comprehension", 1),
                            ("Describe the role of political parties and trade unions in the struggle", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Nationalism in Tanzania",
                        "code": "4.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Trace the development of TANU and the struggle for Tanganyika's independence", "comprehension", 1),
                            ("Explain the role of the independence movement in Zanzibar", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "POLITICAL, ECONOMIC AND SOCIAL DEVELOPMENT IN AFRICA AFTER INDEPENDENCE",
                "code": "5.0",
                "form_level": 3,
                "order": 15,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Political changes after independence",
                        "code": "5.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe nation building and constitutional changes in Africa", "comprehension", 1),
                            ("Explain the rise of one-party and multi-party systems in Africa", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Economic and social policies in Tanzania",
                        "code": "5.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Describe the Arusha Declaration and socialism in Tanzania", "comprehension", 1),
                            ("Analyze the achievements and challenges of Ujamaa and villagization", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "CRISIS IN THE COLONIAL SYSTEM",
                "code": "1.0",
                "form_level": 4,
                "order": 16,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Industrialization in colonial Africa",
                        "code": "1.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Explain the factors for the slow industrialization under colonialism", "comprehension", 1),
                            ("Analyze the crisis in the colonial economy", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Decline of colonial rule",
                        "code": "1.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Explain the factors that contributed to the crisis and decline of the colonial system", "comprehension", 1),
                        ],
                    },
                ],
            },
            {
                "title": "THE CRISIS OF THE CAPITALIST SYSTEM",
                "code": "2.0",
                "form_level": 4,
                "order": 17,
                "periods": 16,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "The great depression and world economic crisis",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Explain the causes of the great depression of the 1930s", "comprehension", 1),
                            ("Analyze the impact of the depression on African colonies", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Neo-colonialism",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Explain the meaning and manifestations of neo-colonialism", "comprehension", 1),
                            ("Analyze the effects of neo-colonialism on developing countries", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "TANZANIA IN INTERNATIONAL AFFAIRS",
                "code": "3.0",
                "form_level": 4,
                "order": 18,
                "periods": 16,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "Tanzania and international organizations",
                        "code": "3.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe Tanzania's membership and role in the UN, AU and SADC", "comprehension", 1),
                            ("Explain Tanzania's foreign policy and role in regional cooperation", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "The East African Community",
                        "code": "3.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Trace the history of the East African Community and its revival", "comprehension", 1),
                            ("Analyze the achievements and challenges of the EAC", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "WORLD PROBLEMS SINCE THE SECOND WORLD WAR",
                "code": "4.0",
                "form_level": 4,
                "order": 19,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "The cold war and its impact",
                        "code": "4.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Explain the causes and course of the Cold War", "comprehension", 1),
                            ("Analyze the impact of the Cold War on Africa and the Third World", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Contemporary world problems",
                        "code": "4.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Describe problems of refugees, terrorism, poverty and global warming", "comprehension", 1),
                            ("Analyze the role of the UN and other bodies in solving world problems", "analysis", 2),
                        ],
                    },
                ],
            },
            # ── A-LEVEL PAPER 1: HISTORY OF AFRICA ──────────────────────────
            {
                "title": "PAPER 1: PRE-COLONIAL AFRICAN SOCIETIES AND ECONOMIES",
                "code": "1.0",
                "form_level": 5,
                "order": 20,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Origin and development of African societies",
                        "code": "1.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the formation and development of early African kingdoms", "analysis", 1),
                            ("Review debates on the origins of African states", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Pre-colonial economies of Africa",
                        "code": "1.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze agriculture, trade and craft production in pre-colonial Africa", "analysis", 1),
                            ("Evaluate the impact of the long-distance trade on East Africa", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Social and political organization of African societies",
                        "code": "1.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Describe the political systems and social organization of African societies", "analysis", 1),
                            ("Analyze kinship, clan, age-set and state structures", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 1: COLONIALISM IN AFRICA",
                "code": "2.0",
                "form_level": 5,
                "order": 21,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Scramble, partition and occupation",
                        "code": "2.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the causes and processes of the partition of Africa", "analysis", 1),
                            ("Evaluate the Berlin Conference of 1884-1885", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Colonial administration and economy",
                        "code": "2.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Compare indirect rule, assimilation and direct rule systems", "analysis", 1),
                            ("Analyze colonial economic exploitation and its legacy", "analysis", 2),
                        ],
                    },
                    {
                        "title": "African resistance to colonial rule",
                        "code": "2.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze early and organized resistance movements", "analysis", 1),
                            ("Evaluate the impact of resistance such as the Maji Maji and Abushiri uprisings", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 1: NATIONALISM AND INDEPENDENCE",
                "code": "3.0",
                "form_level": 5,
                "order": 22,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Rise of nationalism",
                        "code": "3.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the factors for the rise of nationalism in Africa", "analysis", 1),
                            ("Describe the role of trade unions, churches and political parties", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Paths to independence",
                        "code": "3.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Compare peaceful and armed struggles for independence", "analysis", 1),
                            ("Analyze independence movements in East, Central and Southern Africa", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Independence and nation building",
                        "code": "3.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze challenges of nation building after independence", "analysis", 1),
                            ("Evaluate experiences of chosen African countries in consolidation", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 1: SELECTED THEMES (TANZANIA, KENYA, ZIMBABWE, NIGERIA)",
                "code": "4.0",
                "form_level": 5,
                "order": 23,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Tanzania case study",
                        "code": "4.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the Arusha Declaration, Ujamaa and political development in Tanzania", "analysis", 1),
                            ("Evaluate socialist policies and economic reform", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Kenya case study",
                        "code": "4.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Analyze the history of Kenya from resistance to independence and its development", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Zimbabwe and Nigeria case studies",
                        "code": "4.3",
                        "order": 3,
                        "periods": 16,
                        "outcomes": [
                            ("Analyze the struggle for independence in Zimbabwe", "analysis", 1),
                            ("Analyze the history of Nigeria from colonialism to independence and beyond", "analysis", 2),
                        ],
                    },
                ],
            },
            # ── A-LEVEL PAPER 2: WORLD HISTORY ───────────────────────────────
            {
                "title": "PAPER 2: TRANSFORMATION OF THE WORLD FROM 1800",
                "code": "1.0",
                "form_level": 6,
                "order": 24,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Crisis and transformation in the capitalist system",
                        "code": "1.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the industrial revolution and its consequences on the world", "analysis", 1),
                            ("Analyze the great depression and world economic crises", "analysis", 2),
                        ],
                    },
                    {
                        "title": "The rise of imperialism",
                        "code": "1.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the causes and forms of modern imperialism", "analysis", 1),
                            ("Evaluate the impact of imperialism on colonized societies", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "The First and Second World Wars",
                        "code": "1.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the causes, course and consequences of the world wars", "analysis", 1),
                            ("Evaluate peace settlements and the League of Nations and UN", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 2: THE AGE OF REVOLUTIONS",
                "code": "2.0",
                "form_level": 6,
                "order": 25,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The French Revolution",
                        "code": "2.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Analyze the causes, course and impact of the French Revolution", "analysis", 1),
                        ],
                    },
                    {
                        "title": "The Industrial Revolution",
                        "code": "2.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the causes and effects of the Industrial Revolution in Britain and beyond", "analysis", 1),
                        ],
                    },
                    {
                        "title": "The Russian Revolution",
                        "code": "2.3",
                        "order": 3,
                        "periods": 14,
                        "outcomes": [
                            ("Analyze the causes, course and impact of the Russian Revolution", "analysis", 1),
                            ("Evaluate the rise of the Soviet state and the cold war", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 2: THE WORLD SINCE 1945",
                "code": "3.0",
                "form_level": 6,
                "order": 26,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Cold War and decolonization",
                        "code": "3.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the origins and dynamics of the Cold War", "analysis", 1),
                            ("Analyze decolonization and the emergence of the Third World", "analysis", 2),
                        ],
                    },
                    {
                        "title": "The Non-Aligned Movement",
                        "code": "3.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Explain the origins and role of the Non-Aligned Movement", "comprehension", 1),
                            ("Evaluate Tanzania's role in the Non-Aligned Movement", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Contemporary international relations",
                        "code": "3.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze globalization, regional integration and world problems", "analysis", 1),
                            ("Evaluate the role of the UN and international organizations in the modern world", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 2: HISTORIOGRAPHY AND THE PHILOSOPHY OF HISTORY",
                "code": "4.0",
                "form_level": 6,
                "order": 27,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and methods of history",
                        "code": "4.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Explain the meaning, scope and methods of history", "comprehension", 1),
                            ("Analyze the causes of history and interpretation in historiography", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Schools of historical thought",
                        "code": "4.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Describe idealist, empiricist, positivist and Marxist schools of thought", "comprehension", 1),
                            ("Analyze the contribution of African historians to the study of history", "analysis", 2),
                        ],
                    },
                    {
                        "title": "The philosophy of history",
                        "code": "4.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the value and relevance of studying history today", "evaluation", 1),
                            ("Evaluate historical thinking and the use of sources and evidence", "evaluation", 2),
                        ],
                    },
                ],
            },
        ],
    },

    # ========================================================================
    # GEOGRAPHY — NECTA Code 014
    # Source: TIE Geography Syllabus Form I-VI
    # ========================================================================
    {
        "name": "Geography",
        "code": "GEOG",
        "slug": "geography",
        "necta_code": "014",
        "is_core": True,
        "description": "Geography for Ordinary and Advanced Secondary Education, Form I-VI. Covers the earth and the solar system, map reading, physical and human geography, and advanced approaches to geography.",
        "form_start": 1,
        "form_end": 6,
        "topics": [
            {
                "title": "CONCEPT OF GEOGRAPHY",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and importance of geography",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Explain the meaning and branches of geography", "comprehension", 1),
                            ("Explain the importance of studying geography", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Sub-branches of geography",
                        "code": "1.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the main sub-branches of geography and their fields", "comprehension", 1),
                            ("Relate geography to science, economics and social studies", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "THE EARTH AND THE SOLAR SYSTEM",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "The solar system",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the composition of the solar system", "knowledge", 1),
                            ("Describe the rotation and revolution of the earth and moon", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "The earth and its movements",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Explain the effects of the earth's rotation and revolution", "comprehension", 1),
                            ("Analyze the causes of day and night, seasons and eclipses", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Structure of the earth",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the internal structure of the earth", "knowledge", 1),
                        ],
                    },
                ],
            },
            {
                "title": "MAJOR FEATURES OF THE EARTH'S SURFACE",
                "code": "3.0",
                "form_level": 1,
                "order": 3,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Continents and oceans",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Identify the major continents, oceans and their features", "knowledge", 1),
                        ],
                    },
                    {
                        "title": "Major landforms",
                        "code": "3.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Describe the major landforms and their formation", "comprehension", 1),
                            ("Locate major physical features of Africa and Tanzania", "knowledge", 2),
                        ],
                    },
                ],
            },
            {
                "title": "WEATHER AND CLIMATE",
                "code": "4.0",
                "form_level": 1,
                "order": 4,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Elements of weather and climate",
                        "code": "4.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the elements of weather and climate", "knowledge", 1),
                            ("Use and interpret instruments for measuring weather elements", "application", 2),
                        ],
                    },
                    {
                        "title": "Factors influencing weather and climate",
                        "code": "4.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze the factors that influence weather and climate", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Climatic regions of the world",
                        "code": "4.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the major climatic regions and their characteristics", "comprehension", 1),
                            ("Analyze the impact of climate change on people and the environment", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "MAP READING AND INTERPRETATION",
                "code": "5.0",
                "form_level": 1,
                "order": 5,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Elements of a map",
                        "code": "5.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Identify title, scale, key/direction and grid references on maps", "knowledge", 1),
                        ],
                    },
                    {
                        "title": "Scale and representation",
                        "code": "5.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Use different types of scales to measure distances on maps", "application", 1),
                            ("Represent relief using contours, hachures, layer tinting and spot heights", "application", 2),
                        ],
                    },
                    {
                        "title": "Interpretation of maps",
                        "code": "5.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Interpret physical, cultural and economic information from maps", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "FORCES THAT AFFECT THE EARTH",
                "code": "6.0",
                "form_level": 1,
                "order": 6,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Internal forces and landforms",
                        "code": "6.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the landforms produced by internal forces such as folding and faulting", "comprehension", 1),
                            ("Describe volcanic and seismic activity and their effects", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "External forces and landforms",
                        "code": "6.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe landforms produced by weathering and erosion", "comprehension", 1),
                            ("Explain the process of soil formation", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "APPLICATION OF STATISTICS IN GEOGRAPHY",
                "code": "7.0",
                "form_level": 1,
                "order": 7,
                "periods": 16,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "Collecting and presenting geostatistical data",
                        "code": "7.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Collect and organize geographical data", "application", 1),
                            ("Present data using graphs and diagrams", "application", 2),
                        ],
                    },
                    {
                        "title": "Interpreting statistics in geography",
                        "code": "7.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Interpret simple statistical measures and distributions", "analysis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "MAP WORK AND FIELD WORK",
                "code": "1.0",
                "form_level": 2,
                "order": 8,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Map preparation and interpretation",
                        "code": "1.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Prepare simple maps and interpret topographical maps", "application", 1),
                            ("Calculate distances, areas and gradients from maps", "application", 2),
                        ],
                    },
                    {
                        "title": "Field work",
                        "code": "1.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Explain the stages and methods of conducting fieldwork", "comprehension", 1),
                            ("Plan and carry out a simple field study and write a report", "synthesis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "FORCES THAT AFFECT THE EARTH (CONTINUED)",
                "code": "2.0",
                "form_level": 2,
                "order": 9,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Folding and faulting",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the formation and features of fold mountains and rift valleys", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Earthquakes and vulcanicity",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe earthquakes, their causes and measurement", "comprehension", 1),
                            ("Describe volcanic landforms and their effects", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Agents of denudation",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the processes of weathering, erosion, transport and deposition", "comprehension", 1),
                        ],
                    },
                ],
            },
            {
                "title": "CLIMATE AND NATURAL REGIONS",
                "code": "3.0",
                "form_level": 2,
                "order": 10,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Climate controls and types",
                        "code": "3.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Analyze the controls of climate", "analysis", 1),
                            ("Describe the major types of climate and their distribution", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Natural regions of the world",
                        "code": "3.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Describe natural regions: tropical rain forests, savanna, deserts and temperate regions", "comprehension", 1),
                            ("Analyze the relationship between climate, vegetation and human activity", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "HUMAN POPULATION",
                "code": "4.0",
                "form_level": 2,
                "order": 11,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Population distribution and structure",
                        "code": "4.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze the factors influencing population distribution and structure", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Population growth and movement",
                        "code": "4.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Analyze population growth, birth and death rates in Tanzania and the world", "analysis", 1),
                            ("Describe types and causes of population movements", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Population policies",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Evaluate population policies and their impact on development", "evaluation", 1),
                        ],
                    },
                ],
            },
            {
                "title": "SETTLEMENT",
                "code": "5.0",
                "form_level": 2,
                "order": 12,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Rural and urban settlements",
                        "code": "5.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe rural and urban settlements and their functions", "comprehension", 1),
                            ("Analyze the factors influencing the location and growth of settlements", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Urbanization",
                        "code": "5.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Analyze the causes and consequences of urbanization in Tanzania", "analysis", 1),
                            ("Describe land use patterns and planning in urban areas", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "AGRICULTURE",
                "code": "6.0",
                "form_level": 2,
                "order": 13,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Types and systems of agriculture",
                        "code": "6.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the types and systems of agriculture in Tanzania", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Food and cash crops",
                        "code": "6.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the production and distribution of food and cash crops", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Challenges in agriculture",
                        "code": "6.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze the problems of agriculture and the role of the government in agricultural development", "analysis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "WATER MANAGEMENT FOR ECONOMIC DEVELOPMENT",
                "code": "1.0",
                "form_level": 3,
                "order": 14,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Sources and importance of water",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the sources of water and their importance", "comprehension", 1),
                            ("Analyze the water cycle", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Water for economic use",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the uses of water in agriculture, industry and energy production", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Water management",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Evaluate conservation and management of water resources in Tanzania", "evaluation", 1),
                            ("Explain international cooperation over transboundary water resources", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "WORLD MINERAL PRODUCTION",
                "code": "2.0",
                "form_level": 3,
                "order": 15,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Types and distribution of minerals",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the types and distribution of minerals in the world", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Mining and its effects",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the methods of mining and processing", "comprehension", 1),
                            ("Analyze the economic and environmental effects of mining", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Minerals in Tanzania",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the mineral resources of Tanzania and their contribution to the economy", "comprehension", 1),
                        ],
                    },
                ],
            },
            {
                "title": "MANUFACTURING INDUSTRY",
                "code": "3.0",
                "form_level": 3,
                "order": 16,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Types and location of industries",
                        "code": "3.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the types of manufacturing industries and factors for locating them", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Industrial development in Tanzania",
                        "code": "3.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze the development and challenges of industry in Tanzania", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Tanzania and the world industrial links",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe Tanzania's industrial ties and technological transfer", "comprehension", 1),
                        ],
                    },
                ],
            },
            {
                "title": "WORLD POPULATION AND DEVELOPMENT",
                "code": "4.0",
                "form_level": 3,
                "order": 17,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Population growth trends",
                        "code": "4.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze world population growth trends and demographic transition", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Population and development",
                        "code": "4.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Analyze the relationship between population and development", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Population policies and programmes",
                        "code": "4.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Evaluate population policies and their impact on development", "evaluation", 1),
                        ],
                    },
                ],
            },
            {
                "title": "REGIONAL FOCAL STUDIES",
                "code": "5.0",
                "form_level": 3,
                "order": 18,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Study of selected countries",
                        "code": "5.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Conduct geographical studies of selected African and world countries", "analysis", 1),
                            ("Compare economic activities of selected regions", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Regional cooperation in Africa",
                        "code": "5.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe regional organizations and their economic roles", "comprehension", 1),
                            ("Analyze trade and cooperation within the EAC and SADC", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "RESEARCH IN GEOGRAPHY",
                "code": "6.0",
                "form_level": 3,
                "order": 19,
                "periods": 18,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "Conducting research",
                        "code": "6.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Formulate a research topic and objectives in geography", "synthesis", 1),
                            ("Apply research methods and techniques in collecting data", "application", 2),
                        ],
                    },
                    {
                        "title": "Reporting research findings",
                        "code": "6.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Organize, present and write a research report", "synthesis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "MAP READING, PHOTOGRAPH READING AND FIELD WORK",
                "code": "1.0",
                "form_level": 4,
                "order": 20,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Interpretation of topographical maps",
                        "code": "1.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Interpret relief, drainage, settlement and communication from topographical maps", "application", 1),
                        ],
                    },
                    {
                        "title": "Photograph reading and interpretation",
                        "code": "1.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Distinguish ground, vertical and oblique photographs", "knowledge", 1),
                            ("Interpret human and physical features from photographs", "application", 2),
                        ],
                    },
                    {
                        "title": "Field work",
                        "code": "1.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Plan, conduct and report a geographical field study", "synthesis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "CLIMATE AND FORESTRY",
                "code": "2.0",
                "form_level": 4,
                "order": 21,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Climatic change and regions",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Analyze the causes and impacts of climatic change", "analysis", 1),
                            ("Describe the classification and distribution of climatic regions", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Forestry and forest resources",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the types, distribution and importance of forests", "comprehension", 1),
                            ("Analyze forestry management and conservation in Tanzania", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Forestry and the economy",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Evaluate the contribution of forestry to the Tanzanian economy", "evaluation", 1),
                        ],
                    },
                ],
            },
            {
                "title": "POPULATION, HEALTH AND FOOD",
                "code": "3.0",
                "form_level": 4,
                "order": 22,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Population and health",
                        "code": "3.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Analyze the relationship between population growth and health", "analysis", 1),
                            ("Describe measures to control major diseases", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Food production and security",
                        "code": "3.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze food production, distribution and consumption patterns in the world", "analysis", 1),
                            ("Evaluate strategies for ensuring food security in Tanzania", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "THE ENVIRONMENT AND HUMAN ACTIVITIES",
                "code": "4.0",
                "form_level": 4,
                "order": 23,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Review of environmental problems",
                        "code": "4.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Describe major environmental problems such as land degradation and pollution", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Environmental conservation",
                        "code": "4.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Explain the principles of environmental management", "comprehension", 1),
                            ("Evaluate conservation strategies and sustainable development", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "MAP READING AND FIELD STUDIES (REVIEW)",
                "code": "5.0",
                "form_level": 4,
                "order": 24,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Application of map reading",
                        "code": "5.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Apply map interpretation skills to real-life situations", "application", 1),
                        ],
                    },
                    {
                        "title": "Advanced field studies",
                        "code": "5.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Design and conduct comprehensive geographical field studies", "synthesis", 1),
                            ("Present and defend field study findings", "synthesis", 2),
                        ],
                    },
                ],
            },
            # ── A-LEVEL PAPER 1: PHYSICAL GEOGRAPHY ─────────────────────────
            {
                "title": "PAPER 1: THE EARTH AND ITS DYNAMIC FORCES",
                "code": "1.0",
                "form_level": 5,
                "order": 25,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The earth's structure and interior",
                        "code": "1.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the structure, composition and origin of the earth", "analysis", 1),
                            ("Explain the earth's heat engines and plate tectonics", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Major surface features of the earth",
                        "code": "1.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze landforms of folding, faulting, vulcanicity and denudation", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Earth evolution and dynamic forces",
                        "code": "1.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the forces shaping the earth's surface and their effects on human activity", "analysis", 1),
                            ("Evaluate the effects of earthquakes, volcanic eruptions and mass wasting", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 1: CLIMATOLOGY AND BIOGEOGRAPHY",
                "code": "2.0",
                "form_level": 5,
                "order": 26,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The atmosphere and climate",
                        "code": "2.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the composition and structure of the atmosphere", "analysis", 1),
                            ("Analyze weather systems, pressure systems and air masses", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Climatic change and global warming",
                        "code": "2.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Evaluate the causes and evidence of climatic change", "evaluation", 1),
                            ("Analyze the impact of global warming on climate and human activity", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Soils, vegetation and ecosystems",
                        "code": "2.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze soil formation, types and profiles", "analysis", 1),
                            ("Describe world vegetation regions and classify them", "comprehension", 2),
                            ("Analyze natural ecosystems and their components", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 1: GEOMORPHOLOGY",
                "code": "3.0",
                "form_level": 5,
                "order": 27,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Weathering and erosion",
                        "code": "3.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze weathering and denudation processes and their landforms", "analysis", 1),
                        ],
                    },
                    {
                        "title": "River, glacier and desert landforms",
                        "code": "3.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the work of rivers and fluvial landforms", "analysis", 1),
                            ("Analyze glacial and desert processes and landforms", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Coastal and karst landforms",
                        "code": "3.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the work of the sea and coastal landforms", "analysis", 1),
                            ("Analyze groundwater and karst landforms", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 1: THE PHYSICAL GEOGRAPHY OF TANZANIA",
                "code": "4.0",
                "form_level": 5,
                "order": 28,
                "periods": 24,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Relief and mineral resources",
                        "code": "4.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Analyze the distribution of relief features in Tanzania", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Drainage and water resources",
                        "code": "4.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Describe the river systems, lakes and water bodies of Tanzania", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Climate and vegetation of Tanzania",
                        "code": "4.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Analyze the climate and natural vegetation zones of Tanzania", "analysis", 1),
                        ],
                    },
                ],
            },
            # ── A-LEVEL PAPER 2: HUMAN AND ECONOMIC GEOGRAPHY ────────────────
            {
                "title": "PAPER 2: POPULATION GEOGRAPHY",
                "code": "1.0",
                "form_level": 6,
                "order": 29,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Population growth, structure and distribution",
                        "code": "1.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze world population growth, structure and distribution", "analysis", 1),
                            ("Evaluate population theories and policies", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Population movements",
                        "code": "1.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze causes, types and consequences of migration", "analysis", 1),
                            ("Analyze the impact of population movements on source and destination areas", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Population and development",
                        "code": "1.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the relationship between population resources and development", "analysis", 1),
                            ("Evaluate population programmes and their impact", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 2: SETTLEMENT GEOGRAPHY",
                "code": "2.0",
                "form_level": 6,
                "order": 30,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Rural settlements",
                        "code": "2.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Analyze the types, patterns and functions of rural settlements", "analysis", 1),
                        ],
                    },
                    {
                        "title": "Urban settlements and urbanization",
                        "code": "2.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the growth, structure and functions of urban settlements", "analysis", 1),
                            ("Evaluate the causes and consequences of urbanization in developing countries", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Settlement planning",
                        "code": "2.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Analyze land use models and urban planning", "analysis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 2: AGRICULTURE AND ECONOMIC GEOGRAPHY",
                "code": "3.0",
                "form_level": 6,
                "order": 31,
                "periods": 36,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Agriculture and land use",
                        "code": "3.1",
                        "order": 1,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the types, systems and economics of agriculture", "analysis", 1),
                            ("Analyze world agricultural regions and land use patterns", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Trade, transport and industry",
                        "code": "3.2",
                        "order": 2,
                        "periods": 12,
                        "outcomes": [
                            ("Analyze the role of trade and transport in economic development", "analysis", 1),
                            ("Analyze world industries and industrial location theory", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Natural resources and economic development",
                        "code": "3.3",
                        "order": 3,
                        "periods": 12,
                        "outcomes": [
                            ("Evaluate the role of water, mineral and energy resources in economic development", "evaluation", 1),
                            ("Analyze the exploitation and management of natural resources", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "PAPER 2: MAP WORK AND RESEARCH SKILLS",
                "code": "4.0",
                "form_level": 6,
                "order": 32,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Advanced map and photograph interpretation",
                        "code": "4.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Apply advanced map reading and geospatial techniques", "application", 1),
                            ("Interpret aerial photographs and remote sensing imagery", "application", 2),
                        ],
                    },
                    {
                        "title": "Research skills in geography",
                        "code": "4.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Formulate and carry out geographical research projects", "synthesis", 1),
                            ("Analyze and present research data", "synthesis", 2),
                        ],
                    },
                    {
                        "title": "Contemporary issues in geography",
                        "code": "4.3",
                        "order": 3,
                        "periods": 10,
                        "outcomes": [
                            ("Evaluate contemporary geographical issues such as climate change and natural disasters", "evaluation", 1),
                            ("Analyze environmental management and sustainable development", "analysis", 2),
                        ],
                    },
                ],
            },
        ],
    },
    {
        "name": "Historia ya Tanzania na Maadili",
        "code": "HTM",
        "slug": "historia-ya-tanzania-na-maadili",
        "necta_code": "014",
        "is_core": True,
        "description": "Somo la Historia ya Tanzania na Maadili linafundisha historia ya jamii za Kiafrika, ukoloni, ukombozi, na ujenzi wa taifa pamoja na maadili, thamani za kiraifa, na kanuni za maisha bora kwa wanafunzi wa Form I hadi Form VI.",
        "form_start": 1,
        "form_end": 6,
        "topics": [
            {
                "title": "MAISHA YA WATU WAKE KALE AFRIKA",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Uchumi na Jamii za Watu wa kale Afrika",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Elezea asili ya jamii za watu wa kale Afrika", "knowledge", 1),
                            ("Tambua tabia za maisha ya watu wa kale kama vile uwindaji, ukusanyaji wa mazao, na ufugaji", "comprehension", 2),
                            ("Chambua vigezo vilivyoathiri maisha ya watu wa kale Afrika", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Ubadilifu wa Maisha ya Watu wa Kale",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Elezea mabadiliko ya maisha ya watu wa kale kutoka uwindaji hadi kilimo", "comprehension", 1),
                            ("Jadili athari za ubunifu wa zana za kazi kwa jamii za kale", "analysis", 2),
                            ("Hesabu changamoto na fursa zilizojitokeza wakati wa mabadiliko ya maisha", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Mwisho wa Jamii za Watu wa Kale",
                        "code": "1.3",
                        "order": 3,
                        "periods": 8,
                        "outcomes": [
                            ("Elezea sababu za kutoweka kwa tabia za maisha ya watu wa kale", "knowledge", 1),
                            ("Chambua mabadiliko ya kijamii na kiuchumi yaliyosababisha mwisho wa jamii za kale", "analysis", 2),
                            ("Jadili umuhimu wa kuhifadhi urithi wa jamii za kale kwa vizazi vijavyo", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "UHUSIANO WA KIJAMII NA MAADILI",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Kushikamana kwa Watu",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Elezea umuhimu wa ushirikiano na mshikamano katika jamii", "knowledge", 1),
                            ("Elezea njia ambazo jamii zilishikamana ili kusalia hai", "comprehension", 2),
                            ("Tathmini umuhimu wa ushirikiano wa pamoja katika kusolve matatizo ya jamii", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Uongozi na Uongozi wa Jamii",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Tambua aina za viongozi katika jamii za kale", "knowledge", 1),
                            ("Chambua jukumu la viongozi katika kusimamia shughuli za jamii", "analysis", 2),
                            ("Tathmini uwezo wa viongozi wa jamii kukabiliana na changamoto za kila siku", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Miladha, Desturi na Taratibu za Jamii",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Tambua miladha na desturi za jamii za kale", "knowledge", 1),
                            ("Elezea jukumu la miladha katika kuimarisha umoja wa jamii", "comprehension", 2),
                            ("Chambua athari za miladha katika maisha ya kila siku ya jamii", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MAADILI NA THAMANI ZA KIJAMII",
                "code": "3.0",
                "form_level": 1,
                "order": 3,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Maadili ya Uhusiano wa Kijamii",
                        "code": "3.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea maadili ya msingi katika uhusiano wa kijamii", "knowledge", 1),
                            ("Elezea jinsi maadili yanavyosaidia kudumisha amani na utulivu", "comprehension", 2),
                            ("Tathmini umuhimu wa maadili katika kujenga jamii imara", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Uadilifu na Uwazi",
                        "code": "3.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea umuhimu wa uadilifu na uwazi katika maisha ya kila siku", "knowledge", 1),
                            ("Elezea mifano ya uadilifu na uwazi katika jamii", "comprehension", 2),
                            ("Jadili athari za kutojali maadili katika jamii", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Heshima na Ukarimu",
                        "code": "3.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Tambua thamani za heshima na ukarimu katika jamii", "knowledge", 1),
                            ("Elezea jinsi heshima na ukarimu vinavyoimarisha uhusiano wa kijamii", "comprehension", 2),
                            ("Tathmini athari za kutoheshimu na kukosea ukarimu katika jamii", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "USHIRIKIANO NA MAADILI YA KAZI",
                "code": "4.0",
                "form_level": 1,
                "order": 4,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Ushirikiano wa Jamii",
                        "code": "4.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea umuhimu wa ushirikiano katika shughuli za jamii", "knowledge", 1),
                            ("Elezea njia ambazo jamii zilishirikiana katika shughuli za kiuchumi", "comprehension", 2),
                            ("Chambua athari za ushirikiano katika maendeleo ya jamii", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Maadili ya Kazi na Uchapaji",
                        "code": "4.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Tambua maadili ya kazi kama uvumilivu, uaminifu, na kujituma", "knowledge", 1),
                            ("Elezea jinsi maadili ya kazi yanavyochangia uchumi wa jamii", "comprehension", 2),
                            ("Jadili umuhimu wa kujituma na uchapaji katika kufanikisha malengo", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Ujuzi na Stadi za Kazi",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Tambua aina mbalimbali za stadi za kazi zilizokuwepo", "knowledge", 1),
                            ("Elezea jinsi stadi za kazi zilivyokuwa muhimu kwa jamii", "comprehension", 2),
                            ("Tathmini umuhimu wa stadi za kazi katika maisha ya kila siku", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MAISHA NA MIKASA YA WATU WAKE KALE",
                "code": "5.0",
                "form_level": 1,
                "order": 5,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Uwindaji na Ukusanyaji wa Mazao",
                        "code": "5.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Elezea mbinu za uwindaji na ukusanyaji wa mazao kwa watu wa kale", "knowledge", 1),
                            ("Elezea jinsi uwindaji na ukusanyaji wa mazao ulivyowafanya watu wahamahama", "comprehension", 2),
                            ("Chambua changamoto zilizokuwepo katika uwindaji na ukusanyaji wa mazao", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Ufugaji na Ulinzi wa Wanyama",
                        "code": "5.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Elezea jinsi wanyama walivyofugwa na kulindwa na watu wa kale", "knowledge", 1),
                            ("Tambua aina za wanyama waliofugwa na jamii za kale", "comprehension", 2),
                            ("Jadili athari za ufugaji kwa maendeleo ya jamii", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Ushirikiano na Kushikamana",
                        "code": "5.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Elezea umuhimu wa kushikamana katika jamii za kale", "knowledge", 1),
                            ("Elezea njia ambazo watu walivyoshikamana ili kufanikisha malengo", "comprehension", 2),
                            ("Tathmini umuhimu wa kushikamana katika kukabiliana na changamoto", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MAADILI YA JAMII NA KIJAMII",
                "code": "6.0",
                "form_level": 1,
                "order": 6,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Umoja na Ushirikiano",
                        "code": "6.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea umuhimu wa umoja na ushirikiano katika jamii", "knowledge", 1),
                            ("Elezea jinsi umoja unavyosaidia kupata utulivu", "comprehension", 2),
                            ("Chambua changamoto zinazozuia umoja na ushirikiano", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Maadili ya Nafsi na Jamii",
                        "code": "6.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea thamani za maadili kwa mtu binafsi na jamii", "knowledge", 1),
                            ("Elezea jinsi maadili ya nafsi yanavyoathiri jamii", "comprehension", 2),
                            ("Tathmini umuhimu wa kuzingatia maadili katika maisha ya kila siku", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Upendo na Mshikamano",
                        "code": "6.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Tambua umuhimu wa upendo na mshikamano katika jamii", "knowledge", 1),
                            ("Elezea jinsi upendo unavyoimarisha uhusiano", "comprehension", 2),
                            ("Jadili athari za kukosa upendo na mshikamano katika jamii", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "JAMII ZA PAGAZI NA WAFUGAJI",
                "code": "1.0",
                "form_level": 2,
                "order": 7,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Utabiri wa Maisha ya Kila Siku",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea miundo ya jamii za pagazi na wafugaji", "knowledge", 1),
                            ("Elezea jinsi jamii hizi zilivyozalisha bidhaa mbalimbali", "comprehension", 2),
                            ("Chambua miundo ya uongozi katika jamii za pagazi na wafugaji", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Uchumi wa Jamii za Pagazi",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mazingira ya maisha ya jamii za pagazi", "knowledge", 1),
                            ("Elezea jinsi jamii za pagazi zilivyozalisha bidhaa za kuuza", "comprehension", 2),
                            ("Chambua changamoto zilizokuwepo katika uchumi wa jamii za pagazi", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Maadili ya Jamii za Pagazi na Wafugaji",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea maadili ya jamii za pagazi na wafugaji", "knowledge", 1),
                            ("Elezea jinsi maadili yaliyosaidia jamii kusalia hai", "comprehension", 2),
                            ("Jadili umuhimu wa maadili katika jamii za kisasa", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Miundo ya Uongozi",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea miundo ya uongozi katika jamii za pagazi na wafugaji", "knowledge", 1),
                            ("Elezea jukumu la viongozi katika jamii hizi", "comprehension", 2),
                            ("Tathmini ufanisi wa viongozi katika kukabiliana na changamoto", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "JAMII ZA KILIMO NA UFUGAJI",
                "code": "2.0",
                "form_level": 2,
                "order": 8,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Mpangilio wa Jamii za Kilimo",
                        "code": "2.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea miundo ya jamii za kilimo na ufugaji", "knowledge", 1),
                            ("Elezea jinsi jamii za kilimo zilivyopanga maisha yao", "comprehension", 2),
                            ("Chambua miundo ya uongozi katika jamii za kilimo", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Shughuli za Kilimo na Ufugaji",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea aina za mazao yaliyolimwa na jamii za kilimo", "knowledge", 1),
                            ("Elezea mbinu za kilimo na ufugaji zilizotumika", "comprehension", 2),
                            ("Chambua changamoto zilizokuwepo katika kilimo na ufugaji", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Ushirikiano wa Jamii za Kilimo",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea umuhimu wa ushirikiano katika jamii za kilimo", "knowledge", 1),
                            ("Elezea njia ambazo jamii zilivyoshirikiana katika kilimo", "comprehension", 2),
                            ("Tathmini umuhimu wa ushirikiano katika kufanikisha malengo ya kilimo", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Maadili ya Jamii za Kilimo",
                        "code": "2.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea maadili ya jamii za kilimo", "knowledge", 1),
                            ("Elezea jinsi maadili yaliyosaidia jamii kudumisha amani", "comprehension", 2),
                            ("Jadili umuhimu wa maadili katika jamii za kilimo za leo", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "TABADILISHANA BIDHAA",
                "code": "3.0",
                "form_level": 2,
                "order": 9,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Biashara ya Bidhaa Kwa Kubadilishana",
                        "code": "3.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea mfumo wa biashara ya bidhaa kwa kubadilishana", "knowledge", 1),
                            ("Elezea jinsi bidhaa zilivyobadilishana kati ya jamii tofauti", "comprehension", 2),
                            ("Chambua changamoto zilizokuwepo katika biashara ya bidhaa kwa kubadilishana", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Aina za Bidhaa Zilizokuwa Zinabadilishana",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Tambua aina mbalimbali za bidhaa zilizokuwa zinabadilishana", "knowledge", 1),
                            ("Elezea sababu za kubadilishana kwa bidhaa tofauti", "comprehension", 2),
                            ("Chambua thamani ya bidhaa katika mfumo wa kubadilishana", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Njia za Biashara na Uendeshaji Wake",
                        "code": "3.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea njia za biashara na uendeshaji wake", "knowledge", 1),
                            ("Elezea jinsi biashara ilivyowezesha mawasiliano kati ya jamii", "comprehension", 2),
                            ("Jadili umuhimu wa biashara katika maendeleo ya jamii", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "USHIRIKIANO NA MAADILI YA KAZI",
                "code": "4.0",
                "form_level": 2,
                "order": 10,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Ushirikiano wa Jamii",
                        "code": "4.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea umuhimu wa ushirikiano katika jamii", "knowledge", 1),
                            ("Elezea njia ambazo jamii zilivyoshirikiana", "comprehension", 2),
                            ("Tathmini athari za ushirikiano katika maendeleo ya jamii", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Maadili ya Kazi",
                        "code": "4.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea maadili ya kazi kwa jamii", "knowledge", 1),
                            ("Elezea jinsi maadili ya kazi yaliyochangia uchumi", "comprehension", 2),
                            ("Jadili umuhimu wa maadili ya kazi katika maisha ya kila siku", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Ujuzi na Stadi",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Tambua aina za ujuzi na stadi katika jamii", "knowledge", 1),
                            ("Elezea jinsi stadi zilivyosaidia jamii kuendelea", "comprehension", 2),
                            ("Chambua umuhimu wa stadi za kazi katika maisha ya kila siku", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MAADILI YA KIJAMII NA KIRAIFA",
                "code": "5.0",
                "form_level": 2,
                "order": 11,
                "periods": 14,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Maadili ya Jamii",
                        "code": "5.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea maadili ya msingi katika jamii", "knowledge", 1),
                            ("Elezea jinsi maadili yaliyosaidia jamii kuishi pamoja kwa amani", "comprehension", 2),
                            ("Tathmini umuhimu wa maadili katika jamii za kisasa", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Maadili ya Nafsi na Jamii",
                        "code": "5.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea thamani za maadili kwa mtu binafsi na jamii", "knowledge", 1),
                            ("Elezea jinsi maadili ya nafsi yanavyoathiri jamii nzima", "comprehension", 2),
                            ("Jadili mienendo ya maadili ya nafsi na athari zake kwa jamii", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Maadili ya Kiraifa",
                        "code": "5.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea maadili ya kiraifa katika jamii", "knowledge", 1),
                            ("Elezea jinsi maadili ya kiraifa yaliyosaidia kudumisha utu", "comprehension", 2),
                            ("Tathmini umuhimu wa maadili ya kiraifa katika maisha ya kila siku", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "FALSAFA NA MIKASA YA MAADILI",
                "code": "6.0",
                "form_level": 2,
                "order": 12,
                "periods": 12,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Thamani za Maisha",
                        "code": "6.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea thamani za maisha katika jamii", "knowledge", 1),
                            ("Elezea jinsi thamani za maisha zilivyosaidia jamii kuishi", "comprehension", 2),
                            ("Tathmini umuhimu wa thamani za maisha katika jamii za kisasa", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Maadili ya Uhusiano wa Kijamii",
                        "code": "6.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea maadili ya uhusiano wa kijamii", "knowledge", 1),
                            ("Elezea jinsi maadili yaliyosaidia kujenga uhusiano bora", "comprehension", 2),
                            ("Chambua changamoto zinazozuia kuzingatia maadili", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Kuelewa Maisha",
                        "code": "6.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea umuhimu wa kuelewa maisha ya watu wengine", "knowledge", 1),
                            ("Elezea jinsi kuelewa maisha inavyosaidia kujenga umoja", "comprehension", 2),
                            ("Jadili umuhimu wa kuelewa maisha katika kujenga jamii imara", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MIKASA YA UFALME WALENGHE",
                "code": "1.0",
                "form_level": 3,
                "order": 13,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Enchi na Nchi Jirani za Ufalme",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea enchi zilizoanzisha ufalme wa Walelenghe", "knowledge", 1),
                            ("Elezea ukubwa na mipaka ya ufalme huu", "comprehension", 2),
                            ("Chambua umuhimu wa enchi hizi kwa maendeleo ya ufalme", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Misingi ya Uongozi na Biashara",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Tambua misingi ya uongozi katika Ufalme wa Walelenghe", "knowledge", 1),
                            ("Elezea shughuli za biashara zilizofanywa na ufalme", "comprehension", 2),
                            ("Chambua miundo ya uongozi na ushawishi wa ufalme", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Utawala na Taratibu za Kila Siku",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea taratibu za utawala katika ufalme", "knowledge", 1),
                            ("Elezea maisha ya kila siku ya watu wa ufalme", "comprehension", 2),
                            ("Jadili changamoto zilizojitokeza katika utawala wa ufalme", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Miladha na Maisha ya Watu",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea miladha za watu wa Ufalme wa Walelenghe", "knowledge", 1),
                            ("Elezea jinsi miladha zilivyochangia maisha ya watu", "comprehension", 2),
                            ("Tathmini umuhimu wa miladha katika maisha ya watu wa ufalme", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "UTAFUTAJI WA WAEUROPA AFRIKA MASHARIKI",
                "code": "2.0",
                "form_level": 3,
                "order": 14,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Siasa za Ulaya na Kusalitiwa",
                        "code": "2.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea siasa za Ulaya zilizopelekea kusalitiwa kwa Afrika", "knowledge", 1),
                            ("Elezea sababu za Waeuropa kutaka kuchukua eneo la Afrika", "comprehension", 2),
                            ("Chambua matokeo ya siasa za Ulaya kwa Afrika", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Sababu za Utafutaji na Mazingira",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Tambua sababu zilizopelekea Waeuropa kufanya utafutaji Afrika", "knowledge", 1),
                            ("Elezea vigezo vya kijiografia vilivyowezesha utafutaji", "comprehension", 2),
                            ("Chambua athari za utafutaji kwa watu wa Afrika", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Watafiti na Safari Zao",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea safari za watafiti wake kama Burton, Speke, na Livingstone", "knowledge", 1),
                            ("Elezea mafanikio ya watafiti wake Afrika", "comprehension", 2),
                            ("Jadili matokeo ya safari za watafiti kwa watu wa Afrika", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Mazungumzo ya Waeuropa na Wenyeji",
                        "code": "2.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mazungumzo ya kwanza kati ya Waeuropa na wenyeji", "knowledge", 1),
                            ("Elezea jinsi mazungumzo yaliyopelekea mabadiliko", "comprehension", 2),
                            ("Chambua athari za mazungumzo kwa jamii za wenyeji", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "UTAWALA WA KOLONI LA KIJERUMANI TANGANYIKA",
                "code": "3.0",
                "form_level": 3,
                "order": 15,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Misingi ya Utawala wa Kijerumani",
                        "code": "3.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea misingi ya utawala wa koloni la Kijerumani", "knowledge", 1),
                            ("Elezea mfumo wa utawala uliotumika na Wajerumani", "comprehension", 2),
                            ("Chambua matokeo ya mfumo huu kwa watu wa Tanganyika", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Sera za Kiuchumi za Wajerumani",
                        "code": "3.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea sera za kiuchumi zilizotumika na Wajerumani", "knowledge", 1),
                            ("Elezea jinsi sera hizi zilivyobadilisha uchumi wa Tanganyika", "comprehension", 2),
                            ("Chambua athari za sera za kiuchumi kwa watu wa Tanganyika", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Ushindani kati ya Wajerumani na Wananchi",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea sababu za ushindani kati ya Wajerumani na wananchi", "knowledge", 1),
                            ("Elezea mbinu zilizotumika na Wajerumani kukabiliana na upinzani", "comprehension", 2),
                            ("Jadili matokeo ya ushindani kwa maendeleo ya taifa", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Mabadiliko ya Kijamii",
                        "code": "3.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mabadiliko ya kijamii yaliyotokea wakati wa utawala wa Kijerumani", "knowledge", 1),
                            ("Elezea jinsi mabadiliko yaliyoathiri maisha ya watu", "comprehension", 2),
                            ("Tathmini athari za mabadiliko ya kijamii kwa jamii za Tanganyika", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "UTAWALA WA KOLONI LA KIBRITANI TANGANYIKA",
                "code": "4.0",
                "form_level": 3,
                "order": 16,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Misingi ya Utawala wa Kibritani",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea misingi ya utawala wa koloni la Kibritani", "knowledge", 1),
                            ("Elezea mfumo wa utawala wa Kibritani", "comprehension", 2),
                            ("Chambua matokeo ya mfumo huu kwa watu wa Tanganyika", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Sera za Elimu na Afya",
                        "code": "4.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea sera za elimu na afya zilizotumika na Wabritani", "knowledge", 1),
                            ("Elezea jinsi sera hizi zilivyobadilisha maisha ya watu", "comprehension", 2),
                            ("Jadili athari za sera za elimu na afya kwa jamii", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Utawala wa Kati na Wa Ndani",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mfumo wa utawala wa kati na wa ndani", "knowledge", 1),
                            ("Elezea jinsi utawala ulivyosimamiwa na watu wa ndani", "comprehension", 2),
                            ("Chambua changamoto zilizojitokeza katika utawala", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Sera za Kazi na Ushuru",
                        "code": "4.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea sera za kazi na ushuru zilizotumika na Wabritani", "knowledge", 1),
                            ("Elezea jinsi sera hizi zilivyobadilisha maisha ya watu", "comprehension", 2),
                            ("Tathmini athari za sera za kazi na ushuru kwa watu wa Tanganyika", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MAPINDUZI YA MAJI MAJI NA UPINZANI Mwingine",
                "code": "5.0",
                "form_level": 3,
                "order": 17,
                "periods": 14,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Sababu za Mapinduzi ya Maji Maji",
                        "code": "5.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea sababu za mapinduzi ya Maji Maji", "knowledge", 1),
                            ("Elezea sababu za kijamii na kiuchumi zilizopelekea mapinduzi", "comprehension", 2),
                            ("Chambua changamoto za upinzani dhidi ya ukoloni", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Viongozi na Mikakati ya Mapinduzi",
                        "code": "5.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea viongozi wa mapinduzi ya Maji Maji", "knowledge", 1),
                            ("Elezea mikakati iliyotumika na viongozi hawa", "comprehension", 2),
                            ("Chambua jukumu la viongozi katika kusukuma mapinduzi", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Mapinduzi ya Nchi Nyingine",
                        "code": "5.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea mapinduzi mengine yaliyotokea Tanganyika", "knowledge", 1),
                            ("Elezea sababu za mapinduzi hayo", "comprehension", 2),
                            ("Chambua matokeo ya mapinduzi hayo kwa watu", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Matokeo ya Mapinduzi",
                        "code": "5.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea matokeo ya mapinduzi ya Maji Maji na upinzani mwingine", "knowledge", 1),
                            ("Elezea jinsi mapinduzi yaliyoathiri maisha ya watu", "comprehension", 2),
                            ("Tathmini umuhimu wa mapinduzi katika historia ya Tanzania", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MAISHA NA UCHUMI WAKATI WA KOLONI",
                "code": "6.0",
                "form_level": 3,
                "order": 18,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Mfumo wa Kazi na Ushuru",
                        "code": "6.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mfumo wa kazi na ushuru uliotumika wakati wa koloni", "knowledge", 1),
                            ("Elezea jinsi mfumo huu ulivyobadilisha maisha ya watu", "comprehension", 2),
                            ("Chambua athari za mfumo wa kazi na ushuru kwa jamii", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Dini na Maisha ya Kila Siku",
                        "code": "6.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea jinsi dini zilivyoingia na kuenea Afrika", "knowledge", 1),
                            ("Elezea athari za dini kwa maisha ya watu", "comprehension", 2),
                            ("Jadili matokeo ya dini kwa miladha na desturi", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Mabadiliko ya Jamii na Jinsia",
                        "code": "6.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea mabadiliko ya jamii yaliyotokea wakati wa koloni", "knowledge", 1),
                            ("Elezea jinsi mabadiliko yaliyoathiri maisha ya watu", "comprehension", 2),
                            ("Chambua athari za mabadiliko kwa jamii za Tanganyika", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Maisha ya Kijamii na Kiuchumi",
                        "code": "6.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea maisha ya kijamii na kiuchumi wakati wa koloni", "knowledge", 1),
                            ("Elezea jinsi maisha yaliyobadilika", "comprehension", 2),
                            ("Tathmini umuhimu wa mabadiliko ya kijamii na kiuchumi kwa jamii", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "VITA VYA DUNIA NA ATHARI ZAKE TANGANYIKA",
                "code": "1.0",
                "form_level": 4,
                "order": 19,
                "periods": 14,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Vita vya Dunia ya Kwanza Tanganyika",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea matokeo ya Vita vya Dunia ya Kwanza kwa Tanganyika", "knowledge", 1),
                            ("Elezea jinsi vita vilivyobadilisha uchumi wa Tanganyika", "comprehension", 2),
                            ("Chambua athari za Vita vya Dunia ya Kwanza kwa watu", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Vita vya Dunia ya Pili Tanganyika",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea matokeo ya Vita vya Dunia ya Pili kwa Tanganyika", "knowledge", 1),
                            ("Elezea jinsi vita vilivyobadilisha uchumi na jamii", "comprehension", 2),
                            ("Chambua athari za Vita vya Dunia ya Pili kwa watu", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Kuchangishwa kwa Kazi na Vitengo",
                        "code": "1.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea jinsi watu walivyolazimishwa kuchangisha kazi", "knowledge", 1),
                            ("Elezea jinsi kazi ilivyobadilisha maisha ya watu", "comprehension", 2),
                            ("Tathmini athari za kuchangishwa kwa kazi kwa watu", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Mabadiliko ya Kijamii na Kisiasa",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea mabadiliko ya kijamii na kisiasa baada ya vita", "knowledge", 1),
                            ("Elezea jinsi vita vilivyosababisha mabadiliko", "comprehension", 2),
                            ("Jadili umuhimu wa mabadiliko hayo kwa maendeleo ya taifa", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "HARAKATI ZA WAFANYIKAZI NA UMOJA WAO",
                "code": "2.0",
                "form_level": 4,
                "order": 20,
                "periods": 12,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Mazingira ya Kazi",
                        "code": "2.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mazingira ya kazi ya wafanyakazi wakati wa koloni", "knowledge", 1),
                            ("Elezea changamoto zilizokuwepo kwa wafanyakazi", "comprehension", 2),
                            ("Chambua athari za mazingira ya kazi kwa wafanyakazi", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Umoja wa Wafanyakazi",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea jinsi wafanyakazi walivyoungana kulinda haki zao", "knowledge", 1),
                            ("Elezea mikakati iliyotumika na wafanyakazi", "comprehension", 2),
                            ("Jadili mafanikio ya umoja wa wafanyakazi", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Mapinduzi ya Reli 1947",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea sababu za mapinduzi ya reli ya 1947", "knowledge", 1),
                            ("Elezea matokeo ya mapinduzi ya reli", "comprehension", 2),
                            ("Tathmini umuhimu wa mapinduzi ya reli katika historia", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "HARAKATI ZA UHURU NA KUUNGANISHWA",
                "code": "3.0",
                "form_level": 4,
                "order": 21,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Asasi za Kisiasa za Kwanza",
                        "code": "3.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea asasi za kisiasa za kwanza zilizoanzishwa", "knowledge", 1),
                            ("Elezea sababu za kuanzishwa kwa asasi hizi", "comprehension", 2),
                            ("Chambua jukumu la asasi hizi katika kupigania uhuru", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Chama cha TANU",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea historia ya chama cha TANU", "knowledge", 1),
                            ("Elezea jukumu la TANU katika kupigania uhuru", "comprehension", 2),
                            ("Chambua mikakati ya TANU katika kupata uhuru", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Viongozi wa Harakati",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea viongozi wa harakati za uhuru", "knowledge", 1),
                            ("Elezea mchango wa kila kiongozi", "comprehension", 2),
                            ("Tathmini umuhimu wa viongozi katika kupigania uhuru", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Uhamasishaji wa Wananchi",
                        "code": "3.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mikakati ya uhamasishaji wa wananchi", "knowledge", 1),
                            ("Elezea jinsi uhamasishaji ulivyosaidia kupigania uhuru", "comprehension", 2),
                            ("Chambua matokeo ya uhamasishaji wa wananchi", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MAPINDUZI YA KISASA NA KUPATA UHURU",
                "code": "4.0",
                "form_level": 4,
                "order": 22,
                "periods": 14,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Mazungumzo ya Kisiasa",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mazungumzo ya kisiasa yaliyofanyika", "knowledge", 1),
                            ("Elezea mafanikio ya mazungumzo hayo", "comprehension", 2),
                            ("Chambua changamoto zilizojitokeza katika mazungumzo", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Katiba na Uhuru",
                        "code": "4.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mchakato wa upatikanaji wa katiba", "knowledge", 1),
                            ("Elezea jinsi katiba ilivyosaidia kupata uhuru", "comprehension", 2),
                            ("Jadili umuhimu wa katiba katika historia ya uhuru", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Uhuru wa Tanganyika",
                        "code": "4.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea tarehe na mazingira ya kupata uhuru", "knowledge", 1),
                            ("Elezea mafanikio ya kupata uhuru", "comprehension", 2),
                            ("Tathmini umuhimu wa uhuru kwa watu wa Tanganyika", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Unganisho na Zanzibar",
                        "code": "4.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea sababu za unganisho na Zanzibar", "knowledge", 1),
                            ("Elezea matokeo ya unganisho huu", "comprehension", 2),
                            ("Chambua athari za unganisho kwa watu wa Tanzania", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "UJENZI WA TAIFA NA UJAMAA",
                "code": "5.0",
                "form_level": 4,
                "order": 23,
                "periods": 14,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Azimio la Arusha",
                        "code": "5.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea sababu za kutoa Azimio la Arusha", "knowledge", 1),
                            ("Elezea misingi ya Azimio la Arusha", "comprehension", 2),
                            ("Chambua matokeo ya Azimio la Arusha kwa taifa", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Ujamaa na Kujitegemea",
                        "code": "5.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea dhana ya Ujamaa na Kujitegemea", "knowledge", 1),
                            ("Elezea jinsi Ujamaa ulivyoendeshwa", "comprehension", 2),
                            ("Tathmini mafanikio na changamoto za Ujamaa", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Kujenga Ujamaa Vijijini",
                        "code": "5.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea mpango wa kujenga Ujamaa vijijini", "knowledge", 1),
                            ("Elezea mafanikio ya mpango huu", "comprehension", 2),
                            ("Jadili changamoto zilizojitokeza katika utekelezaji", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Maendeleo ya Jamii",
                        "code": "5.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea maendeleo ya jamii yaliyopatikana", "knowledge", 1),
                            ("Elezea jinsi maendeleo yaliyoathiri maisha ya watu", "comprehension", 2),
                            ("Tathmini umuhimu wa maendeleo hayo kwa taifa", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "TANZANIA NA KUSHIRIKIANA KIMATAIFA",
                "code": "6.0",
                "form_level": 4,
                "order": 24,
                "periods": 10,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Nchi washirika wa Tanzania",
                        "code": "6.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea nchi washirika wa Tanzania", "knowledge", 1),
                            ("Elezea misingi ya ushirikiano kati ya nchi hizi", "comprehension", 2),
                            ("Chambua umuhimu wa ushirikiano huu kwa Tanzania", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Usaidizi wa Kikanda na Ujumla",
                        "code": "6.2",
                        "order": 2,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea usaidizi wa kikanda na wa ujumla uliotolewa", "knowledge", 1),
                            ("Elezea matokeo ya usaidizi huu", "comprehension", 2),
                            ("Tathmini umuhimu wa usaidizi huu kwa maendeleo", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Uhusiano wa Kimataifa",
                        "code": "6.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea uhusiano wa Tanzania na nchi nyingine", "knowledge", 1),
                            ("Elezea mafanikio ya uhusiano huu", "comprehension", 2),
                            ("Chambua changamoto za uhusiano wa kimataifa", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "DEMOKRASIA YA KIPANDE CHA SIKU",
                "code": "1.0",
                "form_level": 5,
                "order": 25,
                "periods": 14,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Tatizo la Demokrasia",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea maana ya demokrasia ya kipande cha siku", "knowledge", 1),
                            ("Elezea sababu za mabadiliko ya kidemokrasia", "comprehension", 2),
                            ("Jadili umuhimu wa demokrasia katika maisha ya siku", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Katiba ya Kipande cha Siku",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea misingi ya katiba ya kipande cha siku", "knowledge", 1),
                            ("Elezea mabadiliko yaliyofanywa kwenye katiba", "comprehension", 2),
                            ("Chambua matokeo ya mabadiliko ya katiba kwa jamii", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Shughuli za NEC na Vyama vya Siasa",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea shughuli za NEC na vyama vya siasa", "knowledge", 1),
                            ("Elezea jukumu la NEC katika kusimamia uchaguzi", "comprehension", 2),
                            ("Chambua changamoto zilizojitokeza katika shughuli hizi", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "CHANGAMOTO ZA USAWAZI WA KISASA",
                "code": "2.0",
                "form_level": 5,
                "order": 26,
                "periods": 14,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Rushwa na Mapambano",
                        "code": "2.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea maana ya rushwa na sababu zake", "knowledge", 1),
                            ("Elezea athari za rushwa kwa taifa", "comprehension", 2),
                            ("Jadili mikakati ya kupambana na rushwa", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Haki za Binadamu na Uwezeshaji",
                        "code": "2.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea haki za binadamu na kanuni zake", "knowledge", 1),
                            ("Elezea jinsi haki za binadamu zilivyolindwa", "comprehension", 2),
                            ("Tathmini umuhimu wa ulinzi wa haki za binadamu kwa jamii", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Uwajibikaji na Usimamizi",
                        "code": "2.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Elezea dhana ya uwajibikaji na usimamizi", "knowledge", 1),
                            ("Elezea jinsi uwajibikaji unavyosaidia kupunguza rushwa", "comprehension", 2),
                            ("Chambua changamoto za uwajibikaji na usimamizi", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "USHIRIKIANO WA KIKANDA",
                "code": "3.0",
                "form_level": 5,
                "order": 27,
                "periods": 12,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Jumuiya ya Afrika Mashariki na PEMEA",
                        "code": "3.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea historia ya Jumuiya ya Afrika Mashariki", "knowledge", 1),
                            ("Elezea misingi ya Jumuiya ya Afrika Mashariki", "comprehension", 2),
                            ("Chambua mafanikio ya Jumuiya kwa nchi washirika", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Jumuiya ya Afrika (AU)",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea historia ya Jumuiya ya Afrika", "knowledge", 1),
                            ("Elezea misingi ya Jumuiya ya Afrika", "comprehension", 2),
                            ("Tathmini umuhimu wa AU katika maendeleo ya bara", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Mikakati ya Kikanda na Ushirikiano",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mikakati ya kikanda ya ushirikiano", "knowledge", 1),
                            ("Elezea jinsi mikakati ilivyosaidia maendeleo", "comprehension", 2),
                            ("Chambua changamoto za utekelezaji wa mikakati", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MAISHA YA SIKU ZA HATARI",
                "code": "4.0",
                "form_level": 5,
                "order": 28,
                "periods": 12,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Idadi ya Watu na Mabadiliko",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mabadiliko ya idadi ya watu Tanzania", "knowledge", 1),
                            ("Elezea sababu za mabadiliko ya idadi ya watu", "comprehension", 2),
                            ("Chambua athari za mabadiliko ya idadi ya watu kwa maendeleo", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Mazingira na Uharibifu",
                        "code": "4.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea changamoto za mazingira Tanzania", "knowledge", 1),
                            ("Elezea sababu za uharibifu wa mazingira", "comprehension", 2),
                            ("Tathmini mikakati ya kulinda mazingira", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Teknolojia na Maendeleo",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea jinsi teknolojia inavyoendeleza maisha", "knowledge", 1),
                            ("Elezea athari za teknolojia kwa jamii", "comprehension", 2),
                            ("Jadili umuhimu wa teknolojia katika maendeleo ya taifa", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "AFYA NA MAISHA YA KIJAMII",
                "code": "5.0",
                "form_level": 5,
                "order": 29,
                "periods": 10,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Changamoto za Afya",
                        "code": "5.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea changamoto za afya Tanzania", "knowledge", 1),
                            ("Elezea sababu za changamoto hizi", "comprehension", 2),
                            ("Jadili mikakati ya kukabiliana na changamoto za afya", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Afya ya Umma",
                        "code": "5.2",
                        "order": 2,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea umuhimu wa afya ya umma", "knowledge", 1),
                            ("Elezea jinsi afya ya umma inavyoathiri maendeleo", "comprehension", 2),
                            ("Tathmini mafanikio ya afya ya umma", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Maisha ya Kijamii",
                        "code": "5.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea maisha ya kijamii ya watu Tanzania", "knowledge", 1),
                            ("Elezea changamoto za maisha ya kijamii", "comprehension", 2),
                            ("Chambua mikakati ya kukabiliana na changamoto za kijamii", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "UTAWALA WA KIPANDE CHA SIKU",
                "code": "1.0",
                "form_level": 6,
                "order": 30,
                "periods": 12,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Taasisi za Demokrasia",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea taasisi za demokrasia Tanzania", "knowledge", 1),
                            ("Elezea jukumu la kila taasisi katika demokrasia", "comprehension", 2),
                            ("Chambua changamoto za taasisi za demokrasia", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Uchaguzi na Usimamizi",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mchakato wa uchaguzi Tanzania", "knowledge", 1),
                            ("Elezea jinsi uchaguzi unavyosimamiwa", "comprehension", 2),
                            ("Tathmini changamoto za uchaguzi na suluhisho", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Uwajibikaji na Upinzani",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea umuhimu wa uwajibikaji na upinzani", "knowledge", 1),
                            ("Elezea jinsi uwajibikaji unavyosaidia demokrasia", "comprehension", 2),
                            ("Jadili changamoto za uwajibikaji na upinzani", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "CHANGAMOTO ZA KISASA ZA USAWAZI",
                "code": "2.0",
                "form_level": 6,
                "order": 31,
                "periods": 12,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Rushwa na Mapambano",
                        "code": "2.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea changamoto za rushwa kwa usawazi", "knowledge", 1),
                            ("Elezea mikakati ya kupambana na rushwa", "comprehension", 2),
                            ("Tathmini ufanisi wa mikakati ya kupambana na rushwa", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Haki za Binadamu na Haki za Jamii",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea changamoto za haki za binadamu Tanzania", "knowledge", 1),
                            ("Elezea mikakati ya kulinda haki za binadamu", "comprehension", 2),
                            ("Chambua changamoto za utekelezaji wa haki za binadamu", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Usimamizi na Uwajibikaji",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea changamoto za usimamizi na uwajibikaji", "knowledge", 1),
                            ("Elezea jinsi usimamizi unavyoathiri maisha ya watu", "comprehension", 2),
                            ("Jadili mikakati ya kuboresha usimamizi na uwajibikaji", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "USHIRIKIANO WA KIKANDA NA UMOJA",
                "code": "3.0",
                "form_level": 6,
                "order": 32,
                "periods": 12,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Jumuiya ya Afrika Mashariki",
                        "code": "3.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea historia na misingi ya Jumuiya ya Afrika Mashariki", "knowledge", 1),
                            ("Elezea mafanikio ya Jumuiya kwa nchi washirika", "comprehension", 2),
                            ("Tathmini changamoto za Jumuiya na suluhisho", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Jumuiya ya Afrika na Muungano",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea historia ya Muungano wa Afrika na Jumuiya ya Afrika", "knowledge", 1),
                            ("Elezea misingi ya ushirikiano wa kikanda", "comprehension", 2),
                            ("Chambua mafanikio na changamoto za ushirikiano", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Mikakati ya Kikanda",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea mikakati ya ushirikiano wa kikanda", "knowledge", 1),
                            ("Elezea jinsi mikakati ilivyosaidia maendeleo", "comprehension", 2),
                            ("Jadili changamoto za utekelezaji wa mikakati", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "MAISHA YA SIKU ZA HATARI",
                "code": "4.0",
                "form_level": 6,
                "order": 33,
                "periods": 10,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Idadi ya Watu na Mazingira",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Elezea changamoto za idadi ya watu na mazingira", "knowledge", 1),
                            ("Elezea jinsi changamoto hizi zilivyoathiri maisha", "comprehension", 2),
                            ("Tathmini mikakati ya kukabiliana na changamoto hizi", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Teknolojia na Maisha",
                        "code": "4.2",
                        "order": 2,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea jinsi teknolojia inavyoendeleza maisha", "knowledge", 1),
                            ("Elezea athari za teknolojia kwa jamii na maendeleo", "comprehension", 2),
                            ("Chambua changamoto za teknolojia na suluhisho", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Afya na Maisha ya Kijamii",
                        "code": "4.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Elezea changamoto za afya na maisha ya kijamii", "knowledge", 1),
                            ("Elezea mikakati ya kukabiliana na changamoto hizi", "comprehension", 2),
                            ("Jadili umuhimu wa afya katika maendeleo ya taifa", "analysis", 3),
                        ],
                    },
                ],
            },
        ],
    },
    {
        "name": "Civics",
        "code": "CIV",
        "slug": "civics",
        "necta_code": "015",
        "is_core": True,
        "description": "Civics is a core subject covering national identity, governance, rights, responsibilities, and social development for Tanzanian Ordinary Level secondary education across Form I to Form IV.",
        "form_start": 1,
        "form_end": 4,
        "topics": [
            {
                "title": "OUR NATION",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Geographical features of Tanzania",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Identify major physical features of Tanzania including mountains, lakes, and rivers", "knowledge", 1),
                            ("Describe the climatic zones of Tanzania and their characteristics", "comprehension", 2),
                            ("Explain how geographical features influence human activities in Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Historical background of Tanzania",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("State key historical events leading to the formation of Tanzania", "knowledge", 1),
                            ("Explain the significance of the union between Tanganyika and Zanzibar", "comprehension", 2),
                            ("Analyse the impact of colonialism on the social and political development of Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "National symbols and identity",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("List Tanzania's national symbols including the flag, anthem, and coat of arms", "knowledge", 1),
                            ("Explain the meaning and significance of each national symbol", "comprehension", 2),
                            ("Discuss how national symbols promote unity and patriotism among citizens", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Tanzania as a nation state",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Define the concept of a nation state", "knowledge", 1),
                            ("Describe the features that make Tanzania a nation state", "comprehension", 2),
                            ("Compare Tanzania's characteristics as a nation state with those of other African countries", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "PROMOTION OF LIFE SKILLS",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and types of life skills",
                        "code": "2.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define life skills and state their importance", "knowledge", 1),
                            ("Classify different types of life skills such as social, coping, and personal skills", "comprehension", 2),
                            ("Illustrate how life skills can be applied in daily situations", "application", 3)
                        ]
                    },
                    {
                        "title": "Decision making and problem solving",
                        "code": "2.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the steps involved in effective decision making", "comprehension", 1),
                            ("Apply problem solving techniques to common life challenges", "application", 2),
                            ("Evaluate the consequences of poor decision making in personal and social life", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Coping with stress and peer pressure",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify sources of stress and peer pressure among young people", "knowledge", 1),
                            ("Explain strategies for coping with stress and resisting negative peer pressure", "comprehension", 2),
                            ("Apply coping strategies in real life situations involving stress and peer influence", "application", 3)
                        ]
                    },
                    {
                        "title": "Self awareness and self esteem",
                        "code": "2.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define self awareness and self esteem", "knowledge", 1),
                            ("Describe ways of building positive self esteem", "comprehension", 2),
                            ("Analyse the effects of low self esteem on academic and social performance", "analysis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "HUMAN RIGHTS",
                "code": "1.0",
                "form_level": 1,
                "order": 3,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and classification of human rights",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define human rights and state their universal nature", "knowledge", 1),
                            ("Distinguish between civil and political rights and economic social and cultural rights", "comprehension", 2),
                            ("Classify human rights according to the International Bill of Rights", "application", 3)
                        ]
                    },
                    {
                        "title": "Human rights in Tanzania",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List fundamental human rights guaranteed by the Constitution of Tanzania", "knowledge", 1),
                            ("Explain how human rights are protected under Tanzanian law", "comprehension", 2),
                            ("Evaluate the effectiveness of human rights protection mechanisms in Tanzania", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Responsibilities of citizens",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("State the duties and responsibilities of citizens to the state", "knowledge", 1),
                            ("Explain the relationship between rights and responsibilities of citizens", "comprehension", 2),
                            ("Discuss the importance of fulfilling civic duties for national development", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Violation of human rights",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Identify common forms of human rights violations in Tanzania", "knowledge", 1),
                            ("Analyse the causes of human rights violations in the community", "analysis", 2),
                            ("Propose solutions to prevent human rights violations in society", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "NATIONAL CULTURE",
                "code": "2.0",
                "form_level": 1,
                "order": 4,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and elements of national culture",
                        "code": "2.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define culture and distinguish it from tradition and custom", "knowledge", 1),
                            ("Identify the key elements of Tanzanian national culture", "knowledge", 2),
                            ("Explain how national culture promotes unity among diverse communities", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Roles of culture in national development",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the positive roles of culture in society", "comprehension", 1),
                            ("Explain how cultural practices can both promote and hinder development", "analysis", 2),
                            ("Propose ways to preserve beneficial cultural practices while discarding harmful ones", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "National Cultural Policy",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("State the main objectives of the National Cultural Policy of Tanzania", "knowledge", 1),
                            ("Explain the role of the government in promoting national culture", "comprehension", 2),
                            ("Analyse the effectiveness of the National Cultural Policy in preserving Tanzanian culture", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Cultural diversity in Tanzania",
                        "code": "2.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Identify different cultural groups in Tanzania and their unique practices", "knowledge", 1),
                            ("Describe how cultural diversity enriches the Tanzanian national identity", "comprehension", 2),
                            ("Discuss strategies for promoting harmony among different cultural groups", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "THE ELECTORAL PROCESS",
                "code": "3.0",
                "form_level": 1,
                "order": 5,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and types of elections",
                        "code": "3.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define election and state its importance in a democratic society", "knowledge", 1),
                            ("Distinguish between general elections and by elections in Tanzania", "comprehension", 2),
                            ("Explain the role of the National Electoral Commission in managing elections", "application", 3)
                        ]
                    },
                    {
                        "title": "Voter registration and voting procedures",
                        "code": "3.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the process of voter registration in Tanzania", "comprehension", 1),
                            ("Apply knowledge of voting procedures during election day", "application", 2),
                            ("Evaluate the importance of voter participation in strengthening democracy", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Qualifications and disqualifications of candidates",
                        "code": "3.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("State the qualifications required for candidates to stand for election", "knowledge", 1),
                            ("Explain the conditions under which a candidate may be disqualified", "comprehension", 2),
                            ("Discuss the importance of having qualified candidates in elections", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "PROMOTION OF FAMILY LIFE",
                "code": "1.0",
                "form_level": 2,
                "order": 6,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Structure and functions of the family",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define the family and identify different types of family structures in Tanzania", "knowledge", 1),
                            ("Describe the functions of the family in society", "comprehension", 2),
                            ("Analyse the changing nature of family structures in modern Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Family values and moral development",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List core family values such as honesty, respect, and responsibility", "knowledge", 1),
                            ("Explain how family values contribute to moral development of children", "comprehension", 2),
                            ("Discuss the role of parents and guardians in instilling moral values in children", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Challenges facing family life in Tanzania",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Identify major challenges facing families in Tanzania today", "knowledge", 1),
                            ("Analyse the effects of poverty, divorce, and child neglect on family stability", "analysis", 2),
                            ("Propose solutions to address challenges facing family life in the community", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Parental responsibilities and children's rights",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("State the legal responsibilities of parents towards their children", "knowledge", 1),
                            ("Explain the rights of children as protected by the Law of the Child Act", "comprehension", 2),
                            ("Evaluate the impact of parental neglect on children's welfare and development", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "GOVERNMENT OF TANZANIA",
                "code": "2.0",
                "form_level": 2,
                "order": 7,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and forms of government",
                        "code": "2.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define government and explain its importance in society", "knowledge", 1),
                            ("Distinguish between different forms of government including monarchy, democracy, and dictatorship", "comprehension", 2),
                            ("Classify the government of Tanzania according to its structural form", "application", 3)
                        ]
                    },
                    {
                        "title": "Structure of government in Tanzania",
                        "code": "2.2",
                        "order": 2,
                        "periods": 7,
                        "outcomes": [
                            ("Identify the three organs of government in Tanzania", "knowledge", 1),
                            ("Describe the functions of the executive, legislative, and judicial organs", "comprehension", 2),
                            ("Explain the principle of checks and balances among the three organs", "analysis", 3)
                        ]
                    },
                    {
                        "title": "The Constitution of Tanzania",
                        "code": "2.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("State the key provisions of the Constitution of the United Republic of Tanzania", "knowledge", 1),
                            ("Explain the process of constitutional amendment in Tanzania", "comprehension", 2),
                            ("Discuss the importance of the Constitution as the supreme law of the land", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Local government in Tanzania",
                        "code": "2.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("List the levels of local government in Tanzania", "knowledge", 1),
                            ("Describe the functions and responsibilities of local government authorities", "comprehension", 2),
                            ("Evaluate the role of local government in promoting grassroots development", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "DEMOCRACY",
                "code": "3.0",
                "form_level": 2,
                "order": 8,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and principles of democracy",
                        "code": "3.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define democracy and identify its core principles", "knowledge", 1),
                            ("Distinguish between direct and representative democracy", "comprehension", 2),
                            ("Explain how the principle of majority rule and minority rights operate in democracy", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Democratic practices in Tanzania",
                        "code": "3.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Identify democratic institutions and practices in Tanzania", "knowledge", 1),
                            ("Describe how multiparty democracy functions in Tanzania", "comprehension", 2),
                            ("Analyse the strengths and weaknesses of the multiparty system in Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Role of civil society in democracy",
                        "code": "3.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define civil society and give examples of civil society organisations in Tanzania", "knowledge", 1),
                            ("Explain the roles of civil society in promoting democratic governance", "comprehension", 2),
                            ("Evaluate the impact of civil society organisations on good governance in Tanzania", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Challenges to democracy in Tanzania",
                        "code": "3.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("List obstacles to democratic governance in Tanzania", "knowledge", 1),
                            ("Analyse the effects of corruption, illiteracy, and poverty on democracy", "analysis", 2),
                            ("Propose measures to strengthen democratic practices in Tanzania", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "ENVIRONMENTAL CONSERVATION",
                "code": "1.0",
                "form_level": 2,
                "order": 9,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and importance of environmental conservation",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define environmental conservation and explain its importance", "knowledge", 1),
                            ("Describe the components of the natural environment that need conservation", "comprehension", 2),
                            ("Explain the relationship between human activities and environmental degradation", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Threats to the environment in Tanzania",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Identify major environmental problems in Tanzania such as deforestation and soil erosion", "knowledge", 1),
                            ("Analyse the causes and effects of environmental degradation in local communities", "analysis", 2),
                            ("Discuss the consequences of environmental destruction on human health and livelihoods", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Government policies on environmental protection",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("State key government policies and laws on environmental protection in Tanzania", "knowledge", 1),
                            ("Explain the role of the National Environment Management Council in environmental protection", "comprehension", 2),
                            ("Evaluate the effectiveness of government efforts in conserving the environment", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Community participation in environmental conservation",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Identify ways in which communities can participate in environmental conservation", "knowledge", 1),
                            ("Describe community based environmental conservation initiatives in Tanzania", "comprehension", 2),
                            ("Apply knowledge of environmental conservation in planning community based projects", "application", 3)
                        ]
                    }
                ]
            },
            {
                "title": "NATIONAL UNITY",
                "code": "1.0",
                "form_level": 3,
                "order": 10,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and importance of national unity",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define national unity and explain its significance to a nation", "knowledge", 1),
                            ("Describe the factors that promote national unity in Tanzania", "comprehension", 2),
                            ("Analyse the consequences of national disunity on development", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Factors promoting national unity in Tanzania",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("List national symbols, policies, and institutions that promote unity", "knowledge", 1),
                            ("Explain the role of the national language Swahili in fostering unity", "comprehension", 2),
                            ("Discuss how education and sports contribute to national cohesion", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Challenges to national unity",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Identify threats to national unity in Tanzania such as tribalism and regionalism", "knowledge", 1),
                            ("Analyse the effects of ethnicity and regional disparities on national cohesion", "analysis", 2),
                            ("Evaluate government strategies for addressing challenges to national unity", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Role of citizens in promoting national unity",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("State the responsibilities of citizens in promoting national unity", "knowledge", 1),
                            ("Explain how individual behaviour contributes to or undermines national unity", "comprehension", 2),
                            ("Propose practical actions that citizens can take to strengthen national cohesion", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "GLOBALIZATION",
                "code": "2.0",
                "form_level": 3,
                "order": 11,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and dimensions of globalization",
                        "code": "2.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define globalization and identify its main dimensions", "knowledge", 1),
                            ("Describe the economic, political, and cultural dimensions of globalization", "comprehension", 2),
                            ("Explain how technology and communication have accelerated globalization", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Positive effects of globalization",
                        "code": "2.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List the benefits of globalization for developing countries including Tanzania", "knowledge", 1),
                            ("Explain how globalization promotes trade investment and technology transfer", "comprehension", 2),
                            ("Analyse the positive impact of globalization on education and health sectors in Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Negative effects of globalization",
                        "code": "2.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Identify the negative impacts of globalization on local economies and cultures", "knowledge", 1),
                            ("Discuss how globalization can increase poverty and inequality in developing nations", "synthesis", 2),
                            ("Evaluate the extent to which Tanzania has benefited or suffered from globalization", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Tanzania's response to globalization",
                        "code": "2.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the government policies adopted to address globalization challenges", "comprehension", 1),
                            ("Explain the role of regional and international organizations in managing globalization", "application", 2),
                            ("Propose strategies for Tanzania to maximise benefits and minimise costs of globalization", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "INTEGRATION AND NATIONAL INTEGRATION",
                "code": "3.0",
                "form_level": 3,
                "order": 12,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and types of integration",
                        "code": "3.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define integration and distinguish between economic political and social integration", "knowledge", 1),
                            ("Explain the difference between regional integration and national integration", "comprehension", 2),
                            ("Analyse the importance of integration for national development", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Economic integration in Tanzania",
                        "code": "3.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Identify key economic integration initiatives in Tanzania including the EAC and SADC", "knowledge", 1),
                            ("Describe the benefits of economic integration for trade and investment", "comprehension", 2),
                            ("Discuss challenges facing economic integration in East Africa", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Social integration in Tanzania",
                        "code": "3.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("List policies and programmes that promote social integration in Tanzania", "knowledge", 1),
                            ("Explain the role of education, language, and intermarriage in social integration", "comprehension", 2),
                            ("Evaluate the effectiveness of social integration policies in fostering national cohesion", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Challenges to integration in Tanzania",
                        "code": "3.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Identify obstacles to integration at national and regional levels", "knowledge", 1),
                            ("Analyse the effects of poverty inequality and political differences on integration", "analysis", 2),
                            ("Propose solutions to overcome barriers to integration in Tanzania and East Africa", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "CORRUPTION",
                "code": "4.0",
                "form_level": 3,
                "order": 13,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and forms of corruption",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define corruption and state its meaning in the Tanzanian context", "knowledge", 1),
                            ("Distinguish between different forms of corruption including bribery embezzlement and nepotism", "comprehension", 2),
                            ("Classify corruption cases according to their severity and context", "application", 3)
                        ]
                    },
                    {
                        "title": "Causes and effects of corruption",
                        "code": "4.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List the major causes of corruption in Tanzania", "knowledge", 1),
                            ("Analyse the social economic and political effects of corruption on national development", "analysis", 2),
                            ("Discuss how corruption undermines public service delivery and investor confidence", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Anti corruption measures in Tanzania",
                        "code": "4.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Identify government institutions and laws fighting corruption in Tanzania", "knowledge", 1),
                            ("Describe the functions of the Prevention of Combating of Corruption Bureau", "comprehension", 2),
                            ("Evaluate the effectiveness of anti corruption measures in reducing corruption", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Role of citizens in fighting corruption",
                        "code": "4.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("State the responsibilities of citizens in preventing and reporting corruption", "knowledge", 1),
                            ("Explain how civic education can help reduce corruption in the community", "comprehension", 2),
                            ("Apply ethical principles to resist and report corrupt practices in daily life", "application", 3)
                        ]
                    }
                ]
            },
            {
                "title": "CULTURE AND SOCIALIZATION",
                "code": "1.0",
                "form_level": 4,
                "order": 14,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Concept of culture and socialization",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define culture and socialization and explain their relationship", "knowledge", 1),
                            ("Describe the agents of socialization including family school and media", "comprehension", 2),
                            ("Analyse how socialization processes shape individual and collective behaviour", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Cultural change and modernization",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Identify factors that cause cultural change in Tanzanian society", "knowledge", 1),
                            ("Discuss the impact of modernization on traditional cultural values and practices", "synthesis", 2),
                            ("Evaluate the balance between preserving culture and embracing modernization", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Culture and national development",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Describe how cultural values can contribute to economic and social development", "comprehension", 1),
                            ("Explain the role of arts music and literature in promoting national identity", "application", 2),
                            ("Discuss the importance of cultural heritage tourism for Tanzania's economy", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Global cultural interactions",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Identify the effects of global cultural exchanges on Tanzanian culture", "knowledge", 1),
                            ("Analyse the impact of foreign media and technology on local cultural values", "analysis", 2),
                            ("Propose strategies for Tanzania to engage positively with global cultural influences while preserving national identity", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "GENDER ISSUES IN SOCIETY",
                "code": "2.0",
                "form_level": 4,
                "order": 15,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning of gender and gender concepts",
                        "code": "2.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define gender and distinguish between sex and gender", "knowledge", 1),
                            ("Explain key gender concepts including gender roles gender equity and gender equality", "comprehension", 2),
                            ("Analyse the social construction of gender roles in Tanzanian society", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Gender inequality and its effects",
                        "code": "2.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Identify areas of gender inequality in education employment and politics in Tanzania", "knowledge", 1),
                            ("Analyse the causes and consequences of gender inequality on national development", "analysis", 2),
                            ("Discuss the impact of gender based violence on individuals and communities", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Government policies on gender equality",
                        "code": "2.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("List government policies and laws aimed at promoting gender equality in Tanzania", "knowledge", 1),
                            ("Describe the role of the Ministry of Community Development Gender and Children", "comprehension", 2),
                            ("Evaluate the effectiveness of gender mainstreaming in Tanzania's development planning", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Role of stakeholders in promoting gender equality",
                        "code": "2.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Identify the roles of government, NGOs, and communities in promoting gender equality", "knowledge", 1),
                            ("Explain how education and awareness campaigns can reduce gender disparities", "application", 2),
                            ("Propose strategies for achieving gender equality in Tanzanian schools and communities", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "ROAD SAFETY EDUCATION",
                "code": "3.0",
                "form_level": 4,
                "order": 16,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and importance of road safety",
                        "code": "3.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define road safety and explain its importance for individuals and the nation", "knowledge", 1),
                            ("Describe common causes of road accidents in Tanzania", "comprehension", 2),
                            ("Analyse the social and economic costs of road accidents on the nation", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Road safety rules and regulations",
                        "code": "3.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List key road safety rules and traffic regulations in Tanzania", "knowledge", 1),
                            ("Explain the functions of road safety agencies including TARURA and the police", "comprehension", 2),
                            ("Apply road safety rules and regulations in real life situations as a pedestrian or passenger", "application", 3)
                        ]
                    },
                    {
                        "title": "Roles of stakeholders in road safety",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify the responsibilities of drivers, pedestrians, and passengers in ensuring road safety", "knowledge", 1),
                            ("Describe the role of government and private sector in improving road safety", "comprehension", 2),
                            ("Evaluate the effectiveness of road safety campaigns in reducing accidents", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Technology and road safety",
                        "code": "3.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Identify technologies used to improve road safety such as speed cameras and vehicle inspection", "knowledge", 1),
                            ("Explain how technology can help reduce road accidents and enforce traffic laws", "comprehension", 2),
                            ("Discuss the challenges of implementing road safety technology in Tanzania", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "REGIONAL AND INTERNATIONAL COOPERATION",
                "code": "4.0",
                "form_level": 4,
                "order": 17,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and types of international cooperation",
                        "code": "4.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define international cooperation and identify its types", "knowledge", 1),
                            ("Distinguish between bilateral and multilateral cooperation", "comprehension", 2),
                            ("Explain the importance of international cooperation for developing nations", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Tanzania and regional organizations",
                        "code": "4.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("List the regional organizations Tanzania belongs to including EAC, SADC, and AU", "knowledge", 1),
                            ("Describe the objectives and functions of the East African Community", "comprehension", 2),
                            ("Analyse the benefits and challenges of Tanzania's membership in regional organizations", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Tanzania and international organizations",
                        "code": "4.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Identify major international organizations Tanzania works with including the UN and World Bank", "knowledge", 1),
                            ("Explain the role of the United Nations in promoting peace development and human rights", "comprehension", 2),
                            ("Discuss the impact of international aid and cooperation on Tanzania's development", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Challenges and prospects of international cooperation",
                        "code": "4.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Identify challenges facing international cooperation such as unequal power relations", "knowledge", 1),
                            ("Analyse the effects of conditionalities attached to international aid", "analysis", 2),
                            ("Evaluate Tanzania's role and contributions in regional and international cooperation forums", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "HEALTH AND SOCIAL WELFARE",
                "code": "1.0",
                "form_level": 4,
                "order": 18,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Public health challenges in Tanzania",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Identify major public health challenges facing Tanzania including HIV/AIDS and malaria", "knowledge", 1),
                            ("Describe how communicable and non-communicable diseases affect national development", "comprehension", 2),
                            ("Analyse the relationship between poverty, education, and health outcomes", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Government health policies and programmes",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("List key government health policies and programmes in Tanzania", "knowledge", 1),
                            ("Explain the role of the primary health services approach in improving health care", "comprehension", 2),
                            ("Evaluate the effectiveness of government health programmes in reducing disease burden", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Community participation in health promotion",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify ways communities can participate in health promotion activities", "knowledge", 1),
                            ("Describe the role of community health workers in primary health care delivery", "comprehension", 2),
                            ("Apply health education principles to promote healthy behaviours in the community", "application", 3)
                        ]
                    },
                    {
                        "title": "Social welfare and protection",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define social welfare and identify vulnerable groups in need of social protection", "knowledge", 1),
                            ("Explain government social welfare programmes for the elderly, orphans, and people with disabilities", "comprehension", 2),
                            ("Discuss the importance of social welfare in promoting equitable national development", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "CITIZENSHIP AND NATIONAL DEVELOPMENT",
                "code": "2.0",
                "form_level": 4,
                "order": 19,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and types of citizenship",
                        "code": "2.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define citizenship and distinguish between different types of citizenship", "knowledge", 1),
                            ("Explain the ways of acquiring citizenship in Tanzania by birth descent and naturalization", "comprehension", 2),
                            ("Analyse the rights and obligations of citizens in a democratic state", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Citizenship and national development",
                        "code": "2.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the roles of citizens in promoting national economic development", "comprehension", 1),
                            ("Explain how civic participation contributes to good governance and accountability", "application", 2),
                            ("Discuss the importance of patriotism and national service in building the nation", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Challenges to active citizenship",
                        "code": "2.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Identify obstacles to active civic participation in Tanzania", "knowledge", 1),
                            ("Analyse the effects of political apathy, corruption, and illiteracy on citizenship", "analysis", 2),
                            ("Evaluate strategies for promoting active and responsible citizenship", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Youth and national development",
                        "code": "2.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("State the role of youth in national development and nation building", "knowledge", 1),
                            ("Describe how youth empowerment programmes contribute to economic growth", "comprehension", 2),
                            ("Propose ways for young people to actively participate in community and national development", "synthesis", 3)
                        ]
                    }
                ]
            }
        ]
    },
    {
        "name": "Bible Knowledge",
        "code": "BK",
        "slug": "bible-knowledge",
        "necta_code": "016",
        "is_core": True,
        "description": "Bible Knowledge covers the study of the Old and New Testaments for Tanzanian O-Level (Form I-IV) and A-Level (Form V-VI) students, exploring the life and teachings of Jesus Christ, Old Testament narratives, prophetic literature, epistles, Christian ethics, and the growth of the Church.",
        "form_start": 1,
        "form_end": 6,
        "topics": [
            {
                "title": "THE CREATION AND FALL OF MAN",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Creation Accounts in Genesis",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("State the two creation accounts in Genesis 1 and 2", "knowledge", 1),
                            ("Compare and contrast the order of creation in both accounts", "analysis", 2),
                            ("Explain the significance of God resting on the seventh day", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Nature and Role of Human Beings",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe how God created human beings in His own image", "knowledge", 1),
                            ("Explain the concept of dominion given to humankind over creation", "comprehension", 2),
                            ("Discuss the relationship between man and woman in the Garden of Eden", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Temptation and Fall",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Narrate the story of the temptation of Adam and Eve", "knowledge", 1),
                            ("Analyse the consequences of disobedience to God's command", "analysis", 2),
                            ("Apply the lessons of the Fall to contemporary moral choices", "application", 3),
                        ],
                    },
                    {
                        "title": "God's Covenant with Noah",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Recall the events leading to the great flood", "knowledge", 1),
                            ("Explain the meaning of God's covenant sign of the rainbow", "comprehension", 2),
                            ("Evaluate the significance of the Noahic covenant for all humanity", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE PATRIARCHAL AGE",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Call of Abraham",
                        "code": "2.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("State the reasons for God's call of Abraham from Ur", "knowledge", 1),
                            ("Describe Abraham's journey of faith to Canaan", "knowledge", 2),
                            ("Explain the promises God made to Abraham", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Sacrifice of Isaac",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Narrate the story of the binding of Isaac on Mount Moriah", "knowledge", 1),
                            ("Analyse Abraham's faith and obedience in the test", "analysis", 2),
                            ("Discuss the theological significance of this event for Christian faith", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Jacob and Esau",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the birthright and blessing narratives of Jacob and Esau", "knowledge", 1),
                            ("Analyse the causes and effects of the rivalry between the twins", "analysis", 2),
                            ("Explain Jacob's encounter at Peniel and his name change to Israel", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Joseph in Egypt",
                        "code": "2.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Trace Joseph's journey from favourite son to Egyptian official", "knowledge", 1),
                            ("Explain how God used Joseph's suffering for a greater purpose", "comprehension", 2),
                            ("Apply the theme of forgiveness in Joseph's reconciliation with his brothers", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE LIFE OF MOSES I",
                "code": "1.0",
                "form_level": 1,
                "order": 3,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Birth and Early Life of Moses",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Narrate the story of Moses' birth and rescue from the Nile", "knowledge", 1),
                            ("Describe Moses' upbringing in the Egyptian royal court", "knowledge", 2),
                            ("Explain the circumstances that led Moses to flee to Midian", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Burning Bush and God's Call",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe Moses' encounter with God at the burning bush", "knowledge", 1),
                            ("Explain the meaning of 'I AM WHO I AM'", "comprehension", 2),
                            ("Discuss the reasons for Moses' reluctance to accept God's call", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Plagues of Egypt",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("List the ten plagues sent upon Egypt", "knowledge", 1),
                            ("Analyse the purpose of each plague in demonstrating God's power", "analysis", 2),
                            ("Explain the theological significance of the Passover institution", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Crossing of the Red Sea",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the events leading to the crossing of the Red Sea", "knowledge", 1),
                            ("Explain the Israelites' response of praise and worship after deliverance", "comprehension", 2),
                            ("Evaluate the Red Sea event as a type of salvation in Christian theology", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE LIFE OF MOSES II",
                "code": "2.0",
                "form_level": 1,
                "order": 4,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "The Journey to Mount Sinai",
                        "code": "2.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the wilderness journey from Egypt to Sinai", "knowledge", 1),
                            ("Explain the significance of the manna and quail provision", "comprehension", 2),
                            ("Analyse the grumbling of the Israelites and God's response", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Giving of the Law at Sinai",
                        "code": "2.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("State the Ten Commandments as given in Exodus 20", "knowledge", 1),
                            ("Explain the two tablets of the covenant and their significance", "comprehension", 2),
                            ("Apply the Ten Commandments to modern Christian ethical living", "application", 3),
                        ],
                    },
                    {
                        "title": "The Golden Calf Incident",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Narrate the story of the golden calf and Moses' intercession", "knowledge", 1),
                            ("Analyse the nature of the Israelites' sin of idolatry", "analysis", 2),
                            ("Discuss the consequences and God's renewed mercy towards His people", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Tabernacle and Worship",
                        "code": "2.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the construction and layout of the Tabernacle", "knowledge", 1),
                            ("Explain the role of the priests and the sacrificial system", "comprehension", 2),
                            ("Synthesise the connection between the Tabernacle and Christian worship", "synthesis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE CONQUEST AND SETTLEMENT OF CANAAN",
                "code": "3.0",
                "form_level": 1,
                "order": 5,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Joshua's Leadership and the Fall of Jericho",
                        "code": "3.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Describe Joshua's appointment as successor to Moses", "knowledge", 1),
                            ("Narrate the conquest of Jericho including the role of Rahab", "knowledge", 2),
                            ("Explain the religious significance of the conquest for Israel's faith", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Division of the Promised Land",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe how the land was divided among the twelve tribes", "knowledge", 1),
                            ("Analyse the challenges of settlement and coexistence with other peoples", "analysis", 2),
                            ("Discuss the importance of faithfulness to God in the new land", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Judges of Israel",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify major judges such as Deborah, Gideon, and Samson", "knowledge", 1),
                            ("Explain the cycle of sin, oppression, repentance, and deliverance", "comprehension", 2),
                            ("Apply the lessons of the Judges period to leadership today", "application", 3),
                        ],
                    },
                    {
                        "title": "Ruth the Moabite",
                        "code": "3.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Narrate the story of Ruth and Naomi", "knowledge", 1),
                            ("Analyse Ruth's loyalty and its rewards", "analysis", 2),
                            ("Explain Ruth's significance in the genealogy of Jesus Christ", "comprehension", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE LIFE AND MINISTRY OF JESUS CHRIST I",
                "code": "1.0",
                "form_level": 2,
                "order": 6,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Birth and Early Life of Jesus",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the annunciation to Mary and the birth of Jesus in Bethlehem", "knowledge", 1),
                            ("Explain the visits of the shepherds and the wise men", "comprehension", 2),
                            ("Discuss the significance of the virgin birth for Christian doctrine", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Baptism and Temptation of Jesus",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Narrate the baptism of Jesus by John the Baptist", "knowledge", 1),
                            ("Explain the three temptations of Jesus in the wilderness", "comprehension", 2),
                            ("Analyse how Jesus overcame temptation through Scripture", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Call of the Disciples",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify the twelve apostles called by Jesus", "knowledge", 1),
                            ("Describe the circumstances of the call of Peter, Andrew, James, and John", "knowledge", 2),
                            ("Explain the meaning of Jesus' call to follow Him for all believers", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Sermon on the Mount",
                        "code": "1.4",
                        "order": 4,
                        "periods": 7,
                        "outcomes": [
                            ("Recall the Beatitudes as recorded in Matthew 5", "knowledge", 1),
                            ("Explain Jesus' teachings on love, prayer, and fasting", "comprehension", 2),
                            ("Apply the principles of the Sermon on the Mount to daily life", "application", 3),
                            ("Analyse the contrast between Jesus' teaching and the Pharisaic interpretation", "analysis", 4),
                        ],
                    },
                ],
            },
            {
                "title": "THE LIFE AND MINISTRY OF JESUS CHRIST II",
                "code": "2.0",
                "form_level": 2,
                "order": 7,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Miracles of Jesus",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Classify Jesus' miracles into categories of healing, nature, and exorcism", "knowledge", 1),
                            ("Describe specific miracles such as the calming of the storm and feeding of thousands", "knowledge", 2),
                            ("Analyse the purpose and theological meaning of Jesus' miracles", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Parables of Jesus",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Narrate parables such as the Sower, the Prodigal Son, and the Good Samaritan", "knowledge", 1),
                            ("Explain the central message of each parable studied", "comprehension", 2),
                            ("Interpret the meaning of parables in their first-century Jewish context", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Teachings on the Kingdom of God",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe how Jesus taught about the Kingdom of God through words and deeds", "knowledge", 1),
                            ("Explain the present and future dimensions of the Kingdom", "comprehension", 2),
                            ("Discuss how the Kingdom of God challenges human values and expectations", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Conflicts with Religious Leaders",
                        "code": "2.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Identify the main areas of conflict between Jesus and the Pharisees", "knowledge", 1),
                            ("Analyse the dispute over Sabbath observance and tradition", "analysis", 2),
                            ("Evaluate the significance of Jesus' authority over the Law", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE PASSION, DEATH AND RESURRECTION OF JESUS",
                "code": "3.0",
                "form_level": 2,
                "order": 8,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Triumphal Entry and Last Supper",
                        "code": "3.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Describe Jesus' entry into Jerusalem on Palm Sunday", "knowledge", 1),
                            ("Explain the events and teachings at the Last Supper", "comprehension", 2),
                            ("Discuss the institution of the Eucharist and its meaning", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Arrest and Trial of Jesus",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Narrate the events in Gethsemane and the arrest of Jesus", "knowledge", 1),
                            ("Describe the trials before the Sanhedrin and Pilate", "knowledge", 2),
                            ("Analyse the injustice of the trials and the response of Jesus", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Crucifixion and Death of Jesus",
                        "code": "3.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the events of the crucifixion as recorded in the Gospels", "knowledge", 1),
                            ("Explain the sayings of Jesus from the cross", "comprehension", 2),
                            ("Discuss the theological significance of the atonement through Christ's death", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Resurrection and Ascension",
                        "code": "3.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the discovery of the empty tomb and post-resurrection appearances", "knowledge", 1),
                            ("Explain the evidence for the resurrection of Jesus", "comprehension", 2),
                            ("Evaluate the importance of the resurrection for Christian faith and hope", "evaluation", 3),
                            ("Synthesise the link between the resurrection and the ascension of Jesus", "synthesis", 4),
                        ],
                    },
                ],
            },
            {
                "title": "THE ACTS OF THE APOSTLES I",
                "code": "1.0",
                "form_level": 2,
                "order": 9,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Coming of the Holy Spirit at Pentecost",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the events of the Day of Pentecost in Acts 2", "knowledge", 1),
                            ("Explain the role and gifts of the Holy Spirit in the early Church", "comprehension", 2),
                            ("Discuss the significance of Pentecost for the birth of the Christian Church", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Early Church in Jerusalem",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the life and practices of the first Christian community", "knowledge", 1),
                            ("Analyse the unity and sharing among the early believers", "analysis", 2),
                            ("Explain the challenges faced by the early Church from Jewish authorities", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Stephen the First Martyr",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Narrate the story of Stephen's ministry, trial, and martyrdom", "knowledge", 1),
                            ("Analyse Stephen's speech before the Sanhedrin", "analysis", 2),
                            ("Discuss the impact of Stephen's death on the spread of the Gospel", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Conversion of Saul",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Describe Saul's conversion experience on the road to Damascus", "knowledge", 1),
                            ("Explain the significance of Paul's conversion for the Christian mission", "comprehension", 2),
                            ("Synthesise the connection between Paul's background and his apostolic calling", "synthesis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE ACTS OF THE APOSTLES II",
                "code": "2.0",
                "form_level": 2,
                "order": 10,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Paul's Missionary Journeys",
                        "code": "2.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Trace the route and key events of Paul's three missionary journeys", "knowledge", 1),
                            ("Describe the establishment of churches in various cities", "knowledge", 2),
                            ("Analyse the methods Paul used to spread the Gospel", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Council of Jerusalem",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the issue debated at the Council of Jerusalem in Acts 15", "knowledge", 1),
                            ("Explain the decision reached regarding Gentile converts", "comprehension", 2),
                            ("Evaluate the significance of this decision for the universality of Christianity", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Paul's Voyage and Arrival in Rome",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Narrate the events of Paul's voyage to Rome as recorded in Acts 27-28", "knowledge", 1),
                            ("Analyse Paul's leadership and courage during the shipwreck", "analysis", 2),
                            ("Explain the significance of Paul preaching in Rome", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Growth and Spread of Early Christianity",
                        "code": "2.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Identify the factors that contributed to the growth of the early Church", "knowledge", 1),
                            ("Discuss the challenges of persecution and internal conflict", "evaluation", 2),
                            ("Synthesise how the early Church model influences modern Christian communities", "synthesis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "CHRISTIAN WORSHIP AND SACRAMENTS",
                "code": "3.0",
                "form_level": 2,
                "order": 11,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Introduction to Christian Worship",
                        "code": "3.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define worship and distinguish between public and private worship", "knowledge", 1),
                            ("Describe the elements of a Christian worship service", "knowledge", 2),
                            ("Explain the importance of worship in the life of a Christian", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Sacraments of Baptism and Eucharist",
                        "code": "3.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the biblical basis and practice of Christian baptism", "knowledge", 1),
                            ("Explain the meaning and significance of the Holy Communion", "comprehension", 2),
                            ("Compare different Christian views on the sacraments", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Prayer in Christian Life",
                        "code": "3.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Identify types of prayer including praise, confession, thanksgiving, and intercession", "knowledge", 1),
                            ("Explain Jesus' teaching on prayer including the Lord's Prayer", "comprehension", 2),
                            ("Apply the principles of prayer in personal and communal Christian life", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "OLD TESTAMENT PROPHETS I",
                "code": "1.0",
                "form_level": 3,
                "order": 12,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Call and Role of the Prophets",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define the role of prophets in ancient Israel", "knowledge", 1),
                            ("Distinguish between writing and non-writing prophets", "knowledge", 2),
                            ("Explain the concept of prophetic call narratives in the Old Testament", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Book of Isaiah",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Identify the major themes in the book of Isaiah", "knowledge", 1),
                            ("Analyse the Messianic prophecies in Isaiah 7, 9, and 53", "analysis", 2),
                            ("Discuss the social justice message of Isaiah", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Book of Jeremiah",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Describe Jeremiah's call and his suffering as a prophet", "knowledge", 1),
                            ("Explain Jeremiah's message of judgment and hope", "comprehension", 2),
                            ("Analyse the concept of the New Covenant in Jeremiah 31", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Book of Lamentations",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the historical background of the destruction of Jerusalem", "knowledge", 1),
                            ("Analyse the themes of grief, suffering, and hope in Lamentations", "analysis", 2),
                            ("Discuss the relevance of Lamentations to human suffering and faith", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "OLD TESTAMENT PROPHETS II",
                "code": "2.0",
                "form_level": 3,
                "order": 13,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Book of Amos",
                        "code": "2.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the background and social conditions during Amos' ministry", "knowledge", 1),
                            ("Analyse Amos' message of justice and righteousness", "analysis", 2),
                            ("Explain the visions of Amos and their meaning", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Book of Hosea",
                        "code": "2.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Narrate the story of Hosea and Gomer as a symbol of God's love", "knowledge", 1),
                            ("Explain the theme of God's faithful love for unfaithful Israel", "comprehension", 2),
                            ("Discuss the relevance of Hosea's message to Christian understanding of grace", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Book of Ezekiel",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe Ezekiel's call and his symbolic acts", "knowledge", 1),
                            ("Explain the vision of the valley of dry bones", "comprehension", 2),
                            ("Analyse the theme of restoration in Ezekiel's prophecy", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Book of Daniel",
                        "code": "2.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Narrate the stories of Daniel and his friends in Babylon", "knowledge", 1),
                            ("Explain Daniel's apocalyptic visions and their symbolic meaning", "comprehension", 2),
                            ("Discuss faithfulness to God in the face of persecution", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE PSALMS AND WISDOM LITERATURE",
                "code": "3.0",
                "form_level": 3,
                "order": 14,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Introduction to the Psalms",
                        "code": "3.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Classify the Psalms into types such as praise, lament, thanksgiving, and wisdom", "knowledge", 1),
                            ("Recite and explain the meaning of selected Psalms (e.g. Psalm 23, 51, 139)", "comprehension", 2),
                            ("Discuss how the Psalms are used in Christian worship and personal devotion", "application", 3),
                        ],
                    },
                    {
                        "title": "The Book of Proverbs",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Identify the major themes in the book of Proverbs", "knowledge", 1),
                            ("Explain the concept of wisdom as presented in Proverbs", "comprehension", 2),
                            ("Apply selected proverbs to everyday moral decision-making", "application", 3),
                        ],
                    },
                    {
                        "title": "The Book of Job",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Summarise the narrative of Job and his suffering", "knowledge", 1),
                            ("Analyse the arguments of Job's friends and Job's response", "analysis", 2),
                            ("Discuss the theme of innocent suffering and God's sovereignty in Job", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Ecclesiastes and the Song of Solomon",
                        "code": "3.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the main message of Ecclesiastes on the meaning of life", "knowledge", 1),
                            ("Explain the theme of 'vanity' and the search for purpose", "comprehension", 2),
                            ("Discuss the Song of Solomon as a celebration of love and fidelity", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE SYNOPTIC GOSPELS",
                "code": "4.0",
                "form_level": 3,
                "order": 15,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Introduction to the Synoptic Problem",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define the Synoptic Gospels and explain the term 'synoptic'", "knowledge", 1),
                            ("Describe the relationships between Matthew, Mark, and Luke", "comprehension", 2),
                            ("Analyse the evidence for the priority of Mark's Gospel", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Comparative Study of Selected Passages",
                        "code": "4.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Compare parallel passages from the three Synoptic Gospels", "analysis", 1),
                            ("Identify similarities and differences in the accounts", "analysis", 2),
                            ("Explain how each Gospel writer presents Jesus for a particular audience", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "The Gospel of Matthew",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify the unique features and themes of Matthew's Gospel", "knowledge", 1),
                            ("Explain Matthew's portrayal of Jesus as the fulfilment of Old Testament prophecy", "comprehension", 2),
                            ("Discuss Matthew's emphasis on the kingdom of heaven and discipleship", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Gospel of Luke",
                        "code": "4.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Identify the unique features and themes of Luke's Gospel", "knowledge", 1),
                            ("Explain Luke's emphasis on compassion for the poor, women, and outcasts", "comprehension", 2),
                            ("Analyse the parables unique to Luke such as the Good Samaritan and the Prodigal Son", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "CHRISTIAN ETHICS AND MORAL TEACHING",
                "code": "5.0",
                "form_level": 3,
                "order": 16,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Biblical Foundations of Christian Ethics",
                        "code": "5.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Identify key ethical teachings of Jesus in the Gospels", "knowledge", 1),
                            ("Explain the principle of love as the basis of Christian morality", "comprehension", 2),
                            ("Apply the Sermon on the Mount principles to contemporary ethical dilemmas", "application", 3),
                        ],
                    },
                    {
                        "title": "Christian Teaching on Social Issues",
                        "code": "5.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("State the Christian position on issues such as poverty, corruption, and injustice", "knowledge", 1),
                            ("Analyse how biblical teaching addresses contemporary social problems", "analysis", 2),
                            ("Evaluate the role of the Church in promoting social justice", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Christian Teaching on Marriage and Family",
                        "code": "5.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the biblical teaching on marriage and family life", "knowledge", 1),
                            ("Explain the roles and responsibilities within the Christian family", "comprehension", 2),
                            ("Discuss challenges to Christian family values in modern society", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Environmental Stewardship",
                        "code": "5.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Identify biblical teachings on human responsibility for creation", "knowledge", 1),
                            ("Explain the concept of stewardship in Genesis and the Psalms", "comprehension", 2),
                            ("Apply Christian environmental ethics to current ecological challenges", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE GOSPEL OF JOHN",
                "code": "1.0",
                "form_level": 3,
                "order": 17,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Prologue and the Divinity of Christ",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse the Prologue of John's Gospel (John 1:1-18)", "analysis", 1),
                            ("Explain the concept of the Word (Logos) made flesh", "comprehension", 2),
                            ("Discuss how John presents Jesus as divine from the opening of his Gospel", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Signs and 'I Am' Statements",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Identify the seven signs performed by Jesus in John's Gospel", "knowledge", 1),
                            ("Explain the meaning of the 'I Am' statements (e.g. Bread of Life, Light of the World)", "comprehension", 2),
                            ("Analyse the relationship between the signs and the 'I Am' declarations", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Farewell Discourse",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe Jesus' teachings to his disciples in John 14-17", "knowledge", 1),
                            ("Explain the promise of the Holy Spirit as the Comforter", "comprehension", 2),
                            ("Discuss Jesus' high priestly prayer and its themes of unity and love", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Passion and Resurrection in John",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Compare John's account of the Passion with the Synoptic Gospels", "analysis", 1),
                            ("Explain the unique details in John's resurrection narrative", "comprehension", 2),
                            ("Discuss the restoration of Peter in John 21 and its significance", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "OLD TESTAMENT HISTORICAL BOOKS",
                "code": "2.0",
                "form_level": 3,
                "order": 18,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "The United Monarchy: Saul, David, and Solomon",
                        "code": "2.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the establishment of the monarchy in Israel under Samuel", "knowledge", 1),
                            ("Analyse the reigns of Saul, David, and Solomon", "analysis", 2),
                            ("Discuss the rise and fall of the united kingdom", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Divided Kingdom",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Explain the causes of the division into northern and southern kingdoms", "comprehension", 1),
                            ("Identify key events and rulers in Judah and Israel", "knowledge", 2),
                            ("Analyse the role of prophets in the divided kingdom", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Exile and Return",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the fall of the northern kingdom (722 BCE) and southern kingdom (586 BCE)", "knowledge", 1),
                            ("Explain the experience of exile in Babylon and its impact on faith", "comprehension", 2),
                            ("Discuss the rebuilding of the Temple and the restoration of the community", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Book of Ezra-Nehemiah",
                        "code": "2.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Narrate the return from exile and the rebuilding efforts", "knowledge", 1),
                            ("Explain Nehemiah's work in rebuilding the walls of Jerusalem", "comprehension", 2),
                            ("Apply the theme of spiritual renewal in Ezra-Nehemiah to the Church today", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "OLD TESTAMENT STUDIES",
                "code": "1.0",
                "form_level": 4,
                "order": 19,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Pentateuch: Authorship and Composition",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the traditional and modern views on the authorship of the Pentateuch", "knowledge", 1),
                            ("Explain the Documentary Hypothesis (JEDP theory)", "comprehension", 2),
                            ("Analyse the strengths and weaknesses of different theories of Pentateuchal composition", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Covenant Theology in the Old Testament",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Identify the major covenants in the Old Testament (Noahic, Abrahamic, Mosaic, Davidic)", "knowledge", 1),
                            ("Explain the structure and content of the Sinai covenant", "comprehension", 2),
                            ("Synthesise the relationship between the various covenants in salvation history", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "Law and Sacrifice in Ancient Israel",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Classify the different types of law in the Pentateuch", "knowledge", 1),
                            ("Explain the sacrificial system and the Day of Atonement", "comprehension", 2),
                            ("Discuss the relevance of the sacrificial system to Christian theology of atonement", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Themes of Election and Mission",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define the concept of election in the Old Testament", "knowledge", 1),
                            ("Explain Israel's calling to be a light to the nations", "comprehension", 2),
                            ("Analyse the universal scope of God's plan as seen in Old Testament texts", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE PAULINE EPISTLES I",
                "code": "2.0",
                "form_level": 4,
                "order": 20,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Introduction to Pauline Theology",
                        "code": "2.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Identify the letters attributed to Paul and their contexts", "knowledge", 1),
                            ("Explain the major themes of Pauline theology", "comprehension", 2),
                            ("Discuss the significance of Paul's letters for Christian doctrine", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Epistle to the Romans",
                        "code": "2.2",
                        "order": 2,
                        "periods": 7,
                        "outcomes": [
                            ("Outline the structure and main argument of Romans", "knowledge", 1),
                            ("Explain Paul's teaching on justification by faith", "comprehension", 2),
                            ("Analyse the relationship between grace, faith, and works in Romans", "analysis", 3),
                            ("Discuss the practical implications of Romans for Christian living", "evaluation", 4),
                        ],
                    },
                    {
                        "title": "The Epistle to the Galatians",
                        "code": "2.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the occasion and purpose of Paul's letter to the Galatians", "knowledge", 1),
                            ("Explain Paul's argument against circumcision and legalism", "comprehension", 2),
                            ("Analyse the contrast between law and grace in Galatians", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Epistle to the Philippians",
                        "code": "2.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Identify the key themes of joy, humility, and unity in Philippians", "knowledge", 1),
                            ("Explain the Christ Hymn in Philippians 2:5-11", "comprehension", 2),
                            ("Apply the teaching on Christian humility and service to contemporary life", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE GOSPEL OF JOHN AND JOHANNINE LITERATURE",
                "code": "3.0",
                "form_level": 4,
                "order": 21,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Theology and Theme of John's Gospel",
                        "code": "3.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Identify the major theological themes of John's Gospel", "knowledge", 1),
                            ("Explain the dualism of light and darkness, truth and falsehood", "comprehension", 2),
                            ("Analyse John's Christology and presentation of Jesus as the Son of God", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Johannine Epistles",
                        "code": "3.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the occasion and purpose of 1, 2, and 3 John", "knowledge", 1),
                            ("Explain John's teaching on love, truth, and fellowship", "comprehension", 2),
                            ("Analyse the warnings against false teaching in the Johannine Epistles", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Book of Revelation",
                        "code": "3.3",
                        "order": 3,
                        "periods": 7,
                        "outcomes": [
                            ("Describe the historical context and literary form of the Apocalypse", "knowledge", 1),
                            ("Explain the main symbols and visions in Revelation", "comprehension", 2),
                            ("Discuss the themes of judgment, hope, and the final victory of God", "evaluation", 3),
                            ("Synthesise the relevance of Revelation for Christian faith and perseverance", "synthesis", 4),
                        ],
                    },
                ],
            },
            {
                "title": "THE PAULINE EPISTLES",
                "code": "4.0",
                "form_level": 4,
                "order": 22,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "1 Corinthians: Order and Discipline",
                        "code": "4.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Identify the main issues Paul addressed in 1 Corinthians", "knowledge", 1),
                            ("Explain Paul's teaching on spiritual gifts, love, and the resurrection", "comprehension", 2),
                            ("Apply 1 Corinthians 13 and 15 to contemporary Christian life", "application", 3),
                        ],
                    },
                    {
                        "title": "2 Corinthians: Suffering and Comfort",
                        "code": "4.2",
                        "order": 2,
                        "periods": 3,
                        "outcomes": [
                            ("Describe the circumstances behind 2 Corinthians", "knowledge", 1),
                            ("Explain Paul's theology of suffering and divine comfort", "comprehension", 2),
                            ("Discuss Paul's defence of his apostolic ministry", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Ephesians: The Church as the Body of Christ",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify the key themes of Ephesians including unity, grace, and the armour of God", "knowledge", 1),
                            ("Explain the metaphor of the Church as the body and bride of Christ", "comprehension", 2),
                            ("Analyse the practical ethical instructions in Ephesians 4-6", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Colossians and Philemon",
                        "code": "4.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the context and content of the Epistle to the Colossians", "knowledge", 1),
                            ("Explain Paul's teaching on the supremacy of Christ in Colossians", "comprehension", 2),
                            ("Discuss Paul's appeal for Onesimus in the letter to Philemon", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "CHRISTIAN ETHICS IN MODERN SOCIETY",
                "code": "5.0",
                "form_level": 4,
                "order": 23,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Biblical Principles for Moral Decision-Making",
                        "code": "5.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Identify biblical sources for ethical decision-making in the Old and New Testaments", "knowledge", 1),
                            ("Explain the role of conscience, Scripture, and the Holy Spirit in moral discernment", "comprehension", 2),
                            ("Apply biblical ethical principles to real-life moral dilemmas", "application", 3),
                        ],
                    },
                    {
                        "title": "Christian Perspectives on Governance and Leadership",
                        "code": "5.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe biblical teachings on authority, obedience, and civic responsibility", "knowledge", 1),
                            ("Explain the Christian understanding of servant leadership", "comprehension", 2),
                            ("Evaluate the role of the Church in promoting good governance in Tanzania", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Christianity and Science",
                        "code": "5.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify different Christian responses to scientific discoveries", "knowledge", 1),
                            ("Discuss the relationship between faith and reason", "evaluation", 2),
                            ("Synthesise a Christian worldview that engages with modern scientific thought", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "Christianity and Other Religions",
                        "code": "5.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the major world religions and their core beliefs", "knowledge", 1),
                            ("Explain the Christian understanding of salvation and its exclusivity or inclusivity", "comprehension", 2),
                            ("Discuss Christian approaches to interfaith dialogue and coexistence", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE PENTATEUCH IN DEPTH",
                "code": "1.0",
                "form_level": 5,
                "order": 24,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Critical Study of Genesis 1-11",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Analyse the structure and literary features of the primeval history", "analysis", 1),
                            ("Compare the creation and flood narratives with Ancient Near Eastern parallels", "analysis", 2),
                            ("Evaluate the theological messages of Genesis 1-11 for Israel and the Church", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Abrahamic Narratives: Faith and Promise",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse the theology of election in the call of Abraham", "analysis", 1),
                            ("Examine the testing of Abraham's faith in the binding of Isaac", "analysis", 2),
                            ("Synthesise the Abrahamic promises and their fulfilment throughout Scripture", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "The Sinai Covenant: Law and Theology",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Analyse the treaty form of the Sinai covenant in its Ancient Near Eastern context", "analysis", 1),
                            ("Evaluate the ethical, ceremonial, and civil dimensions of the Mosaic Law", "evaluation", 2),
                            ("Discuss the relationship between the Old and New Covenants theologically", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "The Holiness Code (Leviticus 17-26)",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Identify the key laws and themes of the Holiness Code", "knowledge", 1),
                            ("Explain the concept of holiness as central to Israelite identity", "comprehension", 2),
                            ("Analyse the ethical and ritual laws and their social implications", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE HISTORICAL BOOKS: KINGS AND CHRONICLES",
                "code": "2.0",
                "form_level": 5,
                "order": 25,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "The United and Divided Monarchy in Kings",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Analyse the Deuteronomistic evaluation of the kings of Israel and Judah", "analysis", 1),
                            ("Discuss the theological interpretation of the rise and fall of the monarchy", "evaluation", 2),
                            ("Compare the portrayal of Solomon in Kings and Chronicles", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Elijah and Elisha Narratives",
                        "code": "2.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse the miracles and prophetic actions of Elijah and Elisha", "analysis", 1),
                            ("Explain the conflict between Yahwism and Baalism in the narratives", "comprehension", 2),
                            ("Evaluate the themes of power, faith, and divine sovereignty", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Chronicler's Perspective",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Compare the Chronicler's presentation of David and Solomon with Samuel-Kings", "analysis", 1),
                            ("Explain the Chronicler's emphasis on Temple worship and restoration", "comprehension", 2),
                            ("Discuss the post-exilic theology of the Chronicler", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Exile and Restoration in Historical Narrative",
                        "code": "2.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Synthesise the theological significance of the exile across historical books", "synthesis", 1),
                            ("Evaluate the themes of judgment, mercy, and hope in the restoration accounts", "evaluation", 2),
                            ("Discuss the relevance of the exile-experience for diaspora communities", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE SYNOPTIC PROBLEM AND CHRISTOLOGY",
                "code": "3.0",
                "form_level": 5,
                "order": 26,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Synoptic Problem: Methods and Solutions",
                        "code": "3.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Analyse the evidence for the Two-Source and Farrer hypotheses", "analysis", 1),
                            ("Compare different scholarly approaches to the Synoptic problem", "analysis", 2),
                            ("Evaluate the strengths and weaknesses of current solutions", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Christology in the Synoptic Gospels",
                        "code": "3.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse how each Synoptic evangelist presents the identity of Jesus", "analysis", 1),
                            ("Discuss the titles applied to Jesus (Son of Man, Son of God, Messiah)", "comprehension", 2),
                            ("Synthesise the christological development across the three Gospels", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "Mark's Gospel: Passion Narrative and Christology",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Analyse the structure and theology of Mark's passion narrative", "analysis", 1),
                            ("Discuss the 'messianic secret' motif in Mark", "evaluation", 2),
                            ("Examine the ending of Mark (16:1-8) and its interpretive challenges", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Matthew's Gospel: Community and Ethics",
                        "code": "3.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse the five discourses of Matthew and their structural significance", "analysis", 1),
                            ("Discuss Matthew's portrayal of Jesus as the new Moses and teacher", "comprehension", 2),
                            ("Evaluate Matthew's ecclesiology and vision of the Christian community", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE PAULINE EPISTLES: THEOLOGY AND CONTEXT",
                "code": "4.0",
                "form_level": 5,
                "order": 27,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Paul's World and Mission",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Analyse the social, religious, and political context of Paul's ministry", "analysis", 1),
                            ("Discuss Paul's conversion experience and its impact on his theology", "evaluation", 2),
                            ("Synthesise the relationship between Paul's missionary activity and his letters", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "Theology of Romans",
                        "code": "4.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Analyse Paul's argument on universal sin and human accountability", "analysis", 1),
                            ("Discuss justification by faith apart from works of the law", "comprehension", 2),
                            ("Evaluate the implications of Romans for Jewish-Gentile relations", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Pauline Ethics and the Household Codes",
                        "code": "4.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Identify the ethical instructions in Colossians 3 and Ephesians 5-6", "knowledge", 1),
                            ("Analyse the household codes (Haustafeln) in their Greco-Roman context", "analysis", 2),
                            ("Evaluate the transformative and conservative elements of Pauline ethics", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Pastorals and Pauline Legacy",
                        "code": "4.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Discuss the authorship and purpose of 1 Timothy, 2 Timothy, and Titus", "evaluation", 1),
                            ("Analyse the ecclesiology and ethics of the Pastoral Epistles", "analysis", 2),
                            ("Synthesise Paul's influence on the development of early Christian ministry", "synthesis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "OLD TESTAMENT POETRY AND WISDOM",
                "code": "5.0",
                "form_level": 5,
                "order": 28,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Critical Study of the Psalms",
                        "code": "5.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse the classification, structure, and poetry of the Psalms", "analysis", 1),
                            ("Discuss the historical and cultic background of Israelite psalmody", "evaluation", 2),
                            ("Interpret selected Psalms using literary and theological methods", "analysis", 3),
                        ],
                    },
                    {
                        "title": "The Book of Job: Suffering and Theodicy",
                        "code": "5.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse the structure of Job (prose frame and poetic dialogues)", "analysis", 1),
                            ("Evaluate the theodicy arguments of Job's friends and Elihu", "evaluation", 2),
                            ("Discuss God's speech from the whirlwind and its theological significance", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Ecclesiastes and the Search for Meaning",
                        "code": "5.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Analyse the philosophical and theological themes of Ecclesiastes", "analysis", 1),
                            ("Discuss the concept of 'hebel' (vanity/meaninglessness)", "comprehension", 2),
                            ("Evaluate Ecclesiastes' contribution to Old Testament wisdom and faith", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "OLD TESTAMENT PROPHETIC LITERATURE: ADVANCED",
                "code": "1.0",
                "form_level": 6,
                "order": 29,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Isaiah: Deutero-Isaiah and Trito-Isaiah",
                        "code": "1.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Analyse the divisions of the book of Isaiah and the arguments for multiple authorship", "analysis", 1),
                            ("Discuss the Servant Songs and their christological interpretation", "evaluation", 2),
                            ("Synthesise the themes of judgment and restoration across all three sections", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "The Twelve Minor Prophets",
                        "code": "1.2",
                        "order": 2,
                        "periods": 7,
                        "outcomes": [
                            ("Analyse the historical context and message of Hosea, Amos, and Micah", "analysis", 1),
                            ("Evaluate the social justice themes in the prophetic literature", "evaluation", 2),
                            ("Discuss the eschatological hope in Joel, Zechariah, and Malachi", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Ezekiel and Apocalyptic Literature",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse the symbolism and visions in Ezekiel's prophecy", "analysis", 1),
                            ("Discuss the themes of divine glory, judgment, and renewal in Ezekiel", "comprehension", 2),
                            ("Synthesise the connection between Ezekiel and later apocalyptic literature", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "Daniel and Apocalyptic Thought",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Analyse the narrative and apocalyptic sections of Daniel", "analysis", 1),
                            ("Discuss the historical-critical issues surrounding the book of Daniel", "evaluation", 2),
                            ("Evaluate the influence of Daniel on New Testament and early Christian apocalypticism", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "THE JOHANNINE LITERATURE: ADVANCED STUDY",
                "code": "2.0",
                "form_level": 6,
                "order": 30,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Composition and Theology of John's Gospel",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Analyse the composition history and community behind John's Gospel", "analysis", 1),
                            ("Discuss the distinctive Johannine vocabulary and theological concepts", "comprehension", 2),
                            ("Evaluate the relationship between John and the Synoptic Gospels", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Johannine Christology and Soteriology",
                        "code": "2.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse the 'I Am' discourse theology and its roots in Exodus 3", "analysis", 1),
                            ("Discuss the Johannine presentation of eternal life and belief", "comprehension", 2),
                            ("Synthesise the soteriological views in John with those of the Synoptics and Paul", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "The Johannine Epistles: Community and Conflict",
                        "code": "2.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse the situation of the Johannine community reflected in 1-3 John", "analysis", 1),
                            ("Discuss the ethical and relational tests of true faith in 1 John", "comprehension", 2),
                            ("Evaluate the Christological and ethical implications of the secession crisis", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "The Book of Revelation: Interpretation and Relevance",
                        "code": "2.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Analyse the major interpretive approaches (preterist, historicist, futurist, idealist)", "analysis", 1),
                            ("Discuss the political and theological context of Revelation", "evaluation", 2),
                            ("Synthesise the relevance of Revelation for Christian hope and resistance", "synthesis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "AFRICAN CHRISTIANITY AND INCULTURATION",
                "code": "3.0",
                "form_level": 6,
                "order": 31,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "The History of Christianity in Africa",
                        "code": "3.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Trace the spread of Christianity from the early Church to modern Africa", "knowledge", 1),
                            ("Discuss the impact of colonialism and missionary activity on African Christianity", "evaluation", 2),
                            ("Analyse the growth of indigenous African Christian movements", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Inculturation and African Theology",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Define inculturation and explain its significance for African Christianity", "comprehension", 1),
                            ("Discuss the challenges of contextualising the Gospel in African cultures", "evaluation", 2),
                            ("Analyse key African theologians and their contributions", "analysis", 3),
                        ],
                    },
                    {
                        "title": "African Initiated Churches",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify major African Initiated Churches and their characteristics", "knowledge", 1),
                            ("Explain the theological and social reasons for the rise of AICs", "comprehension", 2),
                            ("Evaluate the role of AICs in African society and mission", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Christianity in Tanzania Today",
                        "code": "3.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the denominational landscape and ecumenical movement in Tanzania", "knowledge", 1),
                            ("Discuss the role of the Church in education, health, and development", "comprehension", 2),
                            ("Analyse contemporary challenges facing Christianity in Tanzania", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "PAULINE THEOLOGY: ADVANCED THEMES",
                "code": "4.0",
                "form_level": 6,
                "order": 32,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Justification and the New Perspective on Paul",
                        "code": "4.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse the traditional Reformed reading of Paul on justification", "analysis", 1),
                            ("Discuss the New Perspective on Paul (Sanders, Dunn, Wright)", "comprehension", 2),
                            ("Evaluate the implications of the New Perspective for Protestant theology", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Paul's Ecclesiology",
                        "code": "4.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse Paul's metaphor of the Church as the body of Christ", "analysis", 1),
                            ("Discuss the issues of unity, diversity, and spiritual gifts in Pauline churches", "comprehension", 2),
                            ("Synthesise Paul's ecclesiology with modern ecumenical concerns", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "Paul and the Law",
                        "code": "4.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Analyse Paul's varying statements about the Mosaic Law across his letters", "analysis", 1),
                            ("Discuss the relationship between Torah observance and Gentile inclusion", "comprehension", 2),
                            ("Evaluate scholarly debates on Paul's view of the Law", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Paul's Eschatology",
                        "code": "4.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Analyse Paul's teaching on the resurrection of the body and the second coming", "analysis", 1),
                            ("Discuss the 'already but not yet' tension in Pauline eschatology", "comprehension", 2),
                            ("Evaluate the ethical implications of Paul's eschatological hope", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "RESEARCH AND INTERPRETATION IN BIBLE KNOWLEDGE",
                "code": "5.0",
                "form_level": 6,
                "order": 33,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Methods of Biblical Interpretation",
                        "code": "5.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Identify major hermeneutical methods (historical-critical, literary, theological)", "knowledge", 1),
                            ("Analyse the strengths and limitations of each interpretive approach", "analysis", 2),
                            ("Apply appropriate hermeneutical methods to a biblical text", "application", 3),
                        ],
                    },
                    {
                        "title": "Introduction to Exegesis",
                        "code": "5.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the steps of exegetical method (observation, interpretation, application)", "knowledge", 1),
                            ("Analyse a selected biblical passage using exegetical tools", "analysis", 2),
                            ("Synthesise exegetical findings into a coherent interpretation", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "Writing a Research Essay in Bible Knowledge",
                        "code": "5.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Identify the structure and requirements of a biblical research essay", "knowledge", 1),
                            ("Apply academic writing conventions including proper citation", "application", 2),
                            ("Evaluate the quality of biblical scholarship using critical criteria", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Biblical Theology and its Relevance",
                        "code": "5.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Define biblical theology and distinguish it from systematic theology", "knowledge", 1),
                            ("Discuss the unity and diversity of the biblical canon", "evaluation", 2),
                            ("Synthesise a holistic understanding of the biblical narrative from creation to new creation", "synthesis", 3),
                        ],
                    },
                ],
            },
        ],
    },
    {
        "name": "Economics",
        "code": "ECO",
        "slug": "economics",
        "necta_code": "017",
        "is_core": False,
        "description": "A-Level Economics for Forms V and VI covering microeconomic and macroeconomic principles, national income, trade, public finance, and development planning in the Tanzanian context.",
        "form_start": 5,
        "form_end": 6,
        "topics": [
            {
                "title": "INTRODUCTION TO ECONOMICS",
                "code": "1.0",
                "form_level": 5,
                "order": 1,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Definition and Scope of Economics",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define Economics as a social science", "knowledge", 1),
                            ("Distinguish between microeconomics and macroeconomics", "comprehension", 2),
                            ("Explain the relevance of Economics to everyday life", "application", 3)
                        ]
                    },
                    {
                        "title": "Basic Economic Problems",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Identify the fundamental economic problem of scarcity", "knowledge", 1),
                            ("Explain how scarcity forces individuals and societies to make choices", "comprehension", 2),
                            ("Apply the concept of opportunity cost to real-life decisions", "application", 3),
                            ("Analyse trade-offs faced by a developing country like Tanzania", "analysis", 4)
                        ]
                    },
                    {
                        "title": "Factors of Production",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("List the four factors of production and their rewards", "knowledge", 1),
                            ("Explain the roles of land, labour, capital and entrepreneurship", "comprehension", 2),
                            ("Apply the concept of factors of production to a local business", "application", 3)
                        ]
                    },
                    {
                        "title": "Economic Systems",
                        "code": "1.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the main features of traditional, command, market and mixed economies", "knowledge", 1),
                            ("Compare the advantages and disadvantages of different economic systems", "analysis", 2),
                            ("Evaluate the suitability of the mixed economic system for Tanzania", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "The Production Possibility Frontier",
                        "code": "1.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Define and draw a production possibility frontier", "knowledge", 1),
                            ("Explain the concept of efficiency using the PPF", "comprehension", 2),
                            ("Analyse shifts in the PPF caused by economic growth", "analysis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "DEMAND AND SUPPLY",
                "code": "2.0",
                "form_level": 5,
                "order": 2,
                "periods": 28,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Concept of Demand",
                        "code": "2.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define demand and state the law of demand", "knowledge", 1),
                            ("Distinguish between quantity demanded and change in demand", "comprehension", 2),
                            ("Identify the determinants of demand", "knowledge", 3)
                        ]
                    },
                    {
                        "title": "The Demand Curve and Its Shifts",
                        "code": "2.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Draw and explain a demand curve", "knowledge", 1),
                            ("Distinguish between movement along and shift of the demand curve", "comprehension", 2),
                            ("Analyse the effects of income changes on demand in Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "The Concept of Supply",
                        "code": "2.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define supply and state the law of supply", "knowledge", 1),
                            ("Explain the determinants of supply", "comprehension", 2),
                            ("Apply supply analysis to agricultural products in Tanzania", "application", 3)
                        ]
                    },
                    {
                        "title": "Market Equilibrium",
                        "code": "2.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Define equilibrium price and quantity", "knowledge", 1),
                            ("Explain how equilibrium is established through market forces", "comprehension", 2),
                            ("Analyse the effects of government price controls on market equilibrium", "analysis", 3),
                            ("Evaluate the impact of price ceilings on consumers and producers", "evaluation", 4)
                        ]
                    },
                    {
                        "title": "Government Intervention in Markets",
                        "code": "2.5",
                        "order": 5,
                        "periods": 7,
                        "outcomes": [
                            ("Describe types of government intervention including taxes, subsidies and price controls", "knowledge", 1),
                            ("Analyse the effects of taxation on supply and demand", "analysis", 2),
                            ("Evaluate the effectiveness of subsidies in promoting food security", "evaluation", 3),
                            ("Synthesise policy recommendations for stabilising maize prices in Tanzania", "synthesis", 4)
                        ]
                    }
                ]
            },
            {
                "title": "ELASTICITY OF DEMAND AND SUPPLY",
                "code": "3.0",
                "form_level": 5,
                "order": 3,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Price Elasticity of Demand",
                        "code": "3.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define price elasticity of demand and state its formula", "knowledge", 1),
                            ("Calculate PED using given data", "application", 2),
                            ("Explain the factors affecting PED", "comprehension", 3)
                        ]
                    },
                    {
                        "title": "Types of Price Elasticity of Demand",
                        "code": "3.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Classify PED as elastic, inelastic or unitary", "knowledge", 1),
                            ("Interpret PED values for different commodities", "comprehension", 2),
                            ("Analyse PED for necessities versus luxuries in Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Other Types of Elasticity",
                        "code": "3.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define income elasticity and cross elasticity of demand", "knowledge", 1),
                            ("Calculate YED and XED from given data", "application", 2),
                            ("Apply elasticity concepts to business pricing decisions", "application", 3)
                        ]
                    },
                    {
                        "title": "Elasticity of Supply",
                        "code": "3.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Define and calculate price elasticity of supply", "knowledge", 1),
                            ("Explain the determinants of PES", "comprehension", 2),
                            ("Analyse why agricultural supply is inelastic in Tanzania", "analysis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "THEORY OF PRODUCTION",
                "code": "4.0",
                "form_level": 5,
                "order": 4,
                "periods": 22,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Concept of Production",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define production and distinguish between production and productivity", "knowledge", 1),
                            ("Explain the meaning of output, input and efficiency in production", "comprehension", 2)
                        ]
                    },
                    {
                        "title": "The Production Function",
                        "code": "4.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("State the law of diminishing marginal returns", "knowledge", 1),
                            ("Explain the three stages of production using diagrams", "comprehension", 2),
                            ("Analyse the relationship between variable inputs and output", "analysis", 3),
                            ("Apply the production function to a manufacturing firm", "application", 4)
                        ]
                    },
                    {
                        "title": "Returns to Scale",
                        "code": "4.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Define increasing, constant and decreasing returns to scale", "knowledge", 1),
                            ("Distinguish between returns to a factor and returns to scale", "comprehension", 2),
                            ("Analyse how returns to scale affect firm expansion decisions", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Optimal Combination of Factors",
                        "code": "4.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Define the isoquant and isocost line", "knowledge", 1),
                            ("Explain the condition for producer equilibrium", "comprehension", 2),
                            ("Apply isoquant analysis to factor substitution decisions", "application", 3)
                        ]
                    }
                ]
            },
            {
                "title": "COST OF PRODUCTION AND REVENUE",
                "code": "5.0",
                "form_level": 5,
                "order": 5,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Concepts of Cost",
                        "code": "5.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define total cost, fixed cost and variable cost", "knowledge", 1),
                            ("Distinguish between explicit and implicit costs", "comprehension", 2),
                            ("Calculate total cost, average cost and marginal cost from given data", "application", 3)
                        ]
                    },
                    {
                        "title": "Short-Run Cost Curves",
                        "code": "5.2",
                        "order": 2,
                        "periods": 7,
                        "outcomes": [
                            ("Draw and label short-run cost curves", "knowledge", 1),
                            ("Explain the relationship between marginal cost and average cost", "comprehension", 2),
                            ("Analyse the U-shape of average cost curves", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Long-Run Cost Curves",
                        "code": "5.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define economies, diseconomies and constant returns to scale in cost terms", "knowledge", 1),
                            ("Explain the derivation of the long-run average cost curve", "comprehension", 2),
                            ("Analyse how economies of scale influence firm size in Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Revenue Concepts",
                        "code": "5.4",
                        "order": 4,
                        "periods": 7,
                        "outcomes": [
                            ("Define total revenue, average revenue and marginal revenue", "knowledge", 1),
                            ("Calculate TR, AR and MR from demand schedules", "application", 2),
                            ("Analyse the relationship between revenue and elasticity of demand", "analysis", 3),
                            ("Evaluate profit maximisation as the primary objective of firms", "evaluation", 4)
                        ]
                    }
                ]
            },
            {
                "title": "MARKET STRUCTURES",
                "code": "6.0",
                "form_level": 5,
                "order": 6,
                "periods": 26,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Perfect Competition",
                        "code": "6.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("State the characteristics of perfect competition", "knowledge", 1),
                            ("Explain price determination under perfect competition", "comprehension", 2),
                            ("Analyse short-run and long-run equilibrium of a perfectly competitive firm", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Monopoly",
                        "code": "6.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Define monopoly and identify its sources", "knowledge", 1),
                            ("Explain how a monopolist determines price and output", "comprehension", 2),
                            ("Analyse the welfare effects of monopoly on consumers", "analysis", 3),
                            ("Evaluate government regulation of monopolies in Tanzania", "evaluation", 4)
                        ]
                    },
                    {
                        "title": "Monopolistic Competition",
                        "code": "6.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the features of monopolistic competition", "knowledge", 1),
                            ("Compare monopolistic competition with perfect competition", "analysis", 2),
                            ("Apply the concept to the Tanzanian retail sector", "application", 3)
                        ]
                    },
                    {
                        "title": "Oligopoly",
                        "code": "6.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Define oligopoly and identify its key characteristics", "knowledge", 1),
                            ("Explain price rigidity in oligopolistic markets", "comprehension", 2),
                            ("Analyse the kinked demand curve model", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Market Failures and Government Response",
                        "code": "6.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Define market failure and identify its causes", "knowledge", 1),
                            ("Explain externalities and public goods as sources of market failure", "comprehension", 2),
                            ("Synthesise appropriate government policies to correct market failures", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "NATIONAL INCOME ACCOUNTING",
                "code": "7.0",
                "form_level": 5,
                "order": 7,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Concepts of National Income",
                        "code": "7.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define GDP, GNP, NNP and national income", "knowledge", 1),
                            ("Distinguish between nominal and real GDP", "comprehension", 2),
                            ("Explain the difference between market prices and factor cost", "comprehension", 3)
                        ]
                    },
                    {
                        "title": "Methods of Measuring National Income",
                        "code": "7.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the output, income and expenditure approaches", "knowledge", 1),
                            ("Calculate national income using the three methods from given data", "application", 2),
                            ("Analyse the limitations of national income as a welfare measure", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Uses and Problems of National Income Data",
                        "code": "7.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("List uses of national income statistics", "knowledge", 1),
                            ("Explain the problems of measuring national income in developing countries", "comprehension", 2),
                            ("Evaluate the reliability of Tanzania's national income data", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "The Circular Flow of Income",
                        "code": "7.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Draw the two-sector circular flow model", "knowledge", 1),
                            ("Explain injections and leakages in the circular flow", "comprehension", 2),
                            ("Analyse the effects of government, investment and foreign trade on the flow", "analysis", 3)
                        ]
                    },
                    {
                        "title": "National Income and Living Standards",
                        "code": "7.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Define GDP per capita and Purchasing Power Parity", "knowledge", 1),
                            ("Compare living standards using per capita income", "application", 2),
                            ("Evaluate the limitations of GDP per capita in measuring welfare", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "MONEY AND BANKING",
                "code": "8.0",
                "form_level": 5,
                "order": 8,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The Concept of Money",
                        "code": "8.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define money and state its functions", "knowledge", 1),
                            ("Explain the characteristics of good money", "comprehension", 2),
                            ("Trace the evolution of money from barter to digital currencies", "comprehension", 3)
                        ]
                    },
                    {
                        "title": "Demand and Supply of Money",
                        "code": "8.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the theories of demand for money", "knowledge", 1),
                            ("Explain the determinants of money supply", "comprehension", 2),
                            ("Analyse how the Bank of Tanzania controls money supply", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Commercial Banking",
                        "code": "8.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the functions of commercial banks", "knowledge", 1),
                            ("Explain the process of credit creation by commercial banks", "comprehension", 2),
                            ("Calculate the credit multiplier from given reserve ratios", "application", 3)
                        ]
                    },
                    {
                        "title": "Central Banking and Monetary Policy",
                        "code": "8.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Define central banking and list the functions of the Bank of Tanzania", "knowledge", 1),
                            ("Explain the instruments of monetary policy", "comprehension", 2),
                            ("Analyse the effectiveness of monetary policy in controlling inflation", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Financial Inclusion in Tanzania",
                        "code": "8.5",
                        "order": 5,
                        "periods": 3,
                        "outcomes": [
                            ("Define financial inclusion and identify barriers to banking in Tanzania", "knowledge", 1),
                            ("Evaluate the role of mobile money in promoting financial inclusion", "evaluation", 2)
                        ]
                    }
                ]
            },
            {
                "title": "INFLATION AND DEFLATION",
                "code": "9.0",
                "form_level": 5,
                "order": 9,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Concept of Inflation",
                        "code": "9.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define inflation, deflation and disinflation", "knowledge", 1),
                            ("Distinguish between demand-pull and cost-push inflation", "comprehension", 2),
                            ("Calculate the consumer price index and inflation rate", "application", 3)
                        ]
                    },
                    {
                        "title": "Causes of Inflation",
                        "code": "9.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Explain the demand-pull theory of inflation", "comprehension", 1),
                            ("Explain the cost-push theory of inflation", "comprehension", 2),
                            ("Analyse causes of inflation in the Tanzanian economy", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Effects and Control of Inflation",
                        "code": "9.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the effects of inflation on different groups in society", "knowledge", 1),
                            ("Analyse the effects of inflation on savings and investment", "analysis", 2),
                            ("Evaluate monetary and fiscal measures to control inflation", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Deflation and Its Effects",
                        "code": "9.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define deflation and explain its causes", "knowledge", 1),
                            ("Analyse the effects of deflation on employment and output", "analysis", 2),
                            ("Synthesise appropriate policy responses to deflation", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "INTERNATIONAL TRADE",
                "code": "10.0",
                "form_level": 5,
                "order": 10,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Basis for International Trade",
                        "code": "10.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define international trade and distinguish it from domestic trade", "knowledge", 1),
                            ("Explain the theories of absolute and comparative advantage", "comprehension", 2),
                            ("Apply the theory of comparative advantage to trade between Tanzania and other countries", "application", 3)
                        ]
                    },
                    {
                        "title": "Terms of Trade",
                        "code": "10.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Define terms of trade and state its formula", "knowledge", 1),
                            ("Calculate terms of trade from given data", "application", 2),
                            ("Analyse factors affecting Tanzania's terms of trade", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Arguments for Trade Protection",
                        "code": "10.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Describe methods of trade protection including tariffs, quotas and subsidies", "knowledge", 1),
                            ("Explain the arguments for and against trade protection", "comprehension", 2),
                            ("Evaluate the impact of trade protection on Tanzanian consumers and producers", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Balance of Payments",
                        "code": "10.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Define balance of payments and describe its components", "knowledge", 1),
                            ("Distinguish between the current account and capital account", "comprehension", 2),
                            ("Analyse the causes and consequences of balance of payments deficits", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Trade in Tanzania",
                        "code": "10.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Identify Tanzania's major trading partners and commodities", "knowledge", 1),
                            ("Explain the role of exports in Tanzania's economic development", "comprehension", 2),
                            ("Evaluate government policies to promote exports", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "PUBLIC FINANCE",
                "code": "11.0",
                "form_level": 5,
                "order": 11,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Government Revenue",
                        "code": "11.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("List sources of government revenue including taxes, fees and loans", "knowledge", 1),
                            ("Distinguish between direct and indirect taxes", "comprehension", 2),
                            ("Analyse the principles of a good taxation system", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Government Expenditure",
                        "code": "11.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Classify government expenditure into recurrent and development", "knowledge", 1),
                            ("Explain the functions of government in an economy", "comprehension", 2),
                            ("Apply public expenditure concepts to the Tanzanian national budget", "application", 3)
                        ]
                    },
                    {
                        "title": "The National Budget",
                        "code": "11.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Define the budget and describe the budget-making process", "knowledge", 1),
                            ("Distinguish between deficit and surplus budgets", "comprehension", 2),
                            ("Evaluate the impact of budget deficits on the economy", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Public Debt",
                        "code": "11.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define public debt and distinguish between internal and external debt", "knowledge", 1),
                            ("Explain the causes and consequences of public debt", "comprehension", 2),
                            ("Analyse the debt burden on the Tanzanian economy", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Fiscal Policy",
                        "code": "11.5",
                        "order": 5,
                        "periods": 3,
                        "outcomes": [
                            ("Define fiscal policy and its objectives", "knowledge", 1),
                            ("Explain how fiscal policy is used to achieve economic stability", "comprehension", 2),
                            ("Evaluate the effectiveness of fiscal policy in Tanzania", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "ECONOMIC DEVELOPMENT AND PLANNING",
                "code": "12.0",
                "form_level": 5,
                "order": 12,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Concepts of Development",
                        "code": "12.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define economic development and distinguish it from economic growth", "knowledge", 1),
                            ("Explain indicators of economic development", "comprehension", 2),
                            ("Apply the Human Development Index to compare Tanzania with other countries", "application", 3)
                        ]
                    },
                    {
                        "title": "Obstacles to Economic Development",
                        "code": "12.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List internal and external obstacles to development", "knowledge", 1),
                            ("Explain how poverty, low savings and low investment hinder development", "comprehension", 2),
                            ("Analyse the role of colonialism in underdevelopment", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Economic Planning",
                        "code": "12.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define economic planning and state its objectives", "knowledge", 1),
                            ("Explain the methods of economic planning including indicative and directive planning", "comprehension", 2),
                            ("Evaluate the effectiveness of economic planning in Tanzania", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Strategies for Economic Development",
                        "code": "12.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Describe import substitution and export promotion strategies", "knowledge", 1),
                            ("Analyse the Big Push theory and balanced versus unbalanced growth", "analysis", 2),
                            ("Synthesise appropriate development strategies for Tanzania", "synthesis", 3),
                            ("Evaluate the role of the private sector in economic development", "evaluation", 4)
                        ]
                    }
                ]
            },
            {
                "title": "POPULATION AND LABOUR",
                "code": "1.0",
                "form_level": 6,
                "order": 13,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Population Theories",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("State the Malthusian and demographic transition theories", "knowledge", 1),
                            ("Explain the relationship between population growth and food supply in the Malthusian theory", "comprehension", 2),
                            ("Analyse the applicability of the Malthusian theory to Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Population Characteristics of Tanzania",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the size, growth rate and distribution of Tanzania's population", "knowledge", 1),
                            ("Explain the demographic characteristics of the Tanzanian population", "comprehension", 2),
                            ("Apply population data to identify development challenges", "application", 3)
                        ]
                    },
                    {
                        "title": "Migration",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Distinguish between internal and international migration", "knowledge", 1),
                            ("Explain the push and pull factors of migration", "comprehension", 2),
                            ("Analyse the effects of rural-urban migration on the Tanzanian economy", "analysis", 3)
                        ]
                    },
                    {
                        "title": "The Labour Market",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define labour force, employment and unemployment", "knowledge", 1),
                            ("Explain the types and causes of unemployment", "comprehension", 2),
                            ("Evaluate government policies to reduce unemployment in Tanzania", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Human Capital Development",
                        "code": "1.5",
                        "order": 5,
                        "periods": 3,
                        "outcomes": [
                            ("Define human capital and explain its importance", "knowledge", 1),
                            ("Analyse the role of education and health in human capital formation", "analysis", 2),
                            ("Evaluate Tanzania's investment in human capital development", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "AGRICULTURE IN TANZANIA",
                "code": "2.0",
                "form_level": 6,
                "order": 14,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Role of Agriculture in the Economy",
                        "code": "2.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the contribution of agriculture to GDP and employment", "knowledge", 1),
                            ("Explain the role of agriculture in food security and raw materials supply", "comprehension", 2)
                        ]
                    },
                    {
                        "title": "Types of Farming in Tanzania",
                        "code": "2.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Distinguish between subsistence and commercial farming", "knowledge", 1),
                            ("Explain the characteristics of smallholder and large-scale farming", "comprehension", 2),
                            ("Analyse the advantages and disadvantages of each farming type", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Problems Facing Agriculture",
                        "code": "2.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("List the major problems facing agriculture in Tanzania", "knowledge", 1),
                            ("Explain the effects of limited technology and infrastructure on agricultural output", "comprehension", 2),
                            ("Analyse the impact of climate change on agricultural production", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Government Agricultural Policies",
                        "code": "2.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Describe government interventions in agriculture including pricing and marketing", "knowledge", 1),
                            ("Evaluate the performance of agricultural parastatals in Tanzania", "evaluation", 2),
                            ("Synthesise recommendations for improving agricultural productivity", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Agricultural Cooperatives and Marketing",
                        "code": "2.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Define cooperatives and explain their role in agriculture", "knowledge", 1),
                            ("Explain cooperative marketing and its advantages", "comprehension", 2),
                            ("Evaluate the challenges facing agricultural cooperatives in Tanzania", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "INDUSTRIALISATION IN TANZANIA",
                "code": "3.0",
                "form_level": 6,
                "order": 15,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and Types of Industry",
                        "code": "3.1",
                        "order": 1,
                        "periods": 3,
                        "outcomes": [
                            ("Define industry and classify industries by size and product type", "knowledge", 1),
                            ("Distinguish between primary, secondary and tertiary industries", "comprehension", 2)
                        ]
                    },
                    {
                        "title": "Location of Industry",
                        "code": "3.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("List the factors affecting industrial location", "knowledge", 1),
                            ("Explain how proximity to raw materials and markets influences location", "comprehension", 2),
                            ("Analyse industrial location patterns in Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Problems of Industrialisation",
                        "code": "3.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Identify the major obstacles to industrialisation in Tanzania", "knowledge", 1),
                            ("Explain the effects of limited capital and technology on industrial growth", "comprehension", 2),
                            ("Analyse the impact of inadequate infrastructure on industrial development", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Industrialisation Strategies",
                        "code": "3.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Describe import substitution and export-oriented industrialisation", "knowledge", 1),
                            ("Evaluate the effectiveness of industrialisation strategies in Tanzania", "evaluation", 2)
                        ]
                    },
                    {
                        "title": "Small and Medium Enterprises",
                        "code": "3.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Define SMEs and state their importance in the economy", "knowledge", 1),
                            ("Explain the challenges facing SMEs in Tanzania", "comprehension", 2),
                            ("Evaluate government support programmes for SMEs", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "NATIONAL DEVELOPMENT PLANS",
                "code": "4.0",
                "form_level": 6,
                "order": 16,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Overview of National Development Planning",
                        "code": "4.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the history of economic planning in Tanzania from independence", "knowledge", 1),
                            ("Explain the objectives and machinery of national development planning", "comprehension", 2)
                        ]
                    },
                    {
                        "title": "Major Development Plans",
                        "code": "4.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Outline the key features of Ujamaa and villagisation policies", "knowledge", 1),
                            ("Explain the Structural Adjustment Programmes and their effects", "comprehension", 2),
                            ("Analyse the performance of the Tanzania Development Vision 2025", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Five-Year Development Plans",
                        "code": "4.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the objectives and priorities of recent five-year plans", "knowledge", 1),
                            ("Evaluate the achievements and failures of the First and Second Five-Year Plans", "evaluation", 2),
                            ("Analyse the role of the private sector in development planning", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Challenges of Development Planning",
                        "code": "4.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("List the major challenges facing development planning in Tanzania", "knowledge", 1),
                            ("Explain the effects of corruption and poor implementation on plans", "comprehension", 2),
                            ("Synthesise measures to improve the effectiveness of development plans", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "FOREIGN INVESTMENT AND AID",
                "code": "5.0",
                "form_level": 6,
                "order": 17,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Foreign Direct Investment",
                        "code": "5.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define FDI and distinguish between different types of foreign investment", "knowledge", 1),
                            ("Explain the motives of multinational corporations", "comprehension", 2),
                            ("Analyse the impact of FDI on the Tanzanian economy", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Foreign Aid",
                        "code": "5.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Define foreign aid and classify its types including bilateral and multilateral", "knowledge", 1),
                            ("Explain the objectives of providing and receiving aid", "comprehension", 2),
                            ("Analyse the advantages and disadvantages of foreign aid to Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Debt Relief and Aid Effectiveness",
                        "code": "5.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe major debt relief initiatives including HIPC and MDRI", "knowledge", 1),
                            ("Evaluate the impact of debt relief on Tanzania's economic development", "evaluation", 2)
                        ]
                    },
                    {
                        "title": "Role of International Organisations",
                        "code": "5.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Identify the roles of the IMF, World Bank and African Development Bank", "knowledge", 1),
                            ("Explain the conditionality attached to loans from international organisations", "comprehension", 2),
                            ("Evaluate the impact of IMF and World Bank programmes on Tanzania", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "BALANCE OF PAYMENTS AND EXCHANGE RATE",
                "code": "6.0",
                "form_level": 6,
                "order": 18,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Components of Balance of Payments",
                        "code": "6.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the structure of the balance of payments", "knowledge", 1),
                            ("Distinguish between the current account, capital account and financial account", "comprehension", 2),
                            ("Construct a simplified balance of payments statement", "application", 3)
                        ]
                    },
                    {
                        "title": "Balance of Payments Disequilibrium",
                        "code": "6.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Define surplus and deficit in the balance of payments", "knowledge", 1),
                            ("Explain the causes of persistent balance of payments deficits", "comprehension", 2),
                            ("Analyse the effects of BOP deficits on the Tanzanian shilling", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Exchange Rate Systems",
                        "code": "6.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Distinguish between fixed and floating exchange rate systems", "knowledge", 1),
                            ("Explain how exchange rates are determined under each system", "comprehension", 2),
                            ("Analyse the factors causing depreciation and appreciation of the Tanzanian shilling", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Exchange Rate Policies and Trade",
                        "code": "6.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Describe government interventions in the foreign exchange market", "knowledge", 1),
                            ("Explain the effects of exchange rate fluctuations on imports and exports", "comprehension", 2),
                            ("Evaluate the managed float exchange rate regime in Tanzania", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Foreign Exchange Management",
                        "code": "6.5",
                        "order": 5,
                        "periods": 3,
                        "outcomes": [
                            ("Define foreign exchange reserves and their importance", "knowledge", 1),
                            ("Analyse the role of the Bank of Tanzania in managing foreign exchange", "analysis", 2)
                        ]
                    }
                ]
            },
            {
                "title": "TRADE UNIONS AND EMPLOYERS ORGANISATIONS",
                "code": "7.0",
                "form_level": 6,
                "order": 19,
                "periods": 14,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "Trade Unions",
                        "code": "7.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define trade unions and explain their functions", "knowledge", 1),
                            ("Describe the methods used by trade unions including collective bargaining and strikes", "comprehension", 2)
                        ]
                    },
                    {
                        "title": "Employers Organisations",
                        "code": "7.2",
                        "order": 2,
                        "periods": 3,
                        "outcomes": [
                            ("Define employers organisations and state their roles", "knowledge", 1),
                            ("Explain the relationship between trade unions and employers organisations", "comprehension", 2)
                        ]
                    },
                    {
                        "title": "Industrial Disputes and Resolution",
                        "code": "7.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Define industrial disputes and classify their types", "knowledge", 1),
                            ("Explain the machinery for resolving industrial disputes in Tanzania", "comprehension", 2),
                            ("Evaluate the effectiveness of the Employment and Labour Relations Act", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Wages and Working Conditions",
                        "code": "7.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Define minimum wage and explain its determination in Tanzania", "knowledge", 1),
                            ("Analyse the effects of minimum wage legislation on employment", "analysis", 2)
                        ]
                    }
                ]
            },
            {
                "title": "CONSUMER PROTECTION AND PRICE CONTROL",
                "code": "8.0",
                "form_level": 6,
                "order": 20,
                "periods": 14,
                "weight": "low",
                "subtopics": [
                    {
                        "title": "Consumer Rights and Protection",
                        "code": "8.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define consumer protection and state the rights of consumers", "knowledge", 1),
                            ("Explain the Consumer, Competition and Regulatory Commission and its role", "comprehension", 2),
                            ("Analyse the effects of unfair trade practices on consumers", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Consumer Protection Legislation",
                        "code": "8.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the key provisions of consumer protection laws in Tanzania", "knowledge", 1),
                            ("Evaluate the enforcement of consumer protection legislation", "evaluation", 2)
                        ]
                    },
                    {
                        "title": "Price Control Mechanisms",
                        "code": "8.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Define price control and distinguish between price ceilings and price floors", "knowledge", 1),
                            ("Explain the reasons for government price control", "comprehension", 2)
                        ]
                    },
                    {
                        "title": "Effects of Price Control",
                        "code": "8.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Analyse the effects of price ceilings on shortages and black markets", "analysis", 1),
                            ("Evaluate the effectiveness of price control as a tool of economic policy in Tanzania", "evaluation", 2)
                        ]
                    }
                ]
            },
            {
                "title": "EAST AFRICAN COMMUNITY AND REGIONAL INTEGRATION",
                "code": "9.0",
                "form_level": 6,
                "order": 21,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Concepts of Regional Integration",
                        "code": "9.1",
                        "order": 1,
                        "periods": 3,
                        "outcomes": [
                            ("Define regional economic integration and state its levels", "knowledge", 1),
                            ("Explain the objectives of regional economic integration", "comprehension", 2)
                        ]
                    },
                    {
                        "title": "The East African Community",
                        "code": "9.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the history and structure of the EAC", "knowledge", 1),
                            ("Explain the institutions of the EAC and their functions", "comprehension", 2),
                            ("Analyse the achievements and challenges of the EAC", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Trade Liberalisation in the EAC",
                        "code": "9.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the Common External Tariff and customs union", "knowledge", 1),
                            ("Explain the effects of trade liberalisation on member states", "comprehension", 2),
                            ("Analyse the impact of the EAC on Tanzania's trade patterns", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Challenges of Regional Integration",
                        "code": "9.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("List the major challenges facing the EAC", "knowledge", 1),
                            ("Explain the effects of non-tariff barriers on intra-community trade", "comprehension", 2),
                            ("Evaluate the prospects for a common market and monetary union in the EAC", "evaluation", 3),
                            ("Synthesise policy measures to strengthen regional integration", "synthesis", 4)
                        ]
                    }
                ]
            },
            {
                "title": "GLOBALISATION AND THE TANZANIAN ECONOMY",
                "code": "10.0",
                "form_level": 6,
                "order": 22,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Concept of Globalisation",
                        "code": "10.1",
                        "order": 1,
                        "periods": 3,
                        "outcomes": [
                            ("Define globalisation and identify its key dimensions", "knowledge", 1),
                            ("Explain the drivers of globalisation including technology and trade liberalisation", "comprehension", 2)
                        ]
                    },
                    {
                        "title": "Effects of Globalisation on Tanzania",
                        "code": "10.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the positive effects of globalisation on the Tanzanian economy", "knowledge", 1),
                            ("Analyse the negative effects of globalisation on local industries", "analysis", 2),
                            ("Evaluate whether globalisation has benefited Tanzania overall", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Tanzania and the World Trade Organisation",
                        "code": "10.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe Tanzania's membership and obligations in the WTO", "knowledge", 1),
                            ("Explain the effects of WTO agreements on Tanzanian trade policy", "comprehension", 2),
                            ("Analyse the challenges faced by Tanzania in complying with WTO rules", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Managing Globalisation",
                        "code": "10.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Describe government policies to manage the effects of globalisation", "knowledge", 1),
                            ("Synthesise strategies for Tanzania to benefit from globalisation while minimising risks", "synthesis", 2)
                        ]
                    }
                ]
            }
        ]
    },
    {
        "name": "Basic Applied Mathematics",
        "code": "BAM",
        "slug": "basic-applied-mathematics",
        "necta_code": "018",
        "is_core": False,
        "description": "Applied mathematics for Tanzanian A-Level students covering algebra, calculus, matrices, statistics, probability, vectors, and real-world problem solving across Form V and Form VI.",
        "form_start": 5,
        "form_end": 6,
        "topics": [
            {
                "title": "SETS AND LOGIC",
                "code": "1.0",
                "form_level": 5,
                "order": 1,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Set notation and Venn diagrams",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define sets using roster and set-builder notation", "knowledge", 1),
                            ("Interpret Venn diagrams with up to three sets", "comprehension", 2),
                            ("Solve problems involving union, intersection and complement of sets", "application", 3),
                        ],
                    },
                    {
                        "title": "Laws of set algebra",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("State commutative, associative and distributive laws of sets", "knowledge", 1),
                            ("Verify set identities using Venn diagrams", "comprehension", 2),
                            ("Apply De Morgan's laws to simplify set expressions", "application", 3),
                        ],
                    },
                    {
                        "title": "Sets and subsets",
                        "code": "1.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Define universal set, empty set, subset and power set", "knowledge", 1),
                            ("Determine the number of elements in a power set", "application", 2),
                        ],
                    },
                    {
                        "title": "Introduction to logic",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define statement, truth value, negation, conjunction and disjunction", "knowledge", 1),
                            ("Construct truth tables for compound statements", "application", 2),
                            ("Determine the validity of logical arguments using truth tables", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "ALGEBRAIC EXPRESSIONS AND EQUATIONS",
                "code": "2.0",
                "form_level": 5,
                "order": 2,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Polynomials",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define polynomial, degree, coefficient and constant term", "knowledge", 1),
                            ("Perform addition, subtraction and multiplication of polynomials", "application", 2),
                            ("Divide polynomials using long division and synthetic division", "application", 3),
                        ],
                    },
                    {
                        "title": "Factor and remainder theorems",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("State the factor theorem and the remainder theorem", "knowledge", 1),
                            ("Use the factor theorem to factorise cubic polynomials", "application", 2),
                            ("Find unknown constants in polynomials given factors", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Partial fractions",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Resolve proper algebraic fractions into partial fractions", "application", 1),
                            ("Resolve fractions with repeated and quadratic factors", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Simultaneous equations",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Solve simultaneous linear equations in two unknowns", "application", 1),
                            ("Solve one linear and one quadratic equation simultaneously", "application", 2),
                            ("Interpret solutions of simultaneous equations graphically", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Inequalities",
                        "code": "1.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Solve linear inequalities in one variable", "application", 1),
                            ("Solve quadratic inequalities using sign diagrams", "application", 2),
                            ("Represent solutions of inequalities on a number line", "comprehension", 3),
                        ],
                    },
                ],
            },
            {
                "title": "FUNCTIONS AND RELATIONS",
                "code": "3.0",
                "form_level": 5,
                "order": 3,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Functions, domain and range",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define function, domain, codomain and range", "knowledge", 1),
                            ("Determine domain and range from equations, graphs and tables", "application", 2),
                            ("Classify relations as functions or non-functions", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Types of functions",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Identify linear, quadratic, polynomial, rational, exponential and logarithmic functions", "knowledge", 1),
                            ("Sketch graphs of standard functions", "application", 2),
                            ("Match real-world situations to appropriate function types", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Composite functions",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Form composite functions from two or more given functions", "application", 1),
                            ("Determine the domain of composite functions", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Inverse functions",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Determine whether a function is one-to-one using the horizontal line test", "comprehension", 1),
                            ("Find the inverse of a given function", "application", 2),
                            ("Sketch the graph of an inverse function as a reflection in y equals x", "application", 3),
                        ],
                    },
                    {
                        "title": "Transformations of graphs",
                        "code": "1.5",
                        "order": 5,
                        "periods": 2,
                        "outcomes": [
                            ("Describe translations, reflections and stretches of graphs", "comprehension", 1),
                            ("Apply transformations to sketch graphs of related functions", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "SEQUENCES AND SERIES",
                "code": "4.0",
                "form_level": 5,
                "order": 4,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Arithmetic progressions",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define arithmetic progression, first term and common difference", "knowledge", 1),
                            ("Derive and apply the formula for the nth term", "application", 2),
                            ("Derive and apply the formula for the sum of the first n terms", "application", 3),
                        ],
                    },
                    {
                        "title": "Geometric progressions",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Define geometric progression and common ratio", "knowledge", 1),
                            ("Find the nth term and the sum of the first n terms of a GP", "application", 2),
                            ("Determine convergence and find the sum to infinity of a GP", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Sigma notation and summation",
                        "code": "1.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Use sigma notation to express sums", "comprehension", 1),
                            ("Apply standard summation formulae", "application", 2),
                        ],
                    },
                    {
                        "title": "Applications of sequences and series",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Solve real-life problems involving arithmetic and geometric sequences", "application", 1),
                            ("Model compound interest and depreciation using geometric sequences", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "MATRICES AND DETERMINANTS",
                "code": "5.0",
                "form_level": 5,
                "order": 5,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Definition and types of matrices",
                        "code": "1.1",
                        "order": 1,
                        "periods": 3,
                        "outcomes": [
                            ("Define a matrix and classify matrices by order and type", "knowledge", 1),
                            ("Identify row, column, square, identity and zero matrices", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Operations on matrices",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Add, subtract and multiply matrices", "application", 1),
                            ("Multiply a matrix by a scalar", "application", 2),
                            ("Verify properties of matrix arithmetic such as associativity and distributivity", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Determinants of 2 by 2 and 3 by 3 matrices",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Calculate the determinant of a 2 by 2 matrix", "application", 1),
                            ("Calculate the determinant of a 3 by 3 matrix by cofactor expansion", "application", 2),
                            ("Use determinants to test for singular and non-singular matrices", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Inverse of a matrix",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Find the inverse of a 2 by 2 matrix using the adjoint method", "application", 1),
                            ("Find the inverse of a 3 by 3 matrix", "application", 2),
                            ("Use matrix inverses to solve systems of linear equations", "application", 3),
                        ],
                    },
                    {
                        "title": "Solving simultaneous equations using matrices",
                        "code": "1.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Express a system of linear equations in matrix form", "comprehension", 1),
                            ("Solve systems of up to three linear equations using the inverse matrix method", "application", 2),
                            ("Apply Cramer's rule to solve linear systems", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "COORDINATE GEOMETRY",
                "code": "6.0",
                "form_level": 5,
                "order": 6,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Straight line equations",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Derive the equation of a straight line given two points", "application", 1),
                            ("Find the equation of a line given slope and intercept", "application", 2),
                            ("Determine the angle between two intersecting lines", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Parallel and perpendicular lines",
                        "code": "1.2",
                        "order": 2,
                        "periods": 3,
                        "outcomes": [
                            ("State the condition for two lines to be parallel", "knowledge", 1),
                            ("Find the equation of a line parallel or perpendicular to a given line", "application", 2),
                        ],
                    },
                    {
                        "title": "Circles",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Write the equation of a circle in standard and general form", "application", 1),
                            ("Find the centre and radius of a circle from its equation", "application", 2),
                            ("Determine whether a line intersects, touches or misses a circle", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Equation of a parabola",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Define parabola as a locus of points equidistant from focus and directrix", "knowledge", 1),
                            ("Sketch a parabola and identify its vertex, focus and directrix", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Ellipse and hyperbola",
                        "code": "1.5",
                        "order": 5,
                        "periods": 3,
                        "outcomes": [
                            ("Write the standard equations of an ellipse and a hyperbola", "knowledge", 1),
                            ("Identify key features including vertices, foci and asymptotes", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "LIMITS AND DIFFERENTIATION",
                "code": "7.0",
                "form_level": 5,
                "order": 7,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Limits of functions",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define the limit of a function as x approaches a finite value", "knowledge", 1),
                            ("Evaluate limits of polynomial and rational functions", "application", 2),
                            ("Evaluate limits involving indeterminate forms", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Definition of the derivative",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("State the first principles definition of the derivative", "knowledge", 1),
                            ("Derive derivatives of simple functions from first principles", "application", 2),
                            ("Interpret the derivative as a gradient and as a rate of change", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Differentiation of standard functions",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Differentiate polynomials, trigonometric, exponential and logarithmic functions", "application", 1),
                            ("Apply the sum, difference and constant multiple rules", "application", 2),
                        ],
                    },
                    {
                        "title": "Product, quotient and chain rules",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Apply the product rule to differentiate products of functions", "application", 1),
                            ("Apply the quotient rule to differentiate ratios of functions", "application", 2),
                            ("Apply the chain rule to differentiate composite functions", "application", 3),
                        ],
                    },
                    {
                        "title": "Implicit and parametric differentiation",
                        "code": "1.5",
                        "order": 5,
                        "periods": 3,
                        "outcomes": [
                            ("Differentiate implicitly defined functions", "application", 1),
                            ("Differentiate parametrically defined functions", "application", 2),
                            ("Find dy by dx given parametric equations", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Higher derivatives",
                        "code": "1.6",
                        "order": 6,
                        "periods": 3,
                        "outcomes": [
                            ("Find second and higher order derivatives", "application", 1),
                            ("Interpret the second derivative as acceleration", "comprehension", 2),
                        ],
                    },
                ],
            },
            {
                "title": "APPLICATIONS OF DIFFERENTIATION",
                "code": "8.0",
                "form_level": 5,
                "order": 8,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Tangents and normals",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Find the equation of a tangent to a curve at a given point", "application", 1),
                            ("Find the equation of a normal to a curve at a given point", "application", 2),
                        ],
                    },
                    {
                        "title": "Increasing and decreasing functions",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Determine intervals where a function is increasing or decreasing using the first derivative", "application", 1),
                            ("Find stationary points and classify them as maxima, minima or points of inflection", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Curve sketching",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Sketch graphs of polynomial functions using intercepts and stationary points", "application", 1),
                            ("Identify asymptotes and concavity from the second derivative", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Optimization problems",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Formulate real-world problems as optimisation problems", "synthesis", 1),
                            ("Apply differentiation to find maximum and minimum values in practical contexts", "application", 2),
                            ("Verify solutions using the second derivative test", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Rates of change",
                        "code": "1.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Use derivatives to solve related rates problems", "application", 1),
                            ("Apply differentiation to problems involving displacement, velocity and acceleration", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "INTEGRATION",
                "code": "9.0",
                "form_level": 5,
                "order": 9,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Indefinite integrals",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define integration as the reverse process of differentiation", "knowledge", 1),
                            ("Integrate polynomials, trigonometric and exponential functions", "application", 2),
                            ("Use the constant of integration", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Integration techniques",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Apply the method of substitution to evaluate integrals", "application", 1),
                            ("Use partial fractions to integrate rational functions", "application", 2),
                            ("Apply integration by parts", "application", 3),
                        ],
                    },
                    {
                        "title": "Definite integrals",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Evaluate definite integrals using the fundamental theorem of calculus", "application", 1),
                            ("Use definite integrals to find areas under curves", "application", 2),
                        ],
                    },
                    {
                        "title": "Area between curves",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Find the area between two curves using definite integration", "application", 1),
                            ("Determine points of intersection to set up limits of integration", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Numerical integration",
                        "code": "1.5",
                        "order": 5,
                        "periods": 3,
                        "outcomes": [
                            ("Apply the trapezium rule to approximate definite integrals", "application", 1),
                            ("Estimate errors in numerical integration", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "STATISTICS",
                "code": "10.0",
                "form_level": 5,
                "order": 10,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Measures of central tendency",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate mean, median and mode for grouped and ungrouped data", "application", 1),
                            ("Select appropriate measures of central tendency for different data sets", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Measures of dispersion",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate range, variance and standard deviation", "application", 1),
                            ("Interpret the standard deviation as a measure of spread", "comprehension", 2),
                            ("Use coefficient of variation to compare variability of data sets", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Cumulative frequency and histograms",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Construct cumulative frequency tables and ogives", "application", 1),
                            ("Estimate the median, quartiles and percentiles from cumulative frequency curves", "application", 2),
                            ("Draw and interpret frequency histograms", "comprehension", 3),
                        ],
                    },
                    {
                        "title": "Correlation and regression",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate the Pearson correlation coefficient", "application", 1),
                            ("Interpret the strength and direction of correlation", "comprehension", 2),
                            ("Determine the least squares regression line", "application", 3),
                        ],
                    },
                    {
                        "title": "Scatter diagrams and estimation",
                        "code": "1.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Plot scatter diagrams and identify types of correlation", "application", 1),
                            ("Use regression lines for prediction and estimation", "application", 2),
                            ("Evaluate the reliability of predictions made from regression models", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "PROBABILITY",
                "code": "11.0",
                "form_level": 5,
                "order": 11,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Basic probability",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define sample space, event and probability of an event", "knowledge", 1),
                            ("Calculate probabilities using classical and empirical approaches", "application", 2),
                            ("Use the complement rule and addition rule", "application", 3),
                        ],
                    },
                    {
                        "title": "Conditional probability",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Define conditional probability", "knowledge", 1),
                            ("Apply the multiplication rule for dependent events", "application", 2),
                            ("Use tree diagrams to calculate conditional probabilities", "application", 3),
                        ],
                    },
                    {
                        "title": "Mutually exclusive and independent events",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Distinguish between mutually exclusive and independent events", "comprehension", 1),
                            ("Solve problems involving mutually exclusive events", "application", 2),
                            ("Verify independence using probability calculations", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Bayes' theorem",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("State Bayes' theorem", "knowledge", 1),
                            ("Apply Bayes' theorem to reverse probability problems", "application", 2),
                        ],
                    },
                    {
                        "title": "Probability distributions",
                        "code": "1.5",
                        "order": 5,
                        "periods": 3,
                        "outcomes": [
                            ("Define a probability distribution for a discrete random variable", "knowledge", 1),
                            ("Verify that a given function is a valid probability distribution", "application", 2),
                            ("Calculate the expected value and variance of a discrete random variable", "application", 3),
                        ],
                    },
                ],
            },
            {
                "title": "LINEAR PROGRAMMING",
                "code": "12.0",
                "form_level": 5,
                "order": 12,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Linear inequalities and feasible regions",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Graph systems of linear inequalities in two variables", "application", 1),
                            ("Identify the feasible region bounded by linear constraints", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Objective function and optimisation",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Formulate an objective function from a word problem", "synthesis", 1),
                            ("Identify optimal solutions at vertices of the feasible region", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Applications of linear programming",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Model production planning and resource allocation problems", "application", 1),
                            ("Interpret optimal solutions in context", "comprehension", 2),
                            ("Evaluate the practicality of solutions with respect to constraints", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Shadow prices and sensitivity",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Interpret shadow prices of binding constraints", "analysis", 1),
                            ("Assess how changes in constraints affect the optimal solution", "evaluation", 2),
                        ],
                    },
                ],
            },
            {
                "title": "COMPLEX NUMBERS",
                "code": "1.0",
                "form_level": 6,
                "order": 13,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Definition and arithmetic of complex numbers",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define the imaginary unit and the general form of a complex number", "knowledge", 1),
                            ("Add, subtract and multiply complex numbers", "application", 2),
                            ("Divide complex numbers by multiplying by the conjugate", "application", 3),
                        ],
                    },
                    {
                        "title": "Modulus and argument",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Calculate the modulus and argument of a complex number", "application", 1),
                            ("Represent complex numbers on the Argand diagram", "application", 2),
                        ],
                    },
                    {
                        "title": "Polar form and exponential form",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Convert between rectangular, polar and exponential forms", "application", 1),
                            ("Multiply and divide complex numbers in polar form", "application", 2),
                            ("Justify the use of polar form for operations on complex numbers", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "De Moivre's theorem",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("State De Moivre's theorem", "knowledge", 1),
                            ("Use De Moivre's theorem to find powers of complex numbers", "application", 2),
                        ],
                    },
                    {
                        "title": "Roots of complex numbers",
                        "code": "1.5",
                        "order": 5,
                        "periods": 3,
                        "outcomes": [
                            ("Find the nth roots of a complex number", "application", 1),
                            ("Show that the nth roots of unity lie on a circle in the Argand diagram", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "MATRICES AND TRANSFORMATIONS",
                "code": "2.0",
                "form_level": 6,
                "order": 14,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Linear transformations",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define a linear transformation in terms of matrix multiplication", "knowledge", 1),
                            ("Represent geometric transformations using 2 by 2 matrices", "application", 2),
                        ],
                    },
                    {
                        "title": "Composite and inverse transformations",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Find the matrix representing a sequence of transformations", "application", 1),
                            ("Determine the inverse transformation and its matrix", "application", 2),
                        ],
                    },
                    {
                        "title": "Eigenvalues and eigenvectors",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define eigenvalues and eigenvectors", "knowledge", 1),
                            ("Find eigenvalues by solving the characteristic equation", "application", 2),
                            ("Determine eigenvectors corresponding to each eigenvalue", "application", 3),
                        ],
                    },
                    {
                        "title": "Diagonalisation",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Diagonalise a given matrix when possible", "application", 1),
                            ("Use diagonalisation to compute matrix powers efficiently", "application", 2),
                            ("Determine whether a matrix is diagonalisable by examining eigenvectors", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "APPLICATIONS OF INTEGRATION",
                "code": "3.0",
                "form_level": 6,
                "order": 15,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Volumes of revolution",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Calculate the volume of a solid of revolution about the x-axis", "application", 1),
                            ("Calculate the volume of a solid of revolution about the y-axis", "application", 2),
                            ("Set up integrals for volumes of revolution from real-world objects", "synthesis", 3),
                        ],
                    },
                    {
                        "title": "Arc length and surface area",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Derive and apply the formula for arc length of a curve", "application", 1),
                            ("Find the surface area of revolution of a curve", "application", 2),
                        ],
                    },
                    {
                        "title": "Centroids and centres of mass",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Find the centroid of a plane region using integration", "application", 1),
                            ("Determine the centre of mass of a lamina with variable density", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Mean values and applications",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate the mean value of a function over an interval", "application", 1),
                            ("Apply integration to solve problems in physics and engineering contexts", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "DIFFERENTIAL EQUATIONS",
                "code": "4.0",
                "form_level": 6,
                "order": 16,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Formation and classification of differential equations",
                        "code": "1.1",
                        "order": 1,
                        "periods": 3,
                        "outcomes": [
                            ("Define order and degree of a differential equation", "knowledge", 1),
                            ("Form differential equations from real-world situations", "synthesis", 2),
                        ],
                    },
                    {
                        "title": "Separable differential equations",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Identify separable differential equations", "comprehension", 1),
                            ("Solve separable differential equations by integrating both sides", "application", 2),
                            ("Apply initial conditions to find particular solutions", "application", 3),
                        ],
                    },
                    {
                        "title": "First order linear differential equations",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Write first order linear differential equations in standard form", "comprehension", 1),
                            ("Solve using the integrating factor method", "application", 2),
                        ],
                    },
                    {
                        "title": "Exact differential equations",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Test whether a differential equation is exact", "analysis", 1),
                            ("Solve exact differential equations by integration", "application", 2),
                        ],
                    },
                    {
                        "title": "Applications of differential equations",
                        "code": "1.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Model population growth and decay using differential equations", "application", 1),
                            ("Solve problems involving Newton's law of cooling", "application", 2),
                            ("Interpret solutions of differential equations in biological and economic contexts", "evaluation", 3),
                        ],
                    },
                ],
            },
            {
                "title": "TRIGONOMETRY",
                "code": "5.0",
                "form_level": 6,
                "order": 17,
                "periods": 20,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Trigonometric identities",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("State fundamental Pythagorean and reciprocal trigonometric identities", "knowledge", 1),
                            ("Prove trigonometric identities using algebraic manipulation", "synthesis", 2),
                        ],
                    },
                    {
                        "title": "Compound and double angle formulae",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("State the compound angle formulae for sine cosine and tangent", "knowledge", 1),
                            ("Apply double angle formulae to simplify trigonometric expressions", "application", 2),
                        ],
                    },
                    {
                        "title": "Solving trigonometric equations",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Solve trigonometric equations within given intervals", "application", 1),
                            ("Use identities to transform and solve complex trigonometric equations", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Trigonometric functions and their graphs",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Sketch graphs of y equals a sin bx plus c and related forms", "application", 1),
                            ("Identify amplitude period and phase shift from equations", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Applications of trigonometry",
                        "code": "1.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Apply sine and cosine rules to solve 2D and 3D problems", "application", 1),
                            ("Solve problems involving areas of triangles using trigonometry", "application", 2),
                            ("Evaluate trigonometric expressions using exact values", "synthesis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "VECTORS AND VECTOR ANALYSIS",
                "code": "6.0",
                "form_level": 6,
                "order": 18,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Vector quantities and notation",
                        "code": "1.1",
                        "order": 1,
                        "periods": 3,
                        "outcomes": [
                            ("Define vectors and distinguish between scalar and vector quantities", "knowledge", 1),
                            ("Represent vectors as column vectors and position vectors", "comprehension", 2),
                        ],
                    },
                    {
                        "title": "Operations on vectors",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Add and subtract vectors geometrically and algebraically", "application", 1),
                            ("Multiply a vector by a scalar and find unit vectors", "application", 2),
                            ("Determine the magnitude and direction of a resultant vector", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Vector equations of lines",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Write the vector equation of a straight line", "application", 1),
                            ("Find intersection points of lines using vector methods", "application", 2),
                        ],
                    },
                    {
                        "title": "Dot product",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define and calculate the scalar dot product of two vectors", "knowledge", 1),
                            ("Use the dot product to find the angle between two vectors", "application", 2),
                            ("Determine whether two vectors are parallel or perpendicular", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Cross product and its applications",
                        "code": "1.5",
                        "order": 5,
                        "periods": 4,
                        "outcomes": [
                            ("Define and calculate the cross product of two vectors", "knowledge", 1),
                            ("Find the area of a parallelogram and triangle using the cross product", "application", 2),
                            ("Find the equation of a plane through three points", "application", 3),
                        ],
                    },
                    {
                        "title": "Vector applications in three dimensions",
                        "code": "1.6",
                        "order": 6,
                        "periods": 3,
                        "outcomes": [
                            ("Solve problems involving lines and planes in three dimensions", "application", 1),
                            ("Determine distances and angles in 3D geometry using vectors", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "ANALYTIC GEOMETRY",
                "code": "7.0",
                "form_level": 6,
                "order": 19,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "The circle revisited",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Write the equation of a circle in parametric form", "application", 1),
                            ("Find the tangent and normal to a circle at a given point", "application", 2),
                        ],
                    },
                    {
                        "title": "The parabola in detail",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Derive the standard equation of a parabola from its geometric definition", "synthesis", 1),
                            ("Find the focus directrix and latus rectum of a parabola", "application", 2),
                        ],
                    },
                    {
                        "title": "The ellipse in detail",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Relate the eccentricity to the shape of an ellipse", "comprehension", 1),
                            ("Find the foci vertices and directrices of an ellipse", "application", 2),
                        ],
                    },
                    {
                        "title": "The hyperbola in detail",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Find the asymptotes foci and eccentricity of a hyperbola", "application", 1),
                            ("Solve problems involving intersections of conic sections with lines", "analysis", 2),
                        ],
                    },
                ],
            },
            {
                "title": "BINOMIAL THEOREM AND PARTIAL FRACTIONS",
                "code": "8.0",
                "form_level": 6,
                "order": 20,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Binomial expansion for positive integral index",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("State the binomial theorem for a positive integer index", "knowledge", 1),
                            ("Expand binomial expressions using Pascal's triangle and factorial notation", "application", 2),
                            ("Find specific terms and coefficients in a binomial expansion", "application", 3),
                        ],
                    },
                    {
                        "title": "Binomial expansion for rational and negative indices",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Derive the general binomial expansion for rational and negative indices", "knowledge", 1),
                            ("Use the general binomial expansion to approximate values", "application", 2),
                            ("Determine the range of validity for a binomial expansion", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Partial fractions revisited",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Resolve algebraic fractions with repeated and irreducible quadratic factors", "application", 1),
                            ("Use partial fractions in binomial expansion of rational functions", "synthesis", 2),
                        ],
                    },
                    {
                        "title": "Applications and series",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Use binomial series to find Maclaurin expansions of common functions", "application", 1),
                            ("Approximate values using the first few terms of a series", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "BUSINESS AND FINANCIAL MATHEMATICS",
                "code": "9.0",
                "form_level": 6,
                "order": 21,
                "periods": 18,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Compound interest and depreciation",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Apply the compound interest formula for savings and loans", "application", 1),
                            ("Calculate depreciation using reducing balance and straight line methods", "application", 2),
                        ],
                    },
                    {
                        "title": "Annuities and sinking funds",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Define annuity and sinking fund", "knowledge", 1),
                            ("Calculate the future value and present value of an ordinary annuity", "application", 2),
                            ("Compare different investment and repayment schemes", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Installment buying and hire purchase",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Calculate the total cost and monthly payments under hire purchase", "application", 1),
                            ("Compare cash price and installment price to assess financial implications", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Taxation and profit-loss analysis",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Calculate income tax using graduated tax bands", "application", 1),
                            ("Determine profit margin and mark-up from cost and selling price", "application", 2),
                            ("Use break-even analysis to make business decisions", "analysis", 3),
                        ],
                    },
                ],
            },
            {
                "title": "PROBABILITY DISTRIBUTIONS AND STATISTICAL INFERENCE",
                "code": "10.0",
                "form_level": 6,
                "order": 22,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Binomial distribution",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("State the conditions for a binomial distribution", "knowledge", 1),
                            ("Calculate probabilities using the binomial probability formula", "application", 2),
                            ("Find the mean and variance of a binomial distribution", "application", 3),
                        ],
                    },
                    {
                        "title": "Normal distribution",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the properties of the normal distribution curve", "comprehension", 1),
                            ("Standardise normal variables using z-scores", "application", 2),
                            ("Use standard normal tables to find probabilities", "application", 3),
                        ],
                    },
                    {
                        "title": "Normal approximation",
                        "code": "1.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Approximate binomial probabilities using the normal distribution", "application", 1),
                            ("Apply continuity corrections when using normal approximation", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Sampling and estimation",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define population sample and sampling methods", "knowledge", 1),
                            ("Calculate confidence intervals for population means", "application", 2),
                            ("Evaluate the reliability of statistical estimates", "evaluation", 3),
                        ],
                    },
                    {
                        "title": "Hypothesis testing",
                        "code": "1.5",
                        "order": 5,
                        "periods": 3,
                        "outcomes": [
                            ("State null and alternative hypotheses", "knowledge", 1),
                            ("Perform z-tests for population means", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "LINEAR AND NON-LINEAR EQUATIONS",
                "code": "11.0",
                "form_level": 6,
                "order": 23,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Matrix methods for linear systems",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Use Gaussian elimination to solve systems of linear equations", "application", 1),
                            ("Apply Gauss-Jordan elimination to find reduced row echelon form", "application", 2),
                            ("Classify systems as consistent independent consistent dependent or inconsistent", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Iterative methods for non-linear equations",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Locate roots of equations using the change of sign method", "application", 1),
                            ("Apply the Newton-Raphson method to approximate roots", "application", 2),
                            ("Analyse convergence and failure cases of iterative methods", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Numerical solutions of differential equations",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Apply Euler's method to approximate solutions of first order ODEs", "application", 1),
                            ("Use improved Euler methods for better approximations", "application", 2),
                        ],
                    },
                    {
                        "title": "System modelling",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Formulate mathematical models from real-world descriptions", "synthesis", 1),
                            ("Choose appropriate numerical methods for different types of equations", "evaluation", 2),
                        ],
                    },
                ],
            },
        ],
    },
    {
        "name": "Business Studies",
        "code": "BST",
        "slug": "business-studies",
        "necta_code": "019",
        "is_core": False,
        "description": "Business Studies covers introduction to business, trade, entrepreneurship, accounting, marketing, finance, management, and government policy across Forms I to VI for the Tanzanian O-Level and A-Level curriculum.",
        "form_start": 1,
        "form_end": 6,
        "topics": [
            {
                "title": "INTRODUCTION TO BUSINESS STUDIES",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and scope of Business Studies",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define Business Studies and its branches", "knowledge", 1),
                            ("Explain the scope of Business Studies in daily life", "comprehension", 2),
                            ("Relate Business Studies to other school subjects", "application", 3)
                        ]
                    },
                    {
                        "title": "Importance of studying Business Studies",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("List reasons for studying Business Studies", "knowledge", 1),
                            ("Explain how Business Studies knowledge benefits individuals", "comprehension", 2),
                            ("Give examples of career opportunities from Business Studies", "application", 3)
                        ]
                    },
                    {
                        "title": "Key business terms and concepts",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Define key business terms such as production, distribution, consumption", "knowledge", 1),
                            ("Distinguish between goods and services", "analysis", 2),
                            ("Apply business terminology in contextual sentences", "application", 3)
                        ]
                    },
                    {
                        "title": "Types of economic activities",
                        "code": "1.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Classify economic activities into primary, secondary, and tertiary sectors", "knowledge", 1),
                            ("Explain the interdependence of economic sectors in Tanzania", "comprehension", 2),
                            ("Analyse the contribution of each sector to national income", "analysis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "BUSINESS ENVIRONMENT",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "The business environment defined",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define the concept of a business environment", "knowledge", 1),
                            ("Explain internal and external business environments", "comprehension", 2),
                            ("Distinguish between micro and macro environments", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Natural and physical environment",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List natural resources found in Tanzania", "knowledge", 1),
                            ("Explain how the physical environment affects business operations", "comprehension", 2),
                            ("Give examples of businesses influenced by climate and geography", "application", 3)
                        ]
                    },
                    {
                        "title": "Social and cultural environment",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe social factors that affect business in Tanzania", "knowledge", 1),
                            ("Explain how customs and traditions influence business practices", "comprehension", 2),
                            ("Analyse the impact of cultural diversity on marketing strategies", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Political and legal environment",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Identify government policies that affect businesses", "knowledge", 1),
                            ("Explain the role of laws in regulating business activities", "comprehension", 2),
                            ("Evaluate the effect of political stability on business growth", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "ENTREPRENEURSHIP",
                "code": "3.0",
                "form_level": 1,
                "order": 3,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and concept of entrepreneurship",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define entrepreneurship and an entrepreneur", "knowledge", 1),
                            ("Explain the difference between an entrepreneur and a manager", "comprehension", 2),
                            ("Identify qualities of a successful entrepreneur", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Importance of entrepreneurship in Tanzania",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List benefits of entrepreneurship to the national economy", "knowledge", 1),
                            ("Explain how entrepreneurship reduces unemployment", "comprehension", 2),
                            ("Give examples of successful Tanzanian entrepreneurs", "application", 3)
                        ]
                    },
                    {
                        "title": "Sources of business ideas",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("List various sources of business ideas", "knowledge", 1),
                            ("Explain how to evaluate a business idea before starting", "comprehension", 2),
                            ("Apply criteria to select a viable business idea", "application", 3),
                            ("Critically assess the feasibility of a business concept", "evaluation", 4)
                        ]
                    },
                    {
                        "title": "Barriers to entrepreneurship",
                        "code": "1.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Identify common barriers facing entrepreneurs in Tanzania", "knowledge", 1),
                            ("Explain how lack of capital hinders business start-ups", "comprehension", 2),
                            ("Suggest possible solutions to entrepreneurship challenges", "synthesis", 3),
                            ("Evaluate government efforts to support small businesses", "evaluation", 4)
                        ]
                    }
                ]
            },
            {
                "title": "TRADE AND COMMERCE",
                "code": "4.0",
                "form_level": 1,
                "order": 4,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and types of trade",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define trade and commerce", "knowledge", 1),
                            ("Distinguish between internal and external trade", "comprehension", 2),
                            ("Classify trade into wholesale and retail", "application", 3)
                        ]
                    },
                    {
                        "title": "Retail trade",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Define retail trade and give examples", "knowledge", 1),
                            ("Explain the functions of a retailer", "comprehension", 2),
                            ("Describe types of retail shops in Tanzania", "knowledge", 3)
                        ]
                    },
                    {
                        "title": "Wholesale trade",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Define wholesale trade", "knowledge", 1),
                            ("Explain the functions of a wholesaler", "comprehension", 2),
                            ("Analyse the relationship between wholesalers and retailers", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Middlemen and channels of distribution",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Define middlemen and their roles", "knowledge", 1),
                            ("Explain direct and indirect channels of distribution", "comprehension", 2),
                            ("Evaluate the importance of eliminating middlemen", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "METHODS OF PAYMENT",
                "code": "5.0",
                "form_level": 1,
                "order": 5,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Cash payments",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Explain cash as a method of payment", "knowledge", 1),
                            ("Discuss advantages and disadvantages of cash payments", "comprehension", 2),
                            ("Give examples of cash transactions in daily life", "application", 3)
                        ]
                    },
                    {
                        "title": "Cheques and bank drafts",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Define a cheque and a bank draft", "knowledge", 1),
                            ("Explain the procedures of writing and processing a cheque", "comprehension", 2),
                            ("Distinguish between a crossed cheque and an open cheque", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Mobile money and electronic payments",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe mobile money services such as M-Pesa and Tigo Pesa", "knowledge", 1),
                            ("Explain how electronic payments facilitate trade", "comprehension", 2),
                            ("Evaluate the impact of mobile money on the Tanzanian economy", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Credit and barter trade",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Define credit transactions and barter trade", "knowledge", 1),
                            ("Explain the limitations of barter trade", "comprehension", 2),
                            ("Compare credit payments with cash payments", "analysis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "WAREHOUSING",
                "code": "1.0",
                "form_level": 2,
                "order": 6,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and types of warehouses",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define warehousing and its purpose", "knowledge", 1),
                            ("Distinguish between public, private, and bonded warehouses", "analysis", 2),
                            ("Explain the functions of a warehouse in the supply chain", "comprehension", 3)
                        ]
                    },
                    {
                        "title": "Functions of warehousing",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List the main functions of warehouses", "knowledge", 1),
                            ("Explain how warehousing stabilises prices", "comprehension", 2),
                            ("Analyse the role of warehousing in bulk-breaking", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Goods handling in warehouses",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe equipment used for handling goods in warehouses", "knowledge", 1),
                            ("Explain proper storage techniques for different goods", "comprehension", 2),
                            ("Apply inventory control methods in a warehouse setting", "application", 3)
                        ]
                    },
                    {
                        "title": "Costs and problems of warehousing",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Identify common costs associated with warehousing", "knowledge", 1),
                            ("Explain challenges faced by warehouse operators in Tanzania", "comprehension", 2),
                            ("Suggest solutions to warehousing problems", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "TRANSPORT",
                "code": "2.0",
                "form_level": 2,
                "order": 7,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and importance of transport",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define transport and its role in business", "knowledge", 1),
                            ("Explain the importance of transport in economic development", "comprehension", 2),
                            ("Give examples of how transport links producers and consumers", "application", 3)
                        ]
                    },
                    {
                        "title": "Modes of transport",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List the modes of transport: road, rail, water, and air", "knowledge", 1),
                            ("Compare advantages and disadvantages of each mode", "analysis", 2),
                            ("Recommend the most suitable mode for specific goods", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Transport infrastructure in Tanzania",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify key transport infrastructure projects in Tanzania", "knowledge", 1),
                            ("Explain the impact of the TAZARA railway on trade", "comprehension", 2),
                            ("Analyse the role of the Standard Gauge Railway in national development", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Problems of transport in Tanzania",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("List major transport challenges in Tanzania", "knowledge", 1),
                            ("Explain how poor transport infrastructure affects business", "comprehension", 2),
                            ("Propose measures to improve the transport sector", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "INSURANCE",
                "code": "3.0",
                "form_level": 2,
                "order": 8,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and principles of insurance",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define insurance and related terms", "knowledge", 1),
                            ("Explain the principles of insurance: utmost good faith, indemnity, and contribution", "comprehension", 2),
                            ("Apply the principle of utmost good faith to a business scenario", "application", 3)
                        ]
                    },
                    {
                        "title": "Types of insurance",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List types of insurance: life, property, marine, motor vehicle", "knowledge", 1),
                            ("Distinguish between life insurance and general insurance", "analysis", 2),
                            ("Explain the role of the Tanzania Insurance Regulatory Authority (TIRA)", "comprehension", 3)
                        ]
                    },
                    {
                        "title": "Functions and importance of insurance",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("List the functions of insurance in business", "knowledge", 1),
                            ("Explain how insurance provides risk transfer and peace of mind", "comprehension", 2),
                            ("Evaluate the importance of insurance to national economic development", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Insurance terminology and policy documents",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define insurance terms: premium, policy, claim, insurer, insured", "knowledge", 1),
                            ("Explain the contents of an insurance policy document", "comprehension", 2),
                            ("Complete a sample insurance claim form", "application", 3)
                        ]
                    }
                ]
            },
            {
                "title": "MONEY AND BANKING",
                "code": "4.0",
                "form_level": 2,
                "order": 9,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Origin and functions of money",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define money and describe its forms", "knowledge", 1),
                            ("Explain the functions of money as a medium of exchange and store of value", "comprehension", 2),
                            ("Analyse the qualities of good money", "analysis", 3)
                        ]
                    },
                    {
                        "title": "The Bank of Tanzania",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the structure and role of the Bank of Tanzania", "knowledge", 1),
                            ("Explain monetary policy tools used by the Bank of Tanzania", "comprehension", 2),
                            ("Evaluate the effectiveness of the Bank of Tanzania in controlling inflation", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Commercial banks and their services",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("List services offered by commercial banks", "knowledge", 1),
                            ("Explain the difference between savings and current accounts", "comprehension", 2),
                            ("Describe the process of obtaining a bank loan", "application", 3)
                        ]
                    },
                    {
                        "title": "Non-bank financial institutions",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Identify non-bank financial institutions in Tanzania", "knowledge", 1),
                            ("Explain the services of microfinance institutions and SACCOs", "comprehension", 2),
                            ("Compare the services of commercial banks and microfinance institutions", "analysis", 3),
                            ("Evaluate the role of SACCOs in financial inclusion", "evaluation", 4)
                        ]
                    }
                ]
            },
            {
                "title": "BUSINESS COMMUNICATION",
                "code": "5.0",
                "form_level": 2,
                "order": 10,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and importance of business communication",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define business communication and its purpose", "knowledge", 1),
                            ("Explain the importance of effective communication in business", "comprehension", 2),
                            ("Identify barriers to effective communication", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Methods of business communication",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List methods of communication: written, oral, visual, electronic", "knowledge", 1),
                            ("Distinguish between formal and informal communication", "analysis", 2),
                            ("Choose appropriate communication methods for different situations", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Business documents and correspondence",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify types of business documents: letters, memos, reports", "knowledge", 1),
                            ("Explain the format of a formal business letter", "comprehension", 2),
                            ("Draft a standard business letter", "application", 3)
                        ]
                    },
                    {
                        "title": "Modern communication technology in business",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Describe modern communication tools used in business", "knowledge", 1),
                            ("Explain how ICT has transformed business communication", "comprehension", 2),
                            ("Evaluate the advantages and disadvantages of electronic communication", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "BOOK-KEEPING AND BASIC ACCOUNTING",
                "code": "1.0",
                "form_level": 3,
                "order": 11,
                "periods": 24,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and purpose of book-keeping",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define book-keeping and accounting", "knowledge", 1),
                            ("Explain the purpose of book-keeping in business", "comprehension", 2),
                            ("Distinguish between book-keeping and accounting", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Books of original entry",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("List the books of original entry: cash book, journal, ledger", "knowledge", 1),
                            ("Explain the purpose of each book of original entry", "comprehension", 2),
                            ("Record transactions in a simple cash book", "application", 3)
                        ]
                    },
                    {
                        "title": "The double-entry system",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("State the rules of double-entry book-keeping", "knowledge", 1),
                            ("Explain the relationship between debit and credit entries", "comprehension", 2),
                            ("Record transactions using the double-entry system", "application", 3),
                            ("Analyse the effect of transactions on the accounting equation", "analysis", 4)
                        ]
                    },
                    {
                        "title": "Trial balance and financial statements",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Prepare a trial balance from ledger balances", "application", 1),
                            ("Explain the purpose of a trial balance", "comprehension", 2),
                            ("Construct a simple trading account and profit and loss account", "application", 3)
                        ]
                    },
                    {
                        "title": "Bank reconciliation statement",
                        "code": "1.5",
                        "order": 5,
                        "periods": 3,
                        "outcomes": [
                            ("Define a bank reconciliation statement", "knowledge", 1),
                            ("Explain items causing differences between cash book and bank statement", "comprehension", 2),
                            ("Prepare a simple bank reconciliation statement", "application", 3)
                        ]
                    }
                ]
            },
            {
                "title": "FORMS OF BUSINESS OWNERSHIP",
                "code": "2.0",
                "form_level": 3,
                "order": 12,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Sole proprietorship",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define a sole proprietorship and its characteristics", "knowledge", 1),
                            ("Explain the advantages and disadvantages of sole proprietorship", "comprehension", 2),
                            ("Give examples of sole proprietorship businesses in Tanzania", "application", 3)
                        ]
                    },
                    {
                        "title": "Partnership",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Define a partnership and list its features", "knowledge", 1),
                            ("Explain the types of partners and partnership deeds", "comprehension", 2),
                            ("Analyse advantages and disadvantages of partnership", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Companies and corporations",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define a company and distinguish between private and public companies", "knowledge", 1),
                            ("Explain the process of forming a company in Tanzania", "comprehension", 2),
                            ("Analyse the role of the BRELA in company registration", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Co-operative societies and parastatals",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define co-operative societies and their types", "knowledge", 1),
                            ("Explain the functions of co-operatives in Tanzania", "comprehension", 2),
                            ("Evaluate the performance of co-operative societies in agricultural marketing", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "HUMAN RESOURCE MANAGEMENT",
                "code": "3.0",
                "form_level": 3,
                "order": 13,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and scope of human resource management",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define human resource management", "knowledge", 1),
                            ("Explain the functions of a human resource department", "comprehension", 2),
                            ("Identify the importance of human resources to an organisation", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Recruitment and selection",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Distinguish between internal and external recruitment", "analysis", 1),
                            ("Explain the steps in the recruitment and selection process", "comprehension", 2),
                            ("Complete a job application form and curriculum vitae", "application", 3)
                        ]
                    },
                    {
                        "title": "Training and development",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Define employee training and development", "knowledge", 1),
                            ("Explain on-the-job and off-the-job training methods", "comprehension", 2),
                            ("Evaluate the importance of staff training to organisational performance", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Employee welfare and motivation",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("List employee welfare provisions in Tanzanian organisations", "knowledge", 1),
                            ("Explain theories of motivation applicable in the workplace", "comprehension", 2),
                            ("Suggest ways to improve employee productivity", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "ADVERTISING AND SALES PROMOTION",
                "code": "4.0",
                "form_level": 3,
                "order": 14,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and types of advertising",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define advertising and distinguish it from publicity", "knowledge", 1),
                            ("List types of advertising: print, broadcast, outdoor, digital", "knowledge", 2),
                            ("Explain the role of the Tanzania Advertising Board", "comprehension", 3)
                        ]
                    },
                    {
                        "title": "Methods and media of advertising",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Identify various advertising media used in Tanzania", "knowledge", 1),
                            ("Compare the effectiveness of different advertising media", "analysis", 2),
                            ("Select appropriate media for a given product", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Sales promotion techniques",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Define sales promotion and give examples", "knowledge", 1),
                            ("Explain sales promotion methods: discounts, coupons, samples", "comprehension", 2),
                            ("Design a simple sales promotion campaign", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Effects of advertising on consumers and business",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("List positive effects of advertising on consumers", "knowledge", 1),
                            ("Explain how advertising influences consumer buying behaviour", "comprehension", 2),
                            ("Critically evaluate the impact of misleading advertising", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "CONSUMER RIGHTS AND PROTECTION",
                "code": "5.0",
                "form_level": 3,
                "order": 15,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning of consumer rights",
                        "code": "1.1",
                        "order": 1,
                        "periods": 3,
                        "outcomes": [
                            ("Define consumer rights and consumer protection", "knowledge", 1),
                            ("List consumer rights as stipulated in Tanzanian law", "knowledge", 2),
                            ("Explain the Consumer Protection Act in Tanzania", "comprehension", 3)
                        ]
                    },
                    {
                        "title": "Consumer responsibilities",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("List responsibilities of consumers in the marketplace", "knowledge", 1),
                            ("Explain the importance of reading product labels and receipts", "comprehension", 2),
                            ("Apply consumer rights in a given purchasing scenario", "application", 3)
                        ]
                    },
                    {
                        "title": "Agencies for consumer protection",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify government and non-government agencies for consumer protection", "knowledge", 1),
                            ("Explain the role of the Fair Competition Commission (FCC)", "comprehension", 2),
                            ("Analyse the effectiveness of consumer protection measures in Tanzania", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Consumer awareness and product quality",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Describe standards and quality marks such as TBS and ISO", "knowledge", 1),
                            ("Explain the importance of product quality standards", "comprehension", 2),
                            ("Evaluate the impact of counterfeit goods on consumers", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "GOVERNMENT AND BUSINESS",
                "code": "1.0",
                "form_level": 4,
                "order": 16,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Role of government in business",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("List the roles of government in regulating business activities", "knowledge", 1),
                            ("Explain how government policy influences private sector growth", "comprehension", 2),
                            ("Analyse the relationship between government and the private sector", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Taxation and fiscal policy",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Define taxation and types of taxes in Tanzania", "knowledge", 1),
                            ("Explain the functions of the Tanzania Revenue Authority (TRA)", "comprehension", 2),
                            ("Calculate basic tax liabilities using given rates", "application", 3)
                        ]
                    },
                    {
                        "title": "Government business regulation",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify regulatory bodies for business in Tanzania", "knowledge", 1),
                            ("Explain licensing requirements for businesses", "comprehension", 2),
                            ("Evaluate the effect of regulation on business operations", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Privatisation and liberalisation",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define privatisation and liberalisation", "knowledge", 1),
                            ("Explain the advantages and disadvantages of privatisation", "comprehension", 2),
                            ("Evaluate the impact of economic liberalisation in Tanzania", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "NATIONAL ECONOMIC DEVELOPMENT",
                "code": "2.0",
                "form_level": 4,
                "order": 17,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and indicators of economic development",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define economic development and economic growth", "knowledge", 1),
                            ("Distinguish between economic growth and economic development", "analysis", 2),
                            ("Identify indicators of economic development such as HDI and GDP", "knowledge", 3)
                        ]
                    },
                    {
                        "title": "Role of agriculture and industry in national development",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Explain the contribution of agriculture to Tanzania's economy", "comprehension", 1),
                            ("Analyse the role of industrialisation in economic development", "analysis", 2),
                            ("Suggest strategies to boost agriculture and industry", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Five-Year Development Plans",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the Tanzania Development Vision 2025", "knowledge", 1),
                            ("Explain the objectives of the current Five-Year Development Plan", "comprehension", 2),
                            ("Evaluate the achievements and challenges of national development plans", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Foreign aid and foreign direct investment",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define foreign aid and foreign direct investment", "knowledge", 1),
                            ("Explain the role of foreign investment in economic development", "comprehension", 2),
                            ("Analyse the advantages and disadvantages of reliance on foreign aid", "analysis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "BUSINESS ETHICS AND SOCIAL RESPONSIBILITY",
                "code": "3.0",
                "form_level": 4,
                "order": 18,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning of business ethics",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define business ethics and corporate social responsibility", "knowledge", 1),
                            ("Explain the importance of ethical behaviour in business", "comprehension", 2),
                            ("Give examples of ethical and unethical business practices", "application", 3)
                        ]
                    },
                    {
                        "title": "Social responsibility of businesses",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("List ways businesses fulfil social responsibilities", "knowledge", 1),
                            ("Explain how businesses contribute to community development", "comprehension", 2),
                            ("Evaluate the impact of CSR on business reputation", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Environmental conservation and business",
                        "code": "1.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Identify environmental issues caused by business activities", "knowledge", 1),
                            ("Explain how businesses can minimise environmental damage", "comprehension", 2),
                            ("Analyse the role of the National Environment Management Council", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Corruption and its effects on business",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Define corruption and its forms in business", "knowledge", 1),
                            ("Explain the effects of corruption on economic development", "comprehension", 2),
                            ("Propose measures to combat corruption in business", "synthesis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "CAREER PREPARATION",
                "code": "4.0",
                "form_level": 4,
                "order": 19,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Career guidance and choice",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define career and career guidance", "knowledge", 1),
                            ("Explain factors to consider when choosing a career", "comprehension", 2),
                            ("Identify careers related to Business Studies", "application", 3)
                        ]
                    },
                    {
                        "title": "Curriculum vitae and job application",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Describe the components of a curriculum vitae", "knowledge", 1),
                            ("Explain the format of a formal job application letter", "comprehension", 2),
                            ("Prepare a complete CV and job application letter", "application", 3)
                        ]
                    },
                    {
                        "title": "Self-employment and informal sector",
                        "code": "1.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Define self-employment and the informal sector", "knowledge", 1),
                            ("Explain the advantages of self-employment", "comprehension", 2),
                            ("Develop a simple business plan for self-employment", "synthesis", 3)
                        ]
                    },
                    {
                        "title": "Professional bodies and business organisations",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("List professional business organisations in Tanzania", "knowledge", 1),
                            ("Explain the role of the Tanzania Chamber of Commerce", "comprehension", 2),
                            ("Describe the benefits of membership in professional associations", "application", 3)
                        ]
                    }
                ]
            },
            {
                "title": "O-LEVEL BUSINESS STUDIES REVIEW",
                "code": "5.0",
                "form_level": 4,
                "order": 20,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Revision of Forms I and II topics",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Summarise key concepts from Forms I and II Business Studies", "comprehension", 1),
                            ("Solve past examination questions on Forms I and II topics", "application", 2),
                            ("Analyse common examination errors in introductory topics", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Revision of Forms III and IV topics",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Summarise key concepts from Forms III and IV Business Studies", "comprehension", 1),
                            ("Solve past examination questions on accounting and business ownership", "application", 2),
                            ("Evaluate business case studies using knowledge from all forms", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Examination techniques and time management",
                        "code": "1.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("Describe the structure of NECTA Business Studies examination", "knowledge", 1),
                            ("Explain effective time management during examinations", "comprehension", 2),
                            ("Apply revision strategies to prepare for the examination", "application", 3)
                        ]
                    },
                    {
                        "title": "Integration of O-Level Business Studies knowledge",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Connect concepts across different Business Studies topics", "analysis", 1),
                            ("Synthesise knowledge to solve multi-topic business problems", "synthesis", 2),
                            ("Evaluate contemporary business issues using O-Level knowledge", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "PRINCIPLES OF COMMERCE",
                "code": "1.0",
                "form_level": 5,
                "order": 21,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and scope of commerce",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define commerce and distinguish it from trade and business", "knowledge", 1),
                            ("Explain the scope of commerce including trade and aids to trade", "comprehension", 2),
                            ("Analyse the role of commerce in economic development", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Principles of commerce",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("List the fundamental principles of commerce", "knowledge", 1),
                            ("Explain the principle of free consent and capacity to contract", "comprehension", 2),
                            ("Apply commercial principles to business transactions", "application", 3)
                        ]
                    },
                    {
                        "title": "Commercial law and contracts",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define a contract and its essential elements", "knowledge", 1),
                            ("Explain the Sale of Goods Act in Tanzania", "comprehension", 2),
                            ("Analyse the elements of a valid contract using case examples", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Agencies in commerce",
                        "code": "1.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Define agency and the relationship between principal and agent", "knowledge", 1),
                            ("Explain types of agents: brokers, factors, commission agents", "comprehension", 2),
                            ("Distinguish between a mercantile agent and a non-mercantile agent", "analysis", 3),
                            ("Evaluate the rights and duties of agents in commercial transactions", "evaluation", 4)
                        ]
                    }
                ]
            },
            {
                "title": "FORMS OF BUSINESS UNITS",
                "code": "2.0",
                "form_level": 5,
                "order": 22,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Sole proprietorship and partnership in depth",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Analyse the legal status of sole proprietorships and partnerships", "analysis", 1),
                            ("Explain the Partnership Act provisions in Tanzania", "comprehension", 2),
                            ("Evaluate the suitability of partnership for different businesses", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Company formation and management",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the procedures for incorporating a company in Tanzania", "knowledge", 1),
                            ("Explain the Memorandum and Articles of Association", "comprehension", 2),
                            ("Analyse the rights and duties of company directors", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Co-operative societies",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Explain the principles and structure of co-operative societies", "knowledge", 1),
                            ("Describe the role of the Registrar of Co-operatives", "comprehension", 2),
                            ("Evaluate the contribution of co-operatives to rural development", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Public enterprises and parastatals",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define public enterprises and classify their types", "knowledge", 1),
                            ("Explain the reasons for establishing parastatals in Tanzania", "comprehension", 2),
                            ("Analyse the performance and challenges of public enterprises", "analysis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "BUSINESS FINANCE",
                "code": "3.0",
                "form_level": 5,
                "order": 23,
                "periods": 22,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Sources of business finance",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Classify sources of finance into short-term, medium-term, and long-term", "knowledge", 1),
                            ("Explain internal and external sources of business finance", "comprehension", 2),
                            ("Evaluate the suitability of different sources for various business needs", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Capital markets and the Dar es Salaam Stock Exchange",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Define the stock exchange and its functions", "knowledge", 1),
                            ("Explain how shares and bonds are traded on the DSE", "comprehension", 2),
                            ("Analyse the role of the DSE in mobilising savings for investment", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Financial statements and analysis",
                        "code": "1.3",
                        "order": 3,
                        "periods": 6,
                        "outcomes": [
                            ("Prepare balance sheets and income statements for companies", "application", 1),
                            ("Calculate financial ratios: liquidity, profitability, solvency", "application", 2),
                            ("Interpret financial ratios to assess business performance", "analysis", 3),
                            ("Evaluate the financial health of a business using ratio analysis", "evaluation", 4)
                        ]
                    },
                    {
                        "title": "Budgeting and financial planning",
                        "code": "1.4",
                        "order": 4,
                        "periods": 6,
                        "outcomes": [
                            ("Define budgeting and its purpose in business", "knowledge", 1),
                            ("Explain the steps in preparing a business budget", "comprehension", 2),
                            ("Prepare cash budgets and production budgets", "application", 3),
                            ("Analyse budget variances and recommend corrective actions", "analysis", 4)
                        ]
                    }
                ]
            },
            {
                "title": "MARKETING MANAGEMENT",
                "code": "4.0",
                "form_level": 5,
                "order": 24,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and importance of marketing",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define marketing and distinguish it from selling", "knowledge", 1),
                            ("Explain the importance of marketing to businesses and consumers", "comprehension", 2),
                            ("Analyse the evolution from production orientation to marketing orientation", "analysis", 3)
                        ]
                    },
                    {
                        "title": "The marketing mix",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the four elements of the marketing mix: product, price, place, promotion", "knowledge", 1),
                            ("Explain how each element of the marketing mix contributes to strategy", "comprehension", 2),
                            ("Apply the marketing mix to a given business scenario", "application", 3),
                            ("Evaluate the effectiveness of a marketing mix for a Tanzanian product", "evaluation", 4)
                        ]
                    },
                    {
                        "title": "Market research",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define market research and its objectives", "knowledge", 1),
                            ("Explain primary and secondary market research methods", "comprehension", 2),
                            ("Design a simple market research questionnaire", "synthesis", 3),
                            ("Analyse market research findings to inform business decisions", "analysis", 4)
                        ]
                    },
                    {
                        "title": "Market segmentation and target marketing",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Define market segmentation and its bases", "knowledge", 1),
                            ("Explain geographic, demographic, psychographic, and behavioural segmentation", "comprehension", 2),
                            ("Identify target markets for specific products", "application", 3),
                            ("Evaluate the effectiveness of segmentation strategies", "evaluation", 4)
                        ]
                    }
                ]
            },
            {
                "title": "INTERNATIONAL TRADE",
                "code": "5.0",
                "form_level": 5,
                "order": 25,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and types of international trade",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define international trade and distinguish it from domestic trade", "knowledge", 1),
                            ("Explain the balance of trade and balance of payments", "comprehension", 2),
                            ("Analyse the factors that influence international trade patterns", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Basis for international trade",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Explain the theory of absolute and comparative advantage", "knowledge", 1),
                            ("Describe the Heckscher-Ohlin theory of international trade", "comprehension", 2),
                            ("Apply trade theories to explain Tanzania's trade relationships", "application", 3)
                        ]
                    },
                    {
                        "title": "Methods of payment in international trade",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define bills of exchange, letters of credit, and documents of title", "knowledge", 1),
                            ("Explain the procedures involved in letters of credit", "comprehension", 2),
                            ("Process international trade payment documents", "application", 3)
                        ]
                    },
                    {
                        "title": "Trade barriers and trade promotion",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("List tariffs, quotas, and non-tariff barriers to trade", "knowledge", 1),
                            ("Explain the effects of trade barriers on international commerce", "comprehension", 2),
                            ("Evaluate the arguments for and against free trade", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "MANAGEMENT AND ORGANISATION",
                "code": "1.0",
                "form_level": 6,
                "order": 26,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and functions of management",
                        "code": "1.1",
                        "order": 1,
                        "periods": 5,
                        "outcomes": [
                            ("Define management and describe the five functions of management", "knowledge", 1),
                            ("Explain the roles of managers at different organisational levels", "comprehension", 2),
                            ("Analyse the Mintzberg managerial roles and their application", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Organisational structures",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe types of organisational structures: line, functional, matrix", "knowledge", 1),
                            ("Explain the principles of organisation including span of control", "comprehension", 2),
                            ("Compare tall and flat organisational structures", "analysis", 3),
                            ("Evaluate the effectiveness of different structures for Tanzanian organisations", "evaluation", 4)
                        ]
                    },
                    {
                        "title": "Leadership and decision-making",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define leadership and distinguish it from management", "knowledge", 1),
                            ("Explain leadership theories: trait, behavioural, contingency", "comprehension", 2),
                            ("Apply appropriate leadership styles to given business situations", "application", 3),
                            ("Evaluate the impact of leadership on organisational performance", "evaluation", 4)
                        ]
                    },
                    {
                        "title": "Delegation, coordination, and control",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Define delegation, coordination, and control in management", "knowledge", 1),
                            ("Explain the principles and barriers to effective delegation", "comprehension", 2),
                            ("Describe management control techniques: budgeting, auditing, MIS", "application", 3),
                            ("Analyse the importance of control systems in achieving organisational goals", "analysis", 4)
                        ]
                    }
                ]
            },
            {
                "title": "PRODUCTION MANAGEMENT",
                "code": "2.0",
                "form_level": 6,
                "order": 27,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and types of production",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define production and distinguish between primary, secondary, and tertiary production", "knowledge", 1),
                            ("Explain manufacturing and service production processes", "comprehension", 2),
                            ("Analyse the contribution of production to Tanzania's GDP", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Production planning and control",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the steps in production planning", "knowledge", 1),
                            ("Explain the concept of production scheduling and its importance", "comprehension", 2),
                            ("Apply production planning techniques to a manufacturing scenario", "application", 3)
                        ]
                    },
                    {
                        "title": "Quality management",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Define quality management and total quality management (TQM)", "knowledge", 1),
                            ("Explain quality control and quality assurance processes", "comprehension", 2),
                            ("Analyse the role of ISO standards in quality management", "analysis", 3),
                            ("Evaluate the benefits of TQM for Tanzanian manufacturers", "evaluation", 4)
                        ]
                    },
                    {
                        "title": "Costing and break-even analysis",
                        "code": "1.4",
                        "order": 4,
                        "periods": 4,
                        "outcomes": [
                            ("Define fixed costs, variable costs, and total costs", "knowledge", 1),
                            ("Explain the concept of break-even point and its significance", "comprehension", 2),
                            ("Calculate the break-even point from given cost and revenue data", "application", 3)
                        ]
                    }
                ]
            },
            {
                "title": "GOVERNMENT POLICY AND ECONOMIC PLANNING",
                "code": "3.0",
                "form_level": 6,
                "order": 28,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Economic systems and planning",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define economic systems: capitalism, socialism, mixed economy", "knowledge", 1),
                            ("Explain the features of Tanzania's mixed economic system", "comprehension", 2),
                            ("Analyse the shift from Ujamaa to market-oriented policies", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Fiscal and monetary policy",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Define fiscal policy and monetary policy", "knowledge", 1),
                            ("Explain how government uses fiscal policy to influence business", "comprehension", 2),
                            ("Analyse the role of monetary policy in controlling inflation", "analysis", 3),
                            ("Evaluate the effectiveness of macroeconomic policy coordination", "evaluation", 4)
                        ]
                    },
                    {
                        "title": "Industrialisation strategies in Tanzania",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Describe import substitution and export promotion industrialisation", "knowledge", 1),
                            ("Explain the role of Export Processing Zones", "comprehension", 2),
                            ("Evaluate Tanzania's industrialisation progress and challenges", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Development partners and aid effectiveness",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Identify major development partners in Tanzania", "knowledge", 1),
                            ("Explain the role of the World Bank, IMF, and African Development Bank", "comprehension", 2),
                            ("Critically assess the impact of conditional aid on Tanzania's economy", "evaluation", 3)
                        ]
                    }
                ]
            },
            {
                "title": "TRADE UNIONS AND INDUSTRIAL RELATIONS",
                "code": "4.0",
                "form_level": 6,
                "order": 29,
                "periods": 14,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Meaning and types of trade unions",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define trade unions and their historical development in Tanzania", "knowledge", 1),
                            ("Distinguish between craft, industrial, and general unions", "analysis", 2),
                            ("Explain the structure of trade unions in Tanzania", "comprehension", 3)
                        ]
                    },
                    {
                        "title": "Collective bargaining and negotiation",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Define collective bargaining and the collective bargaining agreement", "knowledge", 1),
                            ("Explain the stages of the collective bargaining process", "comprehension", 2),
                            ("Analyse the role of the Conciliation, Mediation, and Arbitration Board", "analysis", 3)
                        ]
                    },
                    {
                        "title": "Industrial disputes and conflict resolution",
                        "code": "1.3",
                        "order": 3,
                        "periods": 3,
                        "outcomes": [
                            ("List causes of industrial disputes in Tanzania", "knowledge", 1),
                            ("Explain methods of resolving industrial disputes", "comprehension", 2),
                            ("Evaluate the effectiveness of arbitration in settling labour disputes", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Labour laws and workers' rights",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Describe key provisions of the Employment and Labour Relations Act", "knowledge", 1),
                            ("Explain workers' rights regarding wages, safety, and welfare", "comprehension", 2),
                            ("Analyse the impact of labour laws on business operations", "analysis", 3)
                        ]
                    }
                ]
            },
            {
                "title": "REGIONAL ECONOMIC INTEGRATION",
                "code": "5.0",
                "form_level": 6,
                "order": 30,
                "periods": 16,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Meaning and types of economic integration",
                        "code": "1.1",
                        "order": 1,
                        "periods": 4,
                        "outcomes": [
                            ("Define regional economic integration and its levels", "knowledge", 1),
                            ("Explain free trade areas, customs unions, common markets, and economic unions", "comprehension", 2),
                            ("Distinguish between the different stages of economic integration", "analysis", 3)
                        ]
                    },
                    {
                        "title": "The East African Community",
                        "code": "1.2",
                        "order": 2,
                        "periods": 5,
                        "outcomes": [
                            ("Describe the structure and objectives of the EAC", "knowledge", 1),
                            ("Explain the benefits and challenges of EAC membership for Tanzania", "comprehension", 2),
                            ("Analyse the impact of EAC common market on Tanzanian businesses", "analysis", 3)
                        ]
                    },
                    {
                        "title": "African Continental Free Trade Area and SADC",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Define the AfCFTA and its objectives", "knowledge", 1),
                            ("Explain Tanzania's membership in SADC and its trade implications", "comprehension", 2),
                            ("Evaluate the potential of AfCFTA for Tanzanian exporters", "evaluation", 3)
                        ]
                    },
                    {
                        "title": "Challenges and opportunities of regional trade",
                        "code": "1.4",
                        "order": 4,
                        "periods": 3,
                        "outcomes": [
                            ("Identify barriers to regional economic integration in Africa", "knowledge", 1),
                            ("Explain how infrastructure development promotes regional trade", "comprehension", 2),
                            ("Synthesise strategies for Tanzania to maximise benefits from regional integration", "synthesis", 3)
                        ]
                    }
                ]
            }
        ],
    },
]


def _new_subject(db: Session, subj_data: dict) -> SyllabusSubject:
    """Create a brand-new subject row with all its topics, subtopics and outcomes."""
    subject = SyllabusSubject(
        id=_uuid(),
        name=subj_data["name"],
        code=subj_data["code"],
        slug=subj_data["slug"],
        description=subj_data.get("description"),
        necta_code=subj_data.get("necta_code"),
        form_start=subj_data.get("form_start", 1),
        form_end=subj_data.get("form_end", 4),
        is_core=subj_data.get("is_core", True),
    )
    db.add(subject)
    db.flush()
    _seed_topics(db, subject, subj_data)
    return subject


def _seed_topics(db: Session, subject: SyllabusSubject, subj_data: dict) -> int:
    """Additively seed topics for an existing (or just-created) subject.

    Topics already present (matched by title + form_level for the subject) are
    skipped; missing topics — including their subtopics and learning outcomes —
    are appended. Returns the number of topics newly added.
    """
    existing = {
        (t.subject_id, t.title, t.form_level)
        for t in db.query(SyllabusTopic).filter(SyllabusTopic.subject_id == subject.id).all()
    }
    added = 0
    for topic_data in subj_data.get("topics", []):
        key = (subject.id, topic_data["title"], topic_data["form_level"])
        if key in existing:
            continue
        existing.add(key)
        topic = SyllabusTopic(
            id=_uuid(),
            subject_id=subject.id,
            title=topic_data["title"],
            code=topic_data.get("code"),
            description=topic_data.get("description"),
            form_level=topic_data["form_level"],
            order_index=topic_data.get("order", 0),
            estimated_periods=topic_data.get("periods"),
            necta_weight=topic_data.get("weight"),
        )
        db.add(topic)
        db.flush()

        for sub_data in topic_data.get("subtopics", []):
            subtopic = SyllabusSubtopic(
                id=_uuid(),
                topic_id=topic.id,
                title=sub_data["title"],
                code=sub_data.get("code"),
                description=sub_data.get("description"),
                order_index=sub_data.get("order", 0),
                estimated_periods=sub_data.get("periods"),
            )
            db.add(subtopic)
            db.flush()

            for i, (outcome_desc, cog_level, order) in enumerate(sub_data.get("outcomes", [])):
                outcome = LearningOutcome(
                    id=_uuid(),
                    subtopic_id=subtopic.id,
                    description=outcome_desc,
                    cognitive_level=cog_level,
                    order_index=order if order else i + 1,
                )
                db.add(outcome)
        added += 1
    return added


def run() -> None:
    """Seed the NECTA/TIE syllabus data into the database.

    Additive at topic level: existing subjects are updated (form range widened,
    missing A-Level topics appended), brand-new subjects are created whole.
    Safe to re-run in local and production environments.
    """
    init_db()
    db: Session = next(get_db())
    try:
        subjects_by_code = {
            s.code: s for s in db.query(SyllabusSubject).all()
        }
        new_subjects = 0
        new_topics = 0
        for subj_data in NECTA_SYLLABUS:
            code = subj_data["code"]
            existing = subjects_by_code.get(code)
            try:
                if existing is None:
                    _new_subject(db, subj_data)
                    subjects_by_code[code] = db.query(SyllabusSubject).filter(
                        SyllabusSubject.code == code
                    ).one()
                    new_subjects += 1
                    print(f"  [OK] Seeded {subj_data['name']} ({code})")
                    db.commit()
                    continue

                # Widen the form range if the syllabus now spans more forms.
                if subj_data.get("form_end", 4) > existing.form_end:
                    existing.form_end = subj_data["form_end"]
                if subj_data.get("form_start", 1) < existing.form_start:
                    existing.form_start = subj_data["form_start"]
                if subj_data.get("description"):
                    existing.description = subj_data["description"]

                added = _seed_topics(db, existing, subj_data)
                new_topics += added
                db.commit()
                if added:
                    print(f"  [OK] {subj_data['name']} ({code}) appended {added} new topic(s)")
            except Exception:
                db.rollback()
                raise

        print()
        print(f"  NECTA/TIE syllabus seeded successfully "
              f"({new_subjects} new subject(s), {new_topics} new topic(s))!")
        print()

        # Print summary
        total_subjects = db.query(SyllabusSubject).count()
        total_topics = db.query(SyllabusTopic).count()
        total_subtopics = db.query(SyllabusSubtopic).count()
        total_outcomes = db.query(LearningOutcome).count()

        print(f"  Subjects:    {total_subjects}")
        print(f"  Topics:      {total_topics}")
        print(f"  Subtopics:   {total_subtopics}")
        print(f"  Outcomes:    {total_outcomes}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
