const prisma = require('../utils/prismaClient');
const { extractTextFromPDF } = require('../utils/pdfParser');
const { saveFile, getSignedDownloadUrl } = require('../utils/storage');
const fs = require('fs');
const path = require('path');

// ─── Upload Resume ───────────────────────────────────────
const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a PDF file'
      });
    }

    const { targetRole } = req.body;

    // Extract text from PDF
    const { text, pages, wordCount } = await extractTextFromPDF(req.file.path);

    if (!text || text.length < 50) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Could not extract text from PDF. Make sure it is not a scanned image.'
      });
    }

    // Get version number for this user
    const existingResumes = await prisma.resume.count({
      where: { userId: req.userId }
    });

    // In production save to S3, locally keep on disk
    let fileKey = req.file.path;
    if (process.env.NODE_ENV === 'production') {
      const buffer = fs.readFileSync(req.file.path);
      fileKey = await saveFile(buffer, req.file.filename, 'application/pdf');
      fs.unlinkSync(req.file.path); // remove local copy
    }

    // Save resume record to DB
    const resume = await prisma.resume.create({
      data: {
        userId: req.userId,
        version: existingResumes + 1,
        fileName: req.file.originalname,
        content: text,
        targetRole: targetRole || null,
        fileKey
      }
    });

    res.status(201).json({
      success: true,
      message: 'Resume uploaded and parsed successfully',
      data: {
        resume: {
          id: resume.id,
          version: resume.version,
          fileName: resume.fileName,
          targetRole: resume.targetRole,
          wordCount,
          pages,
          createdAt: resume.createdAt
        }
      }
    });

  } catch (error) {
    // Clean up file if error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Upload resume error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload resume'
    });
  }
};

// ─── Get all resumes for user ────────────────────────────
const getResumes = async (req, res) => {
  try {
    const resumes = await prisma.resume.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        fileName: true,
        targetRole: true,
        createdAt: true,
        _count: { select: { applications: true } }
      }
    });

    res.status(200).json({
      success: true,
      data: { resumes }
    });

  } catch (error) {
    console.error('Get resumes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resumes'
    });
  }
};

// ─── Get single resume with content ─────────────────────
const getResume = async (req, res) => {
  try {
    const resume = await prisma.resume.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId   // ensure user owns it
      }
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    // Get download URL
    const downloadUrl = await getSignedDownloadUrl(resume.fileKey);

    res.status(200).json({
      success: true,
      data: {
        resume: {
          id: resume.id,
          version: resume.version,
          fileName: resume.fileName,
          targetRole: resume.targetRole,
          content: resume.content,
          downloadUrl,
          createdAt: resume.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Get resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resume'
    });
  }
};

// ─── Delete resume ───────────────────────────────────────
const deleteResume = async (req, res) => {
  try {
    const resume = await prisma.resume.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    // Delete local file if exists
    if (
      process.env.NODE_ENV !== 'production' && 
      fs.existsSync(resume.fileKey)
    ) {
      fs.unlinkSync(resume.fileKey);
    }

    await prisma.resume.delete({ where: { id: resume.id } });

    res.status(200).json({
      success: true,
      message: 'Resume deleted successfully'
    });

  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete resume'
    });
  }
};

module.exports = { uploadResume, getResumes, getResume, deleteResume };