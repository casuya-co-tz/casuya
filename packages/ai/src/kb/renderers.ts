/**
 * Runtime document renderers.
 *
 * These convert a raw knowledge-base JSON document back into readable, compact
 * text for RAG context injection. They mirror the extraction logic used at build
 * time but are lightweight TS fns so the running service can lazily render the
 * small handful of documents that match a query without shipping bulk artifacts.
 */

function stripMd(md: string): string {
  return String(md)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderSyllabus(data: any): string {
  const lines: string[] = [];
  lines.push(`SYLLABUS: ${data.subject_name || ''} (${data.subject_code || ''})`);
  lines.push(`LEVEL: ${data.level || ''}`);
  if (Array.isArray(data.units)) {
    for (const unit of data.units) {
      lines.push('');
      lines.push(`UNIT ${unit.unit_number}: ${unit.unit_title} (Form ${unit.form})`);
      if (Array.isArray(unit.topics)) {
        for (const topic of unit.topics) {
          lines.push(`  TOPIC ${topic.competence_code}: ${topic.topic_name}`);
          if (Array.isArray(topic.lessons)) {
            for (const lesson of topic.lessons) {
              let entry = `    LESSON ${lesson.lesson_id}: ${lesson.title}`;
              if (lesson.markdown_content && lesson.markdown_content !== lesson.title) {
                entry += `\n${stripMd(lesson.markdown_content)}`;
              }
              lines.push(entry);
            }
          }
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

function renderExam(data: any): string {
  const lines: string[] = [];
  lines.push(`EXAM: ${data.subject || ''} ${data.year || ''}`);
  lines.push(`LEVEL: ${data.level || ''}`);
  if (data.form) lines.push(`FORM: ${data.form}`);
  if (data.duration) lines.push(`DURATION: ${data.duration}`);
  if (data.total_marks) lines.push(`TOTAL MARKS: ${data.total_marks}`);
  if (data.instructions) lines.push(`INSTRUCTIONS: ${data.instructions}`);
  if (Array.isArray(data.sections)) {
    for (const sec of data.sections) {
      const secLabel = `SECTION ${sec.name || ''}${sec.marks != null ? ' (' + sec.marks + ' marks)' : ''}`.trim();
      lines.push('');
      lines.push(secLabel);
      if (Array.isArray(sec.questions)) {
        for (const q of sec.questions) {
          const label = q.number != null ? `Q${q.number}` : '';
          const type = q.type ? `[${q.type}]` : '';
          const raw = String(q.text || q.question || '').trim();
          const clean = raw.replace(/choose answer\s*:[:\s-]*$/i, '').trim();
          if (clean) lines.push(`  ${label} ${type} ${clean}`);
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

function renderMarkingScheme(data: any): string {
  const lines: string[] = [];
  lines.push(`MARKING SCHEME: ${data.subject || ''} (${data.code || ''})`);
  lines.push(`LEVEL: ${data.level || ''} | YEAR: ${data.year || ''} | MAX: ${data.max_marks != null ? data.max_marks : ''}`);
  if (Array.isArray(data.sections)) {
    for (const sec of data.sections) {
      lines.push('');
      lines.push(`SECTION ${sec.name || ''} (${sec.marks != null ? sec.marks + ' marks' : ''})`);
      if (Array.isArray(sec.questions)) {
        for (const q of sec.questions) {
          const answers = Array.isArray(q.answers) ? q.answers.join(', ') : q.answer || '';
          lines.push(`  Q${q.number} [${q.type || ''}] answers: ${answers}`);
          if (q.detail) lines.push(`    ${q.detail}`);
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

function renderExamFormat(data: any): string {
  const lines: string[] = [];
  const name = data.subject || data.name || data.level || 'Exam Format';
  lines.push(`EXAM FORMAT: ${name}`);
  if (data.level) lines.push(`LEVEL: ${data.level}`);
  if (data.duration) lines.push(`DURATION: ${data.duration}`);
  if (data.total_marks) lines.push(`TOTAL MARKS: ${data.total_marks}`);
  if (Array.isArray(data.subjects)) {
    for (const s of data.subjects) {
      const subjName = s.subject || s.name || s.code || '';
      lines.push('');
      lines.push(`SUBJECT: ${subjName}`);
      if (s.code) lines.push(`  CODE: ${s.code}`);
      if (s.duration) lines.push(`  DURATION: ${s.duration}`);
      if (s.total_marks) lines.push(`  TOTAL MARKS: ${s.total_marks}`);
      if (Array.isArray(s.sections)) {
        for (const sec of s.sections) {
          const secLabel = `${sec.name || 'Section'} (${sec.marks || sec.marks_percentage || ''}${sec.marks ? ' marks' : ''})`;
          lines.push(`  ${secLabel}`);
          const desc = sec.description || sec.instructions || sec.notes || sec.items_description || '';
          if (desc) lines.push(`    ${stripMd(String(desc))}`);
          if (Array.isArray(sec.items)) {
            for (const it of sec.items.slice(0, 30)) {
              const itemText = `${it.number || it.item || ''} ${it.type || ''} ${stripMd(String(it.description || it.instructions || ''))}`.trim();
              if (itemText) lines.push(`    - ${itemText}`);
            }
          }
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

function renderLesson(data: any): string {
  const lines: string[] = [];
  lines.push(`LESSON PLAN: ${data.subject || ''} ${data.form || ''}`);
  if (Array.isArray(data.topics)) {
    for (const t of data.topics) {
      lines.push('');
      lines.push(`TOPIC ${t.topic_number}: ${t.topic_name}`);
      const p = t.plan || {};
      if (p.competence) lines.push(`  COMPETENCE: ${p.competence}`);
      if (p.general_objectives) lines.push(`  OBJECTIVES: ${p.general_objectives}`);
      if (p.specific_objectives) lines.push(`  SPECIFIC OBJECTIVES: ${p.specific_objectives}`);
      if (p.main_topic) lines.push(`  MAIN TOPIC: ${p.main_topic}`);
      if (p.sub_topic) lines.push(`  SUB TOPIC: ${p.sub_topic}`);
      if (p.teaching_aids) lines.push(`  AIDS: ${p.teaching_aids}`);
      if (Array.isArray(p.teaching_structure)) {
        for (const st of p.teaching_structure.slice(0, 20)) {
          const stage = st.stage || 'Stage';
          lines.push(`  ${stage} (${st.time || ''} min): T: ${st.teacher_activities || ''} | S: ${st.student_activities || ''}`);
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

function renderScheme(data: any): string {
  const lines: string[] = [];
  for (const key of ['subject', 'form', 'academic_year', 'scheme_name', 'term']) {
    if (data[key]) lines.push(`${String(key).toUpperCase()}: ${data[key]}`);
  }
  const rows: string[] = [];
  collectSchemeRows(data, rows, 0);
  if (rows.length) {
    lines.push('');
    for (const row of rows.slice(0, 60)) lines.push(`- ${row}`);
  }
  if (lines.length <= 3) {
      return JSON.stringify(data).replace(/[{}[\],"]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return lines.filter(Boolean).join('\n');
}

function collectSchemeRows(obj: any, out: string[], depth: number): void {
  if (depth > 4) return;
  if (Array.isArray(obj)) {
    for (const item of obj) collectSchemeRows(item, out, depth + 1);
    return;
  }
  if (obj && typeof obj === 'object') {
    const textish: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (typeof v === 'string' && /week|topic|competence|objective|activity|lesson|sub.?topic|period|date/i.test(k)) {
        if (v.trim()) textish.push(`${k}: ${v.trim()}`);
      }
    }
    if (textish.length) out.push(textish.join(' | '));
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') collectSchemeRows(v, out, depth + 1);
    }
  }
}

function renderReferences(data: any): string {
  const lines: string[] = [];
  for (const [subject, refs] of Object.entries(data)) {
    lines.push(`REFERENCES — ${subject}`);
    if (Array.isArray(refs)) {
      for (const r of (refs as any[]).slice(0, 300)) {
        const text = r.full_text || (r.author ? `${r.author} (${r.year || ''}) ${r.title}` : r.title || '');
        if (text) lines.push(`- ${text}`);
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

export function renderDoc(kind: string, data: any): string {
  switch (kind) {
    case 'syllabus':
      return renderSyllabus(data);
    case 'exam':
      return renderExam(data);
    case 'marking_scheme':
      return renderMarkingScheme(data);
    case 'exam_format':
      return renderExamFormat(data);
    case 'lesson':
      return renderLesson(data);
    case 'scheme':
      return renderScheme(data);
    case 'reference':
      return renderReferences(data);
    default:
    return JSON.stringify(data).replace(/[{}[\],"]/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

export function renderSnippet(data: any, kind: string, maxChars = 240): string {
  const text = renderDoc(kind, data);
  const firstLine = text.split('\n').find((l) => l.trim().length > 0);
  return (firstLine || text).slice(0, maxChars);
}
