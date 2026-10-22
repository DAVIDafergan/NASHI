/**
 * Minimal PHP unserialize() for the `location_map` field Tickchak returns.
 * Supports: N; b:; i:; d:; s:<bytes>:"…"; a:<n>:{…}; O:<len>:"Class":<n>:{…} (as plain object).
 * String lengths are in BYTES (UTF-8), so we walk a Buffer, not the JS string.
 * Returns undefined for anything malformed — callers treat that as "no structured address".
 */
export function phpUnserialize(input) {
  if (typeof input !== 'string' || !input) return undefined;
  const buf = Buffer.from(input, 'utf8');
  let i = 0;
  const readUntil = (ch) => {
    const end = buf.indexOf(ch, i);
    if (end < 0) throw new Error('eof');
    const s = buf.toString('utf8', i, end);
    i = end + 1;
    return s;
  };
  const expect = (ch) => { if (buf[i] !== ch.charCodeAt(0)) throw new Error(`expected ${ch}`); i++; };
  const readValue = () => {
    const type = String.fromCharCode(buf[i]);
    i += 1;
    if (type === 'N') { expect(';'); return null; }
    expect(':');
    switch (type) {
      case 'b': return readUntil(';') === '1';
      case 'i': return parseInt(readUntil(';'), 10);
      case 'd': return parseFloat(readUntil(';'));
      case 's': {
        const len = parseInt(readUntil(':'), 10);
        expect('"');
        const s = buf.toString('utf8', i, i + len);
        i += len;
        expect('"'); expect(';');
        return s;
      }
      case 'a': return readArray();
      case 'O': {
        const nameLen = parseInt(readUntil(':'), 10);
        i += nameLen + 2; // "ClassName"
        expect(':');
        return readArray();
      }
      default: throw new Error(`type ${type}`);
    }
  };
  const readArray = () => {
    const n = parseInt(readUntil(':'), 10);
    expect('{');
    const out = {};
    let list = true;
    for (let k = 0; k < n; k++) {
      const key = readValue();
      const val = readValue();
      if (key !== k) list = false;
      out[key] = val;
    }
    expect('}');
    return list ? Object.values(out) : out;
  };
  try {
    const v = readValue();
    return v;
  } catch {
    return undefined;
  }
}

/** Serializer used only by tests/fixtures (so fixture byte lengths are always right). */
export function phpSerialize(v) {
  if (v === null || v === undefined) return 'N;';
  if (typeof v === 'boolean') return `b:${v ? 1 : 0};`;
  if (typeof v === 'number') return Number.isInteger(v) ? `i:${v};` : `d:${v};`;
  if (typeof v === 'string') return `s:${Buffer.byteLength(v, 'utf8')}:"${v}";`;
  const entries = Array.isArray(v) ? v.map((x, k) => [k, x]) : Object.entries(v);
  return `a:${entries.length}:{${entries.map(([k, x]) => phpSerialize(typeof k === 'number' ? k : String(k)) + phpSerialize(x)).join('')}}`;
}
