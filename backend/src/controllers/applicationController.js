const prisma = require('../utils/prismaClient');

// ─── Create Application ──────────────────────────────────
const createApplication = async (req, res) => {
  try {
    const { jobId, resumeId, notes } = req.body;

    if (!jobId || !resumeId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID and Resume ID are required'
      });
    }

    // Verify job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Verify resume belongs to user
    const resume = await prisma.resume.findFirst({
      where: { id: resumeId, userId: req.userId }
    });
    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    // Check if already applied
    const existing = await prisma.application.findFirst({
      where: { userId: req.userId, jobId }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You have already applied to this job'
      });
    }

    const application = await prisma.application.create({
      data: {
        userId:  req.userId,
        jobId,
        resumeId,
        notes:   notes || null,
        events: {
          create: {
            toStatus: 'APPLIED',
            note:     'Application created'
          }
        }
      },
      include: {
        job:    { select: { company: true, role: true } },
        resume: { select: { version: true, fileName: true } }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Application created successfully',
      data: { application }
    });

  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create application'
    });
  }
};

// ─── Get all applications for user ──────────────────────
const getApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userId: req.userId,
      ...(status && { status })
    };

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { appliedAt: 'desc' },
        include: {
          job: { select: { id: true, company: true, role: true } },
          resume: { select: { id: true, version: true, fileName: true, targetRole: true } }
        }
      }),
      prisma.application.count({ where })
    ]);

    // Analytics summary
    const statusCounts = await prisma.application.groupBy({
      by: ['status'],
      where: { userId: req.userId },
      _count: { status: true }
    });

    const summary = statusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.status;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        applications,
        summary,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications'
    });
  }
};

// ─── Get single application ──────────────────────────────
const getApplication = async (req, res) => {
  try {
    const application = await prisma.application.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      },
      include: {
        job: true,
        resume: {
          select: {
            id: true,
            version: true,
            fileName: true,
            targetRole: true,
            content: true
          }
        },
        events: {
          orderBy: { occurredAt: 'asc' }
        }
      }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { application }
    });

  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch application'
    });
  }
};

// ─── Update application status ───────────────────────────
const updateApplicationStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const validStatuses = [
      'APPLIED', 'RESPONDED', 'INTERVIEWING', 
      'OFFER', 'REJECTED', 'GHOSTED'
    ];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const application = await prisma.application.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Build event record if status is actually changing
    const statusChanging = status && status !== application.status;

    const updated = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        ...(status           && { status }),
        ...(notes !== undefined && { notes }),
        ...(statusChanging && {
          events: {
            create: {
              fromStatus: application.status,
              toStatus:   status,
              note:       `Status changed from ${application.status} to ${status}`
            }
          }
        })
      },
      include: {
        job:    { select: { company: true, role: true } },
        events: { orderBy: { occurredAt: 'asc' } }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Application updated successfully',
      data: { application: updated }
    });

  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update application'
    });
  }
};

// ─── Delete application ───────────────────────────────────
const deleteApplication = async (req, res) => {
  try {
    const application = await prisma.application.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    await prisma.application.delete({ where: { id: req.params.id } });

    res.status(200).json({
      success: true,
      message: 'Application deleted successfully'
    });

  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete application'
    });
  }
};

// ─── Analytics ───────────────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    const userId = req.userId;

    const [
      totalApplications,
      statusBreakdown,
      avgFitScore,
      topSkillGaps,
      recentActivity
    ] = await Promise.all([

      // Total count
      prisma.application.count({ where: { userId } }),

      // Status breakdown
      prisma.application.groupBy({
        by: ['status'],
        where: { userId },
        _count: { status: true }
      }),

      // Average fit score
      prisma.application.aggregate({
        where: { userId, fitScore: { not: null } },
        _avg: { fitScore: true }
      }),

      // Most common skill gaps across all applications
      prisma.application.findMany({
        where: { userId, skillGaps: { isEmpty: false } },
        select: { skillGaps: true }
      }),

      // Recent 5 applications
      prisma.application.findMany({
        where: { userId },
        take: 5,
        orderBy: { appliedAt: 'desc' },
        include: {
          job: { select: { company: true, role: true } }
        }
      })
    ]);

    // Flatten and count skill gaps
    const gapFrequency = {};
    topSkillGaps.forEach(app => {
      app.skillGaps.forEach(gap => {
        gapFrequency[gap] = (gapFrequency[gap] || 0) + 1;
      });
    });

    const sortedGaps = Object.entries(gapFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));

    // Response rate
    const responded = statusBreakdown
      .filter(s => ['RESPONDED', 'INTERVIEWING', 'OFFER'].includes(s.status))
      .reduce((sum, s) => sum + s._count.status, 0);

    const responseRate = totalApplications > 0
      ? Math.round((responded / totalApplications) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalApplications,
        responseRate: `${responseRate}%`,
        avgFitScore: Math.round(avgFitScore._avg.fitScore || 0),
        statusBreakdown: statusBreakdown.reduce((acc, curr) => {
          acc[curr.status] = curr._count.status;
          return acc;
        }, {}),
        topSkillGaps: sortedGaps,
        recentActivity
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
};

module.exports = {
  createApplication,
  getApplications,
  getApplication,
  updateApplicationStatus,
  deleteApplication,
  getAnalytics
};