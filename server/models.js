import mongoose from 'mongoose';

// --- סכמת משתמש מעודכנת ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  age: { type: Number },
  occupation: { type: String },
  avatar: { type: String },
  isAdmin: { type: Boolean, default: false },
  points: { type: Number, default: 0 },
  
  // שדות מעגל נשי
  isMemberRequested: { type: Boolean, default: false },
  isMemberApproved: { type: Boolean, default: false },
  
  likedEventIds: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// --- סכמת פורום נשי ---
const ForumPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  image: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: String,
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    authorName: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});
const ForumPost = mongoose.model('ForumPost', ForumPostSchema);

// --- סכמת קהילה ---
const CommunitySchema = new mongoose.Schema({
  category: { type: String, enum: ['שיעורי תורה', 'גמ"חים', 'עסקים מקומיים'], required: true },
  title: { type: String, required: true },
  image: { type: String },
  location: { type: String },
  phone: { type: String },
  description: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Community = mongoose.model('Community', CommunitySchema);

// --- שאר הסכמות הקיימות ---
const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  category: { type: String },
  price: { type: Number, default: 0 },
  // שדות חדשים למחיר מוקדם ומפגשים
  earlyBirdPrice: { type: Number },
  earlyBirdEndDate: { type: Date },
  sessions: [{ name: String, date: Date }],
  // המשך שדות קיימים
  isHero: { type: Boolean, default: false },
  registrationLink: { type: String },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});
const Event = mongoose.model('Event', EventSchema);

const ClassSchema = new mongoose.Schema({
  title: { type: String, required: true },
  instructor: { type: String },
  contactPhone: { type: String },
  // שדה חדש לטלפון הרשמה
  registrationPhone: { type: String },
  // המשך שדות קיימים
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

const LotterySchema = new mongoose.Schema({
  title: { type: String, required: true },
  prize: { type: String, required: true },
  drawDate: { type: Date, required: true },
  image: { type: String },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
  minPointsToEnter: { type: Number, default: 0 }
});
const Lottery = mongoose.model('Lottery', LotterySchema);

const SettingsSchema = new mongoose.Schema({
  pointsPerRegister: { type: Number, default: 50 },
  pointsPerEventJoin: { type: Number, default: 10 },
  pointsPerShare: { type: Number, default: 5 }
});
const Settings = mongoose.model('Settings', SettingsSchema);

const GiftCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  points: { type: Number, required: true },
  maxUses: { type: Number, default: 1000 },
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
const GiftCode = mongoose.model('GiftCode', GiftCodeSchema);

const PersonalitySchema = new mongoose.Schema({
  name: { type: String },
  role: { type: String },
  image: { type: String },
  questions: [{ question: String, answer: String }],
  isActive: { type: Boolean, default: false },
  externalToken: { type: String },
  updatedAt: { type: Date, default: Date.now }
});
const Personality = mongoose.model('Personality', PersonalitySchema);

export { User, Event, Class, Lottery, Settings, GiftCode, Personality, ForumPost, Community };