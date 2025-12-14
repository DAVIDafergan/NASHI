import { User, EventItem, ClassItem, LotteryItem, Review, PersonalityProfile } from '../types';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

export const api = {
    // --- Auth ---
    async register(userData: any): Promise<{user: User, token: string}> {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        if (!res.ok) throw new Error('Registration failed');
        return res.json();
    },

    async login(credentials: any): Promise<{user: User, token: string}> {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        if (!res.ok) throw new Error('Login failed');
        return res.json();
    },

    // --- Events ---
    async getEvents(): Promise<EventItem[]> {
        const res = await fetch(`${API_URL}/events`);
        return res.json();
    },
    
    async createEvent(event: EventItem): Promise<EventItem> {
        const res = await fetch(`${API_URL}/events`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(event)
        });
        return res.json();
    },

    async updateEvent(event: EventItem): Promise<EventItem> {
        const res = await fetch(`${API_URL}/events/${event.id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(event)
        });
        return res.json();
    },

    async deleteEvent(id: string): Promise<void> {
        await fetch(`${API_URL}/events/${id}`, { method: 'DELETE', headers: getHeaders() });
    },

    // --- Classes ---
    async getClasses(): Promise<ClassItem[]> {
        const res = await fetch(`${API_URL}/classes`);
        return res.json();
    },

    async createClass(cls: ClassItem): Promise<ClassItem> {
        const res = await fetch(`${API_URL}/classes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(cls)
        });
        return res.json();
    },
    
    async updateClass(cls: ClassItem): Promise<ClassItem> {
        const res = await fetch(`${API_URL}/classes/${cls.id}`, { // Assuming backend endpoint exists
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(cls)
        });
        return res.json();
    },

    async deleteClass(id: string): Promise<void> {
        await fetch(`${API_URL}/classes/${id}`, { // Assuming backend endpoint exists
            method: 'DELETE', 
            headers: getHeaders() 
        });
    },

    // --- Lotteries ---
    async getLotteries(): Promise<LotteryItem[]> {
        const res = await fetch(`${API_URL}/lotteries`);
        return res.json();
    },

    async updateLottery(lottery: LotteryItem): Promise<LotteryItem> {
        const res = await fetch(`${API_URL}/lotteries/${lottery.id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(lottery)
        });
        return res.json();
    },

    async createLottery(lottery: LotteryItem): Promise<LotteryItem> {
         const res = await fetch(`${API_URL}/lotteries`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(lottery)
        });
        return res.json();
    },
    
    async deleteLottery(id: string): Promise<void> {
         await fetch(`${API_URL}/lotteries/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
    },

    // --- Users ---
    async updateUser(user: User): Promise<User> {
        const res = await fetch(`${API_URL}/users/${user.id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(user)
        });
        return res.json();
    }
};