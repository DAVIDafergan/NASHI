import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // תוספת עבור ייצור טוקנים מאובטחים
import mongoose from 'mongoose';
import { 
    User, Event, Class, Lottery, Settings, GiftCode, 
    Announcement, // הוספת המודל החדש לייבוא
    Personality, ForumPost, Community, Inspiration, Ad,
    ShabbatLottery, ShabbatEntry // הוספת המודלים של שולחן השבת לייבוא
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
        res.json(await new Lottery(data).save());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/lotteries/:id', authenticate, isAdmin, async (req, res) => {
    try { res.json(await Lottery.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { res.status(500).json({ error: err.message }); }
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

router.get('/personality', async (req, res) => {
    try { 
        const p = await Personality.findOne({ isActive: true }).sort({ updatedAt: -1 }); 
        res.json(p || {}); 
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/personality/archive', async (req, res) => {
    try {
        const all = await Personality.find().sort({ updatedAt: -1 });
        res.json(all);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/personality', authenticate, isAdmin, async (req, res) => {
    try {
        let p = await Personality.findOne({ isActive: true });
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
            isActive: false 
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
        const pending = await Personality.find({ isActive: false, externalToken: null });
        res.json(pending);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/personality/approve/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Personality.updateMany({}, { isActive: false });
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

// ================= 12. העוזרת החכמה (GEMINI PROXY) - חדש! =================

router.post('/chat', async (req, res) => {
  const { prompt } = req.body;
  try {
    // שימוש ב-genAI שהונגש ב-index.js
    const model = req.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error) {
    console.error("Gemini Server Error:", error);
    res.status(500).json({ error: "שגיאה בתקשורת עם ה-AI" });
  }
});

// ================= 13. שליחת תפוצה (BROADCAST & TEST) - מתוקן! =================

router.post('/admin/broadcast-email', authenticate, isAdmin, async (req, res) => {
  const { subject, content, image, logo, isTest, targetEmail } = req.body;

  try {
    let recipients = [];
    if (isTest) {
      // שליחת ניסיון למייל בודד
      recipients = [{ email: targetEmail, name: 'מנהלת (בדיקה)' }];
    } else {
      // שליחת אמת לכל המשתמשות הרשומות
      recipients = await User.find({}, 'email name');
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: "לא נמצאו נמענים לשליחה" });
    }

    // בניית גוף המייל המעוצב ב-HTML
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

    // פיצול הנמענים לקבוצות (Batch) של עד 100 נמענים כל אחת (מגבלת Resend)
    const batches = [];
    for (let i = 0; i < recipients.length; i += 100) {
      batches.push(recipients.slice(i, i + 100));
    }

    // שליחה לכל הבאצ'ים
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

// ================= 14. שולחן השבת שלי (SHABBAT LOTTERY) =================

// קבלת הגדרות הגרלת שבת הנוכחית
router.get('/shabbat-lottery/settings', async (req, res) => {
    try {
        const settings = await ShabbatLottery.findOne().sort({ createdAt: -1 });
        res.json(settings || { prize: 'פרס יוקרתי', notes: '', isActive: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// עדכון הגדרות הגרלת שבת (מנהלת)
router.post('/admin/shabbat-lottery/settings', authenticate, isAdmin, async (req, res) => {
    try {
        let settings = await ShabbatLottery.findOne().sort({ createdAt: -1 });
        if (!settings) {
            settings = new ShabbatLottery(req.body);
        } else {
            Object.assign(settings, req.body);
        }
        await settings.save();
        res.json(settings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// הגשת מועמדות להגרלת שבת (משתמשת)
router.post('/shabbat-lottery/enter', authenticate, async (req, res) => {
    try {
        const { familyName, image, phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'מספר טלפון הוא שדה חובה' });
        
        // בדיקה אם המשתמשת כבר שלחה השבוע (לפי userId)
        const existing = await ShabbatEntry.findOne({ userId: req.user.id });
        if (existing) return res.status(400).json({ error: 'כבר שלחת תמונה להגרלה זו השבוע' });

        const entry = new ShabbatEntry({
            userId: req.user.id,
            familyName,
            phone,
            image
        });
        await entry.save();
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// קבלת רשימת המשתתפות להגרלה (מנהלת)
router.get('/admin/shabbat-lottery/entries', authenticate, isAdmin, async (req, res) => {
    try {
        const entries = await ShabbatEntry.find().sort({ createdAt: -1 });
        res.json(entries);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// הפעלת הגרלת שבת (מנהלת)
router.post('/admin/shabbat-lottery/run', authenticate, isAdmin, async (req, res) => {
    try {
        const entries = await ShabbatEntry.find();
        if (entries.length === 0) return res.status(400).json({ error: 'אין משתתפות בהגרלה' });

        const randomIndex = Math.floor(Math.random() * entries.length);
        const winner = entries[randomIndex];

        const lottery = await ShabbatLottery.findOne().sort({ createdAt: -1 });
        if (lottery) {
            lottery.winnerId = winner.userId;
            lottery.winnerFamily = winner.familyName;
            lottery.isActive = false;
            await lottery.save();
        }

        // אופציונלי: מחיקת המשתתפות לקראת השבוע הבא
        // await ShabbatEntry.deleteMany({});

        res.json({ success: true, winnerFamily: winner.familyName });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;