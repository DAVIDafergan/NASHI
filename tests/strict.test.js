// Strict Haredi rules (IMPORTER_AUDIENCE=haredi, the default) + the re-check that purges what's already live.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { strictHaredi, audienceMode } from '../server/importer/classify.js';

const drop = (e) => { const r = strictHaredi(e); assert.equal(r.ok, false, `${e.title}: ${JSON.stringify(r)}`); return r; };
const keep = (e) => { const r = strictHaredi(e); assert.equal(r.ok, true, `${e.title}: ${JSON.stringify(r)}`); return r; };

describe('strict Haredi rules', () => {
  test('default mode is strict Haredi', () => { const old = process.env.IMPORTER_AUDIENCE; delete process.env.IMPORTER_AUDIENCE; assert.equal(audienceMode(), 'haredi'); if (old) process.env.IMPORTER_AUDIENCE = old; });
  // the events the owner found live (titles / places as reported)
  const LIVE_BAD = [
    { title: 'מסיבת בחירות-קאלמה', location: 'כרמים' },
    { title: 'לומדות יחד: בית מדרש לנשות הנגב המערבי', location: 'קיבוץ עלומים' },
    { title: 'איראן', description: 'הרצאה', city: 'חיפה' }, { title: 'מצרים', description: 'הרצאה', city: 'חיפה' }, { title: 'נשות הפנתיאון', description: 'הרצאה', city: 'חיפה' },
    { title: 'סטבט מאטר', description: 'קונצרט' }, { title: 'Stabat Mater - פרגולזי' },
    { title: 'כשפולק פוגשות אפרו' },
    { title: 'צעדת העגלות לאמהות ואבות', city: 'פתח תקווה' },
    { title: 'פילאטיס לאמהות', city: 'פתח תקווה' },
    { title: 'ערב העצמה עם פנינה רוזנבלום', description: 'ערב לנשים', city: 'פתח תקווה' },
    { title: 'האישה בלבן', description: 'דוקאביב בלוד' }, { title: 'האישה שלא ידעה לאהוב', description: 'הקרנה במסגרת דוקאביב' },
    { title: 'ליבילנד', description: 'נעמ"ת לוד', city: 'לוד' },
    { title: 'ריספקט - מופע בידור לכבוד חודש האישה', city: 'נתניה', category: 'ערבי נשים' },
    { title: 'נשים כובשות עולם', city: 'נתניה', category: 'ערבי נשים' },
    { title: 'חשבונות שמיים', description: 'סרט', city: 'בית שמש' },
    { title: 'האמת שמתחת לגלימה' },
    { title: 'פסטיבל צבעים של שירה #6 | ימי נשים 8-9.11', location: 'אודיטוריום נאוה ביבי' },
  ];
  for (const e of LIVE_BAD) test(`✗ ${e.title}`, () => drop(e));

  test('hard rejects win over every Haredi signal', () => {
    for (const t of ['מסיבת חנוכה לנשים בלבד', 'ערב ריקודים לנשים חרדיות', 'רחבה לנשים בבני ברק']) assert.equal(drop({ title: t, city: 'בני ברק' }).hard, true, t);
    assert.equal(drop({ title: 'יוגה לנשים', city: 'בני ברק' }).hard, true, 'yoga needs an explicit Haredi word, a Haredi city is not enough');
    assert.equal(drop({ title: 'פילאטיס לנשים חרדיות', city: 'בני ברק' }).hard, true, 'pilates / yoga are out (owner, 2026-10-25)');
    assert.equal(drop({ title: 'הקרנת סרט לנשים', city: 'אלעד' }).reason, 'סרט שלא מסומן לנשים בלבד');
    keep({ title: 'הקרנת סרט', description: 'לנשים בלבד, ללא סרטים בהפקה', city: 'אלעד' });
  });
  test('kept: women-only AND a Haredi signal', () => {
    keep({ title: 'מיכל לויטין - מופע חדש', category: 'חרדיוות', city: 'בית שמש' });
    keep({ title: 'הצגה נעדרות', description: 'הצגה קומית לנשים בלבד', city: 'גדרה', strong: true });
    keep({ title: 'המחזמר "אמא"', description: 'לנשים ולנערות בלבד', location: 'בנייני האומה', city: 'ירושלים' });
    keep({ title: 'כנס נשים - אמונה', city: 'אלעד' });
    keep({ title: 'ערב לנשים', description: 'בהפקת השלוחה החרדית', city: 'נתיבות' });
    keep({ title: 'מחזמר לבנות סמינר', city: 'חיפה' });
  });
  test('when unsure → reject', () => {
    drop({ title: 'שרות קרליבך', description: 'מופע לנשים בלבד!', city: 'ירושלים' }); // women only, but no Haredi signal
    drop({ title: 'ערב שירה', city: 'בני ברק' });                                 // Haredi city, but not marked for women
    drop({ title: 'מופע', category: 'מוזיקה', city: 'בית שמש' });
  });
});

const MONGO = process.env.MONGO_TEST_URI;
describe('purge of what is already live (MongoDB)', { skip: !MONGO && 'set MONGO_TEST_URI to run' }, () => {
  let mongoose, Event, ImportBlock, reclassifyImported;
  before(async () => {
    mongoose = (await import('mongoose')).default;
    await mongoose.connect(MONGO.replace(/\/[^/]*$/, '/nashi_test_strict'));
    ({ Event, ImportBlock } = await import('../server/models.js'));
    ({ reclassifyImported } = await import('../server/importer/reclassify.js'));
    await Promise.all([Event.deleteMany({}), ImportBlock.deleteMany({})]);
  });
  after(async () => { await mongoose.disconnect(); });

  test('fails → deleted (+ blocked); duplicates collapsed; manual events untouched', async () => {
    const d = new Date('2026-12-01T00:00:00Z');
    const at = new Date('2026-12-01T18:00:00Z');
    const base = { date: d, startAt: at, location: 'אולם', image: '' };
    await Event.create([
      { ...base, title: 'מסיבת בחירות-קאלמה', city: 'עפולה', source: 'tickchak', sourceId: '1', sourceName: "טיקצ'אק" },
      { ...base, title: 'נשים כובשות עולם', city: 'נתניה', source: 'smarticket', sourceId: 'matnasgan:4503', sourceName: 'מתנ"ס גן', sourceCategory: 'ערבי נשים' },
      { ...base, title: 'מיכל לויטין - מופע חדש', city: 'בית שמש', source: 'smarticket', sourceId: 'betshemesh:786', sourceName: 'היכל התרבות בית שמש' }, // saved before categories were stored
      { ...base, title: 'הצגה נעדרות', description: 'הצגה קומית לנשים בלבד', city: 'גדרה', source: 'tickchak', sourceId: '113204', sourceName: 'גלאטיקט', harediSource: true },
      { ...base, title: 'ערב נשים - השלוחה החרדית', city: 'נתיבות', source: 'smarticket', sourceId: 'netivot:10', sourceCategory: 'נשים', importedAt: new Date('2026-10-01') },
      { ...base, title: 'ערב נשים - השלוחה החרדית', city: 'נתיבות', source: 'smarticket', sourceId: 'netivim:77', sourceCategory: 'נשים', importedAt: new Date('2026-10-02') },
      { ...base, title: 'מסיבה ידנית של מנהלת', city: 'עפולה' },
    ]);
    const r = await reclassifyImported({ Event, ImportBlock, mode: 'haredi' });
    const left = (await Event.find().lean()).map(e => e.sourceId || `manual:${e.title}`).sort();
    assert.deepEqual(left, ['113204', 'manual:מסיבה ידנית של מנהלת', 'netivot:10'].sort());
    const blocked = (await ImportBlock.find().lean()).map(b => b.sourceId).sort();
    assert.deepEqual(blocked, ['1', 'matnasgan:4503', 'netivim:77'].sort(), 'old SmarTicket event without its category is deleted but not blocked (re-checked with its category next run)');
    assert.equal(r.duplicates, 1);
    assert.equal(r.removed.length, 3);
  });
});
