// --- Enums ---

export enum UserLevel {
  BEGINNER = 'מתחילה',
  ACTIVE = 'פעילה',
  LEADER = 'מובילת קהילה',
  CREATOR = 'יוצרת',
  AMBASSADOR = 'שגרירת תרבות'
}

export type CommunicationPreference = 'email' | 'whatsapp' | 'sms' | 'print';

// --- Interfaces ---

export interface User {
  id: string;
  _id?: string; // תאימות ל-MongoDB
  name: string;
  email: string;
  phone?: string;
  address?: string;
  age?: number;
  occupation?: string;
  communicationPref?: CommunicationPreference;
  points: number;
  level: UserLevel;
  upcomingEvents: number;
  isAdmin?: boolean;
  likedEventIds?: string[];
  avatar?: string;
  
  // שדות חדשים למערכת המעגל הנשי
  isMemberRequested: boolean; // האם הגישה בקשת הצטרפות
  isMemberApproved: boolean;  // האם אושרה ע"י המנהלת
  createdAt?: string;
}

export interface Review {
  id: string;
  eventId: string;
  eventTitle: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface EventItem {
  id: string;
  _id?: string;
  title: string;
  date: string;
  location: string;
  category: string;
  price: number;
  image: string;
  tags: string[];
  ratings: number[];
  isHero?: boolean;
  registrationLink?: string;
  attendees?: string[];
}

export interface ClassItem {
  id: string;
  _id?: string;
  title: string;
  instructor: string;
  contactPhone?: string;
  day: string;
  time: string;
  location: string;
  price: number;
  ageGroup: string;
  image: string;
  category: string;
  exceptions?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  date: string;
  important: boolean;
}

export type LotteryEligibilityType = 'all' | 'points' | 'level' | 'specific_user';

export interface LotteryItem {
  id: string;
  _id?: string;
  title: string;
  prize: string;
  drawDate: string;
  image: string;
  participants: string[]; 
  isActive: boolean;
  winnerId?: string;
  eligibilityType: LotteryEligibilityType;
  minPointsToEnter?: number;
  minLevel?: UserLevel;
  specificUserId?: string;
}

// --- אשת השבוע (Personality) ---

export interface PersonalityQuestion {
  question: string;
  answer: string;
}

export interface PersonalityProfile {
  id: string;
  _id?: string;
  name: string;
  role: string;
  image: string;
  questions: PersonalityQuestion[];
  isActive: boolean;
  externalToken?: string; // טוקן למילוי שאלון חיצוני
}

// --- פורום נשי (חדש!) ---

export interface ForumComment {
  authorName: string;
  text: string;
  createdAt: string;
}

export interface ForumPost {
  _id: string;
  title: string;
  content: string;
  image?: string;
  author: string; // User ID
  authorName: string;
  status: 'pending' | 'approved';
  likes: string[]; // User IDs
  dislikes: string[]; // User IDs
  comments: ForumComment[];
  createdAt: string;
}

// --- קהילה (חדש!) ---

export interface CommunityItem {
  _id: string;
  category: 'שיעורי תורה' | 'גמ"חים' | 'עסקים מקומיים';
  title: string;
  image?: string;
  location?: string;
  phone?: string;
  description?: string;
  createdAt?: string;
}