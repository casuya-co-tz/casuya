"""Generate Biology Form 1 reference data.

Thin wrapper that delegates to the topic-specific modules:
  - generate_bio_f1_scheme.py  (scheme of work JSON)
  - generate_bio_f1_topics.py  (lesson plan JSON)
"""
from generate_bio_f1_scheme import generate as generate_scheme
from generate_bio_f1_topics import generate as generate_topics

if __name__ == "__main__":
    generate_scheme()
    generate_topics()
