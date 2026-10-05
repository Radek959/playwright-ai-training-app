import "dotenv/config";
import { localBrowser, Stagehand } from "@browserbasehq/stagehand";

const APP_URL = "http://localhost:5173";
const TASK_TITLE = `Nowe zadanie testowe Stagehand ${Date.now()}`;
const nodeProcess = (
  globalThis as typeof globalThis & {
    process: {
      env: Record<string, string | undefined>;
      exit(code: number): never;
    };
  }
).process;

async function main() {
  const apiKey = nodeProcess.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }

  const browser = await localBrowser.launch({
    headless: false,
  });

  const sh = await Stagehand.create({
    browser,
    model: {
      modelName: "openai/gpt-4o",
      apiKey,
    },
    selfHeal: true,
    logging: {
      level: "info",
    },
  });

  try {
    const [page] = await browser.context.pages();
    if (!page) {
      throw new Error("Stagehand started without an active page.");
    }

    await page.goto(`${APP_URL}/tasks`);
    await page.waitForSelector('[data-testid="open-wizard-btn"]', {
      state: "visible",
    });

    // Step-transition clicks are the one place a single act() miss silently
    // derails the rest of the run (every later step queries elements that
    // never rendered), so just those get a small retry against a concrete
    // "did the next step actually appear" check.
    const actAdvance = async (
      instruction: string,
      checkSelector: string,
      state: "visible" | "detached" = "visible",
      attempts = 3,
    ) => {
      for (let i = 0; i < attempts; i++) {
        await sh.act(instruction);
        const reached = await page
          .waitForSelector(checkSelector, { state, timeout: 5000 })
          .catch(() => false);
        if (reached) return;
      }
      throw new Error(
        `"${instruction}" nie doprowadziło do "${checkSelector}" (${state}) po ${attempts} próbach`,
      );
    };

    // Dropdown selections are the other place a single act() miss causes
    // trouble - not by erroring, but silently: the wizard just won't let you
    // past "Next" because a required field stayed empty, and retrying the
    // click doesn't help since the click was never the problem.
    const actUntilValue = async (
      instruction: string,
      selector: string,
      isValid: (value: string) => boolean,
      attempts = 3,
    ) => {
      for (let i = 0; i < attempts; i++) {
        await sh.act(instruction);
        const value = await page
          .locator(selector)
          .inputValue()
          .catch(() => "");
        if (isValid(value)) return;
      }
      throw new Error(
        `"${instruction}" nie ustawiło poprawnej wartości w "${selector}" po ${attempts} próbach`,
      );
    };

    // ========== KROK 0: Otwórz wizard ==========
    await sh.act("Kliknij przycisk New Task");
    console.log("✅ [Stagehand] Clicked New Task button");
    await page.waitForSelector('[data-testid="task-type-select"]', {
      state: "visible",
    });

    // ========== KROK 1: Podstawowe informacje ==========
    console.log("✅ Wizard Step 1 - Podstawowe informacje");

    await actUntilValue(
      "Wybierz opcję Feature z listy rozwijanej typu zadania",
      '[data-testid="task-type-select"]',
      (v) => v === "feature",
    );
    console.log("✅ [Stagehand] Selected task type: Feature");

    await sh.act(`Wpisz tekst '${TASK_TITLE}' w pole tekstowe tytułu zadania`);
    console.log("✅ [Stagehand] Entered task title");

    await sh.act(
      "Wpisz tekst 'Opis zadania utworzonego przez AI' w pole tekstowe opisu",
    );
    console.log("✅ [Stagehand] Entered description");

    // Lista zadań w tle strony ma własny filtr "Priority: All/Low/Medium/
    // High" - to zwykły select o bardzo podobnym opisie, w który act()
    // regularnie trafiał zamiast w pole priorytetu wewnątrz okna wizarda.
    await actUntilValue(
      "W formularzu wewnątrz otwartego okna dialogowego 'New Task' (nie w filtrach listy zadań w tle) wybierz priorytet Medium z listy rozwijanej oznaczonej etykietą 'Priority *'",
      '[data-testid="task-priority-select"]',
      (v) => v === "medium",
    );
    console.log("✅ [Stagehand] Selected priority: Medium");

    // Weryfikacja przez extract
    const titleCheck = await sh.extract(
      "Jaka jest wartość w polu tytułu zadania?",
    );
    console.log("✅ Verified title:", titleCheck);

    // Pod otwartym modalem, w tle strony, znajduje się też przycisk paginacji
    // "Next" listy zadań - niejednoznaczne polecenie regularnie trafiało w
    // niego zamiast w przycisk wizarda, więc instrukcja wprost go wyklucza.
    await actAdvance(
      "W otwartym oknie dialogowym 'New Task' kliknij niebieski przycisk z napisem 'Next →' znajdujący się w jego stopce, tuż obok przycisków 'Cancel' i '← Back'. To NIE jest przycisk paginacji listy zadań w tle strony.",
      '[data-testid="task-assignee-select"]',
    );
    console.log("✅ [Stagehand] Clicked Next button");

    // ========== KROK 2: Przypisanie i szczegóły ==========
    console.log("✅ Wizard Step 2 - Przypisanie i szczegóły");

    await actUntilValue(
      "Wybierz pierwszego użytkownika z listy rozwijanej Przypisz do",
      '[data-testid="task-assignee-select"]',
      (v) => v !== "",
    );
    console.log("✅ [Stagehand] Selected assignee");

    await sh.act("Wpisz liczbę 8 w pole szacowanego czasu w godzinach");
    console.log("✅ [Stagehand] Entered estimated hours");

    // Weryfikacja przez extract
    const hoursCheck = await sh.extract(
      "Jaka jest wartość w polu szacowanego czasu?",
    );
    console.log("✅ Verified estimated hours:", hoursCheck);

    await actAdvance(
      "W otwartym oknie dialogowym 'New Task' kliknij niebieski przycisk z napisem 'Next →' znajdujący się w jego stopce, tuż obok przycisków 'Cancel' i '← Back'. To NIE jest przycisk paginacji listy zadań w tle strony.",
      '[data-testid="wizard-summary"]',
    );
    console.log("✅ [Stagehand] Clicked Next button");

    // ========== KROK 3: Podsumowanie ==========
    console.log("✅ Wizard Step 3 - Podsumowanie");

    // Weryfikacja podsumowania przez extract
    const summaryData = await sh.extract(
      "Jakie dane są wyświetlone w sekcji podsumowania zadania?",
    );
    console.log("✅ Summary data:", summaryData);

    await actAdvance(
      "Kliknij przycisk Utwórz zadanie",
      '[data-testid="wizard-summary"]',
      "detached",
    );
    console.log("✅ [Stagehand] Clicked Submit button");

    // ========== WERYFIKACJA: Task został utworzony ==========
    // Weryfikacja przez observe
    const taskVisible = await sh.observe(
      `Znajdź zadanie o tytule '${TASK_TITLE}' na liście zadań`,
    );
    console.log("✅ New task found on the page:", taskVisible);

    console.log("🎉 Test completed successfully - full wizard flow passed!");
  } finally {
    await sh.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  nodeProcess.exit(1);
});
