import { test, expect } from "@playwright/test";
import { userData } from "../data/UserData";
import { getFakeUser } from "../utils/helpers";

test.describe("testing users section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(userData.urlClient);
  });

  test("should render users screen", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dodaj użytkownika" })).toBeVisible();
  });

  test("should create user and display it in list", async ({ page }) => {
    const user = getFakeUser();

    await page.getByLabel("Nazwa").fill(user.name);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Rola").selectOption(user.role);
    await page.getByLabel("Avatar URL").fill(user.avatar);
    await page.getByRole("button", { name: "Dodaj użytkownika" }).click();

    await expect(page.getByRole('table').getByText(user.name)).toBeVisible();
    await expect(page.getByRole('table').getByText(user.email)).toBeVisible();
  });
});