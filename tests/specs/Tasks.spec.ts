import { test, expect } from "@playwright/test";
import { TasksPage } from "../pages/TasksPage";
import { taskData } from "../data/TaskData";    
import { helperUrls } from "../utils/helpers";

let tasksPage: TasksPage;

test.describe( 'testing task section', () => {

    test.beforeEach(async ({ page }) => {
        tasksPage = new TasksPage(page);
        await page.goto(taskData.urlClient);
    });

    // no information about type, manager or hours of task
    // in table view owners of task are not pinned (by default for each of task we have "brak")
    // in table view and users creator we have polish text, the rest of app is in english
    // for bug severity is minor major critical but when submitting we lose this information

    // create
    // task wizard correct step 1, bad step 2

    // edit
    // edit task details
    // change task status
    // change task priority
    // change task assignee
    // change task due date

    // research requires hours
    //  bug requires severity

    // delete

    // search
    // filter
    // adding new task with low priority and choosing low priority in filter should display this task in filtered results
    // adding new task with low priority and choosing high priority in filter should not display this task in filtered results

    // test validation
    // max lengthh of title and description
    // estimated hours being text or negative number
    // due date in the past or very far in the future


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

        test('should navigate through task wizard steps correctly and create task', async ({ page }) => {
            // act
            await expect(tasksPage.wizardStep1Heading).toBeVisible();
            await tasksPage.completeTaskWizardStep1(taskData.wizardFullDataTask);

            await expect(tasksPage.wizardStep2Heading).toBeVisible();
            await tasksPage.completeTaskWizardStep2(taskData.wizardFullDataTask);

            await expect(tasksPage.wizardStep3Heading).toBeVisible();
            await tasksPage.submitTaskWizard();

            // assert
            const taskCard = await tasksPage.getTaskCardLocatorByTitle(taskData.wizardFullDataTask.title);

            await expect(taskCard.getByRole('heading', { name: taskData.wizardFullDataTask.title }).first()).toBeVisible();
            await expect(taskCard.getByText(taskData.wizardFullDataTask.description).first()).toBeVisible();
            await expect(taskCard.getByText('todo')).toBeVisible();  
            await expect(taskCard.getByText(`P: ${taskData.wizardFullDataTask.priority}`).first()).toBeVisible();
            await expect(taskCard.getByText(`Due: ${ await tasksPage.changeDateFormat(taskData.wizardFullDataTask.dueDate, 'en-US')}`)).toBeVisible(); //on playwright ui i have format MM/DD/YYYY but on personal browser i have DD.MM.YYYY
            // await expect(page.getByText(`Owner: ${taskData.wizardFullDataTask.assignee}`)).toBeVisible(); // add dictionary or use mock
        });

        test('should create task with only required data', async ({ page }) => {
            // act
            await tasksPage.createTaskUsingWizard(taskData.requiredOnlyDataTask);
            // assert
            const taskCard = await tasksPage.getTaskCardLocatorByTitle(taskData.requiredOnlyDataTask.title);

            await expect(taskCard.getByRole('heading', { name: taskData.requiredOnlyDataTask.title }).first()).toBeVisible();
            await expect(taskCard.getByText('todo').first()).toBeVisible();
            await expect(taskCard.getByText(`P: ${taskData.requiredOnlyDataTask.priority}`).first()).toBeVisible();
        });

        test('should create task with full data', async ({ page }) => {
            // act
            await tasksPage.createTaskUsingWizard(taskData.wizardFullDataTask);
            // assert
            const taskCard = await tasksPage.getTaskCardLocatorByTitle(taskData.wizardFullDataTask.title);

            await expect(taskCard.getByRole('heading', { name: taskData.wizardFullDataTask.title })).toBeVisible();
            await expect(taskCard.getByText(taskData.wizardFullDataTask.description)).toBeVisible();
            await expect(taskCard.getByText('todo')).toBeVisible();
            await expect(taskCard.getByText(`P: ${taskData.wizardFullDataTask.priority}`)).toBeVisible();
            await expect(taskCard.getByText(`Due: ${ await tasksPage.changeDateFormat(taskData.wizardFullDataTask.dueDate, 'en-US')}`)).toBeVisible();
        });
    });

    test.describe( 'testing quick add form', () => {
        test.beforeEach(async ({ page }) => {
            await tasksPage.toggleQuickAddForm();
        });

        // add invalid data version
        test('should add task using quick add form with valid data', async ({ page }) => {
            //act
            await tasksPage.quickAddTask(taskData.quickFormFullDataTask);

            // assert
            const taskCard = await tasksPage.getTaskCardLocatorByTitle(taskData.quickFormFullDataTask.title);

            await expect(taskCard.getByRole('heading', { name: taskData.quickFormFullDataTask.title })).toBeVisible();
            await expect(taskCard.getByText(taskData.quickFormFullDataTask.description)).toBeVisible();
            await expect(taskCard.getByText(taskData.quickFormFullDataTask.status.toLowerCase().replace(' ', '-'))).toBeVisible();
            await expect(taskCard.getByText(`P: ${taskData.quickFormFullDataTask.priority}`)).toBeVisible();
            await expect(taskCard.getByText(`Due: ${ await tasksPage.changeDateFormat(taskData.quickFormFullDataTask.dueDate, 'en-US')}`)).toBeVisible();
        });

        test('should create task with only required data using quick add form', async ({ page }) => {
            // act
            await tasksPage.quickAddTask(taskData.quickFormRequiredDataTask);
            // assert
            const taskCard = await tasksPage.getTaskCardLocatorByTitle(taskData.quickFormRequiredDataTask.title);

            await expect(taskCard.getByRole('heading', { name: taskData.quickFormRequiredDataTask.title })).toBeVisible();
            await expect(taskCard.getByText('todo')).toBeVisible();
            await expect(taskCard.getByText(`P: medium`)).toBeVisible();
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
            await expect(tasksPage.quickAddFormStatusSelect).toHaveValue('todo');  
            await expect(tasksPage.quickAddFormPrioritySelect).toHaveValue('medium'); 
            await expect(tasksPage.quickAddFormDueDateInput).toHaveValue('');
            await expect(tasksPage.quickAddFormAssigneeSelect).toHaveValue('');
        });

        test('should add multiple tasks using quick add form', async ({ page }) => {
            //arrange
            const initialCount = await tasksPage.getTotalTaskCount();
            await tasksPage.navigateToTasksTab('active');

            // replace 
            for (const task of taskData.quickFormLoopTasks) {
                await expect(page.getByRole('heading', {name: task.title})).not.toBeVisible();
                
                //act
                await tasksPage.quickAddTask(task);

                //assert
                await expect(page.getByRole('heading', {name: task.title})).toBeVisible();
            }
            const finalCount = await tasksPage.getTotalTaskCount()
            expect(finalCount).toBe(initialCount + taskData.quickFormLoopTasks.length);
        });       

        test('should create few tasks via api (smoke)', async ({ request }) => {
            const iterations = 20;
            const runId = `run-${Date.now()}`;
            const createdIds = [];

            for (let i = 0; i < iterations; i++) {
            const response = await request.post(`${helperUrls.api}/tasks`, {
                data: { ...taskData.postTask, title: `${taskData.postTask.title}-${runId}-${i}` }
            });
            expect(response.ok()).toBeTruthy();
            const body = await response.json();
            createdIds.push(body.id);
            }

            const finalCount = await tasksPage.getTotalTaskCountUsingApi(request);
            expect(finalCount).toBeGreaterThanOrEqual(iterations);

            for (const id of createdIds) {
            await request.delete(`${helperUrls.api}/tasks/${id}`);
            }
            });
        
    });

    test.describe('testing deletion', () => {
        let taskId: string;

        test.beforeEach(async ({ page }) => {
            await tasksPage.toggleQuickAddForm();
            const uniqueTitle = `${taskData.deletionTask.title}-${Date.now()}`;
            await tasksPage.quickAddTask({ ...taskData.deletionTask, title: uniqueTitle });

            const taskCard = await tasksPage.getTaskCardLocatorByTitle(uniqueTitle);
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