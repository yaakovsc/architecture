const { NavButton, NavSubject, NavField, NavFieldOption, NavResponse, System } = require('../models');

// ── Helpers ───────────────────────────────────────────────────────────────

const SUBJECT_INCLUDE = {
  model: NavSubject,
  as: 'subjects',
  order: [['displayOrder', 'ASC']],
  separate: true,
  include: [{
    model: NavField,
    as: 'fields',
    order: [['displayOrder', 'ASC']],
    separate: true,
    include: [{ model: NavFieldOption, as: 'options', order: [['displayOrder', 'ASC']], separate: true }],
  }],
};

// ── Config (user-facing, one call) ────────────────────────────────────────

const getConfig = async (req, res) => {
  try {
    const buttons = await NavButton.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['createdAt', 'ASC']],
      include: [SUBJECT_INCLUDE],
    });
    res.json(buttons);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

// ── Buttons ───────────────────────────────────────────────────────────────

const getButtons = async (req, res) => {
  try {
    const buttons = await NavButton.findAll({
      order: [['displayOrder', 'ASC'], ['createdAt', 'ASC']],
      include: [SUBJECT_INCLUDE],
    });
    res.json(buttons);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const createButton = async (req, res) => {
  try {
    const { name, type, icon, color, displayOrder } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'שם נדרש' });
    if (!type) return res.status(400).json({ message: 'סוג נדרש' });
    const button = await NavButton.create({ name: name.trim(), type, icon, color, displayOrder: displayOrder ?? 0 });
    // Auto-assign documentType = button UUID so each documents-button has a unique file bucket
    if (type === 'documents') {
      await button.update({ documentType: button.id });
    }
    res.status(201).json(button);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const updateButton = async (req, res) => {
  try {
    const button = await NavButton.findByPk(req.params.id);
    if (!button) return res.status(404).json({ message: 'כפתור לא נמצא' });
    const { name, type, icon, color, displayOrder, isActive } = req.body;
    if (name !== undefined && !name.trim()) return res.status(400).json({ message: 'שם נדרש' });
    const newType = type ?? button.type;
    await button.update({
      ...(name !== undefined && { name: name.trim() }),
      ...(type !== undefined && { type }),
      // Ensure documents buttons always have their UUID as documentType
      ...(newType === 'documents' && !button.documentType && { documentType: button.id }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
      ...(displayOrder !== undefined && { displayOrder }),
      ...(isActive !== undefined && { isActive }),
    });
    res.json(button);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const deleteButton = async (req, res) => {
  try {
    const button = await NavButton.findByPk(req.params.id);
    if (!button) return res.status(404).json({ message: 'כפתור לא נמצא' });
    await NavResponse.destroy({ where: { buttonId: button.id } });
    await button.destroy();
    res.json({ message: 'כפתור נמחק' });
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const reorderButtons = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: 'ids נדרש' });
    await Promise.all(ids.map((id, i) => NavButton.update({ displayOrder: i }, { where: { id } })));
    res.json({ message: 'סדר עודכן' });
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

// ── Subjects ──────────────────────────────────────────────────────────────

const getSubjects = async (req, res) => {
  try {
    const subjects = await NavSubject.findAll({
      where: { buttonId: req.params.buttonId },
      order: [['displayOrder', 'ASC']],
      include: [{
        model: NavField, as: 'fields',
        order: [['displayOrder', 'ASC']],
        include: [{ model: NavFieldOption, as: 'options', order: [['displayOrder', 'ASC']] }],
      }],
    });
    res.json(subjects);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const createSubject = async (req, res) => {
  try {
    const { buttonId, name, icon, displayOrder } = req.body;
    if (!buttonId) return res.status(400).json({ message: 'buttonId נדרש' });
    if (!name?.trim()) return res.status(400).json({ message: 'שם נדרש' });
    const button = await NavButton.findByPk(buttonId);
    if (!button) return res.status(404).json({ message: 'כפתור לא נמצא' });
    if (button.type !== 'questionnaire') return res.status(400).json({ message: 'נושאים שייכים לכפתורי שאלון בלבד' });
    const subject = await NavSubject.create({ buttonId, name: name.trim(), icon, displayOrder: displayOrder ?? 0 });
    res.status(201).json({ ...subject.toJSON(), fields: [] });
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const updateSubject = async (req, res) => {
  try {
    const subject = await NavSubject.findByPk(req.params.id);
    if (!subject) return res.status(404).json({ message: 'נושא לא נמצא' });
    const { name, icon, displayOrder } = req.body;
    if (name !== undefined && !name.trim()) return res.status(400).json({ message: 'שם נדרש' });
    await subject.update({
      ...(name !== undefined && { name: name.trim() }),
      ...(icon !== undefined && { icon }),
      ...(displayOrder !== undefined && { displayOrder }),
    });
    res.json(subject);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const deleteSubject = async (req, res) => {
  try {
    const subject = await NavSubject.findByPk(req.params.id);
    if (!subject) return res.status(404).json({ message: 'נושא לא נמצא' });
    await subject.destroy(); // cascades to fields + options
    res.json({ message: 'נושא נמחק' });
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const reorderSubjects = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: 'ids נדרש' });
    await Promise.all(ids.map((id, i) => NavSubject.update({ displayOrder: i }, { where: { id } })));
    res.json({ message: 'סדר עודכן' });
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

// ── Fields ────────────────────────────────────────────────────────────────

const _buildOptions = (options) =>
  (options || []).map((o, i) => ({
    label: typeof o === 'string' ? o : o.label,
    value: typeof o === 'string' ? o : (o.value ?? o.label),
    displayOrder: i,
  }));

const createField = async (req, res) => {
  try {
    const { subjectId, name, type, exampleValue, isRequired, isHoverText, displayOrder, options } = req.body;
    if (!subjectId) return res.status(400).json({ message: 'subjectId נדרש' });
    if (!name?.trim()) return res.status(400).json({ message: 'שם נדרש' });
    if (!type) return res.status(400).json({ message: 'סוג נדרש' });
    if ((type === 'select' || type === 'multi_value_select') && (!options || options.length === 0)) {
      return res.status(400).json({ message: 'שדה סוג בחירה חייב לכלול לפחות ערך אחד' });
    }
    // Only one field across all buttons can be the hover text source
    if (isHoverText) await NavField.update({ isHoverText: false }, { where: {} });
    const field = await NavField.create({
      subjectId, name: name.trim(), type,
      exampleValue, isRequired: isRequired ?? false,
      isHoverText: isHoverText ?? false,
      displayOrder: displayOrder ?? 0,
    });
    if (options?.length) {
      await NavFieldOption.bulkCreate(_buildOptions(options).map(o => ({ ...o, fieldId: field.id })));
    }
    const full = await NavField.findByPk(field.id, { include: [{ model: NavFieldOption, as: 'options', order: [['displayOrder', 'ASC']] }] });
    res.status(201).json(full);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const updateField = async (req, res) => {
  try {
    const field = await NavField.findByPk(req.params.id);
    if (!field) return res.status(404).json({ message: 'שדה לא נמצא' });
    const { name, type, exampleValue, isRequired, isHoverText, displayOrder, options } = req.body;
    if (name !== undefined && !name.trim()) return res.status(400).json({ message: 'שם נדרש' });
    const newType = type ?? field.type;
    if ((newType === 'select' || newType === 'multi_value_select') && options !== undefined && options.length === 0) {
      return res.status(400).json({ message: 'שדה סוג בחירה חייב לכלול לפחות ערך אחד' });
    }
    // Only one field can be the hover text source — clear others first
    if (isHoverText) await NavField.update({ isHoverText: false }, { where: {} });
    await field.update({
      ...(name !== undefined && { name: name.trim() }),
      ...(type !== undefined && { type }),
      ...(exampleValue !== undefined && { exampleValue }),
      ...(isRequired !== undefined && { isRequired }),
      ...(isHoverText !== undefined && { isHoverText }),
      ...(displayOrder !== undefined && { displayOrder }),
    });
    if (options !== undefined) {
      await NavFieldOption.destroy({ where: { fieldId: field.id } });
      if (options.length > 0) {
        await NavFieldOption.bulkCreate(_buildOptions(options).map(o => ({ ...o, fieldId: field.id })));
      }
    }
    const updated = await NavField.findByPk(field.id, { include: [{ model: NavFieldOption, as: 'options', order: [['displayOrder', 'ASC']] }] });
    res.json(updated);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const deleteField = async (req, res) => {
  try {
    const field = await NavField.findByPk(req.params.id);
    if (!field) return res.status(404).json({ message: 'שדה לא נמצא' });
    await field.destroy(); // cascades to options
    res.json({ message: 'שדה נמחק' });
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const reorderFields = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: 'ids נדרש' });
    await Promise.all(ids.map((id, i) => NavField.update({ displayOrder: i }, { where: { id } })));
    res.json({ message: 'סדר עודכן' });
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

// ── Responses ─────────────────────────────────────────────────────────────

const getResponse = async (req, res) => {
  try {
    const { systemId, buttonId } = req.params;
    const response = await NavResponse.findOne({ where: { systemId, buttonId } });
    res.json(response?.data ?? {});
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

const saveResponse = async (req, res) => {
  try {
    const { systemId, buttonId } = req.params;
    const { data } = req.body;
    if (!data || typeof data !== 'object') return res.status(400).json({ message: 'data נדרש' });
    const system = await System.findByPk(systemId);
    if (!system) return res.status(404).json({ message: 'מערכת לא נמצאה' });
    const button = await NavButton.findByPk(buttonId);
    if (!button) return res.status(404).json({ message: 'כפתור לא נמצא' });

    const existing = await NavResponse.findOne({ where: { systemId, buttonId } });
    if (existing) {
      await existing.update({ data, updatedBy: req.user.id });
    } else {
      await NavResponse.create({ systemId, buttonId, data, updatedBy: req.user.id });
    }
    res.json(data);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

// ── GET /nav/hover-texts ──────────────────────────────────────────────────
// Returns { [systemId]: string } — the hover text value for each system that
// has filled in the field marked as isHoverText, keyed by system UUID.
const getHoverTexts = async (req, res) => {
  try {
    const field = await NavField.findOne({ where: { isHoverText: true } });
    if (!field) return res.json({});
    const responses = await NavResponse.findAll({ where: {} });
    const result = {};
    for (const r of responses) {
      const val = r.data?.[field.id];
      if (val && String(val).trim()) result[r.systemId] = Array.isArray(val) ? val.join(', ') : String(val);
    }
    res.json(result);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
};

module.exports = {
  getConfig,
  getButtons, createButton, updateButton, deleteButton, reorderButtons,
  getSubjects, createSubject, updateSubject, deleteSubject, reorderSubjects,
  createField, updateField, deleteField, reorderFields,
  getResponse, saveResponse,
  getHoverTexts,
};
