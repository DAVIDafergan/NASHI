import { User, EventItem, ClassItem, LotteryItem, Review, PersonalityProfile, ForumPost, CommunityItem } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://nashi-production.up.railway.app/api';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

const safeFetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    try {
        return await fetch(input, init);
    } catch (err) {
        throw new Error('אין חיבור לשרת. בדוק את החיבור לאינטרנט ונסה שוב.');
    }
};

const validateImageSize = (data: any) => {
    if (data && (data.image || data.content || data.audio) && typeof (data.image || data.content || data.audio) === 'string' && (data.image || data.content || data.audio).startsWith('data:')) {
        const imgStr = data.image || data.content || data.audio;
        const stringLength = imgStr.length - imgStr.indexOf(',') - 1;
        const sizeInBytes = (stringLength * 3) / 4;
        if (sizeInBytes > 5000 * 1024) { 
            throw new Error('הקובץ גדול מדי! המקסימום המותר הוא 5MB.');
        }
    }
};

export const api = {
    // ================= AUTH & USER =================
    async register(userData: any): Promise<{user: User, token: string}> {
        const res = await safeFetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        if (!res.ok) throw new Error('Registration failed');
        return res.json();
    },

    async login(credentials: any): Promise<{user: User, token: string}> {
        const res = await safeFetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        if (!res.ok) throw new Error('Login failed');
        return res.json();
    },

   async getMe(): Promise<User> {
        const res = await safeFetch(`${API_URL}/me`, { headers: getHeaders() });
        
        // התוספת שלנו - אם השרת מחזיר שגיאה (כמו 400 Bad Request),
        // הפונקציה תעצור כאן ולא תנסה לקרוא את השגיאה כאילו היא משתמש אמיתי.
        if (!res.ok) {
            throw new Error('Token is invalid');
        }
        
        return res.json();
    },
    async getUsers(): Promise<User[]> {
        const res = await safeFetch(`${API_URL}/users`, { headers: getHeaders() });
        return res.json();
    },

    async updateUser(user: User): Promise<User> {
        const res = await safeFetch(`${API_URL}/users/${user.id || user._id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(user)
        });
        return res.json();
    },

    async deleteUser(userId: string): Promise<void> {
        await safeFetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
    },

    // ================= MEMBERSHIP & APPROVALS =================
    async requestMembership(data: { age: number, occupation: string, address: string, phone: string }) {
        const res = await safeFetch(`${API_URL}/membership/request`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async approveMember(userId: string) {
        const res = await safeFetch(`${API_URL}/admin/approve-member/${userId}`, {
            method: 'PUT',
            headers: getHeaders()
        });
        return res.json();
    },

    async getAdminApprovals() {
        const res = await safeFetch(`${API_URL}/admin/approvals`, { headers: getHeaders() });
        return res.json();
    },

    // ================= EVENTS =================
    async getEvents(): Promise<EventItem[]> {
        const res = await safeFetch(`${API_URL}/events`);
        return res.json();
    },
    
    async createEvent(event: Partial<EventItem>): Promise<EventItem> {
        validateImageSize(event);
        const res = await safeFetch(`${API_URL}/events`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(event)
        });
        return res.json();
    },

    async updateEvent(id: string, event: Partial<EventItem>): Promise<EventItem> {
        validateImageSize(event);
        const res = await safeFetch(`${API_URL}/events/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(event)
        });
        return res.json();
    },

    async deleteEvent(id: string): Promise<void> {
        await safeFetch(`${API_URL}/events/${id}`, { method: 'DELETE', headers: getHeaders() });
    },

    async joinEvent(eventId: string) {
        const res = await safeFetch(`${API_URL}/events/${eventId}/join`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    async shareEvent(eventId: string) {
        return safeFetch(`${API_URL}/events/${eventId}/share`, {
            method: 'POST',
            headers: getHeaders()
        }).then(r => r.json());
    },

    // ================= CLASSES =================
    async getClasses(): Promise<ClassItem[]> {
        const res = await safeFetch(`${API_URL}/classes`);
        return res.json();
    },

    async createClass(cls: Partial<ClassItem>): Promise<ClassItem> {
        validateImageSize(cls);
        const res = await safeFetch(`${API_URL}/classes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(cls)
        });
        return res.json();
    },
    
    async updateClass(id: string, cls: Partial<ClassItem>): Promise<ClassItem> {
        validateImageSize(cls);
        const res = await safeFetch(`${API_URL}/classes/${id}`, { 
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(cls)
        });
        return res.json();
    },

    async deleteClass(id: string): Promise<void> {
        await safeFetch(`${API_URL}/classes/${id}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        });
    },

    // ================= LOTTERIES =================
    async getLotteries(): Promise<LotteryItem[]> {
        const res = await safeFetch(`${API_URL}/lotteries`);
        return res.json();
    },

    async createLottery(lottery: Partial<LotteryItem>): Promise<LotteryItem> {
         validateImageSize(lottery);
         const res = await safeFetch(`${API_URL}/lotteries`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(lottery)
        });
        return res.json();
    },

    async updateLottery(id: string, lottery: Partial<LotteryItem>): Promise<LotteryItem> {
         validateImageSize(lottery);
         const res = await safeFetch(`${API_URL}/lotteries/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(lottery)
        });
        return res.json();
    },

    async runLotteryLive(id: string) {
        const res = await safeFetch(`${API_URL}/admin/lotteries/${id}/run`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    async deleteLottery(id: string): Promise<void> {
         await safeFetch(`${API_URL}/lotteries/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
    },

    async getLotteryParticipants(id: string): Promise<any[]> {
        const res = await safeFetch(`${API_URL}/admin/lotteries/${id}/participants`, { headers: getHeaders() });
        return res.json();
    },

    async completeLotteryMission(lotteryId: string) {
        const res = await safeFetch(`${API_URL}/lotteries/${lotteryId}/complete-mission`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    // ================= FORUM =================
    async getForumPosts(): Promise<ForumPost[]> {
        const res = await safeFetch(`${API_URL}/forum`, { headers: getHeaders() });
        return res.json();
    },

    async createForumPost(post: { title: string, content: string, image?: string }) {
        validateImageSize(post);
        const res = await safeFetch(`${API_URL}/forum`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(post)
        });
        return res.json();
    },

    async approvePost(postId: string) {
        const res = await safeFetch(`${API_URL}/admin/approve-post/${postId}`, {
            method: 'PUT',
            headers: getHeaders()
        });
        return res.json();
    },

    async deletePost(postId: string): Promise<void> {
        await safeFetch(`${API_URL}/forum/${postId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
    },

    async likePost(postId: string) {
        const res = await safeFetch(`${API_URL}/forum/${postId}/like`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    async addComment(postId: string, text: string) {
        const res = await safeFetch(`${API_URL}/forum/${postId}/comment`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ text })
        });
        return res.json();
    },

    // ================= COMMUNITY =================
    async getCommunityItems(): Promise<CommunityItem[]> {
        const res = await safeFetch(`${API_URL}/community`);
        return res.json();
    },

    async createCommunityItem(item: Partial<CommunityItem>) {
        validateImageSize(item);
        const res = await safeFetch(`${API_URL}/community`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(item)
        });
        return res.json();
    },

    async updateCommunityItem(id: string, item: Partial<CommunityItem>) {
        validateImageSize(item);
        const res = await safeFetch(`${API_URL}/community/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(item)
        });
        return res.json();
    },

    async deleteCommunityItem(id: string) {
        return safeFetch(`${API_URL}/community/${id}`, { method: 'DELETE', headers: getHeaders() });
    },

    // ================= PERSONALITY =================
    async getPersonality() {
        const res = await safeFetch(`${API_URL}/personality`);
        const data = await res.json();
        return (data && data.questions) ? data : { ...data, questions: [] };
    },

    async getAllPersonalities(): Promise<PersonalityProfile[]> {
        const res = await safeFetch(`${API_URL}/personality/archive`);
        return res.json();
    },

    async updatePersonality(data: Partial<PersonalityProfile>) {
        validateImageSize(data);
        const res = await safeFetch(`${API_URL}/personality`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getPersonalityTemplate() {
        const res = await safeFetch(`${API_URL}/personality/template`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch template');
        return res.json();
    },

    async updatePersonalityTemplate(data: any) {
        validateImageSize(data);
        const res = await safeFetch(`${API_URL}/personality/template`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update template');
        return res.json();
    },

    async generateInterviewLink(data: any) {
        const res = await safeFetch(`${API_URL}/personality/generate-link`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getInterviewByToken(token: string) {
        const res = await safeFetch(`${API_URL}/personality/fill/${token}`);
        return res.json();
    },

    async submitInterview(token: string, data: Partial<PersonalityProfile>) {
        validateImageSize(data);
        const res = await safeFetch(`${API_URL}/personality/fill/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getPendingInterviews(): Promise<PersonalityProfile[]> {
        const res = await safeFetch(`${API_URL}/admin/personality/pending`, { headers: getHeaders() });
        return res.json();
    },

    async approvePersonality(interviewId: string) {
        const res = await safeFetch(`${API_URL}/admin/personality/approve/${interviewId}`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    async deletePersonality(id: string) {
        return safeFetch(`${API_URL}/personality/${id}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        }).then(res => res.json());
    },

    // ================= INSPIRATIONS & ADS =================
    async getInspirations() {
        const res = await safeFetch(`${API_URL}/inspirations`);
        return res.json();
    },

    async createInspiration(data: any) {
        const res = await safeFetch(`${API_URL}/inspirations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async updateInspiration(id: string, data: any) {
        const res = await safeFetch(`${API_URL}/inspirations/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async deleteInspiration(id: string) {
        return safeFetch(`${API_URL}/inspirations/${id}`, { method: 'DELETE', headers: getHeaders() }).then(r => r.json());
    },

    async getAds() {
        const res = await safeFetch(`${API_URL}/ads`);
        return res.json();
    },

    async createAd(data: any) {
        validateImageSize(data);
        const res = await safeFetch(`${API_URL}/ads`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async updateAd(id: string, data: any) {
        validateImageSize(data);
        const res = await safeFetch(`${API_URL}/ads/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async deleteAd(id: string) {
        return safeFetch(`${API_URL}/ads/${id}`, { method: 'DELETE', headers: getHeaders() }).then(r => r.json());
    },

    // ================= ANNOUNCEMENTS =================
    async getAnnouncements(): Promise<any[]> {
        const res = await safeFetch(`${API_URL}/announcements`, { headers: getHeaders() });
        return res.json();
    },

    async createAnnouncement(data: any) {
        const res = await safeFetch(`${API_URL}/announcements`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async updateAnnouncement(id: string, data: any) {
        const res = await safeFetch(`${API_URL}/announcements/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async deleteAnnouncement(id: string) {
        return safeFetch(`${API_URL}/announcements/${id}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        }).then(r => r.json());
    },

    // ================= ADMIN SETTINGS & POINTS =================
    async getSettings() {
        return safeFetch(`${API_URL}/admin/settings`, { headers: getHeaders() }).then(r => r.json());
    },

    async updateSettings(settings: any) {
        return safeFetch(`${API_URL}/admin/settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        }).then(r => r.json());
    },

    async sendPointsToUser(userId: string, points: number) {
        return safeFetch(`${API_URL}/admin/users/${userId}/points`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ points })
        }).then(r => r.json());
    },

    async createGiftCode(giftData: any) {
        return safeFetch(`${API_URL}/admin/gifts`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(giftData)
        }).then(r => r.json());
    },

    // ================= SHABBAT LOTTERY =================
    async getShabbatLotterySettings() {
        const res = await safeFetch(`${API_URL}/shabbat-lottery/settings`);
        return res.json();
    },

    async updateShabbatLotterySettings(settings: any) {
        const res = await safeFetch(`${API_URL}/admin/shabbat-lottery/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        return res.json();
    },

    async enterShabbatLottery(entryData: { familyName: string; image: string; phone: string }) {
        validateImageSize(entryData);
        const res = await safeFetch(`${API_URL}/shabbat-lottery/enter`, {
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
        const res = await safeFetch(`${API_URL}/admin/shabbat-lottery/entries`, { headers: getHeaders() });
        return res.json();
    },

    async runShabbatLottery() {
        const res = await safeFetch(`${API_URL}/admin/shabbat-lottery/run`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to run lottery');
        }
        return res.json();
    },

    // ================= CONTACT MESSAGES =================
    async submitContactMessage(data: any) {
        validateImageSize(data);
        const res = await safeFetch(`${API_URL}/contact`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getContactMessages() {
        const res = await safeFetch(`${API_URL}/admin/messages`, { headers: getHeaders() });
        return res.json();
    },

    async deleteContactMessage(id: string) {
        return safeFetch(`${API_URL}/admin/messages/${id}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        }).then(r => r.json());
    },

    async markMessageAsRead(id: string) {
        return safeFetch(`${API_URL}/admin/messages/${id}/read`, { 
            method: 'PUT', 
            headers: getHeaders() 
        }).then(r => r.json());
    },

    // ================= TICKETS & QR CODES =================
    async getTickets() {
        return safeFetch(`${API_URL}/admin/tickets`, { headers: getHeaders() }).then(r => r.json());
    },

    async createTicket(ticketData: { eventId: string, code: string, image: string }) {
        validateImageSize(ticketData);
        const res = await safeFetch(`${API_URL}/admin/tickets`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(ticketData)
        });
        return res.json();
    },

    async deleteTicket(id: string) {
        return safeFetch(`${API_URL}/admin/tickets/${id}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        }).then(r => r.json());
    },

    async verifyTicket(code: string) {
        const res = await safeFetch(`${API_URL}/admin/tickets/verify/${code}`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'שגיאה באימות כרטיס');
        return data;
    },

    // ================= STORIES (חדש!) =================
    async getStories(): Promise<any[]> {
        const res = await safeFetch(`${API_URL}/stories`);
        return res.json();
    },

    async uploadStory(data: { type: string, content: string }): Promise<any> {
        validateImageSize(data);
        const res = await safeFetch(`${API_URL}/stories`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getPendingStories(): Promise<any[]> {
        const res = await safeFetch(`${API_URL}/admin/stories`, { headers: getHeaders() });
        return res.json();
    },

    async approveStory(id: string): Promise<any> {
        const res = await safeFetch(`${API_URL}/admin/stories/${id}/approve`, {
            method: 'PUT',
            headers: getHeaders()
        });
        return res.json();
    },

    async deleteStory(id: string): Promise<any> {
        const res = await safeFetch(`${API_URL}/admin/stories/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return res.json();
    },

    async deleteMyStory(id: string): Promise<any> {
        const res = await safeFetch(`${API_URL}/stories/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return res.json();
    }
};