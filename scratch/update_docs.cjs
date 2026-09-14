const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, '../docs/dokumentacja-produktowa.md');
let docs = fs.readFileSync(docPath, 'utf8');

const activityDocs = `
## Historia Aktywności Zadania (Task Activity History)

Zadania posiadają historię aktywności, która rejestruje wyłącznie pomyślnie zapisany finalny efekt operacji biznesowych:
- **Tworzenie zadania** (\`task_created\`)
- **Aktualizacja zadania** (\`task_updated\`) - rejestruje zmiany wynikające z \`PUT /api/tasks/:id\`, a także zmiany pochodne (np. zmiana \`assigneeId\` na null po usunięciu użytkownika lub modyfikacja \`dependencies\` po usunięciu innego zadania). No-op aktualizacje nie są zapisywane.
- **Decyzja zatwierdzająca** (\`approval_decided\`) - rejestruje pomyślne i prowadzące do zmiany stanu operacje na \`PUT /api/tasks/:id/approval\`.

**Ważne założenia:**
- Historia jest przechowywana in-memory i resetuje się po restarcie serwera (z kilkoma predefiniowanymi zdarzeniami w danych startowych, aby zaprezentować funkcję).
- Zdarzenia są dostępne tylko do odczytu w widoku \`/tasks/:id\`.
- Aplikacja nie posiada kont i logowania, więc historia **nie identyfikuje uwierzytelnionego wykonawcy** danej akcji – pokazuje jedynie, że operacja miała miejsce w lokalnej aplikacji.
- Historia **nie obejmuje komentarzy** – dodawanie komentarzy nie generuje wpisów w historii zadania i mają one osobną oś czasu.
- Zdarzenia odrzucone (np. \`400\`, \`409\`) nie generują wpisów.
- Przy usuwaniu zadania (\`DELETE /api/tasks/:id\`), cała powiązana z nim historia aktywności zostaje usunięta, natomiast powiązane z nim zadania (których było zależnością) otrzymują \`task_updated\`.
- Przy usuwaniu użytkownika (\`DELETE /api/users/:id\`), ukończone zadania przypisane do niego otrzymują \`task_updated\` ze zmianą \`assigneeId\` na \`null\`.
`;

docs += activityDocs;

fs.writeFileSync(docPath, docs);
console.log("docs updated");
