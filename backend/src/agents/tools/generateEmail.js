const { ChatGroq } = require('@langchain/groq');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7
});

const generateEmail = async ({ 
  resumeText, 
  jobDescription, 
  company, 
  role,
  tone = 'professional' 
}) => {
  const response = await llm.invoke([
    new SystemMessage(`You are an expert at writing cold outreach emails 
    for job applications. Write emails that are concise, specific, and 
    compelling. Never generic. Return ONLY valid JSON.`),

    new HumanMessage(`
    Write a cold outreach email for this job application.

    CANDIDATE RESUME:
    ${resumeText}

    TARGET COMPANY: ${company}
    TARGET ROLE: ${role}
    TONE: ${tone}

    JOB DESCRIPTION:
    ${jobDescription}

    Return this exact JSON:
    {
      "subject": "<compelling email subject line>",
      "body": "<full email body with \\n for line breaks>",
      "followUpSubject": "<subject for follow up after 1 week>",
      "followUpBody": "<short follow up email body>"
    }`)
  ]);

  try {
    const cleaned = response.content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse email generation response');
  }
};

module.exports = { generateEmail };