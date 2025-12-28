import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
// שינוי הנתיב ל-routes.js כדי להתאים למבנה שלך
import apiRoutes from './server/routes.js'; 
import path from 'path';
import { fileURLToPath } from 'url';

// הגדרת משתנים גלובליים דומים ל-CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// תיקון: שימוש במשתנה הסביבה הנכון של Railway
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/nashi_db';

// --- Middleware מעודכן עם הגבלת 16MB ---
app.use(cors());

// הגדלת המגבלה לקבלת נתוני JSON (עבור שליחת Base64 למשל)
app.use(express.json({ limit: '16mb' }));

// הגדלת המגבלה לקבלת נתוני טפסים (Form Data)
app.use(express.urlencoded({ limit: '16mb', extended: true }));

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Routes - API
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