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
    quickFormRequiredDataTask: {
        title: 'Required Data Task'
    },
    quickFormFullDataTask: {
        title: 'Complete Task',
        description: 'Detailed description',
        status: 'In Progress',
        priority: 'High',
        dueDate: '2026-12-31',
        assignee: 'u1'
    },
    quickFormClearedTask: {
        title: 'Cleared Task',
        description: 'Submit this task and check if form was cleared',
        status: 'To Do',
        priority: 'Low',
        dueDate: '2026-03-30',
        assignee: 'u2'
    },
    quickFormLoopTasks :{
        iterations: 3,
        quickFormDataFirst: {
            title: 'First Task',
            description: 'Quite detailed description of first task with some vague information',
            status: 'In Progress',
            priority: 'Medium',
            dueDate: '2026-10-11',
            assignee: 'u1'
        },
        quickFormDataSecond: {
            title: 'Second Task',
            description: 'Very detailed description of second task which tests if quick form can handle muliple tasks added one after another',
            status: 'In Progress',
            priority: 'Low',
            dueDate: '2026-12-22',
            assignee: 'u2'
        },
        quickFormDataThird: {
            title: 'Third Task',
            description: 'Extremely detailed description of third task totally different from first and second',
            status: 'To Do',
            priority: 'High',
            dueDate: '2026-12-01',
            assignee: 'u3'
        },
    },
    deletionTask: {
        title: 'Task to be Deleted',
        description: 'Add task. Delete task.',
        status: 'To Do',
        priority: 'Low',
        dueDate: '2026-03-12',
        assignee: 'u2'
    },
}