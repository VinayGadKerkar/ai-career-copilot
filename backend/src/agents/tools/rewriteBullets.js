const { ChatGroq } = require('@langchain/groq');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.5
});

const rewriteBullets = async ({ resumeText, jobDescription, missingSkills }) => {
  const response = await llm.invoke([
    new SystemMessage(`You are an expert resume writer specializing in 
    backend engineering and software development roles.
    Rewrite resume bullets to be more impactful and relevant to the job.
    Use strong action verbs. Quantify where possible. Return ONLY valid JSON.`),

    new HumanMessage(`
    Rewrite the resume bullets to better match this job description.
    Focus especially on incorporating these missing skills where truthful: 
    ${missingSkills.join(', ')}

    ORIGINAL RESUME:
    ${resumeText}

    TARGET JOB DESCRIPTION:
    ${jobDescription}

    Return this exact JSON:
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
  ]);

  try {
    const cleaned = response.content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse bullet rewrite response');
  }
};

module.exports = { rewriteBullets };