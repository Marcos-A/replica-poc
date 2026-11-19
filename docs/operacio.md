# Operació: iniciar, supervisar i aturar

Totes les accions es fan des del menú **Rèplica** del full de càlcul, havent entrat amb el **compte de prova** (el propietari del full). Cada opció mostra el resultat, o el motiu de l'error, en un quadre de diàleg. Les opcions que acaben en «…» demanen confirmació.

Si el programa està instal·lat com a projecte independent (sense menú), les mateixes accions es fan des de l'editor d'Apps Script: triar la funció del desplegable de la barra superior i **Executa**. El resultat surt al **Registre d'execució**. A cada apartat s'indica la funció equivalent.

## Qui pot fer servir el menú

Només el **compte de prova**. Les opcions s'executen amb el compte de qui hi fa clic: amb un altre compte, els correus sortirien del seu Gmail. El programa ho comprova abans de fer res i, si no és el compte de prova, ho explica i no fa res. La revisió automàtica fa la mateixa comprovació.

Els altres docents poden tenir el full compartit per seguir les converses o canviar la pestanya Configuració. Si fan clic al menú i Google els demana autorització, han de fer clic a **Cancel·la**. Tingueu en compte que qui pot editar el full també pot obrir Apps Script i veure'n el codi i les propietats: compartiu-lo amb permís d'edició només amb persones de confiança, i amb permís de lectura amb la resta.

## Interruptor general

| Menú | Funció equivalent | Efecte |
| --- | --- | --- |
| **Simulacions ACTIVADES · Atura-les totes…** | `aturaSimulacions` | `SIMULATION_ENABLED=false`. La revisió automàtica continua existint però surt sense llegir Gmail ni enviar res. Tampoc es poden iniciar simulacions noves. |
| **Simulacions ATURADES · Activa-les…** | `activaSimulacions` | `SIMULATION_ENABLED=true`. Només amb la confirmació del coordinador. |

El text de l'opció mostra l'estat actual i canvia en fer clic. També es pot canviar a mà a **Extensions → Apps Script → Configuració del projecte → Propietats de l'script**; llavors, recarregueu el full perquè el menú mostri l'estat nou.

## Participants

La pestanya **Participants** té una fila per persona: `correu`, `actiu` (casella) i `notes` (lliure). Només es pot enviar una activació a qui hi és amb la casella **actiu** marcada, i la clienta només respon a aquestes persones. Desmarcar la casella d'algú atura les seves converses de fet: les respostes que enviï s'ignoren.

## Enviar una activació (iniciar simulacions)

Una activació és una fila de la pestanya **Activacions**: un escenari i una o més adreces. Cada persona rep el mateix correu inicial en un fil separat.

1. A la primera fila buida d'**Activacions**, trieu l'**escenari** de la llista i escriviu els **destinataris** (adreces de Participants, separades per comes o una per línia).
2. Feu clic a la fila i trieu **Rèplica → Envia l'activació seleccionada…**
3. El quadre mostra l'escenari, a qui s'enviarà i a qui no (per exemple, si ja té una conversa oberta). Si és correcte, **Sí**.
4. La fila queda amb l'identificador (`ACT-001`…), l'estat (`ENVIADA` o `PARCIAL`), la data i el resultat. A la pestanya **Converses** apareix una fila per persona, en estat `ACTIVA` i amb l'`id_activacio`.

Regles:

- Si alguna adreça no és a Participants o no hi és activa, **no s'envia res** i el quadre diu quina és.
- Una fila `ENVIADA` no es torna a enviar: per a una ronda nova, afegiu una fila nova.
- Una fila `PARCIAL` es pot tornar a enviar: només s'envia a qui falti.
- Un participant no pot tenir dues converses obertes (`ACTIVA`, `PROCESSANT` o `ERROR`) del mateix escenari: se l'omet.
- Si l'activació faria passar del límit de correus en 24 hores (`correus_per_dia`, pestanya Configuració), no s'envia. Vegeu el [README, secció 7](../README.md#7-límits-de-gmail-i-de-gemini).

Des de l'editor (instal·lació sense menú): `enviaActivacioPendent` envia la primera fila d'Activacions que encara no té estat. El resultat també queda escrit a la fila.

### Revisar el missatge inicial

El text que s'envia és la cel·la `missatge_inicial` de la pestanya **Escenaris** (i l'assumpte, `assumpte_inicial`). Es pot editar directament al full abans d'iniciar. No poseu informació reservada en aquestes cel·les: la columna `limits_reservats` és només per a la IA.

## Supervisar

- **Rèplica → Estat de les converses** (`estatSimulacions`): si les simulacions estan activades, cada quan es revisa la bústia, el recompte per estat i les converses no finalitzades amb el darrer error (adreces emmascarades).
- **Rèplica → Revisa ara les respostes** (`processaCorreusPendents`): fa la revisió en aquell moment, sense esperar l'automàtica, i en mostra el resum. Cada revisió llegeix totes les converses i genera com a màxim 10 respostes; si n'hi ha més, la resta surten a la revisió següent. Si s'ha arribat al límit diari de correus, les respostes esperen i el resum ho diu.
- **Rèplica → Configuració → Comprova la configuració**: entre altres coses, quants correus s'han enviat en les darreres 24 hores i quants en queden.
- **Full de càlcul**:
  - `Converses`: estat, torns de la IA (`torns_ia`), dates i `darrer_error`.
  - `Missatges`: tot el que s'ha rebut i enviat, en ordre. `respon_a` indica a quins missatges del participant respon cada resposta; `tanca_conversa` indica si era el comiat.
- **Execucions** (Extensions → Apps Script, menú esquerre): historial de cada execució de la revisió automàtica amb els registres tècnics.
- **Gmail de la bústia de prova**: el fil complet tal com el veu el participant.

### Estats d'una conversa

| Estat | Significat | Què fer |
| --- | --- | --- |
| `ACTIVA` | Espera respostes del participant | Res |
| `PROCESSANT` | S'està generant o enviant una resposta. Si hi queda més d'uns minuts, una execució es va interrompre | Res: la següent execució ho reconcilia sola |
| `FINALITZADA` | Comiat enviat (situació resolta o límit de torns) o aturada a mà | Res. Les respostes posteriors del participant no es responen fins que es reobri (vegeu [Reobrir una conversa finalitzada](#reobrir-una-conversa-finalitzada)) |
| `ERROR` | Cal revisió humana (vegeu `darrer_error`) | Vegeu més avall |

### Missatges

| `estat_enviament` | Significat |
| --- | --- |
| `REBUT` | Missatge del participant registrat |
| `PENDENT` | Resposta preparada, enviament en curs o interromput |
| `ENVIAT` | Resposta enviada i confirmada amb l'identificador de Gmail |
| `ERROR` | Enviament no confirmat; no compta com a resposta |

## Triar una conversa

Les opcions **Atura la conversa seleccionada…**, **Reactiva la conversa seleccionada…** i **Reobre la conversa seleccionada…** actuen sobre la fila seleccionada:

1. Feu clic a **qualsevol cel·la de la fila** de la conversa a la pestanya **Converses** (no a la capçalera). També val una fila de la pestanya **Missatges**: s'agafa la conversa d'aquell missatge.
2. Trieu l'opció del menú. El quadre de confirmació mostra la conversa triada: identificador, participant, escenari, estat, respostes i darrer error.

Si no hi ha cap fila vàlida seleccionada (una altra pestanya, la capçalera, diverses files o una fila buida), el quadre explica què cal fer i no es canvia res.

## Recuperar una conversa en ERROR

1. Llegiu `darrer_error` a la pestanya **Converses**.
2. Obriu el fil a la bústia de prova i comproveu si la darrera resposta de la clienta s'ha enviat o no.
3. Corregiu la causa (clau, model, quota…) i feu **Rèplica → Configuració → Comprova la configuració**.
4. Seleccioneu la conversa i feu **Rèplica → Reactiva la conversa seleccionada…** → **Sí**. Torna a `ACTIVA` i, a la propera revisió (o amb **Revisa ara les respostes**), es respon als missatges pendents.

Si la resposta **sí** que s'havia enviat però el sistema no ho va poder confirmar, no la reactiveu: atureu-la amb **Atura la conversa seleccionada…**, per no duplicar-la. Només es poden reactivar les converses en `ERROR`.

Des de l'editor, cal passar l'identificador com a paràmetre. Afegiu temporalment al fitxer `Replica.gs`, al final (sense desar cap adreça):

```js
function reactivaAra() {
  reactivaConversa('ENGANXA_AQUI_L_ID_CONVERSA');
}
```

Executeu `reactivaAra` i després esborreu la funció. Per aturar-la, el mateix amb `tancaConversa('ID')`.

## Aturar una conversa a mà

Seleccioneu-la i feu **Rèplica → Atura la conversa seleccionada…** → **Sí** (`tancaConversa`). La conversa passa a `FINALITZADA` sense enviar cap comiat. És necessari, per exemple, per tornar a iniciar una simulació amb el mateix participant.

## Reobrir una conversa finalitzada

Seleccioneu-la i feu **Rèplica → Reobre la conversa seleccionada…**. El quadre pregunta quantes respostes més pot enviar la clienta: d'1 a 6, o en blanc per a 2. Feu **D'acord**.

- La conversa torna a `ACTIVA`, i la columna `max_torns_conversa` de Converses passa a ser les respostes que ja havia enviat més les noves. Aquest límit substitueix el `max_torns` de l'escenari només per a aquesta conversa.
- Els correus que el participant hagi enviat mentre era tancada es registren i es responen a la propera revisió, tots junts en una sola resposta.
- La clienta rep una indicació perquè reprengui la conversa amb naturalitat després del seu comiat. Pot tornar-la a tancar abans d'hora si no hi ha res nou a tractar. El darrer torn permès la tanca sempre, com en qualsevol conversa.
- No es pot reobrir si el participant té una altra conversa oberta del mateix escenari, ni si la seva adreça no està activa a Participants.
- Cal la columna `max_torns_conversa`: si falta, feu **Rèplica → Configuració → Prepara el full**.

Des de l'editor: `reobreConversa('ID')` (2 respostes més) o `reobreConversa('ID', 3)`, amb una funció temporal com la de l'apartat anterior.

## Revisió automàtica (disparador)

| Menú | Funció equivalent | Efecte |
| --- | --- | --- |
| **Revisió automàtica → Crea o actualitza** | `creaDisparador` | Crea la revisió amb l'interval de la pestanya **Configuració** (`interval_minuts`; per defecte 5). Elimina abans les existents: mai n'hi ha més d'una |
| Canviar `interval_minuts` a la pestanya | | 1, 5, 10, 15 o 30. S'aplica sol a la propera revisió automàtica. Feu servir 1 minut només durant demostracions: consumeix molta quota diària |
| **Revisió automàtica → Elimina…** | `eliminaDisparadors` | Elimina-la: no es revisarà més la bústia |

La revisió s'executa amb el compte de qui la va crear. Si la crea un altre compte, no llegeix ni envia res i ho registra com a error (a **Execucions**). També es poden veure i eliminar al menú **Activadors** (icona del rellotge) d'Apps Script.

## Clau de Gemini

**Rèplica → Configuració → Desa la clau de Gemini…** desa la clau al compte de prova, on no la veuen els altres editors del full, i l'esborra de les Propietats de l'script si hi era. Després en fa una comprovació amb Gemini. Per canviar-la (per exemple, si s'ha revocat), torneu a fer el mateix amb la clau nova.

## Desinstal·lar i esborrar dades

1. **Rèplica → Simulacions ACTIVADES · Atura-les totes…** i **Rèplica → Revisió automàtica → Elimina…**
2. **Revocar la clau de Gemini**: Google AI Studio → *API keys* → suprimir la clau.
3. **Esborrar les converses de prova**: al full, suprimiu les files (no la capçalera) de **Converses** i **Missatges**, o suprimiu tot el full de càlcul (amb el full s'esborra també el programa vinculat).
4. **Esborrar els correus**: a la bústia de prova, suprimiu els fils de la simulació (també a la Paperera). Els participants han d'esborrar els seus.
5. **Revocar els permisos** del projecte: <https://myaccount.google.com/permissions> → Rèplica → *Suprimeix l'accés*.
6. Opcionalment, suprimiu el compte de prova.

## Bones pràctiques

- Només docents voluntaris i dades inventades.
- Un sol coordinador amb accés al compte de prova; permís d'edició del full només per a persones de confiança (poden afegir participants).
- Pocs participants a la vegada i dades inventades: vegeu els límits de Gmail i de Gemini al [README, secció 7](../README.md#7-límits-de-gmail-i-de-gemini).
- No reenvieu correus de la simulació a altres persones: cada missatge d'un tercer dins del fil s'ignora, però queda a Gmail.
