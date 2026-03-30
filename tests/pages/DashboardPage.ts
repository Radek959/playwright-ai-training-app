import { Page, Locator } from "@playwright/test";

export class DashboardPage {
    readonly titlePage: Locator;  

    //stat cards
    readonly totalTasksStatCard: Locator;
    readonly inProgressStatCard: Locator;
    readonly highPriorityStatCard: Locator;
    readonly completionStatCard: Locator;

    // charts
    readonly taskStatusChartCard: Locator;
    readonly priorityBreakdownChartCard: Locator;

    readonly teamOverviewCard: Locator;

    constructor( private page: Page) {
        this.titlePage = page.getByRole('heading', { name: 'Dashboard' });

        this.totalTasksStatCard = page.locator('[data-testid^="stat-card"]')
                                        .filter({ has: this.page.getByText('Total Tasks') });
        this.inProgressStatCard = page.locator('[data-testid^="stat-card"]')
                                       .filter({ has: this.page.getByText('In Progress') });
        this.highPriorityStatCard = page.locator('[data-testid^="stat-card"]')
                                          .filter({ has: this.page.getByText('High Priority') });
        this.completionStatCard = page.locator('[data-testid^="stat-card"]')
                                        .filter({ has: this.page.getByText('Completion') });
        this.taskStatusChartCard = page.locator('[data-testid^="status-distribution-card"]')
                                        .filter({ has: this.page.getByRole( "heading", { name: 'Task Status Distribution'}) });
        this.priorityBreakdownChartCard = page.locator('[data-testid^="status-distribution-card"]')
                                        .filter({ has: this.page.getByRole( "heading", { name: 'Priority Breakdown'}) });    
        this.teamOverviewCard = page.locator('[data-testid^="team-overview-card"]')
                                        .filter({ has: this.page.getByRole( "heading", { name: 'Team Overview'}) });    
    }

    async navigateToPage() {
        this.page.goto('http://localhost:5173/')
    }
}