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
  
  // שדות לאיפוס סיסמה (חדש)
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  
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

// --- סכמת קהילה מעודכנת ---
const CommunitySchema = new mongoose.Schema({
  category: { type: String, enum: ['שיעורי תורה', 'גמ"חים', 'עסקים מקומיים', 'עסק מקומי'], required: true },
  title: { type: String, required: true },
  image: { type: String },
  location: { type: String },
  phone: { type: String },
  description: { type: String },
  // שדות חדשים שהתווספו לבקשתך
  startTime: { type: String },
  targetAudience: { type: String }, // למי זה מיועד
  isPaid: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Community = mongoose.model('Community', CommunitySchema);

// --- סכמת אירוע מעודכנת ---
const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String }, // השדה החדש שביקשת להוסיף לשמירת השעה
  location: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  category: { type: String },
  price: { type: Number, default: 0 },
  // שדות חדשים למחיר מוקדם ומפגשים
  earlyBirdPrice: { type: Number },
  earlyBirdEndDate: { type: Date },
  sessions: [{ name: String, date: Date }],
  // שדות חדשים נוספים (גילאים והערות)
  targetAges: { type: String },
  notes: { type: String },
  // שדות חדשים שנוספו כעת
  hebrewDate: { type: String }, // תאריך עברי
  ticketLink: { type: String }, // לינק לרכישת כרטיסים חיצונית
  logo: { type: String }, // לוגו קטן לאירוע
  // המשך שדות קיימים
  isHero: { type: Boolean, default: false },
  registrationLink: { type: String },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});
const Event = mongoose.model('Event', EventSchema);

const ClassSchema = new mongoose.Schema({
  title: { type: String, required: true }, // הכותרת נשארה חובה למניעת שגיאות אינדוקס
  instructor: { type: String },
  contactPhone: { type: String },
  // שדה חדש לטלפון הרשמה
  registrationPhone: { type: String },
  // המשך שדות קיימים
  day: { type: String },
  time: { type: String },
  location: { type: String },
  price: { type: Number, default: 0 },
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
  // שדות חדשים לפרסים נוספים
  prize2: { type: String },
  prize3: { type: String },
  drawDate: { type: Date, required: true },
  image: { type: String },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
  // שדות חדשים לזכאות וניהול זוכה - הוספת 'mission' ל-enum
  participationType: { type: String, enum: ['everyone', 'points', 'link_only', 'mission'], default: 'everyone' },
  missionText: { type: String, default: '' }, // טקסט המשימה (חדש!)
  missionStarted: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // מי שהתחילה משימה (חדש!)
  minPointsToEnter: { type: Number, default: 0 },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // מזהה הזוכה לאחר ההגרלה
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
  motto: { type: String }, // הוספת מוטו לסכמה
  questions: [{ question: String, answer: String }],
  isActive: { type: Boolean, default: false },
  externalToken: { type: String },
  updatedAt: { type: Date, default: Date.now }
});
const Personality = mongoose.model('Personality', PersonalitySchema);

// --- מודלים חדשים: השראה יומית ופרסומות ---

const InspirationSchema = new mongoose.Schema({
  text: { type: String, required: true },
  author: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Inspiration = mongoose.model('Inspiration', InspirationSchema);

const AdSchema = new mongoose.Schema({
  title: { type: String },
  type: { type: String, enum: ['image', 'video'], default: 'image' },
  content: { type: String, required: true }, // ה-DataURL או הלינק
  link: { type: String }, // לינק חיצוני ללחיצה
  createdAt: { type: Date, default: Date.now }
});
const Ad = mongoose.model('Ad', AdSchema);

// --- מודל הודעות הנהלה (חדש!) ---
const AnnouncementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.model('Announcement', AnnouncementSchema);

// --- מודל הגרלת שולחן שבת (חדש!) ---
const ShabbatLotterySchema = new mongoose.Schema({
  prize: { type: String, default: 'פרס יוקרתי' },
  notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winnerFamily: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const ShabbatLottery = mongoose.model('ShabbatLottery', ShabbatLotterySchema);

const ShabbatEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  familyName: { type: String, required: true },
  image: { type: String, required: true }, // Base64 תמונה
  createdAt: { type: Date, default: Date.now }
});
const ShabbatEntry = mongoose.model('ShabbatEntry', ShabbatEntrySchema);

export { 
  User, Event, Class, Lottery, Settings, GiftCode, 
  Personality, ForumPost, Community, Inspiration, Ad,
  Announcement, ShabbatLottery, ShabbatEntry
};