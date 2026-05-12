const { Kafka } = require('kafkajs');
const { publishEvent } = require('../producer');
const TOPICS = require('../topics');
const prisma = require('../../utils/prismaClient');
require('dotenv').config();

const kafka = new Kafka({
  clientId: 'resume-parser-consumer',
  brokers: [process.env.KAFKA_BROKER]
});

const runResumeParserConsumer = async () => {
  const consumer = kafka.consumer({ 
    groupId: 'resume-parser-group' 
  });

  await consumer.connect();
  await consumer.subscribe({ 
    topic: TOPICS.ANALYSIS_REQUESTED, 
    fromBeginning: false 
  });

  console.log('👂 Resume parser consumer listening...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = JSON.parse(message.value.toString());
      const { analysisJobId, resumeId, jobId, userId } = payload;

      console.log(`📥 [PARSER] Processing analysisJob: ${analysisJobId}`);

      try {
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
        await prisma.analysisJob.update({
          where: { id: analysisJobId },
          data: { 
            status: 'FAILED', 
            error: error.message,
            stage: 'parsing'
          }
        });
      }
    }
  });
};

module.exports = { runResumeParserConsumer };