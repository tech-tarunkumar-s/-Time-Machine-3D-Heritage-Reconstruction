@echo off
set MESHROOM_PATH=D:\colmap\Meshroom-2025.1.0-Windows\Meshroom-2025.1.0
set INPUT_DIR=d:\ruins-to-reality\ml\datasets\buddha
set OUTPUT_DIR=d:\ruins-to-reality\ml\datasets\buddha\output_meshroom
set LOG_FILE=%OUTPUT_DIR%\reconstruction_log.txt

if not exist "%MESHROOM_PATH%\meshroom_batch.exe" (
    echo Error: Meshroom not found at %MESHROOM_PATH%
    pause
    exit /b 1
)

if not exist "%INPUT_DIR%" (
    echo Error: Input directory not found at %INPUT_DIR%
    pause
    exit /b 1
)

if not exist "%OUTPUT_DIR%" (
    mkdir "%OUTPUT_DIR%"
)

echo Starting 3D reconstruction at %TIME% > "%LOG_FILE%"
echo Input: %INPUT_DIR% >> "%LOG_FILE%"
echo Output: %OUTPUT_DIR% >> "%LOG_FILE%"

echo Running Meshroom...
echo Input: %INPUT_DIR%
echo Output: %OUTPUT_DIR%

echo Starting reconstruction at %TIME%
"%MESHROOM_PATH%\meshroom_batch.exe" ^
    --input "%INPUT_DIR%" ^
    --output "%OUTPUT_DIR%" ^
    --pipeline "%MESHROOM_PATH%\aliceVision\share\meshroom\photogrammetry.mg" ^
    --forceCompute ^
    -v info 2>&1 | tee "%OUTPUT_DIR%\meshroom_output.txt"

if %ERRORLEVEL% EQU 0 (
    echo. >> "%LOG_FILE%"
    echo Reconstruction completed successfully at %TIME% >> "%LOG_FILE%"
    echo.
    echo 3D reconstruction completed successfully!
    echo Check the results in %OUTPUT_DIR%
) else (
    echo. >> "%LOG_FILE%"
    echo Reconstruction failed with error code %ERRORLEVEL% at %TIME% >> "%LOG_FILE%"
    echo.
    echo Error: 3D reconstruction failed. Check the log file: %LOG_FILE%
)

pause
