# Operació: iniciar, supervisar i aturar

Totes les accions es fan des de l'editor d'Apps Script (<https://script.google.com>, projecte **Rèplica**): triar la funció al desplegable de la barra superior i fer clic a **Executa**. El resultat apareix al **Registre d'execució**.

## Interruptor general

| Funció | Efecte |
| --- | --- |
| `aturaSimulacions` | `SIMULATION_ENABLED=false`. El disparador continua existint però surt sense llegir Gmail ni enviar res. Tampoc es poden iniciar simulacions noves. |
| `activaSimulacions` | `SIMULATION_ENABLED=true`. Només amb la confirmació del coordinador. |

També es pot canviar a mà a **Configuració del projecte → Propietats de l'script**.

## Iniciar una simulació

1. Comproveu que l'adreça del participant és a `ALLOWED_SENDERS`.
2. Al full de càlcul, pestanya **Configuració**, escriviu-la a la fila `participant`: **només aquesta adreça**, sense comes (la llista completa va a `ALLOWED_SENDERS`). Si cal, trieu l'escenari a la fila `escenari` (per defecte, `ESC-001`).
3. Executeu `provaIniciaSimulacio`.
4. El registre mostra `idConversa` i `threadId`. Al full, pestanya **Converses**, apareix una fila nova en estat `ACTIVA`.

Per què a la pestanya i no com a paràmetre? Perquè el desplegable de l'editor no permet passar arguments, i així no cal escriure cap adreça real al codi (que acabaria a GitHub).

Restriccions: un participant no pot tenir dues converses obertes (`ACTIVA`, `PROCESSANT` o `ERROR`) del mateix escenari; cada conversa té el seu propi fil de Gmail.

### Revisar el missatge inicial

El text que s'envia és la cel·la `missatge_inicial` de la pestanya **Escenaris** (i l'assumpte, `assumpte_inicial`). Es pot editar directament al full abans d'iniciar. No poseu informació reservada en aquestes cel·les: la columna `limits_reservats` és només per a la IA.

## Supervisar

- **`estatSimulacions`**: resum de converses per estat, amb torns i darrer error (adreces emmascarades).
- **Full de càlcul**:
  - `Converses`: estat, torns de la IA (`torns_ia`), dates i `darrer_error`.
  - `Missatges`: tot el que s'ha rebut i enviat, en ordre. `respon_a` indica a quins missatges del participant respon cada resposta; `tanca_conversa` indica si era el comiat.
- **Execucions** (menú esquerre d'Apps Script): historial de cada execució del disparador amb els registres tècnics.
- **Gmail de la bústia de prova**: el fil complet tal com el veu el participant.

### Estats d'una conversa

| Estat | Significat | Què fer |
| --- | --- | --- |
| `ACTIVA` | Espera respostes del participant | Res |
| `PROCESSANT` | S'està generant o enviant una resposta. Si hi queda més d'uns minuts, una execució es va interrompre | Res: la següent execució ho reconcilia sola |
| `FINALITZADA` | Comiat enviat (situació resolta o límit de torns) o tancada a mà | Res. Les respostes posteriors del participant s'ignoren |
| `ERROR` | Cal revisió humana (vegeu `darrer_error`) | Vegeu més avall |

### Missatges

| `estat_enviament` | Significat |
| --- | --- |
| `REBUT` | Missatge del participant registrat |
| `PENDENT` | Resposta preparada, enviament en curs o interromput |
| `ENVIAT` | Resposta enviada i confirmada amb l'identificador de Gmail |
| `ERROR` | Enviament no confirmat; no compta com a resposta |

## Recuperar una conversa en ERROR

1. Llegiu `darrer_error` a la pestanya **Converses**.
2. Obriu el fil a la bústia de prova i comproveu si la darrera resposta de la clienta s'ha enviat o no.
3. Corregiu la causa (clau, model, quota…) i executeu `comprovaConfiguracio`.
4. Per reactivar-la, cal passar l'identificador com a paràmetre. Afegiu temporalment al fitxer **Main** (sense desar cap adreça):

   ```js
   function reactivaAra() {
     reactivaConversa('ENGANXA_AQUI_L_ID_CONVERSA');
   }
   ```

   Executeu `reactivaAra` i després esborreu la funció. La conversa torna a `ACTIVA` i, a la propera revisió, es respon als missatges pendents.

   Si la resposta **sí** que s'havia enviat però el sistema no ho va poder confirmar, no la reactiveu: tanqueu-la amb `tancaConversa` (mateix procediment) per no duplicar-la.

## Tancar una conversa a mà

Mateix procediment que l'anterior amb `tancaConversa('ID')`. La conversa passa a `FINALITZADA` sense enviar cap comiat. És necessari, per exemple, per tornar a iniciar una simulació amb el mateix participant.

## Disparador

| Funció | Efecte |
| --- | --- |
| `creaDisparador` | Crea el disparador amb l'interval de la pestanya **Configuració** (`interval_minuts`; per defecte 5). Elimina abans els existents: mai n'hi ha més d'un |
| Canviar `interval_minuts` a la pestanya | 1, 5, 10, 15 o 30. S'aplica sol a la propera revisió automàtica. Feu servir 1 minut només durant demostracions: consumeix molta quota diària |
| `eliminaDisparadors` | Elimina'l: no es revisarà més la bústia |

També es poden veure i eliminar al menú **Activadors** (icona del rellotge) d'Apps Script.

## Desinstal·lar i esborrar dades

1. `aturaSimulacions` i `eliminaDisparadors`.
2. **Revocar la clau de Gemini**: Google AI Studio → *API keys* → suprimir la clau. Esborreu la propietat `GEMINI_API_KEY`.
3. **Esborrar les converses de prova**: al full, suprimiu les files (no la capçalera) de **Converses** i **Missatges**, o suprimiu tot el full de càlcul.
4. **Esborrar els correus**: a la bústia de prova, suprimiu els fils de la simulació (també a la Paperera). Els participants han d'esborrar els seus.
5. **Revocar els permisos** del projecte: <https://myaccount.google.com/permissions> → Rèplica → *Suprimeix l'accés*.
6. Opcionalment, suprimiu el projecte d'Apps Script i el compte de prova.

## Bones pràctiques

- Només docents voluntaris i dades inventades.
- Un sol coordinador amb accés a l'editor i a la bústia de prova.
- No reenvieu correus de la simulació a altres persones: cada missatge d'un tercer dins del fil s'ignora, però queda a Gmail.
