# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Test Commands
- Build: `npm run build` - Compiles TypeScript to JavaScript
- Start: `npm run start` - Runs the compiled server
- Dev: `npm run dev` - Builds and starts server in one command
- CLI: Use `./run-taskqueue-cli.sh [command]` - Runs the task queue CLI client with proper config
- Test all: `npm test` - Runs all tests after building
- Test single: `npx jest <test-file-path>` - Run specific test file
- Test pattern: `npx jest -t "test name pattern"` - Run tests matching pattern

## Development Scripts
- `./run-taskqueue-cli.sh` - Run CLI commands with proper environment setup
- `./add-project-plan.sh` - Generate project plans with LLM (supports file or direct prompt input)
- Use `--help` flag with any script to see available options

## Code Style Guidelines
- Use Biome formatting: 2-space indentation, 80 character line width
- TypeScript with strict typing and proper return types
- ES Module imports with .js extension required (NodeNext module)
- PascalCase for classes/interfaces/types, camelCase for variables/functions
- Custom error handling with AppError class and error codes
- Organization: separate client/server/types directories
- Tests: Jest with BDD style test names and helper functions

## Project Structure
- `src/` - Source code (client, server, types)
- `dist/` - Compiled JavaScript (git-ignored)
- `tests/` - Test files
- `prompts/` - Sample project plan prompts
- `.env.local/` - Local development files (git-ignored)

## Environment
- Set `TASK_MANAGER_FILE_PATH` for persistent storage location
- Local tasks are stored in `.env.local/tasks.json`
- LLM providers require respective API keys: OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, DEEPSEEK_API_KEY
- For more details, see README-DEV.md