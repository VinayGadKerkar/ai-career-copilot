const { analyzeResume } = require('./tools/analyzeResume');
const { rewriteBullets } = require('./tools/rewriteBullets');
const { generateEmail } = require('./tools/generateEmail');
const { scoreFit } = require('./tools/scoreFit');

/**
 * Runs the full career agent pipeline.
 * Each step is wrapped independently so a single LLM failure
 * (e.g. rate-limit on email generation) does NOT crash the entire job.
 */
const runCareerAgent = async ({
  resumeText,
  jobDescription,
  company,
  role,
  userId
}) => {
  console.log(`🤖 Agent starting analysis for user: ${userId}`);

  // ── Step 1: Fast keyword score (synchronous, never fails) ─────────────
  console.log('🔍 Step 1: Running keyword fit score...');
  const keywordResult = scoreFit({ resumeText, jobDescription });

  // ── Step 2: Deep AI analysis ───────────────────────────────────────────
  let analysis = {
    fitScore: keywordResult.keywordScore,
    matchedSkills: keywordResult.matchedKeywords,
    missingSkills: keywordResult.missingKeywords,
    strongPoints: [],
    weakPoints: [],
    experienceMatch: 'Fair',
    summary: 'AI analysis unavailable — keyword score used instead.'
  };
  try {
    console.log('🧠 Step 2: Running AI resume analysis...');
    analysis = await analyzeResume({ resumeText, jobDescription });
  } catch (err) {
    console.warn(`⚠️  analyzeResume failed (using keyword fallback): ${err.message}`);
  }

  // ── Step 3: Rewrite bullets ────────────────────────────────────────────
  let rewrite = { rewrittenBullets: [], newBulletsToAdd: [], tipsForThisRole: [] };
  try {
    console.log('✍️  Step 3: Rewriting resume bullets...');
    rewrite = await rewriteBullets({
      resumeText,
      jobDescription,
      missingSkills: analysis.missingSkills || []
    });
  } catch (err) {
    console.warn(`⚠️  rewriteBullets failed (skipping): ${err.message}`);
  }

  // ── Step 4: Generate cold email ────────────────────────────────────────
  let email = {
    subject: `Application for ${role} at ${company}`,
    body: `Hi,\n\nI am excited to apply for the ${role} position at ${company}. My background aligns well with your requirements and I would love to discuss further.\n\nBest regards`,
    followUpSubject: `Following up — ${role} at ${company}`,
    followUpBody: `Hi,\n\nJust following up on my application for the ${role} role. I remain very interested and would welcome a conversation.\n\nBest regards`
  };
  try {
    console.log('📧 Step 4: Generating cold email...');
    email = await generateEmail({ resumeText, jobDescription, company, role, tone: 'professional' });
  } catch (err) {
    console.warn(`⚠️  generateEmail failed (using template): ${err.message}`);
  }

  // ── Combine ────────────────────────────────────────────────────────────
  const finalResult = {
    fitScore:         analysis.fitScore,
    keywordScore:     keywordResult.keywordScore,
    matchedSkills:    analysis.matchedSkills,
    missingSkills:    analysis.missingSkills,
    skillGaps:        analysis.missingSkills,
    strongPoints:     analysis.strongPoints,
    weakPoints:       analysis.weakPoints,
    experienceMatch:  analysis.experienceMatch,
    summary:          analysis.summary,
    rewrittenBullets: rewrite.rewrittenBullets,
    newBulletsToAdd:  rewrite.newBulletsToAdd,
    tipsForThisRole:  rewrite.tipsForThisRole,
    coldEmail:        email,
    processedAt:      new Date().toISOString()
  };

  console.log(`✅ Agent complete. Fit score: ${finalResult.fitScore}/100`);
  return finalResult;
};

module.exports = { runCareerAgent };