const { Kafka } = require('kafkajs');
const TOPICS = require('../topics');
const prisma = require('../../utils/prismaClient');
require('dotenv').config();

const kafka = require("../client");

const runCompletionConsumer = async () => {
  const consumer = kafka.consumer({ 
    groupId: 'completion-group' 
  });

  await consumer.connect();
  await consumer.subscribe({ 
    topic: TOPICS.ANALYSIS_COMPLETE, 
    fromBeginning: true 
  });

  console.log('👂 Completion consumer listening...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = JSON.parse(message.value.toString());
      const { eventType, analysisJobId, jobId, result } = payload;

      if (eventType === 'interview-prep') {
        return;
      }

      if (!analysisJobId) {
        console.warn('⚠️ [COMPLETE] Missing analysisJobId in message. Skipping.');
        return;
      }

      console.log(`📥 [COMPLETE] Saving results for: ${analysisJobId}`);

      try {
        const existingJob = await prisma.analysisJob.findUnique({ where: { id: analysisJobId } });
        if (!existingJob) {
          console.warn(`⚠️ [COMPLETE] analysisJob ${analysisJobId} not found in DB. Skipping message.`);
          return;
        }

        // Save final result to analysisJob
        await prisma.analysisJob.update({
          where: { id: analysisJobId },
          data: {
            status: 'DONE',
            stage: 'complete',
            result
          }
        });

        // Update the linked application with fit score and gaps
        await prisma.application.updateMany({
          where: {
            userId: existingJob.userId,
            jobId
          },
          data: {
            fitScore: result.fitScore,
            skillGaps: result.skillGaps || [],
            tailoredResume: JSON.stringify(result.rewrittenBullets),
            coldEmail: result.coldEmail?.body || null
          }
        });

        console.log(`✅ [COMPLETE] Saved for: ${analysisJobId}`);

      } catch (error) {
        console.error(`❌ [COMPLETE] Error:`, error.message);
        try {
          await prisma.analysisJob.update({
            where: { id: analysisJobId },
            data: { 
              status: 'FAILED', 
              error: error.message 
            }
          });
        } catch (dbErr) {
          console.error(`❌ [COMPLETE] Failed to update job status:`, dbErr.message);
        }
      }
    }
  });
};

module.exports = { runCompletionConsumer };
