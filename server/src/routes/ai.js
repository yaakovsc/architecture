const router = require('express').Router();
const { authenticate, requirePermission, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/aiController');

// Ollama availability + queue status
router.get('/status', authenticate, c.getStatus);

// Per-system summary (status + content)
router.get('/summary/:systemKey', authenticate, requirePermission('systems', 'view'), c.getSystemSummary);

// Manually trigger system analysis
router.post('/analyze/:systemKey', authenticate, requirePermission('systems', 'view'), c.triggerAnalysis);

// Streaming chat (system-level)
router.post('/chat/:systemKey', authenticate, requirePermission('systems', 'view'), c.chatWithSystem);

// Enterprise summary
router.get('/enterprise/summary', authenticate, c.getEnterpriseSummary);

// Manually trigger enterprise analysis
router.post('/enterprise/analyze', authenticate, c.triggerEnterpriseAnalysis);

// Streaming enterprise chat
router.post('/enterprise/chat', authenticate, c.chatEnterprise);

// AI configuration (admin only)
router.get('/config', authenticate, requireAdmin, c.getConfig);
router.put('/config', authenticate, requireAdmin, c.updateConfig);

module.exports = router;
