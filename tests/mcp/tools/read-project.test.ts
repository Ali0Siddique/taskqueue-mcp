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

describe('read_project Tool', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestContext();
  });

  afterAll(async () => {
    await teardownTestContext(context);
  });

  describe('Success Cases', () => {
    it('should read a project with minimal data', async () => {
      // Create a test project
      const project = await createTestProjectInFile(context.testFilePath, {
        initialPrompt: "Test Project",
        projectPlan: "",
        completed: false
      });
      await createTestTaskInFile(context.testFilePath, project.projectId, {
        title: "Test Task",
        description: "Test Description"
      });

      // Read the project
      const result = await context.client.callTool({
        name: "read_project",
        arguments: {
          projectId: project.projectId
        }
      }) as ToolResponse;

      // Verify response
      verifyToolResponse(result);
      expect(result.isError).toBeFalsy();

      // Verify project data
      const responseData = JSON.parse((result.content[0] as { text: string }).text);
      expect(responseData.data).toMatchObject({
        projectId: project.projectId,
        initialPrompt: "Test Project",
        completed: false,
        tasks: [{
          title: "Test Task",
          description: "Test Description",
          status: "not started",
          approved: false
        }]
      });
    });

    it('should read a project with all optional fields', async () => {
      const project = await createTestProjectInFile(context.testFilePath, {
        initialPrompt: "Full Project",
        projectPlan: "Detailed project plan",
        completed: false,
        autoApprove: true
      });
      await createTestTaskInFile(context.testFilePath, project.projectId, {
        title: "Full Task",
        description: "Task with all fields",
        status: "done",
        approved: true,
        completedDetails: "Task completed",
        toolRecommendations: "Use these tools",
        ruleRecommendations: "Follow these rules"
      });

      const result = await context.client.callTool({
        name: "read_project",
        arguments: {
          projectId: project.projectId
        }
      }) as ToolResponse;

      verifyToolResponse(result);
      const responseData = JSON.parse((result.content[0] as { text: string }).text);
      expect(responseData.data).toMatchObject({
        projectId: project.projectId,
        initialPrompt: "Full Project",
        projectPlan: "Detailed project plan",
        completed: false,
        autoApprove: true,
        tasks: [{
          title: "Full Task",
          description: "Task with all fields",
          status: "done",
          approved: true,
          completedDetails: "Task completed",
          toolRecommendations: "Use these tools",
          ruleRecommendations: "Follow these rules"
        }]
      });
    });

    it('should read a completed project', async () => {
      const project = await createTestProjectInFile(context.testFilePath, {
        initialPrompt: "Completed Project",
        completed: true
      });
      await createTestTaskInFile(context.testFilePath, project.projectId, {
        title: "Completed Task",
        description: "This task is done",
        status: "done",
        approved: true,
        completedDetails: "Task completed"
      });

      const result = await context.client.callTool({
        name: "read_project",
        arguments: {
          projectId: project.projectId
        }
      }) as ToolResponse;

      verifyToolResponse(result);
      const responseData = JSON.parse((result.content[0] as { text: string }).text);
      expect(responseData.data).toMatchObject({
        projectId: project.projectId,
        completed: true,
        tasks: [{
          status: "done",
          approved: true
        }]
      });
    });

    it('should read a project with multiple tasks', async () => {
      const project = await createTestProjectInFile(context.testFilePath, {
        initialPrompt: "Multi-task Project"
      });

      // Create tasks in different states
      await Promise.all([
        createTestTaskInFile(context.testFilePath, project.projectId, {
          title: "Task 1",
          description: "Not started",
          status: "not started"
        }),
        createTestTaskInFile(context.testFilePath, project.projectId, {
          title: "Task 2",
          description: "In progress",
          status: "in progress"
        }),
        createTestTaskInFile(context.testFilePath, project.projectId, {
          title: "Task 3",
          description: "Completed",
          status: "done",
          approved: true,
          completedDetails: "Done and approved"
        })
      ]);

      const result = await context.client.callTool({
        name: "read_project",
        arguments: {
          projectId: project.projectId
        }
      }) as ToolResponse;

      verifyToolResponse(result);
      const responseData = JSON.parse((result.content[0] as { text: string }).text);
      expect(responseData.data.tasks).toHaveLength(3);
      expect(responseData.data.tasks.map((t: any) => t.status)).toEqual([
        "not started",
        "in progress",
        "done"
      ]);
    });
  });

  describe('Error Cases', () => {
    it('should return error for non-existent project', async () => {
      const result = await context.client.callTool({
        name: "read_project",
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
        name: "read_project",
        arguments: {
          projectId: "invalid-format"
        }
      }) as ToolResponse;

      verifyToolResponse(result);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Invalid project ID format');
    });
  });
}); 