import { test, expect } from '@playwright/test';

test('should go to the tasks view', async ({page}) => {
  // Wzorzec AAA: Arrange, Act, Assert

  // Arrange
  await page.goto('/')

  // Act
  await page.getByRole('link', { name: 'Tasks' }).click()

  // Assert
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
  await expect(page).toHaveURL(/\/tasks$/)
})
