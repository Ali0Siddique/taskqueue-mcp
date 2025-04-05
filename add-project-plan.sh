#!/bin/bash

# Load Gemini API key from secure file
export GOOGLE_GENERATIVE_AI_API_KEY=$(cat /Users/smalcolm/src/github.com/sebastian-kwinana/.GoogleGemini-APIKEY)

# Set path to task file
export TASK_MANAGER_FILE_PATH="$(dirname "$0")/.env.local/tasks.json"

# Default demo prompt
DEMO_PROMPT="Create a project plan for developing a FastAPI Python wrapper around TaskQueue with unified TUI/WebUI interfaces. The system should:
- Implement a minimalist FastAPI Python wrapper around TaskQueue's project/task management
- Use a unified user interface markup language, inspired by XAML and XUL and ZUML, for rendering both TUI and WebUI 
- Support real-time synchronization between interfaces via WebSockets
- Provide programmatic access to UI state components
- Expose an OpenAPI-UI (like Swagger) for API documentation and testing
- Enable full instrumentation of UI elements for control by Agentic AI models
- Allow scripted control of UI navigation, task selection, completion marking and approvals
- Support visibility into currently selected/active projects and tasks across interfaces
- Follow best practices for Python FastAPI development with modern async patterns"

# Function to display usage information
function show_usage {
  echo "Usage: $(basename "$0") [OPTIONS] [PROMPT|FILE_PATH]"
  echo
  echo "Generate a TaskQueue project plan using Google Gemini LLM."
  echo
  echo "Options:"
  echo "  --demo             Use the built-in demo prompt"
  echo "  --help, -h         Show this help message"
  echo
  echo "Arguments:"
  echo "  PROMPT             Text string containing the prompt for the project plan"
  echo "  FILE_PATH          Path to a file containing the prompt (must exist and be readable)"
  echo
  echo "Examples:"
  echo "  $(basename "$0") --demo"
  echo "  $(basename "$0") \"Create a project plan for a weather app\""
  echo "  $(basename "$0") /path/to/prompt.txt"
  exit 1
}

# Parse command-line arguments
PROMPT=""
if [[ $# -eq 0 ]]; then
  echo "Error: No arguments provided."
  show_usage
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --demo)
      PROMPT="$DEMO_PROMPT"
      shift
      ;;
    --help|-h)
      show_usage
      ;;
    *)
      # Check if the argument is a file path
      if [[ -f "$1" ]]; then
        # Read prompt from file
        PROMPT=$(cat "$1")
        if [[ $? -ne 0 ]]; then
          echo "Error: Could not read from file '$1'."
          exit 1
        fi
      else
        # Treat argument as a prompt string
        PROMPT="$1"
      fi
      shift
      ;;
  esac
done

# Validate that we have a prompt
if [[ -z "$PROMPT" ]]; then
  echo "Error: No valid prompt provided."
  show_usage
fi

# Run generate-plan with the provided prompt
node "$(dirname "$0")/dist/src/client/index.js" generate-plan \
  --provider google \
  --model gemini-2.0-flash \
  --prompt "$PROMPT"
