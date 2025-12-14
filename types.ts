export enum UserLevel {
  BEGINNER = 'מתחילה',
  ACTIVE = 'פעילה',
  LEADER = 'מובילת קהילה',
  CREATOR = 'יוצרת',
  AMBASSADOR = 'שגרירת תרבות'
}

export type CommunicationPreference = 'email' | 'whatsapp' | 'sms' | 'print';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  communicationPref?: CommunicationPreference;
  points: number;
  level: UserLevel;
  upcomingEvents: number;
  isAdmin?: boolean;
  likedEventIds?: string[];
  avatar?: string;
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
  title: string;
  date: string;
  location: string;
  category: string;
  price: number;
  image: string;
  tags: string[];
  ratings: number[];
  isHero?: boolean; // Show in main slider
}

export interface ClassItem {
  id: string;
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
  title: string;
  prize: string;
  drawDate: string;
  image: string;
  participants: string[]; // User IDs
  isActive: boolean;
  winnerId?: string; // If draw happened
  
  // Eligibility logic
  eligibilityType: LotteryEligibilityType;
  minPointsToEnter?: number;
  minLevel?: UserLevel;
  specificUserId?: string;
}

export interface PersonalityQuestion {
  question: string;
  answer: string;
}

export interface PersonalityProfile {
  id: string;
  name: string;
  role: string;
  image: string;
  questions: PersonalityQuestion[];
  isActive: boolean;
}