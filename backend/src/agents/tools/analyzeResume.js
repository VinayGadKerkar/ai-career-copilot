const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { parseJsonSafely } = require('../../utils/parseJsonSafely');
const { invokeGroq } = require('../../config/groq');

const FALLBACK = {
  fitScore: 50,
  matchedSkills: [],
  missingSkills: [],
  strongPoints: ['Could not analyze — try again'],
  weakPoints: [],
  experienceMatch: 'Fair',
  summary: 'AI analysis unavailable right now. Please retry.'
};

const analyzeResume = async ({ resumeText, jobDescription }) => {
  const response = await invokeGroq([
    new SystemMessage(
      `You are an expert resume analyzer and career coach.
      Analyze resumes against job descriptions and return ONLY valid JSON.
      No markdown, no explanation, no code fences — just the raw JSON object.`
    ),
    new HumanMessage(`
    Analyze this resume against the job description.

    RESUME:
    ${resumeText}

    JOB DESCRIPTION:
    ${jobDescription}

    Return this exact JSON structure (no markdown wrapping):
    {
      "fitScore": <number 0-100>,
      "matchedSkills": [<skills present in both resume and JD>],
      "missingSkills": [<skills in JD but missing from resume>],
      "strongPoints": [<2-3 things candidate does well for this role>],
      "weakPoints": [<2-3 gaps or concerns>],
      "experienceMatch": "<Excellent|Good|Fair|Poor>",
      "summary": "<2 sentence overall assessment>"
    }`)
  ], 'resume-analysis', 0.3);

  const parsed = parseJsonSafely(response.content, FALLBACK);
  console.log(`🧠 analyzeResume fitScore: ${parsed.fitScore}`);
  return parsed;
};

module.exports = { analyzeResume };