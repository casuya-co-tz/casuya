// Single source of truth for which capabilities the Casuya platform actually
// exposes. The homepage renders from this so a feature is only shown when the
// system genuinely provides it — no marketing claims for un-wired features.
//
// `enabled: true` means a corresponding backend router/endpoint exists.
// `aiAssistant` is enabled — the AI service is available and mounted.

export const FEATURES = {
  interactiveLessons: {
    enabled: true,
    icon: "📚",
    title: "Interactive Lessons",
    blurb: "Lessons that feel more like a game — quizzes and activities that mark themselves as you go. You can re-read a topic until it truly sticks.",
    hero: true,
    trusted: false,
  },
  offlineLearning: {
    enabled: true,
    icon: "📶",
    title: "Offline Learning",
    blurb: "Power cut? Long daladala ride? Download a topic once when the network is good, then study it anywhere — even where the signal never reaches.",
    hero: true,
    trusted: true,
  },
  aiAssistant: {
    enabled: true,
    icon: "🤖",
    title: "AI Teacher Assistant",
    blurb: "Preparing a quiz late at night? Ask Casuya to draft it in minutes — in English or Kiswahili. A second pair of hands for busy teachers.",
    hero: true,
    trusted: false,
  },
  analytics: {
    enabled: true,
    icon: "📊",
    title: "Progress You Can See",
    blurb: "At a glance, see which topic the class is struggling with — no digging through stacks of marked papers at the end of term.",
    hero: true,
    trusted: false,
  },
  assessments: {
    enabled: true,
    icon: "📝",
    title: "Assessments",
    blurb: "Set quizzes, questionnaires and modular assignments in a couple of minutes — built to fit how lessons actually run in class.",
    hero: false,
    trusted: false,
  },
  cloudSync: {
    enabled: true,
    icon: "☁️",
    title: "Cloud Sync",
    blurb: "Your marks and progress are kept safe, and sync the moment a connection appears. Nothing is lost when the phone restarts.",
    hero: false,
    trusted: true,
  },
  digitalExaminations: {
    enabled: true,
    icon: "🧪",
    title: "Digital Examinations",
    blurb: "Run secure, browser-based exams that grade themselves and keep results safe — with automatic marking and instant, honest results.",
    hero: false,
    trusted: true,
  },
  aiLessonCreation: {
    enabled: true,
    icon: "✨",
    title: "AI Lesson Creation",
    blurb: "Generate lesson outlines, quizzes and study materials in minutes — a steady helper when the school day has already been long.",
    hero: false,
    trusted: true,
  },
};

// Personas shown in the "Tailored Experiences" section. Parents/Schools are
// served through the student/teacher experience, not separate account roles.
export const PERSONAS = [
  { icon: "👨‍🏫", title: "Teachers", points: ["Create rich digital content", "Coordinate modular cohorts", "Evaluate metrics streams"] },
  { icon: "👩‍🎓", title: "Students", points: ["Study from any location", "Interact with tests offline", "Monitor learning records"] },
  { icon: "👨‍👩‍👧", title: "Parents", points: ["Observe progress trackers", "View localized updates"] },
  { icon: "🏫", title: "Schools", points: ["Optimize staff delegation", "Export complex analytical datasets"] },
];

export function enabledFeatures() {
  return Object.values(FEATURES).filter((f) => f.enabled);
}
