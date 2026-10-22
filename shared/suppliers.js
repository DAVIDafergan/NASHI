// Supplier directory taxonomy — shared by the website (Vite) and the server (Node).
// Categories are what a culture manager is looking for; styles are tags that narrow it down.
// Ids are stable (stored in the database); names can be reworded freely.

export const SUPPLIER_CATEGORIES = [
  { id: 'lectures', name: 'הרצאות', icon: 'mic', styles: ['העצמה', 'הורות וחינוך', 'זוגיות ושלום בית', 'אמונה ותורה', 'סיפור אישי', 'בריאות ותזונה', 'כלכלת הבית', 'הומור'] },
  { id: 'singers', name: 'מופעים וזמרות', icon: 'sparkles', styles: ['זמרת יחידה', 'מופע מוזיקלי', 'שירה חסידית', 'שירי ארץ ישראל', 'מופע ילדים', 'מופע קומי', 'קוסמת / אמנית במה'] },
  { id: 'theater', name: 'הצגות ותיאטרון', icon: 'drama', styles: ['מחזמר', 'הצגה לנשים', 'הצגה לבנות', 'תיאטרון בובות', 'תיאטרון קהילתי', 'מונודרמה'] },
  { id: 'workshops', name: 'סדנאות', icon: 'palette', styles: ['יצירה ואומנות', 'בישול ואפייה', 'עיצוב פרחים', 'צילום', 'כתיבה', 'שזירת חלות', 'תכשיטים', 'ספא ופינוק'] },
  { id: 'dance', name: 'מחול ותנועה', icon: 'footprints', styles: ['מחול חסידי', 'זומבה לנשים', 'ריקודי מעגל', 'להקת מחול', 'התעמלות ובריאות'] },
  { id: 'music', name: 'מוזיקה ולהקות', icon: 'music', styles: ['להקת נשים', 'נגנית יחידה', 'כלי הקשה / דרבוקות', 'מקהלה', 'די־ג׳יי לנשים'] },
  { id: 'catering', name: 'קייטרינג וכיבוד', icon: 'utensils', styles: ['בשרי', 'חלבי', 'פרווה', 'מגשי אירוח', 'קינוחים ועוגות', 'בר קפה', 'כשרות מהדרין', 'בד״ץ'] },
  { id: 'sound', name: 'הגברה ותאורה', icon: 'speaker', styles: ['הגברה לאולם', 'הגברה לחוץ', 'תאורת במה', 'מסכים והקרנה', 'טכנאית אישה'] },
  { id: 'photo', name: 'צילום ווידאו', icon: 'camera', styles: ['צלמת אישה', 'צילום סטילס', 'וידאו', 'מגנטים', 'עמדת צילום'] },
  { id: 'activities', name: 'הפעלות', icon: 'party', styles: ['הפעלה לנשים', 'הפעלה לבנות ונערות', 'הפעלה לילדים', 'חדר בריחה נייד', 'משחקי חברה', 'גיבוש צוות'] },
  { id: 'hosts', name: 'מנחות ערב', icon: 'presentation', styles: ['מנחת טקסים', 'מנחה קומית', 'מנחת כנסים', 'קריינית'] },
  { id: 'venues', name: 'אולמות ומקומות', icon: 'building', styles: ['אולם אירועים', 'אולם הרצאות', 'מתנ״ס', 'גן אירועים', 'צימר / מתחם נופש', 'מקום אונליין'] },
  { id: 'design', name: 'עיצוב ותפאורה', icon: 'flower', styles: ['עיצוב שולחנות', 'בלונים', 'פרחים', 'תפאורת במה', 'עיצוב גרפי והזמנות', 'שלטים ובאנרים'] },
  { id: 'transport', name: 'הסעות', icon: 'bus', styles: ['אוטובוס', 'מיניבוס', 'נהגת אישה', 'הסעות בין־עירוניות'] },
  { id: 'gifts', name: 'מתנות ומזכרות', icon: 'gift', styles: ['מארזים', 'מזכרות ממותגות', 'שי לחג', 'פרסים להגרלות'] },
  { id: 'other', name: 'אחר', icon: 'more', styles: [] },
];

export const SUPPLIER_PRICE_RANGES = [
  { id: 'low', name: 'עד ₪1,000' },
  { id: 'mid', name: '₪1,000–3,000' },
  { id: 'high', name: '₪3,000–7,000' },
  { id: 'premium', name: 'מעל ₪7,000' },
  { id: 'quote', name: 'לפי הצעת מחיר' },
];

export const SUPPLIER_STATUSES = ['pending_payment', 'active', 'expired', 'suspended'];

export const SUPPLIER_STATUS_LABELS = {
  pending_payment: 'ממתין לתשלום',
  active: 'פעיל',
  expired: 'פג תוקף',
  suspended: 'מושהה',
};

export const supplierCategoryName = (id) => (SUPPLIER_CATEGORIES.find(c => c.id === id) || {}).name || '';
export const CATEGORY_IDS = SUPPLIER_CATEGORIES.map(c => c.id);
export const ALL_STYLES = [...new Set(SUPPLIER_CATEGORIES.flatMap(c => c.styles))];
