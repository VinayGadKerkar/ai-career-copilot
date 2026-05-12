const { ChatGroq } = require('@langchain/groq');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.3
});

const analyzeResume = async ({ resumeText, jobDescription }) => {
  const response = await llm.invoke([
    new SystemMessage(`You are an expert resume analyzer and career coach. 
    Analyze resumes against job descriptions and return ONLY valid JSON.
    No markdown, no explanation, just the JSON object.`),

    new HumanMessage(`
    Analyze this resume against the job description.

    RESUME:
    ${resumeText}

    JOB DESCRIPTION:
    ${jobDescription}

    Return this exact JSON structure:
    {
      "fitScore": <number 0-100>,
      "matchedSkills": [<skills present in both resume and JD>],
      "missingSkills": [<skills in JD but missing from resume>],
      "strongPoints": [<2-3 things candidate does well for this role>],
      "weakPoints": [<2-3 gaps or concerns>],
      "experienceMatch": "<Excellent|Good|Fair|Poor>",
      "summary": "<2 sentence overall assessment>"
    }`)
  ]);

  try {
    const cleaned = response.content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse resume analysis response');
  }
};

module.exports = { analyzeResume };