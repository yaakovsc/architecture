const { User } = require('../models');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'שם משתמש וסיסמה נדרשים' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'שם משתמש או סיסמה שגויים' });
    }

    const valid = await user.validatePassword(password);
    if (!valid) {
      return res.status(401).json({ message: 'שם משתמש או סיסמה שגויים' });
    }

    const payload = { id: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await user.update({ refreshToken });

    res.json({
      accessToken,
      refreshToken,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'טוקן רענון נדרש' });

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findByPk(decoded.id);

    if (!user || user.refreshToken !== refreshToken || !user.isActive) {
      return res.status(401).json({ message: 'טוקן לא תקין' });
    }

    const payload = { id: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    await user.update({ refreshToken: newRefreshToken });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ message: 'טוקן לא תקין' });
  }
};

const logout = async (req, res) => {
  try {
    await req.user.update({ refreshToken: null });
    res.json({ message: 'התנתקת בהצלחה' });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const me = (req, res) => {
  res.json({ user: req.user.toJSON() });
};

module.exports = { login, refresh, logout, me };
