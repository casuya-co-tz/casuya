// modules/api-client/core/markdown.js — tutoring markdown renderer (shared global scope)

function renderTutorMarkdown(raw) {
  if (!raw) return "";
  let text = raw;

  text = text.replace(/ thinking[\s\S]*?<\/think>/gi, "").trim();

  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<div class="tutor-code-block"><pre><code>${escapeHtml(code.trimEnd())}</code></pre></div>`;
  });

  text = text.replace(/^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)*)/gm, (_, headerRow, _sep, bodyRows) => {
    const headers = headerRow.split("|").filter(c => c.trim());
    const rows = bodyRows.trim().split("\n").map(r => r.split("|").filter(c => c.trim()));
    let html = "<table>";
    html += "<thead><tr>" + headers.map(h => `<th>${escapeHtml(h.trim())}</th>`).join("") + "</tr></thead>";
    html += "<tbody>" + rows.map(r =>
      "<tr>" + r.map((c, i) => `<td data-label="${escapeHtml(headers[i] || "")}">${escapeHtml(c.trim())}</td>`).join("") + "</tr>"
    ).join("") + "</tbody></table>";
    return html;
  });

  text = text.replace(/^(.*💡\s*(?:NECTA\s+(?:Examination\s+)?Tip|Mtihani).*)\n((?:(?!\*\*\*).+\n?)*)/gim, (_, tipLine, body) => {
    const cleanBody = escapeHtml(body.trim()).replace(/\n/g, "<br>");
    return `<div class="tutor-necta-tip"><div class="tutor-necta-tip-label">💡 NECTA Examination Tip</div><p>${cleanBody}</p></div>`;
  });

  text = text.replace(/^>\s*(.+)$/gm, (_, content) => {
    const isLocal = /tanzan|serengeti|kilimanjaro|lake victoria|dodoma|dar|kenya|uganda|east africa|africa|mwanza|arusha|mbeya|ruaha|rufiji/i.test(content);
    const badge = isLocal ? "🌍 Tanzania Context" : "📖 Context";
    return `<div class="tutor-context-blockquote"><div class="tutor-context-badge">${badge}</div><p>${escapeHtml(content)}</p></div>`;
  });
  text = text.replace(/(<div class="tutor-context-blockquote">[\s\S]*?<\/div>\n?)+/g, (match) => {
    return match;
  });

  text = text.replace(/^\*\*\*\s*$/gm, "<hr>");

  text = text.replace(/^#### (.+)$/gm, (_, t) => `<h4>${escapeHtml(t)}</h4>`);
  text = text.replace(/^### (.+)$/gm, (_, t) => `<h3>${escapeHtml(t)}</h3>`);
  text = text.replace(/^## (.+)$/gm, (_, t) => `<h2>${escapeHtml(t)}</h2>`);
  text = text.replace(/^# (.+)$/gm, (_, t) => `<h1>${escapeHtml(t)}</h1>`);

  text = text.replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => `<strong><em>${escapeHtml(t)}</em></strong>`);
  text = text.replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong>${escapeHtml(t)}</strong>`);
  text = text.replace(/\*(.+?)\*/g, (_, t) => `<em>${escapeHtml(t)}</em>`);

  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);

  text = text.replace(/^(?:- (.+)\n?)+/gm, (match) => {
    const items = match.trim().split("\n").map(l => `<li>${escapeHtml(l.replace(/^- /, ""))}</li>`).join("");
    return `<ul>${items}</ul>`;
  });

  text = text.replace(/^(?:\d+\. (.+)\n?)+/gm, (match) => {
    const items = match.trim().split("\n").map(l => `<li>${escapeHtml(l.replace(/^\d+\. /, ""))}</li>`).join("");
    return `<ol>${items}</ol>`;
  });

  text = text.replace(/\n{2,}/g, "\n\n");
  const paragraphs = text.split("\n\n");
  text = paragraphs.map(p => {
    p = p.trim();
    if (!p) return "";
    if (/^<(div|table|ul|ol|h[1-6]|hr|pre)/.test(p)) return p;
    return `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return text;
}