const { Kafka } = require('kafkajs');
const { publishEvent } = require('../producer');
const TOPICS = require('../topics');
const prisma = require('../../utils/prismaClient');
const { runCareerAgent } = require('../../agents/careerAgent');
require('dotenv').config();

const kafka = require("../client");

const runAiAnalysisConsumer = async () => {
  const consumer = kafka.consumer({ 
    groupId: 'ai-analysis-group' 
  });

  await consumer.connect();
  await consumer.subscribe({ 
    topic: TOPICS.RESUME_PARSED, 
    fromBeginning: true 
  });

  console.log('👂 AI analysis consumer listening...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = JSON.parse(message.value.toString());
      const { 
        analysisJobId, userId, resumeId, jobId,
        resumeText, jobDescription, company, role 
      } = payload;

      console.log(`📥 [AI] Processing analysisJob: ${analysisJobId}`);

      try {
        const existingJob = await prisma.analysisJob.findUnique({ where: { id: analysisJobId } });
        if (!existingJob) {
          console.warn(`⚠️ [AI] analysisJob ${analysisJobId} not found in DB. Skipping message.`);
          return;
        }

        await prisma.analysisJob.update({
          where: { id: analysisJobId },
          data: { stage: 'analyzing' }
        });

        // Run the full agent pipeline
        const result = await runCareerAgent({
          resumeText,
          jobDescription,
          company,
          role,
          userId
        });

        // Publish to completion stage
        await publishEvent(TOPICS.ANALYSIS_COMPLETE, {
          analysisJobId,
          userId,
          resumeId,
          jobId,
          result
        });

        console.log(`✅ [AI] Done for: ${analysisJobId}`);

      } catch (error) {
        console.error(`❌ [AI] Error:`, error.message);
        try {
          await prisma.analysisJob.update({
            where: { id: analysisJobId },
            data: { 
              status: 'FAILED', 
              error: error.message,
              stage: 'analyzing'
            }
          });
        } catch (dbErr) {
          console.error(`❌ [AI] Failed to update job status:`, dbErr.message);
        }
      }
    }
  });
};

module.exports = { runAiAnalysisConsumer };