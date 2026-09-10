"""HTML renderer for schemes of work (TIE landscape scheme-of-work layout)."""

from __future__ import annotations


def render_scheme_of_work_html(plan: dict) -> str:
    h = plan.get("header", {})
    weeks = plan.get("weeks", [])
    is_sw = any(
        w in (h.get("subject", "") + h.get("term", "")).lower()
        for w in ["historia", "maadili", "kiswahili", "uraia"]
    )

    labels = {
        "school": "School Name" if not is_sw else "Jina la Shule",
        "teacher": "Teacher" if not is_sw else "Mwalimu",
        "subject": "Subject" if not is_sw else "Somo",
        "class": "Class" if not is_sw else "Darasa",
        "term": "Term" if not is_sw else "Muhtasari",
        "year": "Academic Year" if not is_sw else "Mwaka wa Masomo",
        "main_comp": "Main competence" if not is_sw else "Ujuzi Mkuu",
        "spec_comp": "Specific competence" if not is_sw else "Ujuzi Mahususi",
        "learn_act": "Learning Activities" if not is_sw else "Shughuli za Kujifunza",
        "spec_act": "Specific activities" if not is_sw else "Shughuli Mahususi",
        "month": "Month" if not is_sw else "Mwezi",
        "wk": "Week" if not is_sw else "Wiki",
        "periods": "Periods" if not is_sw else "Vipindi",
        "reference": "Reference" if not is_sw else "Marejeo",
        "methods": "Teaching and learning methods" if not is_sw else "Mbinu za Kufundisha na Kujifunza",
        "resources": "Teaching and learning resources" if not is_sw else "Rasilimali za Kufundisha na Kujifunza",
        "assess": "Assessment tools" if not is_sw else "Zana za Tathmini",
        "rem": "Remarks" if not is_sw else "Maelezo",
    }

    def _e(s):
        from html import escape
        return escape(str(s))

    def _li(items):
        if not items:
            return ""
        if isinstance(items, str):
            items = [items]
        return ", ".join(_e(str(i)) for i in items)

    rows = ""
    for w in weeks:
        main_comp = _e(w.get('main_competence') or w.get('competences', w.get('topic', '')))
        if isinstance(w.get('main_competence'), list):
            main_comp = _li(w.get('main_competence'))
        spec_comp = _e(w.get('specific_competence',''))
        if isinstance(w.get('specific_competence'), list):
            spec_comp = _li(w.get('specific_competence'))
        learn_act = _e(w.get('learning_activities') or w.get('objectives', ''))
        schedule = w.get('learning_activity_schedule')
        if schedule:
            learn_act = ", ".join(
                f"{_e(s['activity'])} ({s['periods']} {'period' if s['periods'] == 1 else 'periods'})"
                for s in schedule if s.get('activity')
            ) or learn_act
        elif isinstance(w.get('learning_activities'), list):
            learn_act = _li(w.get('learning_activities'))
        spec_act = _e(w.get('specific_activities') or w.get('subtopic', ''))
        if isinstance(w.get('specific_activities'), list):
            spec_act = _li(w.get('specific_activities'))
        month = _e(w.get('month', ''))
        week = _e(w.get('week') or w.get('week_number', ''))
        periods = _e(w.get('periods', ''))
        reference = _e(w.get('reference') or _li(w.get('references', [])))
        methods = _li(w.get('teaching_methods', [])) or _e(w.get('methods', ''))
        resources = _li(w.get('teaching_resources', w.get('teaching_aids', [])))
        assess = _e(w.get('assessment_tools') or w.get('assessment', ''))
        remarks = _e(w.get('remarks', ''))
        rows += f"""<tr>
            <td>{main_comp}</td>
            <td>{spec_comp}</td>
            <td>{learn_act}</td>
            <td>{spec_act}</td>
            <td style="text-align:center">{month}</td>
            <td style="text-align:center">{week}</td>
            <td style="text-align:center">{periods}</td>
            <td>{reference}</td>
            <td>{methods}</td>
            <td>{resources}</td>
            <td>{assess}</td>
            <td>{remarks}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="{'sw' if is_sw else 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{_e(h.get('subject', 'Scheme of Work'))}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  @media print {{
    body {{ margin: 0.3cm; font-size: 8.5pt; }}
    .no-print {{ display: none !important; }}
    @page {{ margin: 0.5cm; size: A4 landscape; }}
    div[style*="overflow-x"] {{ overflow: visible; border: none; border-radius: 0; }}
    div[style*="overflow-x"] table {{ min-width: 0; }}
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1e293b;
    background: #f8fafc;
    padding: 20px;
    -webkit-font-smoothing: antialiased;
  }}
  .title-block {{
    text-align: center;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 16px;
    background: linear-gradient(135deg, #eff6ff, #f0fdf4);
  }}
  .title-block h1 {{
    font-size: 15pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 800;
    color: #0f172a;
  }}
  .meta-row {{
    display: flex;
    justify-content: space-between;
    font-size: 10pt;
    margin-bottom: 16px;
    padding: 8px 0;
    border-bottom: 2px solid #e2e8f0;
    flex-wrap: wrap;
    gap: 4px 24px;
  }}
  .meta-row span {{ white-space: nowrap; color: #475569; }}
  .meta-row strong {{ font-weight: 600; color: #1e40af; }}
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    table-layout: fixed;
  }}
  th, td {{
    border: 1px solid #e2e8f0;
    padding: 5px 6px;
    text-align: left;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: break-word;
    line-height: 1.4;
  }}
  th {{
    background: linear-gradient(135deg, #f1f5f9, #e8f0fe);
    font-weight: 700;
    text-transform: uppercase;
    font-size: 7.5pt;
    text-align: center;
    color: #334155;
    letter-spacing: 0.04em;
  }}
  thead {{ display: table-header-group; }}
  tbody tr {{ page-break-inside: avoid; }}
  tbody tr:nth-child(even) {{ background: #f8fafc; }}
  tbody tr:hover {{ background: #f1f5f9; }}
  td.c {{ text-align: center; }}
  .actions {{ text-align: center; margin: 16px 0; }}
  .actions button {{
    padding: 8px 20px;
    margin: 0 6px;
    cursor: pointer;
    font-size: 10pt;
    font-weight: 600;
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #334155;
    transition: all 0.15s;
    font-family: inherit;
  }}
  .actions button:hover {{ background: #f1f5f9; border-color: #cbd5e1; }}
  .course-banner {{
    border: 1px solid #e2e8f0;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
    font-weight: 700;
    text-align: left;
    padding: 8px 10px;
    font-size: 9.5pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #1e40af;
    background: #f8fafc;
  }}
  @media (max-width: 640px) {{
    body {{ margin: 10px; padding: 10px; }}
    .title-block {{ padding: 12px; border-radius: 8px; }}
    .title-block h1 {{ font-size: 12pt; }}
    .meta-row {{ font-size: 8.5pt; gap: 2px 12px; padding: 6px 0; }}
    th, td {{ padding: 3px 4px; font-size: 7.5pt; }}
    th {{ font-size: 7pt; }}
    .actions button {{ font-size: 9pt; padding: 6px 14px; }}
  }}
</style>
</head>
<body>
<div class="actions no-print">
  <button onclick="window.print()">Print / Save as PDF</button>
  <button onclick="downloadAsWord()">Download as Word</button>
</div>

<div class="title-block">
  <h1>{labels['subject']} — {labels['term']}: {_e(h.get('term', ''))} {_e(h.get('academic_year', ''))}</h1>
</div>

<div class="meta-row">
  <span><strong>{labels['school']}:</strong> {_e(h.get('school_name', ''))}</span>
  <span><strong>{labels['teacher']}:</strong> {_e(h.get('teacher_name', ''))}</span>
  <span><strong>{labels['subject']}:</strong> {_e(h.get('subject', ''))}</span>
  <span><strong>{labels['class']}:</strong> {_e(h.get('class_name', ''))}</span>
  <span><strong>{labels['term']}:</strong> {_e(h.get('term', ''))}</span>
  <span><strong>{labels['year']}:</strong> {_e(h.get('academic_year', ''))}</span>
</div>

<div class="course-banner">
  <strong>{_e(h.get('class_name', ''))} ORIENTATION COURSE</strong>
</div>

<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px">
<table>
<thead>
<tr>
  <th style="width:9%">{labels['main_comp']}</th>
  <th style="width:9%">{labels['spec_comp']}</th>
  <th style="width:10%">{labels['learn_act']}</th>
  <th style="width:9%">{labels['spec_act']}</th>
  <th style="width:6%">{labels['month']}</th>
  <th style="width:5%">{labels['wk']}</th>
  <th style="width:5%">{labels['periods']}</th>
  <th style="width:10%">{labels['reference']}</th>
  <th style="width:12%">{labels['methods']}</th>
  <th style="width:11%">{labels['resources']}</th>
  <th style="width:9%">{labels['assess']}</th>
  <th style="width:5%">{labels['rem']}</th>
</tr>
</thead>
<tbody>{rows}</tbody>
</table>
</div>

<script>
function downloadAsWord() {{
  var body = document.createElement('div');
  body.innerHTML = document.body.innerHTML;
  [].slice.call(body.querySelectorAll('.actions, script, iframe')).forEach(function (n) {{
    if (n.parentNode) n.parentNode.removeChild(n);
  }});
  var style = '';
  var styles = document.head ? document.head.querySelectorAll('style') : [];
  [].forEach.call(styles, function (s) {{ style += (s.textContent || '') + '\n'; }});
  style = style.replace(/@import[^;]+;\s*/g, '');
  var wordMeta = '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->';
  var html = '<!DOCTYPE html>' +
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="UTF-8">' + wordMeta +
    '<style>' + style +
    'body{{margin:14pt 16pt;font-family:"Calibri","Segoe UI",Arial,sans-serif;font-size:9pt;color:#1e293b}}' +
    'table{{border-collapse:collapse;width:100%}}th,td{{border:1px solid #e2e8f0;padding:4px 5px;vertical-align:top}}' +
    'th{{background:#f1f5f9;font-weight:700}}thead{{display:table-header-group}}tr{{page-break-inside:avoid}}' +
    '.actions{{display:none}}@page{{size:A4 landscape;margin:10mm 8mm}}' +
    '</style></head><body>' + body.innerHTML + '</body></html>';
  var blob = new Blob(["\ufeff" + html], {{ type: 'application/msword' }});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'scheme_of_work_' + (document.title || 'document').replace(/[^a-z0-9]/gi, '_') + '.doc';
  a.click();
  URL.revokeObjectURL(url);
}}
</script>
</body>
</html>"""