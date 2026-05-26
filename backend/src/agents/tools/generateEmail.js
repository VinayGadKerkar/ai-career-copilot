const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { parseJsonSafely } = require('../../utils/parseJsonSafely');
const { invokeGroq } = require('../../config/groq');

const FALLBACK = {
  subject: 'Application for Role',
  body: 'Hi,\n\nI am interested in this role and believe my background is a strong match. I would love to connect.\n\nBest regards',
  followUpSubject: 'Following up on my application',
  followUpBody: 'Hi,\n\nI wanted to follow up on my application sent last week. I remain very interested in the role.\n\nBest regards'
};

const generateEmail = async ({
  resumeText,
  jobDescription,
  company,
  role,
  tone = 'professional'
}) => {
  const response = await invokeGroq([
    new SystemMessage(
      `You are an expert at writing cold outreach emails for job applications.
      Write emails that are concise, specific, and compelling. Never generic.
      Return ONLY valid JSON — no markdown, no code fences, no explanation.`
    ),
    new HumanMessage(`
    Write a cold outreach email for this job application.

    CANDIDATE RESUME:
    ${resumeText}

    TARGET COMPANY: ${company}
    TARGET ROLE: ${role}
    TONE: ${tone}

    JOB DESCRIPTION:
    ${jobDescription}

    Return this exact JSON (no markdown wrapping):
    {
      "subject": "<compelling email subject line>",
      "body": "<full email body with \\n for line breaks>",
      "followUpSubject": "<subject for follow up after 1 week>",
      "followUpBody": "<short follow up email body>"
    }`)
  ], 'email', 0.7);

  const parsed = parseJsonSafely(response.content, FALLBACK);
  console.log(`📧 generateEmail subject: ${parsed.subject}`);
  return parsed;
};

module.exports = { generateEmail };