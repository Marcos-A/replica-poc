# Rèplica · prova de concepte

Simulador de correspondència comercial per correu electrònic. Un docent rep un correu d'una **clienta fictícia** (Marta Soler, de Ferreteria Soler SL), que reclama per una comanda incompleta. Respon des del seu correu habitual, i la clienta li torna a contestar dins del mateix fil. Les respostes de la clienta les escriu la intel·ligència artificial **Gemini**.

Aquesta versió és una **prova de concepte** del departament d'Administració i Gestió. Serveix per comprovar que la mecànica funciona. **No** és la plataforma definitiva i **no** avalua ningú.

> ⚠️ **Només entre docents i amb dades inventades.** No l'utilitzeu amb alumnat sense l'autorització del centre i del delegat o delegada de protecció de dades.

---

## Índex

1. [Com funciona](#1-com-funciona)
2. [Què necessites](#2-què-necessites)
3. [Instal·lació pas a pas (sense instal·lar res a l'ordinador)](#3-installació-pas-a-pas)
4. [Configuració](#4-configuració)
5. [Primera prova](#5-primera-prova)
6. [Ús habitual: iniciar, supervisar i aturar](#6-ús-habitual)
7. [Problemes freqüents](#7-problemes-freqüents)
8. [Seguretat i privacitat](#8-seguretat-i-privacitat)
9. [Per a desenvolupadors](#9-per-a-desenvolupadors)
10. [Estat del projecte i limitacions](#10-estat-del-projecte-i-limitacions)

---

## 1. Com funciona

```text
 Coordinador/a                                 Docent participant
      │ 1. inicia la simulació                         ▲  │
      ▼                                                │  │ 3. respon des del
 ┌───────────────────────────┐  2. correu de la clienta│  │    seu correu
 │ Google Apps Script        │─────────────────────────┘  │
 │ (bústia de prova de Gmail)│◄───────────────────────────┘
 │                           │  4. cada pocs minuts revisa si hi ha respostes
 │                           │──► Gemini escriu la resposta de la clienta
 │                           │──► Google Sheets desa la conversa
 └───────────────────────────┘  5. respon dins del mateix fil
```

- Tot funciona dins de Google: **Apps Script** (el programa), **Gmail** (la bústia que envia els correus de la clienta) i **Google Sheets** (el registre de converses).
- Les respostes **no són instantànies**: el programa mira la bústia cada 5 minuts. Es pot canviar (1, 5, 10, 15 o 30 minuts) a la pestanya **Configuració** del full de càlcul.
- La conversa s'acaba quan la clienta queda satisfeta o quan s'arriba al màxim de 6 respostes. Llavors envia un comiat i ja no respon més.

## 2. Què necessites

| Què | Per què | Notes |
| --- | --- | --- |
| **Un compte de Google de prova** (un compte de Gmail nou, per exemple «laboratori.prova.<nom del centre>») | Serà la bústia que envia els correus de la clienta | Recomanat: un compte nou, només per a això. No feu servir el vostre correu personal ni el del centre. |
| **Dos docents voluntaris** | Un coordina, l'altre fa de participant | El participant pot fer servir el seu correu habitual. |
| **Una clau de Gemini** | Perquè la IA escrigui les respostes | Es crea gratis a Google AI Studio (pas 3.5). |
| **Uns 45 minuts** | Per fer la instal·lació la primera vegada | |

No cal instal·lar res a l'ordinador: tot es fa des del navegador.

## 3. Instal·lació pas a pas

Feu **tots** aquests passos havent iniciat sessió amb el **compte de Google de prova**. Si al navegador teniu diversos comptes oberts, és més fàcil fer servir una finestra d'incògnit i entrar-hi només amb el compte de prova.

### 3.1. Descarregar el codi

1. Obriu <https://github.com/Marcos-A/replica-poc>.
2. Feu clic al botó verd **Code** → **Download ZIP**.
3. Descomprimiu el fitxer. Només en necessitareu dos: **`dist/Replica.gs`** (tot el programa en un sol fitxer) i **`src/appsscript.json`** (els permisos).

> 💡 Per obrir-los i copiar-ne el contingut, feu servir un editor de text senzill (Bloc de notes, TextEdit…), no un processador de textos com Word.

### 3.2. Crear el full de càlcul

1. Aneu a <https://sheets.new> (crea un full de càlcul nou).
2. Poseu-li un nom, per exemple **Rèplica – dades**.
3. Mireu l'adreça del navegador. Té aquesta forma:
   `https://docs.google.com/spreadsheets/d/`**`1AbCdEf...xyz`**`/edit`
4. Copieu la part en negreta (entre `/d/` i `/edit`) i deseu-la en un lloc a mà. És l'**identificador del full**.

No cal crear les pestanyes: el programa les crearà sol i eliminarà la pestanya buida que Google hi posa per defecte («Full 1» o «Sheet1»).

### 3.3. Crear el projecte d'Apps Script

1. Aneu a <https://script.google.com> → **Projecte nou**.
2. Canvieu el nom del projecte (a dalt, on diu «Projecte sense títol») per **Rèplica**.
3. Feu clic a la roda dentada ⚙️ (**Configuració del projecte**), a l'esquerra:
   - Marqueu **Mostra el fitxer de manifest «appsscript.json» a l'editor**.
   - A **Zona horària**, trieu `(GMT+01:00) Madrid` si no hi és.
4. Torneu a l'editor (icona `< >` a l'esquerra).

### 3.4. Copiar el programa

A l'editor veureu un fitxer anomenat `Codi.gs` (o `Code.gs`) i `appsscript.json`.

1. **`appsscript.json`**: obriu-lo, esborreu-ne tot el contingut i enganxeu-hi el contingut de `src/appsscript.json`. Deseu (icona del disquet o `Ctrl+S`).
2. **`Codi.gs`**: feu clic als tres punts del costat del nom → **Canvia el nom** → escriviu `Replica` (l'editor hi afegeix `.gs`).
3. Obriu **`Replica.gs`**, esborreu-ne tot el contingut (`Ctrl+A` i `Supr`) i enganxeu-hi **sencer** el contingut de `dist/Replica.gs`. És un fitxer llarg: comproveu que comença per `/**` i `Rèplica · prova de concepte` i que acaba per `})();`.
4. Deseu.

Al final, a la llista de fitxers de l'editor hi ha d'haver **només** `appsscript.json` i `Replica.gs`.

> 💡 Si sabeu fer servir la terminal, podeu pujar els fitxers automàticament amb `clasp` en lloc de copiar-los a mà: vegeu [docs/instal·lacio.md](docs/instal·lacio.md#camí-b-pujar-el-codi-amb-clasp).

### 3.5. Crear la clau de Gemini

1. Aneu a <https://aistudio.google.com> amb el compte de prova i accepteu les condicions.
2. Feu clic a **Get API key** → **Create API key**.
3. Copieu la clau (comença per `AIza…`). **Tracteu-la com una contrasenya**: no l'envieu per correu, no la poseu en cap document i no la publiqueu.
4. Trieu un **model**. A AI Studio, al selector de models, copieu-ne l'identificador exacte (per exemple, un model de la família *Flash*, que és ràpid i econòmic). Comproveu a la pàgina de **preus i límits** que aquest model tingui quota gratuïta o que el projecte tingui facturació activada: no tots els models en tenen.

> ℹ️ Amb el nivell gratuït, Google pot fer servir el contingut de les peticions per millorar els seus productes. Per això només s'han de fer servir **dades inventades**.

### 3.6. Actualitzar a una versió nova

Quan hi hagi una versió nova del programa:

1. Descarregueu el ZIP de nou (pas 3.1).
2. A l'editor, obriu `Replica.gs`, seleccioneu-ho tot (`Ctrl+A`) i enganxeu-hi el nou `dist/Replica.gs`. Deseu.
3. Executeu `preparaFulls` i `comprovaConfiguracio`.

Les propietats, el full de càlcul, la pestanya Configuració i el disparador es conserven: no cal tornar-los a configurar.

> ❗ **Si teníeu la instal·lació antiga amb 10 fitxers separats** (`AiProvider.gs`, `Config.gs`, `Main.gs`…), suprimiu-los **tots** (tres punts → **Suprimeix**) i deixeu només `appsscript.json` i `Replica.gs`. Si en queda algun d'antic, el programa podria barrejar versions.

## 4. Configuració

La configuració està repartida en dos llocs:

- **Propietats de l'script** (dins d'Apps Script): la clau de Gemini i els controls de seguretat. És un espai privat que no es veu al codi ni al full de càlcul.
- **Pestanya `Configuració`** (dins del full de càlcul): els paràmetres del dia a dia, com cada quan es revisa la bústia o amb qui s'inicia la propera simulació. Es canvien com qualsevol cel·la, sense tocar codi.

### 4.1. Propietats de l'script

1. A Apps Script, roda dentada ⚙️ **Configuració del projecte** → baixeu fins a **Propietats de l'script** → **Afegeix una propietat de l'script**.
2. Afegiu aquestes propietats (nom exacte, en majúscules):

| Propietat | Valor | Exemple |
| --- | --- | --- |
| `GEMINI_API_KEY` | La clau del pas 3.5 | `AIza…` |
| `GEMINI_MODEL` | L'identificador del model triat | `gemini-3.5-flash-lite` |
| `SPREADSHEET_ID` | L'identificador del full (pas 3.2) | `1AbCdEf…xyz` |
| `ALLOWED_SENDERS` | **Totes** les adreces dels docents que poden participar, separades per comes | `docent1@example.org, docent2@example.org` |
| `SIMULATION_ENABLED` | `false` (de moment) | `false` |

3. Feu clic a **Desa les propietats de l'script**.

> ❗ A `ALLOWED_SENDERS` **no** hi poseu l'adreça de la bústia de prova: el programa ignoraria els correus o podria crear un bucle.

### 4.2. Autoritzar i preparar el full

1. Torneu a l'editor (`< >`) i obriu el fitxer **Main**.
2. A la barra superior, al desplegable de funcions, trieu **`preparaFulls`** i feu clic a **Executa**.
3. La primera vegada, Google us demanarà permisos:
   - **Revisa els permisos** → trieu el compte de prova.
   - Sortirà l'avís «**Google no ha verificat aquesta aplicació**». És normal: l'aplicació és vostra. Feu clic a **Configuració avançada** → **Ves a Rèplica (no segur)**.
   - Accepteu els permisos: **Gmail** (enviar i llegir els correus de la simulació), **Fulls de càlcul** (desar les converses), **connexió a serveis externs** (parlar amb Gemini) i **activadors** (revisar la bústia periòdicament).
4. Al **Registre d'execució** (a sota) hauria d'aparèixer «Pestanya creada…». Si obriu el full de càlcul, hi veureu les pestanyes **Configuració**, **Escenaris**, **Converses** i **Missatges**, i l'escenari ESC-001 ja carregat.

### 4.3. Pestanya Configuració

Obriu el full de càlcul i aneu a la pestanya **Configuració**. Cada fila és un paràmetre: la columna **valor** és la que podeu canviar, i la columna **descripcio** explica què fa. Les cel·les amb opcions fixes tenen una llista desplegable.

| Paràmetre (`clau`) | Què és | Valor inicial |
| --- | --- | --- |
| `interval_minuts` | Cada quants minuts es revisa la bústia: 1, 5, 10, 15 o 30. El canvi s'aplica sol a la propera revisió. | `5` |
| `escenari` | L'escenari que s'envia en iniciar una simulació | `ESC-001` |
| `participant` | **Una sola adreça**: el docent amb qui iniciareu la **propera** simulació. Ha de ser també a `ALLOWED_SENDERS`. | *(buit)* |
| `max_torns_per_defecte` | Màxim de respostes de la clienta per conversa, si l'escenari no n'indica cap | `6` |

Ara escriviu a `participant` l'adreça del docent que farà la primera prova.

> ❗ **No confongueu `ALLOWED_SENDERS` i `participant`.** `ALLOWED_SENDERS` (a les Propietats de l'script) és la llista de **tots** els docents que poden participar. `participant` (a la pestanya Configuració) és **només una** persona: la que rebrà el correu quan executeu `provaIniciaSimulacio`. Per iniciar una simulació amb una altra persona, canvieu `participant` i torneu a executar `provaIniciaSimulacio`.

> ℹ️ Si teníeu les propietats antigues `PROVA_PARTICIPANT` o `PROVA_ESCENARI`, `preparaFulls` n'ha copiat el valor a la pestanya. Després podeu esborrar-les de les Propietats de l'script.

### 4.4. Comprovar la configuració

1. Trieu **`comprovaConfiguracio`** → **Executa**.
2. Al registre, cada línia ha de començar per `[OK]` o `[INFO]`. Si n'hi ha alguna amb `[ERROR]`, el text explica què cal corregir. Les línies `Configuració › …` es refereixen a la pestanya Configuració.
3. És normal que, en aquest punt, la línia **Disparador** surti com a `[AVÍS]`: el crearem ara. Si la línia **Configuració › participant** també surt com a `[AVÍS]`, vol dir que encara no hi heu escrit cap adreça.

### 4.5. Activar la revisió automàtica

1. Trieu **`creaDisparador`** → **Executa**. A partir d'ara, el programa revisarà la bústia amb l'interval de la pestanya Configuració (5 minuts, si no l'heu canviat).
2. Mentre `SIMULATION_ENABLED` sigui `false`, aquesta revisió no farà res: és l'**interruptor general**.

## 5. Primera prova

1. **Activeu l'interruptor general**: trieu **`activaSimulacions`** → **Executa** (això posa `SIMULATION_ENABLED` a `true`). Feu-ho només quan el coordinador ho hagi confirmat.
2. Comproveu que la fila `participant` de la pestanya **Configuració** té l'adreça del docent participant (i que aquesta adreça també és a `ALLOWED_SENDERS`).
3. Trieu **`provaIniciaSimulacio`** → **Executa**.
4. El docent participant rebrà un correu de **Marta Soler** amb l'assumpte *«Reclamació: comanda CO-2026-0418 incompleta»*. (Si no el veu, que miri a la carpeta de correu brossa.)
5. El participant **respon** al correu com ho faria amb un client real.
6. Al cap d'uns minuts (com a màxim, l'interval de la pestanya Configuració més el temps que trigui Gemini), rebrà la resposta de la clienta **dins del mateix fil**.
7. Podeu seguir la conversa al full de càlcul, a les pestanyes **Converses** i **Missatges**.

> 💡 Per no haver d'esperar durant una demostració: quan el participant hagi respost, executeu **`processaCorreusPendents`** a mà. Fa el mateix que la revisió automàtica.

## 6. Ús habitual

| Vull… | Què he de fer |
| --- | --- |
| Iniciar una simulació | Escriure l'adreça del docent a `participant` (pestanya Configuració) i executar `provaIniciaSimulacio` |
| Canviar cada quan es revisa la bústia | Canviar `interval_minuts` a la pestanya Configuració. S'aplica sol a la propera revisió (o al moment, executant `creaDisparador`) |
| Fer servir un altre escenari | Triar-lo a `escenari` (pestanya Configuració) abans d'executar `provaIniciaSimulacio` |
| Veure com van les converses | Executar `estatSimulacions` o obrir el full de càlcul |
| **Aturar-ho tot de seguida** | Executar `aturaSimulacions` (posa `SIMULATION_ENABLED` a `false`) |
| Tornar a engegar | Executar `activaSimulacions` |
| Tancar una conversa a mà | Copiar l'`id_conversa` del full i executar `tancaConversa` (vegeu [docs/operacio.md](docs/operacio.md)) |
| Recuperar una conversa en `ERROR` | Revisar el fil i executar `reactivaConversa` (vegeu [docs/operacio.md](docs/operacio.md)) |
| Eliminar la revisió automàtica | Executar `eliminaDisparadors` |

Instruccions detallades: [docs/operacio.md](docs/operacio.md).

## 7. Problemes freqüents

| Què passa | Causa probable | Solució |
| --- | --- | --- |
| `La simulació està desactivada` | L'interruptor general està apagat | Executeu `activaSimulacions` |
| `Escriviu l'adreça del docent participant a la pestanya Configuració` | La fila `participant` és buida | Escriviu-hi una adreça |
| `… ha de contenir una sola adreça` | A `participant` hi ha diverses adreces | Deixeu-n'hi només una; la llista completa va a `ALLOWED_SENDERS` |
| `L'adreça … no és a ALLOWED_SENDERS` | El participant no és a la llista | Afegiu-lo a la propietat `ALLOWED_SENDERS` |
| `Ja hi ha una conversa oberta` | Aquest docent ja té una simulació en curs | Acabeu-la o tanqueu-la amb `tancaConversa` |
| `Codi incomplet a l'editor`, `[ERROR] Codi: falta …` o `… is not defined` | El codi enganxat a l'editor no és complet | Torneu a enganxar `dist/Replica.gs` sencer a `Replica.gs` (pas 3.4) i comproveu que no hi queden fitxers antics |
| El participant respon però no arriba res | Encara no ha passat l'interval de revisió, o l'interruptor és apagat | Espereu o executeu `processaCorreusPendents`; mireu el full (columna `darrer_error`) i el menú **Execucions** d'Apps Script |
| `darrer_error` diu `HTTP 429` | S'ha exhaurit la quota de Gemini | El programa ho tornarà a provar sol; si persisteix, reviseu la quota a AI Studio |
| `darrer_error` diu `HTTP 400` o `403` | La clau o el model no són correctes | Reviseu `GEMINI_API_KEY` i `GEMINI_MODEL`, executeu `comprovaConfiguracio` i després `reactivaConversa` |
| La conversa queda en `ERROR` amb «No consta que la resposta s'enviés» | Una execució es va interrompre mentre enviava | Mireu el fil a Gmail. Si la resposta no hi és, executeu `reactivaConversa` |

## 8. Seguretat i privacitat

- **Mai** poseu la clau de Gemini al codi, al full de càlcul ni a GitHub: només a les Propietats de l'script.
- Les adreces dels docents són **dades personals**: compartiu el full de càlcul i la bústia de prova només amb qui ho necessiti.
- El programa ignora els correus de persones no autoritzades, les respostes automàtiques («fora de l'oficina»), les notificacions d'error de lliurament i els correus de la mateixa bústia. No llegeix adjunts.
- Abans d'enviar el text a Gemini, s'eliminen les adreces de correu i el text citat dels missatges.
- No hi ha anonimat absolut: Gmail conserva les metadades i el full registra les adreces.

**Per acabar la prova i esborrar-ho tot**: vegeu [docs/operacio.md › Desinstal·lar](docs/operacio.md#desinstallar-i-esborrar-dades).

## 9. Per a desenvolupadors

```text
replica-poc/
├── src/                     Codi d'Apps Script (rootDir de clasp)
│   ├── appsscript.json      Manifest: zona horària, V8 i permisos OAuth
│   ├── Main.js              Funcions públiques (desplegable «Executa») i disparador
│   ├── Config.js            Script Properties i límits
│   ├── SheetsRepository.js  Accés a Sheets (Configuració, Escenaris, Converses, Missatges)
│   ├── GmailGateway.js      Accés a Gmail, neteja de text i filtres
│   ├── ConversationService.js  Lògica de conversa, reconciliació i tancament
│   ├── PromptBuilder.js     Instruccions per a la IA
│   ├── AiProvider.js        Abstracció del proveïdor (generaResposta)
│   ├── GeminiProvider.js    Adaptador de Gemini (Interactions API)
│   ├── EscenariInicial.js   Escenari ESC-001
│   └── Logger.js            Registres amb dades sensibles emmascarades
├── dist/Replica.gs          FITXER GENERAT: tot src/*.js en un sol fitxer (npm run build)
├── test/                    Proves amb dobles de Gmail, Sheets i Gemini
├── exemples/escenari-001.json
├── scripts/build.js         Genera dist/Replica.gs
├── scripts/clasp.sh         clasp dins de Docker
└── docs/                    Instal·lació, operació i proves
```

Ordres (amb Node.js 22 o amb Docker, sense instal·lar res):

```sh
# Després de canviar qualsevol fitxer de src/, regenereu el fitxer únic
npm run build

# Proves automàtiques (no envien correus ni criden Gemini).
# Fallen si dist/Replica.gs no està al dia amb src/.
npm test
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/app -w /app node:22-alpine sh -c "npm run build && npm test"

# Pujar el codi a Apps Script amb clasp 3.4.1
./scripts/clasp.sh login --no-localhost
./scripts/clasp.sh push
```

Documentació tècnica:

- [docs/instal·lacio.md](docs/instal·lacio.md): clasp, permisos OAuth, versió de l'API de Gemini i passos exactes.
- [docs/operacio.md](docs/operacio.md): iniciar, supervisar, recuperar, aturar i desinstal·lar.
- [docs/proves.md](docs/proves.md): proves d'acceptació, executades i pendents.

## 10. Estat del projecte i limitacions

- ✅ Codi complet i **50 proves automàtiques** superades amb dobles de prova.
- ✅ **Verificat en real (19/11/2026)**: enviament del correu inicial, recepció, resposta del participant, generació amb Gemini i resposta automàtica dins del mateix fil.
- ⏳ **Pendents de verificar en real**: execució doble, missatges consecutius, intents de revelar dades reservades, tancament de la conversa i límit de torns. Vegeu [docs/proves.md](docs/proves.md).
- Les respostes poden trigar diversos minuts (revisió periòdica, no instantània).
- Una sola bústia, un sol escenari i un sol personatge.
- No es pot garantir que cada resposta s'enviï **exactament una vegada** en tots els casos d'error; el programa prioritza **no duplicar** respostes i, si dubta, deixa la conversa en `ERROR` per revisar-la a mà.
- Sense avaluació automàtica: el docent revisa el fil i el full manualment.
