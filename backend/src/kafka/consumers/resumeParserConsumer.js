const { Kafka } = require('kafkajs');
const { publishEvent } = require('../producer');
const TOPICS = require('../topics');
const prisma = require('../../utils/prismaClient');
require('dotenv').config();

const kafka = require("../client");

const runResumeParserConsumer = async () => {
  const consumer = kafka.consumer({ 
    groupId: 'resume-parser-group' 
  });

  await consumer.connect();
  await consumer.subscribe({ 
    topic: TOPICS.ANALYSIS_REQUESTED, 
    fromBeginning: true 
  });

  console.log('👂 Resume parser consumer listening...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = JSON.parse(message.value.toString());
      const { eventType, analysisJobId, resumeId, jobId, userId } = payload;

      if (eventType === 'interview-prep') {
        return;
      }

      if (!analysisJobId) {
        console.warn('⚠️ [PARSER] Missing analysisJobId in message. Skipping.');
        return;
      }

      console.log(`📥 [PARSER] Processing analysisJob: ${analysisJobId}`);

      try {
        // Verify job exists first to avoid crash loops on invalid messages
        const existingJob = await prisma.analysisJob.findUnique({ where: { id: analysisJobId } });
        if (!existingJob) {
          console.warn(`⚠️ [PARSER] analysisJob ${analysisJobId} not found in DB. Skipping message.`);
          return; // Return safely to advance the Kafka offset
        }

        // Update status to PROCESSING
        await prisma.analysisJob.update({
          where: { id: analysisJobId },
          data: { status: 'PROCESSING', stage: 'parsing' }
        });

        // Get resume and job from DB
        const [resume, job] = await Promise.all([
          prisma.resume.findUnique({ where: { id: resumeId } }),
          prisma.job.findUnique({ where: { id: jobId } })
        ]);

        if (!resume || !job) {
          throw new Error('Resume or job not found');
        }

        // Publish to next stage
        await publishEvent(TOPICS.RESUME_PARSED, {
          analysisJobId,
          userId,
          resumeId,
          jobId,
          resumeText: resume.content,
          jobDescription: job.description,
          company: job.company,
          role: job.role
        });

        console.log(`✅ [PARSER] Done for: ${analysisJobId}`);

      } catch (error) {
        console.error(`❌ [PARSER] Error:`, error.message);
        try {
          await prisma.analysisJob.update({
            where: { id: analysisJobId },
            data: { 
              status: 'FAILED', 
              error: error.message,
              stage: 'parsing'
            }
          });
        } catch (dbErr) {
          console.error(`❌ [PARSER] Failed to update job status:`, dbErr.message);
        }
      }
    }
  });
};

module.exports = { runResumeParserConsumer };
