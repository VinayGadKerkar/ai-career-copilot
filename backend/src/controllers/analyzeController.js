const prisma = require('../utils/prismaClient');
const { publishEvent } = require('../kafka/producer');
const TOPICS = require('../kafka/topics');

// ─── Start analysis ──────────────────────────────────────
const startAnalysis = async (req, res) => {
  try {
    const { resumeId, jobId } = req.body;

    if (!resumeId || !jobId) {
      return res.status(400).json({
        success: false,
        message: 'resumeId and jobId are required'
      });
    }

    // Verify ownership
    const [resume, job] = await Promise.all([
      prisma.resume.findFirst({ 
        where: { id: resumeId, userId: req.userId } 
      }),
      prisma.job.findUnique({ where: { id: jobId } })
    ]);

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Create analysis job record
    const analysisJob = await prisma.analysisJob.create({
      data: {
        userId: req.userId,
        status: 'PENDING',
        stage: 'queued'
      }
    });

    // Publish to Kafka — returns immediately
    await publishEvent(TOPICS.ANALYSIS_REQUESTED, {
      analysisJobId: analysisJob.id,
      userId: req.userId,
      resumeId,
      jobId
    });

    // Return 202 Accepted — processing happens async
    res.status(202).json({
      success: true,
      message: 'Analysis started. Poll the status endpoint for results.',
      data: {
        analysisJobId: analysisJob.id,
        status: 'PENDING',
        pollUrl: `/api/analyze/${analysisJob.id}/status`
      }
    });

  } catch (error) {
    console.error('Start analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start analysis'
    });
  }
};

// ─── Poll status ─────────────────────────────────────────
const getAnalysisStatus = async (req, res) => {
  try {
    const analysisJob = await prisma.analysisJob.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!analysisJob) {
      return res.status(404).json({
        success: false,
        message: 'Analysis job not found'
      });
    }

    // Still processing
    if (analysisJob.status !== 'DONE' && analysisJob.status !== 'FAILED') {
      return res.status(200).json({
        success: true,
        data: {
          analysisJobId: analysisJob.id,
          status: analysisJob.status,
          stage: analysisJob.stage,
          message: getStageMessage(analysisJob.stage)
        }
      });
    }

    // Failed
    if (analysisJob.status === 'FAILED') {
      return res.status(200).json({
        success: false,
        data: {
          analysisJobId: analysisJob.id,
          status: 'FAILED',
          error: analysisJob.error
        }
      });
    }

    // Done — return full result
    res.status(200).json({
      success: true,
      data: {
        analysisJobId: analysisJob.id,
        status: 'DONE',
        result: analysisJob.result
      }
    });

  } catch (error) {
    console.error('Get analysis status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analysis status'
    });
  }
};

// ─── Get all analysis jobs for user ─────────────────────
const getAnalysisHistory = async (req, res) => {
  try {
    const jobs = await prisma.analysisJob.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        stage: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(200).json({
      success: true,
      data: { jobs }
    });

  } catch (error) {
    console.error('Get analysis history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analysis history'
    });
  }
};

const getStageMessage = (stage) => {
  const messages = {
    queued:    'Queued for processing...',
    parsing:   'Parsing resume and job description...',
    analyzing: 'AI agent analyzing your fit...',
    complete:  'Analysis complete!'
  };
  return messages[stage] || 'Processing...';
};

module.exports = { startAnalysis, getAnalysisStatus, getAnalysisHistory };