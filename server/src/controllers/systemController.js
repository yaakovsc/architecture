const { System, SystemData, Diagram } = require('../models');
const { Op } = require('sequelize');

// For users: only active systems
const getSystems = async (req, res) => {
  try {
    const where = req.user.role === 'admin' ? {} : { status: 'active' };
    const systems = await System.findAll({
      where,
      include: [{ model: SystemData, as: 'data' }],
      order: [['displayOrder', 'ASC']],
    });
    res.json(systems);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// All systems for admin (with data count flags)
const getAllSystemsAdmin = async (req, res) => {
  try {
    const systems = await System.findAll({
      include: [{ model: SystemData, as: 'data' }],
      order: [['displayOrder', 'ASC']],
    });

    // Attach hasData flag
    const result = await Promise.all(systems.map(async (s) => {
      const diagCount = await Diagram.count({ where: { systemId: s.id } });
      const hasData = !!s.data || diagCount > 0;
      return { ...s.toJSON(), hasData, diagramCount: diagCount };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const getSystem = async (req, res) => {
  try {
    const system = await System.findOne({
      where: { key: req.params.key },
      include: [{ model: SystemData, as: 'data' }],
    });
    if (!system) return res.status(404).json({ message: 'מערכת לא נמצאה' });
    res.json(system);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const createSystem = async (req, res) => {
  try {
    const { name, posX, posY, width, height } = req.body;
    if (!name || posX == null || posY == null || width == null || height == null) {
      return res.status(400).json({ message: 'שם ומיקום נדרשים' });
    }

    // Generate unique key from name
    const base = name.replace(/\s+/g, '-').replace(/[^\w-]/g, '') || 'system';
    let key = base;
    let suffix = 1;
    while (await System.findOne({ where: { key } })) {
      key = `${base}-${suffix++}`;
    }

    const maxOrder = await System.max('displayOrder') || 0;
    const system = await System.create({
      key, name, posX, posY, width, height,
      status: 'active',
      displayOrder: maxOrder + 1,
    });
    res.status(201).json(system);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const updateSystem = async (req, res) => {
  try {
    const system = await System.findByPk(req.params.id);
    if (!system) return res.status(404).json({ message: 'מערכת לא נמצאה' });

    const allowed = ['name', 'posX', 'posY', 'width', 'height', 'status', 'displayOrder'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await system.update(updates);
    res.json(system);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const checkSystemData = async (req, res) => {
  try {
    const system = await System.findByPk(req.params.id);
    if (!system) return res.status(404).json({ message: 'מערכת לא נמצאה' });

    const hasSystemData = !!(await SystemData.findOne({ where: { systemId: system.id } }));
    const diagramCount = await Diagram.count({ where: { systemId: system.id } });

    res.json({ hasData: hasSystemData || diagramCount > 0, hasSystemData, diagramCount });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const deleteSystem = async (req, res) => {
  try {
    const system = await System.findByPk(req.params.id);
    if (!system) return res.status(404).json({ message: 'מערכת לא נמצאה' });

    // Cascade delete related data
    await SystemData.destroy({ where: { systemId: system.id } });

    const diagrams = await Diagram.findAll({ where: { systemId: system.id } });
    const fs = require('fs');
    const path = require('path');
    for (const d of diagrams) {
      const filePath = path.resolve(process.env.UPLOAD_DIR || 'src/uploads', d.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await Diagram.destroy({ where: { systemId: system.id } });

    await system.destroy();
    res.json({ message: 'מערכת נמחקה' });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const upsertSystemData = async (req, res) => {
  try {
    const system = await System.findOne({ where: { key: req.params.key } });
    if (!system) return res.status(404).json({ message: 'מערכת לא נמצאה' });

    const dataPayload = { ...req.body, systemId: system.id, lastUpdatedBy: req.user.id };
    const [data] = await SystemData.upsert(dataPayload, { returning: true });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

module.exports = {
  getSystems, getAllSystemsAdmin, getSystem,
  createSystem, updateSystem, deleteSystem, checkSystemData,
  upsertSystemData,
};
