const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Event, Class, Lottery, Review, Personality } = require('./models'); // <--- זה הנתיב הנכון!

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
router.post('/register', async (req, res) => { // <--- מתוקן ל-/register
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

router.post('/login', async (req, res) => { // <--- מתוקן ל-/login
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

// --- שאר הראוטרים... ---

module.exports = router;