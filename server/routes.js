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

const isAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
};

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

// ================= 1. אישורים (APPROVALS) =================

router.get('/admin/approvals', authenticate, isAdmin, async (req, res) => {
    try {
        const pendingUsers = await User.find({ isMemberRequested: true, isMemberApproved: false });
        const pendingPosts = await ForumPost.find({ status: 'pending' }).populate('author', 'name');
        res.json({ pendingUsers, pendingPosts });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/approve-member/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { isMemberApproved: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/approve-post/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await ForumPost.findByIdAndUpdate(req.params.id, { status: 'approved' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 2. משתמשים (USERS) =================

router.get('/users', authenticate, isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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

// נתיב ההתחברות החדש שהיה חסר:
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'משתמש לא נמצא' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'סיסמה שגויה' });

        const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { ...user.toObject(), id: user._id } });
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

router.delete('/users/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 3. אירועים (EVENTS) =================

router.get('/events', async (req, res) => {
    try { res.json(await Event.find().populate('attendees', 'name avatar')); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events', authenticate, isAdmin, async (req, res) => {
    try { res.json(await new Event(req.body).save()); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/events/:id', authenticate, isAdmin, async (req, res) => {
    try { res.json(await Event.findByIdAndUpdate(req.params.id, req.body, { new: true })); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/events/:id', authenticate, isAdmin, async (req, res) => {
    try { await Event.findByIdAndDelete(req.params.id); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 4. חוגים (CLASSES) =================

router.get('/classes', async (req, res) => {
    try { res.json(await Class.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/classes', authenticate, isAdmin, async (req, res) => {
    try { res.json(await new Class(req.body).save()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/classes/:id', authenticate, isAdmin, async (req, res) => {
    try { res.json(await Class.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/classes/:id', authenticate, isAdmin, async (req, res) => {
    try { await Class.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 5. הגרלות (LOTTERIES) =================

router.get('/lotteries', async (req, res) => {
    try { res.json(await Lottery.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/lotteries', authenticate, isAdmin, async (req, res) => {
    try { res.json(await new Lottery(req.body).save()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/lotteries/:id', authenticate, isAdmin, async (req, res) => {
    try { await Lottery.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 6. קהילה (COMMUNITY) =================

router.get('/community', async (req, res) => {
    try { res.json(await Community.find().sort({ createdAt: -1 })); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/community', authenticate, isAdmin, async (req, res) => {
    try { res.json(await new Community(req.body).save()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/community/:id', authenticate, isAdmin, async (req, res) => {
    try { await Community.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 7. אשת השבוע (PERSONALITY) =================

router.get('/personality', async (req, res) => {
    try { const p = await Personality.findOne().sort({ updatedAt: -1 }); res.json(p || {}); } 
    catch (err) { res.status(500).json({ error: err.message }); }
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
        let p = await Personality.findOne() || new Personality({ name: 'ממתין' });
        p.externalToken = token;
        p.isActive = false;
        await p.save();
        const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
        res.json({ link: `${baseUrl}/#/fill-interview/${token}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 8. הגדרות (SETTINGS) =================

router.get('/admin/settings', authenticate, isAdmin, async (req, res) => {
    try { res.json(await getPointsConfig()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/settings', authenticate, isAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne() || new Settings();
        Object.assign(settings, req.body);
        await settings.save();
        res.json(settings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/users/:id/points', authenticate, isAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { $inc: { points: req.body.points } }, { new: true });
        res.json({ success: true, newPoints: user.points });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/gifts', authenticate, isAdmin, async (req, res) => {
    try {
        const { points, maxUses } = req.body;
        const code = Math.random().toString(36).substring(7).toUpperCase();
        const gift = new GiftCode({ code, points: Number(points), maxUses: maxUses || 1 });
        await gift.save();
        const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
        res.json({ success: true, link: `${baseUrl}/#/gift/${code}`, code });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- שונות (פורום ופרופיל) ---

router.get('/me', authenticate, async (req, res) => {
    try { res.json(await User.findById(req.user.id).select('-password')); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/membership/request', authenticate, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.user.id, { ...req.body, isMemberRequested: true, isMemberApproved: false }, { new: true }).select('-password');
        res.json({ success: true, user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/forum', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const post = new ForumPost({ ...req.body, author: user._id, authorName: user.name, status: 'pending' });
        await post.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;