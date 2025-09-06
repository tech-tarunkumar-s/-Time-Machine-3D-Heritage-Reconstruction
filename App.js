import React, { useState, useRef } from 'react';
import { Container, Box, Typography, Button, LinearProgress } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import ReconstructionViewer from './components/Viewer/ReconstructionViewer';
import UploadArea from './components/UploadArea';
import StatusPanel from './components/StatusPanel';
import LoadingIndicator from './components/LoadingIndicator';
import { processImages, getReconstructionStatus } from './api/reconstructionApi';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    
    background: {
      default: '#121214',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
  },
});

function App() {
  // const [files, setFiles] = useState([]); // Moved to UploadArea, and not directly used here for display
  // const [jobId, setJobId] = useState(null); // Managed via reconstructionResult
  const [status, setStatus] = useState('idle'); // 'idle', 'uploading', 'processing', 'completed', 'error'
  const [progress, setProgress] = useState(0);
  const [reconstructionResult, setReconstructionResult] = useState(null);
  const statusInterval = useRef(null);

  const handleImagesUpload = async (images) => {
    // setFiles(images); // Removed: files state is managed within UploadArea and not directly needed in App.js for display
    setStatus('uploading');
    
    try {
      const formData = new FormData();
      images.forEach((file) => {
        formData.append('images', file);
      });

      const response = await processImages(formData);
      // setJobId(response.reconstructionId); // Removed: jobId is part of reconstructionResult
      setStatus('processing');
      
      statusInterval.current = setInterval(async () => {
        const statusResponse = await getReconstructionStatus(response.reconstructionId);
        setProgress(statusResponse.progress || 0);
        
        if (statusResponse.status === 'completed') {
          clearInterval(statusInterval.current);
          setStatus('completed');
          setReconstructionResult(statusResponse);
        } else if (statusResponse.status === 'failed') {
          clearInterval(statusInterval.current);
          setStatus('error');
        }
      }, 2000);
      
      
    } catch (error) {
      console.error('Error processing images:', error);
      setStatus('error');
      if (statusInterval.current) {
        clearInterval(statusInterval.current);
      }
    }
  };

  const handleReset = () => {
    // setFiles([]); // No longer needed here
    setStatus('idle');
    setProgress(0);
    // setJobId(null); // No longer needed here
    setReconstructionResult(null);
    if (statusInterval.current) {
      clearInterval(statusInterval.current);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Ruins to Reality
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Transform ruins into complete 3D models with AI reconstruction
          </Typography>
        </Box>

        {status === 'idle' && (
          <UploadArea 
            onImagesUpload={handleImagesUpload}
          />
        )}

        {(status === 'uploading' || status === 'processing') && (
           <Box sx={{ mt: 4, textAlign: 'center' }}>
             <Typography variant="h6" gutterBottom>
               {status === 'uploading' ? 'Uploading images...' : 'Processing reconstruction...'}
             </Typography>
             <LoadingIndicator />
             <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
               {Math.round(progress)}% complete
             </Typography>
           </Box>
         )}

        {status === 'completed' && reconstructionResult && (
          <Box sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Reconstruction Complete</Typography>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={handleReset}
                sx={{ textTransform: 'none' }}
              >
                Start New Reconstruction
              </Button>
            </Box>
            
            <StatusPanel result={reconstructionResult} />
            
            <Box sx={{ mt: 4, height: '60vh', borderRadius: 2, overflow: 'hidden', border: '1px solid #333' }}>
              <ReconstructionViewer modelPath={reconstructionResult.modelPath} />
            </Box>
          </Box>
        )}

        {status === 'error' && (
          <Box sx={{ mt: 4, p: 3, bgcolor: 'error.dark', borderRadius: 2, color: 'white' }}>
            <Typography variant="h6">Error Processing Images</Typography>
            <Typography>An error occurred during reconstruction. Please try again.</Typography>
            <Button 
              variant="contained" 
              color="secondary" 
              onClick={handleReset}
              sx={{ mt: 2 }}
            >
              Try Again
            </Button>
          </Box>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;
