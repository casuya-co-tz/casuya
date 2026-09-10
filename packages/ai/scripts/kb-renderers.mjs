// Document renderers: turn each KB JSON shape into a searchable + RAG-ready
// plain-text block.

function normSubject(s) {
  return (s || '')
    .replace(/_/g, ' ')
    .replace(/\bOLE\b|\bO level\b|\bO-Level\b/gi, '')
    .trim();
}

function stripMd(md) {
  return String(md)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MCQ_WORDS = new Set('which what how why who where when choose answer given alternatives'.split(' '));

/** Render a syllabus doc into a searchable + RAG-ready text block. */
function renderSyllabus(data) {
  const lines = [];
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

/** Render an exam doc (past paper or internal). */
function renderExam(data) {
  const lines = [];
  lines.push(`EXAM: ${data.subject || ''} ${data.year || ''}`);
  lines.push(`LEVEL: ${data.level || ''}`);
  if (data.form) lines.push(`FORM: ${data.form}`);
  if (data.duration) lines.push(`DURATION: ${data.duration}`);
  if (data.total_marks) lines.push(`TOTAL MARKS: ${data.total_marks}`);
  if (data.instructions) lines.push(`INSTRUCTIONS: ${data.instructions}`);
  if (Array.isArray(data.sections)) {
    for (const sec of data.sections) {
      lines.push('');
      lines.push(`SECTION ${sec.name}: ${sec.instructions || ''} (${sec.marks != null ? sec.marks + ' marks' : ''})`.trim());
      if (Array.isArray(sec.questions)) {
        for (const q of sec.questions) {
          const label = q.number != null ? `Q${q.number}` : '';
          const type = q.type ? `[${q.type}]` : '';
          const text = stripMd(q.text || q.question || '');
          // Trim redundant "Choose Answer : -" tails
          const clean = text.replace(/choose answer\s*:[:\s-]*$/i, '').trim();
          if (clean) lines.push(`  ${label} ${type} ${clean}`);
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

/** Render a marking scheme. */
function renderMarkingScheme(data) {
  const lines = [];
  lines.push(`MARKING SCHEME: ${data.subject || ''} (${data.code || ''})`);
  lines.push(`LEVEL: ${data.level || ''} | YEAR: ${data.year || ''} | MAX MARKS: ${data.max_marks != null ? data.max_marks : ''}`);
  if (Array.isArray(data.sections)) {
    for (const sec of data.sections) {
      lines.push('');
      lines.push(`SECTION ${sec.name} (${sec.marks != null ? sec.marks + ' marks' : ''})`);
      if (Array.isArray(sec.questions)) {
        for (const q of sec.questions) {
          const answers = Array.isArray(q.answers) ? q.answers.join(', ') : (q.answer || '');
          lines.push(`  Q${q.number} [${q.type || ''}] answers: ${answers}`);
          if (q.detail) lines.push(`    ${q.detail}`);
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

/** Render exam format (large parsed spec). */
function renderExamFormat(data) {
  const lines = [];
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
          const sn = sec.name || sec.section || 'Section';
          lines.push(`  ${sn} (${sec.marks || sec.marks_percentage || ''}${sec.marks ? ' marks' : ''})`);
          const desc = sec.description || sec.instructions || sec.notes || sec.items_description || '';
          if (desc) lines.push(`    ${stripMd(String(desc))}`);
          if (Array.isArray(sec.items)) {
            for (const it of sec.items.slice(0, 40)) {
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

/** Render a lesson plan. */
function renderLesson(data) {
  const lines = [];
  lines.push(`LESSON PLAN: ${data.subject || ''} ${data.form || ''}`);
  if (Array.isArray(data.topics)) {
    for (const t of data.topics) {
      lines.push('');
      lines.push(`TOPIC ${t.topic_number}: ${t.topic_name}`);
      const p = t.plan || {};
      if (p.competence) lines.push(`  COMPETENCE: ${p.competence}`);
      if (p.general_objectives) lines.push(`  GENERAL OBJECTIVES: ${p.general_objectives}`);
      if (p.specific_objectives) lines.push(`  SPECIFIC OBJECTIVES: ${p.specific_objectives}`);
      if (p.main_topic) lines.push(`  MAIN TOPIC: ${p.main_topic}`);
      if (p.sub_topic) lines.push(`  SUB TOPIC: ${p.sub_topic}`);
      if (p.teaching_aids) lines.push(`  TEACHING AIDS: ${p.teaching_aids}`);
      if (Array.isArray(p.teaching_structure)) {
        for (const st of p.teaching_structure) {
          const stage = st.stage || 'Stage';
          lines.push(`  ${stage} (${st.time || ''} min): TEACHER: ${st.teacher_activities || ''} | STUDENT: ${st.student_activities || ''}`);
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

/** Render a scheme of work. */
function renderScheme(data) {
  const json = JSON.stringify(data);
  // Schemes have varied shapes; fall back to a compact pretty-print of key table rows.
  const lines = [];
  for (const key of ['subject', 'form', 'academic_year', 'scheme_name', 'term']) {
    if (data[key]) lines.push(`${String(key).toUpperCase()}: ${data[key]}`);
  }
  const weekRows = collectSchemeRows(data);
  if (weekRows.length) {
    lines.push('');
    for (const row of weekRows) lines.push(`- ${row}`);
  }
  if (lines.length === 0 || lines.length <= 3) {
    return json.replace(/[{}\[\],"]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return lines.join('\n');
}

function collectSchemeRows(obj, out = [], depth = 0) {
  if (depth > 4) return out;
  if (Array.isArray(obj)) {
    for (const item of obj) collectSchemeRows(item, out, depth + 1);
    return out;
  }
  if (obj && typeof obj === 'object') {
    const textish = [];
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
  return out;
}

/** Render a references file (subject -> list of citations). */
function renderReferences(data) {
  const lines = [];
  for (const [subject, refs] of Object.entries(data)) {
    lines.push(`REFERENCES — ${subject}`);
    if (Array.isArray(refs)) {
      for (const r of refs.slice(0, 400)) {
        const text = r.full_text || (r.author ? `${r.author} (${r.year || ''}) ${r.title}` : (r.title || ''));
        if (text) lines.push(`- ${text}`);
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

export {
  normSubject,
  stripMd,
  MCQ_WORDS,
  renderSyllabus,
  renderExam,
  renderMarkingScheme,
  renderExamFormat,
  renderLesson,
  renderScheme,
  collectSchemeRows,
  renderReferences,
};