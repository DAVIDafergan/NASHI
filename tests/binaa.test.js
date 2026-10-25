// א.ש בינה municipal / community-centre sites. No real capture yet: the list markup below follows the item text seen
// on modil.org.il/events/, betshemesh.muni.il/events/ and netivim.org.il/events/ (Oct 2026); the event page is synthetic.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseSite, parseItemText, parseBinaaList, filterPages, nextPage, normalizeBinaa, createBinaaAdapter } from '../server/importer/adapters/binaa.js';
import { israelParts } from '../server/importer/time.js';

const MODIL = `<html><body><header><a href="/events/">אירועים</a></header>
<form><select name="audience"><option value="">כל קהלי היעד</option><option value="12">נשים</option><option value="13">בנות כיתות ז'-ח'</option></select>
<select name="category"><option value="">כל הקטגוריות</option><option value="5">ספורט</option></select></form>
<ul>
<li><a href="/events/306/"><h3>מגע הקסם של פוטושופ להפוך תמונה ליצירה</h3><span>יום ראשון, י"ד חשון התשפ"ז, 25.10.2026</span> <span>20:30 - 22:00</span>
 <span>מרכז מעל"ה באשכול הפיס, אבני נזר 59</span> <span>לפרטים נוספים</span> <span>#נשים#סדנאות לנשים</span></a></li>
<li><a href="/events/326/"><h3>לגלות את הקסם שבעולם הקומיקס</h3> יום ראשון, כ"א חשון התשפ"ז, 01.11.2026 17:00 - 19:00 אשכול הפיס, אבני נזר 59 לפרטים נוספים #בנות כיתות ז'-ח'#סדנאות ואירועים לבנות</a></li>
<li><a href="/events/317/">צעדים ראשונים - אימא, תינוק ורגעים קסומים יום חמישי, כ"ה חשון התשפ"ז, 05.11.2026 09:30 מרכז קהילתי רחוב רבי יהודה הנשיא 3 לפרטים נוספים #נשים#סדנאות לנשים</a></li>
<li><a href="/events/340/">חוג התעמלות לנשים יום שני, 02.11.2026 19:00 מתנ"ס גני מודיעין לפרטים נוספים #נשים</a></li>
<li><a href="/events/340/">חוג התעמלות לנשים יום שני, 09.11.2026 19:00 מתנ"ס גני מודיעין לפרטים נוספים #נשים</a></li>
<li><a href="/events/340/">חוג התעמלות לנשים יום שני, 16.11.2026 19:00 מתנ"ס גני מודיעין לפרטים נוספים #נשים</a></li>
<li><a href="/events/351/">ערב גיבוש לגברים יום שני, 02.11.2026 20:00 בית הכנסת לפרטים נוספים #גברים</a></li>
</ul>
<a class="next" rel="next" href="/events/page/2/">הבא</a>
</body></html>`;

const NETIVIM = `<a href="https://netivot.smarticket.co.il/%D7%A2%D7%A8%D7%91_%D7%A0%D7%A9%D7%99%D7%9D">03/11 השלוחה החרדית | ערב נשים לראש חודש משכן פיס 03/11/2026 20:00</a>
<a href="https://www.netivim.org.il/events/?category=all">כל האירועים</a>`;

const PAGE_306 = `<html><head><meta property="og:title" content="מגע הקסם של פוטושופ | מודיעין עילית"><meta property="og:image" content="/uploads/events/306/flyer.jpg">
<meta property="og:site_name" content="עיריית מודיעין עילית"></head><body><header><nav>תפריט</nav></header>
<main><h1>מגע הקסם של פוטושופ להפוך תמונה ליצירה</h1><p>סדנה מעשית לנשים בלבד: עריכת תמונות, שכבות ומסכות. מנחה: הגב' ר. כהן.</p>
<p>מיקום: מרכז מעל"ה באשכול הפיס, אבני נזר 59</p><p>מחיר: 40 ₪</p><a href="https://modil.smarticket.co.il/event/1234">להרשמה</a></main><footer>כל הזכויות</footer></body></html>`;

describe('binaa: sites, list items', () => {
  test('site specs (env format)', () => {
    assert.deepEqual(parseSite('modil.org.il|מודיעין עילית|1'), { id: 'modil.org.il', url: 'https://modil.org.il/events/', origin: 'https://modil.org.il', city: 'מודיעין עילית', haredi: true });
    const m = parseSite('meytarim-j.org.il/events/?branch=2|ירושלים|1');
    assert.equal(m.id, 'meytarim-j.org.il~2'); assert.equal(m.url, 'https://meytarim-j.org.il/events/?branch=2');
    assert.equal(parseSite(''), null);
  });

  test('item text → title, Israel date + time range, place, hashtags', () => {
    const it = parseItemText('מגע הקסם של פוטושופ להפוך תמונה ליצירה יום ראשון, י"ד חשון התשפ"ז, 25.10.2026 20:30 - 22:00 מרכז מעל"ה באשכול הפיס, אבני נזר 59 לפרטים נוספים #נשים#סדנאות לנשים');
    assert.equal(it.title, 'מגע הקסם של פוטושופ להפוך תמונה ליצירה');
    assert.deepEqual(israelParts(it.startAt), { date: '2026-10-25', time: '20:30' });
    assert.deepEqual(israelParts(it.endAt), { date: '2026-10-25', time: '22:00' });
    assert.equal(it.place, 'מרכז מעל"ה באשכול הפיס, אבני נזר 59');
    assert.deepEqual(it.tags, ['נשים', 'סדנאות לנשים']);
  });

  test('list: internal /events/<id>/ links, sessions of a repeated id merged; SmarTicket links kept with their venue', () => {
    const l = Object.fromEntries(parseBinaaList(MODIL, 'https://www.modil.org.il/events/').map(x => [x.key, x]));
    assert.deepEqual(Object.keys(l).sort(), ['b:306', 'b:317', 'b:326', 'b:340', 'b:351']);
    assert.equal(l['b:306'].url, 'https://www.modil.org.il/events/306/');
    assert.equal(l['b:340'].sessions.length, 3);
    const n = parseBinaaList(NETIVIM, 'https://www.netivim.org.il/events/');
    assert.equal(n.length, 1);
    assert.equal(n[0].kind, 'smarticket'); assert.equal(n[0].venue, 'netivot');
    assert.deepEqual(israelParts(n[0].sessions[0].startAt), { date: '2026-11-03', time: '20:00' });
  });

  test('women / Haredi filter options and the next page are followed', () => {
    const f = filterPages(MODIL, 'https://www.modil.org.il/events/');
    assert.deepEqual(f.map(x => x.url), ['https://www.modil.org.il/events/?audience=12']);
    assert.equal(nextPage(MODIL, 'https://www.modil.org.il/events/'), 'https://www.modil.org.il/events/page/2/');
  });
});

describe('binaa: event page + adapter', () => {
  const site = parseSite('modil.org.il|מודיעין עילית|1');

  test('event page → flyer, price, registration link, city from the site', () => {
    const [item] = parseBinaaList(MODIL, 'https://www.modil.org.il/events/');
    const n = normalizeBinaa({ html: PAGE_306, url: 'https://www.modil.org.il/events/306/', site, item, session: item.sessions[0] });
    assert.equal(n.title, 'מגע הקסם של פוטושופ להפוך תמונה ליצירה');
    assert.equal(n.imageUrl, 'https://www.modil.org.il/uploads/events/306/flyer.jpg');
    assert.equal(n.priceMin, 40);
    assert.equal(n.ticketUrl, 'https://modil.smarticket.co.il/event/1234');
    assert.equal(n.city, 'מודיעין עילית'); assert.equal(n.region, 'shomron');
    assert.match(n.category, /נשים/);
    assert.equal(n.strong, true);
  });

  test('discover → prefilter: women-tagged Modiin Illit items pass, girls / men do not; a course → next session only', async () => {
    const pages = {
      'https://modil.org.il/events/': MODIL,
      'https://www.modil.org.il/events/?audience=12': '',
      'https://modil.org.il/events/?audience=12': '',
      'https://modil.org.il/events/page/2/': '<p>אין אירועים נוספים</p>',
    };
    const http = { async getText(u) { if (!(u in pages)) throw new Error(`404 ${u}`); return { text: pages[u], url: u }; } };
    const errors = [];
    const ctx = { async channel(name, fn) { try { await fn(); } catch (e) { errors.push(e.message); } } };
    const ad = createBinaaAdapter({ sites: [site] });
    const cands = await ad.discover(http, ctx);
    assert.deepEqual(errors, []);
    const now = new Date('2026-10-25T08:00:00Z');
    const pass = cands.filter(c => ad.prefilter(c, now, 'haredi') === '').map(c => c.sourceId).sort();
    assert.deepEqual(pass, ['modil.org.il:306', 'modil.org.il:317', 'modil.org.il:340']);
    const course = cands.filter(c => c.sourceId.startsWith('modil.org.il:340'));
    assert.equal(course.length, 1);
    assert.deepEqual(israelParts(course[0].session.startAt), { date: '2026-11-02', time: '19:00' });
  });

  test('details on a SmarTicket-linked item use the SmarTicket page', async () => {
    const st = '<html><head><title>ערב נשים לראש חודש • מתנ"ס נתיבות • השלוחה החרדית</title><meta property="og:image" content="https://netivot.smarticket.co.il/media/x.jpg"></head><body><script type="application/ld+json">{"@type":"Event","name":"ערב נשים לראש חודש","startDate":"2026-11-03T20:00","location":{"name":"משכן פיס","address":{"addressLocality":"נתיבות"}},"offers":{"price":"30"}}</script></body></html>';
    const ns = parseSite('netivim.org.il|נתיבות|');
    const http = { async getText(u) { return u.includes('/events/') ? { text: NETIVIM, url: u } : { text: st, url: u }; } };
    const ad = createBinaaAdapter({ sites: [ns], maxPages: 1 });
    const [c] = await ad.discover(http, { channel: async (n, fn) => fn() });
    const n = await ad.details(c, http);
    assert.equal(n.title, 'ערב נשים לראש חודש');
    assert.equal(n.city, 'נתיבות'); assert.equal(n.priceMin, 30);
    assert.match(n.sourceId, /^smarticket:netivot:/);
  });
});
