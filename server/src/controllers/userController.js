const { User } = require('../models');

const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({ order: [['createdAt', 'DESC']] });
    res.json(users);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const createUser = async (req, res) => {
  try {
    const { username, email, password, fullName, role, permissions } = req.body;
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({ message: 'כל השדות הנדרשים חסרים' });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) return res.status(409).json({ message: 'שם משתמש כבר קיים' });

    const user = await User.create({
      username, email, password, fullName,
      role: role || 'user',
      permissions: permissions || undefined,
    });

    res.status(201).json(user.toJSON());
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'שם משתמש או אימייל כבר קיים' });
    }
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });

    const { fullName, email, role, permissions, isActive, password } = req.body;
    const updates = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (permissions !== undefined) updates.permissions = permissions;
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) updates.password = password;

    await user.update(updates);
    res.json(user.toJSON());
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'לא ניתן למחוק את עצמך' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    await user.destroy();
    res.json({ message: 'משתמש נמחק' });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
