"""Tests for the reference library (mapper, service, and API).

Facade file — imports all sub-modules so ``pytest`` discovers every test
when running this file directly.
"""

from tests.backend.test_ref_mapper import (  # noqa: F401
    test_map_form_level,
    test_map_subject_slug_en_and_sw,
    test_map_subject_slug_unmappable,
    test_parse_metadata,
)
from tests.backend.test_ref_service import (  # noqa: F401
    test_service_browse_by_type,
    test_service_get_by_source_and_serialize,
    test_service_search_filters,
)
from tests.backend.test_ref_api import (  # noqa: F401
    test_api_get_by_id_404_and_invalid_type,
    test_api_pagination,
    test_api_search_and_get_by_id,
    test_api_stats_and_browse,
)
from tests.backend.test_ref_seed import (  # noqa: F401
    test_bundled_seed_is_idempotent,
    test_bundled_seed_purges_conflicting_online_duplicates,
    test_title_level_dedup_removes_online_duplicates_without_bundled_docs,
)
from tests.backend.test_ref_seed_grounding import (  # noqa: F401
    test_fetch_grounding_no_match_stays_negative,
    test_fetch_grounding_selects_verified_bundled_form_two_lesson,
    test_fetch_grounding_selects_verified_bundled_lesson,
    test_scheme_grounding_form_two_selects_verified_term_rows,
    test_scheme_grounding_selects_verified_term_rows,
)
