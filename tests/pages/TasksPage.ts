import { Page, Locator } from "@playwright/test";

export interface TaskDetails {
    type?: string; // change to enum
    title?: string;
    description?: string;
    status?: string; // change to enum
    priority?: string; // change to enum
    dueDate?: string;
    assignee?: string; // change to enum
    hours?: string;
    tags?: string;
}

export class TasksPage {
    readonly titlePage: Locator;

    readonly wizardOpenButton: Locator;
    readonly wizardNextButton: Locator;
    readonly wizardCancelButton: Locator;
    readonly wizardSubmitButton: Locator;

    readonly wizardStep1Heading: Locator;
    readonly wizardStep2Heading: Locator;
    readonly wizardStep3Heading: Locator;

    readonly wizardTypeSelect: Locator;
    readonly wizardTitleInput: Locator;
    readonly wizardDescriptionInput: Locator;
    readonly wizartPrioritySelect: Locator;
    readonly wizardAssigneeSelect: Locator;
    readonly wizardHoursInput: Locator;
    readonly wizardDueDateInput: Locator;
    readonly wizardTagsInput: Locator;

    readonly quickAddForm: Locator;
    readonly titleInput: Locator;
    readonly descriptionInput: Locator;
    readonly statusSelect: Locator;
    readonly prioritySelect: Locator;
    readonly dueDateInput: Locator;
    readonly assigneeSelect: Locator;
    readonly addTaskButton: Locator;

    constructor( private page: Page) {
        this.titlePage = this.page.getByRole('heading', { name: 'Tasks' });

        // create task wizard locators
        this.wizardOpenButton = this.page.getByTestId('open-wizard-btn');
        this.wizardNextButton = this.page.getByTestId('wizard-next-btn');
        this.wizardCancelButton = this.page.getByTestId('wizard-cancel-btn');
        this.wizardSubmitButton = this.page.getByTestId('wizard-submit-btn');

        this.wizardStep1Heading = this.page.getByRole('heading', { name: 'Krok 1: Podstawowe informacje' });
        this.wizardStep2Heading = this.page.getByRole('heading', { name: 'Krok 2: Przypisanie i szczeg' });
        this.wizardStep3Heading = this.page.getByRole('heading', { name: 'Krok 3: Podsumowanie' });
        
        this.wizardTypeSelect = this.page.getByTestId('task-type-select');
        this.wizardTitleInput = this.page.getByTestId('task-title-input');
        this.wizardDescriptionInput = this.page.getByTestId('task-description-input');
        this.wizartPrioritySelect = this.page.getByTestId('task-priority-select');
        this.wizardAssigneeSelect = this.page.getByTestId('task-assignee-select');
        this.wizardHoursInput = this.page.getByTestId('task-hours-input');
        this.wizardDueDateInput = this.page.getByTestId('task-due-date-input');
        this.wizardTagsInput = this.page.getByTestId('task-tags-input');

        // quick add form locators
        this.quickAddForm = this.page.getByTestId('toggle-quick-form-btn');
        this.titleInput = this.page.getByRole('textbox').nth(1);
        this.descriptionInput = this.page.locator('textarea');
        this.statusSelect = this.page.getByRole('combobox').nth(2);
        this.prioritySelect = this.page.getByRole('combobox').nth(3);
        this.dueDateInput = this.page.locator('input[type="date"]');
        this.assigneeSelect = this.page.getByRole('combobox').nth(4);
        this.addTaskButton = this.page.getByTestId('add-task-button');
    }

    async navigateToPage(url: string) {
        await this.page.goto(url);
    }

    async openTaskWizard() {
        await this.wizardOpenButton.click();
    }

    async closeTaskWizard() {
        await this.wizardCancelButton.click();
    }

    async navigateToNextWizardStep() {
        await this.wizardNextButton.click();
    }

    async submitTaskWizard() {
        await this.wizardSubmitButton.click();
    }

    async completeTaskWizardStep1(taskDetails: TaskDetails) {
        if (taskDetails.type) await this.wizardTypeSelect.selectOption(taskDetails.type);
        if (taskDetails.title) await this.wizardTitleInput.fill(taskDetails.title);
        if (taskDetails.description) await this.wizardDescriptionInput.fill(taskDetails.description);
        if (taskDetails.priority) await this.wizartPrioritySelect.selectOption(taskDetails.priority);
        await this.wizardNextButton.click();
    }

    async completeTaskWizardStep2(taskDetails: TaskDetails) {
        if (taskDetails.assignee) await this.wizardAssigneeSelect.selectOption(taskDetails.assignee);
        if (taskDetails.hours) await this.wizardHoursInput.fill(taskDetails.hours);
        if (taskDetails.dueDate) await this.wizardDueDateInput.fill(taskDetails.dueDate);
        if (taskDetails.tags) await this.wizardTagsInput.fill(taskDetails.tags);
        await this.wizardNextButton.click();
    }

    async createTaskUsingWizard(taskDetails: TaskDetails) {
        await this.completeTaskWizardStep1(taskDetails);
        await this.completeTaskWizardStep2(taskDetails);
        await this.submitTaskWizard();
    }

    async toggleQuickAddForm() {
        await this.quickAddForm.click();
    }

    async quickAddTask(taskDetails: TaskDetails) {
        if (taskDetails.title ) await this.titleInput.fill(taskDetails.title);
        if (taskDetails.description ) await this.descriptionInput.fill(taskDetails.description);
        if (taskDetails.status ) await this.statusSelect.selectOption(taskDetails.status);
        if (taskDetails.priority ) await this.prioritySelect.selectOption(taskDetails.priority);
        if (taskDetails.dueDate ) await this.dueDateInput.fill(taskDetails.dueDate);
        if (taskDetails.assignee ) await this.assigneeSelect.selectOption(taskDetails.assignee);
        await this.addTaskButton.click();
        
    }

}