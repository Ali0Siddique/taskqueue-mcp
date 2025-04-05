# TaskQueue Development Guide

This guide provides instructions for developers working on the TaskQueue MCP project.

## Local Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Set up your task storage:
   ```bash
   mkdir -p .env.local
   echo '{"projects": []}' > .env.local/tasks.json
   ```

## Running the CLI

Use the provided script to run the CLI with proper configuration:

```bash
# Run any CLI command
./run-taskqueue-cli.sh [command] [options]

# List all projects
./run-taskqueue-cli.sh list

# View details of a specific project
./run-taskqueue-cli.sh list -p <projectId>

# Approve a task
./run-taskqueue-cli.sh approve <projectId> <taskId>
```

## Generating Project Plans with LLMs

The project supports generating project plans using different LLM providers. A script is included to make this easy:

```bash
# Show help information
./add-project-plan.sh --help

# Generate a plan using built-in demo prompt
./add-project-plan.sh --demo

# Generate a plan from a text prompt
./add-project-plan.sh "Create a project plan for a weather app"

# Generate a plan from a file
./add-project-plan.sh /path/to/prompt.txt
```

Sample prompts are available in the `prompts/` directory.

To use a different LLM provider, edit the script to change the `--provider` option:
- `openai` (requires `OPENAI_API_KEY`)
- `google` (requires `GOOGLE_GENERATIVE_AI_API_KEY`) 
- `deepseek` (requires `DEEPSEEK_API_KEY`)

## Making Changes to the Codebase

1. Edit source files in the `src/` directory
2. Rebuild the project:
   ```bash
   npm run build
   ```
3. Run the CLI to test your changes:
   ```bash
   ./run-taskqueue-cli.sh [command]
   ```

## Testing

Run all tests:
```bash
npm test
```

Run a specific test file:
```bash
npx jest tests/path/to/test.ts
```

Run tests matching a specific pattern:
```bash
npx jest -t "pattern"
```

## Project Structure

- `src/client/` - CLI client implementation
- `src/server/` - MCP server implementation
- `src/types/` - Shared type definitions
- `tests/` - Test files
- `prompts/` - Sample project plan prompts
- `.env.local/` - Local development environment files (git-ignored)