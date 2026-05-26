const { Kafka } = require('kafkajs');

const kafka = require("./client");

const producer = kafka.producer();
let isConnected = false;

const connectProducer = async () => {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
    console.log('✅ Kafka producer connected');
  }
};

const publishEvent = async (topic, message) => {
  await connectProducer();
  await producer.send({
    topic,
    messages: [{
      key: message.userId || message.analysisJobId,
      value: JSON.stringify(message),
      timestamp: Date.now().toString()
    }]
  });
  console.log(`📤 Event published to [${topic}]`, { analysisJobId: message.analysisJobId });
};

const disconnectProducer = async () => {
  await producer.disconnect();
  isConnected = false;
};

module.exports = { publishEvent, disconnectProducer };