const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { exec } = require('child_process');
const {
  saveReconstruction,
  getReconstructionById,
  updateReconstructionStatus,
  getReconstructions,
  updateReconstruction,
  deleteReconstruction
} = require('../utils/dbUtils');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fsSync.existsSync(uploadsDir)) {
  fsSync.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const typeDir = path.join(uploadsDir, file.fieldname === 'model3d' ? 'models' : 'images');
    if (!fsSync.existsSync(typeDir)) {
      fsSync.mkdirSync(typeDir, { recursive: true });
    }
    cb(null, typeDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter for multer
const fileFilter = (req, file, cb) => {
  const imageTypes = /jpe?g|png|gif|webp/;
  const modelTypes = /obj|glb|gltf|fbx/;
  const ext = path.extname(file.originalname).toLowerCase().substring(1);
  
  if (file.fieldname === 'images' && imageTypes.test(ext)) {
    return cb(null, true);
  }
  
  if (file.fieldname === 'model3d' && modelTypes.test(ext)) {
    return cb(null, true);
  }
  
  cb(new Error(`Invalid file type for ${file.fieldname}. Images: ${imageTypes}, Models: ${modelTypes}`));
};

// Configure multer with error handling
const upload = multer({
  storage,
  limits: { 
    fileSize: 500 * 1024 * 1024, // 500MB per file
    files: 11 // 10 images + 1 model
  },
  fileFilter
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'model3d', maxCount: 1 }
]);

// Middleware to handle multer errors
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      return res.status(400).json({
        success: false,
        error: {
          message: 'File upload error',
          details: err.message
        }
      });
    } else if (err) {
      // An unknown error occurred
      return res.status(400).json({
        success: false,
        error: {
          message: 'File upload failed',
          details: err.message
        }
      });
    }
    next();
  });
};

// Create a new reconstruction with file uploads
router.post('/', handleUpload, async (req, res, next) => {
  try {
    const { title, description, location } = req.body;
    const images = req.files?.images || [];
    const model3d = req.files?.model3d?.[0];

    if (!title || !description) {
      throw new Error('Title and description are required');
    }

    if (images.length === 0) {
      throw new Error('At least one image is required');
    }

    const reconstructionData = {
      title,
      description,
      status: 'pending',
      images: images.map(file => ({
      //  url: `/uploads/images/${path.basename(file.path)}`,  // 👈 Public URL
        path: file.path,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        dimensions: file.dimensions
      })),
      model3d: model3d ? {
        path: model3d.path,
        originalName: model3d.originalname,
        size: model3d.size,
        mimetype: model3d.mimetype
      } : null,
      processingStats: {
        startTime: new Date(),
        status: 'uploaded',
        progress: 0
      }
    };

    // Parse location if provided
    if (location) {
      try {
        const [lat, lng] = location.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          reconstructionData.location = {
            type: 'Point',
            coordinates: [lng, lat] // GeoJSON uses [longitude, latitude]
          };
        }
      } catch (e) {
        console.warn('Invalid location format, skipping');
      }
    }
    
    const reconstruction = await saveReconstruction(reconstructionData);
    
    res.status(201).json({
      success: true,
      data: {
        id: reconstruction._id,
        title: reconstruction.title,
        status: reconstruction.status,
        createdAt: reconstruction.createdAt
      },
      message: 'Reconstruction created successfully'
    });
  } catch (error) {
    // Clean up uploaded files if there was an error
    if (req.files) {
      const files = [...(req.files.images || []), ...(req.files.model3d || [])];
      await Promise.all(
        files.map(file => 
          fs.unlink(file.path).catch(console.error)
        )
      );
    }
    next(error);
  }
});

// Get all reconstructions with pagination
router.get('/', async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      search,
      sort = '-createdAt'
    } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const result = await getReconstructions({
      page: Math.max(1, parseInt(page)),
      limit: Math.min(50, Math.max(1, parseInt(limit))),
      filter,
      sort
    });
    
    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

// Get a single reconstruction by ID
router.get('/:id', async (req, res, next) => {
  try {
    const reconstruction = await getReconstructionById(req.params.id);
    
    if (!reconstruction) {
      return res.status(404).json({
        success: false,
        error: 'Reconstruction not found'
      });
    }
    
    res.json({
      success: true,
      data: reconstruction
    });
  } catch (error) {
    next(error);
  }
});

// Route to start the reconstruction process
router.post('/:id/reconstruct', async (req, res, next) => {
  try {
    const reconstruction = await getReconstructionById(req.params.id);
    if (!reconstruction) {
      return res.status(404).json({ success: false, error: 'Reconstruction not found' });
    }

    // --- IMPORTANT ---
    // These paths need to be configured correctly for your environment.
    // In production, these should come from environment variables.
    const pythonExecutable = path.resolve(__dirname, '../../../ml/venv/Scripts/python.exe');
    const scriptPath = path.resolve(__dirname, '../../../ml/run_meshroom.py');
    // This path will be provided by the user after Meshroom is installed.
    const meshroomExecutable = "D:\\colmap\\Meshroom-2025.1.0-Windows\\Meshroom-2025.1.0\\meshroom_batch.exe";

    // Find the directory where images for this reconstruction are stored.
    const imageDir = reconstruction.images[0] ? path.dirname(reconstruction.images[0].path) : null;
    if (!imageDir) {
        return res.status(400).json({ success: false, error: 'No images found for this reconstruction.' });
    }
    
    // Define a unique output directory for this reconstruction job
    const outputDir = path.resolve(uploadsDir, 'results', reconstruction._id.toString());
    await fs.mkdir(outputDir, { recursive: true });

    const command = `"${pythonExecutable}" "${scriptPath}" --images "${imageDir}" --output "${outputDir}" --meshroom_executable "${meshroomExecutable}"`;

    console.log(`Executing command: ${command}`);

    // Execute the command as a background process
    const child = exec(command);

    child.stdout.on('data', (data) => {
      console.log(`[Meshroom stdout]: ${data}`);
      // TODO: Update reconstruction progress via websockets or another mechanism
    });

    child.stderr.on('data', (data) => {
      console.error(`[Meshroom stderr]: ${data}`);
    });

    child.on('close', (code) => {
      console.log(`Meshroom process exited with code ${code}`);
      if (code === 0) {
        updateReconstructionStatus(req.params.id, 'completed', { 
          'processingStats.progress': 100,
          'processingStats.message': 'Meshroom pipeline finished successfully.'
        });
      } else {
        updateReconstructionStatus(req.params.id, 'failed', {
          'processingStats.message': `Meshroom pipeline failed with exit code ${code}.`
        });
      }
    });
    
    // Update status to 'processing'
    await updateReconstructionStatus(req.params.id, 'processing', { 
      'processingStats.progress': 5,
      'processingStats.message': 'Meshroom pipeline started.'
    });

    // Immediately respond to the client
    res.status(202).json({ 
      success: true, 
      message: 'Reconstruction process started.',
      reconstructionId: req.params.id
    });

  } catch (error) {
    next(error);
  }
});

// Update reconstruction
router.put('/:id', handleUpload, async (req, res, next) => {
  try {
    const { title, description, location } = req.body;
    const updates = {};
    
    if (title) updates.title = title;
    if (description) updates.description = description;
    
    // Handle file updates
    if (req.files?.images?.length) {
      updates.images = req.files.images.map(file => ({
        path: file.path,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }));
    }
    
    if (req.files?.model3d?.[0]) {
      const model3d = req.files.model3d[0];
      updates.model3d = {
        path: model3d.path,
        originalName: model3d.originalname,
        size: model3d.size,
        mimetype: model3d.mimetype
      };
    }
    
    // Handle location update
    if (location) {
      try {
        const [lat, lng] = location.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          updates.location = {
            type: 'Point',
            coordinates: [lng, lat]
          };
        }
      } catch (e) {
        console.warn('Invalid location format, skipping');
      }
    }
    
    const updated = await updateReconstruction(req.params.id, updates);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Reconstruction not found'
      });
    }
    
    res.json({
      success: true,
      data: updated,
      message: 'Reconstruction updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Update reconstruction status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, progress, message } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }
    
    const updates = {};
    if (progress !== undefined) updates['processingStats.progress'] = progress;
    if (message) updates['processingStats.message'] = message;
    
    const updated = await updateReconstructionStatus(
      req.params.id,
      status,
      updates
    );
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Reconstruction not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        status: updated.status,
        progress: updated.processingStats.progress,
        message: updated.processingStats.message
      },
      message: 'Status updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get reconstruction result
router.get('/:id/result', async (req, res, next) => {
  try {
    const reconstruction = await getReconstructionById(req.params.id, {
      populate: 'model3d'
    });
    
    if (!reconstruction) {
      return res.status(404).json({
        success: false,
        error: 'Reconstruction not found'
      });
    }
    
    if (reconstruction.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Reconstruction is not yet complete',
        status: reconstruction.status,
        progress: reconstruction.processingStats?.progress || 0
      });
    }
    
    // Generate signed URLs for the model and textures if using cloud storage
    const result = {
      id: reconstruction._id,
      title: reconstruction.title,
      model: {
        url: `/api/reconstructions/${reconstruction._id}/model`,
        format: path.extname(reconstruction.model3d?.path || '').substring(1),
        size: reconstruction.model3d?.size
      },
      textures: reconstruction.textures?.map(texture => ({
        url: `/api/reconstructions/${reconstruction._id}/textures/${path.basename(texture.path)}`,
        type: texture.type,
        size: texture.size
      })) || [],
      metadata: {
        createdAt: reconstruction.createdAt,
        updatedAt: reconstruction.updatedAt,
        processingTime: reconstruction.processingDuration
      }
    };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Download model file
router.get('/:id/model', async (req, res, next) => {
  try {
    const reconstruction = await getReconstructionById(req.params.id);
    
    if (!reconstruction?.model3d?.path) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }
    
    const filePath = path.resolve(reconstruction.model3d.path);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (e) {
      return res.status(404).json({
        success: false,
        error: 'Model file not found on server'
      });
    }
    
    res.download(filePath, path.basename(reconstruction.model3d.originalName), {
      headers: {
        'Content-Type': reconstruction.model3d.mimetype,
        'Content-Length': reconstruction.model3d.size
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete a reconstruction
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteReconstruction(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Reconstruction not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Reconstruction deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Error in reconstruction routes:', err);
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: Object.entries(err.errors).reduce((acc, [field, error]) => ({
        ...acc,
        [field]: error.message
      }), {})
    });
  }
  
  // Handle duplicate key errors
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      error: 'Duplicate key error',
      details: 'A reconstruction with this title already exists'
    });
  }
  
  // Handle file system errors
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      error: 'File not found',
      details: err.message
    });
  }
  
  // Default error handler
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

module.exports = router;
