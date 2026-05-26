const kafka = require('./client');
const TOPICS = require('./topics');

/**
 * Attempt to create Kafka topics using the admin client.
 * On Aiven (and most managed Kafka services), topics are auto-created
 * when consumers first subscribe, so this step is best-effort only.
 *
 * If the admin connection times out (common on first cold-start),
 * we log a warning and continue — the consumers will still work.
 */
const createTopics = async () => {
  const admin = kafka.admin();

  // Short timeout for admin — don't block server startup
  const connectPromise = admin.connect();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Admin connect timeout after 8s')), 8000)
  );

  try {
    await Promise.race([connectPromise, timeoutPromise]);
  } catch (err) {
    // Admin connection timed out — topics will be auto-created by Aiven
    console.warn('⚠️  Kafka admin connect timed out — topics will be auto-created by broker on first use.');
    return;
  }

  try {
    const topicList = Object.values(TOPICS).map(topic => ({
      topic,
      numPartitions: 1,
      replicationFactor: 3   // Aiven requires replicationFactor ≥ 3 on paid plans
    }));

    const created = await admin.createTopics({
      topics: topicList,
      waitForLeaders: false,  // don't wait — reduces timeout risk
    });

    if (created) {
      console.log('✅ Kafka topics created:', Object.values(TOPICS).join(', '));
    } else {
      console.log('ℹ️  Kafka topics already exist:', Object.values(TOPICS).join(', '));
    }
  } catch (err) {
    // Topics may already exist or broker doesn't allow manual creation
    if (err.message && err.message.includes('already exists')) {
      console.log('ℹ️  Kafka topics already exist (OK)');
    } else {
      console.warn('⚠️  Could not create Kafka topics:', err.message, '— proceeding anyway');
    }
  } finally {
    try { await admin.disconnect(); } catch (_) {}
  }
};

module.exports = { createTopics };