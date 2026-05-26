const express = require('express');
const router = express.Router();
const { prepInterview } = require('../controllers/interviewController');
const { authenticate } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

router.use(authenticate);

// POST /api/interview/prep — generate interview questions for an application
router.post('/prep', aiRateLimiter, prepInterview);

module.exports = router;
