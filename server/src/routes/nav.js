const router = require('express').Router();
const { authenticate, requireAdmin, requirePermission } = require('../middleware/auth');
const c = require('../controllers/navController');

// ── Config (user-facing) ──────────────────────────────────────────────────
router.get('/config', authenticate, c.getConfig);

// ── Buttons ───────────────────────────────────────────────────────────────
router.get('/buttons', authenticate, requirePermission('navigation', 'view'), c.getButtons);
router.post('/buttons', authenticate, requirePermission('navigation', 'edit'), c.createButton);
router.put('/buttons/reorder', authenticate, requirePermission('navigation', 'edit'), c.reorderButtons);
router.put('/buttons/:id', authenticate, requirePermission('navigation', 'edit'), c.updateButton);
router.delete('/buttons/:id', authenticate, requirePermission('navigation', 'delete'), c.deleteButton);

// ── Subjects ──────────────────────────────────────────────────────────────
router.get('/buttons/:buttonId/subjects', authenticate, requirePermission('navigation', 'view'), c.getSubjects);
router.post('/subjects', authenticate, requirePermission('navigation', 'edit'), c.createSubject);
router.put('/subjects/reorder', authenticate, requirePermission('navigation', 'edit'), c.reorderSubjects);
router.put('/subjects/:id', authenticate, requirePermission('navigation', 'edit'), c.updateSubject);
router.delete('/subjects/:id', authenticate, requirePermission('navigation', 'delete'), c.deleteSubject);

// ── Fields ────────────────────────────────────────────────────────────────
router.post('/fields', authenticate, requirePermission('navigation', 'edit'), c.createField);
router.put('/fields/reorder', authenticate, requirePermission('navigation', 'edit'), c.reorderFields);
router.put('/fields/:id', authenticate, requirePermission('navigation', 'edit'), c.updateField);
router.delete('/fields/:id', authenticate, requirePermission('navigation', 'delete'), c.deleteField);

// ── Hover texts (diagram tooltips) ────────────────────────────────────────
router.get('/hover-texts', authenticate, c.getHoverTexts);

// ── Responses ─────────────────────────────────────────────────────────────
router.get('/response/:systemId/:buttonId', authenticate, c.getResponse);
router.put('/response/:systemId/:buttonId', authenticate, requirePermission('systems', 'edit'), c.saveResponse);

module.exports = router;
