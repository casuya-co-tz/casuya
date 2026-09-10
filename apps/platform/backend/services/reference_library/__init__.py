"""Reference library — browse/search imported official lessons and schemes."""

from backend.models.reference_doc import ReferenceDoc  # noqa: F401

from .browser import (  # noqa: F401
    count_reference_docs,
    get_reference_doc,
    get_reference_doc_by_source,
    list_reference_docs,
    render_reference_lesson_plan_html,
    render_reference_scheme_html,
    serialize_doc,
)
from .grounding import (  # noqa: F401
    fetch_reference_grounding,
    lesson_plan_grounding,
    scheme_of_work_grounding,
)
from .search import (  # noqa: F401
    map_form_level,
    map_subject_slug,
    parse_metadata,
)

__all__ = [
    # Public API
    "count_reference_docs",
    "get_reference_doc",
    "get_reference_doc_by_source",
    "list_reference_docs",
    "render_reference_lesson_plan_html",
    "render_reference_scheme_html",
    "serialize_doc",
    "fetch_reference_grounding",
    "lesson_plan_grounding",
    "scheme_of_work_grounding",
    "map_form_level",
    "map_subject_slug",
    "parse_metadata",
]
