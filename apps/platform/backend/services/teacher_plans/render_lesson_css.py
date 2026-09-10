"""CSS for the official TIE CBC lesson-plan HTML template."""

LESSON_PLAN_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 24px;
            color: #1e293b;
            background-color: #f8fafc;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }
        .lesson-container {
            max-width: 960px;
            margin: 0 auto;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 32px;
            background: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
        }
        .header {
            text-align: center;
            font-weight: 700;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #e2e8f0;
        }
        .header h2, .header h3, .header h4 {
            margin: 4px 0;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .header h2 { font-size: 15pt; color: #0f172a; }
        .header h3 { font-size: 13pt; color: #334155; font-weight: 600; }
        .header h4 { font-size: 12pt; color: #475569; font-weight: 500; text-decoration: none; border-bottom: 1px dashed #cbd5e1; display: inline-block; padding-bottom: 2px; }
        .header .title-line { font-size: 12pt; text-transform: uppercase; letter-spacing: 0.03em; color: #334155; }

        /* Info table: auto-colwidths so cells stretch equally */
        .info-table { table-layout: auto; }
        .info-table td { padding: 7px 10px; }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }
        th, td {
            border: 1px solid #e2e8f0;
            padding: 8px 10px;
            font-size: 10pt;
            vertical-align: top;
            line-height: 1.45;
        }
        th {
            background: #f1f5f9;
            font-weight: 600;
            color: #334155;
        }
        .bg-head {
            background-color: #f1f5f9;
            font-weight: 600;
            text-align: center;
            color: #334155;
            font-size: 9.5pt;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }
        .text-center { text-align: center; }
        .bold { font-weight: 600; color: #0f172a; }
        .sec {
            margin-bottom: 16px;
        }
        .sec-title {
            font-weight: 700;
            margin: 18px 0 6px 0;
            font-size: 10.5pt;
            color: #1e40af;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding-bottom: 4px;
            border-bottom: 2px solid #dbeafe;
        }
        .sec-body {
            margin-left: 14px;
            color: #334155;
            line-height: 1.5;
        }
        .refs {
            margin: 6px 0 0 14px;
            font-style: italic;
            color: #64748b;
            font-size: 9.5pt;
        }

        /* ── Wide tables: horizontal scroll on small screens ─────── */
        .table-wrap {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin-bottom: 16px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
        }
        .table-wrap table {
            margin-bottom: 0;
            min-width: 600px;
        }

        @media print {
            body { margin: 0; background: #fff; }
            .lesson-container { border: none; padding: 0; box-shadow: none; border-radius: 0; }
            .no-print { display: none; }
            .table-wrap { overflow: visible; border: none; border-radius: 0; }
            .table-wrap table { min-width: 0; }
            table { page-break-inside: auto; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            .sec, .sec-title { page-break-inside: avoid; }
            @page { size: A4 portrait; margin: 10mm 8mm 10mm 8mm; }
        }

        /* ── Small screens ──────────────────────────────────────── */
        @media (max-width: 640px) {
            body { margin: 10px; }
            .lesson-container { padding: 16px; border-radius: 8px; }
            .info-table td {
                display: block;
                width: 100% !important;
                padding: 5px 8px;
                font-size: 9pt;
                border-bottom: 1px solid #f1f5f9;
            }
            .info-table tr td:last-child { border-bottom: none; }
            th, td {
                padding: 5px 6px;
                font-size: 8.5pt;
            }
            .bg-head { font-size: 8pt; }
            .sec-title { font-size: 9.5pt; margin: 14px 0 4px 0; }
            .sec-body { margin-left: 8px; font-size: 9pt; }
        }
"""
