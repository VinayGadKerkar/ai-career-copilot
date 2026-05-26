const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { parseJsonSafely } = require('../../utils/parseJsonSafely');
const { invokeGroq } = require('../../config/groq');

const FALLBACK = {
  behavioural: [],
  technical: [],
  situational: [],
  questionsToAsk: ['What does success look like in the first 90 days?'],
  keyThemesToEmphasize: []
};

/**
 * Generates targeted interview questions based on the resume and job description.
 * Returns behavioural, technical, and situational questions with guidance tips.
 */
const generateInterviewQuestions = async ({ resumeText, jobDescription, company, role }) => {
  const response = await invokeGroq([
    new SystemMessage(
      `You are an expert career coach and interviewer with 20+ years of experience.
      Generate realistic, targeted interview questions a hiring manager would actually ask.
      Return ONLY valid JSON — no markdown, no code fences, no explanation.`
    ),
    new HumanMessage(`Generate interview questions for this candidate applying to the role below.
    Focus on their specific experience and the gaps identified between their resume and the job description.

    CANDIDATE RESUME:
    ${resumeText}

    TARGET COMPANY: ${company}
    TARGET ROLE: ${role}

    JOB DESCRIPTION:
    ${jobDescription}

    Return this exact JSON structure (no markdown wrapping):
    {
      "behavioural": [
        {
          "question": "<STAR-based behavioural question>",
          "tip": "<what the interviewer is really looking for>",
          "hint": "<angle the candidate should take based on their resume>"
        }
      ],
      "technical": [
        {
          "question": "<role-specific technical question>",
          "tip": "<what a strong answer covers>",
          "difficulty": "<Easy|Medium|Hard>"
        }
      ],
      "situational": [
        {
          "question": "<hypothetical situational question>",
          "tip": "<ideal approach to answer this>"
        }
      ],
      "questionsToAsk": [
        "<smart question the candidate should ask the interviewer>"
      ],
      "keyThemesToEmphasize": [
        "<strength from resume to highlight throughout the interview>"
      ]
    }`)
  ], 'interview-prep', 0.6);

  const parsed = parseJsonSafely(response.content, FALLBACK);
  console.log(`🎤 generateInterviewQuestions: ${parsed.technical?.length ?? 0} technical questions`);
  return parsed;
};

module.exports = { generateInterviewQuestions };
