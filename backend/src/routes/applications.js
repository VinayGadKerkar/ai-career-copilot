const express = require('express');
const router = express.Router();
const {
  createApplication,
  getApplications,
  getApplication,
  updateApplicationStatus,
  deleteApplication,
  getAnalytics
} = require('../controllers/applicationController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/', createApplication);
router.get('/', getApplications);
router.get('/analytics', getAnalytics);   // ← before /:id
router.get('/:id', getApplication);
router.patch('/:id/status', updateApplicationStatus);
router.delete('/:id', deleteApplication);

module.exports = router;