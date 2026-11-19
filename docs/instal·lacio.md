# Instal·lació: referència tècnica

La guia pas a pas per a persones sense experiència tècnica és al [README](../README.md#3-installació-pas-a-pas). Aquest document en recull els detalls tècnics exactes.

## Resum dels passos

| # | Pas | Qui | Com |
| --- | --- | --- | --- |
| 1 | Obtenir el codi | Qualsevol | `git clone https://github.com/Marcos-A/replica-poc.git` o *Download ZIP* |
| 2 | Crear el full de càlcul | **Persona** (compte de prova) | <https://sheets.new>, a «El meu Drive» del compte de prova |
| 3 | Crear el projecte d'Apps Script vinculat al full | **Persona** | Al full: Extensions → Apps Script |
| 4 | Pujar el codi | Persona o agent amb credencials | Camí A (copiar) o camí B (`clasp push`) |
| 5 | Crear la clau de Gemini i triar model | **Persona** | Google AI Studio |
| 6 | Script Properties | **Persona** | `GEMINI_MODEL`, `SIMULATION_ENABLED=false` |
| 7 | Autoritzar OAuth i preparar el full | **Persona** | Recarregar el full → Rèplica → Configuració → Prepara el full |
| 8 | Desar la clau | **Persona** | Rèplica → Configuració → Desa la clau de Gemini |
| 9 | Diagnòstic | Persona | Rèplica → Configuració → Comprova la configuració |
| 10 | Participants, paràmetres i disparador | Persona | Pestanyes `Participants` i `Configuració` del full, i Rèplica → Revisió automàtica → Crea o actualitza |
| 11 | Prova real amb dos docents | Persona | Vegeu [operacio.md](operacio.md) i [proves.md](proves.md) |
| 12 | Deixar `SIMULATION_ENABLED=false` | Persona | Fins que el coordinador confirmi l'activació |

Els passos marcats **Persona** requereixen iniciar sessió o acceptar permisos: no es poden delegar a un agent ni automatitzar sense compartir credencials.

## Projecte vinculat al full (recomanat)

El projecte es crea des del full (Extensions → Apps Script) i queda **vinculat** (*container-bound*) a aquest full. És l'única manera que el full tingui el menú **Rèplica**: `onOpen` només s'executa en projectes vinculats.

- **Quin full**: `Repositori` fa servir `SPREADSHEET_ID` si la propietat té valor; si és buida, `SpreadsheetApp.getActiveSpreadsheet()`, que en un projecte vinculat retorna el full contenidor també dins dels disparadors temporals. En un projecte independent retorna `null` i llavors cal `SPREADSHEET_ID`. `comprovaConfiguracio()` mostra un `[ERROR]` si en un projecte vinculat `SPREADSHEET_ID` apunta a un altre full.
- **`onOpen` és un activador simple**: s'executa en mode `AuthMode.LIMITED`, sense autorització, i no s'executa per a qui obre el full només amb permís de lectura o comentari. Només construeix el menú. Si no pot llegir `SIMULATION_ENABLED`, mostra les dues opcions de l'interruptor. Si Google li dona l'adreça de qui obre el full (`Session.getActiveUser()`, que sovint és buida per a comptes de Gmail) i no és el propietari, no mostra el menú.
- **Les opcions del menú** s'executen amb el compte de qui hi fa clic, amb autorització completa (la primera vegada, Google la demana). Totes passen per `Menu.executa()`, que comprova els mòduls i el compte (vegeu més avall) i mostra qualsevol error amb `SpreadsheetApp.getUi().alert`.
- **Conversa seleccionada**: `getActiveSpreadsheet().getActiveRange()`. S'accepta una sola fila (≥ 2) de `Converses` o de `Missatges`, i se'n llegeix la columna `id_conversa`.
- **Qui pot editar el full pot editar el projecte**: els editors d'un projecte vinculat són els editors del full. Poden veure el codi i les Propietats de l'script i canviar-los, i un canvi al codi s'executaria després amb els permisos del compte de prova (disparador). En aquesta prova de concepte s'accepta perquè els editors són docents de confiança; per a la resta, permís de lectura.

### Comprovació del compte

Les opcions del menú s'executen amb el compte de qui hi fa clic, i un disparador amb el de qui el va crear. Si no fos el compte de prova, els correus sortirien d'un altre Gmail. `Compte.comprova()` (a `src/Main.js`) exigeix que `Session.getEffectiveUser().getEmail()` sigui el **propietari del full** (`Spreadsheet.getOwner()`):

- No cal configurar res, i només el propietari pot canviar qui és el propietari.
- `getEffectiveUser()` és fiable amb l'abast `userinfo.email`, també per a comptes de Gmail; `getActiveUser()` no ho és, per això no s'hi confia.
- Si `getOwner()` retorna `null` (full en una unitat compartida), es refusa amb un missatge que ho explica.
- S'aplica a totes les opcions del menú, a `iniciaSimulacio`, a `enviaActivacioPendent`, a `creaDisparador` i a `processaCorreusPendents` (si l'interruptor és encès): un disparador creat per un altre compte surt sense llegir ni enviar res i ho registra com a error.
- Protegeix d'errors (un docent que fa clic al menú), no d'un editor que modifiqui el codi expressament.

### Clau de Gemini

`Config.clauApi()` llegeix primer les **propietats d'usuari** (`PropertiesService.getUserProperties()`) i, si no hi és, les **Propietats de l'script**. Rèplica → Configuració → Desa la clau de Gemini la desa a les propietats d'usuari del compte de prova i l'esborra de les de l'script. Les propietats d'usuari no surten a Configuració del projecte, i el codi executat per un altre compte llegeix les seves pròpies (buides). El disparador s'executa amb el compte de prova i, per tant, la troba.

### Migrar una instal·lació independent

Els passos per a persones sense experiència tècnica són al [README, pas 3.9](../README.md#39-ja-el-teníeu-installat-a-scriptgooglecom-passar-lo-al-full). Resum: al projecte antic, `aturaSimulacions`, `eliminaDisparadors` i comprovar que no queda cap activador; al full, crear el projecte vinculat, enganxar el codi i les propietats (sense `SPREADSHEET_ID` ni la clau; `ALLOWED_SENDERS` només perquè `Prepara el full` en copiï les adreces a Participants), autoritzar, `Prepara el full`, esborrar `ALLOWED_SENDERS`, desar la clau, comprovar, crear la revisió automàtica i activar; finalment, esborrar la clau del projecte antic i suprimir-lo. Mai no hi ha dos disparadors actius alhora. Les converses són al full i els fils a la mateixa bústia, de manera que continuen.

## Alternativa: projecte independent (sense menú)

Com en les versions anteriors: el projecte es crea a <https://script.google.com> → **Projecte nou**, s'hi afegeix la propietat `SPREADSHEET_ID` (l'identificador del full, la part de l'URL entre `/d/` i `/edit`) i la clau a `GEMINI_API_KEY` de les Propietats de l'script (en un projecte independent, els editors del full no la veuen). Tot es fa des de l'editor: triar la funció al desplegable i **Executa** (`preparaFulls`, `comprovaConfiguracio`, `creaDisparador`, `activaSimulacions`, `enviaActivacioPendent`…). `enviaActivacioPendent` envia la primera fila de la pestanya Activacions que encara no té estat. El resultat surt al **Registre d'execució**. La comprovació del compte s'aplica igual: el full ha de ser del compte de prova.

## Camí A: copiar el codi a l'editor

Vegeu el [README, secció 3.4](../README.md#34-copiar-el-programa). S'enganxen dos fitxers: `src/appsscript.json` i **`dist/Replica.gs`**, que conté tot `src/*.js` concatenat per `npm run build`.

- `src/` és l'única font del codi. `dist/Replica.gs` és un fitxer generat i es versiona perquè es pugui descarregar amb *Download ZIP*. No s'ha d'editar a mà.
- `npm test` falla si `dist/Replica.gs` no coincideix amb `src/`. Executeu `npm run build` després de cada canvi a `src/`.
- Cada mòdul comença amb un comentari `// ===== src/<fitxer>.js =====`. Per localitzar una línia d'un error de l'editor, cerqueu el marcador anterior.
- `comprovaConfiguracio()` i `preparaFulls()` comproven primer que tots els mòduls estan carregats i diuen quin falta.
- No barregeu `Replica.gs` amb els fitxers separats: totes les declaracions són globals i la darrera versió carregada sobreescriuria les altres sense cap error.

Els usuaris de clasp (camí B) pugen `src/` tal com és (fitxers separats) i no fan servir `dist/`.

## Camí B: pujar el codi amb clasp

Versió verificada: **@google/clasp 3.4.1** (fixada a `package.json` i a `scripts/clasp.sh`).

### Prerequisit únic

Activeu l'API d'Apps Script per al compte de prova: <https://script.google.com/home/usersettings> → **Google Apps Script API** → *Activat*. Sense això, `clasp` retorna un error de permisos.

### Opció B1: amb Docker (no instal·la res a l'ordinador)

```sh
./scripts/clasp.sh login --no-localhost   # obre l'URL al navegador i enganxa el codi
./scripts/clasp.sh create-script --parentId <ID del full> --title "Rèplica" --rootDir src
./scripts/clasp.sh push
```

Les credencials de `clasp` es desen a `~/.config/replica-poc-clasp/.clasprc.json`, fora del projecte.

### Opció B2: amb Node.js 22 instal·lat

```sh
npm install                  # instal·la clasp 3.4.1 com a dependència local
npx clasp login              # autenticació interactiva al navegador
npx clasp create-script --parentId <ID del full> --title "Rèplica" --rootDir src
npx clasp push
```

Alternativa: `npm install -g @google/clasp@3.4.1` i després `clasp …`.

`--parentId` crea el projecte **vinculat** al full (l'ID és la part de l'URL del full entre `/d/` i `/edit`), amb menú. Per a un projecte independent, sense menú, feu servir `--type standalone` en lloc de `--parentId …` i afegiu la propietat `SPREADSHEET_ID`.

### Vincular un projecte existent

Si el projecte d'Apps Script ja existeix (per exemple, creat al camí A), no feu `create-script`. Copieu l'exemple i poseu-hi l'identificador del projecte (Configuració del projecte → **ID de l'script**):

```sh
cp .clasp.json.example .clasp.json
# editeu .clasp.json i substituïu ENGANXA_AQUI_... per l'ID de l'script
```

Configuració exacta de `.clasp.json` (clasp 3.4.1):

```json
{
  "scriptId": "<ID de l'script>",
  "rootDir": "src"
}
```

`.clasp.json` és a `.gitignore`: no es puja al repositori.

`clasp push` substitueix tots els fitxers del projecte remot pels de `src/`. Si heu editat codi directament a l'editor web, feu `clasp pull` abans o perdreu els canvis.

## Permisos OAuth

Declarats explícitament a `src/appsscript.json`:

| Abast | Per a |
| --- | --- |
| `https://mail.google.com/` | `GmailApp`: llegir els fils de la simulació, crear esborranys i enviar |
| `https://www.googleapis.com/auth/spreadsheets` | `SpreadsheetApp.openById` |
| `https://www.googleapis.com/auth/script.external_request` | `UrlFetchApp` (Gemini API) |
| `https://www.googleapis.com/auth/script.scriptapp` | Crear i eliminar el disparador temporal |
| `https://www.googleapis.com/auth/script.container.ui` | Menú Rèplica i quadres de diàleg (`SpreadsheetApp.getUi()`) |
| `https://www.googleapis.com/auth/userinfo.email` | Conèixer l'adreça de la pròpia bústia (per ignorar-ne els correus) i comprovar que s'executa amb el compte de prova |

Com que el manifest declara els abasts explícitament, afegir-ne un (com `script.container.ui` en aquesta versió) fa que Google torni a demanar l'autorització la primera vegada que s'executa el programa després d'actualitzar-lo.

El projecte no és verificat per Google; en autoritzar, cal passar per **Configuració avançada → Ves a Rèplica (no segur)**. Per revocar l'accés: <https://myaccount.google.com/permissions>.

## Script Properties

| Propietat | Obligatòria | Valor |
| --- | --- | --- |
| `GEMINI_API_KEY` | Vegeu la nota | Clau de Google AI Studio. **Secret.** En un projecte vinculat, deseu-la amb el menú (propietats d'usuari del compte de prova) i no aquí: aquí la veuen tots els editors del full. `comprovaConfiguracio()` en mostra un `[AVÍS]`. |
| `GEMINI_MODEL` | Sí | Identificador del model (amb o sense el prefix `models/`). No n'hi ha cap de fixat al codi. |
| `SPREADSHEET_ID` | Només en un projecte independent | Identificador del full de càlcul. En un projecte vinculat, deixeu-la buida. |
| `SIMULATION_ENABLED` | Sí | `true` o `false`. Qualsevol altre valor equival a `false`. |
| `INTERVAL_APLICAT` | Interna | La desa el programa: interval amb què es va crear el disparador. No cal tocar-la. |
| `ALLOWED_SENDERS` | Obsoleta | Ara és la pestanya `Participants`. Quan `preparaFulls()` crea aquesta pestanya, hi copia les adreces de la propietat (marcades com a actives). Després ja no es llegeix, i `comprovaConfiguracio()` avisa que es pot esborrar. |
| `PROVA_PARTICIPANT`, `PROVA_ESCENARI` | Obsoletes | De versions anteriors. `comprovaConfiguracio()` avisa que es poden esborrar. |

## Pestanya Configuració

Paràmetres operatius que el docent pot canviar des del full de càlcul, sense tocar codi. `preparaFulls()` crea la pestanya amb una fila per paràmetre (`clau`, `valor`, `descripcio`), afegeix els que falten sense canviar els valors existents, elimina els obsolets (`participant` i `escenari`, ara a cada activació), actualitza la columna `descripcio` i hi aplica llistes desplegables.

| `clau` | Valors | Ús |
| --- | --- | --- |
| `interval_minuts` | 1, 5, 10, 15 o 30 (per defecte 5) | Interval del disparador. Cada execució de `processaCorreusPendents` el compara amb `INTERVAL_APLICAT` i, si ha canviat, recrea el disparador. Si s'han eliminat els disparadors expressament, no en crea cap. `creaDisparador(n)` també el desa a la pestanya. |
| `max_torns_per_defecte` | Desplegable de 1 a 12 (per defecte 6) | Límit de torns quan la columna `max_torns` de l'escenari és buida |
| `correus_per_dia` | 100 o 1500 (per defecte 100) | Límit de correus de la clienta en 24 hores (vegeu [Quotes](#quotes-de-gmail-gemini-i-apps-script)) |

Un valor incorrecte no atura el sistema: s'utilitza el valor per defecte i `comprovaConfiguracio()` mostra un `[ERROR]` amb el motiu.

## Pestanya Participants

`correu | actiu | notes`. Substitueix `ALLOWED_SENDERS`. Només les adreces vàlides amb `actiu` marcat (`TRUE`) poden rebre una activació (`Simulacio.inicia` ho comprova) i només els seus missatges es registren i es responen (`registraEntrants_`, amb la llista llegida una vegada per execució). `preparaFulls()` posa una casella de selecció a la columna `actiu`.

Per què al full i no a les Propietats de l'script: en un projecte vinculat, els editors del full ja poden canviar les propietats, de manera que guardar-la a les propietats no protegia res i feia molt pesat afegir participants. `comprovaConfiguracio()` dona un `[ERROR]` si no hi ha cap participant actiu, si hi ha adreces no vàlides o si hi ha la mateixa bústia de prova.

## Pestanya Activacions

`id_activacio | escenari | destinataris | estat | data_enviament | resultat`. El docent omple `escenari` (desplegable dels `id` d'Escenaris) i `destinataris` (una o més adreces separades per comes, punts i coma, espais o salts de línia; Sheets no permet crear desplegables de selecció múltiple des d'Apps Script). La resta l'escriu el programa.

Enviament (`enviaActivacio_`, a `src/Main.js`; menú **Envia l'activació seleccionada…** o `enviaActivacioPendent` des de l'editor):

1. `revisaActivacio_` ho valida tot abans d'enviar res: estat (`ENVIADA` no es reenvia), interruptor, escenari existent i actiu, almenys una adreça i com a màxim 50, adreces vàlides, totes a Participants i actives, cap que sigui la bústia. Si una sola falla, no s'envia res i el missatge diu quines adreces són.
2. S'ometen (sense error) els destinataris que ja tenen una conversa d'aquesta activació, o una conversa no `FINALITZADA` del mateix escenari.
3. Si els correus a enviar superen els que queden fins a `correus_per_dia`, no s'envia res.
4. S'assigna `id_activacio` (`ACT-001`, `ACT-002`…) i es crida `Simulacio.inicia(correu, escenari, idActivacio)` per a cada destinatari: un fil de Gmail per persona. La conversa desa `id_activacio` a la pestanya Converses.
5. Estat final: `ENVIADA`, o `PARCIAL` si algun enviament ha fallat (la fila es pot tornar a enviar i només arriba a qui falti). `resultat` resumeix enviats, omesos i errors amb el motiu.

Tots els destinataris reben el mateix assumpte i text (`assumpte_inicial` i `missatge_inicial` de l'escenari). El correu inicial no l'escriu la IA, i per això no pot revelar `limits_reservats`.

## Secrets i controls

La clau, el model i l'interruptor general (`GEMINI_API_KEY`, `GEMINI_MODEL`, `SIMULATION_ENABLED`) no són a cap pestanya: canviar una cel·la del full no activa el sistema ni canvia el model. En un projecte vinculat, però, qui pot editar el full també pot obrir Apps Script i canviar les propietats (vegeu [Projecte vinculat al full](#projecte-vinculat-al-full-recomanat)), i pot afegir participants a la pestanya Participants.

La clau només es llegeix a `Config.clauApi()` i s'envia a Gemini per la capçalera `x-goog-api-key`, mai a l'URL. Els registres emmascaren qualsevol cadena amb format de clau (`AIza…`) i les adreces de correu.

## Gemini API

Verificat amb la documentació oficial el 19/11/2026:

- **API**: *Interactions API*, que Google recomana per a projectes nous (`generateContent` continua disponible però es considera llegada).
- **Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/interactions`
- **Capçaleres**: `x-goog-api-key`, `Content-Type: application/json`, `Api-Revision: 2026-05-20`
- **Cos**: `model`, `system_instruction`, `input`, `generation_config.max_output_tokens`, `response_format` (`mime_type: application/json` + esquema JSON amb `salutacio`, `paragrafs`, `comiat` i `finalitzada`; el codi munta el correu amb els paràgrafs separats i hi afegeix la signatura a partir de l'escenari) i `store: false` (no es desa la interacció al servidor).
- **Resposta**: `status: "completed"` i `steps[]`; el text és als passos `type: "model_output"` → `content[].text`. L'adaptador també accepta el format antic `outputs[]`.
- **Diagnòstic**: `comprovaConfiguracio()` fa `GET /v1beta/models/{model}` per confirmar que el model existeix, sense consumir quota de generació.

Si Google canvia la revisió de l'API, s'ha d'actualitzar `API_REVISION` i, si cal, `extreuText_` a `src/GeminiProvider.js`. Les proves de `test/funcions-pures.test.js` documenten el format esperat.

**Quota**: no tots els models tenen nivell gratuït i els límits canvien sovint. Comproveu-ho a la pàgina de preus i límits de Google AI Studio en crear la clau. Els errors 429 i 5xx es reintenten automàticament a la següent execució del disparador; els 400/403 deixen la conversa en `ERROR`.

## Quotes de Gmail, Gemini i Apps Script

La versió per a persones sense experiència tècnica és al [README, secció 7](../README.md#7-límits-de-gmail-i-de-gemini).

- **Gmail (Apps Script)**: destinataris de correu per dia, de l'ordre de 100 amb un compte de Gmail i 1.500 amb Google Workspace. Cada correu inicial i cada resposta compten. El programa no fa servir `MailApp.getRemainingDailyQuota()` (requeriria un abast nou): compta els missatges `interlocutor` en estat `ENVIAT` o `PENDENT` de les darreres 24 hores a la pestanya Missatges (`Repositori.correusEnviatsDesDe`) i els compara amb `correus_per_dia`. Una activació que el superaria no s'envia; durant el processament, quan no en queden, la conversa no es toca i torna `LIMIT_DIARI` (sense cridar la IA) fins que hi torna a haver marge.
- **Gemini (nivell gratuït)**: límits de peticions per minut i per dia que depenen del model i canvien sovint (Google AI Studio → límits). Una petició per resposta. Els errors 429 i 5xx es reintenten a la següent execució. Amb el nivell gratuït, Google pot fer servir el contingut de les peticions per millorar els seus productes: només dades inventades.
- **Apps Script**: amb un compte gratuït de Gmail, el temps total d'execució de disparadors és limitat (de l'ordre de 90 minuts diaris) i cada execució s'atura als 6 minuts. Una execució sense converses actives dura uns segons; amb el disparador cada 5 minuts (288 execucions al dia) hi ha marge. Amb `interval_minuts` a 1 (1.440 execucions diàries), feu-lo servir només durant demostracions i torneu a 5 després.

**Torns justos**: cada execució llegeix **totes** les converses `ACTIVA` i `PROCESSANT`, ordenades per `data_actualitzacio` (primer les que fa més temps que no canvien), i genera com a màxim 10 respostes (`MAX_RESPOSTES_PER_EXECUCIO`). Les que no hi caben tornen `AJORNADA` sense canvis i, com que no s'actualitzen, són de les primeres a la propera execució. El temps màxim de 4 minuts per execució continua com a límit de seguretat.

Altres límits interns (a `src/Config.js`): 50 destinataris per activació, màxim 6 torns per escenari (topall absolut de 12), 4.000 caràcters per missatge entrant, 20.000 caràcters d'historial i 2.500 caràcters per resposta.
