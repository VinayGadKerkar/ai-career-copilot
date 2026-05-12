const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const extractTextFromPDF = async (filePath) => {
  try {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(__dirname, '../../', filePath);

    const buffer = fs.readFileSync(absolutePath);
    const data = await pdfParse(buffer);

    // Clean extracted text
    const cleanText = data.text
      .replace(/\n{3,}/g, '\n\n') // collapse excess newlines
      .replace(/\s{2,}/g, ' ')    // collapse excess spaces
      .trim();

    return {
      text: cleanText,
      pages: data.numpages,
      wordCount: cleanText.split(/\s+/).length
    };
  } catch (error) {
    console.error('PDF parse error:', error);
    throw new Error('Failed to parse PDF file');
  }
};

module.exports = { extractTextFromPDF };