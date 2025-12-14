const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const apiRoutes = require('./server/routes'); // <--- תיקון נתיב הייבוא
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nashi_db';

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Routes
// שימוש בנתיב בסיס כדי לאפשר ל-Frontend לגשת ל-/api/register
app.use('/api', apiRoutes); 

// Fallback / Health Check (כדי ש-Railway יוכל לבדוק את השרת)
app.get('/', (req, res) => {
  res.send('Nashi API is running...');
});

// הגשת קבצים סטטיים של Frontend (בהנחה ש-client/dist קיים בתיקייה הראשית)
app.use(express.static(path.join(__dirname, 'client/dist'))); 

// Fallback לכל הנתיבים הלא מוכרים (SPA mode)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
});


// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});