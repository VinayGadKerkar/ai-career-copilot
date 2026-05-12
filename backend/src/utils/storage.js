const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const isProduction = process.env.NODE_ENV === 'production';

const s3 = isProduction ? new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
}) : null;

// Save a file (local or S3)
const saveFile = async (buffer, fileName, mimeType) => {
  if (isProduction) {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `resumes/${fileName}`,
      Body: buffer,
      ContentType: mimeType
    });
    await s3.send(command);
    return `resumes/${fileName}`;
  } else {
    const filePath = path.join(__dirname, '../../uploads', fileName);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }
};

// Get file content (local or S3)
const getFileBuffer = async (fileKey) => {
  if (isProduction) {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey
    });
    const response = await s3.send(command);
    const chunks = [];
    for await (const chunk of response.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  } else {
    return fs.readFileSync(fileKey);
  }
};

// Get a temporary download URL (S3 only)
const getSignedDownloadUrl = async (fileKey) => {
  if (!isProduction) return `/uploads/${path.basename(fileKey)}`;
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileKey
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
};

module.exports = { saveFile, getFileBuffer, getSignedDownloadUrl };