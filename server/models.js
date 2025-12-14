const mongoose = require('mongoose');

// --- סכמת משתמש ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  communicationPref: { type: String, enum: ['email', 'sms', 'whatsapp'], default: 'email' },
  avatar: { type: String },
  isAdmin: { type: Boolean, default: false },
  points: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// --- סכמת אירוע ---
const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  category: { type: String },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});
const Event = mongoose.model('Event', EventSchema);

// --- סכמות נוספות ---
const ClassSchema = new mongoose.Schema({
  title: { type: String, required: true },
  instructor: { type: String },
  schedule: { type: String },
  description: { type: String },
  price: { type: Number }
});
const Class = mongoose.model('Class', ClassSchema);

const LotterySchema = new mongoose.Schema({
  title: { type: String, required: true },
  prize: { type: String, required: true },
  drawDate: { type: Date, required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
const Lottery = mongoose.model('Lottery', LotterySchema);

// ================== חדש: הגדרות ניהול ומתנות ==================

// שמירת הגדרות הניקוד (כדי שהמנהל יוכל לשנות)
const SettingsSchema = new mongoose.Schema({
  pointsPerRegister: { type: Number, default: 50 }, // הרשמה לאתר
  pointsPerEventJoin: { type: Number, default: 10 }, // הרשמה לאירוע
  pointsPerShare: { type: Number, default: 5 }      // שיתוף אירוע
});
const Settings = mongoose.model('Settings', SettingsSchema);

// קודי מתנה (לינקים לנקודות)
const GiftCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // הקוד בלינק (למשל: CHANUKAH2025)
  points: { type: Number, required: true }, // כמה נקודות זה נותן
  maxUses: { type: Number, default: 1000 }, // מקסימום משתמשים שיכולים לממש
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // מי כבר ניצל את הקוד
  expiresAt: { type: Date } // תוקף (אופציונלי)
});
const GiftCode = mongoose.model('GiftCode', GiftCodeSchema);

module.exports = { User, Event, Class, Lottery, Settings, GiftCode };