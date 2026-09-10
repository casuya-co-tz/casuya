"""AI bridge — bridges casuya-platform to the casuya-ai TypeScript service.

Provides question generation, tutoring, and content analysis capabilities
by calling the casuya-ai service over HTTP. Falls back to local regex-based
generation when the AI service is unavailable.
"""

from .client import CASUYA_AI_URL, _call_ai_service  # noqa: F401
from .exam import generate_exam_paper  # noqa: F401
from .math import (  # noqa: F401
    convert_units,
    generate_math_steps,
    generate_physics_problem,
    solve_equation,
)
from .moderation import moderate_content, translate_content  # noqa: F401
from .prompts import (  # noqa: F401
    analyze_content,
    generate_practice_questions,
    generate_quiz_questions,
    get_tutoring_payload,
    get_tutoring_response,
)

__all__ = [
    # Public API
    "CASUYA_AI_URL",
    "_call_ai_service",
    "generate_exam_paper",
    "convert_units",
    "generate_math_steps",
    "generate_physics_problem",
    "solve_equation",
    "moderate_content",
    "translate_content",
    "analyze_content",
    "generate_practice_questions",
    "generate_quiz_questions",
    "get_tutoring_payload",
    "get_tutoring_response",
]
