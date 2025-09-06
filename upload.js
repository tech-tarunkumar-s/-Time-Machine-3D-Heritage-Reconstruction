const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(path.join(__dirname, '..', '..'));
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ? process.env.UPLOAD_DIR : path.join(PROJECT_ROOT, 'uploads'));

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create a unique subdirectory for each reconstruction job (ONCE per request)
    if (!req.jobId) {
      req.jobId = uuidv4();
    }
    const jobUploadDir = path.join(UPLOAD_DIR, req.jobId);
    fs.mkdirSync(jobUploadDir, { recursive: true });
    cb(null, jobUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname)); // Use unique filenames
  }
});

// Filter for image files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

module.exports = upload;
