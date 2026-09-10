"""Mathematics Form 1 lesson-plan data.

Pure data module: the verbatim educator-verified `math_lessons_data` tuple of
lesson-plan records consumed by the thin logic module
`generate_math_f1_topics.py`.
"""

from ._term1 import math_lessons_data_t1
from ._term2 import math_lessons_data_t2
from ._term2_tail import math_lessons_data_t2_tail

math_lessons_data = math_lessons_data_t1 + math_lessons_data_t2 + math_lessons_data_t2_tail
