import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { 
    User, Event, Class, Lottery, Settings, GiftCode, 
    Personality, ForumPost, Community 
} from './models.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_123';

// --- Middlewares ---

// אימות משתמש (JWT)
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
        const extracted = token.startsWith('Bearer ') ? token.slice(7) : token;
        const verified = jwt.verify(extracted, JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) { res.status(400).json({ error: 'Invalid Token' }); }
};

// בדיקת הרשאת מנהלת
const isAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
};

// פונקציית עזר לקבלת הגדרות נקודות (יוצרת הגדרות ברירת מחדל אם אין)
async function getPointsConfig() {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = new Settings({
            pointsPerRegister: 50,
            pointsPerEventJoin: 10,
            pointsPerShare: 5
        });
        await settings.save();
    }
    return settings;
}

// ================= AUTH & USER MANAGEMENT =================

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (await User.findOne({ email })) return res.status(400).json({ error: 'Email exists' });
        
        const config = await getPointsConfig();
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = new User({
            name, email, password: hashedPassword, phone,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
            points: config.pointsPerRegister || 50
        });
        
        await user.save();
        const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_SECRET);
        res.json({ token, user: { ...user.toObject(), id: user._id } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_SECRET);
        res.json({ token, user: { ...user.toObject(), id: user._id } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id', authenticate, async (req, res) => {
    try {
        if (req.user.id !== req.params.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
        res.json(updated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= MEMBERSHIP (מעגל נשי) =================

// שליחת בקשת הצטרפות
router.post('/membership/request', authenticate, async (req, res) => {
    try {
        const { age, occupation, address, phone } = req.body;
        const user = await User.findByIdAndUpdate(req.user.id, {
            age, occupation, address, phone,
            isMemberRequested: true,
            isMemberApproved: false 
        }, { new: true }).select('-password');
        res.json({ success: true, user });
    } catch (err) { res.status(500).json({ error: "שגיאה בשליחת הבקשה" }); }
});

// קבלת רשימת ממתינים (משתמשים ופוסטים) למנהלת
router.get('/admin/approvals', authenticate, isAdmin, async (req, res) => {
    try {
        const pendingUsers = await User.find({ isMemberRequested: true, isMemberApproved: false });
        const pendingPosts = await ForumPost.find({ status: 'pending' }).populate('author', 'name');
        res.json({ pendingUsers, pendingPosts });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// אישור חברה במעגל
router.put('/admin/approve-member/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { isMemberApproved: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= FORUM (פורום נשי) =================

router.get('/forum', async (req, res) => {
    try {
        const posts = await ForumPost.find({ status: 'approved' }).sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/forum', authenticate, async (req, res) => {
    try {
        const { title, content, image } = req.body;
        const user = await User.findById(req.user.id);
        const newPost = new ForumPost({
            title, content, image,
            author: user._id,
            authorName: user.name,
            status: 'pending' 
        });
        await newPost.save();
        res.json({ success: true, message: 'הפוסט נשלח לאישור המנהלת' });
    } catch (err) { res.status(500).json({ error: "שגיאה בשליחת הפוסט" }); }
});

router.put('/admin/approve-post/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await ForumPost.findByIdAndUpdate(req.params.id, { status: 'approved' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/forum/:id/comment', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const post = await ForumPost.findById(req.params.id);
        post.comments.push({ authorName: user.name, text: req.body.text });
        await post.save();
        res.json(post);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= COMMUNITY (קהילה) =================

router.get('/community', async (req, res) => {
    try {
        const items = await Community.find().sort({ createdAt: -1 });
        res.json(items);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/community', authenticate, isAdmin, async (req, res) => {
    try {
        const newItem = new Community(req.body);
        await newItem.save();
        res.json(newItem);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/community/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Community.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= PERSONALITY (אשת השבוע) =================

router.get('/personality', async (req, res) => {
    try {
        const p = await Personality.findOne().sort({ updatedAt: -1 });
        res.json(p || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/personality', authenticate, isAdmin, async (req, res) => {
    try {
        let p = await Personality.findOne();
        if (!p) p = new Personality(req.body);
        else Object.assign(p, req.body, { updatedAt: Date.now() });
        await p.save();
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/personality/generate-link', authenticate, isAdmin, async (req, res) => {
    try {
        const token = Math.random().toString(36).substring(2, 15);
        let p = await Personality.findOne();
        if (!p) p = new Personality({ name: 'ממתין למילוי' });
        p.externalToken = token;
        p.isActive = false; 
        await p.save();
        const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
        res.json({ link: `${baseUrl}/#/fill-interview/${token}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/personality/fill/:token', async (req, res) => {
    try {
        const p = await Personality.findOne({ externalToken: req.params.token });
        if (!p) return res.status(404).json({ error: 'Link invalid' });
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/personality/fill/:token', async (req, res) => {
    try {
        const { name, role, image, questions } = req.body;
        await Personality.findOneAndUpdate(
            { externalToken: req.params.token },
            { name, role, image, questions, updatedAt: Date.now(), isActive: true }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= EVENTS, CLASSES & LOTTERIES =================

router.get('/events', async (req, res) => {
    try {
        const events = await Event.find().populate('attendees', 'name avatar');
        res.json(events);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events', authenticate, isAdmin, async (req, res) => {
    try {
        const event = new Event(req.body);
        await event.save();
        res.json(event);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/events/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/events/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Event.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events/:id/join', authenticate, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (event.attendees.includes(req.user.id)) return res.status(400).json({ error: 'Already registered' });
        
        event.attendees.push(req.user.id);
        await event.save();
        
        const config = await getPointsConfig();
        const user = await User.findByIdAndUpdate(req.user.id, { $inc: { points: config.pointsPerEventJoin } }, { new: true });
        res.json({ success: true, message: `נרשמת בהצלחה! קיבלת ${config.pointsPerEventJoin} נקודות`, user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events/:id/share', authenticate, async (req, res) => {
    try {
        const config = await getPointsConfig();
        const user = await User.findByIdAndUpdate(req.user.id, { $inc: { points: config.pointsPerShare } }, { new: true });
        res.json({ success: true, user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/classes', async (req, res) => { 
    try { res.json(await Class.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/classes', authenticate, isAdmin, async (req, res) => { 
    try { res.json(await new Class(req.body).save()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/lotteries', async (req, res) => { 
    try { res.json(await Lottery.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/lotteries', authenticate, isAdmin, async (req, res) => { 
    try { res.json(await new Lottery(req.body).save()); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= ADMIN SETTINGS & GIFTS =================

router.get('/admin/settings', authenticate, isAdmin, async (req, res) => {
    try { res.json(await getPointsConfig()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/settings', authenticate, isAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings();
        Object.assign(settings, req.body);
        await settings.save();
        res.json(settings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/users/:id/points', authenticate, isAdmin, async (req, res) => {
    try {
        const { points } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, { $inc: { points: points } }, { new: true });
        res.json({ success: true, newPoints: user.points });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;