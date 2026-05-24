const router = require('express').Router();
const {
  getSystems, getAllSystemsAdmin, getSystem,
  createSystem, updateSystem, deleteSystem, checkSystemData,
  upsertSystemData,
} = require('../controllers/systemController');
const { authenticate, requireAdmin, requirePermission } = require('../middleware/auth');

router.get('/', authenticate, getSystems);
router.get('/admin/all', authenticate, requireAdmin, getAllSystemsAdmin);
router.get('/:key', authenticate, getSystem);
router.post('/', authenticate, requireAdmin, createSystem);
router.put('/:id', authenticate, requireAdmin, updateSystem);
router.get('/:id/check', authenticate, requireAdmin, checkSystemData);
router.delete('/:id', authenticate, requireAdmin, deleteSystem);
router.put('/:key/data', authenticate, requirePermission('systems', 'edit'), upsertSystemData);

module.exports = router;
