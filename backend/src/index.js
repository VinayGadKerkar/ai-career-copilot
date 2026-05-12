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

app.use(errorHandler);

const start = async () => {
  try {
    // Create Kafka topics on startup
    await createTopics();

    // Start all consumers
    await Promise.all([
      runResumeParserConsumer(),
      runAiAnalysisConsumer(),
      runCompletionConsumer()
    ]);

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