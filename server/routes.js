import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // תוספת עבור ייצור טוקנים מאובטחים
import { 
    User, Event, Class, Lottery, Settings, GiftCode, 
    Announcement, // הוספת המודל החדש לייבוא
    Personality, ForumPost, Community, Inspiration, Ad,
    Challenge, ChallengeEntry, // הוספת המודלים של האתגרים לייבוא במקום שבת
    ContactMessage, // הוספת מודל פניות הציבור לייבוא
    Ticket, // התווסף מודל הכרטיסים!
    Story, // <--- תוספת: מודל הסטוריז
    ZodiacWheelPrize, ZodiacWheelSpin
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

const getZodiacWheelCycleStart = (currentDate = new Date()) => {
    const cycleStart = new Date(currentDate);
    cycleStart.setHours(8, 0, 0, 0);
    if (currentDate < cycleStart) {
        cycleStart.setDate(cycleStart.getDate() - 1);
    }
    return cycleStart;
};

const getNextZodiacWheelCycleStart = (currentDate = new Date()) => {
    const cycleStart = getZodiacWheelCycleStart(currentDate);
    cycleStart.setDate(cycleStart.getDate() + 1);
    return cycleStart;
};

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
            // אוואטרים חמודים לנשים - מודל lorelei עם פילטרים לחיוך, הבעות מתוקות וצבעי רקע נעימים
            avatar: `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(name)}&backgroundColor=ffd5dc,ffdfbf,c0aede,d1d4f9,ffc0cb&mouth=smile,happy,cute&eyes=happy,open,wink`,
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
        if (!user) return res.status(400).json({ error: 'משתמש לא נמצא' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'סיסמה שגויה' });

        const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { ...user.toObject(), id: user._id } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- שחזור ואיפוס סיסמה ---

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: 'המייל לא נמצא במערכת' });

        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // שעה אחת
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL || req.protocol + '://' + req.get('host')}/#/reset-password/${token}`;

        await req.resend.emails.send({
            from: 'נשי <updates@nashi-co.com>',
            to: [email],
            subject: 'איפוס סיסמה - אתר נשי',
            html: `<h3>שלום לך,</h3><p>לחצי על הכפתור כדי לאפס את הסיסמה שלך. הלינק בתוקף לשעה אחת.</p>
                   <a href="${resetUrl}" style="background:#fb7185; color:white; padding:10px 20px; text-decoration:none; border-radius:5px; display:inline-block;">איפוס סיסמה</a>`
        });

        res.json({ success: true, message: 'מייל איפוס נשלח' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/reset-password/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ error: 'הלינק לא תקף או שפג תוקפו' });

        user.password = await bcrypt.hash(req.body.password, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'הסיסמה עודכנה בהצלחה' });
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
    try {
        const data = { ...req.body };
        if (data._id === '') delete data._id;
        res.json(await new Event(data).save());
    } 
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
    try {
        const data = { ...req.body };
        if (data._id === '') delete data._id;
        res.json(await new Class(data).save());
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    try {
        const data = { ...req.body };
        if (data._id === '') delete data._id;
        // הקוד כאן שומר את כל ה-body, כולל prizes (המערך) ו-prize2-7
        res.json(await new Lottery(data).save());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/lotteries/:id', authenticate, isAdmin, async (req, res) => {
    try { 
        // הקוד כאן מעדכן את כל ה-body, כולל prizes (המערך) ו-prize2-7
        res.json(await Lottery.findByIdAndUpdate(req.params.id, req.body, { new: true })); 
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/lotteries/:id/run', authenticate, isAdmin, async (req, res) => {
    try {
        const lottery = await Lottery.findById(req.params.id);
        if (!lottery) return res.status(404).json({ error: 'Lottery not found' });
        
        if (lottery.participants.length > 0) {
            const randomIndex = Math.floor(Math.random() * lottery.participants.length);
            lottery.winnerId = lottery.participants[randomIndex];
            lottery.isActive = false;
            await lottery.save();
        }
        res.json({ success: true, winnerId: lottery.winnerId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/lotteries/:id', authenticate, isAdmin, async (req, res) => {
    try { await Lottery.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/lotteries/:id/participants', authenticate, isAdmin, async (req, res) => {
    try {
        const lottery = await Lottery.findById(req.params.id).populate('participants', 'name phone email');
        if (!lottery) return res.status(404).json({ error: 'Lottery not found' });
        res.json(lottery.participants);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/lotteries/:id/complete-mission', authenticate, async (req, res) => {
    try {
        const lottery = await Lottery.findById(req.params.id);
        if (!lottery) return res.status(404).json({ error: 'Lottery not found' });
        if (lottery.participants.includes(req.user.id)) return res.status(400).json({ error: 'כבר נרשמת להגרלה זו' });
        
        lottery.participants.push(req.user.id);
        await lottery.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 5.1 גלגל המזלות (ZODIAC WHEEL) =================

router.get('/zodiac-wheel/prizes', async (req, res) => {
    try {
        const prizes = await ZodiacWheelPrize
            .find({ isActive: true })
            .sort({ createdAt: 1 });
        res.json(prizes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/zodiac-wheel/status', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('lastZodiacWheelSpinAt');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const now = new Date();
        const cycleStart = getZodiacWheelCycleStart(now);
        const lastSpin = user.lastZodiacWheelSpinAt ? new Date(user.lastZodiacWheelSpinAt) : null;
        const canSpin = !lastSpin || lastSpin < cycleStart;

        res.json({
            canSpin,
            lastSpinAt: user.lastZodiacWheelSpinAt || null,
            nextSpinAt: getNextZodiacWheelCycleStart(now)
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/zodiac-wheel/spin', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const now = new Date();
        const cycleStart = getZodiacWheelCycleStart(now);
        const alreadySpun = user.lastZodiacWheelSpinAt && new Date(user.lastZodiacWheelSpinAt) >= cycleStart;
        if (alreadySpun) {
            return res.status(400).json({
                error: 'כבר ביצעת סיבוב היום. סיבוב חדש נפתח כל יום ב-08:00.',
                nextSpinAt: getNextZodiacWheelCycleStart(now)
            });
        }

        const prizes = await ZodiacWheelPrize
            .find({ isActive: true, stock: { $gt: 0 }, winChance: { $gt: 0 } })
            .sort({ createdAt: 1 });

        const totalWinningChance = Math.min(100, prizes.reduce((acc, p) => acc + (p.winChance || 0), 0));
        const randomRoll = Math.random() * 100;

        let won = false;
        let selectedPrize = null;

        if (prizes.length > 0 && randomRoll < totalWinningChance) {
            let weightedRoll = Math.random() * totalWinningChance;
            for (const prize of prizes) {
                weightedRoll -= (prize.winChance || 0);
                if (weightedRoll <= 0) {
                    selectedPrize = await ZodiacWheelPrize.findOneAndUpdate(
                        { _id: prize._id, stock: { $gt: 0 } },
                        { $inc: { stock: -1 } },
                        { new: true }
                    );
                    if (selectedPrize) won = true;
                    break;
                }
            }
        }

        user.lastZodiacWheelSpinAt = now;
        user.zodiacWheelSpinsCount = (user.zodiacWheelSpinsCount || 0) + 1;
        await user.save();

        await ZodiacWheelSpin.create({
            userId: user._id,
            prizeId: selectedPrize?._id || undefined,
            prizeTitle: selectedPrize?.title || '',
            won
        });

        return res.json({
            won,
            message: won
                ? `מזל טוב! זכית ב-${selectedPrize.title}`
                : 'הפעם לא זכית, אבל מחר ב-08:00 מחכה לך סיבוב חדש ✨',
            prize: selectedPrize || null,
            nextSpinAt: getNextZodiacWheelCycleStart(now)
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.get('/admin/zodiac-wheel/prizes', authenticate, isAdmin, async (req, res) => {
    try {
        const prizes = await ZodiacWheelPrize.find().sort({ createdAt: 1 });
        res.json(prizes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/zodiac-wheel/prizes', authenticate, isAdmin, async (req, res) => {
    try {
        const prize = await new ZodiacWheelPrize(req.body).save();
        res.status(201).json(prize);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/zodiac-wheel/prizes/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const updated = await ZodiacWheelPrize.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/zodiac-wheel/prizes/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await ZodiacWheelPrize.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 6. קהילה (COMMUNITY) =================

router.get('/community', async (req, res) => {
    try { res.json(await Community.find().sort({ createdAt: -1 })); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/community', authenticate, isAdmin, async (req, res) => {
    try {
        const data = { ...req.body };
        if (data._id === '') delete data._id;
        res.json(await new Community(data).save());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/community/:id', authenticate, isAdmin, async (req, res) => {
    try { res.json(await Community.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/community/:id', authenticate, isAdmin, async (req, res) => {
    try { await Community.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 7. אשת השבוע (PERSONALITY) =================

// נתיב חדש לקבלת השאלות הקבועות (התבנית)
router.get('/personality/template', async (req, res) => {
    try {
        const template = await Personality.findOne({ isTemplate: true });
        res.json(template || { questions: [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// נתיב חדש לעדכון השאלות הקבועות (התבנית) - מתוקן למחיקת שאלות סופית
router.post('/personality/template', authenticate, isAdmin, async (req, res) => {
    try {
        let template = await Personality.findOne({ isTemplate: true });
        if (!template) {
            template = new Personality({ ...req.body, isTemplate: true, isActive: false });
        } else {
            // עדכון מפורש של המערך כדי להבטיח מחיקת איברים
            template.name = req.body.name;
            template.role = req.body.role;
            template.image = req.body.image;
            template.questions = req.body.questions;
            
            // פקודה קריטית: מודיעה למונגוס שהמערך השתנה ויש לדרוס את הישן
            template.markModified('questions');
        }
        await template.save();
        res.json(template);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/personality', async (req, res) => {
    try { 
        const p = await Personality.findOne({ isActive: true, isTemplate: false }).sort({ updatedAt: -1 }); 
        res.json(p || {}); 
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/personality/archive', async (req, res) => {
    try {
        const all = await Personality.find({ isTemplate: false }).sort({ updatedAt: -1 });
        res.json(all);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/personality', authenticate, isAdmin, async (req, res) => {
    try {
        let p = await Personality.findOne({ isActive: true, isTemplate: false });
        if (!p) p = new Personality(req.body);
        else Object.assign(p, req.body, { updatedAt: Date.now() });
        await p.save();
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/personality/generate-link', authenticate, isAdmin, async (req, res) => {
    try {
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const p = new Personality({ 
            name: 'ממתין למילוי',
            role: '',
            questions: req.body.questions || [],
            externalToken: token, 
            isActive: false,
            isTemplate: false
        });
        await p.save();
        res.json({ token, id: p._id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/personality/fill/:token', async (req, res) => {
    try {
        const p = await Personality.findOne({ externalToken: req.params.token });
        if (!p) return res.status(404).json({ error: 'Link invalid or expired' });
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/personality/fill/:token', async (req, res) => {
    try {
        const p = await Personality.findOneAndUpdate(
            { externalToken: req.params.token },
            { 
                ...req.body, 
                externalToken: null,
                updatedAt: Date.now() 
            },
            { new: true }
        );
        if (!p) return res.status(404).json({ error: 'Interview not found' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/personality/pending', authenticate, isAdmin, async (req, res) => {
    try {
        const pending = await Personality.find({ isActive: false, isTemplate: false, externalToken: null });
        res.json(pending);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/personality/approve/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Personality.updateMany({ isTemplate: false }, { isActive: false });
        await Personality.findByIdAndUpdate(req.params.id, { isActive: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/personality/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Personality.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 8. פורום (FORUM) =================

router.get('/forum', async (req, res) => {
    try {
        const posts = await ForumPost.find({ status: 'approved' }).sort({ createdAt: -1 });
        res.json(posts);
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

router.post('/forum/:id/like', authenticate, async (req, res) => {
    try {
        const post = await ForumPost.findById(req.params.id);
        const userId = req.user.id;
        if (post.likes.includes(userId)) {
            post.likes = post.likes.filter(id => id.toString() !== userId.toString());
        } else {
            post.likes.push(userId);
        }
        await post.save();
        res.json({ success: true, likes: post.likes.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/forum/:id/comment', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const post = await ForumPost.findByIdAndUpdate(req.params.id, {
            $push: { comments: { authorName: user.name, text: req.body.text } }
        }, { new: true });
        res.json(post);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/forum/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await ForumPost.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 9. הגדרות (SETTINGS) =================

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

// ================= 10. השראות ופרסומים (INSPIRATIONS & ADS) =================

router.get('/inspirations', async (req, res) => {
    try { res.json(await Inspiration.find().sort({ createdAt: -1 })); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/inspirations', authenticate, isAdmin, async (req, res) => {
    try {
        const data = { ...req.body };
        if (data._id === '') delete data._id;
        const resObj = await new Inspiration(data).save();
        res.json(resObj);
    } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/inspirations/:id', authenticate, isAdmin, async (req, res) => {
    try { res.json(await Inspiration.findByIdAndUpdate(req.params.id, req.body, { new: true })); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/inspirations/:id', authenticate, isAdmin, async (req, res) => {
    try { await Inspiration.findByIdAndDelete(req.params.id); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ads', async (req, res) => {
    try { res.json(await Ad.find().sort({ createdAt: -1 })); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ads', authenticate, isAdmin, async (req, res) => {
    try {
        const data = { ...req.body };
        if (data._id === '') delete data._id;
        const resObj = await new Ad(data).save();
        res.json(resObj);
    } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/ads/:id', authenticate, isAdmin, async (req, res) => {
    try { res.json(await Ad.findByIdAndUpdate(req.params.id, req.body, { new: true })); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/ads/:id', authenticate, isAdmin, async (req, res) => {
    try { await Ad.findByIdAndDelete(req.params.id); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 11. הודעות הנהלה (ANNOUNCEMENTS) =================

router.get('/announcements', async (req, res) => {
    try {
        const anns = await Announcement.find().sort({ createdAt: -1 });
        res.json(anns);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/announcements', authenticate, isAdmin, async (req, res) => {
    try {
        const data = { ...req.body };
        if (!data._id || data._id === '') delete data._id;
        
        const ann = new Announcement(data);
        await ann.save();
        res.status(201).json(ann);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/announcements/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const updated = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/announcements/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- שונות (פרופיל) ---

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

// ================= 12. העוזרת החכמה (GEMINI PROXY) =================

router.post('/chat', async (req, res) => {
  const { prompt } = req.body;
  try {
    const model = req.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error) {
    console.error("Gemini Server Error:", error);
    res.status(500).json({ error: "שגיאה בתקשורת עם ה-AI" });
  }
});

// ================= 13. שליחת תפוצה (BROADCAST & TEST) =================

router.post('/admin/broadcast-email', authenticate, isAdmin, async (req, res) => {
  const { subject, content, image, logo, isTest, targetEmail } = req.body;

  try {
    let recipients = [];
    if (isTest) {
      recipients = [{ email: targetEmail, name: 'מנהלת (בדיקה)' }];
    } else {
      recipients = await User.find({}, 'email name');
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: "לא נמצאו נמענים לשליחה" });
    }

    const emailHtml = `
      <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden; text-align: right; background: #ffffff;">
        ${logo ? `<div style="padding: 20px; text-align: center; background: #fdf6ff;"><img src="${logo}" style="max-height: 50px;"></div>` : ''}
        ${image ? `<img src="${image}" style="width: 100%; max-height: 300px; object-fit: cover; display: block;">` : ''}
        <div style="padding: 30px;">
          <h1 style="color: #f43f5e; font-size: 22px; margin-bottom: 20px;">${subject}</h1>
          <div style="font-size: 16px; line-height: 1.8; color: #334155; white-space: pre-wrap;">${content}</div>
        </div>
        <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #eee;">
          נשלח באהבה מקהילת "נשי - תרבות נשים עירונית"
        </div>
      </div>
    `;

    const batches = [];
    for (let i = 0; i < recipients.length; i += 100) {
      batches.push(recipients.slice(i, i + 100));
    }

    for (const batch of batches) {
      await req.resend.batch.send(
        batch.map(u => ({
          from: 'נשי <updates@nashi-co.com>',
          to: u.email,
          subject: subject,
          html: emailHtml
        }))
      );
    }

    res.json({ success: true, message: `נשלח בהצלחה ל-${recipients.length} נמענים` });
  } catch (error) {
    console.error("Broadcast Error:", error);
    res.status(500).json({ error: "חלה שגיאה בשליחת התפוצה" });
  }
});

// ================= 14. אתגרים (CHALLENGES) =================

// שליפת כל האתגרים למשתמש ולמנהל
router.get('/challenges', async (req, res) => {
    try {
        const challenges = await Challenge.find().sort({ createdAt: -1 });
        res.json(challenges);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// יצירת אתגר חדש (מנהלות בלבד)
router.post('/admin/challenges', authenticate, isAdmin, async (req, res) => {
    try {
        const challenge = new Challenge(req.body);
        await challenge.save();
        res.status(201).json(challenge);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// עדכון אתגר קיים (מנהלות בלבד)
router.put('/admin/challenges/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const updated = await Challenge.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// מחיקת אתגר וכל התמונות המשויכות אליו (מנהלות בלבד)
router.delete('/admin/challenges/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Challenge.findByIdAndDelete(req.params.id);
        await ChallengeEntry.deleteMany({ challengeId: req.params.id });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// השתתפות באתגר (העלאת תמונה)
router.post('/challenges/enter', authenticate, async (req, res) => {
    try {
        const { challengeId, familyName, image, phone } = req.body;
        if (!challengeId) return res.status(400).json({ error: 'חובה לבחור אתגר' });
        if (!phone) return res.status(400).json({ error: 'מספר טלפון הוא שדה חובה' });
        
        // בדיקה אם המשתמשת כבר העלתה תמונה לאתגר הספציפי הזה
        const existing = await ChallengeEntry.findOne({ userId: req.user.id, challengeId });
        if (existing) return res.status(400).json({ error: 'כבר שלחת תמונה לאתגר זה' });

        const entry = new ChallengeEntry({
            challengeId,
            userId: req.user.id,
            familyName,
            phone,
            image
        });
        await entry.save();
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// שליפת כל התמונות של כל האתגרים
router.get('/challenges/entries', async (req, res) => {
    try {
        const entries = await ChallengeEntry.find().sort({ createdAt: -1 });
        res.json(entries);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ביצוע הגרלה ובחירת זוכה לאתגר ספציפי (מנהלות בלבד)
router.post('/admin/challenges/:id/run', authenticate, isAdmin, async (req, res) => {
    try {
        const entries = await ChallengeEntry.find({ challengeId: req.params.id });
        if (entries.length === 0) return res.status(400).json({ error: 'אין משתתפות באתגר זה' });

        const randomIndex = Math.floor(Math.random() * entries.length);
        const winner = entries[randomIndex];

        const challenge = await Challenge.findById(req.params.id);
        if (challenge) {
            challenge.winnerId = winner.userId;
            challenge.winnerFamily = winner.familyName;
            challenge.isActive = false;
            await challenge.save();
        }

        res.json({ success: true, winnerFamily: winner.familyName });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 15. פניות הציבור (CONTACT MESSAGES) =================

// קבלת פנייה חדשה (פתוח לכולן, עם שמירת userId אם מחוברת)
router.post('/contact', async (req, res) => {
    try {
        const message = new ContactMessage({
            ...req.body,
            // ננסה לחלץ את המשתמש אם קיים טוקן, אך לא נכשיל את הבקשה אם אין
            userId: req.headers['authorization'] ? jwt.decode(req.headers['authorization'].split(' ')[1])?.id : null
        });
        await message.save();
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// קבלת כל ההודעות (מנהלות בלבד)
router.get('/admin/messages', authenticate, isAdmin, async (req, res) => {
    try {
        const messages = await ContactMessage.find().sort({ createdAt: -1 });
        res.json(messages);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// מחיקת הודעה (מנהלות בלבד)
router.delete('/admin/messages/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await ContactMessage.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// סימון הודעה כנקראה (מנהלות בלבד)
router.put('/admin/messages/:id/read', authenticate, isAdmin, async (req, res) => {
    try {
        await ContactMessage.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 16. כרטיסים וברקודים (TICKETS) =================

router.get('/admin/tickets', authenticate, isAdmin, async (req, res) => {
    try {
        const tickets = await Ticket.find().populate('eventId', 'title date location').sort({ createdAt: -1 });
        res.json(tickets);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/tickets', authenticate, isAdmin, async (req, res) => {
    try {
        const ticket = new Ticket(req.body);
        await ticket.save();
        res.status(201).json(ticket);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/tickets/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Ticket.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// סריקת הברקוד (Scanner endpoint)
router.post('/admin/tickets/verify/:code', authenticate, isAdmin, async (req, res) => {
    try {
        const ticket = await Ticket.findOne({ code: req.params.code }).populate('eventId', 'title');
        if (!ticket) return res.status(404).json({ error: 'כרטיס מזויף או לא קיים במערכת!' });

        if (ticket.isUsed) {
            return res.status(400).json({ 
                error: 'כרטיס זה כבר נוצל!', 
                usedAt: ticket.usedAt,
                eventTitle: ticket.eventId?.title
            });
        }

        // סימון כרטיס כנוצל
        ticket.isUsed = true;
        ticket.usedAt = new Date();
        await ticket.save();

        res.json({ success: true, message: 'כניסה אושרה בהצלחה!', eventTitle: ticket.eventId?.title });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 17. סטוריז (STORIES) =================

// שליפת סטוריז מאושרים (עבור דף הבית)
router.get('/stories', async (req, res) => {
    try {
        // שולפים רק סטוריז במצב "approved". (ה-TTL במונגו כבר דואג למחוק את מה שעבר 24 שעות)
        const stories = await Story.find({ status: 'approved' })
            .populate('user', 'name avatar') // מביאים את שם ותמונת המשתמשת
            .sort({ approvedAt: 1 }); // סידור מהישן לחדש (כמו בוואצפ)
        res.json(stories);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// העלאת סטורי חדש על ידי משתמשת (מחייב חיבור)
router.post('/stories', authenticate, async (req, res) => {
    try {
        const story = new Story({
            user: req.user.id,
            type: req.body.type || 'text',
            content: req.body.content,
            caption: req.body.caption || '' // <--- הוספנו פה את קבלת הטקסט!
            // status יהיה 'pending' אוטומטית לפי המודל
        });
        await story.save();
        res.status(201).json({ success: true, message: 'הסטורי נשלח לאישור מנהלת' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// שליפת הסטוריז הממתינים לאישור (מנהלות בלבד)
router.get('/admin/stories', authenticate, isAdmin, async (req, res) => {
    try {
        const stories = await Story.find({ status: 'pending' })
            .populate('user', 'name avatar')
            .sort({ createdAt: -1 });
        res.json(stories);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// אישור סטורי על ידי המנהלת
router.put('/admin/stories/:id/approve', authenticate, isAdmin, async (req, res) => {
    try {
        // חשוב: מעדכנים את שדה approvedAt לעכשיו, מה שמתחיל את שעון העצר של ה-24 שעות!
        const story = await Story.findByIdAndUpdate(
            req.params.id, 
            { status: 'approved', approvedAt: Date.now() }, 
            { new: true }
        );
        res.json({ success: true, story });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// מחיקת סטורי (על ידי מנהלת - אם סירבה לאשר או רצתה להסיר)
router.delete('/admin/stories/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Story.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// מחיקת סטורי על ידי המשתמשת עצמה (הבעלים של הסטורי)
router.delete('/stories/:id', authenticate, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) return res.status(404).json({ error: 'Story not found' });
        
        // נוודא שמי שמנסה למחוק היא אכן המשתמשת שהעלתה את הסטורי
        if (story.user.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized to delete this story' });
        }
        
        await Story.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- שליפת סטוריז פעילים למנהלת (כולל צפיות) ---
router.get('/admin/stories/active', authenticate, isAdmin, async (req, res) => {
    try {
        const stories = await Story.find({ status: 'approved' })
            .populate('user', 'name avatar')
            .sort({ approvedAt: -1 });
        res.json(stories);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- עדכון ספירת צפיות בסטורי ---
router.post('/stories/:id/view', authenticate, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) return res.status(404).json({ error: 'Story not found' });
        
        // אם המשתמשת עוד לא צפתה בסטורי, נוסיף אותה ונעלה את המונה
        if (!story.viewedBy.includes(req.user.id)) {
            story.viewedBy.push(req.user.id);
            story.views += 1;
            await story.save();
        }
        res.json({ success: true, views: story.views });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- יצירת תמונה אמיתית מתוך ה-Base64 עבור וואטסאפ ---
router.get('/stories/image/:id', async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story || story.type !== 'image' || !story.content) {
            return res.status(404).send('Image not found');
        }
        
        // חילוץ הנתונים מהטקסט (Base64)
        const matches = story.content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).send('Invalid image format');
        }
        
        const imgType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        
        // החזרת הנתונים כקובץ תמונה לכל דבר!
        res.writeHead(200, {
            'Content-Type': imgType,
            'Content-Length': buffer.length
        });
        res.end(buffer);
    } catch (err) { res.status(500).send(err.message); }
});

// --- ראוט מיוחד לשיתוף בוואצפ (OG Tags) מתוקן ועשיר ---
router.get('/stories/share/:id', async (req, res) => {
    try {
        const story = await Story.findById(req.params.id).populate('user', 'name');
        if (!story) return res.status(404).send('הסטורי לא נמצא או שנמחק');

        const isText = story.type === 'text';
        const title = `סטורי חדש מאת ${story.user?.name || 'חברה בקהילה'} | קהילת נשי`;
        
        // אם הסטורי הוא טקסט - נציג את הטקסט שלו כתיאור. אם תמונה - נציג את הכיתוב שהיא הוסיפה.
        const description = isText ? story.content : (story.caption || 'היכנסי לראות את הסטורי שהעליתי הרגע לקהילה!');
        
        // כתובת השרת שלנו (כדי לחלץ את התמונה)
        const serverUrl = req.protocol + '://' + req.get('host');
        
        // תמונת ברירת מחדל (אפשר להחליף את הלינק של Unsplash בלינק ללוגו של קהילת נשי!)
        const defaultImageUrl = 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'; 
        
        // בסטורי טקסט אין לנו תמונה במסד, אז ניתן את תמונת הדיפולט.
        const imageUrl = isText ? defaultImageUrl : `${serverUrl}/api/stories/image/${story._id}`; 
        
        // הכתובת אליה המשתמשת תועבר כשתלחץ על הלינק (לדף הבית של האתר שלך)
        const frontendUrl = process.env.FRONTEND_URL || 'https://nashi-production.up.railway.app';
        const redirectUrl = `${frontendUrl}/#/?storyId=${story._id}`;

        const html = `
        <!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            
            <meta property="og:title" content="${title}" />
            <meta property="og:description" content="${description}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="og:url" content="${redirectUrl}" />
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="קהילת נשי" />

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="${title}" />
            <meta name="twitter:description" content="${description}" />
            <meta name="twitter:image" content="${imageUrl}" />
            
            <script>
                // הפניה אוטומטית לאתר מיד אחרי שוואצפ שואב את הנתונים המקדימים
                window.location.href = "${redirectUrl}";
            </script>
        </head>
        <body style="background:#fffcfc; text-align:center; padding-top:50px; font-family:sans-serif;">
            <h2>מעביר אותך לסטורי...</h2>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
