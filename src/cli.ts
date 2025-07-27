#!/usr/bin/env node

// CLI entry point for Qwen Code Router
import { main } from './index';

// Call main function with command line arguments
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});