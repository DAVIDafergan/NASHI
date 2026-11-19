// Minimal dependency-free XLSX writer: one or more sheets, RTL, styled header, money/date formats, totals row, frozen header, autofilter.
const zlib = require('zlib');
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const parts = [], central = []; let off = 0;
  for (const [name, str] of files) {
    const data = Buffer.from(str, 'utf8'), comp = zlib.deflateRawSync(data), nm = Buffer.from(name, 'utf8'), crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt32LE(0, 10); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, nm, comp);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, nm); off += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, e]);
}
const x = s => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colL = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; };
// styles: 0 default, 1 header, 2 money, 3 date, 4 total label, 5 total money, 6 pct, 7 wrap text, 8 int, 9 title
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;₪&quot;#,##0;[Red]-&quot;₪&quot;#,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="166" formatCode="0%"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="15"/><name val="Arial"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1C1917"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFEBFF"/></patternFill></fill></fills>
<borders count="2"><border/><border><bottom style="thin"><color rgb="FFE9E6E2"/></bottom></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="10"><xf borderId="1" applyBorder="1"><alignment vertical="center" readingOrder="2"/></xf>
<xf fontId="1" fillId="2" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
<xf numFmtId="164" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment vertical="center"/></xf>
<xf numFmtId="165" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
<xf fontId="2" fillId="3" applyFont="1" applyFill="1"><alignment vertical="center" readingOrder="2"/></xf>
<xf numFmtId="164" fontId="2" fillId="3" applyNumberFormat="1" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
<xf numFmtId="166" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
<xf borderId="1" applyBorder="1"><alignment vertical="center" wrapText="1" readingOrder="2"/></xf>
<xf numFmtId="3" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
<xf fontId="3" applyFont="1"><alignment vertical="center" readingOrder="2"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
const T = { text: 0, money: 2, date: 3, pct: 6, wrap: 7, int: 8 };
const serial = v => { if (!v) return null; const d = new Date(String(v).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(v)) ? '' : 'Z')); if (isNaN(d)) return null; const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map(x => [x.type, x.value])); return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) / 864e5 + 25569; }; // shown in Israel time (DST-aware)
function sheetXml({ title, cols, rows, totals }) {
  const R = []; let r = 1; const startData = title ? 3 : 1;
  const cell = (ci, ri, v, type, st) => { const ref = colL(ci) + ri; if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${st}"/>`; if (type === 'n') return `<c r="${ref}" s="${st}"><v>${+v}</v></c>`; if (type === 'f') return `<c r="${ref}" s="${st}"><f>${x(v)}</f></c>`; return `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${x(v)}</t></is></c>`; };
  if (title) { R.push(`<row r="1" ht="26" customHeight="1">${cell(0, 1, title, 's', 9)}</row>`); r = 3; }
  const hr = r; R.push(`<row r="${r}" ht="30" customHeight="1">${cols.map((c, i) => cell(i, r, c.h, 's', 1)).join('')}</row>`); r++;
  for (const row of rows) { R.push(`<row r="${r}" ht="22" customHeight="1">${cols.map((c, i) => { let v = row[i]; const t = c.t || 'text'; if (t === 'date') { v = serial(v); return cell(i, r, v, 'n', T.date); } if (t === 'money' || t === 'int' || t === 'pct') return cell(i, r, v === '' || v == null ? null : +v, 'n', T[t]); return cell(i, r, v, 's', T[t] ?? 0); }).join('')}</row>`); r++; }
  const last = r - 1;
  if (totals && rows.length) { R.push(`<row r="${r}" ht="24" customHeight="1">${cols.map((c, i) => { if (i === 0) return cell(i, r, totals.label || 'סה"כ', 's', 4); if (c.sum) return cell(i, r, `SUM(${colL(i)}${hr + 1}:${colL(i)}${last})`, 'f', c.t === 'money' ? 5 : 4); if (c.count) return cell(i, r, `COUNTA(${colL(i)}${hr + 1}:${colL(i)}${last})`, 'f', 4); return cell(i, r, '', 's', 4); }).join('')}</row>`); }
  const lc = colL(cols.length - 1);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView rightToLeft="1" workbookViewId="0" zoomScale="110"><pane ySplit="${hr}" topLeftCell="A${hr + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/>
<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w || 14}" customWidth="1"/>`).join('')}</cols><sheetData>${R.join('')}</sheetData>
${rows.length ? `<autoFilter ref="A${hr}:${lc}${last}"/>` : ''}${title ? `<mergeCells count="1"><mergeCell ref="A1:${lc}1"/></mergeCells>` : ''}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
function build(sheets) {
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${x(String(s.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${(dn => dn ? `<definedNames>${dn}</definedNames>` : '')(sheets.map((s, i) => s.rows.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${x(String(s.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))}'!$A$${s.title ? 3 : 1}:$${colL(s.cols.length - 1)}$${(s.title ? 3 : 1) + s.rows.length}</definedName>` : '').join(''))}</workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)])
  ];
  return zip(files);
}
module.exports = { build };
