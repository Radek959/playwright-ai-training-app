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
`approver` | `string` | Wymagany, jeśli `requiresApproval` jest `true`. **Uwaga:** aplikacja nadal nie ma logowania ani sesji użytkownika — `approver` jedynie *nazywa*, w czyim imieniu zapisywana jest decyzja zatwierdzenia/odrzucenia; nie jest to identyfikator uwierzytelnionej osoby ani mechanizm kontroli dostępu.
`approvalStatus` | `"pending" \| "approved" \| "rejected"` | Obecne wyłącznie, gdy `requiresApproval` jest (lub było) `true`. Patrz sekcja 2.7 — pełny opis procesu zatwierdzania.
`approvalComment` | `string` | Opcjonalny, maks. 500 znaków po `trim`. Obecny tylko przy decyzji końcowej (`approved`/`rejected`).
`approvalDecidedAt` | `string` (data-czas ISO) | Obecny tylko przy decyzji końcowej (`approved`/`rejected`).

### 1.2 Użytkownik (User)

Pole | Typ / dozwolone wartości | Uwagi
---|---|---
`id` | `string` | Generowane przez backend przy tworzeniu.
`name` | `string` | Wymagane, niepuste po `trim`.
`email` | `string` | Wymagane, musi pasować do wzorca `coś@coś.coś`, musi być unikalne (porównanie bez rozróżniania wielkości liter) wśród istniejących użytkowników.
`role` | `"admin" \| "editor" \| "viewer"` | Domyślnie `"viewer"` przy tworzeniu przez API. **Uwaga:** rola jest wyłącznie etykietą wyświetlaną w UI — żaden endpoint ani widok nie sprawdza roli, by ograniczyć lub przyznać uprawnienia.
`avatar` | `string` | Opcjonalne, ustawiane przez formularz tworzenia użytkownika.
`avatarUrl` | `string` | Pole obecne tylko w danych startowych (część użytkowników seedowych je ma, część nie); formularz tworzenia użytkownika go nie ustawia.

### 1.3 Komentarz (Comment)

Pole | Typ / dozwolone wartości | Uwagi
---|---|---
`id` | `string` | Generowane przez backend przy tworzeniu; niemodyfikowalne.
`taskId` | `string` | Identyfikator zadania, do którego należy komentarz. Ustawiane przez backend na podstawie parametru `:id` w URL — nie da się go przesłać w ciele żądania.
`content` | `string` | Wymagane, niepuste po `trim`, maks. 1000 znaków po `trim`. Zawsze przycinane przed zapisem.
`authorId` | `string` (`id` istniejącego użytkownika) lub brak | Wskazuje, w czyim imieniu zapisano komentarz. **Aplikacja nadal nie ma logowania ani sesji użytkownika** — `authorId` jest jawnie wybierany z listy istniejących użytkowników przez osobę dodającą komentarz, a nie identyfikatorem uwierzytelnionej osoby. Może zniknąć (stać się nieobecne) po usunięciu wskazanego użytkownika — patrz sekcja 2.10.
`authorName` | `string` | Migawka nazwy autora zapisana w chwili tworzenia komentarza. Pozostaje niezmieniona nawet po usunięciu autora, dzięki czemu komentarz da się poprawnie zaprezentować (patrz sekcja 2.11) niezależnie od tego, czy `authorId` nadal istnieje.
`createdAt` | `string` (data-czas ISO) | Generowane przez backend przy tworzeniu; niemodyfikowalne.

Komentarze są przechowywane wyłącznie w pamięci procesu serwera (tak jak zadania i użytkownicy) i resetują się do wartości startowych po ponownym uruchomieniu serwera.

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
- Usunięcie zadania usuwa też **wszystkie jego komentarze** (patrz sekcja 2.11) — nie zostają osierocone.
- Nieistniejące `id` zwraca `404`. Powodzenie zwraca `204` bez treści.

### 2.6 Zależności (`dependencies`) — czym są, a czym nie są

- `dependencies` to tablica identyfikatorów innych zadań, walidowana wyłącznie pod kątem tego, że każdy identyfikator istnieje i nie jest identyfikatorem samego zadania.
- **Reguła biznesowa ukończenia zadania**: zadania nie można oznaczyć jako `"done"`, dopóki wszystkie zadania wskazane w jego `dependencies` nie mają statusu `"done"`. Reguła jest egzekwowana zarówno przy tworzeniu (`POST /api/tasks`), jak i przy aktualizacji (`PUT /api/tasks/:id`) zadania — w tym drugim przypadku dotyczy każdej sytuacji, w której wynikowy (scalony) stan zadania ma status `"done"`: zarówno gdy status zmienia się na `"done"`, jak i wtedy, gdy zadanie pozostaje `"done"`, a zmienia się tylko jego lista `dependencies`.
  - Zadanie bez zależności (`dependencies: []` lub brak pola) może zostać ukończone bez żadnych dodatkowych warunków.
  - Sprawdzane są wyłącznie **bezpośrednie** zależności — zależności zależności nie są brane pod uwagę.
  - Jeśli wszystkie bezpośrednie zależności mają status `"done"`, operacja się powodzi tak jak dotychczas.
  - Jeśli przynajmniej jedna bezpośrednia zależność ma status inny niż `"done"`, żądanie jest odrzucane z kodem `409 Conflict` i ciałem postaci `{ "error": "Cannot complete task with incomplete dependencies", "blockingDependencies": [{ "id", "title", "status" }, ...] }`, gdzie `blockingDependencies` zawiera wyłącznie te bezpośrednie zależności, których status nie jest `"done"` (zależności już ukończone są pomijane). Zadanie w takim wypadku **nie** zostaje utworzone (przy `POST`) ani zmienione w żaden sposób — łącznie ze statusem i `completedAt` — (przy `PUT`).
  - Ta reguła i reguła zatwierdzania (sekcja 2.7) są od siebie niezależne i obie muszą być spełnione, żeby zadanie mogło mieć status `"done"`; jeśli obie są naruszone, zwracany jest błąd zależności (sprawdzany jako pierwszy).

### 2.7 Proces zatwierdzania (`requiresApproval` / `approver` / `approvalStatus`)

**Aplikacja nadal nie ma logowania ani sesji użytkownika.** `approver` to zamknięta lista trzech wartości tekstowych w UI (`manager-a`, `manager-b`, `manager-c`; API akceptuje dowolny niepusty string) — **nazywa**, w czyim imieniu zapisywana jest decyzja, ale nikogo nie uwierzytelnia ani nie ogranicza dostępu do wywołania endpointu decyzji. Każdy, kto ma dostęp do aplikacji lub API, może zapisać decyzję „w imieniu” dowolnego `approver`.

- Jedyna reguła walidacji pól: jeśli `requiresApproval` jest `true`, pole `approver` musi być niepustym stringiem (przy tworzeniu i przy aktualizacji, licząc scalony obiekt) — bez zmian względem wcześniejszej wersji.
- **Stan procesu** (`approvalStatus`) porusza się według reguł:
  - Utworzenie zadania (`POST /api/tasks`) z `requiresApproval: true` zawsze ustawia `approvalStatus: "pending"`. Nie da się utworzyć zadania od razu zatwierdzonego/odrzuconego.
  - Włączenie `requiresApproval` (z `false` na `true`) przez `PUT /api/tasks/:id` uruchamia nowy proces od `"pending"`.
  - Wyłączenie `requiresApproval` (z `true` na `false`) przez `PUT /api/tasks/:id` **czyści** `approvalStatus`, `approvalComment` i `approvalDecidedAt` — nie ma już aktywnego procesu.
  - `approvalStatus`, `approvalComment` i `approvalDecidedAt` **nie da się ustawić bezpośrednio** przez zwykłe `PUT /api/tasks/:id` — próba przesłania któregokolwiek z nich zwraca `400` (`"<pole> is not an updatable field"`), tak jak każde inne nieznane pole.
  - Jedyny sposób przejścia `"pending"` → `"approved"`/`"rejected"` to nowy endpoint `PUT /api/tasks/:id/approval` (patrz niżej).
  - **Reset przy istotnej edycji**: jeśli zadanie ma decyzję końcową (`"approved"` lub `"rejected"`) i `PUT /api/tasks/:id` faktycznie zmienia wartość jednego z pól: `title`, `description`, `priority`, `dueDate`, `assigneeId`, `taskType`, `severity`, `estimatedHours`, `tags`, `dependencies`, `approver` — proces wraca do `"pending"`, a `approvalComment`/`approvalDecidedAt` są czyszczone. Samo przesłanie tej samej wartości (żądanie bez realnej zmiany) **nie** resetuje procesu; sama zmiana `status` — bez zmiany żadnego z powyższych pól — również nie resetuje procesu.
  - **Automatyczne ponowne otwarcie ukończonego zadania**: jeśli zadanie jest już `status: "done"` i `approvalStatus: "approved"`, a `PUT /api/tasks/:id` w tym samym żądaniu wykonuje istotną edycję opisaną wyżej (czyli resetuje proces do `"pending"`), zadanie jest **atomowo ponownie otwierane w ramach tego samego żądania**: `status` wraca na `"in-progress"`, a `completedAt` jest czyszczone. Żądanie kończy się `200` z pełnym, zapisanym zadaniem — nie ma osobnego kroku ani drugiego wywołania. Ponowne otwarcie **nie** następuje, gdy żądanie jest no-opem (te same wartości przesłane ponownie), gdy zmienia się wyłącznie `status`, albo gdy reset zatwierdzenia i tak by nie nastąpił (np. zadanie nie było jeszcze zatwierdzone). Cała operacja jest atomowa: błąd walidacji lub konflikt zależności nie zapisuje żadnej częściowej zmiany.
- **Reguła ukończenia zadania**: jeśli wynikowe zadanie ma `requiresApproval: true`, nie można ustawić mu statusu `"done"`, dopóki `approvalStatus` nie jest `"approved"`. Dla `"pending"`, `"rejected"` lub braku `approvalStatus`, żądanie (zarówno `POST`, jak i `PUT`) jest odrzucane z `409 Conflict`:
  ```json
  { "error": "Cannot complete task without approval", "approvalBlocker": { "status": "pending", "approver": "manager-a" } }
  ```
  Zadanie w takim wypadku pozostaje bez zmian (analogicznie do reguły zależności w sekcji 2.6). Wyjątkiem jest opisane wyżej automatyczne ponowne otwarcie: tam zadanie samo przechodzi na `"in-progress"` w ramach edycji, więc ta reguła po prostu nie ma się do czego zastosować.

#### `PUT /api/tasks/:id/approval` — zapisanie decyzji

- Ciało żądania: `{ "decision": "approved" | "rejected", "comment"?: string }`.
- `404`, jeśli zadanie o podanym `id` nie istnieje.
- `400`, jeśli ciało jest niepoprawne: `decision` inna niż `"approved"`/`"rejected"`, `comment` jest obecny, ale nie jest stringiem (w tym jawne `null` — kontrakt dopuszcza tylko brak pola albo string, więc `null` jest odrzucane tak samo jak liczba, obiekt, tablica czy `boolean`), albo `comment` po `trim` przekracza 500 znaków.
- `409` z `{ "error": "Task does not require approval" }`, jeśli zadanie ma `requiresApproval: false`.
- Komentarz jest zawsze przycinany (`trim`); pusty lub złożony wyłącznie z białych znaków jest traktowany jak brak komentarza.
- **Idempotencja**: powtórzenie *identycznej* decyzji (ta sama `decision`, ten sam skomentowany/pusty `comment` po `trim`) na zadaniu, które już ma tę samą decyzję końcową, zwraca `200` bez zmiany zapisanego zadania — w szczególności `approvalDecidedAt` **nie** przesuwa się do bieżącego czasu.
- **Konflikt**: próba nadpisania istniejącej decyzji końcowej (`"approved"`/`"rejected"`) inną decyzją lub innym komentarzem zwraca `409` bez żadnej zmiany zapisanego zadania:
  ```json
  {
    "error": "Approval decision conflict",
    "currentApproval": { "status": "approved", "comment": "Looks good.", "decidedAt": "2026-09-14T08:00:00.000Z" }
  }
  ```
  Żeby zmienić wcześniejszą decyzję, trzeba najpierw zresetować proces przez istotną edycję zadania (patrz wyżej) — nie ma osobnego endpointu „cofnij decyzję” niezwiązanego z edycją zadania.
- Powodzenie (pierwsza decyzja lub identyczne powtórzenie) zwraca `200` z pełnym, zaktualizowanym obiektem zadania.

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
- Usunięcie użytkownika **nie usuwa** komentarzy, które napisał (patrz sekcja 2.11) — zostają zachowane razem z ich treścią i czasem utworzenia. Zamiast tego czyszczone jest wyłącznie pole `authorId` w tych komentarzach (staje się nieobecne), natomiast `authorName` (migawka nazwy zapisana przy tworzeniu komentarza) pozostaje bez zmian, więc komentarz nadal da się poprawnie wyświetlić.
- Nieistniejące `id` zwraca `404` z ciałem `{ "error": "User not found" }` — zarówno przy próbie usunięcia użytkownika, który nigdy nie istniał, jak i przy ponownej próbie usunięcia użytkownika już wcześniej usuniętego.
- Nie istnieje endpoint do edycji użytkownika (`PUT`/`PATCH`) — po utworzeniu nazwy, e-maila, roli ani awatara nie da się zmienić ani przez UI, ani przez udokumentowane API.

### 2.11 Komentarze do zadania (`/api/tasks/:id/comments`)

**Aplikacja nadal nie ma logowania ani sesji użytkownika.** Autor komentarza (`authorId`) jest jawnie wybierany z istniejącej listy użytkowników przez osobę wypełniającą formularz — zapisanie komentarza „w jego imieniu” nie jest w żaden sposób potwierdzeniem jego tożsamości, ani nie ogranicza, kto może dodać komentarz w czyimś imieniu.

#### `GET /api/tasks/:id/comments` — lista komentarzy

- `404` z `{ "error": "not found" }`, jeśli zadanie o podanym `id` nie istnieje.
- `200` z tablicą komentarzy (pustą, jeśli zadanie nie ma żadnych) posortowaną od najstarszego do najnowszego według `createdAt`.
- Komentarze o identycznym `createdAt` są dodatkowo sortowane po `id`, więc kolejność jest zawsze deterministyczna — nigdy nie zależy od kolejności wewnętrznego przechowywania.

#### `POST /api/tasks/:id/comments` — dodanie komentarza

- `404` z `{ "error": "not found" }`, jeśli zadanie o podanym `id` nie istnieje.
- `400`, jeśli ciało żądania nie jest obiektem JSON.
- Ciało żądania przyjmuje **wyłącznie** pola `authorId` i `content`. Każde inne pole — w tym `id`, `taskId`, `authorName` i `createdAt`, które są zawsze ustawiane przez serwer — powoduje `400` z ciałem `{ "error": "Validation failed", "details": [{ "field": "<pole>", "message": "<pole> is not a creatable field" }, ...] }`; żaden komentarz nie zostaje przy tym utworzony.
- `authorId` jest wymagany, musi być niepustym stringiem i musi wskazywać istniejącego użytkownika; w przeciwnym razie zwracany jest `400` z odpowiednim komunikatem na polu `authorId`.
- `content` jest wymagany, musi być stringiem, a po przycięciu (`trim`) — niepusty i nie dłuższy niż 1000 znaków; w przeciwnym razie zwracany jest `400` na polu `content`. Zapisywana treść to zawsze wersja po `trim`.
- `authorName` jest ustawiane przez backend na podstawie aktualnego rekordu użytkownika wskazanego przez `authorId` w chwili tworzenia komentarza (migawka — patrz sekcja 1.3).
- Powodzenie zwraca `201` z pełnym, zapisanym obiektem komentarza.
- Operacja jest atomowa: każdy błąd walidacji odrzuca żądanie w całości i nie zapisuje żadnego częściowego stanu.

#### Spójność przy usuwaniu

- Usunięcie zadania (sekcja 2.5) usuwa też wszystkie jego komentarze.
- Usunięcie użytkownika (sekcja 2.10) zachowuje komentarze, które napisał, ale czyści ich `authorId` (staje się nieobecne), zachowując `authorName`. Taki komentarz — bez `authorId` — powinien być prezentowany jako wpis zachowany po usuniętym użytkowniku (w UI: etykieta „Deleted user”, patrz sekcja 6.6, podsekcja „Comments”).

---

## 3. Reguły walidacji zależne od kontekstu (business rules)

Poniższe reguły są sprawdzane zarówno przy `POST /api/tasks`, jak i przy `PUT /api/tasks/:id` (na scalonym obiekcie), niezależnie od tego, które konkretne pole zostało przesłane w danym żądaniu:

1. **Zadanie typu `bug` wymaga `severity`.** Brak `severity` (lub `null`) przy `taskType === "bug"` zwraca błąd na polu `severity`: „bug tasks require a severity”.
2. **Zadanie typu `research` wymaga `estimatedHours >= 1`.** Brak `estimatedHours` lub wartość `< 1` przy `taskType === "research"` zwraca błąd na polu `estimatedHours`: „research tasks require estimatedHours >= 1”.
3. **Zadania o priorytecie `high` nie mogą mieć `estimatedHours > 24`.** Jeśli `estimatedHours` jest podane i przekracza 24, a `priority === "high"`, zwracany jest błąd: „high priority tasks cannot exceed 24 estimated hours”.
4. **`requiresApproval: true` wymaga niepustego `approver`.** Patrz sekcja 2.7.

Reguły te działają **tylko w jedną stronę**. API nie wymaga, żeby wartości warunkowe znikały razem z warunkiem, który je uzasadniał:

- zadanie o `taskType` innym niż `"bug"` (lub bez typu) **może** mieć zapisane `severity` — nie trzeba wysyłać `severity: null` razem ze zmianą typu;
- zadanie z `requiresApproval: false` **może** mieć zapisanego `approver` — nie trzeba wysyłać `approver: null` razem z `requiresApproval: false`.

Czyszczenie takich wartości jest więc zachowaniem formularza edycji (sekcja 7.2a), a nie wymogiem kontraktu API.

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
- Filtry dostępne tylko w tej zakładce: **Assignee** (Wszyscy / Nieprzypisane / konkretny użytkownik), **Status** (All / To Do / In Progress — bez opcji „Done”, bo zakładka i tak wyklucza zadania zakończone), **Priority** (All / Low / Medium / High), **Filter by due date** (All deadlines / Overdue / Due soon — patrz sekcja 11 dla dokładnych reguł klasyfikacji).
- Filtry Status, Priority, Assignee i Filter by due date, a także paginacja, dotyczą **wyłącznie** zakładki Active — nie wpływają na Grid View, Table, Archive ani Analytics. Dzięki temu żaden filtr nie zawęża wyników w miejscu, gdzie użytkownik nie widzi (i nie może zmienić) odpowiadającej mu kontrolki. Wszystkie aktywne filtry tej zakładki (Status, Priority, Assignee, Filter by due date) są stosowane łącznie (logiczne AND).
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
- Edycja „inline” bezpośrednio w komórkach — ale tylko dla pól: `title`, `status`, `priority`, `dueDate`, `assigneeId`. Pozostałe pola zadania (typ, `severity`, `estimatedHours`, `tags`, `dependencies`, `requiresApproval`, `approver`) nie są tu ani widoczne, ani edytowalne. Jeśli zmiana statusu na `"done"` zostanie odrzucona przez API (`409`, patrz sekcja 2.6 albo — dla zadań wymagających zatwierdzenia bez decyzji `"approved"` — sekcja 2.7), komórka statusu pokazuje treść błędu pod polem, a status w tabeli pozostaje bez zmian — operację można ponowić od razu.
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
- Zawiera przycisk „Edit task”, który otwiera **ten sam modal edycji**, co lista zadań (sekcja 7.2a) — nie jest to osobny formularz. Modal pozwala zmienić pełny zestaw pól zadania, w tym `taskType`, `severity`, `estimatedHours`, `tags`, `dependencies`, `requiresApproval` i `approver`.
- Po udanym zapisie: modal się zamyka, widok pokazuje dane **zwrócone przez API** (a nie zgadywany lokalnie stan), sekcja zależności jest odświeżana, a adres pozostaje ten sam (`/tasks/:id`) — nie następuje żadne przekierowanie ani powrót na listę. Przy błędzie zapisu modal pozostaje otwarty z komunikatem, a widok szczegółów nadal pokazuje ostatnią poprawnie zapisaną wersję zadania.

#### Sekcja „Approval”

Osobna sekcja widoku szczegółów, poniżej „Dependencies”, nadaje `requiresApproval`/`approver` realne znaczenie opisane w sekcji 2.7. **Nigdzie w tej sekcji nie sugeruje się, że `approver` się uwierzytelnił** — tekst zawsze mówi o decyzji zapisywanej „w jego imieniu”.

- Gdy `requiresApproval` jest `false`: sekcja pokazuje wyłącznie tekst „Approval not required” — brak jakichkolwiek przycisków decyzji.
- Gdy `approvalStatus` to `"pending"`: widoczna jest odznaka „Pending approval”, nazwa/etykieta `approver`, opcjonalne pole komentarza oraz przyciski „Approve” / „Reject”, które wywołują `PUT /api/tasks/:id/approval`. W trakcie zapisu oba przyciski są zablokowane (ochrona przed podwójnym kliknięciem) i pokazują stan pośredni („Approving…” / „Rejecting…”); wpisany komentarz **nie** jest czyszczony, dopóki żądanie się nie powiedzie, a decyzja nie jest pokazywana jako zapisana, zanim API faktycznie nie odpowie sukcesem.
- Gdy `approvalStatus` to `"approved"` lub `"rejected"`: widoczna jest odznaka statusu odróżnialna nie tylko kolorem (inny tekst, atrybut `role="status"`), nazwa/etykieta `approver`, czas decyzji (`approvalDecidedAt`) oraz komentarz, jeśli został podany. Brak jakichkolwiek aktywnych przycisków do zmiany decyzji końcowej — jedyny sposób jej zmiany to reset przez istotną edycję zadania (sekcja 2.7).
- Jeśli istotna edycja (przez modal edycji) zresetuje decyzję z powrotem do `"pending"`, sekcja odzwierciedla to natychmiast na podstawie odpowiedzi API z zapisu — bez zmiany adresu URL i bez dodatkowego przeładowania.

#### Sekcja „Comments”

Osobna sekcja widoku szczegółów, poniżej „Approval”, dająca `POST`/`GET /api/tasks/:id/comments` (sekcja 2.11) interfejs użytkownika. Ładowanie komentarzy, ich prezentacja i formularz dodawania nowego komentarza są obsługiwane **niezależnie** od reszty widoku szczegółów — błąd pobrania komentarzy nigdy nie powoduje błędu całego widoku (tak jak błąd pobrania pełnej listy zadań na potrzeby selektora zależności w modalu edycji).

- **Ładowanie**: podczas pobierania komentarzy (`GET`) sekcja pokazuje stan ładowania.
- **Błąd pobrania**: jeśli `GET /api/tasks/:id/comments` się nie powiedzie, sekcja pokazuje komunikat błędu wraz z przyciskiem „Retry”, który ponawia wyłącznie to zapytanie — bez przeładowania strony i bez wpływu na resztę widoku.
- **Pusta lista**: jeśli zadanie nie ma komentarzy, sekcja pokazuje komunikat „No comments yet” zamiast pustej listy.
- **Lista komentarzy**: każdy komentarz prezentuje `authorName`, czas utworzenia (`createdAt`) oraz treść (`content`) jako zwykły tekst — nigdy jako HTML i bez żadnej obsługi Markdownu. Komentarz bez `authorId` (bo autor został usunięty — patrz sekcja 2.10/2.11) jest dodatkowo oznaczony etykietą „Deleted user”, obok wciąż widocznego `authorName`.
- **Formularz dodawania komentarza** zawiera:
  - pole wyboru (`select`) autora, zbudowane z tej samej listy użytkowników co reszta aplikacji (`GET /api/users`), z początkową opcją „Select author” — autor **nie** jest wybierany automatycznie;
  - pole tekstowe (`textarea`) na treść komentarza, ograniczone do 1000 znaków;
  - informację, że komentarz zostanie zapisany w imieniu wybranego użytkownika, bez potwierdzania jego tożsamości (tak jak w sekcji „Approval” — patrz jej opis wyżej);
  - przycisk „Add comment”.
  - Podczas zapisu (`POST`) pole wyboru autora, pole tekstowe i przycisk są zablokowane, a przycisk pokazuje stan pośredni „Adding…” — chroni to przed wysłaniem tego samego komentarza dwukrotnie przez wielokrotne kliknięcie.
  - Komentarz **nie** jest dodawany do listy optymistycznie — dopiero odpowiedź API (`201` z pełnym obiektem komentarza) jest dopisywana do widocznej listy.
  - Po udanym zapisie treść formularza jest czyszczona, ale wybrany autor **pozostaje** wybrany (ułatwia dodanie kolejnego komentarza w jego imieniu) — adres URL się nie zmienia i strona się nie przeładowuje.
  - Przy błędzie zapisu (w tym walidacji — np. pusta treść) formularz pokazuje komunikat błędu, a wpisana treść i wybrany autor **pozostają** widoczne, żeby nie trzeba było wpisywać komentarza od nowa.
- **Blokada zapisu, dopóki lista komentarzy nie jest znana**: pole wyboru autora, pole tekstowe i przycisk „Add comment” są zablokowane nie tylko podczas samego zapisu, ale też zawsze wtedy, gdy `GET /api/tasks/:id/comments` jeszcze trwa (pierwsze ładowanie) albo zakończył się błędem — dopóki „Retry” tej listy nie zakończy się sukcesem. Chroni to przed dwoma problemami: nowo utworzony komentarz zniknąłby z widoku, gdyby lista była akurat w stanie błędu (bo w tym stanie lista w ogóle nie jest renderowana), a wcześniej rozpoczęte pobieranie mogłoby zakończyć się już **po** zapisie i nadpisać stan starszą odpowiedzią. Zabezpieczenie działa również na poziomie samej obsługi wysyłki formularza (nie tylko atrybutu `disabled` na kontrolkach) — programowe wywołanie wysyłki formularza nie wyśle żądania, dopóki lista komentarzy nie została poprawnie pobrana. Błąd pobrania komentarzy nadal nie powoduje błędu całego widoku szczegółów zadania.
- **Kolejność po dodaniu komentarza**: po otrzymaniu odpowiedzi `201` nowy komentarz nie jest dopisywany bezwarunkowo na końcu widocznej listy — zamiast tego jest łączony z dotychczasowymi komentarzami, a cała lista jest ponownie sortowana według tego samego kontraktu co `GET /api/tasks/:id/comments` (sekcja 2.11): rosnąco po `createdAt`, a przy identycznym `createdAt` — rosnąco po `id`. Ta sama reguła sortowania jest też stosowana do każdej odpowiedzi `GET`, więc kolejność pozostaje spójna niezależnie od tego, czy komentarz właśnie dodano, czy lista została odświeżona (np. po ponownym wejściu na stronę).
- **Zależność od listy użytkowników**: jeśli pobranie listy użytkowników (`GET /api/users`) na potrzeby selektora autora się nie powiedzie, formularz dodawania komentarza staje się niedostępny, a sekcja pokazuje czytelną informację o braku listy autorów wraz z możliwością ponowienia tego pobrania (bez przeładowania całej strony) — natomiast już wczytane komentarze pozostają widoczne (bo korzystają wyłącznie z zapisanego w nich `authorName`, a nie z listy użytkowników).
- Nie ma możliwości edycji ani usuwania pojedynczych komentarzy z poziomu UI (poza usunięciem całego zadania, patrz sekcja 2.5/2.11).

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
| `due` | tylko `active` | `overdue`, `soon` | `all` |
| `page` | tylko `active` | liczba całkowita ≥ 1 | `1` |
| `sort` | tylko `table` | `title`, `status`, `priority`, `dueDate`, `assigneeId` | `title` |
| `order` | tylko `table` | `asc`, `desc` | `asc` |

`due` odzwierciedla wybór kontrolki **Filter by due date** opisanej w 6.1 i wynika z klasyfikacji terminu zadania opisanej w sekcji 11 — `overdue` pokazuje tylko zadania opóźnione, `soon` tylko zadania zbliżające się do terminu (włącznie z zadaniami już opóźnionymi wykluczonymi z tej wartości — patrz sekcja 11). Podobnie jak `status`/`priority`/`assignee`, obowiązuje wyłącznie w zakładce Active i podlega tej samej normalizacji: nieznana wartość (inna niż `overdue`/`soon`) wraca do `all` i jest usuwana z adresu, a jawna zmiana kontrolki resetuje stronę do 1 i tworzy nowy wpis w historii przeglądarki (patrz akapit „Historia przeglądarki” niżej).

Przykłady: `/tasks?status=in-progress&priority=high&assignee=user-1&page=2` (zakładka Active, domyślna), `/tasks?priority=high&due=overdue` (zakładka Active, zadania o wysokim priorytecie i opóźnionym terminie) oraz `/tasks?tab=table&sort=dueDate` (kanoniczny URL zakładki Table posortowanej po `dueDate` rosnąco — `order=asc` jest wartością domyślną, więc normalizacja usuwa go z adresu; adres z jawnie podanym `order=asc` zostanie sprowadzony do tej postaci).

**Filtry i paginacja per zakładka** — zgodnie z decyzją opisaną w 6.1–6.4, filtry Status/Priority/Assignee/Filter by due date oraz paginacja dotyczą wyłącznie zakładki Active; pole wyszukiwania (`TaskSearch`) nigdy nie trafia do URL, bo to osobny mechanizm (patrz sekcja 4) niezwiązany z listą/tabelą/kartami. Sortowanie (`sort`/`order`) dotyczy wyłącznie zakładki Table — `TaskTable` nie ma już własnego, niezależnego stanu sortowania; pole i kierunek są przekazywane do niego jako kontrolowane propsy z widoku `Tasks`, sterowane przez URL.

**Zmiana zakładki** usuwa z URL parametry nieobsługiwane przez nową zakładkę (np. przejście z Active do Grid View czyści `status`/`priority`/`assignee`/`due`/`page`; przejście na Active ustawia stronę na 1). Zaznaczenie wierszy tabeli, otwarte modale/formularze i treść pola wyszukiwania nigdy nie trafiają do URL.

**Paginacja**: po zmianie dowolnego filtra lub zakładki strona wraca na 1. Jeśli numer strony w URL wykracza poza liczbę dostępnych stron (również po utworzeniu, edycji lub usunięciu zadania, gdy zmienia się liczba wyników), zostaje on skorygowany do ostatniej dostępnej strony (a przynajmniej do strony 1) — użytkownik nigdy nie zostaje na pustej stronie, jeśli wcześniejsze strony mają wyniki. Ta korekta następuje wyłącznie po **udanym** (`GET /api/tasks` zwróciło poprawną tablicę) pobraniu zadań. Dopóki żądanie trwa albo zakończyło się błędem (sieciowym, `5xx` lub niepoprawnym payloadem), numer strony z URL pozostaje nietknięty — inaczej pusta lista wynikająca z trwającego ładowania lub z błędu zostałaby błędnie potraktowana jako „nie ma tylu wyników” i strona zostałaby bezpowrotnie sprowadzona do 1, mimo że po stronie serwera dane mogą się znaleźć (przy ponowieniu) na stronie, o którą pierwotnie proszono.

**Błędne parametry** nigdy nie powodują awarii ani niewyjaśnionego pustego widoku: nieznana zakładka, nieznany status/priorytet/wartość `due`, nieprawidłowy numer strony (tekst, zero, liczba ujemna, ułamek) oraz nieobsługiwane pole/kierunek sortowania wracają do wartości domyślnej niezależnie od stanu pobierania danych (nie zależą od żadnego zapytania do API). Identyfikator w `assignee`, który nie odpowiada żadnemu użytkownikowi, jest usuwany (filtr wraca do „All assignees”) — ale dopiero **po udanym** zakończeniu pobierania listy użytkowników z `GET /api/users` (poprawna odpowiedź z tablicą użytkowników, która nie zawiera tego identyfikatora). Dopóki żądanie do `/api/users` trwa, **lub zakończyło się błędem** (sieciowym, `5xx` czy niepoprawnym payloadem), dowolny identyfikator w `assignee` jest traktowany jako potencjalnie poprawny i nie jest usuwany — sam fakt, że żądanie się zakończyło, nie jest traktowany jako potwierdzenie, że zwrócone dane (w tym pusta lista przy błędzie) nadają się do walidacji URL; inaczej błąd pobrania użytkowników wyglądałby tak samo, jak lista, w której danego identyfikatora rzeczywiście nie ma, i poprawny filtr zostałby bezpowrotnie usunięty z udostępnionego linku. Z tego samego powodu zadania i użytkownicy są od siebie pobierani niezależnie, a nie w ramach jednego wspólnego `Promise.all`, który opóźniałby wyświetlenie zadań do czasu odpowiedzi obu żądań. Dotychczasowa prezentacja błędów API (komunikat w banerze błędu) działa bez zmian niezależnie od tego mechanizmu. W każdym z opisanych przypadków normalizacji adres jest zmieniany przez `history.replaceState` (bez dodawania wpisu do historii), tak aby URL zawsze odpowiadał temu, co faktycznie widać na ekranie; sama normalizacja nie pokazuje przy tym żadnego dodatkowego, globalnego komunikatu błędu.

**Historia przeglądarki**: jawna zmiana zakładki, filtra, strony lub sortowania (klik, wybór z listy, klawiatura) tworzy nowy wpis w historii (możliwy do cofnięcia przyciskiem Wstecz). Automatyczna normalizacja błędnych parametrów oraz korekta strony poza zakresem używają `replace` i nie tworzą dodatkowego wpisu. Nawigacja klawiaturą między zakładkami (strzałki, Home, End) działa tak jak dotychczas i również aktualizuje URL jako jawna zmiana zakładki.

Świadome ograniczenie: obie ścieżki wywołujące zmianę URL (jawna akcja użytkownika i automatyczna korekta uruchamiana efektem po doładowaniu danych) mogą się teoretycznie nałożyć, jeśli użytkownik kliknie inną zakładkę dokładnie w tej samej klatce renderowania, w której kończy się ładowanie danych wymagające korekty strony. Jest to skrajnie mało prawdopodobne w normalnym użytkowaniu (wymaga interakcji w oknie pojedynczych milisekund) i nie zostało zaadresowane dodatkową synchronizacją.

---

## 7. Tworzenie zadań — różnice między kreatorem, szybkim dodawaniem a API

### 7.1 Kreator zadania (Task Wizard, przycisk „New Task”)

Trzykrokowy formularz (Basic information → Assignment and details → Summary):

- **Krok 1** ustawia: `taskType` (domyślnie `feature`), `title` (wymagane, min. 3 znaki **po przycięciu białych znaków** — walidacja po stronie klienta odzwierciedla regułę API), `description`, `priority` (wymagane w UI). Wybranie priorytetu `high` pokazuje ostrzeżenie informacyjne „High priority tasks should be completed within 24h” — to tylko komunikat w interfejsie, nie reguła egzekwowana automatycznie na `dueDate`.
- **Krok 2** ustawia: `assigneeId` — **pole opcjonalne**, dokładnie tak jak w API i w Swaggerze: zadanie można utworzyć nieprzypisane (opcja „-- unassigned --”) i przypisać je później; `estimatedHours` (walidacja klienta: wartość musi być liczbą dodatnią — dokładnie tak, jak wymaga tego API; zadania typu `research` wymagają dodatkowo co najmniej 1 godziny, a zadania o priorytecie `high` nie mogą przekroczyć 24 godzin); `dueDate`; `severity` — pole pojawia się tylko, gdy `taskType === "bug"`, i jest wtedy wymagane; checkbox „Requires manager approval” i wybór `approver` z zamkniętej listy (Manager A/B/C), pole `approver` pojawia się i jest wymagane tylko, gdy checkbox jest zaznaczony; `tags` jako pole tekstowe rozdzielane przecinkami; `dependencies` jako **wybór z listy istniejących zadań** (każda pozycja pokazuje tytuł i identyfikator zadania) — zależności dodaje się przyciskiem „Add” i usuwa przyciskiem „Remove” przy konkretnej pozycji; nie da się dodać tego samego zadania dwa razy ani (w edycji) wskazać edytowanego zadania jako jego własnej zależności. Wpisywanie identyfikatorów ręcznie nie jest już możliwe.
- **Krok 3** to tylko podgląd wprowadzonych danych przed wysłaniem — nie ma tu żadnych dodatkowych pól ani walidacji.
- Wysłanie formularza wykonuje `POST /api/tasks`. Puste pola opcjonalne pozostawione po wcześniejszych krokach nie są wysyłane jako niepoprawne wartości techniczne: wyczyszczone pole `dueDate` (puste `""`) jest pomijane w wysyłanym payloadzie zamiast wysłania pustego stringa, a wyczyszczone pole `estimatedHours` jest pomijane zamiast wysłania `0`. Podobnie, jeśli `requiresApproval` zostanie odznaczone po wcześniejszym wybraniu `approver`, wartość `approver` nie jest wysyłana; a jeśli typ zadania zostanie zmieniony z `"bug"` na inny po wcześniejszym wybraniu `severity`, wartość `severity` nie jest wysyłana. Błędy walidacji zwrócone przez API są pokazywane jako ogólny komunikat na kroku podsumowania (nie są mapowane na konkretne pola formularza wewnątrz kreatora).
- Po utworzeniu zadania kreator zamyka się automatycznie tylko przy sukcesie.

### 7.2 Szybkie dodawanie (Quick Add, w zakładce Active)

Formularz Quick Add operuje na węższym zestawie pól: `title`, `description`, `status`, `priority`, `dueDate`, `assigneeId`. Nie daje możliwości ustawienia: `taskType`, `severity`, `estimatedHours`, `tags`, `dependencies`, `requiresApproval`, `approver`, `coverImage`.

- Formularz Quick Add tworzy zadanie przez `POST /api/tasks` — pola spoza tej listy pozostają nieustawione (nie dziedziczą żadnych wartości domyślnych poza tymi, które i tak nadaje backend, patrz sekcja 2.1).

### 7.2a Modal edycji zadania

Modal edycji jest **jednym, wspólnym komponentem** używanym zarówno z listy zadań (karty, Grid View, wynik wyszukiwania), jak i z widoku szczegółów `/tasks/:id` (przycisk „Edit task”, patrz sekcja 6.6). Obejmuje **pełny zestaw edytowalnych pól**: `title`, `description`, `status`, `priority`, `dueDate`, `assigneeId`, `taskType`, `severity`, `estimatedHours`, `tags`, `dependencies`, `requiresApproval`, `approver`. Poza zasięgiem edycji pozostaje jedynie `coverImage` (patrz sekcja 1.1) oraz `completedAt` (wyliczane z `status`, sekcja 2.3).

- Wszystkie pola są wypełniane wartościami aktualnie zapisanego zadania w momencie otwarcia modalu. Pola warunkowe działają tak samo jak w kreatorze: `severity` pokazuje się tylko dla `taskType === "bug"`, a `approver` tylko przy zaznaczonym „Requires manager approval”.
- Walidacja po stronie klienta pochodzi z **tego samego, współdzielonego modułu co kreator** (reguły: min. 3 znaki tytułu po przycięciu, dodatnia liczba godzin, `research` wymaga co najmniej 1 godziny, `bug` wymaga `severity`, `high` nie przekracza 24 godzin, `requiresApproval` wymaga `approver`, `dependencies` muszą wskazywać istniejące zadania). Dzięki temu reguły klienta nie mogą rozjechać się z regułami API (sekcja 3).
- Zapis wykonuje `PUT /api/tasks/:id` i wysyła **wyłącznie pola, które faktycznie się zmieniły** — pozostałe wartości zadania zostają nietknięte, bo backend scala patch tylko z przesłanymi kluczami. Wyczyszczone pole jest wysyłane jawną wartością czyszczącą zgodną z kontraktem API: `null` dla `description`, `dueDate`, `assigneeId`, `taskType`, `estimatedHours`, `severity` i `approver`, oraz `[]` dla `tags` i `dependencies` (pola tablicowe nie przyjmują `null`).
- Formularz nigdy nie modyfikuje pól, których użytkownik nie zmienił. W szczególności: opis złożony wyłącznie z białych znaków zostaje zachowany w dokładnie takiej postaci, dopóki nie zostanie zmieniony; `severity` zapisane przy zadaniu o typie innym niż `"bug"` oraz `approver` zapisany przy `requiresApproval: false` (oba dozwolone przez API — patrz sekcja 3) **nie** są kasowane przy edycji innego pola.
- Dwie pary pól warunkowych są wysyłane razem, ale **wyłącznie wtedy, gdy użytkownik faktycznie wykonał odpowiednią zmianę** — jest to decyzja formularza (żeby zapisane zadanie odpowiadało temu, co pokazuje UI), a nie wymóg API: zmiana `taskType` z `"bug"` na inny wysyła dodatkowo `severity: null`, a odznaczenie wcześniej włączonego „Requires manager approval” wysyła `{"requiresApproval": false, "approver": null}`. API nie odrzuca żądań, które tych par nie wysyłają (patrz sekcja 3).
- Próba zapisania statusu `"done"` na zadaniu, które wymaga zatwierdzenia i nie ma decyzji `"approved"`, jest odrzucana przez API (`409`, sekcja 2.7). W takim wypadku: zapisane dane pozostają bez zmian, pole statusu w formularzu wraca do rzeczywistego statusu zadania (tego sprzed próby zapisu), komunikat błędu pokazuje stan zatwierdzenia i kogo dotyczy oczekująca decyzja, a modal **nie** zostaje zamknięty — analogicznie do istniejącego zachowania przy konflikcie zależności (sekcja 2.6).
- `dueDate` zapisany w dowolnym formacie akceptowanym przez API (np. `"May 1, 2026"`, a nie tylko ISO 8601) jest pokazywany w polu daty jako właściwy dzień kalendarzowy **w UTC** — tą samą konwencją, co klasyfikacja terminu z sekcji 11. Dzięki temu edycja innego pola nigdy nie wysyła zmiany ani wyczyszczenia nietkniętego terminu. Wartość, której nie da się sparsować jako daty, pokazuje puste pole i również nie jest przy zapisie czyszczona.
- Pole `dependencies` wymaga poprawnie pobranej listy zadań (`GET /api/tasks`). Dopóki lista się ładuje albo jej pobranie **nie powiodło się**, wybór zależności jest zablokowany, a modal pokazuje odpowiedni komunikat (przy błędzie — z możliwością ponowienia pobrania). Zapisane zależności zadania są wtedy nadal widoczne, nie są uznawane za nieistniejące i nie są wysyłane w `PUT` — zmianę innego pola (np. tytułu) można zapisać normalnie.
- Ustawienie `status` na `"done"` uruchamia tę samą automatyczną logikę `completedAt`, co przy każdej innej ścieżce aktualizacji (sekcja 2.3) — formularz sam nie wysyła `completedAt`.
- Błędy walidacji z API są mapowane na konkretne pola formularza (czerwony komunikat pod danym polem); błędy dotyczące pól spoza formularza trafiają tylko do ogólnego komunikatu błędu.
- Odrzucenie zmiany statusu na `"done"` z powodu nieukończonych zależności (`409`, sekcja 2.6) pokazuje komunikat z nazwami blokujących zadań, a pole `status` wraca do rzeczywistej, zapisanej wartości — modal nie prezentuje statusu, który nigdy nie został zapisany.
- Anulowanie edycji (przycisk „Cancel”, Escape, kliknięcie w tło) nie zmienia żadnych wyświetlanych danych.

### 7.3 API bezpośrednio

- API nie narzuca żadnego z ograniczeń opisanych w 7.1–7.2a dotyczących tego, „które pola można ustawić w danym formularzu” — przez `POST`/`PUT` można ustawić dowolne pole z sekcji 1.1. UI pokrywa dziś ten zestaw w kreatorze (tworzenie) i w modalu edycji (aktualizacja); jedynie Quick Add operuje na węższym zestawie pól.
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

Zestaw startowy obejmuje też pełen zakres stanów procesu zatwierdzania (sekcja 2.7): zadania z `requiresApproval: false` (bez żadnych pól procesu), zadania z `requiresApproval: true` w stanie `"pending"`, oraz po jednym zadaniu demonstracyjnym w stanie `"approved"` i `"rejected"` (z ustawionymi `approvalComment` i `approvalDecidedAt`) — tak, aby wszystkie warianty sekcji „Approval” w widoku szczegółów (patrz 6.6) były widoczne od razu po starcie aplikacji, bez konieczności ręcznego wykonywania decyzji.

---

## 11. Terminy zadań: Overdue / Due soon

Podobnie jak archiwizacja (sekcja 5), klasyfikacja terminu zadania jest **wyłącznie logiką frontendową**, wyliczaną na podstawie już istniejącego pola `dueDate` — API i model danych zadania (sekcja 1.1) nie zyskują żadnego nowego pola, endpointu ani reguły walidacji. Cała logika żyje w jednym współdzielonym miejscu po stronie klienta i jest używana identycznie przez listę Active, Grid View, Table, listę zadań przypisanych użytkownikowi (`/users/:id`), szczegóły zadania oraz dashboard — nigdzie nie ma osobnej, powielonej implementacji porównywania dat.

### 11.1 Reguły klasyfikacji

Każde zadanie ma dokładnie jeden z czterech stanów terminu, wyliczany względem bieżącego momentu (`now`):

1. **Overdue (opóźnione)** — zadanie ma poprawne `dueDate`, jego status jest inny niż `"done"`, a dzień terminu (patrz niżej) jest wcześniejszy niż dzisiejszy dzień.
2. **Due soon (zbliżający się termin)** — zadanie ma poprawne `dueDate`, jego status jest inny niż `"done"`, dzień terminu mieści się w zakresie do trzech dni naprzód, obejmującym dzisiaj oraz dni +1, +2 i +3, i zadanie nie jest już `overdue` — te dwa stany wzajemnie się wykluczają, więc opóźnione zadanie nigdy nie trafia też do `soon`.
3. **Scheduled (termin ustawiony, bez ostrzeżenia)** — zadanie ma poprawne `dueDate`, ale nie kwalifikuje się do żadnego z powyższych: albo ma status `"done"` (zadania zakończone nigdy nie są oznaczane jako opóźnione ani zbliżające się do terminu, niezależnie od tego, jak odległe jest ich `dueDate`), albo termin wypada później niż wspomniany zakres do trzech dni naprzód.
4. **Brak ostrzeżenia / brak danych** — zadanie nie ma ustawionego `dueDate`, albo wartość `dueDate` nie daje się sparsować jako poprawna data. W tym przypadku UI nie pokazuje żadnej etykiety terminu (ani ostrzeżenia, ani „Due: …”).

**Porównanie dni kalendarzowych UTC**: zarówno `dueDate`, jak i `now`, są sprowadzane do początku swojego dnia w strefie UTC (`00:00:00.000Z` tego dnia) przed porównaniem, a dokładna data prezentowana w UI (patrz 11.2) jest formatowana według tego samego dnia kalendarzowego UTC — nigdy przez `toLocaleDateString()`/`toLocaleString()` w lokalnej strefie czasowej, co mogłoby przesunąć wyświetlaną datę o jeden dzień względem dnia użytego do klasyfikacji. Dzięki temu:

- godzina zapisana w `dueDate` nigdy nie wpływa na klasyfikację ani na wyświetlaną datę w obrębie tego samego dnia (termin o `23:59Z` i termin o `00:01Z` tego samego dnia dają ten sam wynik i tę samą wyświetlaną datę);
- wynik i wyświetlana data nie zależą od strefy czasowej środowiska, w którym działa przeglądarka czy testy — zarówno porównanie, jak i formatowanie, zawsze odbywają się w UTC, nigdy w czasie lokalnym; dotyczy to wyłącznie prezentacji `dueDate` — `completedAt` nadal jest formatowane jak dotychczas (`toLocaleString()`, sekcja 6.6).

### 11.2 Prezentacja w UI

Wszędzie tam, gdzie prezentowane jest zadanie lub jego termin, stan terminu jest pokazywany jako **tekst** (nie tylko kolor), dzięki czemu jest dostępny również dla czytników ekranu. Etykiety `Overdue` i `Due soon` **nie usuwają dokładnej daty** — w miejscach, gdzie nie jest ona pokazana osobno (karta zadania, kafelek Grid View, lista zadań przypisanych użytkownikowi), etykieta zawiera zarówno stan, jak i dokładną datę terminu:

- **Overdue** — tekst „Overdue · Due: <data>”, styl w odcieniach czerwieni.
- **Due soon** — tekst „Due soon · Due: <data>”, styl w odcieniach bursztynu/amber.
- **Scheduled** — zwykłe „Due: <data>” bez dodatkowego stylu ostrzegawczego.
- **Brak ostrzeżenia / brak danych** — nic nie jest renderowane (tak jak dotychczas, gdy zadanie nie ma `dueDate`).

W dwóch miejscach dokładna data terminu jest już widoczna obok etykiety z innego źródła (edytowalne pole `dueDate` w Table, pełna data w polu „Due Date” w szczegółach zadania) — tam etykieta pokazuje **wyłącznie stan** („Overdue”/„Due soon”, bez powtórzonej daty), a dla stanu `scheduled` w ogóle nic nie renderuje, żeby nie duplikować tej samej daty:

- kolumnie „Due date” w **Table** — obok pola edycji `dueDate` (edycja terminu w tabeli działa dokładnie tak jak dotychczas, patrz sekcja 6.3 — etykieta jest wyłącznie dodatkową prezentacją tekstową stanu, bez daty);
- widoku szczegółów zadania (`/tasks/:id`, patrz 6.6) — obok pełnej daty w polu „Due Date”, która jest formatowana według dnia kalendarzowego UTC (patrz wyżej), etykieta pokazuje tylko stan.

W pozostałych miejscach — bez osobno widocznej daty — etykieta zawiera pełne „Overdue · Due: <data>” / „Due soon · Due: <data>”:

- karcie zadania w zakładce **Active**;
- kafelku **Grid View**;
- liście zadań przypisanych użytkownikowi na `/users/:id` (sekcje „Active tasks” / „Completed tasks”, patrz 6.7).

### 11.3 Filtr „Filter by due date” i parametr `due`

W zakładce **Active** (sekcja 6.1) dostępna jest dodatkowa kontrolka **Filter by due date** z trzema opcjami: **All deadlines** (domyślna), **Overdue**, **Due soon**. Filtr współdziała łącznie (logiczne AND) z filtrami Status, Priority i Assignee opisanymi w 6.1 — a więc np. `priority=high&due=overdue` pokazuje wyłącznie zadania jednocześnie o wysokim priorytecie i opóźnione.

Stan tego filtra jest częścią udostępnialnego stanu URL widoku Tasks (sekcja 6.9), w parametrze `due`:

| Wartość | Znaczenie |
|---|---|
| `all` (domyślna, pomijana w URL) | Brak filtrowania po terminie. |
| `overdue` | Tylko zadania opóźnione (stan `overdue`, sekcja 11.1). |
| `soon` | Tylko zadania zbliżające się do terminu (stan `soon`, sekcja 11.1) — **z wyłączeniem** zadań już opóźnionych; te trzeba wybrać osobno przez `due=overdue`. |

Podobnie jak pozostałe filtry Active, `due` obowiązuje wyłącznie w tej zakładce, jest usuwany z URL po przejściu do zakładki, która go nie obsługuje, a jawna zmiana kontrolki resetuje stronę do 1 i tworzy nowy wpis w historii przeglądarki (Wstecz/Dalej odtwarzają wybór). Nieznana wartość `due` (inna niż `overdue`/`soon`/`all`) jest normalizowana do `all` niezależnie od stanu pobierania danych — tak jak `status`/`priority`.

### 11.4 Dashboard

Dashboard (`/dashboard`) pokazuje dodatkową statystykę **Overdue** obok istniejących kafelków (Total Tasks, In Progress, High Priority, Completion) — licznik zadań w stanie `overdue` (sekcja 11.1), liczony na podstawie tej samej reguły klasyfikacji co lista i oznaczenia, na **wszystkich** zadaniach pobranych z API (bez uwzględniania filtrów innych widoków, analogicznie do pozostałych statystyk dashboardu).

Kafelek „Overdue” jest dostępnym linkiem (`<a>` z czytelną nazwą) prowadzącym do `/tasks?due=overdue` — po przejściu użytkownik trafia do zakładki Active z filtrem Filter by due date ustawionym na „Overdue”, pokazującym dokładnie ten sam zestaw zadań, który wliczono do licznika.

## Historia Aktywności Zadania (Task Activity History)

Zadania posiadają historię aktywności, która rejestruje wyłącznie pomyślnie zapisany finalny efekt operacji biznesowych:
- **Tworzenie zadania** (`task_created`)
- **Aktualizacja zadania** (`task_updated`) - rejestruje zmiany wynikające z `PUT /api/tasks/:id`, a także zmiany pochodne (np. zmiana `assigneeId` na null po usunięciu użytkownika lub modyfikacja `dependencies` po usunięciu innego zadania). No-op aktualizacje nie są zapisywane.
- **Decyzja zatwierdzająca** (`approval_decided`) - rejestruje pomyślne i prowadzące do zmiany stanu operacje na `PUT /api/tasks/:id/approval`.

**Ważne założenia:**
- Historia jest przechowywana in-memory i resetuje się po restarcie serwera (z kilkoma predefiniowanymi zdarzeniami w danych startowych, aby zaprezentować funkcję).
- Zdarzenia są dostępne tylko do odczytu w widoku `/tasks/:id`.
- Aplikacja nie posiada kont i logowania, więc historia **nie identyfikuje uwierzytelnionego wykonawcy** danej akcji – pokazuje jedynie, że operacja miała miejsce w lokalnej aplikacji.
- Historia **nie obejmuje komentarzy** – dodawanie komentarzy nie generuje wpisów w historii zadania i mają one osobną oś czasu.
- Zdarzenia odrzucone (np. `400`, `409`) nie generują wpisów.
- Przy usuwaniu zadania (`DELETE /api/tasks/:id`), cała powiązana z nim historia aktywności zostaje usunięta, natomiast powiązane z nim zadania (których było zależnością) otrzymują `task_updated`.
- Przy usuwaniu użytkownika (`DELETE /api/users/:id`), ukończone zadania przypisane do niego otrzymują `task_updated` ze zmianą `assigneeId` na `null`.
