# Instal·lació: referència tècnica

La guia pas a pas per a persones sense experiència tècnica és al [README](../README.md#3-installació-pas-a-pas). Aquest document en recull els detalls tècnics exactes.

## Resum dels passos

| # | Pas | Qui | Com |
| --- | --- | --- | --- |
| 1 | Obtenir el codi | Qualsevol | `git clone https://github.com/Marcos-A/replica-poc.git` o *Download ZIP* |
| 2 | Crear el full de càlcul | **Persona** (compte de prova) | <https://sheets.new> → copiar l'identificador |
| 3 | Crear el projecte d'Apps Script | **Persona** | Camí A (editor) o camí B (`clasp create-script`) |
| 4 | Pujar el codi | Persona o agent amb credencials | Camí A (copiar) o camí B (`clasp push`) |
| 5 | Crear la clau de Gemini i triar model | **Persona** | Google AI Studio |
| 6 | Script Properties | **Persona** | Configuració del projecte → Propietats de l'script |
| 7 | Autoritzar OAuth i preparar el full | **Persona** | Executar `preparaFulls` des de l'editor |
| 8 | Diagnòstic | Persona | Executar `comprovaConfiguracio` |
| 9 | Disparador | Persona | Executar `creaDisparador` (o `creaDisparador(1)` per a demostracions) |
| 10 | Prova real amb dos docents | Persona | Vegeu [operacio.md](operacio.md) i [proves.md](proves.md) |
| 11 | Deixar `SIMULATION_ENABLED=false` | Persona | Fins que el coordinador confirmi l'activació |

Els passos marcats **Persona** requereixen iniciar sessió o acceptar permisos: no es poden delegar a un agent ni automatitzar sense compartir credencials.

## Camí A: copiar el codi a l'editor

Vegeu el [README, secció 3.4](../README.md#34-copiar-els-fitxers-del-programa). Els fitxers `src/*.js` s'enganxen com a fitxers d'script (`.gs`) amb el mateix nom. El codi no depèn de l'ordre de càrrega dels fitxers: cap mòdul fa referència a un altre fora d'una funció.

## Camí B: pujar el codi amb clasp

Versió verificada: **@google/clasp 3.4.1** (fixada a `package.json` i a `scripts/clasp.sh`).

### Prerequisit únic

Activeu l'API d'Apps Script per al compte de prova: <https://script.google.com/home/usersettings> → **Google Apps Script API** → *Activat*. Sense això, `clasp` retorna un error de permisos.

### Opció B1: amb Docker (no instal·la res a l'ordinador)

```sh
./scripts/clasp.sh login --no-localhost   # obre l'URL al navegador i enganxa el codi
./scripts/clasp.sh create-script --type standalone --title "Rèplica" --rootDir src
./scripts/clasp.sh push
```

Les credencials de `clasp` es desen a `~/.config/replica-poc-clasp/.clasprc.json`, fora del projecte.

### Opció B2: amb Node.js 22 instal·lat

```sh
npm install                  # instal·la clasp 3.4.1 com a dependència local
npx clasp login              # autenticació interactiva al navegador
npx clasp create-script --type standalone --title "Rèplica" --rootDir src
npx clasp push
```

Alternativa: `npm install -g @google/clasp@3.4.1` i després `clasp …`.

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
| `https://www.googleapis.com/auth/userinfo.email` | Conèixer l'adreça de la pròpia bústia (per ignorar-ne els correus) |

El projecte no és verificat per Google; en autoritzar, cal passar per **Configuració avançada → Ves a Rèplica (no segur)**. Per revocar l'accés: <https://myaccount.google.com/permissions>.

## Script Properties

| Propietat | Obligatòria | Valor |
| --- | --- | --- |
| `GEMINI_API_KEY` | Sí | Clau de Google AI Studio. **Secret.** |
| `GEMINI_MODEL` | Sí | Identificador del model (amb o sense el prefix `models/`). No n'hi ha cap de fixat al codi. |
| `SPREADSHEET_ID` | Sí | Identificador del full de càlcul |
| `ALLOWED_SENDERS` | Sí | Adreces separades per comes, punts i coma o espais |
| `SIMULATION_ENABLED` | Sí | `true` o `false`. Qualsevol altre valor equival a `false`. |
| `PROVA_PARTICIPANT` | No | Adreça que fa servir `provaIniciaSimulacio()` |
| `PROVA_ESCENARI` | No | Escenari de `provaIniciaSimulacio()` (per defecte `ESC-001`) |

La clau només es llegeix a `Config.clauApi()` i s'envia a Gemini per la capçalera `x-goog-api-key`, mai a l'URL. Els registres emmascaren qualsevol cadena amb format de clau (`AIza…`) i les adreces de correu.

## Gemini API

Verificat amb la documentació oficial el 19/11/2026:

- **API**: *Interactions API*, que Google recomana per a projectes nous (`generateContent` continua disponible però es considera llegada).
- **Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/interactions`
- **Capçaleres**: `x-goog-api-key`, `Content-Type: application/json`, `Api-Revision: 2026-05-20`
- **Cos**: `model`, `system_instruction`, `input`, `generation_config.max_output_tokens`, `response_format` (`mime_type: application/json` + esquema JSON amb `resposta` i `finalitzada`) i `store: false` (no es desa la interacció al servidor).
- **Resposta**: `status: "completed"` i `steps[]`; el text és als passos `type: "model_output"` → `content[].text`. L'adaptador també accepta el format antic `outputs[]`.
- **Diagnòstic**: `comprovaConfiguracio()` fa `GET /v1beta/models/{model}` per confirmar que el model existeix, sense consumir quota de generació.

Si Google canvia la revisió de l'API, s'ha d'actualitzar `API_REVISION` i, si cal, `extreuText_` a `src/GeminiProvider.js`. Les proves de `test/funcions-pures.test.js` documenten el format esperat.

**Quota**: no tots els models tenen nivell gratuït i els límits canvien sovint. Comproveu-ho a la pàgina de preus i límits de Google AI Studio en crear la clau. Els errors 429 i 5xx es reintenten automàticament a la següent execució del disparador; els 400/403 deixen la conversa en `ERROR`.

## Quotes d'Apps Script

Amb un compte gratuït de Gmail, el temps total d'execució de disparadors és limitat (de l'ordre de 90 minuts diaris). Una execució sense converses actives dura uns segons; amb el disparador cada 5 minuts (288 execucions al dia) hi ha marge. Amb `creaDisparador(1)` (1.440 execucions diàries) feu-lo servir només durant demostracions i torneu a `creaDisparador(5)` després.

Límits interns (a `src/Config.js`): 10 converses per execució, 4 minuts per execució, màxim 6 torns per escenari (topall absolut de 12), 4.000 caràcters per missatge entrant, 20.000 caràcters d'historial i 2.500 caràcters per resposta.
