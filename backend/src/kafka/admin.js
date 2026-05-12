const { Kafka } = require('kafkajs');
const TOPICS = require('./topics');

const kafka = new Kafka({
  clientId: 'admin-client',
  brokers: [process.env.KAFKA_BROKER]
});

const createTopics = async () => {
  const admin = kafka.admin();
  await admin.connect();

  const topicList = Object.values(TOPICS).map(topic => ({
    topic,
    numPartitions: 1,
    replicationFactor: 1
  }));

  await admin.createTopics({
    topics: topicList,
    waitForLeaders: true
  });

  console.log('✅ Kafka topics created:', Object.values(TOPICS));
  await admin.disconnect();
};

module.exports = { createTopics };