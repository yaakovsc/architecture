const router = require('express').Router();
const { upload, getDiagrams, uploadDiagram, deleteDiagram, serveDiagram } = require('../controllers/diagramController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.get('/:id/file', authenticate, serveDiagram);
router.get('/:key/:type', authenticate, getDiagrams);
router.post('/:key/:type', authenticate, requirePermission('diagrams', 'edit'), upload.single('file'), uploadDiagram);
router.delete('/:id', authenticate, requirePermission('diagrams', 'delete'), deleteDiagram);

module.exports = router;
