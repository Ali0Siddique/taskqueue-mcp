import { Command } from "commander";
import chalk from "chalk";
import { 
  ErrorCode, 
  TaskState, 
  Task, 
  Project
} from "../types/index.js";
import { TaskManager } from "../server/TaskManager.js";
import { createError, normalizeError } from "../utils/errors.js";
import { formatCliError } from "./errors.js";
import { formatProjectsList, formatTaskProgressTable } from "./taskFormattingUtils.js";

const program = new Command();

program
  .name("taskqueue")
  .description("CLI for the Task Manager MCP Server")
  .version("1.3.1")
  .option(
    '-f, --file-path <path>',
    'Specify the path to the tasks JSON file. Overrides TASK_MANAGER_FILE_PATH env var.'
  );

let taskManager: TaskManager;

program.hook('preAction', (thisCommand, actionCommand) => {
  const cliFilePath = program.opts().filePath;
  const envFilePath = process.env.TASK_MANAGER_FILE_PATH;
  const resolvedPath = cliFilePath || envFilePath || undefined;

  try {
    taskManager = new TaskManager(resolvedPath);
  } catch (error) {
    console.error(chalk.red(`Failed to initialize TaskManager: ${formatCliError(normalizeError(error))}`));
    process.exit(1);
  }
});

program
  .command("approve")
  .description("Approve a completed task")
  .argument("<projectId>", "Project ID")
  .argument("<taskId>", "Task ID")
  .option('-f, --force', 'Force approval even if task is not marked as done')
  .action(async (projectId, taskId, options) => {
    try {
      console.log(chalk.blue(`Attempting to approve task ${chalk.bold(taskId)} in project ${chalk.bold(projectId)}...`));

      // First, verify the project and task exist and get their details
      let project: Project;
      let task: Task | undefined;
      try {
        const projectResponse = await taskManager.readProject(projectId);
        if ('error' in projectResponse) {
          throw projectResponse.error;
        }
        if (projectResponse.status !== "success") {
          throw createError(ErrorCode.InvalidResponseFormat, "Unexpected response format from TaskManager");
        }
        project = projectResponse.data;
        task = project.tasks.find(t => t.id === taskId);

        if (!task) {
          console.error(chalk.red(`Task ${chalk.bold(taskId)} not found in project ${chalk.bold(projectId)}.`));
          console.log(chalk.yellow('Available tasks in this project:'));
          project.tasks.forEach((t: Task) => {
            console.log(`  - ${t.id}: ${t.title} (Status: ${t.status}, Approved: ${t.approved ? 'Yes' : 'No'})`);
          });
          process.exit(1);
        }
      } catch (error) {
        const normalized = normalizeError(error);
        if (normalized.code === ErrorCode.ProjectNotFound) {
          console.error(chalk.red(`Project ${chalk.bold(projectId)} not found.`));
          // Optionally list available projects
          const projectsResponse = await taskManager.listProjects();
          if ('error' in projectsResponse) {
            throw projectsResponse.error;
          }
          if (projectsResponse.status === "success" && projectsResponse.data.projects.length > 0) {
            console.log(chalk.yellow('Available projects:'));
            projectsResponse.data.projects.forEach((p: { projectId: string; initialPrompt: string }) => {
              console.log(`  - ${p.projectId}: ${p.initialPrompt.substring(0, 50)}${p.initialPrompt.length > 50 ? '...' : ''}`);
            });
          } else {
            console.log(chalk.yellow('No projects available.'));
          }
          process.exit(1);
        }
        throw error; // Re-throw other errors
      }

      // Pre-check task status if not using force
      if (task.status !== "done" && !options.force) {
        console.error(chalk.red(`Task ${chalk.bold(taskId)} is not marked as done yet. Current status: ${chalk.bold(task.status)}`));
        console.log(chalk.yellow(`Use the --force flag to attempt approval anyway (may fail if underlying logic prevents it), or wait for the task to be marked as done.`));
        process.exit(1);
      }

      if (task.approved) {
        console.log(chalk.yellow(`Task ${chalk.bold(taskId)} is already approved.`));
        process.exit(0);
      }

      // Attempt to approve the task
      const approvalResponse = await taskManager.approveTaskCompletion(projectId, taskId);
      if ('error' in approvalResponse) {
        throw approvalResponse.error;
      }
      console.log(chalk.green(`✅ Task ${chalk.bold(taskId)} in project ${chalk.bold(projectId)} has been approved.`));

      // Fetch updated project data for display
      const updatedProjectResponse = await taskManager.readProject(projectId);
      if ('error' in updatedProjectResponse) {
        throw updatedProjectResponse.error;
      }
      if (updatedProjectResponse.status !== "success") {
        throw createError(ErrorCode.InvalidResponseFormat, "Unexpected response format from TaskManager");
      }
      const updatedProject = updatedProjectResponse.data;
      const updatedTask = updatedProject.tasks.find(t => t.id === taskId);

      // Show task info
      if (updatedTask) {
        console.log(chalk.cyan('\n📋 Task details:'));
        console.log(`  - ${chalk.bold('Title:')} ${updatedTask.title}`);
        console.log(`  - ${chalk.bold('Description:')} ${updatedTask.description}`);
        console.log(`  - ${chalk.bold('Status:')} ${updatedTask.status === 'done' ? chalk.green('Done ✓') : updatedTask.status === 'in progress' ? chalk.yellow('In Progress ⟳') : chalk.blue('Not Started ○')}`);
        console.log(`  - ${chalk.bold('Completed details:')} ${updatedTask.completedDetails || chalk.gray("None")}`);
        console.log(`  - ${chalk.bold('Approved:')} ${updatedTask.approved ? chalk.green('Yes ✓') : chalk.red('No ✗')}`);
        if (updatedTask.toolRecommendations) {
          console.log(`  - ${chalk.bold('Tool Recommendations:')} ${updatedTask.toolRecommendations}`);
        }
        if (updatedTask.ruleRecommendations) {
          console.log(`  - ${chalk.bold('Rule Recommendations:')} ${updatedTask.ruleRecommendations}`);
        }
      }

      // Show progress info
      const totalTasks = updatedProject.tasks.length;
      const completedTasks = updatedProject.tasks.filter(t => t.status === "done").length;
      const approvedTasks = updatedProject.tasks.filter(t => t.approved).length;

      console.log(chalk.cyan(`\n📊 Progress: ${chalk.bold(`${approvedTasks}/${completedTasks}/${totalTasks}`)} (approved/completed/total)`));

      // Create a progress bar
      const bar = '▓'.repeat(approvedTasks) + '▒'.repeat(completedTasks - approvedTasks) + '░'.repeat(totalTasks - completedTasks);
      console.log(`  ${bar}`);

      if (completedTasks === totalTasks && approvedTasks === totalTasks) {
        console.log(chalk.green('\n🎉 All tasks are completed and approved!'));
        console.log(chalk.blue(`The project can now be finalized using: taskqueue finalize ${projectId}`));
      } else {
        if (totalTasks - completedTasks > 0) {
          console.log(chalk.yellow(`\n${totalTasks - completedTasks} tasks remaining to be completed.`));
        }
        if (completedTasks - approvedTasks > 0) {
          console.log(chalk.yellow(`${completedTasks - approvedTasks} tasks remaining to be approved.`));
        }
      }
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.code === ErrorCode.TaskNotDone) {
        console.error(chalk.red(`Approval failed: Task ${chalk.bold(taskId)} is not marked as 'done' according to the Task Manager.`));
        // Just show the error message which should contain all relevant information
        // No need to try to access status from details since it's not guaranteed to be there
        console.error(chalk.red(normalized.message));
        process.exit(1);
      }
      // Handle other errors generally
      console.error(chalk.red(formatCliError(normalized)));
      process.exit(1);
    }
  });

program
  .command("finalize")
  .description("Mark a project as complete")
  .argument("<projectId>", "Project ID")
  .action(async (projectId) => {
    try {
      console.log(chalk.blue(`Attempting to finalize project ${chalk.bold(projectId)}...`));

      // First, verify the project exists and get its details
      let project: Project;
      try {
        const projectResponse = await taskManager.readProject(projectId);
        if ('error' in projectResponse) {
          throw projectResponse.error;
        }
        if (projectResponse.status !== "success") {
          throw createError(ErrorCode.InvalidResponseFormat, "Unexpected response format from TaskManager");
        }
        project = projectResponse.data;
      } catch (error) {
        const normalized = normalizeError(error);
        if (normalized.code === ErrorCode.ProjectNotFound) {
          console.error(chalk.red(`Project ${chalk.bold(projectId)} not found.`));
          // Optionally list available projects
          const projectsResponse = await taskManager.listProjects();
          if ('error' in projectsResponse) {
            throw projectsResponse.error;
          }
          if (projectsResponse.status === "success" && projectsResponse.data.projects.length > 0) {
            console.log(chalk.yellow('Available projects:'));
            projectsResponse.data.projects.forEach((p: { projectId: string; initialPrompt: string }) => {
              console.log(`  - ${p.projectId}: ${p.initialPrompt.substring(0, 50)}${p.initialPrompt.length > 50 ? '...' : ''}`);
            });
          } else {
            console.log(chalk.yellow('No projects available.'));
          }
          process.exit(1);
        }
        throw error; // Re-throw other errors
      }

      // Pre-check project status
      if (project.completed) {
        console.log(chalk.yellow(`Project ${chalk.bold(projectId)} is already marked as completed.`));
        process.exit(0);
      }

      // Pre-check task status (for better user feedback before attempting finalization)
      const allDone = project.tasks.every((t: Task) => t.status === "done");
      if (!allDone) {
        console.error(chalk.red(`Not all tasks in project ${chalk.bold(projectId)} are marked as done.`));
        console.log(chalk.yellow('\nPending tasks:'));
        project.tasks.filter((t: Task) => t.status !== "done").forEach((t: Task) => {
          console.log(`  - ${chalk.bold(t.id)}: ${t.title} (Status: ${t.status})`);
        });
        process.exit(1);
      }

      const allApproved = project.tasks.every((t: Task) => t.approved);
      if (!allApproved) {
        console.error(chalk.red(`Not all tasks in project ${chalk.bold(projectId)} are approved yet.`));
        console.log(chalk.yellow('\nUnapproved tasks:'));
        project.tasks.filter((t: Task) => !t.approved).forEach((t: Task) => {
          console.log(`  - ${chalk.bold(t.id)}: ${t.title}`);
        });
        process.exit(1);
      }

      // Attempt to finalize the project
      const finalizationResponse = await taskManager.approveProjectCompletion(projectId);
      if ('error' in finalizationResponse) {
        throw finalizationResponse.error;
      }
      console.log(chalk.green(`✅ Project ${chalk.bold(projectId)} has been approved and marked as complete.`));

      // Fetch updated project data for display
      const updatedProjectResponse = await taskManager.readProject(projectId);
      if ('error' in updatedProjectResponse) {
        throw updatedProjectResponse.error;
      }
      if (updatedProjectResponse.status !== "success") {
        throw createError(ErrorCode.InvalidResponseFormat, "Unexpected response format from TaskManager");
      }
      const updatedProject = updatedProjectResponse.data;

      // Show project info
      console.log(chalk.cyan('\n📋 Project details:'));
      console.log(`  - ${chalk.bold('Initial Prompt:')} ${updatedProject.initialPrompt}`);
      if (updatedProject.projectPlan && updatedProject.projectPlan !== updatedProject.initialPrompt) {
        console.log(`  - ${chalk.bold('Project Plan:')} ${updatedProject.projectPlan}`);
      }
      console.log(`  - ${chalk.bold('Status:')} ${chalk.green('Completed ✓')}`);

      // Show progress info
      const totalTasks = updatedProject.tasks.length;
      const completedTasks = updatedProject.tasks.filter((t: Task) => t.status === "done").length;
      const approvedTasks = updatedProject.tasks.filter((t: Task) => t.approved).length;
      
      console.log(chalk.cyan(`\n📊 Final Progress: ${chalk.bold(`${approvedTasks}/${completedTasks}/${totalTasks}`)} (approved/completed/total)`));
      
      // Create a progress bar
      const bar = '▓'.repeat(approvedTasks) + '▒'.repeat(completedTasks - approvedTasks) + '░'.repeat(totalTasks - completedTasks);
      console.log(`  ${bar}`);

      console.log(chalk.green('\n🎉 Project successfully completed and approved!'));
      console.log(chalk.gray('You can view the project details anytime using:'));
      console.log(chalk.blue(`  taskqueue list -p ${projectId}`));

    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.code === ErrorCode.TasksNotAllDone) {
        console.error(chalk.red(`Finalization failed: Not all tasks in project ${chalk.bold(projectId)} are marked as done.`));
        // We already showed pending tasks in pre-check, no need to show again
        process.exit(1);
      }
      if (normalized.code === ErrorCode.TasksNotAllApproved) {
        console.error(chalk.red(`Finalization failed: Not all completed tasks in project ${chalk.bold(projectId)} are approved yet.`));
        // We already showed unapproved tasks in pre-check, no need to show again
        process.exit(1);
      }
      if (normalized.code === ErrorCode.ProjectAlreadyCompleted) {
        console.log(chalk.yellow(`Project ${chalk.bold(projectId)} was already marked as completed.`));
        process.exit(0);
      }
      // Handle other errors generally
      console.error(chalk.red(formatCliError(normalized)));
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List project summaries, or list tasks for a specific project")
  .option('-p, --project <projectId>', 'Show details and tasks for a specific project')
  .option('-s, --state <state>', "Filter by task/project state (open, pending_approval, completed, all)")
  .action(async (options) => {
    try {
      // Validate state option if provided
      const validStates = ['open', 'pending_approval', 'completed', 'all'] as const;
      const stateOption = options.state as TaskState | undefined | 'all';
      if (stateOption && !validStates.includes(stateOption)) {
        console.error(chalk.red(`Invalid state value: ${options.state}`));
        console.log(chalk.yellow(`Valid states are: ${validStates.join(', ')}`));
        process.exit(1);
      }
      const filterState = (stateOption === 'all' || !stateOption) ? undefined : stateOption as TaskState;

      if (options.project) {
        // Show details for a specific project
        const projectId = options.project;
        try {
            const projectResponse = await taskManager.readProject(projectId);
            if ('error' in projectResponse) throw projectResponse.error;
            if (projectResponse.status !== "success") throw createError(ErrorCode.InvalidResponseFormat, "Unexpected response");
            
            const project = projectResponse.data;

            // Filter tasks based on state if provided
            const tasksToList = filterState
              ? project.tasks.filter((task) => {
                  if (filterState === 'open') return task.status !== 'done';
                  if (filterState === 'pending_approval') return task.status === 'done' && !task.approved;
                  if (filterState === 'completed') return task.status === 'done' && task.approved;
                  return true; // Should not happen
                })
              : project.tasks;

            // Use the formatter for the progress table - it now includes the header
            const projectForTableDisplay = { ...project, tasks: tasksToList };
            console.log(formatTaskProgressTable(projectForTableDisplay));

            if (tasksToList.length === 0) {
               console.log(chalk.yellow(`\nNo tasks found${filterState ? ` matching state '${filterState}'` : ''} in project ${projectId}.`));
            } else if (filterState) {
               console.log(chalk.dim(`(Filtered by state: ${filterState})`));
            }

        } catch (error: unknown) {
            const normalized = normalizeError(error);
            if (normalized.code === ErrorCode.ProjectNotFound) {
                 console.error(chalk.red(`Project ${chalk.bold(projectId)} not found.`));
                 // Optionally list available projects
                 const projectsResponse = await taskManager.listProjects(); // Fetch summaries
                 if (projectsResponse.status === "success" && projectsResponse.data.projects.length > 0) {
                    console.log(chalk.yellow('Available projects:'));
                    projectsResponse.data.projects.forEach((p: { projectId: string; initialPrompt: string }) => {
                         console.log(`  - ${p.projectId}: ${p.initialPrompt.substring(0, 50)}${p.initialPrompt.length > 50 ? '...' : ''}`);
                    });
                 } else if (projectsResponse.status === "success"){
                     console.log(chalk.yellow('No projects available.'));
                 }
                 // else: error fetching list, handled by outer catch
                 process.exit(1);
            } else {
                console.error(chalk.red(formatCliError(normalized)));
                process.exit(1);
            }
        }
      } else {
        // List all projects, potentially filtered
        const projectsSummaryResponse = await taskManager.listProjects(filterState);
        if ('error' in projectsSummaryResponse) throw projectsSummaryResponse.error;
        if (projectsSummaryResponse.status !== "success") throw createError(ErrorCode.InvalidResponseFormat, "Unexpected response");

        const projectSummaries = projectsSummaryResponse.data.projects;

        if (projectSummaries.length === 0) {
          console.log(chalk.yellow(`No projects found${filterState ? ` matching state '${filterState}'` : ''}.`));
          return;
        }

        // Use the formatter directly with the summary data
        console.log(chalk.cyan(formatProjectsList(projectSummaries)));
        if (filterState) {
          console.log(chalk.dim(`(Filtered by state: ${filterState})`));
        }
      }
    } catch (error) {
      console.error(chalk.red(formatCliError(normalizeError(error))));
      process.exit(1);
    }
  });

program
  .command("generate-plan")
  .description("Generate a project plan using an LLM")
  .requiredOption("--prompt <text>", "Prompt text to feed to the LLM")
  .option("--model <model>", "LLM model to use", "gpt-4-turbo")
  .option("--provider <provider>", "LLM provider to use (openai, google, or deepseek)", "openai")
  .option("--attachment <file>", "File to attach as context (can be specified multiple times)", collect, [])
  .action(async (options) => {    
    try {
      console.log(chalk.blue(`Generating project plan from prompt...`));
      console.log(options.attachment);

      // Pass attachment filenames directly to the server
      const response = await taskManager.generateProjectPlan({
        prompt: options.prompt,
        provider: options.provider,
        model: options.model,
        attachments: options.attachment
      });

      if ('error' in response) {
        throw response.error;
      }

      if (response.status !== "success") {
        throw createError(
          ErrorCode.InvalidResponseFormat,
          "Unexpected response format from TaskManager"
        );
      }

      const data = response.data as {
        projectId: string;
        totalTasks: number;
        tasks: Array<{
          id: string;
          title: string;
          description: string;
        }>;
        message?: string;
      };

      // Display the results
      console.log(chalk.green(`✅ Project plan generated successfully!`));
      console.log(chalk.cyan('\n📋 Project details:'));
      console.log(`  - ${chalk.bold('Project ID:')} ${data.projectId}`);
      console.log(`  - ${chalk.bold('Total Tasks:')} ${data.totalTasks}`);
      
      console.log(chalk.cyan('\n📝 Tasks:'));
      data.tasks.forEach((task) => {
        console.log(`\n  ${chalk.bold(task.id)}:`);
        console.log(`    Title: ${task.title}`);
        console.log(`    Description: ${task.description}`);
      });

      if (data.message) {
        console.log(`\n${data.message}`);
      }
    } catch (err: unknown) {
        const normalized = normalizeError(err);
        console.error(`Error: ${chalk.red(formatCliError(normalized))}`);
      process.exit(1);
    }
  });

// Helper function for collecting multiple values for the same option
function collect(value: string, previous: string[]) {
  return previous.concat([value]);
}

// Export program for testing purposes
export { program };