import hashlib
import uuid
from pathlib import Path

from backend.config.database import init_db, get_db
from backend.config.security import hash_password
from backend.models.lesson import Subject, Topic, Subtopic, Lesson
from backend.models.lesson_version import LessonVersion
from backend.models.role import Role
from backend.models.student import Student
from backend.models.teacher import Teacher
from backend.models.user import User
from backend.models.game import Game
from backend.models.quiz import Quiz
from sqlalchemy.orm import Session

settings_from_config = None


def _settings():
    global settings_from_config
    if settings_from_config is None:
        from backend.config.settings import get_settings

        settings_from_config = get_settings()
    return settings_from_config


def run():
    init_db()
    db: Session = next(get_db())
    if db.query(User).first():
        print("Database already seeded, skipping.")
        return

    for role_name in ("student", "teacher", "admin"):
        db.add(Role(name=role_name, description=f"{role_name.capitalize()} role"))

    admin = User(email="admin@casuya.co.tz", hashed_password=hash_password("admin123"), role="admin", is_active=True)
    teacher = User(
        email="teacher@casuya.co.tz", hashed_password=hash_password("teacher123"), role="teacher", is_active=True
    )
    student = User(
        email="student@casuya.co.tz", hashed_password=hash_password("student123"), role="student", is_active=True
    )
    extra_student = User(
        email="student2@casuya.co.tz", hashed_password=hash_password("student123"), role="student", is_active=True
    )
    db.add_all([admin, teacher, student, extra_student])
    db.flush()

    db.add(Teacher(user_id=teacher.id, full_name="Demo Teacher", school_code="DEMO"))
    db.add(Student(user_id=student.id, full_name="Demo Student", form_level="I", school_code="DEMO"))
    db.add(Student(user_id=extra_student.id, full_name="Extra Student", form_level="II", school_code="DEMO"))

    subjects_data = [
        ("Mathematics", "mathematics"),
        ("Chemistry", "chemistry"),
        ("Physics", "physics"),
        ("Biology", "biology"),
        ("English", "english"),
        ("Kiswahili", "kiswahili"),
    ]
    subjects = {}
    for name, slug in subjects_data:
        subj = Subject(name=name, slug=slug)
        db.add(subj)
        db.flush()
        subjects[slug] = subj

    form_levels = ["I", "II", "III", "IV"]
    topics_data = [
        ("mathematics", "Algebra", "I"),
        ("mathematics", "Geometry", "II"),
        ("mathematics", "Trigonometry", "III"),
        ("chemistry", "Atomic Structure", "I"),
        ("chemistry", "Chemical Bonding", "II"),
        ("physics", "Mechanics", "I"),
        ("physics", "Thermodynamics", "II"),
        ("biology", "Cell Biology", "I"),
        ("biology", "Genetics", "III"),
        ("english", "Grammar", "I"),
        ("english", "Literature", "II"),
        ("kiswahili", "Sarufi", "I"),
        ("kiswahili", "Fasihi", "II"),
    ]
    topics = {}
    for subj_slug, title, form in topics_data:
        topic = Topic(subject_id=subjects[subj_slug].id, title=title, form_level=form)
        db.add(topic)
        db.flush()
        topics[title] = topic

    subtopics_data = [
        ("Algebra", "Linear Equations"),
        ("Algebra", "Quadratic Equations"),
        ("Geometry", "Triangles"),
        ("Atomic Structure", "Protons and Electrons"),
        ("Cell Biology", "Cell Division"),
        ("Grammar", "Parts of Speech"),
        ("Sarufi", "Ngeli za Kiswahili"),
    ]
    for topic_title, sub_title in subtopics_data:
        db.add(Subtopic(topic_id=topics[topic_title].id, title=sub_title))
    db.flush()

    linear_eq_subtopic = db.query(Subtopic).filter(Subtopic.title == "Linear Equations").first()
    html = """<h1>Introduction to Linear Equations</h1>
<p>A linear equation is an equation that makes a straight line when it is plotted on a graph.</p>
<h2>Examples</h2>
<ul>
<li>2x + 3 = 7</li>
<li>y = mx + c</li>
<li>3x - 5 = 10</li>
</ul>
<h2>Solving Linear Equations</h2>
<p>To solve a linear equation, isolate the variable on one side of the equation.</p>
<pre>2x + 3 = 7
2x = 7 - 3
2x = 4
x = 2</pre>"""
    lesson_slug = "introduction-to-linear-equations-" + uuid.uuid4().hex[:8]
    content_hash = hashlib.sha256(html.encode()).hexdigest()
    lesson = Lesson(
        subtopic_id=linear_eq_subtopic.id,
        slug=lesson_slug,
        title="Introduction to Linear Equations",
        content_hash=content_hash,
        status="published",
    )
    db.add(lesson)
    db.flush()
    s = _settings()
    pkg_dir = Path(s.storage_root) / "lesson-packages"
    slug = lesson_slug
    shard = pkg_dir / slug[:2] / slug[2:4]
    shard.mkdir(parents=True, exist_ok=True)
    package_path = shard / f"{slug}.html"
    package_path.write_text(html, encoding="utf-8")
    version = LessonVersion(
        lesson_id=lesson.id,
        package_version="1.0.0",
        content_hash=content_hash,
        package_path=str(package_path),
    )
    db.add(version)

    sample_game = Game(
        lesson_id=lesson.id,
        title="Math Challenge",
        package_path="games/math-challenge.pkg",
    )
    db.add(sample_game)

    sample_quiz = Quiz(
        lesson_id=lesson.id,
        title="Algebra Basics Quiz",
    )
    db.add(sample_quiz)

    db.commit()
    print("Development data seeded successfully.")
    print()
    print("  Accounts:")
    print("    Admin:   admin@casuya.co.tz / admin123")
    print("    Teacher: teacher@casuya.co.tz / teacher123")
    print("    Student: student@casuya.co.tz / student123")
    print("    Student: student2@casuya.co.tz / student123")
    print()
    print("  Subjects:", len(subjects_data))
    print("  Topics:", len(topics_data))
    print("  Subtopics:", len(subtopics_data))
    print("  Lessons: 1")
    print("  Games: 1")
    print("  Quizzes: 1")


if __name__ == "__main__":
    run()
