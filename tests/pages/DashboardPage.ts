import { Page, Locator } from "@playwright/test";

export class DashboardPage {
    readonly titlePage: Locator;


    constructor( private page: Page) {
        this.titlePage = page.getByRole('heading', { name: 'Dashboard' });
    }

}