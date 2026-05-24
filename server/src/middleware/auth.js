const { verifyAccessToken } = require('../utils/jwt');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'נדרשת הזדהות' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'משתמש לא פעיל' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'טוקן לא תקין' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'נדרשות הרשאות מנהל' });
  }
  next();
};

const requirePermission = (resource, action) => (req, res, next) => {
  const perms = req.user?.permissions;
  if (req.user?.role === 'admin') return next();
  if (perms?.[resource]?.[action]) return next();
  return res.status(403).json({ message: 'אין לך הרשאה לפעולה זו' });
};

module.exports = { authenticate, requireAdmin, requirePermission };
