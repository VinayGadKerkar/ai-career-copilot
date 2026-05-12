const { analyzeResume } = require('./tools/analyzeResume');
const { rewriteBullets } = require('./tools/rewriteBullets');
const { generateEmail } = require('./tools/generateEmail');
const { scoreFit } = require('./tools/scoreFit');

const runCareerAgent = async ({ 
  resumeText, 
  jobDescription, 
  company, 
  role,
  userId 
}) => {
  console.log(`🤖 Agent starting analysis for user: ${userId}`);
  const results = {};

  // Step 1 — Fast keyword score (no AI, instant)
  console.log('🔍 Step 1: Running keyword fit score...');
  const keywordResult = scoreFit({ resumeText, jobDescription });
  results.keywordScore = keywordResult;

  // Step 2 — Deep AI analysis
  console.log('🧠 Step 2: Running AI resume analysis...');
  const analysis = await analyzeResume({ resumeText, jobDescription });
  results.analysis = analysis;

  // Step 3 — Rewrite bullets using gaps from Step 2
  console.log('✍️  Step 3: Rewriting resume bullets...');
  const rewrite = await rewriteBullets({
    resumeText,
    jobDescription,
    missingSkills: analysis.missingSkills || []
  });
  results.rewrite = rewrite;

  // Step 4 — Generate cold email
  console.log('📧 Step 4: Generating cold email...');
  const email = await generateEmail({
    resumeText,
    jobDescription,
    company,
    role,
    tone: 'professional'
  });
  results.email = email;

  // Final — combine into one result
  const finalResult = {
    fitScore: analysis.fitScore,
    keywordScore: keywordResult.keywordScore,
    matchedSkills: analysis.matchedSkills,
    missingSkills: analysis.missingSkills,
    skillGaps: analysis.missingSkills,
    strongPoints: analysis.strongPoints,
    weakPoints: analysis.weakPoints,
    experienceMatch: analysis.experienceMatch,
    summary: analysis.summary,
    rewrittenBullets: rewrite.rewrittenBullets,
    newBulletsToAdd: rewrite.newBulletsToAdd,
    tipsForThisRole: rewrite.tipsForThisRole,
    coldEmail: email,
    processedAt: new Date().toISOString()
  };

  console.log(`✅ Agent complete. Fit score: ${finalResult.fitScore}/100`);
  return finalResult;
};

module.exports = { runCareerAgent };