const express = require('express');
const router = express.Router();
const { 
  uploadResume, 
  getResumes, 
  getResume, 
  deleteResume 
} = require('../controllers/resumeController');
const { authenticate } = require('../middleware/auth');
const { uploadRateLimiter } = require('../middleware/rateLimiter');
const upload = require('../utils/multer');

// All resume routes require auth
router.use(authenticate);

router.post(
  '/upload',
  uploadRateLimiter,
  upload.single('resume'),  // 'resume' is the form field name
  uploadResume
);

router.get('/', getResumes);
router.get('/:id', getResume);
router.delete('/:id', deleteResume);

module.exports = router;