import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  setupTestContext,
  teardownTestContext,
  verifyToolResponse,
  createTestProjectInFile,
  createTestTaskInFile,
  TestContext,
  ToolResponse
} from '../test-helpers.js';

describe('get_next_task Tool', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  afterAll(async () => {
    await teardownTestContext(context);
  });

  describe('Success Cases', () => {
    it('should get first task when no tasks are started', async () => {
      // Create a project with multiple unstarted tasks
      const project = await createTestProjectInFile(context.testFilePath, {
        initialPrompt: "Test Project"
      });
      const tasks = await Promise.all([
        createTestTaskInFile(context.testFilePath, project.projectId, {
          title: "Task 1",
          description: "First task",
          status: "not started"
        }),
        createTestTaskInFile(context.testFilePath, project.projectId, {
          title: "Task 2",
          description: "Second task",
          status: "not started"
        })
      ]);

      // Get next task
      const result = await context.client.callTool({
        name: "get_next_task",
        arguments: {
          projectId: project.projectId
        }
      }) as ToolResponse;

      // Verify response
      verifyToolResponse(result);
      expect(result.isError).toBeFalsy();

      // Verify task data
      const responseData = JSON.parse((result.content[0] as { text: string }).text);
      expect(responseData.data.task).toMatchObject({
        id: tasks[0].id,
        title: "Task 1",
        status: "not started"
      });
    });

    it('should get next incomplete task after completed tasks', async () => {
      const project = await createTestProjectInFile(context.testFilePath, {
        initialPrompt: "Sequential Tasks"
      });

      // Create tasks with first one completed
      await createTestTaskInFile(context.testFilePath, project.projectId, {
        title: "Done Task",
        description: "Already completed",
        status: "done",
        approved: true,
        completedDetails: "Completed first"
      });
      const nextTask = await createTestTaskInFile(context.testFilePath, project.projectId, {
        title: "Next Task",
        description: "Should be next",
        status: "not started"
      });

      const result = await context.client.callTool({
        name: "get_next_task",
        arguments: {
          projectId: project.projectId
        }
      }) as ToolResponse;

      verifyToolResponse(result);
      const responseData = JSON.parse((result.content[0] as { text: string }).text);
      expect(responseData.data.task).toMatchObject({
        id: nextTask.id,
        title: "Next Task",
        status: "not started"
      });
    });

    it('should get in-progress task if one exists', async () => {
      const project = await createTestProjectInFile(context.testFilePath, {
        initialPrompt: "Project with In-progress Task"
      });

      // Create multiple tasks with one in progress
      await createTestTaskInFile(context.testFilePath, project.projectId, {
        title: "Done Task",
        description: "Already completed",
        status: "done",
        approved: true,
        completedDetails: "Completed"
      });
      const inProgressTask = await createTestTaskInFile(context.testFilePath, project.projectId, {
        title: "Current Task",
        description: "In progress",
        status: "in progress"
      });
      await createTestTaskInFile(context.testFilePath, project.projectId, {
        title: "Future Task",
        description: "Not started yet",
        status: "not started"
      });

      const result = await context.client.callTool({
        name: "get_next_task",
        arguments: {
          projectId: project.projectId
        }
      }) as ToolResponse;

      verifyToolResponse(result);
      const responseData = JSON.parse((result.content[0] as { text: string }).text);
      expect(responseData.data.task).toMatchObject({
        id: inProgressTask.id,
        title: "Current Task",
        status: "in progress"
      });
    });

    it('should return null when all tasks are completed', async () => {
      const project = await createTestProjectInFile(context.testFilePath, {
        initialPrompt: "Completed Project",
        completed: true
      });

      // Create only completed tasks
      await Promise.all([
        createTestTaskInFile(context.testFilePath, project.projectId, {
          title: "Task 1",
          description: "First done",
          status: "done",
          approved: true,
          completedDetails: "Done"
        }),
        createTestTaskInFile(context.testFilePath, project.projectId, {
          title: "Task 2",
          description: "Second done",
          status: "done",
          approved: true,
          completedDetails: "Done"
        })
      ]);

      const result = await context.client.callTool({
        name: "get_next_task",
        arguments: {
          projectId: project.projectId
        }
      }) as ToolResponse;

      verifyToolResponse(result);
      const responseData = JSON.parse((result.content[0] as { text: string }).text);
      expect(responseData.data.task).toBeNull();
    });
  });

  describe('Error Cases', () => {
    it('should return error for non-existent project', async () => {
      const result = await context.client.callTool({
        name: "get_next_task",
        arguments: {
          projectId: "non_existent_project"
        }
      }) as ToolResponse;

      verifyToolResponse(result);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Project non_existent_project not found');
    });

    it('should return error for invalid project ID format', async () => {
      const result = await context.client.callTool({
        name: "get_next_task",
        arguments: {
          projectId: "invalid-format"
        }
      }) as ToolResponse;

      verifyToolResponse(result);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Invalid project ID format');
    });

    it('should return error for project with no tasks', async () => {
      const project = await createTestProjectInFile(context.testFilePath, {
        initialPrompt: "Empty Project",
        tasks: []
      });

      const result = await context.client.callTool({
        name: "get_next_task",
        arguments: {
          projectId: project.projectId
        }
      }) as ToolResponse;

      verifyToolResponse(result);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Project has no tasks');
    });
  });
}); 