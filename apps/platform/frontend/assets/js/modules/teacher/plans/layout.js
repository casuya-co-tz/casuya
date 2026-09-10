// modules/teacher/plans/layout.js — teaching-documents page layout template.

function renderPlansLayout() {
  return `
    <div class="content">
      <h2 class="tdocs-page-title">Teaching Documents</h2>
      <p class="tdocs-page-desc">
        Generate official TIE Competence-Based Lesson Plans and Schemes of Work, then save, print, or as PDF/Word.
        Generated in Kiswahili for Kiswahili-medium subjects and English for all others.
      </p>
      <div class="tdocs-tabs" id="tdocs-tabs"></div>

      <div id="tdocs-lesson-panel" style="margin-top:1.25rem">
        <div class="tdocs-layout">
          <div class="tdocs-form-col">
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.6rem;font-size:1rem;font-weight:700">Lesson Plan Generator</h3>
              <form id="tdoc-lesson-form" style="display:grid;gap:0.6rem">
                <div class="tdocs-section">
                  <div class="tdocs-section-title">Curriculum</div>
                  <div class="tdocs-field-grid">
                    <label class="tdocs-field"><span>Subject</span><select class="input" name="subject_slug" id="tdoc-ss">${plansSubjectOptions()}</select></label>
                    <label class="tdocs-field"><span>Form Level</span><select class="input" name="form_level"><option value="1">Form I</option><option value="2" selected>Form II</option><option value="3">Form III</option><option value="4">Form IV</option></select></label>
                  </div>
                  <div class="tdocs-field-grid" style="margin-top:0.5rem">
                    <label class="tdocs-field" style="grid-column:1/-1"><span>Topic / Mada</span><select class="input" name="topic" id="tdoc-topic" required><option value="">— choose subject & form to load topics —</option></select></label>
                  </div>
                  <div class="tdocs-field-grid" style="margin-top:0.5rem">
                    <label class="tdocs-field" style="grid-column:1/-1"><span>Subtopic / Sehemu ya Mada</span><select class="input" name="subtopic" id="tdoc-subtopic"><option value="">— choose a topic first —</option></select></label>
                  </div>
                </div>
                <div class="tdocs-section">
                  <div class="tdocs-section-title">School & Teacher</div>
                  <div class="tdocs-field-grid">
                    <label class="tdocs-field"><span>School / Shule</span><input class="input" name="school_name" placeholder="School name"></label>
                    <label class="tdocs-field"><span>Teacher / Mwalimu</span><input class="input" name="teacher_name" placeholder="Teacher name"></label>
                  </div>
                </div>
                <div class="tdocs-section">
                  <div class="tdocs-section-title">Class Details</div>
                  <div class="tdocs-field-grid-4">
                    <label class="tdocs-field"><span>Total Students</span><input class="input" type="number" name="number_of_students" value="40" min="1"></label>
                    <label class="tdocs-field"><span>Boys</span><input class="input" type="number" name="students_boys" min="0" placeholder="auto"></label>
                    <label class="tdocs-field"><span>Girls</span><input class="input" type="number" name="students_girls" min="0" placeholder="auto"></label>
                    <label class="tdocs-field"><span>Duration (min)</span><input class="input" type="number" name="duration_minutes" value="40" min="10" max="120"></label>
                  </div>
                  <div class="tdocs-field-grid" style="margin-top:0.5rem">
                    <label class="tdocs-field"><span>Period / Kipindi</span><input class="input" name="period" placeholder="Period 1"></label>
                  </div>
                </div>
                <div class="tdocs-form-actions">
                  <button class="btn tdocs-generate-btn" type="submit" style="flex:1">✨ Generate Lesson Plan</button>
                  <button class="btn btn-outline" type="button" id="tdoc-lesson-seed" style="font-size:0.8rem">Autofill</button>
                </div>
              </form>
            </div>
          </div>
          <div class="tdocs-preview-col">
            <div class="tdocs-preview-panel" id="tdoc-lesson-preview">
              <div class="tdocs-preview-header">
                <h4>📄 Preview</h4>
                <div class="tdocs-preview-actions" id="tdoc-lesson-preview-actions" style="display:none">
                  <button class="btn btn-sm btn-outline" id="gen-view">👁 View</button>
                  <button class="btn btn-sm btn-outline" id="gen-print">🖨 Print / PDF</button>
                  <button class="btn btn-sm btn-outline" id="gen-doc">📥 Word</button>
                </div>
              </div>
              <div id="tdoc-lesson-result">
                <div class="tdocs-empty"><div class="tdocs-empty-icon">📋</div><p>Fill in the form and click <strong>Generate</strong> to create a lesson plan.</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="tdocs-scheme-panel" style="display:none;margin-top:1.25rem">
        <div class="tdocs-layout">
          <div class="tdocs-form-col">
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.6rem;font-size:1rem;font-weight:700">Scheme of Work Generator</h3>
              <form id="tdoc-scheme-form" style="display:grid;gap:0.6rem">
                <div class="tdocs-section">
                  <div class="tdocs-section-title">Curriculum</div>
                  <div class="tdocs-field-grid">
                    <label class="tdocs-field"><span>Subject</span><select class="input" name="subject_slug">${plansSubjectOptions()}</select></label>
                    <label class="tdocs-field"><span>Form Level</span><select class="input" name="form_level"><option value="1">Form I</option><option value="2" selected>Form II</option><option value="3">Form III</option><option value="4">Form IV</option></select></label>
                  </div>
                </div>
                <div class="tdocs-section">
                  <div class="tdocs-section-title">Term & Year</div>
                  <div class="tdocs-field-grid">
                    <label class="tdocs-field"><span>Term</span><select class="input" name="term"><option value="Term 1" selected>Term I</option><option value="Term 2">Term II</option></select></label>
                    <label class="tdocs-field"><span>Academic Year</span><input class="input" name="academic_year" placeholder="2026"></label>
                  </div>
                </div>
                <div class="tdocs-section">
                  <div class="tdocs-section-title">Topics (Optional)</div>
                  <label class="tdocs-field"><span>Topics to cover — comma-separated, or leave blank to use full curriculum</span><input class="input" name="topics" placeholder="e.g. Indices and Logarithms, Algebraic Expressions, Equations"></label>
                </div>
                <div class="tdocs-section">
                  <div class="tdocs-section-title">School & Teacher</div>
                  <div class="tdocs-field-grid">
                    <label class="tdocs-field"><span>School / Shule</span><input class="input" name="school_name" placeholder="School name"></label>
                    <label class="tdocs-field"><span>Teacher / Mwalimu</span><input class="input" name="teacher_name" placeholder="Teacher name"></label>
                  </div>
                </div>
                <div class="tdocs-form-actions">
                  <button class="btn tdocs-generate-btn" type="submit" style="flex:1">✨ Generate Scheme of Work</button>
                </div>
              </form>
            </div>
          </div>
          <div class="tdocs-preview-col">
            <div class="tdocs-preview-panel" id="tdoc-scheme-preview">
              <div class="tdocs-preview-header">
                <h4>📄 Preview</h4>
                <div class="tdocs-preview-actions" id="tdoc-scheme-preview-actions" style="display:none">
                  <button class="btn btn-sm btn-outline" id="scheme-view">👁 View</button>
                  <button class="btn btn-sm btn-outline" id="scheme-print">🖨 Print / PDF</button>
                  <button class="btn btn-sm btn-outline" id="scheme-doc">📥 Word</button>
                </div>
              </div>
              <div id="tdoc-scheme-result">
                <div class="tdocs-empty"><div class="tdocs-empty-icon">📋</div><p>Fill in the form and click <strong>Generate</strong> to create a scheme of work.</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="tdocs-saved-panel" style="display:none;margin-top:1.25rem">
        <div class="tdocs-saved-header">
          <h3 style="margin:0">Saved Documents</h3>
          <button class="btn btn-sm btn-outline" id="tdoc-refresh">↻ Refresh</button>
        </div>
        <div id="tdocs-saved-list"></div>
      </div>
    </div>
  `;
}