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

- Zadanie jest usuwane bezwarunkowo — **nie ma żadnej blokady** związanej z tym, że inne zadania mają je w swoich `dependencies`. Po usunięciu zadania, jego identyfikator jest automatycznie usuwany z tablic `dependencies` wszystkich pozostałych zadań (zachowanie spójności referencji).
- Nieistniejące `id` zwraca `404`. Powodzenie zwraca `204` bez treści.

### 2.6 Zależności (`dependencies`) — czym są, a czym nie są

- `dependencies` to tablica identyfikatorów innych zadań, walidowana wyłącznie pod kątem tego, że każdy identyfikator istnieje i nie jest identyfikatorem samego zadania.
- **Reguła biznesowa ukończenia zadania**: zadania nie można oznaczyć jako `"done"`, dopóki wszystkie zadania wskazane w jego `dependencies` nie mają statusu `"done"`. Reguła jest egzekwowana zarówno przy tworzeniu (`POST /api/tasks`), jak i przy aktualizacji (`PUT /api/tasks/:id`) zadania — w tym drugim przypadku dotyczy każdej sytuacji, w której wynikowy (scalony) stan zadania ma status `"done"`: zarówno gdy status zmienia się na `"done"`, jak i wtedy, gdy zadanie pozostaje `"done"`, a zmienia się tylko jego lista `dependencies`.
  - Zadanie bez zależności (`dependencies: []` lub brak pola) może zostać ukończone bez żadnych dodatkowych warunków.
  - Sprawdzane są wyłącznie **bezpośrednie** zależności — zależności zależności nie są brane pod uwagę.
  - Jeśli wszystkie bezpośrednie zależności mają status `"done"`, operacja się powodzi tak jak dotychczas.
  - Jeśli przynajmniej jedna bezpośrednia zależność ma status inny niż `"done"`, żądanie jest odrzucane z kodem `409 Conflict` i ciałem postaci `{ "error": "Cannot complete task with incomplete dependencies", "blockingDependencies": [{ "id", "title", "status" }, ...] }`, gdzie `blockingDependencies` zawiera wyłącznie te bezpośrednie zależności, których status nie jest `"done"` (zależności już ukończone są pomijane). Zadanie w takim wypadku **nie** zostaje utworzone (przy `POST`) ani zmienione w żaden sposób — łącznie ze statusem i `completedAt` — (przy `PUT`).

### 2.7 `requiresApproval` / `approver` — czym są, a czym nie są

- Jedyna reguła biznesowa: jeśli `requiresApproval` jest `true`, pole `approver` musi być niepustym stringiem (przy tworzeniu i przy aktualizacji, licząc scalony obiekt).
- **Nie istnieje żaden proces zatwierdzania** — ustawienie `requiresApproval: true` i wybranie zatwierdzającego nie blokuje statusu zadania, nie wysyła powiadomień i nie tworzy żadnego zadania do wykonania dla „zatwierdzającego”. To zwykłe pola danych.
- Lista zatwierdzających dostępna w kreatorze zadań w UI to zamknięta lista trzech wartości: `manager-a`, `manager-b`, `manager-c`. API nie waliduje `approver` względem tej listy — akceptuje dowolny niepusty string.

### 2.8 Role użytkowników — czym są, a czym nie są

- Rola (`admin` / `editor` / `viewer`) jest ustawiana raz, przy tworzeniu użytkownika, i wyświetlana jako etykieta (kolorowy „chip”) na liście użytkowników.
- **Rola nie wpływa na to, co dany użytkownik może zrobić w aplikacji** — nie ma logowania ani sesji użytkownika, więc nie ma też pojęcia „zalogowanego” użytkownika, którego rola mogłaby cokolwiek ograniczać. Wszystkie akcje (tworzenie, edycja, usuwanie zadań i użytkowników) są dostępne dla każdego, kto korzysta z aplikacji lub API, niezależnie od ról przypisanych do użytkowników w systemie.

### 2.9 Szczegóły użytkownika (`GET /api/users/:id`)

- Zwraca pełny obiekt istniejącego użytkownika (`200`) albo `404` z ciałem `{ "error": "User not found" }`, gdy identyfikator nie istnieje.
- Endpoint nie dolicza żadnych statystyk ani listy zadań do obiektu użytkownika — widok szczegółów w UI (sekcja 6.7) pobiera zadania osobno z `GET /api/tasks` i sam wylicza podsumowanie po stronie klienta.

### 2.10 Usuwanie użytkownika (`DELETE /api/users/:id`)

- Reguła biznesowa: jeśli usuwany użytkownik ma przypisane zadania o statusie innym niż `"done"` (czyli `"todo"` lub `"in-progress"`), żądanie zwraca `409 Conflict` z ciałem `{ "error": "Cannot delete user with active tasks", "conflictingTasks": [{ "id", "title", "status" }, ...] }`, a użytkownik **nie** zostaje usunięty. `conflictingTasks` zawiera wyłącznie zadania o statusie `"todo"` lub `"in-progress"` — zadania `"done"` przypisane do tego użytkownika nigdy się tam nie pojawiają.
- Jeśli wszystkie przypisane zadania mają status `"done"` (lub użytkownik nie ma żadnych przypisanych zadań), usunięcie się powiedzie (`204`, bez treści odpowiedzi).
- Usunięcie użytkownika powoduje automatyczne wyczyszczenie pola `assigneeId` we wszystkich pozostałych zadaniach, które nadal na niego wskazywały (czyli w jego zadaniach o statusie `"done"`) — po ponownym pobraniu takie zadania pokazują brak przypisania.
- Nieistniejące `id` zwraca `404` z ciałem `{ "error": "User not found" }` — zarówno przy próbie usunięcia użytkownika, który nigdy nie istniał, jak i przy ponownej próbie usunięcia użytkownika już wcześniej usuniętego.
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

Cały odtwarzalny stan tego widoku (aktywna zakładka, filtry, strona, sortowanie tabeli) jest trzymany wyłącznie w parametrach adresu URL — komponent nie utrzymuje równoległego stanu React dla tych wartości, więc nie mogą się one rozjechać z adresem. Pełny opis kontraktu parametrów, wartości domyślnych i obsługi błędnych adresów znajduje się w sekcji 6.9.

### 6.1 Active

- Pokazuje zadania ze statusem innym niż `"done"`.
- Filtry dostępne tylko w tej zakładce: **Assignee** (Wszyscy / Nieprzypisane / konkretny użytkownik), **Status** (All / To Do / In Progress — bez opcji „Done”, bo zakładka i tak wyklucza zadania zakończone), **Priority** (All / Low / Medium / High).
- Filtry Status, Priority i Assignee, a także paginacja, dotyczą **wyłącznie** zakładki Active — nie wpływają na Grid View, Table, Archive ani Analytics. Dzięki temu żaden filtr nie zawęża wyników w miejscu, gdzie użytkownik nie widzi (i nie może zmienić) odpowiadającej mu kontrolki.
- Paginacja: 5 zadań na stronę.
- Przycisk „Quick Add” pokazuje/ukrywa uproszczony formularz tworzenia zadania (tylko: tytuł, opis, status, priorytet, termin, przypisanie — patrz sekcja 7.2).
- Pusta lista po zastosowaniu filtrów pokazuje komunikat „No tasks match your criteria”.

### 6.2 Grid View

- Pokazuje zadania jako karty z miniaturą (`coverImage`, jeśli ustawiony — w przeciwnym razie ikona zastępcza), plakietką priorytetu, statusem, typem zadania oraz osobą przypisaną.
- Pokazuje wszystkie zadania (bez filtrowania po statusie, priorytecie ani przypisaniu — patrz 6.1) i bez ograniczenia do zadań „nie done”; może więc pokazywać zadania zakończone.
- Brak paginacji — pokazywane są wszystkie zadania naraz.
- Kliknięcie karty otwiera modal edycji zadania.

### 6.3 Table

- Tabela z sortowaniem po kolumnach: Title, Status, Priority, Due date, Assignee (kliknięcie nagłówka przełącza kierunek sortowania; pole i kierunek sortowania są odtwarzalne z adresu URL — patrz 6.9).
- Edycja „inline” bezpośrednio w komórkach — ale tylko dla pól: `title`, `status`, `priority`, `dueDate`, `assigneeId`. Pozostałe pola zadania (typ, `severity`, `estimatedHours`, `tags`, `dependencies`, `requiresApproval`, `approver`) nie są tu ani widoczne, ani edytowalne. Jeśli zmiana statusu na `"done"` zostanie odrzucona przez API (`409`, patrz sekcja 2.6), komórka statusu pokazuje treść błędu pod polem, a status w tabeli pozostaje bez zmian — operację można ponowić od razu.
- Zaznaczanie wielu wierszy (checkboxy) i masowe usuwanie zaznaczonych zadań; po operacji pokazywany jest komunikat z liczbą usuniętych zadań (a przy częściowym niepowodzeniu — ile się nie udało usunąć). Zaznaczenie dotyczy wyłącznie zadań aktualnie widocznych w tabeli: opcja „Select all” zaznacza tylko widoczne wiersze, licznik zaznaczonych rekordów i stan pośredni checkboxa „Select all” liczone są tylko względem widocznych zadań, a masowe usuwanie działa wyłącznie na identyfikatorach zadań nadal widocznych w tabeli w chwili wykonania operacji. Jeśli w wyniku zmiany filtrów lub innego zestawu zadań któreś z zaznaczonych wcześniej zadań przestaje być widoczne, jest automatycznie usuwane z zaznaczenia. Zaznaczenie wierszy, edycja komórek i sam fakt otwarcia modala/formularza nie są zapisywane w URL.
- Pokazuje wszystkie zadania (bez filtrowania po statusie, priorytecie ani przypisaniu — patrz 6.1), w tym zadania zakończone — w przeciwieństwie do zakładki Active, Table nie wyklucza statusu `"done"`.

### 6.4 Archive

- Pokazuje wyłącznie zadania spełniające regułę archiwizacji z sekcji 5. Nie podlega filtrom Status/Priority/Assignee (patrz 6.1).
- Pusty stan pokazuje komunikat „Archive is Empty” wraz z opisem „Completed tasks are automatically archived after 30 days.”

### 6.5 Analytics

- Statystyki liczone na podstawie **wszystkich** zadań pobranych z API (`GET /api/tasks`), **bez** uwzględniania jakichkolwiek filtrów ustawionych w innych zakładkach: łączna liczba zadań, liczba zakończonych, liczba w toku, liczba o wysokim priorytecie.
- Rozkład zadań na osoby: dla każdego użytkownika pokazywana jest liczba przypisanych mu zadań (niezależnie od statusu) oraz procent względem wszystkich zadań; osobno liczone są zadania nieprzypisane.

### 6.6 Widok szczegółów (Task Details)

- Dostępny pod osobnym adresem `/tasks/:id`, ładuje i prezentuje pełne dane zadania na podstawie odpowiedzi z API.
- Wyświetla wszystkie właściwości modelu zadania w tym rozszerzone pola niedostępne w uproszczonych formularzach (m.in. typ zadania, severity, tagi, logikę zatwierdzania, godziny, powiązania).
- Wskazuje powiązania: rozwiązując pole `assigneeId` na dane z listy użytkowników, a przy `approver` korzystając z zamkniętego zestawu wartości tekstowych (nie identyfikatorów), pokazując przyjazną etykietę i oryginalną wartość. Zależności pomiędzy zadaniami pozwalają na swobodne przechodzenie między widokami zależnych zadań (linki do powiązanych rekordów).
- Przy każdej zależności pokazywany jest jej aktualny status. Zależności o statusie innym niż `"done"` są dodatkowo oznaczone jako blokujące ukończenie zadania (zgodnie z regułą opisaną w sekcji 2.6) — link do szczegółów danej zależności pozostaje dostępny niezależnie od jej statusu.
- Puste pola opcjonalne są jawnie oznaczane jako brak wartości ("Not set"), zamiast być ukrywane.
- Prezentuje adres URL miniatury `coverImage` (w formie klikalnego linku), oprócz wyświetlenia samego obrazu.
- Służy wyłącznie do odczytu – wszelka edycja realizowana jest z innych widoków przez akcje przypisane kartom lub wierszom tabel.
- Dostęp do widoku realizowany jest za pomocą dedykowanego linku "View details" dodanego obok głównej akcji "Edit" / "Delete" na elementach listy (np. Table, TaskCard).
- Bezpiecznie obsługuje brak istnienia zadania – gdy API zwróci błąd `404`, aplikacja (SPA) wyświetli odpowiedni stan widoku „Task not found” informujący jasno o problemie, przy zachowaniu spójności nawigacji i możliwości powrotu do listy. Błędy sieciowe (np. 500) prezentują stosowny komunikat z opcją ponowienia.

### 6.7 Widok szczegółów użytkownika (`/users/:id`)

- Dostępny pod osobnym adresem `/users/:id`; link „View details” prowadzący do tego widoku znajduje się zarówno przy każdym użytkowniku na liście mobilnej (karty), jak i w kolumnie **Actions** tabeli desktopowej na stronie Users.
- Po wejściu widok równolegle pobiera dane użytkownika (`GET /api/users/:id`) oraz pełną listę zadań (`GET /api/tasks`), a następnie sam wylicza po stronie klienta: liczbę wszystkich przypisanych zadań, liczbę aktywnych (status inny niż `"done"`) i liczbę ukończonych (status `"done"`).
- Prezentuje: avatar (lub zastępcze inicjały, gdy brak `avatarUrl`/`avatar` albo obraz nie chce się załadować), imię i nazwisko, adres e-mail, rolę oraz identyfikator (`id`) użytkownika.
- Zadania przypisane do użytkownika są pokazane w dwóch osobnych sekcjach — „Active tasks” i „Completed tasks” — każde jako lista z tytułem, statusem, priorytetem, terminem (jeśli ustawiony) oraz linkiem „View details” prowadzącym do `/tasks/:id`. Brak zadań w danej sekcji pokazuje odpowiedni komunikat zamiast pustej listy — ale wyłącznie wtedy, gdy lista zadań została już poprawnie pobrana (patrz niżej).
- Jeśli pobranie danych użytkownika zwróci `404`, widok pokazuje stan „User not found” z linkiem powrotu do listy użytkowników — żadne dane profilu nie są wtedy renderowane. Błąd sieciowy lub `5xx` przy pobieraniu użytkownika pokazuje osobny stan błędu z przyciskiem „Retry”, również bez częściowo zbudowanego profilu.
- Statystyki zadań oraz obie sekcje list rozróżniają trzy stany danych o zadaniach użytkownika, aby nigdy nie sugerować prawdziwych zer tam, gdzie danych po prostu jeszcze nie ma:
  - **pobieranie w toku** — statystyki pokazują `…` zamiast liczby, a zamiast list „Active tasks”/„Completed tasks” widoczny jest komunikat o trwającym ładowaniu;
  - **błąd pobrania** (sieciowy, `5xx`, albo poprawne `200` z odpowiedzią, która nie jest tablicą — to również traktowane jako kontrolowany błąd danych) — statystyki pokazują „Unavailable” zamiast liczby, a komunikaty „No active tasks assigned”/„No completed tasks assigned” nie są wyświetlane, ponieważ nie wiadomo, czy taki byłby ich prawdziwy stan; widoczny jest za to osobny, czytelny komunikat o błędzie pobierania zadań z przyciskiem „Retry” ograniczonym tylko do ponowienia tego zapytania;
  - **poprawnie pobrana tablica** (również pusta) — dopiero wtedy statystyki pokazują rzeczywiste liczby (w tym prawdziwe zera) i listy pokazują albo przypisane zadania, albo właściwy komunikat o braku zadań w danej sekcji.
- Powyższy trzystanowy podział dotyczy wyłącznie danych o zadaniach — jeśli uda się pobrać samego użytkownika, jego profil (avatar, dane) jest widoczny niezależnie od stanu pobierania zadań; udany retry po błędzie przywraca właściwe statystyki i listy.
- Bezpośrednie wejście lub odświeżenie strony pod adresem `/users/:id` działa tak samo jak nawigacja z listy — dane są pobierane od nowa przy każdym takim wejściu.

### 6.8 Usuwanie użytkownika z poziomu UI

- Na stronie `/users/:id` znajduje się przycisk „Delete user”, który otwiera dostępny modal potwierdzający (oparty na tym samym komponencie dialogu co edycja zadań — z pułapką fokusu, zamykaniem przez Escape i przywracaniem fokusu na przycisk, który otworzył modal).
- Modal informuje wprost, że operacji nie można cofnąć oraz że usunięcie użytkownika jest możliwe tylko wtedy, gdy nie ma on aktywnych (`"todo"` lub `"in-progress"`) zadań przypisanych. Zawiera przyciski „Cancel” i „Delete user”.
- W trakcie wykonywania żądania przycisk potwierdzenia pokazuje stan „Deleting…” i jest zablokowany, tak aby kolejne kliknięcie nie wysłało drugiego żądania. Dopóki żądanie trwa, modalu nie da się też zamknąć w żaden inny sposób — ani przyciskiem „Cancel” (również wtedy zablokowany), ani klawiszem Escape, ani kliknięciem w tło — dzięki czemu zamknięcie i ponowne otwarcie modalu nie może nigdy nałożyć się na wciąż trwające żądanie usunięcia. Po zakończeniu żądania (sukcesem lub błędem) blokada znika i modal ponownie reaguje normalnie na „Cancel”/Escape/kliknięcie w tło.
- **Sukces (`204`)**: modal się zamyka, aplikacja przechodzi na `/users`, a lista użytkowników na tej stronie jest od razu pobrana na nowo — usunięty użytkownik nie jest już na niej widoczny bez potrzeby ręcznego odświeżania strony. Nad listą pojawia się jednorazowy, dostępny komunikat sukcesu (np. „Alice Johnson deleted successfully”) w regionie `role="status"`; komunikat nie jest już widoczny po odświeżeniu strony ani po powrocie/przejściu do niej z historii przeglądarki.
- **Konflikt (`409`)**: modal pozostaje otwarty, użytkownik nie znika z widoku, a wewnątrz modalu pokazywany jest zarówno komunikat główny („Cannot delete user with active tasks”), jak i lista blokujących zadań (`conflictingTasks`) — każde z tytułem, statusem i linkiem „View details” do `/tasks/:id`. Zamknięcie i ponowne otwarcie modalu czyści poprzedni błąd; kolejne kliknięcie „Delete user” zawsze wysyła nowe żądanie.
- **Użytkownik już nie istnieje (`404`)** podczas próby usunięcia: modal pokazuje informację, że użytkownik już nie istnieje, wraz z linkiem powrotu do `/users`.
- **Błąd sieciowy lub `5xx`**: modal pozostaje otwarty z komunikatem błędu i możliwością ponowienia — operacja nie jest traktowana tak, jakby zwróciła `409`, ani jakby się powiodła.

### 6.9 Udostępnialny stan widoku Tasks (parametry URL)

Adres `/tasks` jednoznacznie opisuje aktualnie wyświetlany widok: aktywną zakładkę, filtry (tam, gdzie mają zastosowanie — patrz 6.1–6.4), numer strony i sortowanie tabeli. URL jest jedynym źródłem prawdy dla tego stanu — komponent nie trzyma równoległego stanu Reacta dla tych wartości. Skopiowanie adresu, otwarcie go w nowej karcie, odświeżenie strony oraz przyciski Wstecz/Dalej przeglądarki zawsze odtwarzają dokładnie to, co było widoczne (bez pełnego przeładowania SPA w przypadku Wstecz/Dalej i zmiany zakładki/filtrów/strony/sortowania).

**Parametry i obsługiwane wartości** (każdy zapisywany tylko wtedy, gdy różni się od wartości domyślnej):

| Parametr | Zakładka | Wartości | Domyślna (pomijana w URL) |
|---|---|---|---|
| `tab` | wszystkie | `active`, `grid`, `table`, `archived`, `analytics` | `active` |
| `status` | tylko `active` | `todo`, `in-progress` | `all` |
| `priority` | tylko `active` | `low`, `medium`, `high` | `all` |
| `assignee` | tylko `active` | `unassigned` lub identyfikator użytkownika | `all` |
| `page` | tylko `active` | liczba całkowita ≥ 1 | `1` |
| `sort` | tylko `table` | `title`, `status`, `priority`, `dueDate`, `assigneeId` | `title` |
| `order` | tylko `table` | `asc`, `desc` | `asc` |

Przykłady: `/tasks?status=in-progress&priority=high&assignee=user-1&page=2` (zakładka Active, domyślna) oraz `/tasks?tab=table&sort=dueDate` (kanoniczny URL zakładki Table posortowanej po `dueDate` rosnąco — `order=asc` jest wartością domyślną, więc normalizacja usuwa go z adresu; adres z jawnie podanym `order=asc` zostanie sprowadzony do tej postaci).

**Filtry i paginacja per zakładka** — zgodnie z decyzją opisaną w 6.1–6.4, filtry Status/Priority/Assignee oraz paginacja dotyczą wyłącznie zakładki Active; pole wyszukiwania (`TaskSearch`) nigdy nie trafia do URL, bo to osobny mechanizm (patrz sekcja 4) niezwiązany z listą/tabelą/kartami. Sortowanie (`sort`/`order`) dotyczy wyłącznie zakładki Table — `TaskTable` nie ma już własnego, niezależnego stanu sortowania; pole i kierunek są przekazywane do niego jako kontrolowane propsy z widoku `Tasks`, sterowane przez URL.

**Zmiana zakładki** usuwa z URL parametry nieobsługiwane przez nową zakładkę (np. przejście z Active do Grid View czyści `status`/`priority`/`assignee`/`page`; przejście na Active ustawia stronę na 1). Zaznaczenie wierszy tabeli, otwarte modale/formularze i treść pola wyszukiwania nigdy nie trafiają do URL.

**Paginacja**: po zmianie dowolnego filtra lub zakładki strona wraca na 1. Jeśli numer strony w URL wykracza poza liczbę dostępnych stron (również po utworzeniu, edycji lub usunięciu zadania, gdy zmienia się liczba wyników), zostaje on skorygowany do ostatniej dostępnej strony (a przynajmniej do strony 1) — użytkownik nigdy nie zostaje na pustej stronie, jeśli wcześniejsze strony mają wyniki. Ta korekta następuje wyłącznie po **udanym** (`GET /api/tasks` zwróciło poprawną tablicę) pobraniu zadań. Dopóki żądanie trwa albo zakończyło się błędem (sieciowym, `5xx` lub niepoprawnym payloadem), numer strony z URL pozostaje nietknięty — inaczej pusta lista wynikająca z trwającego ładowania lub z błędu zostałaby błędnie potraktowana jako „nie ma tylu wyników” i strona zostałaby bezpowrotnie sprowadzona do 1, mimo że po stronie serwera dane mogą się znaleźć (przy ponowieniu) na stronie, o którą pierwotnie proszono.

**Błędne parametry** nigdy nie powodują awarii ani niewyjaśnionego pustego widoku: nieznana zakładka, nieznany status/priorytet, nieprawidłowy numer strony (tekst, zero, liczba ujemna, ułamek) oraz nieobsługiwane pole/kierunek sortowania wracają do wartości domyślnej niezależnie od stanu pobierania danych (nie zależą od żadnego zapytania do API). Identyfikator w `assignee`, który nie odpowiada żadnemu użytkownikowi, jest usuwany (filtr wraca do „All assignees”) — ale dopiero **po udanym** zakończeniu pobierania listy użytkowników z `GET /api/users` (poprawna odpowiedź z tablicą użytkowników, która nie zawiera tego identyfikatora). Dopóki żądanie do `/api/users` trwa, **lub zakończyło się błędem** (sieciowym, `5xx` czy niepoprawnym payloadem), dowolny identyfikator w `assignee` jest traktowany jako potencjalnie poprawny i nie jest usuwany — sam fakt, że żądanie się zakończyło, nie jest traktowany jako potwierdzenie, że zwrócone dane (w tym pusta lista przy błędzie) nadają się do walidacji URL; inaczej błąd pobrania użytkowników wyglądałby tak samo, jak lista, w której danego identyfikatora rzeczywiście nie ma, i poprawny filtr zostałby bezpowrotnie usunięty z udostępnionego linku. Z tego samego powodu zadania i użytkownicy są od siebie pobierani niezależnie, a nie w ramach jednego wspólnego `Promise.all`, który opóźniałby wyświetlenie zadań do czasu odpowiedzi obu żądań. Dotychczasowa prezentacja błędów API (komunikat w banerze błędu) działa bez zmian niezależnie od tego mechanizmu. W każdym z opisanych przypadków normalizacji adres jest zmieniany przez `history.replaceState` (bez dodawania wpisu do historii), tak aby URL zawsze odpowiadał temu, co faktycznie widać na ekranie; sama normalizacja nie pokazuje przy tym żadnego dodatkowego, globalnego komunikatu błędu.

**Historia przeglądarki**: jawna zmiana zakładki, filtra, strony lub sortowania (klik, wybór z listy, klawiatura) tworzy nowy wpis w historii (możliwy do cofnięcia przyciskiem Wstecz). Automatyczna normalizacja błędnych parametrów oraz korekta strony poza zakresem używają `replace` i nie tworzą dodatkowego wpisu. Nawigacja klawiaturą między zakładkami (strzałki, Home, End) działa tak jak dotychczas i również aktualizuje URL jako jawna zmiana zakładki.

Świadome ograniczenie: obie ścieżki wywołujące zmianę URL (jawna akcja użytkownika i automatyczna korekta uruchamiana efektem po doładowaniu danych) mogą się teoretycznie nałożyć, jeśli użytkownik kliknie inną zakładkę dokładnie w tej samej klatce renderowania, w której kończy się ładowanie danych wymagające korekty strony. Jest to skrajnie mało prawdopodobne w normalnym użytkowaniu (wymaga interakcji w oknie pojedynczych milisekund) i nie zostało zaadresowane dodatkową synchronizacją.

---

## 7. Tworzenie zadań — różnice między kreatorem, szybkim dodawaniem a API

### 7.1 Kreator zadania (Task Wizard, przycisk „New Task”)

Trzykrokowy formularz (Basic information → Assignment and details → Summary):

- **Krok 1** ustawia: `taskType` (domyślnie `feature`), `title` (wymagane, min. 3 znaki — walidacja po stronie klienta odzwierciedla regułę API), `description`, `priority` (wymagane w UI). Wybranie priorytetu `high` pokazuje ostrzeżenie informacyjne „High priority tasks should be completed within 24h” — to tylko komunikat w interfejsie, nie reguła egzekwowana automatycznie na `dueDate`.
- **Krok 2** ustawia: `assigneeId` — **w kreatorze pole to jest wymagane** (mimo że API pozwala tworzyć zadania bez przypisania); `estimatedHours` (walidacja klienta: min. 1, jeśli podane); `dueDate`; `severity` — pole pojawia się tylko, gdy `taskType === "bug"`, i jest wtedy wymagane; checkbox „Requires manager approval” i wybór `approver` z zamkniętej listy (Manager A/B/C), pole `approver` pojawia się i jest wymagane tylko, gdy checkbox jest zaznaczony; `tags` i `dependencies` jako pola tekstowe rozdzielane przecinkami (bez podpowiedzi/autouzupełniania — pod polem `dependencies` wypisane są dostępne identyfikatory istniejących zadań jako podpowiedź tekstowa).
- **Krok 3** to tylko podgląd wprowadzonych danych przed wysłaniem — nie ma tu żadnych dodatkowych pól ani walidacji.
- Wysłanie formularza wykonuje `POST /api/tasks`. Puste pola opcjonalne pozostawione po wcześniejszych krokach nie są wysyłane jako niepoprawne wartości techniczne: wyczyszczone pole `dueDate` (puste `""`) jest pomijane w wysyłanym payloadzie zamiast wysłania pustego stringa, a wyczyszczone pole `estimatedHours` jest pomijane zamiast wysłania `0`. Podobnie, jeśli `requiresApproval` zostanie odznaczone po wcześniejszym wybraniu `approver`, wartość `approver` nie jest wysyłana; a jeśli typ zadania zostanie zmieniony z `"bug"` na inny po wcześniejszym wybraniu `severity`, wartość `severity` nie jest wysyłana. Błędy walidacji zwrócone przez API są pokazywane jako ogólny komunikat na kroku podsumowania (nie są mapowane na konkretne pola formularza wewnątrz kreatora).
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

## 8. Lista użytkowników i zachowanie formularza tworzenia

Formularz na stronie **Users** tworzy użytkownika przez `POST /api/users`, wysyłając: `name`, `email`, `role` (domyślnie `viewer`), `avatar` (URL, opcjonalny). Błędy walidacji z API (patrz sekcja 1.2) są mapowane na te same cztery pola formularza.

Lista użytkowników pokazuje każdego użytkownika jako kartę (widok mobilny) lub wiersz tabeli (widok desktopowy) z awatarem (lub inicjałami zastępczymi), imieniem i nazwiskiem, e-mailem oraz kolorową plakietką roli. Tabela desktopowa ma kolumnę **Actions** zamiast statycznej etykiety statusu konta — takiego statusu backend nie przechowuje, więc UI go nie sugeruje. Zarówno na kartach mobilnych, jak i w kolumnie Actions tabeli, znajduje się link „View details” prowadzący do widoku szczegółów danego użytkownika (`/users/:id`, patrz sekcja 6.7) — sama karta ani cały wiersz nie są klikalne, tylko ten link. Usuwanie użytkownika jest dostępne wyłącznie z poziomu widoku szczegółów (patrz sekcje 6.7–6.8 i 2.10). Nadal nie istnieje żadna forma edycji użytkownika (patrz sekcja 2.10) — ani na liście, ani w widoku szczegółów.

---

## 9. Trwałość danych

Aplikacja nie używa bazy danych — dane (`tasks`, `users`) są trzymane w pamięci procesu backendu i inicjalizowane stałym zestawem danych startowych przy starcie. Restart backendu (`npm run dev` / `npm run dev:server`) resetuje wszystkie zmiany wykonane przez UI lub API do stanu początkowego.

---

## 10. Dane startowe (seed data)

Zadania i użytkownicy, z którymi aplikacja startuje, to przykładowe dane demonstracyjne. Tytuły i opisy zadań w danych startowych są fikcyjne i służą wyłącznie do zilustrowania różnych kombinacji statusu, priorytetu, typu i przypisania — **nie są listą funkcji dostępnych w aplikacji**. Zestaw ten obejmuje zadania w każdym statusie i priorytecie, zadania nieprzypisane oraz zadania zakończone zarówno przed, jak i po progu 30 dni opisanym w sekcji 5, tak aby można było zaobserwować pełne zachowanie list, filtrów, wyszukiwania, dashboardu i archiwum opisane w tym dokumencie.
