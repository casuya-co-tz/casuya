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
        ("mathematics", "Concept of Mathematics", "I"),
        ("mathematics", "Numbers", "I"),
        ("mathematics", "Approximations", "I"),
        ("mathematics", "Ratios and Proportions", "I"),
        ("mathematics", "Algebra", "I"),
        ("mathematics", "Coordinate Geometry", "I"),
        ("mathematics", "Geometry", "II"),
        ("mathematics", "Trigonometry", "III"),
        ("chemistry", "Introduction to Chemistry", "I"),
        ("chemistry", "Laboratory Techniques and Safety", "I"),
        ("chemistry", "Fire, Firefighting and Flames", "I"),
        ("chemistry", "Matter", "I"),
        ("chemistry", "Elements, Compounds and Mixtures", "I"),
        ("chemistry", "Chemical Bonding", "II"),
        ("physics", "Introduction to Physics", "I"),
        ("physics", "Measurement", "I"),
        ("physics", "Introduction to Force", "I"),
        ("physics", "Density and Relative Density", "I"),
        ("physics", "Sinking and Floating", "I"),
        ("physics", "Mechanical Properties of Matter", "I"),
        ("physics", "Pressure", "I"),
        ("physics", "Linear Motion", "I"),
        ("physics", "Work, Energy, and Power", "I"),
        ("physics", "Thermodynamics", "II"),
        ("biology", "Introduction to Biology", "I"),
        ("biology", "Scientific Processes in Biology", "I"),
        ("biology", "Cell Structure and Organization", "I"),
        ("biology", "Classification of Living Things", "I"),
        ("biology", "Viruses and Major Groups of Living Things", "I"),
        ("biology", "Nutrition in Plants", "I"),
        ("biology", "Genetics", "III"),
        ("english", "Using ICT Tools to Search for Information", "I"),
        ("english", "Listening to Various Types of Information", "I"),
        ("english", "Producing Short and Coherent Oral Messages", "I"),
        ("english", "Developing Vocabulary from Conversations and Written Texts", "I"),
        ("english", "Using Appropriate Grammar and Vocabulary in Oral and Written Contexts", "I"),
        ("english", "Reading Texts for Comprehension", "I"),
        ("english", "Comprehending Oral Messages", "I"),
        ("english", "Responding Through Oral and Written Communication", "I"),
        ("english", "Using Appropriate Grammar and Vocabulary for Oral Communication", "I"),
        ("english", "Creating a Variety of Texts Using Appropriate Tone and Register", "I"),
        ("english", "Literature", "II"),
        ("kiswahili", "Lugha na Utamaduni", "I"),
        ("kiswahili", "Sarufi ya Kiswahili", "I"),
        ("kiswahili", "Matumizi ya Kamusi", "I"),
        ("kiswahili", "Kusikiliza Mazungumzo", "I"),
        ("kiswahili", "Kusoma kwa Ufasahana na Ufahamu", "I"),
        ("kiswahili", "Kuwasiliana kwa njia ya Mazungumzo", "I"),
        ("kiswahili", "Kuwasiliana kwa njia ya Maandishi", "I"),
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
        ("Introduction to Chemistry", "Concept of Chemistry"),
        ("Introduction to Chemistry", "Relationships of Chemistry with other related disciplines"),
        ("Introduction to Chemistry", "Applications of Chemistry in the development of a modern society"),
        ("Laboratory Techniques and Safety", "Laboratory Safety Measures"),
        ("Laboratory Techniques and Safety", "Handling Chemicals Safely / Safety Signs"),
        ("Laboratory Techniques and Safety", "Laboratory Rules"),
        ("Laboratory Techniques and Safety", "First Aid and First Aid Kit"),
        ("Laboratory Techniques and Safety", "Basic Chemistry Laboratory Apparatus"),
        ("Fire, Firefighting and Flames", "Fire (Components needed to start fire)"),
        ("Fire, Firefighting and Flames", "Firefighting (Portable fire extinguishers)"),
        ("Fire, Firefighting and Flames", "Flames (Bunsen burner, parts, and characteristics of flames)"),
        ("Matter", "States of Matter"),
        ("Matter", "Changes in States of Matter"),
        ("Matter", "Particulate and Kinetic Nature of Matter"),
        ("Matter", "Physical and Chemical Changes"),
        ("Elements, Compounds and Mixtures", "Elements and Chemical Symbols"),
        ("Elements, Compounds and Mixtures", "Metals and Non-metals"),
        ("Elements, Compounds and Mixtures", "Compounds and Mixtures"),
        ("Elements, Compounds and Mixtures", "Solutions, Suspensions and Emulsions"),
        ("Elements, Compounds and Mixtures", "Separation of Mixtures"),
        ("Introduction to Physics", "Concept of Physics"),
        ("Introduction to Physics", "Contribution of Physics to the development of modern society"),
        ("Introduction to Physics", "Theories and principles of Physics"),
        ("Measurement", "Concept of Measurement"),
        ("Measurement", "Physical Quantity"),
        ("Measurement", "Basic Equipment/Apparatus and their uses"),
        ("Introduction to Force", "Concept of Force"),
        ("Introduction to Force", "Effects of Forces"),
        ("Introduction to Force", "Types of Forces"),
        ("Density and Relative Density", "Concept of Density"),
        ("Density and Relative Density", "Relative Density of a Substance"),
        ("Sinking and Floating", "Concept of Sinking and Floating"),
        ("Sinking and Floating", "Concept of Upthrust"),
        ("Sinking and Floating", "Archimedes' Principle"),
        ("Sinking and Floating", "Law of Floatation"),
        ("Mechanical Properties of Matter", "Concept of Elasticity"),
        ("Mechanical Properties of Matter", "Adhesion and Cohesion"),
        ("Mechanical Properties of Matter", "Surface Tension"),
        ("Mechanical Properties of Matter", "Capillarity"),
        ("Pressure", "Concept of Pressure"),
        ("Pressure", "Pressure due to Solids"),
        ("Pressure", "Pressure in Liquids"),
        ("Pressure", "Atmospheric Pressure"),
        ("Linear Motion", "Concept of Motion"),
        ("Linear Motion", "Distance and Displacement"),
        ("Linear Motion", "Speed and Velocity"),
        ("Linear Motion", "Acceleration"),
        ("Linear Motion", "Equation of Linear Motion"),
        ("Linear Motion", "Motion under Gravity"),
        ("Work, Energy, and Power", "Concept of Work"),
        ("Work, Energy, and Power", "Concept of Energy"),
        ("Work, Energy, and Power", "Concept of Power"),
        ("Introduction to Biology", "Basic Concepts and Terminologies in Biology"),
        ("Introduction to Biology", "Importance of Studying Biology"),
        ("Introduction to Biology", "Relationship between Biology and other Scientific Fields"),
        ("Scientific Processes in Biology", "Common Biology Laboratory Apparati, Equipment and Other Resources"),
        ("Scientific Processes in Biology", "Basic Skills in Scientific Studies"),
        ("Scientific Processes in Biology", "Scientific Methods"),
        ("Scientific Processes in Biology", "Simple Biological Experiments"),
        ("Cell Structure and Organization", "The Cell"),
        ("Cell Structure and Organization", "Types of Cells"),
        ("Cell Structure and Organization", "Cell Differentiation"),
        ("Classification of Living Things", "Concept of Classification"),
        ("Classification of Living Things", "Classification Systems"),
        ("Classification of Living Things", "Major Groups of Living Things"),
        ("Classification of Living Things", "Binomial Nomenclature"),
        ("Viruses and Major Groups of Living Things", "Viruses"),
        ("Viruses and Major Groups of Living Things", "Kingdom Monera"),
        ("Viruses and Major Groups of Living Things", "Kingdom Protoctista"),
        ("Viruses and Major Groups of Living Things", "Kingdom Fungi"),
        ("Viruses and Major Groups of Living Things", "Kingdom Plantae"),
        ("Viruses and Major Groups of Living Things", "Classes of the Division Angiospermophyta"),
        ("Viruses and Major Groups of Living Things", "Kingdom Animalia"),
        ("Nutrition in Plants", "Concept of Nutrition"),
        ("Nutrition in Plants", "Photosynthesis"),
        ("Nutrition in Plants", "Structure of the Leaf in Relation to Photosynthesis"),
        ("Nutrition in Plants", "Importance of Photosynthesis"),
        ("Nutrition in Plants", "Essential and Non-essential Elements in Plants"),
        ("Concept of Mathematics", "Meaning of Mathematics"),
        ("Concept of Mathematics", "Branches of Mathematics"),
        ("Concept of Mathematics", "Relationship between Mathematics and other Subjects"),
        ("Concept of Mathematics", "Importance of Mathematics"),
        ("Numbers", "Concept of Numbers"),
        ("Numbers", "Rational Numbers"),
        ("Numbers", "Irrational Numbers"),
        ("Numbers", "Real Numbers"),
        ("Numbers", "Inequalities in Real Numbers"),
        ("Numbers", "Absolute Value of a Real Number"),
        ("Approximations", "Meaning of Approximations"),
        ("Approximations", "Rounding off Numbers"),
        ("Approximations", "Significant Figures"),
        ("Approximations", "Approximations in Calculations"),
        ("Ratios and Proportions", "Ratios"),
        ("Ratios and Proportions", "Proportions"),
        ("Coordinate Geometry", "Basic Concepts of Coordinate Geometry"),
        ("Coordinate Geometry", "Gradient of a Straight Line"),
        ("Coordinate Geometry", "Equation of a Straight Line"),
        ("Coordinate Geometry", "General Equation of a Straight Line"),
        ("Coordinate Geometry", "Graphing Linear Equations"),
        ("Coordinate Geometry", "Solving Linear Simultaneous Equations Graphically"),
        ("Using ICT Tools to Search for Information", "Familiarising with various types of search engines and browsers"),
        ("Using ICT Tools to Search for Information", "Utilising ICT tools to search for general information"),
        ("Listening to Various Types of Information", "Answering questions based on information from presentations/tasks"),
        ("Listening to Various Types of Information", "Practising pronunciation of words from oral, audio and audio-visual sources"),
        ("Producing Short and Coherent Oral Messages", "Producing short oral messages"),
        ("Producing Short and Coherent Oral Messages", "Using appropriate tone and register"),
        ("Developing Vocabulary from Conversations and Written Texts", "Building vocabulary from conversations"),
        ("Developing Vocabulary from Conversations and Written Texts", "Building vocabulary from written texts"),
        ("Reading Texts for Comprehension", "Reading for main ideas"),
        ("Reading Texts for Comprehension", "Reading for details"),
        ("Reading Texts for Comprehension", "Reading for inference"),
        ("Lugha na Utamaduni", "Matumizi ya lugha ya Kiswahili kama utambulisho wa Mtanzania"),
        ("Lugha na Utamaduni", "Hadhi ya Kiswahili"),
        ("Lugha na Utamaduni", "Matumizi ya lugha ya Kiswahili kama kielelezo cha utamaduni wa Mtanzania"),
        ("Lugha na Utamaduni", "Umuhimu wa kujifunza Kiswahili"),
        ("Sarufi ya Kiswahili", "Matamshi"),
        ("Sarufi ya Kiswahili", "Kusimulia habari kwa kuzingatia lafudhi sahihi"),
        ("Sarufi ya Kiswahili", "Kusimulia habari kwa kuzingatia kiimbo"),
        ("Sarufi ya Kiswahili", "Kusimulia habari kwa kuzingatia mkazo"),
        ("Matumizi ya Kamusi", "Kutumia msamiati kwa usahihi"),
        ("Matumizi ya Kamusi", "Kutumia taarifa za kamusi katika mawasiliano"),
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
