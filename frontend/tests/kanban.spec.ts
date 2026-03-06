import { expect, test, type Page } from "@playwright/test";

const login = async (page: Page) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
};

const dragCardToColumn = async (
  page: Page,
  cardTestId: string,
  columnTestId: string
) => {
  const source = page.getByTestId(cardTestId);
  const target = page.getByTestId(columnTestId);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("Missing source or target box for drag operation.");
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 20 }
  );
  await page.mouse.up();
};

test("redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to Kanban Studio" })).toBeVisible();
});

test("signs in and loads the kanban board", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("allows board interaction after sign-in", async ({ page }) => {
  await login(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const cardTitle = `Playwright card ${Date.now()}`;
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(cardTitle);
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText(cardTitle)).toBeVisible();

  await page.reload();
  await expect(firstColumn.getByText(cardTitle)).toBeVisible();
});

test("logs out and blocks board access again", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("shows the AI sidebar reply and refreshes the board from the AI response", async ({
  page,
}) => {
  await page.route("**/api/ai/board", async (route) => {
    await route.fulfill({
      json: {
        assistantMessage: "I added an AI planning card to Backlog.",
        appliedOperations: [
          {
            type: "add_card",
            columnId: "col-backlog",
            title: "AI planning card",
            details: "Created in the e2e AI flow.",
          },
        ],
        board: {
          columns: [
            {
              id: "col-backlog",
              title: "Backlog",
              cardIds: ["card-1", "card-2", "card-ai"],
            },
            { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
            {
              id: "col-progress",
              title: "In Progress",
              cardIds: ["card-4", "card-5"],
            },
            { id: "col-review", title: "Review", cardIds: ["card-6"] },
            { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
          ],
          cards: {
            "card-1": {
              id: "card-1",
              title: "Align roadmap themes",
              details: "Draft quarterly themes with impact statements and metrics.",
            },
            "card-2": {
              id: "card-2",
              title: "Gather customer signals",
              details: "Review support tags, sales notes, and churn feedback.",
            },
            "card-3": {
              id: "card-3",
              title: "Prototype analytics view",
              details: "Sketch initial dashboard layout and key drill-downs.",
            },
            "card-4": {
              id: "card-4",
              title: "Refine status language",
              details: "Standardize column labels and tone across the board.",
            },
            "card-5": {
              id: "card-5",
              title: "Design card layout",
              details: "Add hierarchy and spacing for scanning dense lists.",
            },
            "card-6": {
              id: "card-6",
              title: "QA micro-interactions",
              details: "Verify hover, focus, and loading states.",
            },
            "card-7": {
              id: "card-7",
              title: "Ship marketing page",
              details: "Final copy approved and asset pack delivered.",
            },
            "card-8": {
              id: "card-8",
              title: "Close onboarding sprint",
              details: "Document release notes and share internally.",
            },
            "card-ai": {
              id: "card-ai",
              title: "AI planning card",
              details: "Created in the e2e AI flow.",
            },
          },
        },
      },
    });
  });

  await login(page);
  await page
    .getByLabel("Ask AI to update the board")
    .fill("Add an AI planning card to Backlog.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("I added an AI planning card to Backlog.")).toBeVisible();
  await expect(page.getByText("1 board update applied")).toBeVisible();
  await expect(page.getByTestId("card-card-ai")).toBeVisible();
});

test("drops a card into an empty review column", async ({ page }) => {
  let patchBody: { columnId?: string; position?: number } | undefined;

  await page.route("**/api/board", async (route) => {
    await route.fulfill({
      json: {
        columns: [
          { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
          { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
          { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
          { id: "col-review", title: "Review", cardIds: [] },
          { id: "col-done", title: "Done", cardIds: ["card-6", "card-7", "card-8"] },
        ],
        cards: {
          "card-1": {
            id: "card-1",
            title: "Align roadmap themes",
            details: "Draft quarterly themes with impact statements and metrics.",
          },
          "card-2": {
            id: "card-2",
            title: "Gather customer signals",
            details: "Review support tags, sales notes, and churn feedback.",
          },
          "card-3": {
            id: "card-3",
            title: "Prototype analytics view",
            details: "Sketch initial dashboard layout and key drill-downs.",
          },
          "card-4": {
            id: "card-4",
            title: "Refine status language",
            details: "Standardize column labels and tone across the board.",
          },
          "card-5": {
            id: "card-5",
            title: "Design card layout",
            details: "Add hierarchy and spacing for scanning dense lists.",
          },
          "card-6": {
            id: "card-6",
            title: "QA micro-interactions",
            details: "Verify hover, focus, and loading states.",
          },
          "card-7": {
            id: "card-7",
            title: "Ship marketing page",
            details: "Final copy approved and asset pack delivered.",
          },
          "card-8": {
            id: "card-8",
            title: "Close onboarding sprint",
            details: "Document release notes and share internally.",
          },
        },
      },
    });
  });

  await page.route("**/api/cards/card-1", async (route) => {
    patchBody = route.request().postDataJSON() as { columnId?: string; position?: number };
    await route.fulfill({
      json: {
        columns: [
          { id: "col-backlog", title: "Backlog", cardIds: ["card-2"] },
          { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
          { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
          { id: "col-review", title: "Review", cardIds: ["card-1"] },
          { id: "col-done", title: "Done", cardIds: ["card-6", "card-7", "card-8"] },
        ],
        cards: {
          "card-1": {
            id: "card-1",
            title: "Align roadmap themes",
            details: "Draft quarterly themes with impact statements and metrics.",
          },
          "card-2": {
            id: "card-2",
            title: "Gather customer signals",
            details: "Review support tags, sales notes, and churn feedback.",
          },
          "card-3": {
            id: "card-3",
            title: "Prototype analytics view",
            details: "Sketch initial dashboard layout and key drill-downs.",
          },
          "card-4": {
            id: "card-4",
            title: "Refine status language",
            details: "Standardize column labels and tone across the board.",
          },
          "card-5": {
            id: "card-5",
            title: "Design card layout",
            details: "Add hierarchy and spacing for scanning dense lists.",
          },
          "card-6": {
            id: "card-6",
            title: "QA micro-interactions",
            details: "Verify hover, focus, and loading states.",
          },
          "card-7": {
            id: "card-7",
            title: "Ship marketing page",
            details: "Final copy approved and asset pack delivered.",
          },
          "card-8": {
            id: "card-8",
            title: "Close onboarding sprint",
            details: "Document release notes and share internally.",
          },
        },
      },
    });
  });

  await login(page);
  await dragCardToColumn(page, "card-card-1", "column-col-review");

  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toBeVisible();
  expect(patchBody).toEqual({ columnId: "col-review", position: 0 });
});
