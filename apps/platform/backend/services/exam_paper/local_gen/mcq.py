"""Local MCQ builders grounded in lesson text."""

from __future__ import annotations

import random
import re

from .cleaning import _pick_salient_word


_MCQ_QUESTIONS = [
    "Which of the following is a {concept}?",
    "What is the correct definition of {concept}?",
    "Which statement about {concept} is TRUE?",
    "In the context of this lesson, {concept} refers to:",
    "Which of the following best describes {concept}?",
]


def _build_mcq(sentence: str, terms: list[str], rng: random.Random, qno: int = 0) -> dict | None:
    if not sentence or not terms:
        return None
    if re.search(r"[\\${}]", sentence) or len(sentence) < 50:
        return None
    if not re.search(r"[aeiou]{3,}", sentence.lower()):
        return None
    picked = _pick_salient_word(sentence)
    if picked is None:
        return None
    salient, _ = picked
    concept = salient.lower()
    phrasing = _MCQ_QUESTIONS[qno % len(_MCQ_QUESTIONS)].format(concept=concept)
    correct = sentence
    wrong_pool = [t for t in terms if t.lower() != concept and not re.search(r"[\\${}]", t) and " " not in t]
    rng.shuffle(wrong_pool)
    distractors: list[str] = []
    for t in wrong_pool[:3]:
        alt = sentence.replace(salient, t, 1) if t.lower() not in sentence.lower() else sentence.replace(salient, "not " + t, 1)
        if not re.search(r"[\\${}]", alt):
            distractors.append(alt)
    while len(distractors) < 3:
        idx = len(distractors)
        if idx % 2:
            distractors.append(sentence.replace(salient, "not " + salient, 1))
        else:
            distractors.append(sentence.replace(salient, salient + "s", 1))
    pool = [correct] + distractors[:3]
    order = list(range(len(pool)))
    rng.shuffle(order)
    options = [f"{chr(65 + i)}. {re.sub(r'\\s+', ' ', pool[order[i]]).strip()}" for i in range(len(order))]
    return {
        "text": phrasing,
        "options": options,
        "answer": order.index(0),
    }


_TOPIC_MCQ = [
    ("What is the main subject of this lesson?", ["{subject}", "History", "Geography", "Literature"]),
    ("Which topic does this lesson focus on?", ["{topic}", "Economics", "Biology", "Physics"]),
    ("What type of content does this lesson cover?", ["{subject} concepts and principles", "Sports training", "Cooking recipes", "Music theory"]),
    ("In which academic area is this lesson categorised?", ["{subject}", "Physical Education", "Art and Design", "Computer Science"]),
    ("What is the primary learning objective of this lesson?", ["Understanding {topic}", " memorising dates", " learning recipes", " practising sports"]),
]


def _build_topic_mcq(ctx: dict, qno: int) -> dict:
    subject = ctx.get("subject_name") or "the subject"
    topic = ctx.get("topic_title") or ctx.get("subtopic_title") or "the topic"
    q_template, opts_template = _TOPIC_MCQ[qno % len(_TOPIC_MCQ)]
    question = q_template.format(subject=subject, topic=topic)
    correct = opts_template[0].format(subject=subject, topic=topic)
    distractors = [o.format(subject=subject, topic=topic) for o in opts_template[1:]]
    pool = [correct] + distractors
    order = list(range(len(pool)))
    random.shuffle(order)
    options = [f"{chr(65 + i)}. {pool[order[i]]}" for i in range(len(order))]
    return {
        "text": question,
        "options": options,
        "answer": order.index(0),
    }