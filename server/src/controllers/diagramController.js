const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Diagram, System } = require('../models');
const { enqueue } = require('../workers/analysisQueue');
require('dotenv').config();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(process.env.UPLOAD_DIR || 'src/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Re-encode from latin1 → utf8 (Node/multer reads multipart filenames as latin1)
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'application/pdf',
    'application/xml', 'text/xml', 'application/vnd.jgraph.mxfile',
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('סוג קובץ לא נתמך'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
});

const getDiagrams = async (req, res) => {
  try {
    const system = await System.findOne({ where: { key: req.params.key } });
    if (!system) return res.status(404).json({ message: 'מערכת לא נמצאה' });

    const diagrams = await Diagram.findAll({
      where: { systemId: system.id, type: req.params.type, isActive: true },
      order: [['createdAt', 'DESC']],
    });
    res.json(diagrams);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const uploadDiagram = async (req, res) => {
  try {
    const system = await System.findOne({ where: { key: req.params.key } });
    if (!system) return res.status(404).json({ message: 'מערכת לא נמצאה' });

    if (!req.file) return res.status(400).json({ message: 'קובץ נדרש' });

    const diagram = await Diagram.create({
      systemId: system.id,
      type: req.params.type,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user.id,
    });
    res.status(201).json(diagram);

    // Trigger background analysis (fire-and-forget, non-blocking)
    if (diagram.mimetype?.startsWith('image/')) {
      enqueue(system.id);
    }
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const deleteDiagram = async (req, res) => {
  try {
    const diagram = await Diagram.findByPk(req.params.id);
    if (!diagram) return res.status(404).json({ message: 'דיאגרמה לא נמצאה' });

    const filePath = path.resolve(process.env.UPLOAD_DIR || 'src/uploads', diagram.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const { systemId, mimetype } = diagram;
    await diagram.destroy();
    res.json({ message: 'דיאגרמה נמחקה' });

    // Re-analyse after deletion so the report stays current
    if (mimetype?.startsWith('image/')) enqueue(systemId);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const serveDiagram = async (req, res) => {
  try {
    const diagram = await Diagram.findByPk(req.params.id);
    if (!diagram) return res.status(404).json({ message: 'דיאגרמה לא נמצאה' });

    const filePath = path.resolve(process.env.UPLOAD_DIR || 'src/uploads', diagram.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'קובץ לא נמצא' });

    res.sendFile(filePath);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

module.exports = { upload, getDiagrams, uploadDiagram, deleteDiagram, serveDiagram };
