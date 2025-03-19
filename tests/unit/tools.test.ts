import { jest, describe, it, expect } from '@jest/globals';
import { ALL_TOOLS } from '../../src/types/tools.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

interface SchemaProperty {
  type: string;
  enum?: string[];
  description?: string;
}

describe('Tools', () => {
  it('should have all required project tools', () => {
    const toolNames = ALL_TOOLS.map(tool => tool.name);
    expect(toolNames).toContain('list_projects');
    expect(toolNames).toContain('read_project');
    expect(toolNames).toContain('create_project');
    expect(toolNames).toContain('delete_project');
    expect(toolNames).toContain('add_tasks_to_project');
    expect(toolNames).toContain('finalize_project');
  });

  it('should have all required task tools', () => {
    const toolNames = ALL_TOOLS.map(tool => tool.name);
    expect(toolNames).toContain('list_tasks');
    expect(toolNames).toContain('read_task');
    expect(toolNames).toContain('create_task');
    expect(toolNames).toContain('update_task');
    expect(toolNames).toContain('delete_task');
    expect(toolNames).toContain('approve_task');
    expect(toolNames).toContain('get_next_task');
  });

  it('should have create_project tool with correct schema', () => {
    const createProjectTool = ALL_TOOLS.find(tool => tool.name === 'create_project') as Tool;
    expect(createProjectTool).toBeDefined();
    expect(createProjectTool.inputSchema.required).toContain('initialPrompt');
    expect(createProjectTool.inputSchema.required).toContain('tasks');
    
    // Check that the tool schema has the expected properties
    const props = createProjectTool.inputSchema.properties;
    expect(props).toBeDefined();
    expect(props).toHaveProperty('initialPrompt');
    expect(props).toHaveProperty('projectPlan');
    expect(props).toHaveProperty('tasks');
  });

  it('should have update_task tool with correct schema', () => {
    const updateTaskTool = ALL_TOOLS.find(tool => tool.name === 'update_task') as Tool;
    expect(updateTaskTool).toBeDefined();
    expect(updateTaskTool.inputSchema.required).toContain('projectId');
    expect(updateTaskTool.inputSchema.required).toContain('taskId');
    
    // Check that the tool schema has the expected properties
    const props = updateTaskTool.inputSchema.properties;
    expect(props).toBeDefined();
    expect(props).toHaveProperty('projectId');
    expect(props).toHaveProperty('taskId');
    expect(props).toHaveProperty('title');
    expect(props).toHaveProperty('description');
    expect(props).toHaveProperty('status');
    expect(props).toHaveProperty('completedDetails');
    
    // Check that status has the correct enum values
    const statusProp = props?.status as SchemaProperty;
    expect(statusProp).toBeDefined();
    expect(statusProp.enum).toContain('not started');
    expect(statusProp.enum).toContain('in progress');
    expect(statusProp.enum).toContain('done');
    
    // Check that completedDetails is not in required fields
    expect(updateTaskTool.inputSchema.required).not.toContain('completedDetails');
  });
  
  it('should have get_next_task tool with correct schema', () => {
    const getNextTaskTool = ALL_TOOLS.find(tool => tool.name === 'get_next_task') as Tool;
    expect(getNextTaskTool).toBeDefined();
    expect(getNextTaskTool.inputSchema.required).toContain('projectId');
    
    const props = getNextTaskTool.inputSchema.properties;
    expect(props).toBeDefined();
    expect(props).toHaveProperty('projectId');
  });
  
  // General checks for all tools
  describe('All tools', () => {
    ALL_TOOLS.forEach(tool => {
      describe(`${tool.name} tool`, () => {
        it('should have basic required properties', () => {
          expect(tool).toHaveProperty('name');
          expect(tool).toHaveProperty('description');
          expect(tool).toHaveProperty('inputSchema');
          expect(typeof tool.name).toBe('string');
          expect(typeof tool.description).toBe('string');
        });
        
        it('should have valid inputSchema', () => {
          expect(tool.inputSchema.type).toBe('object');
          expect(Array.isArray(tool.inputSchema.required)).toBe(true);
        });
        
        it('should have descriptions for all properties', () => {
          const props = tool.inputSchema.properties;
          if (props) {
            for (const propName in props) {
              const prop = props[propName] as SchemaProperty;
              expect(prop.description).toBeDefined();
              expect(typeof prop.description).toBe('string');
            }
          }
        });
      });
    });
  });

  it('should enforce a consistent naming convention for tools', () => {
    ALL_TOOLS.forEach(tool => {
      expect(tool.name).toMatch(/^[a-z]+(_[a-z]+)*$/);
    });
  });
}); 