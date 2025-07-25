@echo off
REM Qwen Code Router Installation Script for Windows
REM This script helps set up Qwen Code Router on Windows systems

echo ========================================
echo Qwen Code Router Installation Script
echo ========================================
echo.

REM Check if Node.js is installed
echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo Then run this script again.
    pause
    exit /b 1
)

echo Node.js is installed: 
node --version
echo.

REM Check if npm is available
echo Checking npm availability...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not available!
    echo Please ensure npm is installed with Node.js.
    pause
    exit /b 1
)

echo npm is available: 
npm --version
echo.

REM Install dependencies if package.json exists
if exist "package.json" (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
    
    echo.
    echo Building project...
    npm run build
    if errorlevel 1 (
        echo ERROR: Failed to build project!
        pause
        exit /b 1
    )
    
    echo.
    echo Linking for global usage...
    npm link
    if errorlevel 1 (
        echo WARNING: Failed to link globally. You can still use the local scripts.
        echo.
        echo To use qcr globally, run: npm link
        echo Or use the batch script: bin\qcr.bat
    ) else (
        echo Successfully linked qcr globally!
    )
) else (
    echo This appears to be a pre-built release package.
    echo Adding to PATH is recommended for easier usage.
)

echo.
echo Setting up configuration...
if not exist "config.yaml" (
    if exist "config.example.yaml" (
        echo Copying example configuration...
        copy "config.example.yaml" "config.yaml"
        echo.
        echo IMPORTANT: Please edit config.yaml and add your API keys!
    )
)

echo.
echo ========================================
echo Installation completed!
echo ========================================
echo.
echo Next steps:
echo 1. Edit config.yaml and add your API keys
echo 2. Test with: qcr --help
echo 3. List configurations: qcr list config
echo 4. Use a configuration: qcr use openai-gpt4
echo.
echo For more information, see README.md
echo.
pause