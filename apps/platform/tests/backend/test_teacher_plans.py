"""Tests for teacher plan (lesson plan / scheme of work) generation and CRUD.

This module is a thin facade that re-exports every test from the focused,
themed sub-test files so that pytest (and existing CI commands targeting this
file) still discover the full suite. The focused files live alongside this
one:

- test_plan_generation.py  — AI lesson plan/scheme generation, repair, fallback
- test_plan_offline_render.py     — offline lesson plan builder rendering (EN/SW)
- test_plan_offline_grounding.py  — offline lesson plan TIE/KB/reference grounding
- test_plan_offline_verified.py  — offline verified Physics Form One plan
- test_scheme_work.py      — scheme of work generation (physics, midterm periods)
- test_plan_crud.py        — plan save/list/get/delete/export API + role checks
- test_plan_utils.py       — utility functions, verbatim TIE competences, syllabus
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from test_plan_generation import *  # noqa: F401,F403,E402
from test_plan_offline_render import *  # noqa: F401,F403,E402
from test_plan_offline_grounding import *  # noqa: F401,F403,E402
from test_plan_offline_verified import *  # noqa: F401,F403,E402
from test_scheme_work import *  # noqa: F401,F403,E402
from test_plan_crud import *  # noqa: F401,F403,E402
from test_plan_utils import *  # noqa: F401,F403,E402
