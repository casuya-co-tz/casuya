export function kindLabel(kind: string): string {
  switch (kind) {
    case 'marking_scheme':
      return 'MARKING SCHEME';
    case 'exam_format':
      return 'EXAM FORMAT';
    case 'syllabus':
      return 'SYLLABUS';
    case 'lesson':
      return 'LESSON PLAN';
    case 'scheme':
      return 'SCHEME OF WORK';
    case 'reference':
      return 'REFERENCES';
    default:
      return 'EXAM';
  }
}