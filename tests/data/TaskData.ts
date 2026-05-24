export interface TaskDetails {
    type?: TaskType;
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
    assignee?: string;
    hours?: string;
    tags?: string;
}

export type TaskType = 'feature' | 'research' | 'bug';
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export const taskData = {
    urlClient: 'http://localhost:5173/tasks', 

    emptyTask: {} as TaskDetails,
    requiredOnlyDataTask: {
        title: 'Simple Task',
        priority: 'medium',
        assignee: 'u2'
    } satisfies TaskDetails,
    wizardFullDataTask: {
        type: 'research',
        title: 'Complete Wizard Task',
        description: 'Detailed description of wizard task',
        priority: 'medium',
        assignee: 'u1',
        hours: '5',
        dueDate: '2026-12-31',
        tags: 'urgent'
    } satisfies TaskDetails,
    quickFormRequiredDataTask: {
        title: 'Required Data Task'
    } satisfies TaskDetails,
    quickFormFullDataTask: {
        title: 'Complete Task in quick form',
        description: 'Detailed description',
        status: 'in-progress',
        priority: 'high',
        dueDate: '2026-12-31',
        assignee: 'u1'
    } satisfies TaskDetails,
    inProgressTask: {
        title: 'Complete Task in progress',
        description: 'Detailed description',
        status: 'in-progress'
    } satisfies TaskDetails,
    doneTask: {
        title: 'Complete Task done',
        description: 'Detailed description',
        status: 'done'
    } satisfies TaskDetails,
    todoTask: {
        title: 'Complete Task todo',
        description: 'Detailed description',
        status: 'todo'
    } satisfies TaskDetails,
    postTask: {
        title: 'Create Task with POST request',
        description: 'Detailed description',
        status: 'in-progress',
        priority: 'high',
        dueDate: '2026-12-31',
        assignee: 'u3'
    } satisfies TaskDetails,
    quickFormClearedTask: {
        title: 'Cleared Task',
        description: 'Submit this task and check if form was cleared',
        status: 'todo',
        priority: 'low',
        dueDate: '2026-03-30',
        assignee: 'u2'
    } satisfies TaskDetails,
    quickFormLoopTasks :[
        {
            title: 'First Task',
            description: 'Quite detailed description of first task with some vague information',
            status: 'in-progress',
            priority: 'medium',
            dueDate: '2026-10-11',
            assignee: 'u1'
        } satisfies TaskDetails,
        {
            title: 'Second Task',
            description: 'Very detailed description of second task which tests if quick form can handle muliple tasks added one after another',
            status: 'in-progress',
            priority: 'low',
            dueDate: '2026-12-22',
            assignee: 'u2'
        } satisfies TaskDetails,
        {
            title: 'Third Task',
            description: 'Extremely detailed description of third task totally different from first and second',
            status: 'todo',
            priority: 'high',
            dueDate: '2026-12-01',
            assignee: 'u3'
        } satisfies TaskDetails,
    ],
    deletionTask: {
        title: 'Task to be Deleted',
        description: 'Add task. Delete task.',
        status: 'todo',
        priority: 'low',
        dueDate: '2026-03-12',
        assignee: 'u2'
    } satisfies TaskDetails,
    apiTask: {
        title: 'Task created via API',
        description: 'Created during API test',
        status: 'todo',
        priority: 'low',
        assigneeId: 'u2'
    }
}