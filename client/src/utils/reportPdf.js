/**
 * reportPdf.js — Opens the AI report as a styled Hebrew HTML page in a new tab.
 * The page includes a "שמור כ-PDF" button that triggers the browser print dialog.
 */

// ── Inline formatting ───────────────────────────────────────────────────────
function inlineFmt(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

// ── Table renderer ──────────────────────────────────────────────────────────
function renderTable(lines) {
  const rows = lines.filter(l => !/^\|[\s\-:|]+\|$/.test(l.trim()));
  if (!rows.length) return '';
  const parseCells = l => l.split('|').slice(1, -1).map(c => c.trim());
  const headerCells = parseCells(rows[0]).map(c => `<th>${inlineFmt(c)}</th>`).join('');
  const bodyRows = rows.slice(1).map(r =>
    `<tr>${parseCells(r).map(c => `<td>${inlineFmt(c)}</td>`).join('')}</tr>`
  ).join('');
  return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

// ── Markdown → HTML ─────────────────────────────────────────────────────────
function mdToHtml(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const block = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { block.push(lines[i]); i++; }
      out.push(`<pre><code>${block.map(l => inlineFmt(l)).join('\n')}</code></pre>`);
      i++; continue;
    }

    // Table
    if (line.startsWith('|')) {
      const tLines = [];
      while (i < lines.length && lines[i].startsWith('|')) { tLines.push(lines[i]); i++; }
      out.push(renderTable(tLines)); continue;
    }

    // HR
    if (/^-{3,}$/.test(line.trim())) { out.push('<hr>'); i++; continue; }

    // Headings
    if (line.startsWith('#### ')) { out.push(`<h4>${inlineFmt(line.slice(5))}</h4>`); i++; continue; }
    if (line.startsWith('### '))  { out.push(`<h3>${inlineFmt(line.slice(4))}</h3>`); i++; continue; }
    if (line.startsWith('## '))   { out.push(`<h2>${inlineFmt(line.slice(3))}</h2>`); i++; continue; }
    if (line.startsWith('# '))    { out.push(`<h2>${inlineFmt(line.slice(2))}</h2>`); i++; continue; }

    // Bullet list
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(`<li>${inlineFmt(lines[i].slice(2))}</li>`); i++;
      }
      out.push(`<ul>${items.join('')}</ul>`); continue;
    }

    // Numbered list
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inlineFmt(lines[i].replace(/^\d+\. /, ''))}</li>`); i++;
      }
      out.push(`<ol>${items.join('')}</ol>`); continue;
    }

    // Empty line
    if (!line.trim()) { out.push('<br>'); i++; continue; }

    out.push(`<p>${inlineFmt(line)}</p>`);
    i++;
  }
  return out.join('\n');
}

// ── Full HTML page ──────────────────────────────────────────────────────────
function buildHtml(title, subtitle, content) {
  const date = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Rubik', Arial, sans-serif;
      direction: rtl;
      text-align: right;
      color: #1a2332;
      background: #f4f7fb;
      font-size: 14px;
      line-height: 1.8;
    }

    /* ── Cover header ── */
    .cover {
      background: linear-gradient(135deg, #0f2347 0%, #1a3a6b 55%, #2554a3 100%);
      color: #fff;
      padding: 40px 60px 32px;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .cover h1 { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
    .cover .sub { font-size: 14px; color: rgba(255,255,255,0.65); }
    .cover .date { font-size: 12px; color: rgba(255,255,255,0.45); margin-top: 4px; }

    /* ── Page body ── */
    .body { max-width: 960px; margin: 0 auto; padding: 36px 60px 80px; background: #fff; box-shadow: 0 2px 16px rgba(0,0,0,0.06); min-height: calc(100vh - 140px); }

    /* ── Typography ── */
    h2 {
      font-size: 18px; font-weight: 700; color: #0f2347;
      margin: 32px 0 10px;
      padding-right: 12px;
      border-right: 4px solid #2554a3;
    }
    h3 { font-size: 15px; font-weight: 600; color: #1a3a6b; margin: 20px 0 7px; }
    h4 { font-size: 13px; font-weight: 600; color: #5a6a7e; margin: 14px 0 5px; }
    p  { margin: 7px 0; }
    hr { border: none; border-top: 1px solid #e0e8f2; margin: 22px 0; }
    strong { font-weight: 700; }
    code {
      font-family: 'Courier New', monospace;
      background: #f0f4f8;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
      direction: ltr;
      display: inline-block;
    }
    pre {
      background: #f0f4f8;
      border: 1px solid #d1dce8;
      border-radius: 6px;
      padding: 14px 16px;
      overflow-x: auto;
      direction: ltr;
      text-align: left;
      margin: 12px 0;
    }
    pre code { background: none; padding: 0; }

    /* ── Lists ── */
    ul, ol {
      padding-right: 28px;
      padding-left: 0;
      margin: 8px 0 12px;
    }
    ul { list-style-type: disc; }
    ol { list-style-type: decimal; }
    li { margin: 5px 0; padding-right: 4px; }

    /* ── Tables ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0 18px;
      direction: rtl;
      font-size: 13px;
    }
    thead tr { background: #1a3a6b; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    th {
      color: #fff;
      font-weight: 600;
      padding: 10px 14px;
      text-align: right;
      border: 1px solid #1a3a6b;
    }
    td {
      padding: 9px 14px;
      border: 1px solid #d1dce8;
      text-align: right;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td {
      background: #f8fafc;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    tbody tr:hover td { background: #eef3fb; }

    /* ── Print button ── */
    .print-btn {
      position: fixed;
      bottom: 28px;
      left: 28px;
      background: #1a3a6b;
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 13px 22px;
      font-size: 14px;
      font-family: 'Rubik', Arial, sans-serif;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(26,58,107,0.35);
      transition: background 0.15s;
      z-index: 999;
    }
    .print-btn:hover { background: #0f2347; }

    /* ── Print styles ── */
    @media print {
      body { background: #fff; }
      .cover { padding: 24px 40px 20px; }
      .body  { padding: 24px 40px; box-shadow: none; max-width: 100%; }
      .print-btn { display: none !important; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: avoid; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${title}</h1>
    ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
    <div class="date">הופק: ${date}</div>
  </div>
  <div class="body">
    ${mdToHtml(content)}
  </div>
  <button class="print-btn" onclick="window.print()">🖨️ שמור כ-PDF</button>
</body>
</html>`;
}

// ── Public API ──────────────────────────────────────────────────────────────
export function openSystemReport(systemName, content) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(buildHtml(`דוח ארכיטקטורה — ${systemName}`, systemName, content));
  win.document.close();
}

export function openEnterpriseReport(systemCount, content) {
  const sub = systemCount ? `${systemCount} מערכות נותחו` : 'כלל המערכות';
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(buildHtml('דוח ארכיטקטורה ארגוני', sub, content));
  win.document.close();
}
