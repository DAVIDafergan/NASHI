import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // תוספת עבור ייצור טוקנים מאובטחים
import mongoose from 'mongoose';
import { regionOfCity, REGIONS } from '../shared/regions.js';
import { isEventExpired } from '../shared/eventTime.js';
const REGION_IDS = REGIONS.map(r => r.id);
import { 
    User, Event, Class, Lottery, Settings, GiftCode, 
    Announcement, // הוספת המודל החדש לייבוא
    Personality, ForumPost, Community, Inspiration, Ad,
    Challenge, ChallengeEntry, // הוספת המודלים של האתגרים לייבוא במקום שבת
    ContactMessage, // הוספת מודל פניות הציבור לייבוא
    Ticket, // התווסף מודל הכרטיסים!
    Story, // <--- תוספת: מודל הסטוריז
    ManagerApplication,
    ZodiacWheelPrize, ZodiacWheelSpin,
    Flyer, // פליירים לקרוסלת דף הבית
    ImportBlock // אירועים מיובאים שנמחקו (שהסוכן לא יחזיר)
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

// never send password hashes / reset tokens to the browser
const publicUser = (u) => {
    const o = u.toObject ? u.toObject() : { ...u };
    delete o.password; delete o.resetPasswordToken; delete o.resetPasswordExpires;
    return { ...o, id: o._id };
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

const requireValidObjectId = (paramName = 'id') => (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
        return res.status(400).json({ error: 'Invalid ID format' });
    }
    next();
};

const createSimpleRateLimiter = (limit, windowMs) => {
    const bucket = new Map();
    return (req, res, next) => {
        const now = Date.now();
        const key = `${req.ip}:${req.user?.id || 'guest'}:${req.path}`;
        const current = bucket.get(key);

        if (!current || now > current.resetAt) {
            bucket.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        if (current.count >= limit) {
            return res.status(429).json({ error: 'יותר מדי בקשות, יש לנסות שוב בעוד זמן קצר.' });
        }

        current.count += 1;
        bucket.set(key, current);
        return next();
    };
};

const zodiacWheelRateLimit = createSimpleRateLimiter(10, 60 * 1000);


// ---- מנהלות אזור ----
// A regional manager (role 'regionAdmin' + adminRegion) may create, edit and delete events, classes,
// community items and lotteries — only local items in her own region. Main admins (isAdmin) can do everything.
const canManage = (Model) => async (req, res, next) => {
    try {
        if (req.user?.isAdmin) return next();
        const me = await User.findById(req.user?.id).select('role adminRegion isAdmin');
        if (me?.isAdmin) return next();
        if (me?.role !== 'regionAdmin' || !me.adminRegion) return res.status(403).json({ error: 'Admin access required' });
        req.regionAdmin = { id: me._id, region: me.adminRegion };
        if (req.params.id) {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'not found' });
            const doc = await Model.findById(req.params.id).select('region scope');
            if (!doc) return res.status(404).json({ error: 'not found' });
            if ((doc.region || 'north') !== me.adminRegion || (doc.scope && doc.scope !== 'local')) {
                return res.status(403).json({ error: 'אפשר לערוך רק תוכן מקומי באזור שלך' });
            }
        }
        if (['POST', 'PUT'].includes(req.method) && req.body && typeof req.body === 'object' && !req.path.includes('/run')) {
            const body = req.body;
            if (req.method === 'POST' || body.city !== undefined) {
                if (regionOfCity(body.city) !== me.adminRegion) return res.status(403).json({ error: 'בחרי עיר מהאזור שלך' });
            }
            body.scope = 'local';
            body.region = me.adminRegion;
            delete body.isHero; // the homepage banner stays with the main admin
            delete body.createdBy;
            if (req.method === 'POST') body.createdBy = me._id;
            body.regionOnly = true; // her items show only in her region
        }
        next();
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// הגדרת מנהלת אזור (מנהלת ראשית בלבד)
router.put('/admin/users/:id/role', authenticate, isAdmin, async (req, res) => {
    try {
        const { role, adminRegion } = req.body || {};
        if (!['member', 'regionAdmin'].includes(role)) return res.status(400).json({ error: 'role' });
        if (role === 'regionAdmin' && !REGION_IDS.includes(adminRegion)) return res.status(400).json({ error: 'בחרי אזור' });
        const user = await User.findByIdAndUpdate(req.params.id,
            role === 'regionAdmin' ? { role, adminRegion } : { role: 'member', $unset: { adminRegion: 1 } },
            { new: true }).select('-password -resetPasswordToken -resetPasswordExpires');
        if (!user) return res.status(404).json({ error: 'not found' });
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- בקשות להיות מנהלת תרבות ----
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// my application (to show its status)
router.get('/manager-applications/mine', authenticate, async (req, res) => {
    try { res.json(await ManagerApplication.findOne({ user: req.user.id }).sort({ createdAt: -1 })); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/manager-applications', authenticate, async (req, res) => {
    try {
        const me = await User.findById(req.user.id).select('name email phone city role isAdmin');
        if (!me) return res.status(404).json({ error: 'not found' });
        if (me.isAdmin || me.role === 'regionAdmin') return res.status(400).json({ error: 'את כבר מנהלת 🙂' });
        const open = await ManagerApplication.findOne({ user: me._id, status: 'pending' });
        if (open) return res.status(400).json({ error: 'הבקשה שלך כבר בבדיקה' });
        const b = req.body || {};
        const city = clip(b.city, 60) || me.city || '';
        const region = regionOfCity(city) || (REGION_IDS.includes(b.region) ? b.region : '');
        const f = {
            fullName: clip(b.fullName, 80), email: clip(b.email, 120).toLowerCase(), phone: clip(b.phone, 30) || me.phone || '',
            address: clip(b.address, 200), jobTitle: clip(b.jobTitle, 80), employer: clip(b.employer, 20), employerOther: clip(b.employerOther, 120),
            activityScope: clip(b.activityScope, 1500), about: clip(b.about, 1500), experience: clip(b.experience, 1500), hoursPerWeek: clip(b.hoursPerWeek, 40),
        };
        // everything is required except experience
        const missing = [
            !f.fullName && 'שם מלא', !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) && 'מייל תקין', !f.phone && 'טלפון', !region && 'עיר',
            !f.address && 'כתובת', !f.jobTitle && 'תפקיד', !['matnas', 'municipality', 'other'].includes(f.employer) && 'מקום העסקה',
            f.employer === 'other' && !f.employerOther && 'פירוט מקום העסקה', !f.activityScope && 'היקף פעילות', !f.about && 'קצת עלייך', !f.hoursPerWeek && 'זמינות',
        ].filter(Boolean);
        if (missing.length) return res.status(400).json({ error: `חסר: ${missing.join(', ')}` });
        const appl = await new ManagerApplication({ user: me._id, name: f.fullName || me.name, city, region, ...f }).save();
        if (!me.city && city) await User.updateOne({ _id: me._id }, { city, region });
        res.status(201).json(appl);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/manager-applications', authenticate, isAdmin, async (req, res) => {
    try {
        const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
        res.json(await ManagerApplication.find({ status }).populate('user', 'name email phone avatar city createdAt').sort({ createdAt: -1 }).limit(200));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/manager-applications/:id/:decision(approve|reject)', authenticate, isAdmin, async (req, res) => {
    try {
        const appl = await ManagerApplication.findById(req.params.id).populate('user', 'name email');
        if (!appl) return res.status(404).json({ error: 'not found' });
        const approve = req.params.decision === 'approve';
        const region = approve ? (REGION_IDS.includes(req.body?.region) ? req.body.region : appl.region) : appl.region;
        appl.status = approve ? 'approved' : 'rejected';
        appl.region = region;
        appl.decidedAt = new Date();
        appl.decidedBy = req.user.id;
        await appl.save();
        if (approve) await User.updateOne({ _id: appl.user._id }, { role: 'regionAdmin', adminRegion: region });
        // best-effort email
        try {
            if (approve && appl.user?.email && req.resend && process.env.RESEND_API_KEY) {
                const regionLabel = (REGIONS.find(r => r.id === region) || {}).name || '';
                await req.resend.emails.send({
                    from: 'נשי <updates@nashi-co.com>',
                    to: appl.user.email,
                    subject: 'ברוכה הבאה למנהלות התרבות של נשי 💗',
                    html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#2B2027">
                      <h2 style="color:#8A5058">מזל טוב, ${appl.user.name || ''}!</h2>
                      <p>הבקשה שלך אושרה. מעכשיו את <b>מנהלת התרבות של אזור ${regionLabel}</b> בנשי.</p>
                      <p>איך מתחילות: נכנסות לאתר עם המשתמש שלך, ובתפריט בוחרות <b>"ניהול האזור שלי"</b>. משם אפשר להעלות אירועים, חוגים, גמ"חים והגרלות, ולהנפיק כרטיסים.</p>
                      <p><a href="https://nashi-co.com/#/admin" style="background:#8A5058;color:#fff;padding:10px 22px;border-radius:999px;text-decoration:none">לניהול האזור שלי</a></p>
                      <p style="color:#888;font-size:13px">נשלח באהבה מ"נשי" · קהילת נשים דתיות מכל הארץ</p></div>`,
                });
            }
        } catch (e) { console.warn('manager approval email failed:', e?.message); }
        res.json({ success: true, application: appl });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 1. אישורים (APPROVALS) =================

router.get('/admin/approvals', authenticate, isAdmin, async (req, res) => {
    try {
        const pendingUsers = await User.find({ isMemberRequested: true, isMemberApproved: false }).select('-password -resetPasswordToken -resetPasswordExpires');
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
        const city = typeof req.body.city === 'string' ? req.body.city.trim().slice(0, 60) : '';
        if (await User.findOne({ email })) return res.status(400).json({ error: 'Email exists' });
        const config = await getPointsConfig();
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name, email, password: hashedPassword, phone,
            city: city || undefined, region: regionOfCity(city) || undefined,
            // אוואטרים חמודים לנשים - מודל lorelei עם פילטרים לחיוך, הבעות מתוקות וצבעי רקע נעימים
            avatar: `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(name)}&backgroundColor=ffd5dc,ffdfbf,c0aede,d1d4f9,ffc0cb&mouth=smile,happy,cute&eyes=happy,open,wink`,
            points: config.pointsPerRegister || 50
        });
        // חברה שהזמינה אותה (קישור הזמנה /s/join?ref=...) מקבלת נקודות
        const ref = typeof req.body.ref === 'string' && mongoose.Types.ObjectId.isValid(req.body.ref) ? req.body.ref : null;
        if (ref) {
            const inviter = await User.findById(ref).select('_id email');
            if (inviter && inviter.email !== email) {
                user.referredBy = inviter._id;
                await User.updateOne({ _id: inviter._id }, { $inc: { points: config.pointsPerReferral || 30, referralsCount: 1 } });
            }
        }
        await user.save();
        const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_SECRET);
        res.json({ token, user: publicUser(user) });
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
        res.json({ token, user: publicUser(user) });
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
        // משתמשת רגילה יכולה לעדכן רק פרטים אישיים, לא הרשאות, נקודות או סיסמה
        const PROTECTED = ['_id', 'id', 'isAdmin', 'isMemberApproved', 'isMemberRequested', 'points', 'password', 'email',
            'resetPasswordToken', 'resetPasswordExpires', 'referredBy', 'referralsCount', 'createdAt', 'lastZodiacWheelSpinAt', 'zodiacWheelSpinsCount', 'role', 'adminRegion'];
        const update = { ...req.body };
        if (!req.user.isAdmin) PROTECTED.forEach(k => delete update[k]);
        if (typeof update.city === 'string') { update.city = update.city.trim().slice(0, 60); update.region = regionOfCity(update.city) || update.region; }
        else { delete update.password; delete update._id; }
        const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password -resetPasswordToken -resetPasswordExpires');
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
    // hidden = imported events a manager hid, or that disappeared from the source / already happened
    // past events stay 48h (shown as "עבר"), then never again — even before the hourly cleanup gets to them
    try {
        const list = await Event.find({ hidden: { $ne: true }, archived: { $ne: true } }).populate('attendees', 'name avatar');
        const now = Date.now();
        res.json(list.filter(e => !isEventExpired(e, now)));
    } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// one event (deep links /#/events?e=<id>): 410 with a short summary when it already ended / was removed
router.get('/events/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'not found' });
        const ev = await Event.findById(req.params.id).populate('attendees', 'name avatar');
        if (!ev) return res.status(404).json({ error: 'not found' });
        if (ev.hidden || ev.archived || isEventExpired(ev)) return res.status(410).json({ ended: true, title: ev.title, region: ev.region, city: ev.city, scope: ev.scope });
        res.json(ev);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ארכיון: events that ended more than 48h ago (manual ones are archived, imported ones are deleted).
// Main admin: all · regional manager: local events of her region.
router.get('/admin/events/archive', authenticate, async (req, res) => {
    try {
        const me = await User.findById(req.user.id).select('isAdmin role adminRegion');
        if (!me?.isAdmin && !(me?.role === 'regionAdmin' && me.adminRegion)) return res.status(403).json({ error: 'Admin access required' });
        const q = { archived: true };
        if (!me.isAdmin) Object.assign(q, { region: me.adminRegion, scope: { $in: ['local', null] } });
        res.json(await Event.find(q).select('-attendees').sort({ date: -1 }).limit(300));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events', authenticate, canManage(Event), async (req, res) => {
    try {
        const data = { ...req.body };
        if (data._id === '') delete data._id;
        ['source', 'sourceId', 'importedAt', 'lastSeenAt', 'hidden', 'hiddenReason'].forEach(k => delete data[k]); // manual events are never "imported"
        res.json(await new Event(data).save());
    } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// fields that only the events agent writes
const IMPORT_FIELDS = ['source', 'sourceId', 'sourceName', 'sourceUrl', 'sourceImageUrl', 'importedAt', 'lastSeenAt', 'importEdited', 'hidden', 'hiddenReason', 'archivedAt'];

router.put('/events/:id', authenticate, canManage(Event), async (req, res) => {
    try {
        const update = { ...req.body };
        IMPORT_FIELDS.forEach(k => delete update[k]);
        const current = await Event.findById(req.params.id).select('source');
        // a manager edited an imported event: the agent keeps her text from now on and only refreshes status/price/time
        if (current?.source) update.importEdited = true;
        let doc = await Event.findByIdAndUpdate(req.params.id, update, { new: true });
        // an archived event that was moved to a new date comes back
        if (doc?.archived && !isEventExpired(doc)) doc = await Event.findByIdAndUpdate(doc._id, { archived: false, $unset: { archivedAt: 1 } }, { new: true });
        res.json(doc);
    } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/events/:id', authenticate, canManage(Event), async (req, res) => {
    try {
        const ev = await Event.findById(req.params.id).select('source sourceId title');
        // deleting an imported event also stops the agent from importing it again
        if (ev?.source) await ImportBlock.updateOne({ source: ev.source, sourceId: ev.sourceId }, { $setOnInsert: { title: ev.title, blockedBy: req.user.id } }, { upsert: true });
        await Event.findByIdAndDelete(req.params.id); res.json({ success: true });
    } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 4. חוגים (CLASSES) =================

router.get('/classes', async (req, res) => {
    try { res.json(await Class.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/classes', authenticate, canManage(Class), async (req, res) => {
    try {
        const data = { ...req.body };
        if (data._id === '') delete data._id;
        res.json(await new Class(data).save());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/classes/:id', authenticate, canManage(Class), async (req, res) => {
    try { res.json(await Class.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/classes/:id', authenticate, canManage(Class), async (req, res) => {
    try { await Class.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 5. הגרלות (LOTTERIES) =================

router.get('/lotteries', async (req, res) => {
    try { res.json(await Lottery.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/lotteries', authenticate, canManage(Lottery), async (req, res) => {
    try {
        const data = { ...req.body };
        if (data._id === '') delete data._id;
        // הקוד כאן שומר את כל ה-body, כולל prizes (המערך) ו-prize2-7
        res.json(await new Lottery(data).save());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/lotteries/:id', authenticate, canManage(Lottery), async (req, res) => {
    try { 
        // הקוד כאן מעדכן את כל ה-body, כולל prizes (המערך) ו-prize2-7
        res.json(await Lottery.findByIdAndUpdate(req.params.id, req.body, { new: true })); 
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/lotteries/:id/run', authenticate, canManage(Lottery), async (req, res) => {
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

router.delete('/lotteries/:id', authenticate, canManage(Lottery), async (req, res) => {
    try { await Lottery.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/lotteries/:id/participants', authenticate, canManage(Lottery), async (req, res) => {
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

router.get('/zodiac-wheel/prizes', zodiacWheelRateLimit, async (req, res) => {
    try {
        const prizes = await ZodiacWheelPrize
            .find({ isActive: true })
            .sort({ createdAt: 1 });
        res.json(prizes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/zodiac-wheel/status', authenticate, zodiacWheelRateLimit, async (req, res) => {
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

router.post('/zodiac-wheel/spin', authenticate, zodiacWheelRateLimit, async (req, res) => {
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
            .find({ isActive: true, stock: { $gt: 0 }, dailyWinners: { $gt: 0 } })
            .sort({ createdAt: 1 });

        let won = false;
        let selectedPrize = null;

        if (prizes.length > 0) {
            const winsToday = await ZodiacWheelSpin.aggregate([
                {
                    $match: {
                        won: true,
                        createdAt: { $gte: cycleStart },
                        prizeId: { $ne: null }
                    }
                },
                {
                    $group: {
                        _id: '$prizeId',
                        count: { $sum: 1 }
                    }
                }
            ]);
            const winsMap = new Map(winsToday.map(item => [String(item._id), Number(item.count) || 0]));

            const remainingPrizes = prizes
                .map(prize => {
                    const wonToday = winsMap.get(String(prize._id)) || 0;
                    const remainingDailyWinners = Math.max(0, (Number(prize.dailyWinners) || 0) - wonToday);
                    return { prize, remainingDailyWinners };
                })
                .filter(item => item.remainingDailyWinners > 0);

            if (remainingPrizes.length > 0) {
                let pool = [...remainingPrizes];
                while (pool.length > 0 && !selectedPrize) {
                    const totalRemainingWinners = pool.reduce((sum, item) => sum + item.remainingDailyWinners, 0);
                    let roll = Math.random() * totalRemainingWinners;
                    let chosenIndex = 0;
                    for (let i = 0; i < pool.length; i += 1) {
                        roll -= pool[i].remainingDailyWinners;
                        if (roll <= 0) {
                            chosenIndex = i;
                            break;
                        }
                    }

                    const chosen = pool[chosenIndex].prize;
                    selectedPrize = await ZodiacWheelPrize.findOneAndUpdate(
                        { _id: chosen._id, stock: { $gt: 0 } },
                        { $inc: { stock: -1 } },
                        { new: true }
                    );

                    if (!selectedPrize) {
                        pool.splice(chosenIndex, 1);
                    }
                }
                won = !!selectedPrize;
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
                ? `מזל טוב! זכית ב-${selectedPrize?.title || 'הטבה מיוחדת'}`
                : 'הפעם לא זכית, אבל מחר ב-08:00 מחכה לך סיבוב חדש ✨',
            prize: selectedPrize || null,
            nextSpinAt: getNextZodiacWheelCycleStart(now)
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.get('/admin/zodiac-wheel/stats', zodiacWheelRateLimit, authenticate, isAdmin, async (req, res) => {
    try {
        const now = new Date();
        const cycleStart = getZodiacWheelCycleStart(now);

        const [activePrizes, totalSpins, winningSpins, todayWinners] = await Promise.all([
            ZodiacWheelPrize.find({ isActive: true }).select('dailyWinners'),
            ZodiacWheelSpin.countDocuments(),
            ZodiacWheelSpin.find({ won: true })
                .populate('userId', 'name email')
                .sort({ createdAt: -1 })
                .limit(200),
            ZodiacWheelSpin.countDocuments({ won: true, createdAt: { $gte: cycleStart } })
        ]);

        const totalDailyWinners = activePrizes.reduce((sum, item) => sum + (Number(item.dailyWinners) || 0), 0);

        const winners = winningSpins.map(spin => ({
            _id: spin._id,
            createdAt: spin.createdAt,
            prizeTitle: spin.prizeTitle || 'הטבה מיוחדת',
            userName: spin.userId?.name || 'משתמש לא זמין',
            userEmail: spin.userId?.email || ''
        }));

        res.json({
            totalSpins,
            totalDailyWinners,
            todayWinners,
            winners
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/zodiac-wheel/prizes', authenticate, isAdmin, zodiacWheelRateLimit, async (req, res) => {
    try {
        const prizes = await ZodiacWheelPrize.find().sort({ createdAt: 1 });
        res.json(prizes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/zodiac-wheel/prizes', authenticate, isAdmin, zodiacWheelRateLimit, async (req, res) => {
    try {
        const payload = {
            title: String(req.body.title || '').trim(),
            description: String(req.body.description || '').trim(),
            stock: Math.max(0, Math.floor(Number(req.body.stock) || 0)),
            dailyWinners: Math.max(0, Math.floor(Number(req.body.dailyWinners) || 0))
        };
        const prize = await new ZodiacWheelPrize(payload).save();
        res.status(201).json(prize);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/zodiac-wheel/prizes/:id', authenticate, isAdmin, zodiacWheelRateLimit, requireValidObjectId('id'), async (req, res) => {
    try {
        const current = await ZodiacWheelPrize.findById(req.params.id);
        if (!current) return res.status(404).json({ error: 'Prize not found' });
        const payload = {
            title: req.body.title === undefined ? current.title : String(req.body.title || '').trim(),
            description: req.body.description === undefined ? current.description : String(req.body.description || '').trim(),
            stock: req.body.stock === undefined
                ? current.stock
                : Math.max(0, Math.floor(Number(req.body.stock) || 0)),
            dailyWinners: req.body.dailyWinners === undefined
                ? current.dailyWinners
                : Math.max(0, Math.floor(Number(req.body.dailyWinners) || 0)),
            isActive: req.body.isActive === undefined ? current.isActive : Boolean(req.body.isActive)
        };
        const updated = await ZodiacWheelPrize.findByIdAndUpdate(req.params.id, payload, { new: true });
        res.json(updated);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/zodiac-wheel/prizes', authenticate, isAdmin, zodiacWheelRateLimit, async (req, res) => {
    try {
        const result = await ZodiacWheelPrize.deleteMany({});
        res.json({ success: true, deletedCount: result.deletedCount || 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/zodiac-wheel/prizes/:id', authenticate, isAdmin, zodiacWheelRateLimit, requireValidObjectId('id'), async (req, res) => {
    try {
        await ZodiacWheelPrize.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 6. קהילה (COMMUNITY) =================

router.get('/community', async (req, res) => {
    try { res.json(await Community.find().sort({ createdAt: -1 })); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/community', authenticate, canManage(Community), async (req, res) => {
    try {
        const data = { ...req.body };
        if (data._id === '') delete data._id;
        res.json(await new Community(data).save());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/community/:id', authenticate, canManage(Community), async (req, res) => {
    try { res.json(await Community.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/community/:id', authenticate, canManage(Community), async (req, res) => {
    try { await Community.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 7. אשת השבוע (PERSONALITY) =================
// Flow: admin sends a questionnaire link → she fills it (status "submitted") → admin approves
// (status "published" + shown on the homepage). Published interviews stay in the public archive.

const personalityStatus = (p) => p.status || (p.externalToken ? 'awaiting' : 'published');
const PUBLISHED_FILTER = {
    isTemplate: { $ne: true },
    $or: [
        { status: 'published' },
        { status: { $exists: false }, $or: [{ externalToken: null }, { externalToken: { $exists: false } }] },
    ],
};
const withStatus = (doc) => { const o = doc.toObject ? doc.toObject() : doc; return { ...o, id: o._id, status: personalityStatus(o) }; };
const cleanText = (v, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cleanImage = (v) => (typeof v === 'string' && (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v) || /^https?:\/\//i.test(v)) ? v : undefined);
const cleanQuestions = (qs, base) => {
    if (!Array.isArray(qs)) return base || [];
    return qs.slice(0, 40).map((q, i) => ({
        question: cleanText(q?.question, 500) || cleanText(base?.[i]?.question, 500),
        answer: cleanText(q?.answer, 6000),
    })).filter(q => q.question);
};
const pickPersonalityFields = (body, base) => {
    const out = {};
    if (body.name !== undefined) out.name = cleanText(body.name, 120);
    if (body.role !== undefined) out.role = cleanText(body.role, 200);
    if (body.motto !== undefined) out.motto = cleanText(body.motto, 400);
    if (body.image !== undefined) { const img = cleanImage(body.image); out.image = img || ''; }
    if (body.questions !== undefined) out.questions = cleanQuestions(body.questions, base);
    return out;
};

// התבנית: השאלות הקבועות לשאלון
router.get('/personality/template', async (req, res) => {
    try {
        const template = await Personality.findOne({ isTemplate: true });
        res.json(template || { questions: [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/personality/template', authenticate, isAdmin, async (req, res) => {
    try {
        let template = await Personality.findOne({ isTemplate: true });
        const questions = cleanQuestions(req.body.questions).map(q => ({ question: q.question, answer: '' }));
        if (!template) template = new Personality({ isTemplate: true, isActive: false, questions });
        else { template.questions = questions; template.markModified('questions'); }
        await template.save();
        res.json(template);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// אשת השבוע שמוצגת בדף הבית: זו שהמנהלת בחרה, ואם אין — האחרונה שאושרה
router.get('/personality', async (req, res) => {
    try {
        let p = await Personality.findOne({ ...PUBLISHED_FILTER, isActive: true }).sort({ updatedAt: -1 });
        if (!p) p = await Personality.findOne(PUBLISHED_FILTER).sort({ publishedAt: -1, updatedAt: -1 });
        res.set('Cache-Control', 'public, max-age=60');
        res.json(p ? withStatus(p) : {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ארכיון ציבורי — רק ראיונות שאושרו
router.get('/personality/archive', async (req, res) => {
    try {
        const all = await Personality.find(PUBLISHED_FILTER).sort({ isActive: -1, publishedAt: -1, updatedAt: -1 });
        res.json(all.map(withStatus));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// עריכת אשת השבוע הנוכחית (תאימות לאחור לממשק הישן)
router.post('/personality', authenticate, isAdmin, async (req, res) => {
    try {
        let p = await Personality.findOne({ ...PUBLISHED_FILTER, isActive: true });
        if (!p) p = new Personality({ status: 'published', publishedAt: new Date(), isActive: true });
        Object.assign(p, pickPersonalityFields(req.body, p.questions), { updatedAt: Date.now() });
        await p.save();
        res.json(withStatus(p));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// יצירת לינק לשאלון
router.post('/personality/generate-link', authenticate, isAdmin, async (req, res) => {
    try {
        const token = crypto.randomBytes(16).toString('hex');
        let questions = cleanQuestions(req.body.questions);
        if (!questions.length) {
            const template = await Personality.findOne({ isTemplate: true });
            questions = (template?.questions || []).map(q => ({ question: q.question, answer: '' }));
        }
        const p = new Personality({
            name: cleanText(req.body.name, 120) || 'ממתין למילוי',
            role: '',
            questions: questions.map(q => ({ question: q.question, answer: '' })),
            externalToken: token,
            status: 'awaiting',
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
        res.json({ _id: p._id, name: p.name === 'ממתין למילוי' ? '' : p.name, role: p.role, motto: p.motto, questions: p.questions });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// היא שולחת את השאלון — נשמרים רק שדות התוכן; האישור נשאר בידי המנהלת
router.post('/personality/fill/:token', async (req, res) => {
    try {
        const p = await Personality.findOne({ externalToken: req.params.token });
        if (!p) return res.status(404).json({ error: 'Interview not found' });
        const fields = pickPersonalityFields(req.body, p.questions);
        if (!fields.name) return res.status(400).json({ error: 'חסר שם' });
        Object.assign(p, fields, { externalToken: null, status: 'submitted', isActive: false, updatedAt: Date.now() });
        await p.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ניהול ---
router.get('/admin/personality/all', authenticate, isAdmin, async (req, res) => {
    try {
        const all = await Personality.find({ isTemplate: { $ne: true } }).sort({ updatedAt: -1 });
        res.json(all.map(withStatus));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/personality/pending', authenticate, isAdmin, async (req, res) => {
    try {
        const pending = await Personality.find({ isTemplate: { $ne: true }, status: 'submitted' }).sort({ updatedAt: -1 });
        res.json(pending.map(withStatus));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// הוספה ידנית ע"י המנהלת (בלי שאלון)
router.post('/admin/personality', authenticate, isAdmin, async (req, res) => {
    try {
        const fields = pickPersonalityFields(req.body);
        if (!fields.name) return res.status(400).json({ error: 'חסר שם' });
        const publish = req.body.publish === true;
        if (publish) await Personality.updateMany({ isTemplate: { $ne: true } }, { isActive: false });
        const p = new Personality({ ...fields, isTemplate: false, status: publish ? 'published' : 'submitted', isActive: publish, publishedAt: publish ? new Date() : undefined });
        await p.save();
        res.json(withStatus(p));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/personality/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const p = await Personality.findById(req.params.id);
        if (!p || p.isTemplate) return res.status(404).json({ error: 'not found' });
        Object.assign(p, pickPersonalityFields(req.body, p.questions), { updatedAt: Date.now() });
        await p.save();
        res.json(withStatus(p));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// אישור + הצגה בדף הבית (אפשר גם להחזיר לדף הבית מישהי מהארכיון)
router.post('/admin/personality/approve/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const p = await Personality.findById(req.params.id);
        if (!p || p.isTemplate) return res.status(404).json({ error: 'not found' });
        if (personalityStatus(p) === 'awaiting') return res.status(400).json({ error: 'השאלון עוד לא מולא' });
        await Personality.updateMany({ isTemplate: { $ne: true } }, { isActive: false });
        p.status = 'published';
        p.isActive = true;
        if (!p.publishedAt) p.publishedAt = new Date();
        p.updatedAt = Date.now();
        await p.save();
        res.json({ success: true, personality: withStatus(p) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// הורדה מדף הבית (נשארת בארכיון)
router.post('/admin/personality/unfeature/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Personality.findByIdAndUpdate(req.params.id, { isActive: false });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/personality/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Personality.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ראיון בודד שאושר (לשיתוף / קישור ישיר מהארכיון)
router.get('/personality/item/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'not found' });
        const p = await Personality.findOne({ ...PUBLISHED_FILTER, _id: req.params.id });
        if (!p) return res.status(404).json({ error: 'not found' });
        res.json(withStatus(p));
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

// ---- פרסומות ----
const AD_PLACEMENTS = ['home-top', 'home-middle', 'home-bottom', 'events', 'classes', 'community'];
const cleanAd = (body) => {
    const d = { ...body };
    delete d._id; delete d.views; delete d.clicks; delete d.createdAt;
    if (Array.isArray(d.placements)) d.placements = d.placements.filter(x => AD_PLACEMENTS.includes(x));
    if (d.startsAt === '') d.startsAt = null;
    if (d.endsAt === '') d.endsAt = null;
    if (d.scope !== 'local') { d.city = undefined; d.region = undefined; }
    return d;
};

// public: only ads that are switched on and inside their dates
router.get('/ads', async (req, res) => {
    try {
        const now = new Date();
        const ads = await Ad.find({
            isActive: { $ne: false },
            $and: [
                { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
                { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
            ],
        }).select('-advertiserPhone').sort({ order: 1, createdAt: -1 });
        res.set('Cache-Control', 'public, max-age=60');
        res.json(ads);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// admin: everything, with stats
router.get('/admin/ads', authenticate, isAdmin, async (req, res) => {
    try { res.json(await Ad.find().sort({ order: 1, createdAt: -1 })); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ads', authenticate, isAdmin, async (req, res) => {
    try { res.json(await new Ad(cleanAd(req.body)).save()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/ads/:id', authenticate, isAdmin, async (req, res) => {
    try { res.json(await Ad.findByIdAndUpdate(req.params.id, cleanAd(req.body), { new: true })); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/ads/:id', authenticate, isAdmin, async (req, res) => {
    try { await Ad.findByIdAndDelete(req.params.id); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// view / click counters (anonymous; one view per ad per visit is enforced in the browser)
router.post('/ads/:id/:kind(view|click)', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).end();
        await Ad.updateOne({ _id: req.params.id }, { $inc: { [req.params.kind === 'view' ? 'views' : 'clicks']: 1 } });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= פליירים לדף הבית (FLYERS) =================
// The list never carries the (large, base64) images — each image is served from its own
// cacheable URL, so the homepage stays light no matter how many flyers there are.

const FLYER_LIST_FIELDS = '-image -mobileImage';
const flyerVersion = (f) => new Date(f.updatedAt || f.createdAt || 0).getTime();
const toPublicFlyer = (f) => ({
    _id: f._id,
    title: f.title,
    link: f.link,
    openInNewTab: f.openInNewTab,
    isActive: f.isActive,
    order: f.order,
    startsAt: f.startsAt,
    endsAt: f.endsAt,
    imageUrl: `/flyers/${f._id}/image?v=${flyerVersion(f)}`,
    mobileImageUrl: f.hasMobileImage ? `/flyers/${f._id}/image?variant=mobile&v=${flyerVersion(f)}` : null,
});
const withHasMobile = async (filter) => {
    const rows = await Flyer.aggregate([
        { $match: filter },
        { $addFields: { hasMobileImage: { $gt: [{ $strLenCP: { $ifNull: ['$mobileImage', ''] } }, 0] } } },
        { $project: { image: 0, mobileImage: 0 } },
        { $sort: { order: 1, createdAt: -1 } },
    ]);
    return rows;
};
const cleanFlyerInput = (body) => {
    const data = {};
    for (const k of ['title', 'image', 'mobileImage', 'link', 'openInNewTab', 'isActive', 'order', 'startsAt', 'endsAt']) {
        if (body[k] !== undefined) data[k] = body[k];
    }
    if (data.startsAt === '') data.startsAt = null;
    if (data.endsAt === '') data.endsAt = null;
    if (data.order !== undefined) data.order = Number(data.order) || 0;
    data.updatedAt = new Date();
    return data;
};

// Public: only active flyers inside their date window
router.get('/flyers', async (req, res) => {
    try {
        const now = new Date();
        const rows = await withHasMobile({
            isActive: true,
            $and: [
                { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
                { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
            ],
        });
        res.set('Cache-Control', 'public, max-age=60');
        res.json(rows.map(toPublicFlyer));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/flyers/:id/image', requireValidObjectId('id'), async (req, res) => {
    try {
        const f = await Flyer.findById(req.params.id).select('image mobileImage').lean();
        if (!f) return res.status(404).end();
        const src = (req.query.variant === 'mobile' && f.mobileImage) ? f.mobileImage : f.image;
        const m = /^data:([^;]+);base64,(.+)$/.exec(src || '');
        if (!m) return res.redirect(src); // stored as a plain URL
        res.set('Content-Type', m[1]);
        res.set('Cache-Control', 'public, max-age=31536000, immutable'); // URL carries ?v=<updatedAt>
        res.send(Buffer.from(m[2], 'base64'));
    } catch (err) { res.status(500).end(); }
});

// Admin: all flyers (including inactive / scheduled)
router.get('/admin/flyers', authenticate, isAdmin, async (req, res) => {
    try { res.json((await withHasMobile({})).map(toPublicFlyer)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/flyers', authenticate, isAdmin, async (req, res) => {
    try {
        const data = cleanFlyerInput(req.body);
        if (!data.image) return res.status(400).json({ error: 'חסרה תמונה לפלייר' });
        if (data.order === undefined) data.order = await Flyer.countDocuments();
        const saved = await new Flyer(data).save();
        res.status(201).json(toPublicFlyer({ ...saved.toObject(), hasMobileImage: !!saved.mobileImage }));
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/admin/flyers/:id', authenticate, isAdmin, requireValidObjectId('id'), async (req, res) => {
    try {
        const data = cleanFlyerInput(req.body);
        // Empty image string from the editor means "keep the current one"
        if (!data.image) delete data.image;
        const saved = await Flyer.findByIdAndUpdate(req.params.id, data, { new: true });
        if (!saved) return res.status(404).json({ error: 'not found' });
        res.json(toPublicFlyer({ ...saved.toObject(), hasMobileImage: !!saved.mobileImage }));
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/admin/flyers-order', authenticate, isAdmin, async (req, res) => {
    try {
        const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
        await Promise.all(ids.map((id, i) => mongoose.isValidObjectId(id) ? Flyer.updateOne({ _id: id }, { order: i }) : null));
        res.json({ success: true });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/admin/flyers/:id', authenticate, isAdmin, requireValidObjectId('id'), async (req, res) => {
    try { await Flyer.findByIdAndDelete(req.params.id); res.json({ success: true }); }
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
        const { age, occupation, address, phone, city, birthDate } = req.body || {};
        const fields = Object.fromEntries(Object.entries({ age, occupation, address, phone, city, birthDate }).filter(([, v]) => v !== undefined));
        const user = await User.findByIdAndUpdate(req.user.id, { ...fields, isMemberRequested: true, isMemberApproved: false }, { new: true }).select('-password -resetPasswordToken -resetPasswordExpires');
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
          נשלח באהבה מ"נשי" · קהילת נשים דתיות מכל הארץ
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

// main admin: all tickets · regional manager: tickets of local events in her region
const ticketManager = async (req, res, next) => {
    try {
        if (req.user?.isAdmin) { req.ticketScope = null; return next(); }
        const me = await User.findById(req.user?.id).select('role adminRegion isAdmin');
        if (me?.isAdmin) { req.ticketScope = null; return next(); }
        if (me?.role === 'regionAdmin' && me.adminRegion) { req.ticketScope = me.adminRegion; return next(); }
        res.status(403).json({ error: 'Admin access required' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const eventInScope = (ev, region) => !region || (ev && (ev.region || 'north') === region && (ev.scope || 'local') === 'local');

router.get('/admin/tickets', authenticate, ticketManager, async (req, res) => {
    try {
        const tickets = await Ticket.find().populate('eventId', 'title date location region scope city').sort({ createdAt: -1 });
        res.json(tickets.filter(t => eventInScope(t.eventId, req.ticketScope)));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/tickets', authenticate, ticketManager, async (req, res) => {
    try {
        if (req.ticketScope) {
            const ev = await Event.findById(req.body.eventId).select('region scope');
            if (!eventInScope(ev, req.ticketScope)) return res.status(403).json({ error: 'אפשר להנפיק כרטיסים רק לאירועים באזור שלך' });
        }
        const ticket = new Ticket(req.body);
        await ticket.save();
        res.status(201).json(ticket);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/tickets/:id', authenticate, ticketManager, async (req, res) => {
    try {
        const t = await Ticket.findById(req.params.id).populate('eventId', 'region scope');
        if (!t) return res.status(404).json({ error: 'not found' });
        if (!eventInScope(t.eventId, req.ticketScope)) return res.status(403).json({ error: 'not allowed' });
        await t.deleteOne();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// סריקת הברקוד (Scanner endpoint)
router.post('/admin/tickets/verify/:code', authenticate, ticketManager, async (req, res) => {
    try {
        const ticket = await Ticket.findOne({ code: req.params.code }).populate('eventId', 'title region scope');
        if (!ticket) return res.status(404).json({ error: 'כרטיס מזויף או לא קיים במערכת!' });
        if (!eventInScope(ticket.eventId, req.ticketScope)) return res.status(403).json({ error: 'הכרטיס שייך לאירוע באזור אחר' });

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

// מספרים ציבוריים להוכחה חברתית בדף הבית (מעוגלים)
router.get('/stats/public', async (req, res) => {
    try {
        const members = await User.countDocuments({});
        const cities = (await User.distinct('city')).filter(Boolean).length;
        res.set('Cache-Control', 'public, max-age=600');
        res.json({ members, cities: Math.max(cities, 1) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= 17. סטוריז (STORIES) =================

// שליפת סטוריז מאושרים (עבור דף הבית)
router.get('/stories', async (req, res) => {
    try {
        // שולפים רק סטוריז במצב "approved". (ה-TTL במונגו כבר דואג למחוק את מה שעבר 24 שעות)
        const stories = await Story.find({ status: 'approved' })
            .select('-viewedBy')
            .populate('user', 'name avatar') // מביאים את שם ותמונת המשתמשת
            .sort({ approvedAt: 1 }); // סידור מהישן לחדש (כמו בוואצפ)
        res.json(stories);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// העלאת סטורי חדש על ידי משתמשת (מחייב חיבור)
const STORY_BACKGROUNDS = ['rose', 'plum', 'sage', 'sunset', 'night', 'cream'];
router.post('/stories', authenticate, async (req, res) => {
    try {
        const type = req.body.type === 'image' ? 'image' : 'text';
        const content = typeof req.body.content === 'string' ? req.body.content : '';
        if (type === 'text' && (!content.trim() || content.length > 700)) return res.status(400).json({ error: 'הטקסט צריך להיות עד 700 תווים' });
        if (type === 'image' && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(content)) return res.status(400).json({ error: 'קובץ התמונה לא תקין' });
        if (type === 'image' && content.length > 7 * 1024 * 1024) return res.status(400).json({ error: 'התמונה גדולה מדי' });
        const recentPending = await Story.countDocuments({ user: req.user.id, status: 'pending' });
        if (recentPending >= 5) return res.status(429).json({ error: 'יש לך כבר 5 סטטוסים שממתינים לאישור' });
        const story = new Story({
            user: req.user.id,
            type,
            content: type === 'text' ? content.trim() : content,
            caption: typeof req.body.caption === 'string' ? req.body.caption.trim().slice(0, 300) : '',
            background: STORY_BACKGROUNDS.includes(req.body.background) ? req.body.background : '',
        });
        await story.save();
        res.status(201).json({ success: true, id: story._id, message: 'הסטטוס נשלח לאישור' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// הסטטוסים שלי (כולל אלה שממתינים לאישור)
router.get('/stories/mine', authenticate, async (req, res) => {
    try {
        const stories = await Story.find({ user: req.user.id }).select('-viewedBy').sort({ createdAt: -1 }).limit(20);
        res.json(stories);
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

// --- שיתוף סטורי: הקישור הישן מפנה לדף התצוגה החדש (/s/story/:id) ---
router.get('/stories/share/:id', (req, res) => {
    res.redirect(301, `/s/story/${encodeURIComponent(req.params.id)}`);
});

export default router;
