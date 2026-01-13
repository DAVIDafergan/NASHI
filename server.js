import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet'; // שכבת הגנה לכותרות HTTP
import rateLimit from 'express-rate-limit'; // הגנה מפני התקפות מניעת שירות (DoS)
// שינוי הנתיב ל-routes.js כדי להתאים למבנה שלך
import apiRoutes from './server/routes.js'; 
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend'; // תוספת: ייבוא ספריית המיילים
import { GoogleGenerativeAI } from "@google/generative-ai"; // תוספת: ייבוא ספריית גמיני

// הגדרת משתנים גלובליים דומים ל-CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- אבטחת שרת מוגברת ---

// הגנה על כותרות השרת (מונע התקפות כמו Clickjacking ו-XSS)
app.use(helmet({
  contentSecurityPolicy: false, // מאפשר הרצה תקינה של ה-Frontend המשולב
}));

// הגבלת קצב בקשות (Rate Limiting) למניעת הצפת השרת והתקפות Brute Force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // חלון זמן של 15 דקות
  max: 100, // הגבלה ל-100 בקשות לכל כתובת IP
  message: 'יותר מדי בקשות מכתובת זו, אנא נסי שוב מאוחר יותר.'
});
app.use('/api/', limiter); // החלת ההגבלה רק על נתיבי ה-API

// אתחול Resend - המפתח יימשך אוטומטית מה-Variables ב-Railway
const resend = new Resend(process.env.RESEND_API_KEY);

// אתחול Gemini AI - המפתח יימשך מה-Variables ב-Railway
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// תיקון: שימוש במשתנה הסביבה הנכון של Railway
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/nashi_db';

// --- Middleware מעודכן ---

// הגדרת CORS מאובטחת - מאפשרת גישה רק לדומיין של האתר שלך בייצור
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // מומלץ להגדיר את ה-URL המדויק ב-Railway
  credentials: true
}));

// הגדלת המגבלה ל-50mb עבור שליחת תמונות Base64 כבדות ובאנרים של פרסומות
app.use(express.json({ limit: '50mb' }));

// הגדלת המגבלה לקבלת נתוני טפסים (Form Data)
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// תוספת: הנגשת resend ו-genAI לכל הראוטים ב-apiRoutes
app.use((req, res, next) => {
  req.resend = resend;
  req.genAI = genAI; // הנגשת גמיני לשרת
  next();
});

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.log('❌ MongoDB Connection Error:', err));

// Routes - API
// כל הראוטים כולל הודעות הנהלה, הגרלות ומשתמשים מנוהלים בתוך apiRoutes
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.send('Nashi API is running...');
});

// --- הגשת האתר (Frontend) ---

// שלב 1: הגדרת התיקייה הסטטית (Vite יוצר תיקיית dist)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// שלב 2: Fallback - כל נתיב שלא נמצא ב-API, יחזיר את האתר (React)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});