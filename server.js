import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
// שינוי הנתיב ל-routes.js כדי להתאים למבנה שלך
import apiRoutes from './server/routes.js'; 
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Resend } from 'resend'; // תוספת: ייבוא ספריית המיילים
import { GoogleGenerativeAI } from "@google/generative-ai"; // תוספת: ייבוא ספריית גמיני

// הגדרת משתנים גלובליים דומים ל-CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// בדיקת קיום API keys (בלי להדפיס את הערכים עצמם)
if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY is not set – email sending will not work');
}
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY is not set – AI features will not work');
}

// אתחול Resend - המפתח יימשך אוטומטית מה-Variables ב-Railway
const resend = new Resend(process.env.RESEND_API_KEY);

// אתחול Gemini AI - המפתח יימשך מה-Variables ב-Railway
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// תיקון: שימוש במשתנה הסביבה הנכון של Railway
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/nashi_db';

// --- Middleware מעודכן ---
app.use(cors());

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
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  });

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

if (!fs.existsSync(distPath)) {
  console.warn('⚠️  dist/ folder not found – run "npm run build" to generate it');
}

// תיקון קאש מוחלט לספארי וכרום! (מונע מהדפדפן לשמור שגיאות ישנות או מסך לבן)
app.use(express.static(distPath, {
  setHeaders: (res, path) => {
    // מניעת קאש מוחלטת לקבצי HTML
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// שלב 2: Fallback - כל נתיב שלא נמצא ב-API, יחזיר את האתר (React)
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('Frontend not built. Run "npm run build" first.');
  }
  res.sendFile(indexPath);
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});