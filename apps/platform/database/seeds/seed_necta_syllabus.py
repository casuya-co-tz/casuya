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
    # PHYSICS — NECTA Code 031
    # Source: TIE Physics Syllabus Form I-IV
    # ========================================================================
    {
        "name": "Physics",
        "code": "PHYS",
        "slug": "physics",
        "necta_code": "031",
        "is_core": True,
        "description": "Physics for Ordinary Secondary Education, Form I-IV. Covers measurement, forces, energy, waves, electricity, magnetism and modern physics.",
        "form_start": 1,
        "form_end": 4,
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
        "description": "Chemistry for Ordinary Secondary Education, Form I-IV. Covers matter, atomic structure, chemical bonding, reactions, organic chemistry and industrial chemistry.",
        "form_start": 1,
        "form_end": 4,
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
        "description": "Biology for Ordinary Secondary Education, Form I-IV. Covers cell biology, genetics, ecology, human physiology, plants, microorganisms and evolution.",
        "form_start": 1,
        "form_end": 4,
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
        "description": "English Language for Ordinary Secondary Education, Form I-IV. Covers grammar, composition, comprehension, literature and language skills.",
        "form_start": 1,
        "form_end": 4,
        "topics": [
            {
                "title": "GRAMMAR",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Parts of speech",
                        "code": "1.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Identify and use the eight parts of speech: nouns, pronouns, verbs, adjectives, adverbs, prepositions, conjunctions, interjections", "knowledge", 1),
                            ("Distinguish between common and proper nouns, and countable and uncountable nouns", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Tenses",
                        "code": "1.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Identify and use the twelve tenses correctly", "application", 1),
                            ("Use simple, continuous, perfect and perfect continuous tenses in past, present and future", "application", 2),
                        ],
                    },
                    {
                        "title": "Subject-verb agreement",
                        "code": "1.3",
                        "order": 3,
                        "periods": 5,
                        "outcomes": [
                            ("Apply rules of subject-verb agreement in sentences", "application", 1),
                        ],
                    },
                    {
                        "title": "Articles and determiners",
                        "code": "1.4",
                        "order": 4,
                        "periods": 5,
                        "outcomes": [
                            ("Use definite and indefinite articles correctly", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "VOCABULARY AND WORD FORMATION",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Synonyms and antonyms",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Identify and use synonyms and antonyms correctly", "application", 1),
                        ],
                    },
                    {
                        "title": "Word formation",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Form new words using prefixes, suffixes and compounding", "application", 1),
                            ("Use context clues to determine meaning of unfamiliar words", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Idioms and figurative language",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Identify and interpret idioms, similes, metaphors and personification", "analysis", 1),
                        ],
                    },
                ],
            },
            {
                "title": "COMPOSITION WRITING",
                "code": "3.0",
                "form_level": 1,
                "order": 3,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Essay writing",
                        "code": "3.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Plan and write narrative, descriptive and expository essays", "synthesis", 1),
                            ("Use appropriate paragraphing: introduction, body and conclusion", "application", 2),
                        ],
                    },
                    {
                        "title": "Letter writing",
                        "code": "3.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Write formal and informal letters following correct format", "application", 1),
                        ],
                    },
                    {
                        "title": "Summary and note-making",
                        "code": "3.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Summarize passages in a given word count", "application", 1),
                            ("Make notes from a passage using headings and bullet points", "application", 2),
                        ],
                    },
                ],
            },
            # ── FORM II ──────────────────────────────────────────────────────
            {
                "title": "COMPREHENSION AND LANGUAGE USE",
                "code": "1.0",
                "form_level": 2,
                "order": 4,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Reading comprehension",
                        "code": "1.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Read and understand passages to answer comprehension questions", "comprehension", 1),
                            ("Identify main ideas, supporting details, author's purpose and tone", "analysis", 2),
                            ("Make inferences and draw conclusions from passages", "analysis", 3),
                        ],
                    },
                    {
                        "title": "Sentence structure",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Construct simple, compound and complex sentences", "application", 1),
                            ("Use different types of clauses: main, subordinate, relative, adverbial", "application", 2),
                        ],
                    },
                    {
                        "title": "Active and passive voice",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Transform sentences between active and passive voice", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "LITERATURE IN ENGLISH",
                "code": "2.0",
                "form_level": 2,
                "order": 5,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Elements of literature",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Identify literary devices: metaphor, simile, personification, irony, foreshadowing, imagery", "knowledge", 1),
                            ("Analyze characterization, plot, theme, setting and style", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Types of literature",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Distinguish between prose (novels, short stories), poetry and drama", "analysis", 1),
                            ("Analyze poems for structure, rhyme, rhythm, meter and meaning", "analysis", 2),
                        ],
                    },
                    {
                        "title": "African literature",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Read and appreciate selected African literary works", "evaluation", 1),
                        ],
                    },
                ],
            },
            # ── FORM III & IV ────────────────────────────────────────────────
            {
                "title": "ADVANCED GRAMMAR AND USAGE",
                "code": "1.0",
                "form_level": 3,
                "order": 6,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Reported speech and conditionals",
                        "code": "1.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Transform direct speech to reported speech and vice versa", "application", 1),
                            ("Use zero, first, second and third conditionals correctly", "application", 2),
                        ],
                    },
                    {
                        "title": "Phrasal verbs and collocations",
                        "code": "1.2",
                        "order": 2,
                        "periods": 4,
                        "outcomes": [
                            ("Use common phrasal verbs in context", "application", 1),
                        ],
                    },
                    {
                        "title": "Cohesion and coherence in writing",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Use linking words and discourse markers to create coherent texts", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "ADVANCED COMPOSITION",
                "code": "2.0",
                "form_level": 4,
                "order": 7,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Argumentative and persuasive writing",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Write argumentative essays with clear thesis, supporting evidence and counter-arguments", "synthesis", 1),
                            ("Write persuasive texts using rhetorical techniques", "synthesis", 2),
                        ],
                    },
                    {
                        "title": "Formal report and dialogue writing",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Write formal reports following standard format", "application", 1),
                            ("Write dialogue that reveals character and advances plot", "synthesis", 2),
                        ],
                    },
                    {
                        "title": "Literary appreciation",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Write critical essays on prescribed literary texts", "evaluation", 1),
                            ("Compare and contrast themes across different literary works", "evaluation", 2),
                        ],
                    },
                ],
            },
        ],
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
        "description": "Kiswahili for Ordinary Secondary Education, Form I-IV. Covers sarufi (grammar), fasihi (literature), uandishi (writing) and ushairi (poetry).",
        "form_start": 1,
        "form_end": 4,
        "topics": [
            {
                "title": "SARUFI (GRMMAR)",
                "code": "1.0",
                "form_level": 1,
                "order": 1,
                "periods": 30,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Ngeli za Kiswahili (noun classes)",
                        "code": "1.1",
                        "order": 1,
                        "periods": 10,
                        "outcomes": [
                            ("Identify and use the 16 noun classes (ngeli) of Kiswahili", "application", 1),
                            ("Apply concord agreement between nouns and their modifiers", "application", 2),
                        ],
                    },
                    {
                        "title": "Viambishi (prefixes) and viambishi vya nyuma (suffixes)",
                        "code": "1.2",
                        "order": 2,
                        "periods": 10,
                        "outcomes": [
                            ("Identify and use prefixes: ki-, vi-, m-, wa-, u-, n-, mi-, ma-, etc.", "application", 1),
                            ("Use verb conjugation with tenses: wakati wa sasa, wa zamani, wa baadaye", "application", 2),
                        ],
                    },
                    {
                        "title": "Sentensi (sentence construction)",
                        "code": "1.3",
                        "order": 3,
                        "periods": 10,
                        "outcomes": [
                            ("Construct affirmative, negative, interrogative and imperative sentences", "application", 1),
                            ("Use conjunctions: na, au, lakini, kwa sababu, ingawa", "application", 2),
                        ],
                    },
                ],
            },
            {
                "title": "FASIHI SIMULIZI (PROSE LITERATURE)",
                "code": "2.0",
                "form_level": 1,
                "order": 2,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Tamthilia (plays/drama)",
                        "code": "2.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Identify elements of drama: character, plot, setting, dialogue, theme", "knowledge", 1),
                            ("Analyze characters and themes from prescribed plays", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Riwaya (novels)",
                        "code": "2.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Analyze plot structure, characters, themes and setting of prescribed novels", "analysis", 1),
                            ("Identify literary devices: methali, mshororo, aina ya lugha", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Tamshi la mafunzo (proverbs and sayings)",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Interpret and use Kiswahili proverbs (methali) in context", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "USHAIRI (POETRY)",
                "code": "3.0",
                "form_level": 1,
                "order": 3,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Stifa za ushairi (poetic elements)",
                        "code": "3.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Identify poetic elements: redio, kinaga ubaya, tungo, mistari, shairi", "knowledge", 1),
                            ("Analyze poems for rhyme, rhythm, meter and meaning", "analysis", 2),
                        ],
                    },
                    {
                        "title": "Ushairi wa kisasa na wa jadi (modern and traditional poetry)",
                        "code": "3.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Compare traditional and modern forms of Kiswahili poetry", "analysis", 1),
                            ("Compose poems on given themes", "synthesis", 2),
                        ],
                    },
                ],
            },
            # ── FORM II-IV (continuing Kiswahili curriculum) ────────────────
            {
                "title": "UANDISHI (WRITING)",
                "code": "1.0",
                "form_level": 2,
                "order": 4,
                "periods": 20,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Barua rasmi na barua binafsi (formal and informal letters)",
                        "code": "1.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Write formal and informal letters in Kiswahili following correct format", "application", 1),
                        ],
                    },
                    {
                        "title": "Insha (essays)",
                        "code": "1.2",
                        "order": 2,
                        "periods": 8,
                        "outcomes": [
                            ("Write narrative, descriptive and argumentative essays in Kiswahili", "synthesis", 1),
                        ],
                    },
                    {
                        "title": "Uchoraji wa barua (letter composition)",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Write application letters and business correspondence", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "MAALUM KWA WATANZANIA (TANZANIAN STUDIES)",
                "code": "2.0",
                "form_level": 3,
                "order": 5,
                "periods": 16,
                "weight": "medium",
                "subtopics": [
                    {
                        "title": "Historia ya Kiswahili (history of Kiswahili)",
                        "code": "2.1",
                        "order": 1,
                        "periods": 6,
                        "outcomes": [
                            ("Describe the history and development of Kiswahili as a national and international language", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Utamaduni wa Tanzania (Tanzanian culture)",
                        "code": "2.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Describe cultural practices of various Tanzanian ethnic groups", "comprehension", 1),
                        ],
                    },
                    {
                        "title": "Sayansi na teknolojia kwa Kiswahili (science and technology in Kiswahili)",
                        "code": "2.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Use Kiswahili scientific and technical vocabulary", "application", 1),
                        ],
                    },
                ],
            },
            {
                "title": "FASIHI ANDALI (LITERARY CRITICISM)",
                "code": "1.0",
                "form_level": 4,
                "order": 6,
                "periods": 18,
                "weight": "high",
                "subtopics": [
                    {
                        "title": "Uchambuzi wa fasihi (literary analysis)",
                        "code": "1.1",
                        "order": 1,
                        "periods": 8,
                        "outcomes": [
                            ("Write critical essays on prescribed Kiswahili literary works", "evaluation", 1),
                            ("Compare themes and styles across different literary works", "evaluation", 2),
                        ],
                    },
                    {
                        "title": "Tahakiki ya fasihi (literary criticism)",
                        "code": "1.2",
                        "order": 2,
                        "periods": 6,
                        "outcomes": [
                            ("Apply different approaches to literary criticism: mimetic, formalist, thematic", "evaluation", 1),
                        ],
                    },
                    {
                        "title": "Mapishi ya insha za fasihi (writing literary essays)",
                        "code": "1.3",
                        "order": 3,
                        "periods": 4,
                        "outcomes": [
                            ("Write well-structured literary essays with introduction, body and conclusion", "synthesis", 1),
                        ],
                    },
                ],
            },
        ],
    },
]


def _seed_subject(db: Session, subj_data: dict) -> None:
    """Seed one subject with all its topics, subtopics, and learning outcomes."""
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

    for topic_data in subj_data.get("topics", []):
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


def run() -> None:
    """Seed the NECTA/TIE syllabus data into the database."""
    init_db()
    db: Session = next(get_db())
    try:
        # Check if already seeded
        existing = db.query(SyllabusSubject).first()
        if existing:
            print("NECTA syllabus already seeded, skipping.")
            return

        for subj_data in NECTA_SYLLABUS:
            _seed_subject(db, subj_data)
            print(f"  [OK] Seeded {subj_data['name']} ({subj_data['code']})")

        db.commit()
        print()
        print("  NECTA/TIE syllabus seeded successfully!")
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
