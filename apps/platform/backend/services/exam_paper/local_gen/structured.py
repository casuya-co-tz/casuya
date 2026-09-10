"""Local structured and essay question templates."""

from __future__ import annotations


_STRUCTURED_TEMPLATES = [
    "Define the term \u201c{term}\u201d as used in this lesson.",
    "Explain, in your own words, what is meant by \u201c{term}\u201d.",
    "State two characteristics or properties of {term} mentioned in the lesson.",
    "Give two examples of {term} from the lesson.",
    "Describe the importance of {term} in the study of {subject}.",
]


def _build_structured(term: str, ctx: dict, i: int, terms: list[str]) -> dict:
    subject = ctx.get("subject_name") or "the subject"
    template = _STRUCTURED_TEMPLATES[i % len(_STRUCTURED_TEMPLATES)]
    return {"text": template.format(term=term, subject=subject)}


ESSAY_TEMPLATES = [
    "Write a well-organized essay on \u201c{topic}\u201d, using specific examples and facts from the lesson.",
    "Describe how \u201c{topic}\u201d is covered in this lesson. Your answer must refer to the key concepts, their relationships, and at least two concrete examples from the lesson text.",
    "Discuss the importance of \u201c{topic}\u201d in the study of {subject}. Support your answer with information from the lesson.",
]


def _build_essay(ctx: dict, i: int) -> dict:
    topic = ctx.get("topic_title") or ctx.get("subtopic_title") or ctx.get("lesson_title") or "the topic"
    subject = ctx.get("subject_name") or "the subject"
    template = ESSAY_TEMPLATES[i % len(ESSAY_TEMPLATES)]
    return {"text": template.format(topic=topic, subject=subject)}