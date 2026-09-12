# Dokumentacja produktowa — Task Manager

Ten dokument opisuje **oczekiwane zachowanie aplikacji** widoczne z perspektywy użytkownika — interfejsu i API — wraz z regułami walidacji, jakim podlegają dane. Opisuje wymagania i zachowanie, a nie szczegóły techniczne ich implementacji.

---

## 1. Model danych

### 1.1 Zadanie (Task)

Pole | Typ / dozwolone wartości | Uwagi
---|---|---
`id` | `string` | Generowane przez backend (`randomUUID`) przy tworzeniu; niemodyfikowalne.
`title` | `string` | Wymagane, min. 3 znaki po przycięciu białych znaków (`trim`).
`description` | `string` | Opcjonalne.
`status` | `"todo" \| "in-progress" \| "done"` | Domyślnie `"todo"` przy tworzeniu przez API.
`priority` | `"low" \| "medium" \| "high"` | Domyślnie `"medium"` przy tworzeniu przez API.
`dueDate` | `string` (data) | Opcjonalne. Akceptowana jest dowolna wartość tekstowa, którą da się sparsować jako datę (nie tylko format ISO 8601).
`completedAt` | `string` (data) | Ustawiane automatycznie — patrz sekcja 2.3. Ten sam warunek dot. formatu co `dueDate`. Nie da się go bezpośrednio wyczyścić (`null` jest odrzucane jako błąd walidacji).
`assigneeId` | `string` (`id` istniejącego użytkownika) lub brak | Jeśli podane i niepuste, musi wskazywać na istniejącego użytkownika.
`coverImage` | `string` (URL) | Ustawiane tylko w danych startowych; nie ma pola do jego edycji w UI ani w formularzu tworzenia zadania.
`taskType` | `"bug" \| "feature" \| "research"` | Opcjonalne.
`estimatedHours` | `number > 0` | Opcjonalne, ale wymagane warunkowo — patrz sekcja 3.
`tags` | `string[]` | Domyślnie `[]` przy tworzeniu przez API.
`dependencies` | `string[]` (`id` innych zadań) | Domyślnie `[]`. Każdy identyfikator musi istnieć wśród zadań i nie może wskazywać na samo siebie.
`severity` | `"critical" \| "major" \| "minor"` | Wymagane warunkowo dla zadań typu `bug` — patrz sekcja 3.
`requiresApproval` | `boolean` | Domyślnie `false` przy tworzeniu przez API.
`approver` | `string` | Wymagany, jeśli `requiresApproval` jest `true`. **Uwaga:** to pole jest tylko przechowywaną wartością tekstową — nie ma w aplikacji żadnego mechanizmu zatwierdzania, kolejki ani ekranu, który by z niego korzystał.

### 1.2 Użytkownik (User)

Pole | Typ / dozwolone wartości | Uwagi
---|---|---
`id` | `string` | Generowane przez backend przy tworzeniu.
`name` | `string` | Wymagane, niepuste po `trim`.
`email` | `string` | Wymagane, musi pasować do wzorca `coś@coś.coś`, musi być unikalne (porównanie bez rozróżniania wielkości liter) wśród istniejących użytkowników.
`role` | `"admin" \| "editor" \| "viewer"` | Domyślnie `"viewer"` przy tworzeniu przez API. **Uwaga:** rola jest wyłącznie etykietą wyświetlaną w UI — żaden endpoint ani widok nie sprawdza roli, by ograniczyć lub przyznać uprawnienia.
`avatar` | `string` | Opcjonalne, ustawiane przez formularz tworzenia użytkownika.
`avatarUrl` | `string` | Pole obecne tylko w danych startowych (część użytkowników seedowych je ma, część nie); formularz tworzenia użytkownika go nie ustawia.

---

## 2. Zachowanie zadań — reguły wspólne dla UI i API

### 2.1 Tworzenie zadania (`POST /api/tasks`)

- Walidacja zwraca `400` z ciałem `{ "error": "Validation failed", "details": [{ "field": ..., "message": ... }] }` — może zawierać wiele błędów naraz.
- Pola nieprzesłane w żądaniu otrzymują wartości domyślne opisane w sekcji 1.1 (`status`, `priority`, `tags`, `dependencies`, `requiresApproval`). Pozostałe pola pozostają nieustawione.
- Znaczenie `null` w treści żądania zależy od konkretnego pola — patrz sekcja 2.4.
- Powodzenie zwraca `201` z pełnym obiektem zadania (włącznie z nadanym `id`).

### 2.2 Aktualizacja zadania (`PUT /api/tasks/:id`)

- Dozwolone do aktualizacji pola: `title`, `description`, `status`, `priority`, `dueDate`, `completedAt`, `assigneeId`, `taskType`, `estimatedHours`, `tags`, `dependencies`, `severity`, `requiresApproval`, `approver`.
- Próba przesłania `id` zwraca błąd `"id cannot be updated"`.
- Próba przesłania jakiegokolwiek innego, nieznanego pola zwraca błąd `"<pole> is not an updatable field"` — cała aktualizacja jest wtedy odrzucana (`400`), nic się nie zapisuje.
- Zapytanie może przesłać tylko część pól — pozostałe pola zadania pozostają bez zmian (patch, nie replace całego obiektu).
- Po zmergowaniu poprawki, cały wynikowy obiekt jest walidowany tymi samymi regułami co przy tworzeniu (sekcja 3), łącznie z polami, które nie były częścią tego żądania.
- Nieistniejące `id` zadania zwraca `404`.

### 2.3 Automatyczne ustawianie `completedAt`

- Wynikowa wartość `completedAt` zależy od statusu **po** zapisaniu żądania:
  - jeśli status wynikowy to `"done"`, a żądanie nie przesyła jawnie `completedAt` — używana jest już zapisana wartość `completedAt` (jeśli zadanie było już `"done"` i miało tę datę ustawioną wcześniej), a dopiero gdy takiej wartości brak, backend ustawia ją na bieżący czas. Innymi słowy: zaktualizowanie zadania, które jest już `"done"`, bez zmiany tego pola, **nie** nadpisuje istniejącej daty ukończenia nową wartością.
  - jeśli żądanie jawnie przesyła `completedAt` razem ze statusem wynikowym `"done"`, ta wartość jest zachowana.
  - jeśli status wynikowy to cokolwiek innego niż `"done"` (`"todo"` lub `"in-progress"`), `completedAt` jest czyszczone — niezależnie od tego, co było wcześniej zapisane.
- `completedAt` nie może zostać ustawione na `null` bezpośrednio przez klienta (patrz sekcja 2.4) — jedyny sposób jego wyczyszczenia to zmiana statusu na inny niż `"done"`.

### 2.4 Znaczenie `null` — osobno dla tworzenia i aktualizacji

Dla obu operacji ten sam zestaw pól ma szczególne traktowanie `null`: `description`, `dueDate`, `assigneeId`, `taskType`, `estimatedHours`, `severity`, `approver`. Dla pozostałych pól (`title`, `status`, `priority`, `completedAt`, `tags`, `dependencies`, `requiresApproval`) `null` jest zawsze błędem walidacji, niezależnie od operacji. Tablice (`tags`, `dependencies`) czyści się wysyłając pustą tablicę `[]`, nie `null`.

Sposób, w jaki `null` na tych polach jest obsługiwany, różni się jednak między tworzeniem a aktualizacją:

**Tworzenie (`POST /api/tasks`)** — przesłanie `null` na jednym z tych pól samo w sobie nie jest błędem walidacji i jest traktowane tak samo, jak brak tej wartości. Utworzone zadanie może mieć takie pole zapisane jako `null` (widoczne jako `null` w odpowiedzi API), a nie po prostu nieobecne. Wynikowe zadanie nadal musi spełniać reguły z sekcji 3 — np. `severity: null` przy `taskType: "bug"` jest odrzucane, bo zadanie typu `bug` wymaga `severity` niezależnie od tego, czy brak wartości wynika z `null`, czy z pominięcia pola.

**Aktualizacja (`PUT /api/tasks/:id`)** — przesłanie `null` na jednym z tych pól **czyści** (usuwa) dotychczasową wartość — pole znika z zapisanego zadania, tak jakby nigdy nie zostało ustawione. Przesłanie `null` na którymkolwiek z pozostałych pól jest odrzucane z komunikatem `"<pole> cannot be null"`, zanim jeszcze zostaną sprawdzone pozostałe reguły walidacji.

### 2.5 Usuwanie zadania (`DELETE /api/tasks/:id`)

- Zadanie jest usuwane bezwarunkowo — **nie ma żadnej blokady** związanej z tym, że inne zadania mają je w swoich `dependencies`. Usunięcie zadania, od którego zależą inne zadania, pozostawia w tych innych zadaniach nieistniejący już identyfikator w tablicy `dependencies`.
- Nieistniejące `id` zwraca `404`. Powodzenie zwraca `204` bez treści.

### 2.6 Zależności (`dependencies`) — czym są, a czym nie są

- `dependencies` to tablica identyfikatorów innych zadań, walidowana wyłącznie pod kątem tego, że każdy identyfikator istnieje i nie jest identyfikatorem samego zadania.
- **Aplikacja nie egzekwuje żadnej logiki blokującej** na podstawie zależności: zadanie z niezakończonymi zależnościami można swobodnie oznaczyć jako `"done"`, edytować czy usunąć. Pole służy wyłącznie do przechowania i wyświetlenia powiązania.

### 2.7 `requiresApproval` / `approver` — czym są, a czym nie są

- Jedyna reguła biznesowa: jeśli `requiresApproval` jest `true`, pole `approver` musi być niepustym stringiem (przy tworzeniu i przy aktualizacji, licząc scalony obiekt).
- **Nie istnieje żaden proces zatwierdzania** — ustawienie `requiresApproval: true` i wybranie zatwierdzającego nie blokuje statusu zadania, nie wysyła powiadomień i nie tworzy żadnego zadania do wykonania dla „zatwierdzającego”. To zwykłe pola danych.
- Lista zatwierdzających dostępna w kreatorze zadań w UI to zamknięta lista trzech wartości: `manager-a`, `manager-b`, `manager-c`. API nie waliduje `approver` względem tej listy — akceptuje dowolny niepusty string.

### 2.8 Role użytkowników — czym są, a czym nie są

- Rola (`admin` / `editor` / `viewer`) jest ustawiana raz, przy tworzeniu użytkownika, i wyświetlana jako etykieta (kolorowy „chip”) na liście użytkowników.
- **Rola nie wpływa na to, co dany użytkownik może zrobić w aplikacji** — nie ma logowania ani sesji użytkownika, więc nie ma też pojęcia „zalogowanego” użytkownika, którego rola mogłaby cokolwiek ograniczać. Wszystkie akcje (tworzenie, edycja, usuwanie zadań i użytkowników) są dostępne dla każdego, kto korzysta z aplikacji lub API, niezależnie od ról przypisanych do użytkowników w systemie.

### 2.9 Usuwanie użytkownika (`DELETE /api/users/:id`)

- **Brak w UI**: interfejs nie udostępnia żadnego przycisku ani akcji usuwania użytkownika — endpoint jest dostępny wyłącznie przez bezpośrednie wywołanie API.
- Reguła biznesowa: jeśli usuwany użytkownik ma przypisane zadania o statusie innym niż `"done"` (czyli `"todo"` lub `"in-progress"`), żądanie zwraca `409 Conflict` z ciałem `{ "error": "Cannot delete user with active tasks", "conflictingTasks": [{ "id", "title" }, ...] }` i użytkownik **nie** zostaje usunięty.
- Jeśli wszystkie przypisane zadania mają status `"done"` (lub użytkownik nie ma żadnych przypisanych zadań), usunięcie się powiedzie (`204`).
- Usunięcie użytkownika **nie** czyści ani nie modyfikuje `assigneeId` w zadaniach, które do niego się odwoływały (nie dotyczy to przypadku sukcesu opisanego wyżej, bo w takim przypadku pozostają tylko zadania `"done"` — te zadania nadal będą wskazywać na usuniętego już użytkownika).
- Nie istnieje endpoint do edycji użytkownika (`PUT`/`PATCH`) — po utworzeniu nazwy, e-maila, roli ani awatara nie da się zmienić ani przez UI, ani przez udokumentowane API.

---

## 3. Reguły walidacji zależne od kontekstu (business rules)

Poniższe reguły są sprawdzane zarówno przy `POST /api/tasks`, jak i przy `PUT /api/tasks/:id` (na scalonym obiekcie), niezależnie od tego, które konkretne pole zostało przesłane w danym żądaniu:

1. **Zadanie typu `bug` wymaga `severity`.** Brak `severity` (lub `null`) przy `taskType === "bug"` zwraca błąd na polu `severity`: „bug tasks require a severity”.
2. **Zadanie typu `research` wymaga `estimatedHours >= 1`.** Brak `estimatedHours` lub wartość `< 1` przy `taskType === "research"` zwraca błąd na polu `estimatedHours`: „research tasks require estimatedHours >= 1”.
3. **Zadania o priorytecie `high` nie mogą mieć `estimatedHours > 24`.** Jeśli `estimatedHours` jest podane i przekracza 24, a `priority === "high"`, zwracany jest błąd: „high priority tasks cannot exceed 24 estimated hours”.
4. **`requiresApproval: true` wymaga niepustego `approver`.** Patrz sekcja 2.7.

Dodatkowe reguły pól (niezależne od kontekstu innych pól):

- `title`: wymagany, string, min. 3 znaki po `trim`.
- `estimatedHours`: jeśli podane, musi być skończoną liczbą `> 0`.
- `dueDate` / `completedAt`: jeśli podane, muszą być stringiem, który da się sparsować jako datę (`new Date(x)` nie może dać `Invalid Date`).
- `assigneeId`: jeśli podane i niepuste, musi wskazywać na istniejącego użytkownika.
- `tags`: jeśli podane, musi być tablicą stringów (brak walidacji unikalności czy dozwolonych wartości).

---

## 4. Wyszukiwanie zadań (`GET /api/tasks/search?q=...`)

- Parametr `q` krótszy niż 2 znaki (licząc surową długość stringu, bez przycinania spacji) zwraca pustą tablicę `[]`, **bez błędu**.
- Dopasowanie: podciąg `q` (bez rozróżniania wielkości liter) w polu `title` **lub** w polu `description` zadania. Brak dopasowania po innych polach (np. `tags`, `assigneeId`, `status`).
- Wynik jest ograniczony do maksymalnie **10** zadań, bez informacji o łącznej liczbie dopasowań powyżej tego limitu.
- Endpoint przeszukuje **wszystkie** zadania niezależnie od statusu — wynik może zawierać zadania zarchiwizowane, aktywne czy zakończone.

### Zachowanie widgetu wyszukiwania w UI (górna część widoku Tasks)

- Pole wyszukiwania w UI **nie filtruje** listy/tabeli/kart na stronie — to osobny, niezależny mechanizm. Wpisanie tekstu wywołuje zapytanie do `GET /api/tasks/search`, a wynik pokazywany jest w rozwijanej liście (dropdown) pod polem.
- Zapytanie do API jest wysyłane dopiero po 300 ms od ostatniego naciśnięcia klawisza (debounce) i tylko gdy zapytanie ma co najmniej 2 znaki; przy krótszym zapytaniu w UI pojawia się podpowiedź „Type at least 2 characters to start searching” zamiast wywołania API.
- Wybranie wyniku z listy (kliknięcie albo klawisz Enter po nawigacji strzałkami) **otwiera modal edycji tego zadania** — nie przenosi do żadnej konkretnej zakładki ani nie podświetla zadania na liście.
- Klawisz Escape zamyka rozwijaną listę wyników bez czyszczenia wpisanego tekstu.

---

## 5. Archiwizacja zadań

Archiwizacja to **wyłącznie logika frontendowa** (funkcja `isArchived` w kliencie) — API nie ma pojęcia „zarchiwizowane” i zwraca wszystkie zadania jednakowo przez `GET /api/tasks`.

Zadanie jest uznawane za zarchiwizowane, gdy **wszystkie** poniższe warunki są spełnione:

1. `status === "done"`.
2. Istnieje data odniesienia: `completedAt`, a jeśli go brak — `dueDate` (w tej kolejności pierwszeństwa). Jeśli żadne z tych dwóch pól nie jest ustawione, zadanie **nigdy** nie jest archiwizowane, nawet jeśli ma status `"done"`.
3. Data odniesienia daje się sparsować jako poprawna data.
4. Od tej daty minęło **więcej niż 30 dni** (ściśle więcej — zadanie zakończone dokładnie 30 dni temu **nie** jest jeszcze archiwizowane).

Zakładka **Archive** w widoku Tasks pokazuje wyłącznie zadania spełniające powyższy warunek. Zadania `"done"` sprzed mniej niż 30 dni pozostają widoczne w innych widokach (np. w zakładce Grid View czy Table), ale nie w zakładce Active (ta pokazuje tylko zadania ze statusem innym niż `"done"`).

---

## 6. Widoki i zachowanie UI (`/tasks`)

Widok Tasks ma pięć zakładek: **Active**, **Grid View**, **Table**, **Archive**, **Analytics**.

### 6.1 Active

- Pokazuje zadania ze statusem innym niż `"done"`.
- Filtry dostępne tylko w tej zakładce: **Assignee** (Wszyscy / Nieprzypisane / konkretny użytkownik), **Status** (All / To Do / In Progress — bez opcji „Done”, bo zakładka i tak wyklucza zadania zakończone), **Priority** (All / Low / Medium / High).
- Filtry Status i Priority ustawione w tej zakładce **pozostają aktywne również w zakładkach Grid View, Table i Archive** (współdzielony stan filtrów), mimo że te zakładki nie pokazują kontrolek do ich zmiany. Filtr Assignee działa wyłącznie w zakładce Active.
- Paginacja: 5 zadań na stronę.
- Przycisk „Quick Add” pokazuje/ukrywa uproszczony formularz tworzenia zadania (tylko: tytuł, opis, status, priorytet, termin, przypisanie — patrz sekcja 7.2).
- Pusta lista po zastosowaniu filtrów pokazuje komunikat „No tasks match your criteria”.

### 6.2 Grid View

- Pokazuje zadania jako karty z miniaturą (`coverImage`, jeśli ustawiony — w przeciwnym razie ikona zastępcza), plakietką priorytetu, statusem, typem zadania oraz osobą przypisaną.
- Podlega filtrom Status/Priority współdzielonym z zakładką Active (patrz wyżej), ale **nie** filtruje po statusie „nie done” — może pokazywać zadania zakończone.
- Brak paginacji — pokazywane są wszystkie pasujące zadania naraz.
- Kliknięcie karty otwiera modal edycji zadania.

### 6.3 Table

- Tabela z sortowaniem po kolumnach: Title, Status, Priority, Due date, Assignee (kliknięcie nagłówka przełącza kierunek sortowania).
- Edycja „inline” bezpośrednio w komórkach — ale tylko dla pól: `title`, `status`, `priority`, `dueDate`, `assigneeId`. Pozostałe pola zadania (typ, `severity`, `estimatedHours`, `tags`, `dependencies`, `requiresApproval`, `approver`) nie są tu ani widoczne, ani edytowalne.
- Zaznaczanie wielu wierszy (checkboxy) i masowe usuwanie zaznaczonych zadań; po operacji pokazywany jest komunikat z liczbą usuniętych zadań (a przy częściowym niepowodzeniu — ile się nie udało usunąć).
- Podlega współdzielonym filtrom Status/Priority opisanym w sekcji 6.1, ale **nie** jest ograniczona do zadań o statusie innym niż `"done"` — w przeciwieństwie do zakładki Active, Table pokazuje również zadania zakończone (chyba że filtr Status akurat je wyklucza).

### 6.4 Archive

- Pokazuje wyłącznie zadania spełniające regułę archiwizacji z sekcji 5, po zastosowaniu współdzielonych filtrów Status/Priority.
- Pusty stan pokazuje komunikat „Archive is Empty” wraz z opisem „Completed tasks are automatically archived after 30 days.”

### 6.5 Analytics

- Statystyki liczone na podstawie **wszystkich** zadań pobranych z API (`GET /api/tasks`), **bez** uwzględniania jakichkolwiek filtrów ustawionych w innych zakładkach: łączna liczba zadań, liczba zakończonych, liczba w toku, liczba o wysokim priorytecie.
- Rozkład zadań na osoby: dla każdego użytkownika pokazywana jest liczba przypisanych mu zadań (niezależnie od statusu) oraz procent względem wszystkich zadań; osobno liczone są zadania nieprzypisane.

---

## 7. Tworzenie zadań — różnice między kreatorem, szybkim dodawaniem a API

### 7.1 Kreator zadania (Task Wizard, przycisk „New Task”)

Trzykrokowy formularz (Basic information → Assignment and details → Summary):

- **Krok 1** ustawia: `taskType` (domyślnie `feature`), `title` (wymagane, min. 3 znaki — walidacja po stronie klienta odzwierciedla regułę API), `description`, `priority` (wymagane w UI). Wybranie priorytetu `high` pokazuje ostrzeżenie informacyjne „High priority tasks should be completed within 24h” — to tylko komunikat w interfejsie, nie reguła egzekwowana automatycznie na `dueDate`.
- **Krok 2** ustawia: `assigneeId` — **w kreatorze pole to jest wymagane** (mimo że API pozwala tworzyć zadania bez przypisania); `estimatedHours` (walidacja klienta: min. 1, jeśli podane); `dueDate`; `severity` — pole pojawia się tylko, gdy `taskType === "bug"`, i jest wtedy wymagane; checkbox „Requires manager approval” i wybór `approver` z zamkniętej listy (Manager A/B/C), pole `approver` pojawia się i jest wymagane tylko, gdy checkbox jest zaznaczony; `tags` i `dependencies` jako pola tekstowe rozdzielane przecinkami (bez podpowiedzi/autouzupełniania — pod polem `dependencies` wypisane są dostępne identyfikatory istniejących zadań jako podpowiedź tekstowa).
- **Krok 3** to tylko podgląd wprowadzonych danych przed wysłaniem — nie ma tu żadnych dodatkowych pól ani walidacji.
- Wysłanie formularza wykonuje `POST /api/tasks`. Błędy walidacji zwrócone przez API są pokazywane jako ogólny komunikat na kroku podsumowania (nie są mapowane na konkretne pola formularza wewnątrz kreatora).
- Po utworzeniu zadania kreator zamyka się automatycznie tylko przy sukcesie.

### 7.2 Szybkie dodawanie (Quick Add, w zakładce Active) i modal edycji zadania

Oba te formularze operują na dokładnie tym samym, węższym zestawie pól: `title`, `description`, `status`, `priority`, `dueDate`, `assigneeId`. Nie dają możliwości ustawienia ani zmiany: `taskType`, `severity`, `estimatedHours`, `tags`, `dependencies`, `requiresApproval`, `approver`, `coverImage`.

- Formularz Quick Add tworzy zadanie przez `POST /api/tasks` — pola spoza tej listy pozostają nieustawione (nie dziedziczą żadnych wartości domyślnych poza tymi, które i tak nadaje backend, patrz sekcja 2.1).
- Modal edycji zadania aktualizuje istniejące zadanie przez `PUT /api/tasks/:id`, wysyłając wszystkie sześć pól z formularza za każdym razem (nie tylko zmienione) — reszta pól zadania (m.in. `taskType`, `severity`, `estimatedHours`, `tags`, `dependencies`, `requiresApproval`, `approver`) pozostaje bez zmian, bo backend scala patch tylko z przesłanymi kluczami.
- Ustawienie `status` na `"done"` w tych formularzach uruchamia tę samą automatyczną logikę `completedAt`, co przy każdej innej ścieżce aktualizacji (sekcja 2.3) — formularze same nie wysyłają `completedAt`.
- Błędy walidacji z API są mapowane na konkretne pola formularza (czerwony komunikat pod danym polem), o ile pole błędu należy do tego zestawu sześciu pól; błędy dotyczące innych pól (np. reguł z sekcji 3, jeśli aktualizacja naruszy je pośrednio) trafiają tylko do ogólnego komunikatu błędu.

### 7.3 API bezpośrednio

- API nie narzuca żadnego z ograniczeń opisanych w 7.1–7.2 dotyczących tego, „które pola można ustawić w danym formularzu” — przez `POST`/`PUT` można ustawić dowolne pole z sekcji 1.1, w tym `taskType`, `severity`, `estimatedHours`, `tags`, `dependencies`, `requiresApproval` i `approver`, których UI (poza samym kreatorem przy tworzeniu) nie pozwala zmienić.
- Jedyne pole, którego nie da się ustawić przez żaden udokumentowany endpoint, to `coverImage` — występuje wyłącznie w danych startowych.
- Dokumentacja Swagger/OpenAPI dla wszystkich endpointów jest dostępna pod `/api-docs` po uruchomieniu backendu.

---

## 8. Zachowanie formularzy tworzenia użytkownika

Formularz na stronie **Users** tworzy użytkownika przez `POST /api/users`, wysyłając: `name`, `email`, `role` (domyślnie `viewer`), `avatar` (URL, opcjonalny). Błędy walidacji z API (patrz sekcja 1.2) są mapowane na te same cztery pola formularza.

Strona Users nie udostępnia żadnej akcji usuwania ani edycji użytkownika — lista jest tylko do odczytu poza samym formularzem dodawania (patrz też sekcja 2.9).

---

## 9. Trwałość danych

Aplikacja nie używa bazy danych — dane (`tasks`, `users`) są trzymane w pamięci procesu backendu i inicjalizowane stałym zestawem danych startowych przy starcie. Restart backendu (`npm run dev` / `npm run dev:server`) resetuje wszystkie zmiany wykonane przez UI lub API do stanu początkowego.

---

## 10. Dane startowe (seed data)

Zadania i użytkownicy, z którymi aplikacja startuje, to przykładowe dane demonstracyjne. Tytuły i opisy zadań w danych startowych są fikcyjne i służą wyłącznie do zilustrowania różnych kombinacji statusu, priorytetu, typu i przypisania — **nie są listą funkcji dostępnych w aplikacji**. Zestaw ten obejmuje zadania w każdym statusie i priorytecie, zadania nieprzypisane oraz zadania zakończone zarówno przed, jak i po progu 30 dni opisanym w sekcji 5, tak aby można było zaobserwować pełne zachowanie list, filtrów, wyszukiwania, dashboardu i archiwum opisane w tym dokumencie.
