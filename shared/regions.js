// Regions and cities of NASHI — shared by the website (Vite) and the server (Node).
// Content items carry { city, region, scope }; users carry { city, region }.

export const REGIONS = [
  { id: 'north', name: 'צפון ועמקים' },
  { id: 'haifa', name: 'חיפה והקריות' },
  { id: 'sharon', name: 'השרון' },
  { id: 'center', name: 'מרכז' },
  { id: 'jerusalem', name: 'ירושלים והסביבה' },
  { id: 'shomron', name: 'יהודה ושומרון' },
  { id: 'south', name: 'דרום' },
];

export const CITIES = {
  north: ['מגדל העמק', 'עפולה', 'נוף הגליל', 'טבריה', 'צפת', 'כרמיאל', 'מעלות-תרשיחא', 'קריית שמונה', 'יקנעם', 'בית שאן', 'חצור הגלילית', 'נהריה', 'עכו', 'שלומי', 'רמת ישי', 'קצרין'],
  haifa: ['חיפה', 'קריית אתא', 'קריית ביאליק', 'קריית מוצקין', 'קריית ים', 'טירת כרמל', 'נשר', 'רכסים', 'זכרון יעקב', 'חדרה', 'פרדס חנה-כרכור', 'אור עקיבא'],
  sharon: ['נתניה', 'כפר סבא', 'רעננה', 'הוד השרון', 'הרצליה', 'רמת השרון', 'אבן יהודה', 'קדימה-צורן', 'כפר יונה'],
  center: ['תל אביב', 'רמת גן', 'גבעתיים', 'בני ברק', 'פתח תקווה', 'ראש העין', 'אלעד', 'ראשון לציון', 'חולון', 'בת ים', 'רחובות', 'נס ציונה', 'לוד', 'רמלה', 'מודיעין', 'יבנה', 'גדרה', 'באר יעקב', 'שוהם', 'קריית אונו', 'אור יהודה', 'גני תקווה'],
  jerusalem: ['ירושלים', 'בית שמש', 'מבשרת ציון', 'מעלה אדומים', 'ביתר עילית', 'אפרת', 'גוש עציון', 'גבעת זאב', 'הר אדר', 'צור הדסה'],
  shomron: ['אריאל', 'קרני שומרון', 'קדומים', 'עלי', 'שילה', 'בית אל', 'עמנואל', 'אלקנה', 'מודיעין עילית', 'קריית ארבע', 'הר חברון', 'כוכב יעקב', 'טלמון', 'שערי תקווה', 'אורנית'],
  south: ['באר שבע', 'אשדוד', 'אשקלון', 'קריית גת', 'קריית מלאכי', 'נתיבות', 'שדרות', 'אופקים', 'דימונה', 'ירוחם', 'ערד', 'אילת', 'מצפה רמון', 'ניצן'],
};

export const DEFAULT_CITY = 'מגדל העמק';
export const DEFAULT_REGION = 'north';

export const SCOPES = [
  { id: 'local', name: 'מקומי (עיר/אזור)' },
  { id: 'national', name: 'ארצי' },
  { id: 'online', name: 'מקוון (זום/אונליין)' },
];

export const AUDIENCES = ['נשים בלבד', 'נשים ובנות', 'נערות', 'בנות', 'אמהות ותינוקות', 'משפחות'];

export const regionName = (id) => (REGIONS.find(r => r.id === id) || {}).name || '';
export const regionOfCity = (city) => {
  for (const r of REGIONS) if ((CITIES[r.id] || []).includes(city)) return r.id;
  return '';
};
export const ALL_CITIES = REGIONS.flatMap(r => CITIES[r.id].map(c => ({ city: c, region: r.id })));
