const mongoose = require('mongoose');

// --- User Model ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  address: String,
  communicationPref: { type: String, default: 'whatsapp' },
  points: { type: Number, default: 50 },
  level: { type: String, default: 'מתחילה' },
  upcomingEvents: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
  likedEventIds: [String],
  avatar: String,
  createdAt: { type: Date, default: Date.now }
});

// --- Event Model ---
const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  location: String,
  category: String,
  price: Number,
  image: String,
  tags: [String],
  ratings: [Number],
  isHero: { type: Boolean, default: false }
});

// --- Class Model ---
const ClassSchema = new mongoose.Schema({
  title: { type: String, required: true },
  instructor: String,
  contactPhone: String,
  day: String,
  time: String,
  location: String,
  price: Number,
  ageGroup: String,
  image: String,
  category: String
});

// --- Lottery Model ---
const LotterySchema = new mongoose.Schema({
  title: { type: String, required: true },
  prize: String,
  drawDate: Date,
  image: String,
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
  winnerId: String,
  eligibilityType: { type: String, default: 'all' },
  minPointsToEnter: { type: Number, default: 0 },
  minLevel: String,
  specificUserId: String
});

// --- Review Model ---
const ReviewSchema = new mongoose.Schema({
  eventId: String,
  eventTitle: String,
  userId: String,
  userName: String,
  rating: Number,
  comment: String,
  date: { type: Date, default: Date.now }
});

// --- Personality Profile Model ---
const PersonalitySchema = new mongoose.Schema({
  name: String,
  role: String,
  image: String,
  questions: [{ question: String, answer: String }],
  isActive: { type: Boolean, default: true }
});

module.exports = {
  User: mongoose.model('User', UserSchema),
  Event: mongoose.model('Event', EventSchema),
  Class: mongoose.model('Class', ClassSchema),
  Lottery: mongoose.model('Lottery', LotterySchema),
  Review: mongoose.model('Review', ReviewSchema),
  Personality: mongoose.model('Personality', PersonalitySchema)
};