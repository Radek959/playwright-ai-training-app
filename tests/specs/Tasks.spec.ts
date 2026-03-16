import { test, expect } from "@playwright/test";
import { TasksPage } from "../pages/TasksPage";
import { taskData } from "../data/TaskData";    

let tasksPage: TasksPage;

test.describe( 'testing task section', () => {

    test.beforeEach(async ({ page }) => {
        tasksPage = new TasksPage(page);
        await page.goto(taskData.url);
    });

    // create

    // edit
    // edit task details
    // change task status
    // change task priority
    // change task assignee
    // change task due date

    // no information about type, manager or hours of task
    // in table view owners of task are not pinned (by default for each of task we have "brak")
    // in table view and users creator we have polish text, the rest of app is in english
    // for bug severity is minor major critical but when submitting we lose this information

    // research requires hours
    //  bug requires severity

    // delete

    // search
    // filter

    //add checking for all fields not only title
    //correctly assign task to user
    //no owner, article with taskadta.title > owner is not visible
    // new task is visible on the top of the list

    test.describe( 'testing wizard task creator', () => {
        test.beforeEach(async ({ page }) => {
            await tasksPage.openTaskWizard();
        });

        test('should display wizard on button click and hide it on cancel', async ({ page }) => {
            // assert after clicking open wizard button
            await expect(tasksPage.wizardStep1Heading).toBeVisible();
            await expect(tasksPage.wizardNextButton).toBeVisible();
            // act
            await tasksPage.closeTaskWizard();
            // assert
            await expect(tasksPage.wizardStep1Heading).not.toBeVisible();
            await expect(tasksPage.wizardNextButton).not.toBeVisible();
        });

        test('should display validation errors when adding task without required fields', async ({ page }) => {
            //act
            await tasksPage.completeTaskWizardStep1(taskData.emptyTask);
            //assert
            await expect(page.getByText('Tytuł musi mieć min. 3 znaki')).toBeVisible();
            await expect(page.getByText('Wybierz priorytet')).toBeVisible();
        });        

        test('should navigate through task wizard steps correctly', async ({ page }) => {
            await expect(tasksPage.wizardStep1Heading).toBeVisible();
            await tasksPage.completeTaskWizardStep1(taskData.wizardFullDataTask);

            await expect(tasksPage.wizardStep2Heading).toBeVisible();
            await tasksPage.completeTaskWizardStep2(taskData.wizardFullDataTask);

            await expect(tasksPage.wizardStep3Heading).toBeVisible();

            await tasksPage.submitTaskWizard();
            await expect(page.getByRole('heading', { name: taskData.wizardFullDataTask.title })).toBeVisible();
        });

        test('should create task with only required data', async ({ page }) => {
            await tasksPage.createTaskUsingWizard(taskData.requiredOnlyDataTask);
            await expect(page.getByRole('heading', { name: taskData.requiredOnlyDataTask.title })).toBeVisible();
        });

        test('should create task with full data', async ({ page }) => {
            await tasksPage.createTaskUsingWizard(taskData.wizardFullDataTask);
            await expect(page.getByRole('heading', { name: taskData.wizardFullDataTask.title })).toBeVisible();
        });
    });

    test.describe( 'testing quick add form', () => {
        test.beforeEach(async ({ page }) => {
            await tasksPage.toggleQuickAddForm();
        });

        test('should add task using quick add form with valid data', async ({ page }) => {
            //arrange
            await expect(page.getByText(taskData.quickFormFullDataTask.title)).not.toBeVisible();

            //act
            await tasksPage.quickAddTask(taskData.quickFormFullDataTask);

            //assert
            await expect(page.getByText(taskData.quickFormFullDataTask.title)).toBeVisible();
        });

        test('should be cleared after adding new task', async ({ page }) => {
            // arrange
            await expect(tasksPage.quickAddFormTitleInput).toHaveValue('');
            await expect(tasksPage.quickAddFormDescriptionInput).toHaveValue('');
            // act
            await tasksPage.quickAddTask(taskData.quickFormClearedTask);
            // assert
            await expect(tasksPage.quickAddFormTitleInput).toHaveValue('');
            await expect(tasksPage.quickAddFormDescriptionInput).toHaveValue('');
            await expect(tasksPage.quickAddFormStatusSelect).toHaveValue('todo');  // "To Do" was invalid
            await expect(tasksPage.quickAddFormPrioritySelect).toHaveValue('medium'); // "Medium" was invalid
            await expect(tasksPage.quickAddFormDueDateInput).toHaveValue('');
            await expect(tasksPage.quickAddFormAssigneeSelect).toHaveValue('');
        });

        test('should add multiple tasks using quick add form', async ({ page }) => {
            //arrange
            const initialCount = await tasksPage.getTotalTaskCount();
            await tasksPage.navigateToTasksTab('active');

            for (const task of [taskData.quickFormLoopTasks.quickFormDataFirst, taskData.quickFormLoopTasks.quickFormDataSecond, taskData.quickFormLoopTasks.quickFormDataThird]) {
                await expect(page.getByRole('heading', {name: task.title})).not.toBeVisible();

                //act
                await tasksPage.quickAddTask(task);

                //assert
                await expect(page.getByRole('heading', {name: task.title})).toBeVisible();
            }
            const finalCount = await tasksPage.getTotalTaskCount()
            await expect(finalCount).toBe(initialCount + taskData.quickFormLoopTasks.iterations);
        });       

        test('should spam 100 tasks', async ({ page }) => {
            const iterations = 100;
            const initialCount = await tasksPage.getTotalTaskCount();
            await tasksPage.navigateToTasksTab('active');

            for (let i = 1; i <= iterations; i++) {
                await tasksPage.quickAddTask({title: `Spam Task ${i}`});
            }
            const finalCount = await tasksPage.getTotalTaskCount()
            await expect(finalCount).toBe(initialCount + iterations);
        });

    });

    test.describe('deletion', () => {
        let taskId: string;

        test.beforeEach(async ({ page }) => {
            await tasksPage.toggleQuickAddForm();
            await tasksPage.quickAddTask(taskData.deletionTask);

            const taskCard = page.locator('[data-testid^="task-card-"]').filter({ hasText: taskData.deletionTask.title });
            
            const fullTestId = await taskCard.getAttribute('data-testid'); 
            if (!fullTestId) throw new Error('Task card does not have a data-testid attribute');
            
            taskId = fullTestId.replace('task-card-', '');
        });

        test('should not be visible after deletion in active tab', async ({ page }) => {
            const taskCardSelector = `task-card-${taskId}`;
            
            // arrange
            await expect(page.getByTestId(taskCardSelector)).toBeVisible();
            
            // act 
            await page.getByTestId(taskCardSelector).getByRole('button', { name: 'Usuń zadanie' }).click();
            
            // assert
            await expect(page.getByTestId(taskCardSelector)).not.toBeVisible();
        });

        test('should not be visible after deletion in table tab', async ({ page }) => {
            // arrange
            await page.getByTestId('tab-table').click();

            const initialCount = await tasksPage.getTotalTaskCount();

            await expect(page.getByTestId(`cell-${taskId}-title`)).toBeVisible();
            
            // act
            await page.getByTestId(`delete-${taskId}`).click();
            
            // assert
            await expect(page.getByTestId(`cell-${taskId}-title`)).not.toBeVisible();
            const expectedCount = initialCount - 1;
            await expect(page.getByTestId('table-info')).toContainText(`Wyświetlono ${expectedCount} zadań`);
        });
    });
    
});