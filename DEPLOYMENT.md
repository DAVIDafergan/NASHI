# מדריך פריסה ל-Railway

## משתני סביבה נדרשים ב-Railway

ודא שכל המשתנים הבאים מוגדרים ב-Railway Dashboard → Variables:

| משתנה | תיאור |
|-------|-------|
| `MONGO_URI` | מחרוזת חיבור ל-MongoDB Atlas |
| `JWT_SECRET` | מפתח סודי לחתימת טוקנים (מחרוזת אקראית ארוכה) |
| `RESEND_API_KEY` | מפתח API של Resend לשליחת מיילים |
| `GEMINI_API_KEY` | מפתח API של Google Gemini |

## פריסה ל-Railway

1. Push לענף `main`
2. Railway יריץ אוטומטית: `npm run build` ואז `node server.js`
3. ה-build יצור תיקיית `dist/` שהשרת מגיש ממנה את ה-Frontend

## פיתוח מקומי

```bash
# התקן תלויות
npm install

# צור קובץ .env מ-.env.example
cp .env.example .env
# ערוך את .env עם הערכים האמיתיים

# הפעל שרת backend בטרמינל ראשון
node server.js

# הפעל frontend dev server בטרמינל שני
npm run dev
```
