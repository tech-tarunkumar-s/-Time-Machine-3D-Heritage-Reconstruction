@echo off
set MESHROOM_BATCH=D:\colmap\Meshroom-2025.1.0-Windows\Meshroom-2025.1.0\meshroom_batch.exe
set PIPELINE=D:\colmap\Meshroom-2025.1.0-Windows\Meshroom-2025.1.0\aliceVision\share\meshroom\photogrammetry.mg
set IMAGE_DIR=%~dp0datasets\buddha
set OUTPUT_DIR=%~dp0datasets\buddha\output_meshroom

echo Running Meshroom with the following parameters:
echo Executable: %MESHROOM_BATCH%
echo Pipeline: %PIPELINE%
echo Image Directory: %IMAGE_DIR%
echo Output Directory: %OUTPUT_DIR%

%MESHROOM_BATCH% --pipeline "%PIPELINE%" --input "%IMAGE_DIR%" --output "%OUTPUT_DIR%" --steps CameraInit --verboseLevel info

if %ERRORLEVEL% EQU 0 (
    echo Meshroom completed successfully.
) else (
    echo Meshroom failed with error code %ERRORLEVEL%.
)

pause
