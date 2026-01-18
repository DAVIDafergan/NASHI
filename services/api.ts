import { User, EventItem, ClassItem, LotteryItem, Review, PersonalityProfile, ForumPost, CommunityItem } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://nashi-production.up.railway.app/api';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

// פונקציית עזר לבדיקת נפח תמונה לפני שליחה לשרת (מעודכן ל-5MB כדי לאפשר באנרים ופרסומים)
const validateImageSize = (data: any) => {
    if (data && (data.image || data.content) && typeof (data.image || data.content) === 'string' && (data.image || data.content).startsWith('data:image')) {
        const imgStr = data.image || data.content;
        const stringLength = imgStr.length - imgStr.indexOf(',') - 1;
        const sizeInBytes = (stringLength * 3) / 4;
        if (sizeInBytes > 5000 * 1024) { // הגדלנו מ-50 ל-5000 כדי שהמערכת תעבוד
            throw new Error('התמונה גדולה מדי! המקסימום המותר הוא 5MB.');
        }
    }
};

export const api = {
    // ================= AUTH & USER =================
    async register(userData: any): Promise<{user: User, token: string}> {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        if (!res.ok) throw new Error('Registration failed');
        return res.json();
    },

    async login(credentials: any): Promise<{user: User, token: string}> {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        if (!res.ok) throw new Error('Login failed');
        return res.json();
    },

    async getMe(): Promise<User> {
        const res = await fetch(`${API_URL}/me`, { headers: getHeaders() });
        return res.json();
    },

    async getUsers(): Promise<User[]> {
        const res = await fetch(`${API_URL}/users`, { headers: getHeaders() });
        return res.json();
    },

    async updateUser(user: User): Promise<User> {
        const res = await fetch(`${API_URL}/users/${user.id || user._id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(user)
        });
        return res.json();
    },

    async deleteUser(userId: string): Promise<void> {
        await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
    },

    // ================= MEMBERSHIP (מעגל נשי) & APPROVALS =================
    async requestMembership(data: { age: number, occupation: string, address: string, phone: string }) {
        const res = await fetch(`${API_URL}/membership/request`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async approveMember(userId: string) {
        const res = await fetch(`${API_URL}/admin/approve-member/${userId}`, {
            method: 'PUT',
            headers: getHeaders()
        });
        return res.json();
    },

    async getAdminApprovals() {
        const res = await fetch(`${API_URL}/admin/approvals`, { headers: getHeaders() });
        return res.json();
    },

    // ================= EVENTS (אירועים) =================
    async getEvents(): Promise<EventItem[]> {
        const res = await fetch(`${API_URL}/events`);
        return res.json();
    },
    
    async createEvent(event: Partial<EventItem>): Promise<EventItem> {
        validateImageSize(event);
        const res = await fetch(`${API_URL}/events`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(event)
        });
        return res.json();
    },

    async updateEvent(id: string, event: Partial<EventItem>): Promise<EventItem> {
        validateImageSize(event);
        const res = await fetch(`${API_URL}/events/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(event)
        });
        return res.json();
    },

    async deleteEvent(id: string): Promise<void> {
        await fetch(`${API_URL}/events/${id}`, { method: 'DELETE', headers: getHeaders() });
    },

    async joinEvent(eventId: string) {
        const res = await fetch(`${API_URL}/events/${eventId}/join`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    async shareEvent(eventId: string) {
        return fetch(`${API_URL}/events/${eventId}/share`, {
            method: 'POST',
            headers: getHeaders()
        }).then(r => r.json());
    },

    // ================= CLASSES (חוגים) =================
    async getClasses(): Promise<ClassItem[]> {
        const res = await fetch(`${API_URL}/classes`);
        return res.json();
    },

    async createClass(cls: Partial<ClassItem>): Promise<ClassItem> {
        validateImageSize(cls);
        const res = await fetch(`${API_URL}/classes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(cls)
        });
        return res.json();
    },
    
    async updateClass(id: string, cls: Partial<ClassItem>): Promise<ClassItem> {
        validateImageSize(cls);
        const res = await fetch(`${API_URL}/classes/${id}`, { 
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(cls)
        });
        return res.json();
    },

    async deleteClass(id: string): Promise<void> {
        await fetch(`${API_URL}/classes/${id}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        });
    },

    // ================= LOTTERIES (הגרלות) =================
    async getLotteries(): Promise<LotteryItem[]> {
        const res = await fetch(`${API_URL}/lotteries`);
        return res.json();
    },

    async createLottery(lottery: Partial<LotteryItem>): Promise<LotteryItem> {
         validateImageSize(lottery);
         const res = await fetch(`${API_URL}/lotteries`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(lottery)
        });
        return res.json();
    },

    async updateLottery(id: string, lottery: Partial<LotteryItem>): Promise<LotteryItem> {
         validateImageSize(lottery);
         const res = await fetch(`${API_URL}/lotteries/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(lottery)
        });
        return res.json();
    },

    async runLotteryLive(id: string) {
        const res = await fetch(`${API_URL}/admin/lotteries/${id}/run`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    async deleteLottery(id: string): Promise<void> {
         await fetch(`${API_URL}/lotteries/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
    },

    async getLotteryParticipants(id: string): Promise<any[]> {
        const res = await fetch(`${API_URL}/admin/lotteries/${id}/participants`, { headers: getHeaders() });
        return res.json();
    },

    async completeLotteryMission(lotteryId: string) {
        const res = await fetch(`${API_URL}/lotteries/${lotteryId}/complete-mission`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    // ================= FORUM (פורום נשי) =================
    async getForumPosts(): Promise<ForumPost[]> {
        const res = await fetch(`${API_URL}/forum`, { headers: getHeaders() });
        return res.json();
    },

    async createForumPost(post: { title: string, content: string, image?: string }) {
        validateImageSize(post);
        const res = await fetch(`${API_URL}/forum`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(post)
        });
        return res.json();
    },

    async approvePost(postId: string) {
        const res = await fetch(`${API_URL}/admin/approve-post/${postId}`, {
            method: 'PUT',
            headers: getHeaders()
        });
        return res.json();
    },

    async deletePost(postId: string): Promise<void> {
        await fetch(`${API_URL}/forum/${postId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
    },

    async likePost(postId: string) {
        const res = await fetch(`${API_URL}/forum/${postId}/like`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    async addComment(postId: string, text: string) {
        const res = await fetch(`${API_URL}/forum/${postId}/comment`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ text })
        });
        return res.json();
    },

    // ================= COMMUNITY (קהילה) =================
    async getCommunityItems(): Promise<CommunityItem[]> {
        const res = await fetch(`${API_URL}/community`);
        return res.json();
    },

    async createCommunityItem(item: Partial<CommunityItem>) {
        validateImageSize(item);
        const res = await fetch(`${API_URL}/community`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(item)
        });
        return res.json();
    },

    async updateCommunityItem(id: string, item: Partial<CommunityItem>) {
        validateImageSize(item);
        const res = await fetch(`${API_URL}/community/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(item)
        });
        return res.json();
    },

    async deleteCommunityItem(id: string) {
        return fetch(`${API_URL}/community/${id}`, { method: 'DELETE', headers: getHeaders() });
    },

    // ================= PERSONALITY (אשת השבוע) =================
    async getPersonality() {
        const res = await fetch(`${API_URL}/personality`);
        const data = await res.json();
        // תיקון: הגנה כדי לוודא שתמיד חוזר מבנה תקין של שאלות
        return (data && data.questions) ? data : { ...data, questions: [] };
    },

    async getAllPersonalities(): Promise<PersonalityProfile[]> {
        const res = await fetch(`${API_URL}/personality/archive`);
        return res.json();
    },

    async updatePersonality(data: Partial<PersonalityProfile>) {
        validateImageSize(data);
        const res = await fetch(`${API_URL}/personality`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async generateInterviewLink(data: any) {
        const res = await fetch(`${API_URL}/personality/generate-link`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getInterviewByToken(token: string) {
        const res = await fetch(`${API_URL}/personality/fill/${token}`);
        return res.json();
    },

    async submitInterview(token: string, data: Partial<PersonalityProfile>) {
        validateImageSize(data);
        const res = await fetch(`${API_URL}/personality/fill/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getPendingInterviews(): Promise<PersonalityProfile[]> {
        const res = await fetch(`${API_URL}/admin/personality/pending`, { headers: getHeaders() });
        return res.json();
    },

    async approvePersonality(interviewId: string) {
        const res = await fetch(`${API_URL}/admin/personality/approve/${interviewId}`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    async deletePersonality(id: string) {
        return fetch(`${API_URL}/personality/${id}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        }).then(res => res.json());
    },

    // ================= INSPIRATIONS (השראה יומית) =================
    async getInspirations() {
        const res = await fetch(`${API_URL}/inspirations`);
        return res.json();
    },

    async createInspiration(data: any) {
        const res = await fetch(`${API_URL}/inspirations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async updateInspiration(id: string, data: any) {
        const res = await fetch(`${API_URL}/inspirations/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async deleteInspiration(id: string) {
        return fetch(`${API_URL}/inspirations/${id}`, { method: 'DELETE', headers: getHeaders() }).then(r => r.json());
    },

    // ================= ADS (פרסומים) =================
    async getAds() {
        const res = await fetch(`${API_URL}/ads`);
        return res.json();
    },

    async createAd(data: any) {
        validateImageSize(data);
        const res = await fetch(`${API_URL}/ads`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async updateAd(id: string, data: any) {
        validateImageSize(data);
        const res = await fetch(`${API_URL}/ads/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async deleteAd(id: string) {
        return fetch(`${API_URL}/ads/${id}`, { method: 'DELETE', headers: getHeaders() }).then(r => r.json());
    },

    // ================= ANNOUNCEMENTS (הודעות הנהלה) =================
    async getAnnouncements(): Promise<any[]> {
        const res = await fetch(`${API_URL}/announcements`, { headers: getHeaders() });
        return res.json();
    },

    async createAnnouncement(data: any) {
        const res = await fetch(`${API_URL}/announcements`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async updateAnnouncement(id: string, data: any) {
        const res = await fetch(`${API_URL}/announcements/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async deleteAnnouncement(id: string) {
        return fetch(`${API_URL}/announcements/${id}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        }).then(r => r.json());
    },

    // ================= ADMIN SETTINGS & POINTS =================
    async getSettings() {
        return fetch(`${API_URL}/admin/settings`, { headers: getHeaders() }).then(r => r.json());
    },

    async updateSettings(settings: any) {
        return fetch(`${API_URL}/admin/settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        }).then(r => r.json());
    },

    async sendPointsToUser(userId: string, points: number) {
        return fetch(`${API_URL}/admin/users/${userId}/points`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ points })
        }).then(r => r.json());
    },

    async createGiftCode(giftData: any) {
        return fetch(`${API_URL}/admin/gifts`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(giftData)
        }).then(r => r.json());
    },

    // ================= SHABBAT LOTTERY (שולחן שבת) =================
    async getShabbatLotterySettings() {
        const res = await fetch(`${API_URL}/shabbat-lottery/settings`);
        return res.json();
    },

    async updateShabbatLotterySettings(settings: any) {
        const res = await fetch(`${API_URL}/admin/shabbat-lottery/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        return res.json();
    },

    async enterShabbatLottery(entryData: { familyName: string; image: string; phone: string }) {
        validateImageSize(entryData);
        const res = await fetch(`${API_URL}/shabbat-lottery/enter`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(entryData)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to enter lottery');
        }
        return res.json();
    },

    async getShabbatEntries() {
        const res = await fetch(`${API_URL}/admin/shabbat-lottery/entries`, { headers: getHeaders() });
        return res.json();
    },

    async runShabbatLottery() {
        const res = await fetch(`${API_URL}/admin/shabbat-lottery/run`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to run lottery');
        }
        return res.json();
    }
};