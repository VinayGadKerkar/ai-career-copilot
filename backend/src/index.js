const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { errorHandler } = require('./middleware/errorHandler');
const { createTopics } = require('./kafka/admin');
const { runResumeParserConsumer } = require('./kafka/consumers/resumeParserConsumer');
const { runAiAnalysisConsumer } = require('./kafka/consumers/aiAnalysisConsumer');
const { runCompletionConsumer } = require('./kafka/consumers/completionConsumer');
const { runInterviewPrepConsumer } = require('./kafka/consumers/interviewPrepConsumer');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AI Career Copilot API running',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/resume', require('./routes/resume'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/analyze', require('./routes/analyze'));
app.use('/api/interview', require('./routes/interview'));

app.use(errorHandler);

const start = async () => {
  try {
    // Create Kafka topics on startup (non-fatal)
    try {
      await createTopics();
    } catch (kafkaErr) {
      console.warn('⚠️  Kafka topics unavailable (non-fatal):', kafkaErr.message);
    }

    // Start consumers with automatic retry in the background
    const startWithRetry = async (consumerFn, name) => {
      while (true) {
        try {
          await consumerFn();
          break; // Success
        } catch (err) {
          console.warn(`⚠️  Failed to start ${name} consumer: ${err.message}. Retrying in 5s...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    };

    // Fire and forget so we don't block server startup
    startWithRetry(runResumeParserConsumer, 'Resume Parser');
    startWithRetry(runAiAnalysisConsumer, 'AI Analysis');
    startWithRetry(runCompletionConsumer, 'Completion');
    startWithRetry(runInterviewPrepConsumer, 'Interview Prep');

    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
