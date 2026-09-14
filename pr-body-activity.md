* **Nazwa gałęzi:** \`feat/task-activity-history\`
* **Lista zmienionych plików:**
  * \`server/src/data.ts\` (dodano modele danych i seed data)
  * \`server/src/taskActivityLifecycle.ts\` (nowy plik z logiką budowania eventów)
  * \`server/src/routes/tasks.ts\` (podpięto generowanie historii i endpoint)
  * \`server/src/routes/users.ts\` (historia przy usunięciu użytkownika)
  * \`server/src/taskActivityLifecycle.test.ts\` (testy jednostkowe)
  * \`server/src/api.test.ts\` (testy integracyjne API)
  * \`client/src/types.ts\` (zaktualizowano typy klienckie)
  * \`client/src/components/TaskActivitySection.tsx\` (nowy komponent historii w UI)
  * \`client/src/components/TaskActivitySection.test.tsx\` (nowe testy komponentu)
  * \`client/src/routes/TaskDetails.tsx\` (podpięto komponent)
  * \`server/src/swagger.json\` (zaktualizowano kontrakt API)
  * \`docs/dokumentacja-produktowa.md\` (rozszerzono o opis)
* **Przyjęty model zdarzeń:** 
  Wspólny kontrakt dzieli operacje na typy \`ActivityType\`: \`task_created\`, \`task_updated\` oraz \`approval_decided\`. Każda aktywność ma unikalne \`id\`, \`createdAt\`, \`taskId\` i tablicę \`changes\` (\`field\`, \`before\`, \`after\`). Brak wartości to \`null\`.
* **Miejsca rejestracji:**
  \`POST /api/tasks\`, \`PUT /api/tasks/:id\`, \`PUT /api/tasks/:id/approval\`, \`DELETE /api/users/:id\`, \`DELETE /api/tasks/:id\`.
* **Jeden wpis na żądanie:**
  Przy mutacji tworzony jest wpis po przejściu wszystkich reguł biznesowych z wykorzystaniem \`diffTaskChanges\`.
* **Dodane testy:**
  Testy jednostkowe w \`taskActivityLifecycle.test.ts\`. Testy API w \`api.test.ts\`. Testy frontendowe w \`TaskActivitySection.test.tsx\`.
* **Wynik \`npm run check\`:** Przeszedł pomyślnie.
* **Wynik smoke testu:** Przeszedł pomyślnie.
