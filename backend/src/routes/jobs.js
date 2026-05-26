const express = require('express');
const router = express.Router();
const {
  createJob, getJobs, getJob, updateJob, deleteJob,
  searchExternalJobs, importExternalJob
} = require('../controllers/jobController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/',           getJobs);
router.get('/search',     searchExternalJobs);    // GET /api/jobs/search?query=&location=
router.post('/import',    importExternalJob);      // POST /api/jobs/import
router.post('/',          createJob);
router.get('/:id',        getJob);
router.put('/:id',        updateJob);
router.delete('/:id',     deleteJob);

module.exports = router;