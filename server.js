const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const apiRoutes = require('./server/routes'); 
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
// תיקון: שימוש במשתנה הסביבה הנכון של Railway אם קיים
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/nashi_db';

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Routes - API
app.use('/api', apiRoutes); 

// Health Check - הזזנו את זה ל-/health כדי שדף הבית יהיה פנוי לאתר
app.get('/health', (req, res) => {
  res.send('Nashi API is running...');
});

// --- הגשת האתר (Frontend) ---

// שלב 1: הגדרת התיקייה הסטטית (Vite יוצר תיקיית dist בתיקייה הראשית)
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