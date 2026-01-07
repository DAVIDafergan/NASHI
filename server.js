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

// --- Middleware מעודכן ---
app.use(cors());

// הגדלת המגבלה ל-50mb עבור שליחת תמונות Base64 כבדות ובאנרים של פרסומות
app.use(express.json({ limit: '50mb' }));

// הגדלת המגבלה לקבלת נתוני טפסים (Form Data)
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- הגדרת מודל הודעות הנהלה (חדש) ---
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.model('Announcement', announcementSchema);

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Routes - API
app.use('/api', apiRoutes);

// --- נתיבים חדשים עבור הודעות הנהלה (חדש) ---
app.get('/api/announcements', async (req, res) => {
  try {
    const anns = await Announcement.find().sort({ createdAt: -1 });
    res.json(anns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/announcements', async (req, res) => {
  try {
    const ann = new Announcement(req.body);
    await ann.save();
    res.status(201).json(ann);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/announcements/:id', async (req, res) => {
  try {
    const updated = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/announcements/:id', async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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