import { Tool } from "@modelcontextprotocol/sdk/types.js";

// ---------------------- PROJECT TOOLS ----------------------

// List Projects
const listProjectsTool: Tool = {
  name: "list_projects",
  description: "List all projects in the system and their basic information (ID, initial prompt, task counts).",
  inputSchema: {
    type: "object",
    properties: {}, // No arguments needed
    required: [],
  },
};

// Read Project
const readProjectTool: Tool = {
  name: "read_project",
  description: "Read all information for a given project, by its ID, including its tasks' statuses.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The ID of the project to read (e.g., proj-1).",
      },
    },
    required: ["projectId"],
  },
};

// Create Project
const createProjectTool: Tool = {
  name: "create_project",
  description: "Create a new project with an initial prompt and a list of tasks.",
  inputSchema: {
    type: "object",
    properties: {
      initialPrompt: {
        type: "string",
        description: "The initial prompt or goal for the project.",
      },
      projectPlan: {
        type: "string",
        description: "A more detailed plan for the project. If not provided, the initial prompt will be used.",
      },
      tasks: {
        type: "array",
        description: "An array of task objects.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the task.",
            },
            description: {
              type: "string",
              description: "A detailed description of the task.",
            },
          },
          required: ["title", "description"],
        },
      },
    },
    required: ["initialPrompt", "tasks"],
  },
};

// Delete Project
const deleteProjectTool: Tool = {
  name: "delete_project",
  description: "Delete a project and all its associated tasks.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The ID of the project to delete (e.g., proj-1).",
      },
    },
    required: ["projectId"],
  },
};

// Add Tasks to Project
const addTasksToProjectTool: Tool = {
  name: "add_tasks_to_project",
  description: "Add new tasks to an existing project.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The ID of the project to add tasks to (e.g., proj-1).",
      },
      tasks: {
        type: "array",
        description: "An array of task objects to add.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the task.",
            },
            description: {
              type: "string",
              description: "A detailed description of the task.",
            },
          },
          required: ["title", "description"],
        },
      },
    },
    required: ["projectId", "tasks"],
  },
};

// Finalize Project (Mark as Complete)
const finalizeProjectTool: Tool = {
  name: "finalize_project",
  description: "Mark a project as complete after all tasks are done and approved.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The ID of the project to finalize (e.g., proj-1).",
      },
    },
    required: ["projectId"],
  },
};

// ---------------------- TASK TOOLS ----------------------

// List Tasks
const listTasksTool: Tool = {
  name: "list_tasks",
  description: "List all tasks, optionally filtered by project ID and/or status.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The ID of the project to list tasks from. If omitted, list all tasks.",
      },
      status: {
        type: "string",
        enum: ["not started", "in progress", "done"],
        description: "Filter tasks by status. If omitted, list all tasks regardless of status.",
      },
    },
    required: [], // Neither projectId nor status is required, both are optional filters
  },
};

// Read Task
const readTaskTool: Tool = {
  name: "read_task",
  description: "Get details of a specific task by its ID.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "The ID of the task to read (e.g., task-1).",
      },
    },
    required: ["taskId"],
  },
};

// Create Task
const createTaskTool: Tool = {
  name: "create_task",
  description: "Create a new task within an existing project.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The ID of the project to add the task to (e.g., proj-1).",
      },
      title: {
        type: "string",
        description: "The title of the task.",
      },
      description: {
        type: "string",
        description: "A detailed description of the task.",
      }
    },
    required: ["projectId", "title", "description"]
  }
};

// Update Task
const updateTaskTool: Tool = {
  name: "update_task",
  description: "Modify a task's title, description, or status. Note: completedDetails are required when setting status to 'done'.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The ID of the project containing the task (e.g., proj-1).",
      },
      taskId: {
        type: "string",
        description: "The ID of the task to update (e.g., task-1).",
      },
      title: {
        type: "string",
        description: "The new title for the task (optional).",
      },
      description: {
        type: "string",
        description: "The new description for the task (optional).",
      },
      status: {
        type: "string",
        enum: ["not started", "in progress", "done"],
        description: "The new status for the task (optional).",
      },
      completedDetails: {
        type: "string",
        description: "Details about the task completion (required if status is set to 'done').",
      },
    },
    required: ["projectId", "taskId"], // title, description, status are optional, but completedDetails is conditionally required
  },
};

// Delete Task
const deleteTaskTool: Tool = {
  name: "delete_task",
  description: "Remove a task from a project.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The ID of the project containing the task (e.g., proj-1).",
      },
      taskId: {
        type: "string",
        description: "The ID of the task to delete (e.g., task-1).",
      },
    },
    required: ["projectId", "taskId"],
  },
};

// Approve Task
const approveTaskTool: Tool = {
  name: "approve_task",
  description: "Approve a completed task.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The ID of the project containing the task (e.g., proj-1).",
      },
      taskId: {
        type: "string",
        description: "The ID of the task to approve (e.g., task-1).",
      }
    },
    required: ["projectId", "taskId"]
  }
};

// Get Next Task
const getNextTaskTool: Tool = {
  name: "get_next_task",
  description: "Get the next task to be done in a project.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The ID of the project to get the next task from (e.g., proj-1).",
      },
    },
    required: ["projectId"],
  },
};

// Export all tools as an array
export const ALL_TOOLS = [
  listProjectsTool,
  readProjectTool,
  createProjectTool,
  deleteProjectTool,
  addTasksToProjectTool,
  finalizeProjectTool,

  listTasksTool,
  readTaskTool,
  createTaskTool,
  updateTaskTool,
  deleteTaskTool,
  approveTaskTool,
  getNextTaskTool,
];