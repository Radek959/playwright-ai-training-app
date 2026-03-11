export const taskData = {
    url: 'http://localhost:5173/tasks', 

    emptyTask: {},
    requiredOnlyDataTask: {
        title: 'Simple Task',
        priority: 'Medium',
        assignee: 'u2'
    },
    wizardFullDataTask: {
        type: 'research',
        title: 'Complete Wizard Task',
        description: 'Detailed description of wizard task',
        priority: 'medium',
        assignee: 'u1',
        hours: '5',
        dueDate: '2026-12-31',
        tags: 'urgent'
    },
    quickFormFullDataTask: {
        title: 'Complete Task',
        description: 'Detailed description',
        status: 'In Progress',
        priority: 'High',
        dueDate: '2026-12-31',
        assignee: 'u1'
    },
    deletionTask: {
        title: 'Task to be Deleted',
        description: 'dd task. Delete task.',
        status: 'To Do',
        priority: 'Low',
        dueDate: '2026-03-12',
        assignee: 'u2'
    },
}