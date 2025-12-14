const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Event, Class, Lottery, Review, Personality } = require('./models');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_123'; 

// --- Middleware: Verify Token ---
const authenticate = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const verified = jwt.verify(token.split(' ')[1], JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid Token' });
  }
};

// --- AUTH ---
router.post('/register', async (req, res) => { 
  try {
    const { name, email, password, phone, address, communicationPref } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name, email, password: hashedPassword, phone, address, communicationPref,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
    });
    await user.save();
    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_SECRET);
    res.json({ token, user: { ...user.toObject(), id: user._id } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_SECRET);
    res.json({ token, user: { ...user.toObject(), id: user._id } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- EVENTS --- (שאר הראוטרים נשארו כפי שהיו)
router.get('/events', async (req, res) => {
  const events = await Event.find();
  res.json(events.map(e => ({ ...e.toObject(), id: e._id })));
});

router.post('/events', authenticate, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const event = new Event(req.body);
  await event.save();
  res.json({ ...event.toObject(), id: event._id });
});

router.put('/events/:id', authenticate, async (req, res) => {
    if (!req.user.isAdmin && !req.body.ratings) return res.status(403).json({ error: 'Admin only' });
    const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ ...updated.toObject(), id: updated._id });
});

router.delete('/events/:id', authenticate, async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// --- CLASSES ---
router.get('/classes', async (req, res) => {
  const classes = await Class.find();
  res.json(classes.map(c => ({ ...c.toObject(), id: c._id })));
});

router.post('/classes', authenticate, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const cls = new Class(req.body);
  await cls.save();
  res.json({ ...cls.toObject(), id: cls._id });
});

// --- LOTTERIES ---
router.get('/lotteries', async (req, res) => {
  const lotteries = await Lottery.find();
  res.json(lotteries.map(l => ({ ...l.toObject(), id: l._id })));
});

router.post('/lotteries', authenticate, async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const lottery = new Lottery(req.body);
    await lottery.save();
    res.json({ ...lottery.toObject(), id: lottery._id });
});

router.put('/lotteries/:id', authenticate, async (req, res) => {
    const updated = await Lottery.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ ...updated.toObject(), id: updated._id });
});

// --- USERS ---
router.put('/users/:id', authenticate, async (req, res) => {
    if (req.user.id !== req.params.id && !req.user.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
    
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ ...updated.toObject(), id: updated._id });
});

// --- DATA SEEDING (Dev helper) ---
router.post('/seed', async (req, res) => {
    res.send('Seeding implemented manually if needed');
});

module.exports = router;