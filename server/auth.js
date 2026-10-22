import jwt from 'jsonwebtoken';
import { User } from './models.js';

// Same JWT as server/routes.js (login issues { id, isAdmin }).
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_123';

export const authenticate = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    req.user = jwt.verify(token.startsWith('Bearer ') ? token.slice(7) : token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid Token' }); }
};

/** Main admin (isAdmin) — checked against the database, not only the token. */
export const makeIsAdmin = (findUser = (id) => User.findById(id).select('isAdmin role adminRegion').lean()) => async (req, res, next) => {
  try {
    const me = req.user?.id ? await findUser(req.user.id) : null;
    if (!me?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    req.me = me;
    next();
  } catch (err) { res.status(500).json({ error: err.message }); }
};

/**
 * Culture managers = whoever the site treats as a manager: the main admin (isAdmin) and regional
 * culture managers (role 'regionAdmin', "מנהלת תרבות"). Everyone else gets 403.
 * `findUser` is injectable for tests.
 */
export const isCultureManagerUser = (u) => !!u && (u.isAdmin === true || u.role === 'regionAdmin');
export const makeCultureManager = (findUser = (id) => User.findById(id).select('isAdmin role adminRegion').lean()) => async (req, res, next) => {
  try {
    const me = req.user?.id ? await findUser(req.user.id) : null;
    if (!isCultureManagerUser(me)) return res.status(403).json({ error: 'האזור הזה פתוח למנהלות תרבות בלבד' });
    req.me = me;
    next();
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const isAdmin = makeIsAdmin();
export const cultureManager = makeCultureManager();
