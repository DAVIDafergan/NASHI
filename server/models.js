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
  likedEventIds: [{ type: String }],
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
  price: { type: Number, default: 0 },
  isHero: { type: Boolean, default: false },
  registrationLink: { type: String },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});
const Event = mongoose.model('Event', EventSchema);

// --- סכמת חוג ---
const ClassSchema = new mongoose.Schema({
  title: { type: String, required: true },
  instructor: { type: String },
  contactPhone: { type: String },
  day: { type: String },
  time: { type: String },
  location: { type: String },
  price: { type: Number },
  ageGroup: { type: String },
  exceptions: { type: String },
  category: { type: String },
  image: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Class = mongoose.model('Class', ClassSchema);

// --- סכמת הגרלה ---
const LotterySchema = new mongoose.Schema({
  title: { type: String, required: true },
  prize: { type: String, required: true },
  drawDate: { type: Date, required: true },
  image: { type: String },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
  eligibilityType: { type: String, default: 'all' },
  minPointsToEnter: { type: Number, default: 0 },
  minLevel: { type: String, default: 'BEGINNER' }
});
const Lottery = mongoose.model('Lottery', LotterySchema);

// --- הגדרות מערכת ---
const SettingsSchema = new mongoose.Schema({
  pointsPerRegister: { type: Number, default: 50 },
  pointsPerEventJoin: { type: Number, default: 10 },
  pointsPerShare: { type: Number, default: 5 }
});
const Settings = mongoose.model('Settings', SettingsSchema);

// --- קודי מתנה ---
const GiftCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  points: { type: Number, required: true },
  maxUses: { type: Number, default: 1000 },
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: { type: Date }
});
const GiftCode = mongoose.model('GiftCode', GiftCodeSchema);

// --- סכמת אישיות השבוע (חדש!) ---
const PersonalitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String },
  image: { type: String },
  questions: [{ 
    question: { type: String }, 
    answer: { type: String } 
  }],
  isActive: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});
const Personality = mongoose.model('Personality', PersonalitySchema);

module.exports = { User, Event, Class, Lottery, Settings, GiftCode, Personality };