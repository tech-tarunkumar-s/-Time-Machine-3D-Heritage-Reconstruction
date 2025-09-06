const express = require('express');
const router = express.Router();
const reconstructionController = require('../controllers/reconstructionController');
const upload = require('../middleware/upload');

// Route for initiating a new reconstruction by uploading images
router.post('/process', upload.array('images'), reconstructionController.startReconstruction);

// Route for getting the status of a reconstruction job
router.get('/status/:jobId', reconstructionController.getReconstructionStatus);

// Route for getting the result of a completed reconstruction
router.get('/result/:jobId', reconstructionController.getReconstructionResult);

module.exports = router;
