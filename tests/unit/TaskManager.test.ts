import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import { ALL_TOOLS } from '../../src/server/tools.js';
import { VALID_STATUS_TRANSITIONS, Task, StandardResponse, TaskManagerFile } from '../../src/types/index.js';
import type { TaskManager as TaskManagerType } from '../../src/server/TaskManager.js';
import type { FileSystemService as FileSystemServiceType } from '../../src/server/FileSystemService.js';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { generateObject as GenerateObjectType, jsonSchema as JsonSchemaType } from 'ai';

jest.unstable_mockModule('ai', () => ({
  __esModule: true,
  generateObject: jest.fn(),
  jsonSchema: jest.fn(),
}));

jest.unstable_mockModule('@ai-sdk/openai', () => ({
  __esModule: true,
  openai: jest.fn(),
}));

jest.unstable_mockModule('@ai-sdk/google', () => ({
  __esModule: true,
  google: jest.fn(),
}));

jest.unstable_mockModule('@ai-sdk/deepseek', () => ({
  __esModule: true,
  deepseek: jest.fn(),
}));

// Create mock functions for FileSystemService instance methods
const mockLoadAndInitializeTasks = jest.fn() as jest.MockedFunction<FileSystemServiceType['loadAndInitializeTasks']>;
const mockSaveTasks = jest.fn() as jest.MockedFunction<FileSystemServiceType['saveTasks']>;
const mockCalculateMaxIds = jest.fn() as jest.MockedFunction<FileSystemServiceType['calculateMaxIds']>;
const mockLoadTasks = jest.fn() as jest.MockedFunction<FileSystemServiceType['loadTasks']>;
const mockReloadTasks = jest.fn() as jest.MockedFunction<FileSystemServiceType['reloadTasks']>;

// Create mock functions for FileSystemService static methods
const mockGetAppDataDir = jest.fn() as jest.MockedFunction<typeof FileSystemServiceType.getAppDataDir>;

jest.unstable_mockModule('../../src/server/FileSystemService.js', () => {
  class MockFileSystemService {
    constructor() {}
    loadAndInitializeTasks = mockLoadAndInitializeTasks;
    saveTasks = mockSaveTasks;
    calculateMaxIds = mockCalculateMaxIds;
    loadTasks = mockLoadTasks;
    reloadTasks = mockReloadTasks;
    static getAppDataDir = mockGetAppDataDir;
  }

  return {
    __esModule: true,
    FileSystemService: MockFileSystemService,
  };
});

// Variables for dynamically imported modules
let TaskManager: typeof TaskManagerType;
let FileSystemService: jest.MockedClass<typeof FileSystemServiceType>;
let generateObject: jest.MockedFunction<typeof GenerateObjectType>;
let jsonSchema: jest.MockedFunction<typeof JsonSchemaType>;

// Import modules after mocks are registered
beforeAll(async () => {
  const aiModule = await import('ai');
  generateObject = aiModule.generateObject as jest.MockedFunction<typeof GenerateObjectType>;
  jsonSchema = aiModule.jsonSchema as jest.MockedFunction<typeof JsonSchemaType>;
});

describe('TaskManager', () => {
  let taskManager: InstanceType<typeof TaskManagerType>;
  let tempDir: string;
  let tasksFilePath: string;

  // --- Stateful Mock Data ---
  let currentMockData: TaskManagerFile;
  let currentMaxProjectId: number;
  let currentMaxTaskId: number;

  // Helper to mimic calculateMaxIds logic (since we can't easily access the real one here)
  const calculateMockMaxIds = (data: TaskManagerFile): { maxProjectId: number; maxTaskId: number } => {
      let maxProj = 0;
      let maxTask = 0;
      for (const proj of data.projects) {
          const projNum = parseInt(proj.projectId.split('-')[1] ?? '0', 10);
          if (!isNaN(projNum) && projNum > maxProj) maxProj = projNum;
          for (const task of proj.tasks) {
              const taskNum = parseInt(task.id.split('-')[1] ?? '0', 10);
              if (!isNaN(taskNum) && taskNum > maxTask) maxTask = taskNum;
          }
      }
      return { maxProjectId: maxProj, maxTaskId: maxTask };
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset mock data - this is key to prevent data from persisting between tests
    currentMockData = { projects: [] };
    currentMaxProjectId = 0;
    currentMaxTaskId = 0;

    // Initial load returns current (empty) state and calculated IDs
    mockLoadAndInitializeTasks.mockImplementation(async () => {
      const maxIds = calculateMockMaxIds(currentMockData);
      currentMaxProjectId = maxIds.maxProjectId;
      currentMaxTaskId = maxIds.maxTaskId;
      return { data: JSON.parse(JSON.stringify(currentMockData)), maxProjectId: currentMaxProjectId, maxTaskId: currentMaxTaskId };
    });

    // Save updates the state and recalculates max IDs
    mockSaveTasks.mockImplementation(async (dataToSave: TaskManagerFile) => {
      currentMockData = JSON.parse(JSON.stringify(dataToSave)); // Store a deep copy
      const maxIds = calculateMockMaxIds(currentMockData);
      currentMaxProjectId = maxIds.maxProjectId;
      currentMaxTaskId = maxIds.maxTaskId;
      return undefined;
    });

    // Reload returns the current state (deep copy)
    mockReloadTasks.mockImplementation(async () => {
       return JSON.parse(JSON.stringify(currentMockData));
    });

    // CalculateMaxIds uses the helper logic on potentially provided data
    // Note: TaskManager might rely on its *internal* maxId counters more than calling this directly after init
    mockCalculateMaxIds.mockImplementation((data: TaskManagerFile) => {
        const result = calculateMockMaxIds(data || currentMockData); // Use provided data or current state
        return result;
    });

    // Static method mock
    mockGetAppDataDir.mockReturnValue('/mock/app/data/dir');

    // Import modules after mocks are registered and implemented
    const taskManagerModule = await import('../../src/server/TaskManager.js');
    TaskManager = taskManagerModule.TaskManager;
  
    const fileSystemModule = await import('../../src/server/FileSystemService.js');
    FileSystemService = fileSystemModule.FileSystemService as jest.MockedClass<typeof FileSystemService>;

    // Create temporary directory for test files
    tempDir = path.join(os.tmpdir(), `task-manager-test-${Date.now()}`);
    tasksFilePath = path.join(tempDir, "test-tasks.json");

    // Create a new TaskManager instance for each test
    taskManager = new TaskManager(tasksFilePath);
    
    // This is important - we need to make sure the instance has properly initialized
    // before running tests
    await taskManager["initialized"];
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Configuration and Constants', () => {
    describe('Tools Configuration', () => {
      it('should have the required tools', () => {
        const toolNames = ALL_TOOLS.map(tool => tool.name);
        expect(toolNames).toContain('list_projects');
        expect(toolNames).toContain('create_project');
        expect(toolNames).toContain('delete_project');
        expect(toolNames).toContain('add_tasks_to_project');
        expect(toolNames).toContain('finalize_project');
        expect(toolNames).toContain('read_project');
        
        expect(toolNames).toContain('read_task');
        expect(toolNames).toContain('update_task');
        expect(toolNames).toContain('delete_task');
        expect(toolNames).toContain('approve_task');
        expect(toolNames).toContain('get_next_task');
      });
      
      it('should have proper tool schemas', () => {
        ALL_TOOLS.forEach(tool => {
          expect(tool).toHaveProperty('name');
          expect(tool).toHaveProperty('description');
          expect(tool).toHaveProperty('inputSchema');
          expect(tool.inputSchema).toHaveProperty('type', 'object');
        });
      });
    });
    
    describe('Status Transition Rules', () => {
      it('should define valid transitions from not started status', () => {
        expect(VALID_STATUS_TRANSITIONS['not started']).toEqual(['in progress']);
      });
      
      it('should define valid transitions from in progress status', () => {
        expect(VALID_STATUS_TRANSITIONS['in progress']).toContain('done');
        expect(VALID_STATUS_TRANSITIONS['in progress']).toContain('not started');
        expect(VALID_STATUS_TRANSITIONS['in progress'].length).toBe(2);
      });
      
      it('should define valid transitions from done status', () => {
        expect(VALID_STATUS_TRANSITIONS['done']).toEqual(['in progress']);
      });
      
      it('should not allow direct transition from not started to done', () => {
        const notStartedTransitions = VALID_STATUS_TRANSITIONS['not started'];
        expect(notStartedTransitions).not.toContain('done');
      });
    });
  });

  describe('Basic Project Operations', () => {
    it('should handle project creation', async () => {
      const result = await taskManager.createProject(
        'Test project',
        [
          {
            title: 'Test task',
            description: 'Test description'
          }
        ],
        'Test plan'
      );

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.projectId).toBeDefined();
        expect(result.data.totalTasks).toBe(1);

        // Verify mock state was updated (optional, but good for debugging mocks)
        expect(currentMockData.projects).toHaveLength(1);
        expect(currentMockData.projects[0].projectId).toBe(result.data.projectId);
        expect(currentMaxProjectId).toBe(1); // Assuming it starts at 1
        expect(currentMaxTaskId).toBe(1);
      }
    });

    it('should handle project listing', async () => {
      // Create a project first
      const createResult = await taskManager.createProject(
        'Test project',
        [
          {
            title: 'Test task',
            description: 'Test description'
          }
        ],
        'Test plan'
      );

      const result = await taskManager.listProjects();
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.projects).toHaveLength(1);
      }
    });

    it('should handle project deletion', async () => {
      // Create a project first
      const createResult = await taskManager.createProject(
        'Test project',
        [
          {
            title: 'Test task',
            description: 'Test description'
          }
        ],
        'Test plan'
      );

      if (createResult.status === 'success') {
        // Delete the project directly using data model access
        const projectIndex = taskManager["data"].projects.findIndex((p: { projectId: string }) => p.projectId === createResult.data.projectId);
        taskManager["data"].projects.splice(projectIndex, 1);
        await taskManager["saveTasks"]();
      }
      
      // Verify deletion
      const listResult = await taskManager.listProjects();
      if (listResult.status === 'success') {
        expect(listResult.data.projects).toHaveLength(0);
      }
    });
  });

  describe('Basic Task Operations', () => {
    it('should handle task operations', async () => {
      // Create a project first
      const createResult = await taskManager.createProject(
        'Test project',
        [
          {
            title: 'Test task',
            description: 'Test description'
          }
        ],
        'Test plan'
      );

      if (createResult.status === 'success') {
        const projectId = createResult.data.projectId;
        const taskId = createResult.data.tasks[0].id;

        // Test task reading
        const readResult = await taskManager.openTaskDetails(taskId);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          // Ensure task exists before checking id
          expect(readResult.data.task).toBeDefined(); 
          if (readResult.data.task) {
              expect(readResult.data.task.id).toBe(taskId);
          }
        }

        // Test task updating
        const updatedTask = await taskManager.updateTask(projectId, taskId, {
          title: "Updated task",
          description: "Updated description"
        });
        expect(updatedTask.status).toBe('success');
        if (updatedTask.status === 'success') {
          expect(updatedTask.data.title).toBe("Updated task");
          expect(updatedTask.data.description).toBe("Updated description");
          expect(updatedTask.data.status).toBe("not started");
        }
        
        // Test status update
        const updatedStatusTask = await taskManager.updateTask(projectId, taskId, {
          status: 'in progress'
        });
        expect(updatedStatusTask.status).toBe('success');
        if (updatedStatusTask.status === 'success') {
          expect(updatedStatusTask.data.status).toBe('in progress');
        }

        // Test task deletion
        const deleteResult = await taskManager.deleteTask(
          projectId,
          taskId
        );
        expect(deleteResult.status).toBe('success');
      }
    });
    
    it('should get the next task', async () => {
      // Create a project with multiple tasks
      const createResult = await taskManager.createProject(
        'Test project with multiple tasks',
        [
          {
            title: 'Task 1',
            description: 'Description 1'
          },
          {
            title: 'Task 2',
            description: 'Description 2'
          }
        ]
      );

      if (createResult.status === 'success') {
        const projectId = createResult.data.projectId;
        
        // Get the next task
        const nextTaskResult = await taskManager.getNextTask(projectId);
        
        expect(nextTaskResult.status).toBe('next_task');
        if (nextTaskResult.status === 'next_task') {
          expect(nextTaskResult.data.id).toBe(createResult.data.tasks[0].id);
        }
      }
    });
  });

  describe('Project Approval', () => {
    let projectId: string;
    let taskId1: string;
    let taskId2: string;
    
    beforeEach(async () => {
      // Create a project with two tasks for each test in this group
      const createResult = await taskManager.createProject(
        'Test project for approval',
        [
          {
            title: 'Task 1',
            description: 'Description for task 1'
          },
          {
            title: 'Task 2',
            description: 'Description for task 2'
          }
        ]
      );
      
      if (createResult.status === 'success') {
        projectId = createResult.data.projectId;
        taskId1 = createResult.data.tasks[0].id;
        taskId2 = createResult.data.tasks[1].id;
      }
    });
    
    it('should not approve project if tasks are not done', async () => {
      await expect(taskManager.approveProjectCompletion(projectId)).rejects.toMatchObject({
        code: 'ERR_3003',
        message: 'Not all tasks are done'
      });
    });
    
    it('should not approve project if tasks are done but not approved', async () => {
      // Mark both tasks as done
      await taskManager.updateTask(projectId, taskId1, {
        status: 'done',
        completedDetails: 'Task 1 completed details'
      });
      await taskManager.updateTask(projectId, taskId2, {
        status: 'done',
        completedDetails: 'Task 2 completed details'
      });
      
      await expect(taskManager.approveProjectCompletion(projectId)).rejects.toMatchObject({
        code: 'ERR_3004',
        message: 'Not all done tasks are approved'
      });
    });
    
    it('should approve project when all tasks are done and approved', async () => {
      // Mark both tasks as done and approved
      await taskManager.updateTask(projectId, taskId1, {
        status: 'done',
        completedDetails: 'Task 1 completed details'
      });
      await taskManager.updateTask(projectId, taskId2, {
        status: 'done',
        completedDetails: 'Task 2 completed details'
      });
      
      // Approve tasks
      await taskManager.approveTaskCompletion(projectId, taskId1);
      await taskManager.approveTaskCompletion(projectId, taskId2);
      
      const result = await taskManager.approveProjectCompletion(projectId);
      expect(result.status).toBe('success');
      
      // Verify project is marked as completed
      const project = taskManager["data"].projects.find((p: { projectId: string }) => p.projectId === projectId);
      expect(project?.completed).toBe(true);
    });
    
    it('should not allow approving an already completed project', async () => {
      // First approve the project
      await taskManager.updateTask(projectId, taskId1, {
        status: 'done',
        completedDetails: 'Task 1 completed details'
      });
      await taskManager.updateTask(projectId, taskId2, {
        status: 'done',
        completedDetails: 'Task 2 completed details'
      });
      await taskManager.approveTaskCompletion(projectId, taskId1);
      await taskManager.approveTaskCompletion(projectId, taskId2);
      
      await taskManager.approveProjectCompletion(projectId);
      
      // Try to approve again
      await expect(taskManager.approveProjectCompletion(projectId)).rejects.toMatchObject({
        code: 'ERR_3001',
        message: 'Project is already completed'
      });
    });
  });

  describe('Task and Project Filtering', () => {
    describe('listProjects', () => {
      it('should list only open projects', async () => {
        // Create some projects. One open and one complete
        const project1 = await taskManager.createProject("Open Project", [{ title: "Task 1", description: "Desc" }]);
        const project2 = await taskManager.createProject("Completed project", [{ title: "Task 2", description: "Desc" }]);

        // Ensure both projects were created successfully before proceeding
        if (project1.status === 'success' && project2.status === 'success') {
          const project1Data = project1.data; // Assign data
          const project2Data = project2.data; // Assign data

          const proj1Id = project1Data.projectId;
          const proj2Id = project2Data.projectId;

          // Mark task and project as done and approved
          await taskManager.updateTask(proj2Id, project2Data.tasks[0].id, { status: 'done' });
          await taskManager.approveTaskCompletion(proj2Id, project2Data.tasks[0].id);
          await taskManager.approveProjectCompletion(proj2Id);
          // Project 2 is now completed

          const result = await taskManager.listProjects("open");
          expect(result.status).toBe('success');
          // Add type guard for result
          if (result.status === 'success') {
            expect(result.data.projects.length).toBe(1);
            expect(result.data.projects[0].projectId).toBe(proj1Id);
          }
        }
      });

      it('should list only pending approval projects', async () => {
        // Create some projects with different states
        const project1 = await taskManager.createProject("Pending Project", [{ title: "Task 1", description: "Desc" }]);
        const project2 = await taskManager.createProject("Open Project", [{ title: "Task 2", description: "Desc" }]);
        const project3 = await taskManager.createProject("In Progress Project", [{ title: "Task 3", description: "Desc" }]);

        // Ensure projects were created successfully
        if (project1.status === 'success' && project2.status === 'success') {
          const project1Data = project1.data; // Assign data
          const project2Data = project2.data; // Assign data

          // Mark task1 as done but not approved
          await taskManager.updateTask(project1Data.projectId, project1Data.tasks[0].id, {
            status: 'done'
          });
          // Don't approve it, project1 should be pending_approval

          // Mark task2 as in progress
          await taskManager.updateTask(project2Data.projectId, project2Data.tasks[0].id, {
            status: 'in progress'
          });
          // project2 should remain open

          const result = await taskManager.listProjects("pending_approval");
          expect(result.status).toBe('success');
          // Add type guard for result
          if (result.status === 'success') {
            expect(result.data.projects.length).toBe(1);
            expect(result.data.projects[0].projectId).toBe(project1Data.projectId);
          }
        }
      });

      it('should list only completed projects', async () => {
        // Create projects
        const project1 = await taskManager.createProject("Open Project", [{ title: "Task 1", description: "Desc" }]);
        const project2 = await taskManager.createProject("Completed Project", [{ title: "Task 2", description: "Desc" }]);

        // Ensure projects were created successfully
        if (project1.status === 'success' && project2.status === 'success') {
          const project1Data = project1.data; // Assign data
          const project2Data = project2.data; // Assign data

          // Complete project 1 fully
          await taskManager.updateTask(project1Data.projectId, project1Data.tasks[0].id, {
            status: 'done'
          });
          await taskManager.approveTaskCompletion(project1Data.projectId, project1Data.tasks[0].id);
          await taskManager.approveProjectCompletion(project1Data.projectId);

          // Mark project 2 task as done but don't approve
          await taskManager.updateTask(project2Data.projectId, project2Data.tasks[0].id, {
            status: 'done'
          });

          const result = await taskManager.listProjects("completed");
          expect(result.status).toBe('success');
          // Add type guard for result
          if (result.status === 'success') {
            expect(result.data.projects.length).toBe(1);
            expect(result.data.projects[0].projectId).toBe(project1Data.projectId);
          }
        }
      });

      it('should list all projects when state is \'all\'', async () => {
        // Create projects with different states
        const project1 = await taskManager.createProject("Open Project", [{ title: "Task 1", description: "Desc" }]);
        const project2 = await taskManager.createProject("Completed project", [{ title: "Task 2", description: "Desc" }]);
        const project3 = await taskManager.createProject("Pending Project", [{ title: "Task 3", description: "Desc" }]);

        const result = await taskManager.listProjects("all");
        expect(result.status).toBe('success');
        if (result.status === 'success') {
          expect(result.data.projects.length).toBe(3);
        }
      });

      it('should handle empty project list', async () => {
        const result = await taskManager.listProjects("open");
        expect(result.status).toBe('success');
        if (result.status === 'success') {
          expect(result.data.projects.length).toBe(0);
        }
      });
    });

    describe('listTasks', () => {
      it('should list tasks across all projects filtered by state', async () => {
        // Create two projects with tasks in different states
        const project1 = await taskManager.createProject("Project 1", [
          { title: "Task 1", description: "Open task" },
          { title: "Task 2", description: "Done task" }
        ]);
        const project2 = await taskManager.createProject("Project 2", [
          { title: "Task 3", description: "Pending approval task" }
        ]);

        // Add type guard for project creation results
        if (project1.status === 'success' && project2.status === 'success') {
          // Set task states
          await taskManager.updateTask(project1.data.projectId, project1.data.tasks[1].id, {
            status: 'done',
            completedDetails: 'Task 2 completed details'
          });
          await taskManager.approveTaskCompletion(project1.data.projectId, project1.data.tasks[1].id);
    
          await taskManager.updateTask(project2.data.projectId, project2.data.tasks[0].id, {
            status: 'done',
            completedDetails: 'Task 3 completed details'
          });
    
          // Test open tasks
          const openResult = await taskManager.listTasks(undefined, "open");
          expect(openResult.status).toBe('success');
          if (openResult.status === 'success') {
            expect(openResult.data.tasks).toBeDefined();
            expect(openResult.data.tasks!.length).toBe(1);
            expect(openResult.data.tasks![0].title).toBe("Task 1");
          }
    
          // Test pending approval tasks
          const pendingResult = await taskManager.listTasks(undefined, "pending_approval");
          expect(pendingResult.status).toBe('success');
          if (pendingResult.status === 'success') {
            expect(pendingResult.data.tasks).toBeDefined();
            expect(pendingResult.data.tasks!.length).toBe(1);
            expect(pendingResult.data.tasks![0].title).toBe("Task 3");
          }
    
          // Test completed tasks
          const completedResult = await taskManager.listTasks(undefined, "completed");
          expect(completedResult.status).toBe('success');
          if (completedResult.status === 'success') {
            expect(completedResult.data.tasks).toBeDefined();
            expect(completedResult.data.tasks!.length).toBe(1);
            expect(completedResult.data.tasks![0].title).toBe("Task 2");
          }
        }
      });

      it('should list tasks for specific project filtered by state', async () => {
        // Create a project with multiple tasks
        const project = await taskManager.createProject("Specific Project Tasks", [
          { title: "Task 1", description: "Desc 1" }, // open
          { title: "Task 2", description: "Desc 2" }, // completed
          { title: "Task 3", description: "Desc 3" }  // pending approval
        ]);

        // Ensure project was created successfully
        if (project.status === 'success') {
            const projectData = project.data; // Assign data
          // Set task states
          await taskManager.updateTask(projectData.projectId, projectData.tasks[1].id, { // Use projectData
            status: 'done'
          }); // Task 2 done
          await taskManager.approveTaskCompletion(projectData.projectId, projectData.tasks[1].id); // Task 2 approved (completed)

          await taskManager.updateTask(projectData.projectId, projectData.tasks[2].id, { // Use projectData
            status: 'done'
          }); // Task 3 done (pending approval)

          // Test open tasks
          const openResult = await taskManager.listTasks(projectData.projectId, "open"); // Use projectData
          expect(openResult.status).toBe('success');
          // Add type guard for openResult
          if (openResult.status === 'success') {
            expect(openResult.data.tasks).toBeDefined();
            expect(openResult.data.tasks!.length).toBe(1);
            expect(openResult.data.tasks![0].title).toBe("Task 1");
          }
    
          // Test pending approval tasks
          const pendingResult = await taskManager.listTasks(projectData.projectId, "pending_approval"); // Use projectData
          expect(pendingResult.status).toBe('success');
          // Add type guard for pendingResult
          if (pendingResult.status === 'success') {
            expect(pendingResult.data.tasks).toBeDefined();
            expect(pendingResult.data.tasks!.length).toBe(1);
            expect(pendingResult.data.tasks![0].title).toBe("Task 3");
          }
    
          // Test completed tasks
          const completedResult = await taskManager.listTasks(projectData.projectId, "completed"); // Use projectData
          expect(completedResult.status).toBe('success');
          // Add type guard for completedResult
          if (completedResult.status === 'success') {
            expect(completedResult.data.tasks).toBeDefined();
            expect(completedResult.data.tasks!.length).toBe(1);
            expect(completedResult.data.tasks![0].title).toBe("Task 2");
          }
        }
      });

      it('should handle non-existent project ID', async () => {
        await expect(taskManager.listTasks("non-existent-project", "open")).rejects.toMatchObject({
          code: 'ERR_2000',
          message: 'Project non-existent-project not found'
        });
      });

      it('should handle empty task list', async () => {
        const project = await taskManager.createProject("Empty Project", []);
        // Add type guard for project creation
        if (project.status === 'success') {
            const projectData = project.data; // Assign data
          const result = await taskManager.listTasks(projectData.projectId, "open"); // Use projectData
          expect(result.status).toBe('success');
          // Add type guard for listTasks result
          if (result.status === 'success') {
            expect(result.data.tasks).toBeDefined();
            expect(result.data.tasks!.length).toBe(0);
          }
        }
      });
    });
  });

  describe('Task Recommendations', () => {
    it("should handle tasks with tool and rule recommendations", async () => {
      const createResult = await taskManager.createProject("Test Project", [
        { 
          title: "Test Task", 
          description: "Test Description",
          toolRecommendations: "Use tool X",
          ruleRecommendations: "Review rule Y"
        },
      ]);
      if (createResult.status === 'success') {
        const projectId = createResult.data.projectId;
        const tasksResponse = await taskManager.listTasks(projectId);
        if (tasksResponse.status !== 'success' || !tasksResponse.data.tasks?.length) {
          throw new Error('Expected tasks in response');
        }
        const tasks = tasksResponse.data.tasks as Task[];
        const taskId = tasks[0].id;

        // Verify initial recommendations
        expect(tasks[0].toolRecommendations).toBe("Use tool X");
        expect(tasks[0].ruleRecommendations).toBe("Review rule Y");

        // Update recommendations
        const updatedTask = await taskManager.updateTask(projectId, taskId, {
          toolRecommendations: "Use tool Z",
          ruleRecommendations: "Review rule W",
        });

        expect(updatedTask.status).toBe('success');
        if (updatedTask.status === 'success') {
          expect(updatedTask.data.toolRecommendations).toBe("Use tool Z");
          expect(updatedTask.data.ruleRecommendations).toBe("Review rule W");
        }

        // Add new task with recommendations
        await taskManager.addTasksToProject(projectId, [
          {
            title: "Added Task",
            description: "With recommendations",
            toolRecommendations: "Tool A",
            ruleRecommendations: "Rule B"
          }
        ]);

        const allTasksResponse = await taskManager.listTasks(projectId);
        if (allTasksResponse.status !== 'success' || !allTasksResponse.data.tasks?.length) {
          throw new Error('Expected tasks in response');
        }
        const allTasks = allTasksResponse.data.tasks as Task[];
        const newTask = allTasks.find(t => t.title === "Added Task");
        expect(newTask).toBeDefined();
        if (newTask) {
          expect(newTask.toolRecommendations).toBe("Tool A");
          expect(newTask.ruleRecommendations).toBe("Rule B");
        }
      }
    });

    it("should handle tasks with no recommendations", async () => {
      const createResult = await taskManager.createProject("Test Project", [
        { title: "Test Task", description: "Test Description" },
      ]);
      if (createResult.status === 'success') {
        const projectId = createResult.data.projectId;
        const tasksResponse = await taskManager.listTasks(projectId);
        if (tasksResponse.status !== 'success' || !tasksResponse.data.tasks?.length) {
          throw new Error('Expected tasks in response');
        }
        const tasks = tasksResponse.data.tasks as Task[];
        const taskId = tasks[0].id;

        // Verify no recommendations
        expect(tasks[0].toolRecommendations).toBeUndefined();
        expect(tasks[0].ruleRecommendations).toBeUndefined();

        // Add task without recommendations
        await taskManager.addTasksToProject(projectId, [
          { title: "Added Task", description: "No recommendations" }
        ]);

        const allTasksResponse = await taskManager.listTasks(projectId);
        if (allTasksResponse.status !== 'success' || !allTasksResponse.data.tasks?.length) {
          throw new Error('Expected tasks in response');
        }
        const allTasks = allTasksResponse.data.tasks as Task[];
        const newTask = allTasks.find(t => t.title === "Added Task");
        expect(newTask).toBeDefined();
        if (newTask) {
          expect(newTask.toolRecommendations).toBeUndefined();
          expect(newTask.ruleRecommendations).toBeUndefined();
        }
      }
    });
  });

  describe('Auto-approval of tasks', () => {
    it('should auto-approve tasks when updating status to done and autoApprove is enabled', async () => {
      // Create a project with autoApprove enabled
      const createResult = await taskManager.createProject(
        'Auto-approval for updateTask',
        [
          {
            title: 'Task to update',
            description: 'This task should be auto-approved when status is updated to done'
          }
        ],
        'Test plan',
        true // autoApprove parameter
      );
      
      if (createResult.status === 'success') {
        const projectId = createResult.data.projectId;
        const taskId = createResult.data.tasks[0].id;
        
        // Update the task status to done
        const updatedTask = await taskManager.updateTask(projectId, taskId, {
          status: 'done',
          completedDetails: 'Task completed via updateTask'
        });
        
        // The task should be automatically approved
        expect(updatedTask.status).toBe('success');
        if (updatedTask.status === 'success') {
          expect(updatedTask.data.status).toBe('done');
          expect(updatedTask.data.approved).toBe(true);
        }
      }
    });
    
    it('should not auto-approve tasks when updating status to done and autoApprove is disabled', async () => {
      // Create a project with autoApprove disabled
      const createResult = await taskManager.createProject(
        'Manual-approval for updateTask',
        [
          {
            title: 'Task to update manually',
            description: 'This task should not be auto-approved when status is updated to done'
          }
        ],
        'Test plan',
        false // autoApprove parameter
      );
      
      if (createResult.status === 'success') {
        const projectId = createResult.data.projectId;
        const taskId = createResult.data.tasks[0].id;
        
        // Update the task status to done
        const updatedTask = await taskManager.updateTask(projectId, taskId, {
          status: 'done',
          completedDetails: 'Task completed via updateTask'
        });
        
        // The task should not be automatically approved
        expect(updatedTask.status).toBe('success');
        if (updatedTask.status === 'success') {
          expect(updatedTask.data.status).toBe('done');
          expect(updatedTask.data.approved).toBe(false);
        }
      }
    });
    
    it('should make autoApprove false by default if not specified', async () => {
      // Create a project without specifying autoApprove
      const createResult = await taskManager.createProject(
        'Default-approval Project',
        [
          {
            title: 'Default-approved task',
            description: 'This task should follow the default approval behavior'
          }
        ]
      );
      
      if (createResult.status === 'success') {
        const projectId = createResult.data.projectId;
        const taskId = createResult.data.tasks[0].id;
        
        // Update the task status to done
        const updatedTask = await taskManager.updateTask(projectId, taskId, {
          status: 'done',
          completedDetails: 'Task completed via updateTask'
        });
        
        // The task should not be automatically approved by default
        expect(updatedTask.status).toBe('success');
        if (updatedTask.status === 'success') {
          expect(updatedTask.data.status).toBe('done');
          expect(updatedTask.data.approved).toBe(false);
        }
      }
    });
  });

  describe('Project Plan Generation', () => {
    const mockLLMResponse = {
      projectPlan: "Test project plan",
      tasks: [
        {
          title: "Task 1",
          description: "Description 1",
          toolRecommendations: "Use tool X",
          ruleRecommendations: "Follow rule Y"
        },
        {
          title: "Task 2",
          description: "Description 2"
        }
      ]
    };

    beforeEach(() => {
      // Reset mock implementations using the directly imported name
      (generateObject as jest.Mock).mockClear();
      (generateObject as jest.Mock).mockImplementation(() => Promise.resolve({ object: mockLLMResponse }));
      // If jsonSchema is used in these tests, reset it too
      (jsonSchema as jest.Mock).mockClear();
    });

    it('should generate a project plan with OpenAI provider', async () => {
      const result = await taskManager.generateProjectPlan({
        prompt: "Create a test project",
        provider: "openai",
        model: "gpt-4-turbo",
        attachments: []
      }) as StandardResponse<{
        projectId: string;
        totalTasks: number;
        tasks: Array<{ id: string; title: string; description: string }>;
      }>;

      const { openai } = await import('@ai-sdk/openai');
      expect(openai).toHaveBeenCalledWith("gpt-4-turbo");
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.projectId).toBeDefined();
        expect(result.data.totalTasks).toBe(2);
        expect(result.data.tasks[0].title).toBe("Task 1");
        expect(result.data.tasks[1].title).toBe("Task 2");
      }
    });

    it('should generate a project plan with Google provider', async () => {
      const result = await taskManager.generateProjectPlan({
        prompt: "Create a test project",
        provider: "google",
        model: "gemini-1.5-pro",
        attachments: []
      });

      const { google } = await import('@ai-sdk/google');
      expect(google).toHaveBeenCalledWith("gemini-1.5-pro");
      expect(result.status).toBe('success');
    });

    it('should generate a project plan with Deepseek provider', async () => {
      const result = await taskManager.generateProjectPlan({
        prompt: "Create a test project",
        provider: "deepseek",
        model: "deepseek-coder",
        attachments: []
      });

      const { deepseek } = await import('@ai-sdk/deepseek');
      expect(deepseek).toHaveBeenCalledWith("deepseek-coder");
      expect(result.status).toBe('success');
    });

    it('should handle attachments correctly', async () => {
      const result = await taskManager.generateProjectPlan({
        prompt: "Create based on spec",
        provider: "openai",
        model: "gpt-4-turbo",
        attachments: ["Spec content 1", "Spec content 2"]
      });

      const { prompt } = generateObject.mock.calls[0][0] as { prompt: string };
      expect(prompt).toContain("<prompt>Create based on spec</prompt>");
      expect(prompt).toContain("<attachment>Spec content 1</attachment>");
      expect(prompt).toContain("<attachment>Spec content 2</attachment>");
      expect(result.status).toBe('success');
    });

    it('should handle NoObjectGeneratedError', async () => {
      const error = new Error();
      error.name = 'NoObjectGeneratedError';
      // Set mock implementation via the imported name
      (generateObject as jest.Mock).mockImplementation(() => Promise.reject(error));

      await expect(taskManager.generateProjectPlan({
        prompt: "Create a test project",
        provider: "openai",
        model: "gpt-4-turbo",
        attachments: []
      })).rejects.toMatchObject({
        code: 'ERR_5001',
        message: "The LLM failed to generate a valid project plan. Please try again with a clearer prompt."
      });
    });

    it('should handle InvalidJSONError', async () => {
      const error = new Error();
      error.name = 'InvalidJSONError';
      // Set mock implementation via the imported name
      (generateObject as jest.Mock).mockImplementation(() => Promise.reject(error));

      await expect(taskManager.generateProjectPlan({
        prompt: "Create a test project",
        provider: "openai",
        model: "gpt-4-turbo",
        attachments: []
      })).rejects.toMatchObject({
        code: 'ERR_5001',
        message: "The LLM generated invalid JSON. Please try again."
      });
    });

    it('should handle rate limit errors', async () => {
      // Set mock implementation via the imported name
      (generateObject as jest.Mock).mockImplementation(() => Promise.reject(new Error('rate limit exceeded')));

      await expect(taskManager.generateProjectPlan({
        prompt: "Create a test project",
        provider: "openai",
        model: "gpt-4-turbo",
        attachments: []
      })).rejects.toMatchObject({
        code: 'ERR_1003',
        message: "Rate limit or quota exceeded for the LLM provider. Please try again later."
      });
    });

    it('should handle authentication errors', async () => {
      // Set mock implementation via the imported name
      (generateObject as jest.Mock).mockImplementation(() => Promise.reject(new Error('authentication failed')));

      await expect(taskManager.generateProjectPlan({
        prompt: "Create a test project",
        provider: "openai",
        model: "gpt-4-turbo",
        attachments: []
      })).rejects.toMatchObject({
        code: 'ERR_1003',
        message: "Invalid API key or authentication failed. Please check your environment variables."
      });
    });

    it('should handle invalid provider', async () => {
      await expect(taskManager.generateProjectPlan({
        prompt: "Create a test project",
        provider: "invalid",
        model: "gpt-4-turbo",
        attachments: []
      })).rejects.toMatchObject({
        code: 'ERR_1002',
        message: "Invalid provider: invalid"
      });
      // Ensure generateObject wasn't called for invalid provider
      expect(generateObject).not.toHaveBeenCalled();
    });
  });
}); 
