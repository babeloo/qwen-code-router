#!/bin/bash

# Qwen Code Router Installation Script for Unix/Linux/macOS

echo "========================================"
echo "Qwen Code Router Installation Script"
echo "========================================"
echo

# Check if Node.js is installed
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    echo "Then run this script again."
    exit 1
fi

echo "Node.js is installed: $(node --version)"
echo

# Check if npm is available
echo "Checking npm availability..."
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not available!"
    echo "Please ensure npm is installed with Node.js."
    exit 1
fi

echo "npm is available: $(npm --version)"
echo

# Install dependencies if package.json exists
if [ -f "package.json" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies!"
        exit 1
    fi
    
    echo
    echo "Building project..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to build project!"
        exit 1
    fi
    
    echo
    echo "Linking for global usage..."
    npm link
    if [ $? -ne 0 ]; then
        echo "WARNING: Failed to link globally. You can still use the local scripts."
        echo
        echo "To use qcr globally, run: npm link"
        echo "Or use the script: bin/qcr"
    else
        echo "Successfully linked qcr globally!"
    fi
else
    echo "This appears to be a pre-built release package."
    echo "Adding to PATH is recommended for easier usage."
fi

echo
echo "Setting up configuration..."
if [ ! -f "config.yaml" ] && [ -f "config.example.yaml" ]; then
    echo "Copying example configuration..."
    cp "config.example.yaml" "config.yaml"
    echo
    echo "IMPORTANT: Please edit config.yaml and add your API keys!"
fi

echo
echo "========================================"
echo "Installation completed!"
echo "========================================"
echo
echo "Next steps:"
echo "1. Edit config.yaml and add your API keys"
echo "2. Test with: qcr --help"
echo "3. List configurations: qcr list config"
echo "4. Use a configuration: qcr use openai-gpt4"
echo
echo "For more information, see README.md"