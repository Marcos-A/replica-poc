# Escenaris

Un **escenari** és una situació de correspondència comercial: qui escriu el primer correu, de quina empresa, què li ha passat, què vol aconseguir i com reacciona. Cada escenari és una fila de la pestanya **Escenaris** del full.

## Escenaris inclosos

**Prepara el full** carrega aquests cinc escenaris d'exemple. Totes les dades són inventades.

| id | Títol | Personatge | Què practica el participant |
|----|-------|------------|-----------------------------|
| ESC-001 | Reclamació per un enviament incomplet | Marta Soler, responsable de compres | Disculpar-se i proposar una solució amb termini i compensació |
| ESC-002 | Discrepància en una factura | Albert Casals, administrador | Revisar imports, demanar documentació i proposar una factura rectificativa amb data |
| ESC-003 | Reclamació per un equip defectuós | Laura Vidal, propietària | Gestionar una urgència amb llenguatge planer i aplicar la garantia sense prometre de més |
| ESC-004 | Cancel·lació d'un servei amb penalització | Núria Ferrer, gerent | Explicar una clàusula, negociar una reducció i distingir entre proposta i compromís |
| ESC-005 | Negociació d'un pressupost comercial | David Roca, director d'operacions | Detectar necessitats i defensar el valor d'una oferta davant d'un preu més baix |

## Què fa cada columna

Les columnes marcades amb **IA** les llegeix Gemini per fer el paper del personatge. Les altres són només per al docent: el participant no les veu mai, i la IA tampoc.

| Columna | Qui la fa servir | Què hi va |
|---------|------------------|-----------|
| `id` | Programa | Identificador únic, per exemple `ESC-006`. No el canvieu un cop hi hagi converses. |
| `actiu` | Programa | Marcat: es pot enviar. Desmarcat: no surt a les activacions noves. |
| `titol` | Docent | Nom curt de l'escenari. |
| `interlocutor` | IA i signatura | **Nom Cognom, càrrec**, separats per una coma. El nom surt com a remitent del correu i, amb el càrrec, a la signatura de cada resposta. |
| `empresa` | IA i signatura | Nom de l'empresa del personatge. |
| `caracter` | IA | Com és i com reacciona: to, què li agrada, què li molesta, què el calma. |
| `incidencia` | IA | Els fets: què ha passat, amb xifres i referències. El personatge els pot fer servir lliurement. |
| `objectiu_interlocutor` | IA | Què vol aconseguir el personatge. |
| `limits_reservats` | IA | Allò que el personatge **no diu d'entrada**: fins on cedeix, com reacciona a cada tipus de proposta i quan tanca la conversa. Vegeu els consells. |
| `objectiu_participant` | Docent | Què ha de fer bé el participant. Hi podeu afegir dades internes de l'empresa del participant per donar-les-hi si voleu. |
| `criteris` | Docent | Què mirareu en revisar la conversa. |
| `idioma` | IA | `ca`, `es` o `en`. |
| `assumpte_inicial` | Correu | Assumpte del primer correu. |
| `missatge_inicial` | Correu | Text complet del primer correu, signatura inclosa. |
| `max_torns` | Programa | Nombre màxim de respostes del personatge (d'1 a 12). En blanc, el de la pestanya Configuració. |

## Afegir un escenari al full

1. A la pestanya **Escenaris**, copieu una fila semblant al que voleu i enganxeu-la a la primera fila buida.
2. Canvieu l'`id` per un de nou (per exemple, `ESC-006`) i reescriviu la resta de columnes.
3. Feu una prova amb vosaltres mateixos abans de fer-lo servir amb participants (secció 5 del README).

No cal fer res més: l'escenari surt a la llista de la pestanya **Activacions**.

## Consells per escriure'l

- **Escriviu `limits_reservats` com una llista numerada de reaccions**: «(1) Pagaria com a màxim 90 €, però no ho revela. (2) Si la primera oferta supera els 90 €, fa una contraproposta de 50 €…». Com més concreta sigui cada reacció, més coherent serà el personatge.
- **Les dades que el personatge només ha de donar si les hi demanen** comencen per «Si li pregunten…». Per exemple: «Si li pregunten per què li importa el termini, explica que obre un centre nou d'aquí a deu dies». Així el participant ha de fer la pregunta per obtenir-les.
- **Els imports i marges màxims no els revela mai**, encara que el participant els demani directament.
- **Digueu quan es tanca la conversa**: «Tanca la conversa quan tingui per escrit l'import final i la data de la baixa». Si no, el personatge pot allargar-la fins al màxim de respostes.
- **Premieu la bona comunicació**: indiqueu com canvia el to si el participant mostra empatia, explica les coses amb claredat o dona dades concretes, i què fa el personatge si rep evasives o tecnicismes.
- **Dates relatives, no del calendari**: «d'aquí a tres dies», «l'1 del mes vinent», «fa sis setmanes». Una data fixa deixa de tenir sentit el curs següent. Pel mateix motiu, els números de document no porten l'any (`FAC-1187`, no `FAC-2026-1187`).
- **La signatura del `missatge_inicial` ha de coincidir amb la de les respostes**: nom, càrrec (amb majúscula inicial) i empresa, un per línia. Si l'`interlocutor` és «Albert Casals, administrador», el correu inicial acaba amb `Albert Casals` / `Administrador` / `Distribucions Mediterrània SL`.
- **Sense espais al principi de les línies** del `missatge_inicial`: sortirien al correu.
- **Escenaris amb diverses fases** (primera oferta, contraproposta, confirmació per escrit…): poseu `max_torns` a 8 perquè hi càpiguen.
- **Només dades inventades**: ni noms d'empreses reals ni dades de persones reals.

## Escenaris nous en versions noves del programa

Quan actualitzeu el programa (secció 3.10 del README), **Prepara el full** afegeix els escenaris d'exemple que encara no teniu, pel seu `id`. **No modifica mai** una fila que ja hi és, encara que l'hàgiu editada.

Si voleu la versió nova d'un escenari d'exemple que ja teníeu:

1. Comproveu a la pestanya **Converses** que no en teniu cap conversa oberta.
2. Esborreu la fila de l'escenari a la pestanya **Escenaris** (clic dret al número de fila → **Suprimeix la fila**).
3. Feu **Rèplica** → **Configuració** → **Prepara el full**. El quadre dirà «Escenari afegit: ESC-…».

## Per a desenvolupadors

Els escenaris d'exemple són a la carpeta `escenaris/`, un fitxer JSON per escenari (`ESC-NNN.json`, amb les mateixes claus que les columnes de la pestanya). Per afegir-ne un:

1. Creeu `escenaris/ESC-NNN.json` (copieu-ne un altre com a model).
2. Executeu `npm run build`: genera `src/Escenaris.js` i `dist/Replica.gs`. No editeu cap d'aquests dos fitxers a mà.
3. Executeu `npm test`. `test/escenaris.test.js` comprova cada escenari: `id` únic i igual al nom del fitxer, totes les columnes, valors vàlids, `interlocutor` amb el format «Nom, càrrec», cap adreça electrònica, cap línia amb espais al principi o al final, i un `missatge_inicial` que acaba amb la mateixa signatura que les respostes.
