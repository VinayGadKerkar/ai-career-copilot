const { Kafka } = require('kafkajs');
const TOPICS = require('../topics');
const prisma = require('../../utils/prismaClient');
require('dotenv').config();

const kafka = new Kafka({
  clientId: 'completion-consumer',
  brokers: [process.env.KAFKA_BROKER]
});

const runCompletionConsumer = async () => {
  const consumer = kafka.consumer({ 
    groupId: 'completion-group' 
  });

  await consumer.connect();
  await consumer.subscribe({ 
    topic: TOPICS.ANALYSIS_COMPLETE, 
    fromBeginning: false 
  });

  console.log('👂 Completion consumer listening...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = JSON.parse(message.value.toString());
      const { analysisJobId, jobId, result } = payload;

      console.log(`📥 [COMPLETE] Saving results for: ${analysisJobId}`);

      try {
        // Save final result to analysisJob
        await prisma.analysisJob.update({
          where: { id: analysisJobId },
          data: {
            status: 'DONE',
            stage: 'complete',
            result
          }
        });

        // Find the application and update with AI results
        const analysisJob = await prisma.analysisJob.findUnique({
          where: { id: analysisJobId }
        });

        // Update the linked application with fit score and gaps
        await prisma.application.updateMany({
          where: {
            userId: analysisJob.userId,
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
        await prisma.analysisJob.update({
          where: { id: analysisJobId },
          data: { 
            status: 'FAILED', 
            error: error.message 
          }
        });
      }
    }
  });
};

module.exports = { runCompletionConsumer };