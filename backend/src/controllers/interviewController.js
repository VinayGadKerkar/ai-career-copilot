const { randomUUID } = require('crypto');
const prisma = require('../utils/prismaClient');
const { generateInterviewQuestions } = require('../agents/tools/generateInterviewQuestions');
const { getQuestionsForCompany } = require('../services/dsaQuestionService');
const { redis } = require('../middleware/rateLimiter');
const { publishEvent } = require('../kafka/producer');
const TOPICS = require('../kafka/topics');
const { trimText } = require('../config/groq');

const INTERVIEW_PREP_CACHE_TTL_SECONDS = Number(
  process.env.INTERVIEW_PREP_CACHE_TTL_SECONDS || 3600
);

const buildCacheKey = (userId, applicationId) =>
  `interview:prep:${userId}:${applicationId}`;

const getQuestionCounts = (questions) => ({
  behavioural: Array.isArray(questions?.behavioural)
    ? questions.behavioural.length
    : 0,
  technical: Array.isArray(questions?.technical)
    ? questions.technical.length
    : 0,
  situational: Array.isArray(questions?.situational)
    ? questions.situational.length
    : 0,
  questionsToAsk: Array.isArray(questions?.questionsToAsk)
    ? questions.questionsToAsk.length
    : 0,
  keyThemesToEmphasize: Array.isArray(questions?.keyThemesToEmphasize)
    ? questions.keyThemesToEmphasize.length
    : 0
});

const safePublishEvent = async (topic, payload) => {
  try {
    await publishEvent(topic, payload);
  } catch (error) {
    console.warn(
      `⚠️ Kafka publish failed for ${topic}:`,
      error?.message || error
    );
  }
};

// ─── Generate interview prep questions ───────────────────
const prepInterview = async (req, res) => {
  try {
    const { applicationId, forceRefresh } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'applicationId is required'
      });
    }

    // Fetch application with resume content and job description
    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId: req.userId },
      include: {
        resume: { select: { content: true } },
        job:    { select: { company: true, role: true, description: true } }
      }
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const { company, role, description } = application.job;
    const resumeContent = application.resume?.content;

    if (!resumeContent || !description) {
      return res.status(400).json({
        success: false,
        message: 'Resume content and job description are required'
      });
    }

    const cacheKey = buildCacheKey(req.userId, applicationId);
    let cachedPayload = null;

    if (!forceRefresh) {
      try {
        const cachedRaw = await redis.get(cacheKey);
        cachedPayload = cachedRaw ? JSON.parse(cachedRaw) : null;
      } catch (error) {
        console.error('Interview prep cache read error:', error);
      }
    }

    const prepId = cachedPayload?.prepId || randomUUID();
    const requestEventPayload = {
      eventType: 'interview-prep',
      prepId,
      applicationId,
      userId: req.userId,
      company,
      role,
      cacheHit: Boolean(cachedPayload),
      forceRefresh: Boolean(forceRefresh)
    };

    void safePublishEvent(TOPICS.ANALYSIS_REQUESTED, requestEventPayload);

    if (cachedPayload) {
      const generatedAtMs = cachedPayload.generatedAt
        ? new Date(cachedPayload.generatedAt).getTime()
        : NaN;
      const cacheAgeSeconds = Number.isFinite(generatedAtMs)
        ? Math.max(0, Math.floor((Date.now() - generatedAtMs) / 1000))
        : null;

      void safePublishEvent(TOPICS.ANALYSIS_COMPLETE, {
        ...requestEventPayload,
        source: 'cache',
        questionCounts: cachedPayload.questionCounts || {}
      });

      return res.status(200).json({
        success: true,
        data: {
          ...cachedPayload,
          source: 'cache',
          cacheHit: true,
          cacheAgeSeconds
        }
      });
    }

    // Run AI question generation + DSA question lookup in parallel
    const [questions, dsaResult] = await Promise.all([
      generateInterviewQuestions({
        resumeText:     trimText(resumeContent),
        jobDescription: trimText(description),
        company,
        role
      }),
      Promise.resolve(getQuestionsForCompany(company))
    ]);

    const questionCounts = getQuestionCounts(questions);
    const generatedAt = new Date().toISOString();

    const payload = {
      prepId,
      applicationId,
      company,
      role,
      questions,
      dsaQuestions: dsaResult.questions,
      dsaCompanyMatch: dsaResult.found ? dsaResult.company : null,
      questionCounts,
      generatedAt
    };

    try {
      await redis.set(
        cacheKey,
        JSON.stringify(payload),
        'EX',
        INTERVIEW_PREP_CACHE_TTL_SECONDS
      );
    } catch (error) {
      console.error('Interview prep cache write error:', error);
    }

    void safePublishEvent(TOPICS.ANALYSIS_COMPLETE, {
      ...requestEventPayload,
      source: 'live',
      questionCounts
    });

    res.status(200).json({
      success: true,
      data: {
        ...payload,
        source: 'live',
        cacheHit: false
      }
    });

  } catch (error) {
    console.error('Interview prep error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate interview questions' });
  }
};

module.exports = { prepInterview };
