/**
 * Entorn de prova: carrega els fitxers de src/ dins d'un context vm amb
 * dobles de prova de Google Apps Script (Sheets, Gmail, Properties, Lock,
 * UrlFetch...). No es fa cap crida real ni s'envia cap correu.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DIR_SRC = path.join(__dirname, '..', 'src');
const BUSTIA = 'bustia.prova@example.org';

// ----------------------------------------------------------- Sheets

class FalsRang {
  constructor(full, fila, col, nf, nc) {
    Object.assign(this, { full, fila, col, nf, nc });
  }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nf; i++) {
      const fila = [];
      for (let j = 0; j < this.nc; j++) {
        let v = (this.full.dades[this.fila - 1 + i] || [])[this.col - 1 + j];
        if (v === undefined) v = '';
        if (typeof v === 'string' && v.startsWith("'")) v = v.slice(1);
        fila.push(v);
      }
      out.push(fila);
    }
    return out;
  }
  setValues(valors) {
    if (valors.length !== this.nf || valors[0].length !== this.nc) throw new Error('Mida de rang incorrecta');
    if (this.fila - 1 + this.nf > this.full.maxFiles) throw new Error('Rang fora dels límits del full');
    for (let i = 0; i < this.nf; i++) {
      while (this.full.dades.length < this.fila + i) this.full.dades.push([]);
      for (let j = 0; j < this.nc; j++) {
        const v = valors[i][j];
        if (typeof v === 'string' && v.startsWith('=')) throw new Error('Fórmula injectada: ' + v);
        this.full.dades[this.fila - 1 + i][this.col - 1 + j] = v;
      }
    }
    return this;
  }
  setNumberFormat() { return this; }
  setDataValidation(regla) { this.full.validacions[`${this.fila},${this.col}`] = regla; return this; }
}

class FalsFull {
  constructor(nom) { this.nom = nom; this.dades = []; this.maxFiles = 1000; this.validacions = {}; }
  getName() { return this.nom; }
  getLastRow() {
    for (let i = this.dades.length - 1; i >= 0; i--) {
      if ((this.dades[i] || []).some((v) => v !== '' && v !== undefined)) return i + 1;
    }
    return 0;
  }
  getLastColumn() {
    let max = 0;
    this.dades.forEach((f) => f.forEach((v, j) => { if (v !== '' && v !== undefined) max = Math.max(max, j + 1); }));
    return max;
  }
  getMaxRows() { return this.maxFiles; }
  insertRowsAfter(_fila, n) { this.maxFiles += n; }
  getRange(fila, col, nf = 1, nc = 1) {
    if (typeof fila === 'string') return { a1: fila, full: this.nom };
    return new FalsRang(this, fila, col, nf, nc);
  }
  getDataRange() {
    return new FalsRang(this, 1, 1, Math.max(this.getLastRow(), 0), Math.max(this.getLastColumn(), 1));
  }
  setFrozenRows() {}
  /** Ajuda de prova: files com a objectes. */
  objectes() {
    const [cap, ...files] = this.dades;
    return files.filter((f) => f && f.some((v) => v !== '')).map((f) =>
      Object.fromEntries(cap.map((c, j) => [c, f[j] === undefined ? '' : String(f[j]).replace(/^'/, '')])));
  }
}

class FalsLlibre {
  constructor() { this.fulls = new Map(); }
  getSheetByName(nom) { return this.fulls.get(nom) || null; }
  insertSheet(nom) { const f = new FalsFull(nom); this.fulls.set(nom, f); return f; }
  getSheets() { return [...this.fulls.values()]; }
  deleteSheet(full) {
    if (this.fulls.size === 1) throw new Error('No es pot eliminar l\'única pestanya');
    this.fulls.delete(full.getName());
  }
}

// ------------------------------------------------------------ Gmail

class FalsMissatge {
  constructor(gmail, fil, d) {
    this.gmail = gmail; this.fil = fil;
    Object.assign(this, { id: d.id, from: d.from, to: d.to, cos: d.cos, data: d.data, assumpte: d.assumpte,
      capcaleres: d.capcaleres || {}, esborrany: false });
  }
  getId() { return this.id; }
  getFrom() { return this.from; }
  getTo() { return this.to; }
  getPlainBody() { return this.cos; }
  getDate() { return this.data; }
  getSubject() { return this.assumpte; }
  getHeader(nom) { return this.capcaleres[nom] || ''; }
  isDraft() { return this.esborrany; }
  isInTrash() { return false; }
  getThread() { return this.fil; }
  createDraftReply(cos, opcions) {
    const gmail = this.gmail; const fil = this.fil; const origen = this;
    return {
      send() {
        if (gmail.fallaEnviament === 'abans') throw new Error('Error de servei de Gmail');
        const m = fil.afegeix({
          from: `${opcions.name} <${BUSTIA}>`, to: origen.from, cos,
          assumpte: 'Re: ' + fil.missatges[0].assumpte
        });
        gmail.enviats.push({ tipus: 'resposta', fil: fil.id, cos, nom: opcions.name, a: origen.from });
        if (gmail.fallaEnviament === 'despres') throw new Error('Temps d\'espera esgotat');
        return m;
      }
    };
  }
}

class FalsFil {
  constructor(gmail, id) { this.gmail = gmail; this.id = id; this.missatges = []; }
  getId() { return this.id; }
  getMessages() { return this.missatges.slice(); }
  afegeix(d) {
    const m = new FalsMissatge(this.gmail, this, Object.assign({
      id: 'msg' + (++this.gmail.comptador).toString(16) + 'e5', data: this.gmail.ara()
    }, d));
    this.missatges.push(m);
    return m;
  }
}

class FalsGmail {
  constructor() {
    this.fils = new Map(); this.enviats = []; this.comptador = 0; this.lectures = 0;
    this.rellotge = Date.now() - 60 * 60 * 1000;
    this.fallaEnviament = null;
  }
  ara() { this.rellotge = Math.max(this.rellotge + 1000, Date.now()); return new Date(this.rellotge); }
  createDraft(a, assumpte, cos, opcions) {
    const gmail = this;
    return {
      send() {
        if (gmail.fallaEnviament === 'abans') throw new Error('Error de servei de Gmail');
        const fil = new FalsFil(gmail, 'fil' + (++gmail.comptador));
        gmail.fils.set(fil.id, fil);
        const m = fil.afegeix({ from: `${opcions.name} <${BUSTIA}>`, to: a, cos, assumpte });
        gmail.enviats.push({ tipus: 'inicial', fil: fil.id, cos, assumpte, nom: opcions.name, a });
        if (gmail.fallaEnviament === 'despres') throw new Error('Temps d\'espera esgotat');
        return m;
      }
    };
  }
  getThreadById(id) { this.lectures++; return this.fils.get(id) || null; }
  getAliases() { return []; }
  getInboxUnreadCount() { return 0; }
  search(consulta) {
    const resultat = [];
    for (const fil of this.fils.values()) {
      if (fil.missatges.some((m) => consulta.includes('to:' + m.to))) resultat.push(fil);
    }
    return resultat;
  }
  /** Simula que algú respon al fil. */
  respon(filId, from, cos, extra = {}) {
    const fil = this.fils.get(filId);
    return fil.afegeix(Object.assign({ from, to: BUSTIA, cos, assumpte: 'Re: ' + fil.missatges[0].assumpte }, extra));
  }
}

// ----------------------------------------------------------- Context

function respostaGemini(resposta, finalitzada = false) {
  return {
    codi: 200,
    cos: JSON.stringify({
      id: 'int_1', status: 'completed',
      steps: [{ type: 'model_output', status: 'done',
        content: [{ type: 'text', text: JSON.stringify({ resposta, finalitzada }) }] }]
    })
  };
}

const TEXT_RESPOSTA = 'Bon dia,\n\nGràcies per la resposta. Necessito que em confirmeu per escrit la data de lliurament.\n\nAtentament,\nMarta Soler\nFerreteria Soler SL';

function creaEntorn(opcions = {}) {
  const propietats = Object.assign({
    GEMINI_API_KEY: 'AIzaFALSAfalsaFALSAfalsa1234567890',
    GEMINI_MODEL: 'gemini-model-de-prova',
    SPREADSHEET_ID: 'full-de-prova',
    ALLOWED_SENDERS: 'docent.a@example.org, docent.b@example.org',
    SIMULATION_ENABLED: 'true'
  }, opcions.propietats || {});
  const llibre = new FalsLlibre();
  const gmail = new FalsGmail();
  const peticions = [];
  const registres = [];
  const disparadors = [];
  const estat = { bloqueigOcupat: false, uuid: 0, respostesIA: [] };

  const respostaPerDefecte = () => respostaGemini(TEXT_RESPOSTA, false);

  const context = {
    console: {
      log: (l) => registres.push(l), warn: (l) => registres.push(l), error: (l) => registres.push(l)
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in propietats ? propietats[k] : null),
        setProperty: (k, v) => { propietats[k] = v; }
      })
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { if (estat.bloqueigOcupat) return false; estat.bloqueigOcupat = true; return true; },
        releaseLock: () => { estat.bloqueigOcupat = false; }
      })
    },
    SpreadsheetApp: {
      openById: (id) => { if (id !== 'full-de-prova') throw new Error('No es troba el full'); return llibre; },
      flush: () => {},
      newDataValidation: () => {
        const regla = {};
        const b = {
          requireValueInList: (llista) => { regla.llista = llista; return b; },
          requireValueInRange: (rang) => { regla.rang = rang; return b; },
          requireNumberBetween: (min, max) => { regla.entre = [min, max]; return b; },
          setAllowInvalid: () => b,
          setHelpText: () => b,
          build: () => regla
        };
        return b;
      }
    },
    GmailApp: gmail,
    Session: { getEffectiveUser: () => ({ getEmail: () => BUSTIA }) },
    Utilities: { getUuid: () => 'uuid-' + (++estat.uuid) },
    UrlFetchApp: {
      fetch: (url, o) => {
        peticions.push({ url, opcions: o, cos: o.payload ? JSON.parse(o.payload) : null });
        if (o.method === 'get') return { getResponseCode: () => 200, getContentText: () => '{}' };
        const r = estat.respostesIA.length ? estat.respostesIA.shift() : respostaPerDefecte();
        if (r instanceof Error) throw r;
        return { getResponseCode: () => r.codi, getContentText: () => r.cos };
      }
    },
    ScriptApp: {
      getProjectTriggers: () => disparadors.slice(),
      deleteTrigger: (t) => disparadors.splice(disparadors.indexOf(t), 1),
      newTrigger: (funcio) => ({ timeBased: () => ({ everyMinutes: (minuts) => ({
        create: () => disparadors.push({ getHandlerFunction: () => funcio, minuts })
      }) }) })
    },
    Date, JSON, Math, Object, Array, String, Number, Error, RegExp
  };
  vm.createContext(context);
  const codi = fs.readdirSync(DIR_SRC).filter((f) => f.endsWith('.js')).sort()
    .map((f) => fs.readFileSync(path.join(DIR_SRC, f), 'utf8')).join('\n;\n');
  vm.runInContext(codi, context, { filename: 'src-concatenat.js' });

  const g = context;
  return {
    g, llibre, gmail, peticions, registres, propietats, estat, disparadors,
    full: (nom) => llibre.getSheetByName(nom),
    converses: () => llibre.getSheetByName('Converses').objectes(),
    missatges: () => llibre.getSheetByName('Missatges').objectes(),
    respostesIA: (...r) => estat.respostesIA.push(...r),
    /** Canvia una cel·la de la pestanya Configuració, com ho faria el docent. */
    configura: (clau, valor) => {
      const full = llibre.getSheetByName('Configuració');
      const fila = full.dades.find((f) => f[0] === clau);
      fila[1] = valor;
    },
    parametre: (clau) => (llibre.getSheetByName('Configuració').dades.find((f) => f[0] === clau) || [])[1],
    peticionsIA: () => peticions.filter((p) => p.url.endsWith('/interactions'))
  };
}

module.exports = { creaEntorn, respostaGemini, BUSTIA, TEXT_RESPOSTA };
