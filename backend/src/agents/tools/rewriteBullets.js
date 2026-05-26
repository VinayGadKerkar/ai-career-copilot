const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { parseJsonSafely } = require('../../utils/parseJsonSafely');
const { invokeGroq } = require('../../config/groq');

const FALLBACK = {
  rewrittenBullets: [],
  newBulletsToAdd: [],
  tipsForThisRole: ['Tailor your resume bullets to mirror keywords from the job description.']
};

const rewriteBullets = async ({ resumeText, jobDescription, missingSkills }) => {
  const response = await invokeGroq([
    new SystemMessage(
      `You are an expert resume writer specializing in backend engineering and software development roles.
      Rewrite resume bullets to be more impactful and relevant to the job.
      Use strong action verbs. Quantify where possible.
      Return ONLY valid JSON — no markdown, no code fences, no explanation.`
    ),
    new HumanMessage(`
    Rewrite the resume bullets to better match this job description.
    Focus especially on incorporating these missing skills where truthful:
    ${(missingSkills || []).join(', ')}

    ORIGINAL RESUME:
    ${resumeText}

    TARGET JOB DESCRIPTION:
    ${jobDescription}

    Return this exact JSON (no markdown wrapping):
    {
      "rewrittenBullets": [
        {
          "original": "<original bullet point>",
          "rewritten": "<improved version>",
          "reason": "<why this change helps>"
        }
      ],
      "newBulletsToAdd": [
        "<suggested new bullet if candidate likely has this experience>"
      ],
      "tipsForThisRole": [
        "<specific tip for this job application>"
      ]
    }`)
  ], 'bullet-rewrite', 0.7);

  const parsed = parseJsonSafely(response.content, FALLBACK);
  console.log(`✍️  rewriteBullets count: ${parsed.rewrittenBullets?.length ?? 0}`);
  return parsed;
};

module.exports = { rewriteBullets };