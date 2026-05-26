const { Kafka } = require("kafkajs");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID,

  brokers: [process.env.KAFKA_BROKER],

  ssl: {
    ca: [
      fs.readFileSync(
        path.join(__dirname, "../../certs/ca.pem"),
        "utf-8"
      ),
    ],
    rejectUnauthorized: true,
  },

  sasl: {
    mechanism: "plain",
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },

  retry: {
    retries: 8,
  },
});

module.exports = kafka;