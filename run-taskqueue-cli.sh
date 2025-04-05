#!/bin/bash

# Load Gemini API key from secure file
export GOOGLE_GENERATIVE_AI_API_KEY=$(cat /Users/smalcolm/src/github.com/sebastian-kwinana/.GoogleGemini-APIKEY)

# Set path to task file
export TASK_MANAGER_FILE_PATH="$(dirname "$0")/.env.local/tasks.json"

# Run the CLI with provided arguments
node "$(dirname "$0")/dist/src/client/index.js" "$@"