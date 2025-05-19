import { test, expect } from '@playwright/test';

// Home page tests
test('should have the correct title', async ({ page }) => {
  // Navigate to the home page
  await page.goto('/');
  
  // Check that the page has the expected title
  await expect(page).toHaveTitle(/Next.js and Supabase Starter Kit/);
});

test('should display the main heading', async ({ page }) => {
  // Navigate to the home page
  await page.goto('/');
  
  // Check for a heading that contains text about weddings or the app
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();
});

test('should have navigation elements', async ({ page }) => {
  // Navigate to the home page
  await page.goto('/');
  
  // Check for navigation elements
  const navElements = page.getByRole('navigation');
  await expect(navElements).toBeVisible();
});