## Cel
Dodanie nowego widoku szczegó³ów zadania, dostêpnego pod w³asnym adresem (`/tasks/:id`). Widok pozwala u¿ytkownikom na swobodny, bezpoœredni wgl¹d we wszystkie dane zadania pobrane z API.

## Zmiany
- **Komponent TaskDetails**: Nowy widok (tylko do odczytu) pokazuj¹cy pe³ne w³aœciwoœci zadania. Formatuje w sposób przyjazny dane dat (np. due date), zmienne logiczne oraz powi¹zania (wskazuj¹c np. imiê u¿ytkownika, jego ID, oraz pozwalaj¹c na przechodzenie do zale¿nych zadañ). Pole approver operuje na zdefiniowanych ci¹gach znakowych bez wymogu bycia u¿ytkownikiem. Obraz testowy coverImage jest w pe³ni wspierany.
- **Routing**: Dodano trasê `/tasks/:id` w strukturze routingu App.tsx.
- **Nawigacja z kart i tabel**: Zaktualizowano TaskCard, TaskGridItem i TaskTable, dodaj¹c izolowany link **View details**, nie zak³ócaj¹c istniej¹cych akcji edycji i usuwania.
- **Obs³uga b³êdów i pustych stanów**: Zapewniono wsparcie dla ³adowania, brakuj¹cych wartoœci (wyœwietlane jako Not set) i obs³ugê stanów b³êdu np. gdy API zg³asza 404 aplikacja generuje widok informacyjny "Task not found" bez zerwania sesji nawigacyjnej. Pozosta³e b³êdy serwera prezentuj¹ opcjê ponowienia bez bia³ego ekranu.
- **Konfiguracja i testy klienckie**: Zaimplementowano w vitest testy jsdom poprzez bibliotekê testing-library/react. Stworzono zestaw scenariuszy obejmuj¹cych widoki poprawne, zale¿ne jak i œcie¿ki krytyczne (b³êdy/braki z API). Asercje weryfikuj¹ konkretne tagi oraz atrybuty `dateTime`, przez co testy nie zale¿¹ od stref czasowych.
- **Dokumentacja**: Zaktualizowano polsk¹ instrukcjê docs/dokumentacja-produktowa.md o wyczerpuj¹cy, neutralny opis dzia³ania i struktury z perspektywy produktu.

## Sposób weryfikacji
Zmiany mo¿na zweryfikowaæ lokalnie, uruchamiaj¹c `npm run check`, co sprawdza poprawnoœæ budowania, dzia³ania eslint i przejœcie testów jednostkowych.
