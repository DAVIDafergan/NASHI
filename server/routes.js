const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Event, Class, Lottery, Settings, GiftCode } = require('./models');

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

// --- Helper: קבלת הגדרות הניקוד הנוכחיות ---
async function getPointsConfig() {
    let settings = await Settings.findOne();
    if (!settings) {
        // אם אין הגדרות, ניצור ברירת מחדל
        settings = await new Settings().save();
    }
    return settings;
}

// ================= AUTH =================

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (await User.findOne({ email })) return res.status(400).json({ error: 'Email exists' });

        // שליפת הניקוד להרשמה מההגדרות
        const config = await getPointsConfig();
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name, email, password: hashedPassword, phone,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
            points: config.pointsPerRegister // שימוש בהגדרה דינמית
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
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
});

// ================= ADMIN SETTINGS & POINTS =================

// 1. קבלת הגדרות הניקוד הנוכחיות (למנהל)
router.get('/admin/settings', authenticate, isAdmin, async (req, res) => {
    const settings = await getPointsConfig();
    res.json(settings);
});

// 2. עדכון הגדרות הניקוד (למנהל)
router.put('/admin/settings', authenticate, isAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings();
        
        // עדכון השדות
        settings.pointsPerRegister = req.body.pointsPerRegister || settings.pointsPerRegister;
        settings.pointsPerEventJoin = req.body.pointsPerEventJoin || settings.pointsPerEventJoin;
        settings.pointsPerShare = req.body.pointsPerShare || settings.pointsPerShare;
        
        await settings.save();
        res.json(settings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. שליחת נקודות למשתמש ספציפי באופן ידני
router.post('/admin/users/:id/points', authenticate, isAdmin, async (req, res) => {
    try {
        const { points, reason } = req.body; // מצפים לקבל כמות נקודות
        const user = await User.findByIdAndUpdate(req.params.id, { $inc: { points: points } }, { new: true });
        res.json({ success: true, newPoints: user.points, message: `הוספו ${points} נקודות למשתמש` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. יצירת קוד מתנה (Gift Link)
router.post('/admin/gifts', authenticate, isAdmin, async (req, res) => {
    try {
        const { code, points, maxUses } = req.body;
        // קוד ברירת מחדל אם לא נשלח
        const finalCode = code || Math.random().toString(36).substring(7).toUpperCase();
        
        const gift = new GiftCode({ 
            code: finalCode, 
            points: Number(points), 
            maxUses: maxUses || 1000 
        });
        await gift.save();
        
        // החזרת הלינק המלא לשיתוף
        res.json({ 
            success: true, 
            link: `${req.protocol}://${req.get('host')}/gift/${finalCode}`,
            code: finalCode,
            points 
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= USER ACTIONS (With Dynamic Points) =================

// מימוש קוד מתנה (המשתמש לוחץ על הלינק)
router.post('/gifts/redeem', authenticate, async (req, res) => {
    try {
        const { code } = req.body;
        const gift = await GiftCode.findOne({ code });

        if (!gift) return res.status(404).json({ error: 'קוד לא תקין' });
        if (gift.usedBy.includes(req.user.id)) return res.status(400).json({ error: 'כבר השתמשת בקוד זה' });
        if (gift.usedBy.length >= gift.maxUses) return res.status(400).json({ error: 'הקוד הגיע למכסת המימושים' });

        // הוספת המשתמש לרשימת המממשים
        gift.usedBy.push(req.user.id);
        await gift.save();

        // הוספת הנקודות למשתמש
        const user = await User.findByIdAndUpdate(req.user.id, { $inc: { points: gift.points } }, { new: true });
        
        res.json({ success: true, pointsAdded: gift.points, totalPoints: user.points, message: 'המתנה התקבלה בהצלחה!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// הרשמה לאירוע (עם ניקוד דינמי)
router.post('/events/:id/join', authenticate, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (event.attendees.includes(req.user.id)) return res.status(400).json({ error: 'Already registered' });

        event.attendees.push(req.user.id);
        await event.save();

        // שליפת ערך הניקוד מההגדרות
        const config = await getPointsConfig();
        const user = await User.findByIdAndUpdate(req.user.id, { $inc: { points: config.pointsPerEventJoin } }, { new: true });

        res.json({ success: true, points: user.points, message: `נרשמת בהצלחה! קיבלת ${config.pointsPerEventJoin} נקודות` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// שיתוף אירוע (עם ניקוד דינמי)
router.post('/events/:id/share', authenticate, async (req, res) => {
    try {
        const config = await getPointsConfig();
        const user = await User.findByIdAndUpdate(req.user.id, { $inc: { points: config.pointsPerShare } }, { new: true });
        res.json({ success: true, points: user.points, message: `תודה על השיתוף! קיבלת ${config.pointsPerShare} נקודות` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- שאר הראוטרים הרגילים (אירועים, משתמשים וכו') ---

router.get('/users', authenticate, isAdmin, async (req, res) => {
    const users = await User.find().select('-password');
    res.json(users);
});

router.get('/events', async (req, res) => {
    const events = await Event.find().populate('attendees', 'name avatar email');
    res.json(events);
});

router.post('/events', authenticate, isAdmin, async (req, res) => {
    const event = new Event(req.body);
    await event.save();
    res.json(event);
});

router.delete('/events/:id', authenticate, isAdmin, async (req, res) => {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

router.get('/classes', async (req, res) => { res.json(await Class.find()); });
router.post('/classes', authenticate, isAdmin, async (req, res) => { res.json(await new Class(req.body).save()); });
router.delete('/classes/:id', authenticate, isAdmin, async (req, res) => { await Class.findByIdAndDelete(req.params.id); res.json({ success: true }); });

router.get('/lotteries', async (req, res) => { res.json(await Lottery.find()); });
router.post('/lotteries', authenticate, isAdmin, async (req, res) => { res.json(await new Lottery(req.body).save()); });
router.delete('/lotteries/:id', authenticate, isAdmin, async (req, res) => { await Lottery.findByIdAndDelete(req.params.id); res.json({ success: true }); });

router.get('/make-admin/:email', async (req, res) => {
    const user = await User.findOneAndUpdate({ email: req.params.email }, { isAdmin: true }, { new: true });
    res.send(user ? `User ${user.email} is Admin` : 'Not found');
});

module.exports = router;