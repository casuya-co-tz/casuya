"""Biology Form 1 lesson-plan data.

Pure data module: the verbatim educator-verified `bio_lessons_data` tuple of
lesson-plan records consumed by the thin logic module
`generate_bio_f1_topics.py`.
"""

from ._term1 import bio_lessons_data_t1
from ._term2 import bio_lessons_data_t2
from ._term2_tail import bio_lessons_data_t2_tail

bio_lessons_data = bio_lessons_data_t1 + bio_lessons_data_t2 + bio_lessons_data_t2_tail
