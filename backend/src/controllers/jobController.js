const prisma = require('../utils/prismaClient');

// ─── Create Job ──────────────────────────────────────────
const createJob = async (req, res) => {
  try {
    const { company, role, description } = req.body;

    if (!company || !role || !description) {
      return res.status(400).json({
        success: false,
        message: 'Company, role and description are required'
      });
    }

    if (description.length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Job description is too short. Paste the full JD for better AI analysis.'
      });
    }

    const job = await prisma.job.create({
      data: { company, role, description }
    });

    res.status(201).json({
      success: true,
      message: 'Job added successfully',
      data: { job }
    });

  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create job'
    });
  }
};

// ─── Get all jobs ────────────────────────────────────────
const getJobs = async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? {
          OR: [
            { company: { contains: search, mode: 'insensitive' } },
            { role: { contains: search, mode: 'insensitive' } }
          ]
        }
      : {};

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { applications: true } }
        }
      }),
      prisma.job.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        jobs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs'
    });
  }
};

// ─── Get single job ──────────────────────────────────────
const getJob = async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { applications: true } }
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { job }
    });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job'
    });
  }
};

// ─── Update job ──────────────────────────────────────────
const updateJob = async (req, res) => {
  try {
    const { company, role, description } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: req.params.id }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        company: company || job.company,
        role: role || job.role,
        description: description || job.description
      }
    });

    res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      data: { job: updated }
    });

  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job'
    });
  }
};

// ─── Delete job ──────────────────────────────────────────
const deleteJob = async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    await prisma.job.delete({ where: { id: req.params.id } });

    res.status(200).json({
      success: true,
      message: 'Job deleted successfully'
    });

  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete job'
    });
  }
};

module.exports = { createJob, getJobs, getJob, updateJob, deleteJob };