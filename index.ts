#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { TaskManager } from "./src/server/TaskManager.js";
import { ALL_TOOLS } from "./src/server/tools.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Create server with capabilities BEFORE setting up handlers
const server = new Server(
  {
    name: "task-manager-server",
    version: "1.0.9"
  },
  {
    capabilities: {
      tools: {
        list: true,
        call: true
      }
    }
  }
);

// Debug logging
console.error('Server starting with env:', {
  TASK_MANAGER_FILE_PATH: process.env.TASK_MANAGER_FILE_PATH,
  NODE_ENV: process.env.NODE_ENV
});

// Initialize task manager
const taskManager = new TaskManager();

// Set up request handlers AFTER capabilities are configured
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: ALL_TOOLS
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name } = request.params;
    const args = request.params.arguments || {};

    // For validation, ensure args is an object when expected
    if (name !== "list_projects" && name !== "list_tasks" && Object.keys(args).length === 0) {
      throw new Error("Invalid arguments: expected object with parameters");
    }

    switch (name) {
      // Project tools
      case "list_projects": {
        const result = await taskManager.listProjects();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "read_project": {
        const projectId = String(args.projectId);
        if (!projectId) {
          throw new Error("Missing required parameter: projectId");
        }
        const result = await taskManager.getNextTask(projectId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_project": {
        const initialPrompt = String(args.initialPrompt || "");
        if (!initialPrompt || !args.tasks || !Array.isArray(args.tasks)) {
          throw new Error("Missing required parameters: initialPrompt and/or tasks");
        }
        const projectPlan = args.projectPlan ? String(args.projectPlan) : undefined;
        
        const result = await taskManager.createProject(
          initialPrompt,
          args.tasks,
          projectPlan
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_project": {
        const projectId = String(args.projectId);
        if (!projectId) {
          throw new Error("Missing required parameter: projectId");
        }
        // Use the private data and saveTasks via indexing since there's no explicit delete method
        const projectIndex = taskManager["data"].projects.findIndex((p) => p.projectId === projectId);
        if (projectIndex === -1) {
          return { 
            content: [{ type: "text", text: JSON.stringify({ status: "error", message: "Project not found" }, null, 2) }],
          };
        }
        
        taskManager["data"].projects.splice(projectIndex, 1);
        await taskManager["saveTasks"]();
        return { 
          content: [{ type: "text", text: JSON.stringify({ 
            status: "project_deleted", 
            message: `Project ${projectId} has been deleted.`
          }, null, 2) }],
        };
      }

      case "add_tasks_to_project": {
        const projectId = String(args.projectId);
        if (!projectId || !args.tasks || !Array.isArray(args.tasks)) {
          throw new Error("Missing required parameters: projectId and/or tasks");
        }
        const result = await taskManager.addTasksToProject(projectId, args.tasks);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "finalize_project": {
        const projectId = String(args.projectId);
        if (!projectId) {
          throw new Error("Missing required parameter: projectId");
        }
        const result = await taskManager.approveProjectCompletion(projectId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // Task tools
      case "list_tasks": {
        // No explicit list tasks method, so return a message
        return {
          content: [{ type: "text", text: JSON.stringify({ 
            status: "error", 
            message: "list_tasks functionality to be implemented in future version"
          }, null, 2) }],
        };
      }

      case "read_task": {
        const taskId = String(args.taskId);
        if (!taskId) {
          throw new Error("Missing required parameter: taskId");
        }
        const result = await taskManager.openTaskDetails(taskId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_task": {
        const projectId = String(args.projectId);
        const title = String(args.title || "");
        const description = String(args.description || "");
        
        if (!projectId || !title || !description) {
          throw new Error("Missing required parameters: projectId, title, and/or description");
        }
        
        const result = await taskManager.addTasksToProject(projectId, [{
          title,
          description
        }]);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_task": {
        const projectId = String(args.projectId);
        const taskId = String(args.taskId);
        
        if (!projectId || !taskId) {
          throw new Error("Missing required parameters: projectId and/or taskId");
        }
        
        const updates = Object.fromEntries(
          Object.entries({
            title: args.title !== undefined ? String(args.title) : undefined,
            description: args.description !== undefined ? String(args.description) : undefined,
            status: args.status !== undefined ? String(args.status) as "not started" | "in progress" | "done" : undefined,
            completedDetails: args.completedDetails !== undefined ? String(args.completedDetails) : undefined,
            toolRecommendations: args.toolRecommendations !== undefined ? String(args.toolRecommendations) : undefined,
            ruleRecommendations: args.ruleRecommendations !== undefined ? String(args.ruleRecommendations) : undefined
          }).filter(([_, value]) => value !== undefined)
        );

        const result = await taskManager.updateTask(projectId, taskId, updates);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_task": {
        const projectId = String(args.projectId);
        const taskId = String(args.taskId);
        
        if (!projectId || !taskId) {
          throw new Error("Missing required parameters: projectId and/or taskId");
        }
        const result = await taskManager.deleteTask(projectId, taskId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "approve_task": {
        const projectId = String(args.projectId);
        const taskId = String(args.taskId);
        
        if (!projectId || !taskId) {
          throw new Error("Missing required parameters: projectId and/or taskId");
        }
        const result = await taskManager.approveTaskCompletion(projectId, taskId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "get_next_task": {
        const projectId = String(args.projectId);
        if (!projectId) {
          throw new Error("Missing required parameter: projectId");
        }
        const result = await taskManager.getNextTask(projectId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);
