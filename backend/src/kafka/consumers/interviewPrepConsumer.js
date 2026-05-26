const TOPICS = require('../topics');
const { redis } = require('../../middleware/rateLimiter');
require('dotenv').config();

const kafka = require("../client");

const runInterviewPrepConsumer = async () => {
  const consumer = kafka.consumer({ 
    groupId: 'interview-prep-group' 
  });

  await consumer.connect();

  await Promise.all([
    consumer.subscribe({ topic: TOPICS.ANALYSIS_REQUESTED, fromBeginning: false }),
    consumer.subscribe({ topic: TOPICS.ANALYSIS_COMPLETE, fromBeginning: false })
  ]);

  console.log('👂 Interview prep consumer listening...');

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const payload = JSON.parse(message.value.toString());
      const { eventType, prepId, userId, applicationId, cacheHit } = payload;

      if (eventType !== 'interview-prep') {
        return;
      }

      if (topic === TOPICS.ANALYSIS_REQUESTED) {
        console.log(`📥 [INTERVIEW-PREP-REQ] Request received for prepId: ${prepId}, applicationId: ${applicationId}`);
        try {
          const cacheKey = `interview:prep:${userId}:${applicationId}`;
          const existing = await redis.exists(cacheKey);
          console.log(`   Cache hit: ${cacheHit}, Cache exists: ${existing === 1}`);
        } catch (error) {
          console.warn(`⚠️ [INTERVIEW-PREP-REQ] Redis check failed:`, error?.message);
        }
      } else if (topic === TOPICS.ANALYSIS_COMPLETE) {
        const { source: resultSource, questionCounts } = payload;
        console.log(`📥 [INTERVIEW-PREP-READY] Results ready for prepId: ${prepId}`);
        console.log(`   Source: ${resultSource}, Question counts:`, questionCounts);
        
        try {
          const cacheKey = `interview:prep:${userId}:${applicationId}`;
          if (resultSource === 'live') {
            const cached = await redis.get(cacheKey);
            if (cached) {
              console.log(`✅ [INTERVIEW-PREP-READY] Successfully cached prepId: ${prepId}`);
            }
          } else {
            console.log(`✅ [INTERVIEW-PREP-READY] Cache hit served for prepId: ${prepId}`);
          }
        } catch (error) {
          console.warn(`⚠️ [INTERVIEW-PREP-READY] Redis operation failed:`, error?.message);
        }
      }
    }
  });
};

module.exports = { runInterviewPrepConsumer };
