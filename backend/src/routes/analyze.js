const express = require('express');
const router = express.Router();
const { 
  startAnalysis, 
  getAnalysisStatus,
  getAnalysisHistory
} = require('../controllers/analyzeController');
const { authenticate } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

router.use(authenticate);

router.post('/', aiRateLimiter, startAnalysis);
router.get('/history', getAnalysisHistory);
router.get('/:id/status', getAnalysisStatus);

module.exports = router;