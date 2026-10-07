/*
 * Rastrear AgriFamiliar - funções comuns (formatação, máscaras, validação,
 * banco de dados local e utilidades). Reproduz as regras do sistema original
 * (core/templatetags/utils.py, core/utils.py, app lib/ui/validators.dart,
 * lib/ui/mask_formatter.dart e lib/utils/string_utils.dart).
 */
(function (window) {
  "use strict";

  var RA = (window.RA = window.RA || {});
  RA.config = window.RASTREAR_CONFIG || {};

  // Caminho base do site (permite publicar em subpasta): calculado a partir do
  // endereço deste arquivo (".../js/core.js").
  RA.base = (function () {
    var s = document.currentScript;
    if (s && s.src) {
      var p = new URL(s.src, window.location.href).pathname;
      return p.replace(/js\/core\.js.*$/, "");
    }
    return "/";
  })();

  RA.url = function (path) {
    return RA.base + String(path || "").replace(/^\//, "");
  };

  RA.siteDomain = function () {
    var d = RA.config.WEBSITE_DOMAIN;
    if (d) return d.replace(/\/$/, "");
    return window.location.origin + RA.base.replace(/\/$/, "");
  };

  // ------------------------------------------------------------------ utilidades
  RA.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) {
      return ("0" + x.toString(16)).slice(-2);
    }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  };

  RA.UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  RA.esc = function (v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  RA.clone = function (o) {
    return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  };

  RA.sleep = function (ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  };

  RA.param = function (name, search) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(search || window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  };

  RA.digits = function (v) {
    return v === null || v === undefined ? v : String(v).replace(/[^0-9]/g, "");
  };

  // core/utils.py remove_mask
  RA.removeMask = function (v) {
    if (v === null || v === undefined) return v;
    return String(v)
      .replace(/\./g, "")
      .replace(/\+/g, "")
      .replace(/\//g, "")
      .replace(/-/g, "")
      .replace(/\(/g, "")
      .replace(/\)/g, "")
      .replace(/ /g, "")
      .replace(/_/g, "");
  };

  // ------------------------------------------------------------------ datas
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  // Converte "AAAA-MM-DD" (data sem hora) ou ISO completo em Date local.
  RA.toDate = function (v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  RA.fmtDate = function (v) {
    var d = RA.toDate(v);
    if (!d) return "";
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
  };

  RA.fmtDateTime = function (v) {
    var d = RA.toDate(v);
    if (!d) return "";
    return RA.fmtDate(d) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  };

  // Data local "AAAA-MM-DD"
  RA.isoDate = function (d) {
    d = RA.toDate(d);
    if (!d) return null;
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };

  RA.today = function () {
    return RA.isoDate(new Date());
  };

  RA.nowISO = function () {
    return new Date().toISOString();
  };

  RA.addDays = function (d, days) {
    var x = new Date(RA.toDate(d).getTime());
    x.setDate(x.getDate() + days);
    return x;
  };

  // "dd/mm/aaaa" -> "aaaa-mm-dd"
  RA.parseBRDate = function (s) {
    var m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(s || "");
    if (!m) return null;
    var d = new Date(+m[3], +m[2] - 1, +m[1]);
    if (d.getFullYear() !== +m[3] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[1]) return null;
    return RA.isoDate(d);
  };

  // ------------------------------------------------------------------ números
  // NumberFormat.decimalPattern("pt_BR") do app (até 3 casas decimais)
  RA.fmtDecimal = function (v) {
    if (v === null || v === undefined || v === "") return "";
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(v)).trim();
  };

  // django intcomma (valor float em pt-br): 500.0 -> "500,0"; 1234.5 -> "1.234,5"
  RA.intcomma = function (v) {
    if (v === null || v === undefined || v === "") return "";
    var n = Number(v);
    var s = Number.isInteger(n) ? n.toFixed(1) : String(n);
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var parts = s.split(".");
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-" : "") + intPart + (parts.length > 1 ? "," + parts[1] : "");
  };

  // NumberUtils.parse do app
  RA.parseNumber = function (v) {
    if (v === null || v === undefined) return null;
    var n = Number(String(v).trim().replace(",", "."));
    return String(v).trim() === "" || isNaN(n) ? null : n;
  };

  RA.money = function (v) {
    return "R$ " + Number(v).toFixed(2).replace(".", ",");
  };

  // ------------------------------------------------------------------ CPF/CNPJ, CEP, telefone
  RA.fmtCPF = function (v) {
    v = String(v || "");
    return v.length === 11 ? v.slice(0, 3) + "." + v.slice(3, 6) + "." + v.slice(6, 9) + "-" + v.slice(9) : v;
  };

  RA.fmtCNPJ = function (v) {
    v = String(v || "");
    return v.length === 14
      ? v.slice(0, 2) + "." + v.slice(2, 5) + "." + v.slice(5, 8) + "/" + v.slice(8, 12) + "-" + v.slice(12)
      : v;
  };

  RA.fmtCpfCnpj = function (v) {
    var d = RA.digits(v || "");
    if (d.length === 14) return RA.fmtCNPJ(d);
    if (d.length === 11) return RA.fmtCPF(d);
    return v || "";
  };

  RA.fmtCEP = function (v) {
    v = String(v || "");
    return v.length === 8 ? v.slice(0, 2) + "." + v.slice(2, 5) + "-" + v.slice(5) : v;
  };

  RA.fmtPhone = function (v) {
    v = String(v || "");
    if (v.length === 10) return "(" + v.slice(0, 2) + ") " + v.slice(2, 6) + "-" + v.slice(6);
    if (v.length === 11) return "(" + v.slice(0, 2) + ") " + v.slice(2, 7) + "-" + v.slice(7);
    return v;
  };

  // mask_formatter.dart maskText
  RA.maskText = function (mask, value) {
    if (!value) return value;
    var vi = 0,
      out = "";
    for (var mi = 0; mi < mask.length; mi++) {
      var m = mask.charAt(mi);
      if (m !== "#") {
        out += m;
        continue;
      }
      out += value.charAt(vi);
      vi += 1;
      if (vi === value.length) break;
    }
    return out;
  };

  // CPFCNPJMaskFormatter.maskDigits
  RA.maskCpfCnpj = function (unmasked) {
    unmasked = RA.digits(unmasked || "");
    return RA.maskText(unmasked.length <= 11 ? "###.###.###-##" : "##.###.###/####-##", unmasked);
  };

  // validators.dart
  RA.isCPF = function (cpf) {
    if (cpf === null || cpf === undefined) return false;
    cpf = RA.digits(cpf);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    var sm = 0,
      peso = 10,
      i,
      r;
    for (i = 0; i < 9; i++) sm += +cpf.charAt(i) * peso--;
    r = 11 - (sm % 11);
    var d10 = r === 10 || r === 11 ? "0" : String(r);
    sm = 0;
    peso = 11;
    for (i = 0; i < 10; i++) sm += +cpf.charAt(i) * peso--;
    r = 11 - (sm % 11);
    var d11 = r === 10 || r === 11 ? "0" : String(r);
    return d10 === cpf.charAt(9) && d11 === cpf.charAt(10);
  };

  RA.isCNPJ = function (cnpj) {
    if (cnpj === null || cnpj === undefined) return false;
    var n = RA.digits(cnpj);
    if (n.length !== 14 || /^(\d)\1*$/.test(n)) return false;
    var d = n.split("").map(Number);
    var calc = function (len) {
      var w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      var s = 0;
      for (var i = 0; i < len; i++) s += d[i] * w[i];
      s %= 11;
      return s < 2 ? 0 : 11 - s;
    };
    return d[12] === calc(12) && d[13] === calc(13);
  };

  RA.isEmail = function (v) {
    return (
      !!v &&
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,253}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,253}[a-zA-Z0-9])?)*$/.test(
        v
      )
    );
  };

  RA.isDecimal = function (v) {
    return v !== null && v !== undefined && String(v).trim() !== "" && !isNaN(Number(String(v).replace(",", ".")));
  };

  // core/utils.py get_masked_email
  RA.maskEmail = function (email) {
    if (!email || email.indexOf("@") === -1) return email;
    var a = email.split("@")[0],
      dom = email.split("@")[1];
    return a.charAt(0) + new Array(Math.max(a.length - 1, 0)).join("*") + a.charAt(a.length - 1) + "@" + dom;
  };

  // ------------------------------------------------------------------ senha (PBKDF2)
  function b64(buf) {
    var s = "",
      bytes = new Uint8Array(buf);
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  RA.hashPassword = function (password, saltB64) {
    var salt;
    if (saltB64) {
      salt = Uint8Array.from(atob(saltB64), function (c) {
        return c.charCodeAt(0);
      });
    } else {
      salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
    }
    var enc = new TextEncoder();
    return crypto.subtle
      .importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
      .then(function (key) {
        return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: 120000 }, key, 256);
      })
      .then(function (bits) {
        return { hash: b64(bits), salt: b64(salt) };
      });
  };

  RA.checkPassword = function (password, user) {
    if (!user || !user.password_hash) return Promise.resolve(false);
    return RA.hashPassword(password || "", user.password_salt).then(function (r) {
      return r.hash === user.password_hash;
    });
  };

  // ------------------------------------------------------------------ imagens
  // Lê um arquivo de imagem e devolve um data URL reduzido (qualidade semelhante ao app: imageQuality 50).
  RA.readImage = function (file, maxSize, quality) {
    maxSize = maxSize || 1280;
    quality = quality || 0.8;
    return new Promise(function (resolve, reject) {
      if (!file) return resolve(null);
      var fr = new FileReader();
      fr.onerror = reject;
      fr.onload = function () {
        if (file.type === "image/svg+xml") return resolve(fr.result);
        var img = new Image();
        img.onerror = function () {
          resolve(fr.result);
        };
        img.onload = function () {
          var w = img.width,
            h = img.height,
            s = Math.min(1, maxSize / Math.max(w, h));
          var c = document.createElement("canvas");
          c.width = Math.round(w * s);
          c.height = Math.round(h * s);
          var ctx = c.getContext("2d");
          if (file.type === "image/png") {
            ctx.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/png"));
          } else {
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/jpeg", quality));
          }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };

  RA.fetchAsDataURL = function (url) {
    return fetch(url)
      .then(function (r) {
        return r.blob();
      })
      .then(function (blob) {
        return new Promise(function (resolve) {
          var fr = new FileReader();
          fr.onload = function () {
            resolve(fr.result);
          };
          fr.readAsDataURL(blob);
        });
      });
  };

  // ------------------------------------------------------------------ estados e cidades
  var statesPromise = null;
  RA.loadStates = function () {
    if (!statesPromise) {
      statesPromise = fetch(RA.url("assets/data/states.json"))
        .then(function (r) {
          return r.json();
        })
        .then(function (list) {
          return list
            .map(function (s) {
              return { id: s.abbreviation, abbreviation: s.abbreviation, name: s.name, cities: s.cities };
            })
            .sort(function (a, b) {
              return a.name.localeCompare(b.name, "pt-BR");
            });
        });
    }
    return statesPromise;
  };

  RA.cityId = function (stateAbbr, cityName) {
    return stateAbbr + ":" + cityName;
  };

  RA.cityName = function (cityId) {
    return cityId ? String(cityId).split(":").slice(1).join(":") : "";
  };

  // ------------------------------------------------------------------ banco de dados local (IndexedDB)
  var DB_NAME = "rastrear_agrifamiliar";
  var DB_VERSION = 1;
  RA.STORES = [
    "users",
    "farmer_profiles",
    "subscriptions",
    "transactions",
    "farms",
    "technical_managers",
    "certificate_types",
    "certificates",
    "units",
    "products",
    "batches",
    "batch_tags",
    "farm_journals",
    "fertilizing_entries",
    "pesticide_entries",
    "harvest_entries",
    "postharvest_entries",
    "offline_batch_tag_cache",
    "meta"
  ];

  var dbPromise = null;
  var memory = null; // fallback se IndexedDB não existir (navegação privada antiga)

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      if (!window.indexedDB) {
        memory = {};
        return resolve(null);
      }
      var req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        memory = {};
        return resolve(null);
      }
      req.onupgradeneeded = function () {
        var db = req.result;
        RA.STORES.forEach(function (s) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
        });
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        memory = {};
        resolve(null);
      };
    });
    return dbPromise;
  }

  function memStore(name) {
    memory[name] = memory[name] || {};
    return memory[name];
  }

  function tx(store, mode, fn) {
    return openDB().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var os = t.objectStore(store);
        var result;
        Promise.resolve(fn(os)).then(function (r) {
          result = r;
        });
        t.oncomplete = function () {
          resolve(result);
        };
        t.onerror = function () {
          reject(t.error);
        };
        t.onabort = function () {
          reject(t.error);
        };
      });
    });
  }

  function reqP(r) {
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () {
        resolve(r.result);
      };
      r.onerror = function () {
        reject(r.error);
      };
    });
  }

  RA.db = {
    all: function (store) {
      return openDB().then(function (db) {
        if (!db) {
          var m = memStore(store);
          return Object.keys(m).map(function (k) {
            return RA.clone(m[k]);
          });
        }
        return reqP(db.transaction(store, "readonly").objectStore(store).getAll());
      });
    },
    get: function (store, id) {
      if (id === null || id === undefined || id === "") return Promise.resolve(null);
      return openDB().then(function (db) {
        if (!db) return RA.clone(memStore(store)[id]) || null;
        return reqP(db.transaction(store, "readonly").objectStore(store).get(id)).then(function (r) {
          return r || null;
        });
      });
    },
    put: function (store, obj) {
      return openDB().then(function (db) {
        if (!db) {
          memStore(store)[obj.id] = RA.clone(obj);
          return obj;
        }
        return reqP(db.transaction(store, "readwrite").objectStore(store).put(obj)).then(function () {
          return obj;
        });
      });
    },
    putMany: function (store, list) {
      return tx(store, "readwrite", function (os) {
        list.forEach(function (o) {
          if (os) os.put(o);
          else memStore(store)[o.id] = RA.clone(o);
        });
        return list;
      });
    },
    del: function (store, id) {
      return openDB().then(function (db) {
        if (!db) {
          delete memStore(store)[id];
          return true;
        }
        return reqP(db.transaction(store, "readwrite").objectStore(store).delete(id)).then(function () {
          return true;
        });
      });
    },
    clearAll: function () {
      return openDB().then(function (db) {
        if (!db) {
          memory = {};
          return true;
        }
        return Promise.all(
          RA.STORES.map(function (s) {
            return reqP(db.transaction(s, "readwrite").objectStore(s).clear());
          })
        );
      });
    }
  };

  // ------------------------------------------------------------------ busca (FirestoreOfflineSearch do app)
  RA.matchSearch = function (search, values) {
    if (!search || !String(search).trim()) return true;
    var keywords = String(search).toLowerCase().trim().split(/\s+/);
    return keywords.every(function (k) {
      return values.some(function (v) {
        return String(v || "").toLowerCase().indexOf(k) !== -1;
      });
    });
  };

  // ------------------------------------------------------------------ QR Code
  // Usa a biblioteca qrcode-generator (MIT), carregada da cdnjs.
  // Servidor original: pyqrcode (correção de erro "H", escala 5, margem de 4 módulos).
  RA.qrDataURL = function (text, cellSize, level) {
    if (!window.qrcode) return "";
    cellSize = cellSize || 5;
    var qr = window.qrcode(0, level || "H");
    qr.addData(text);
    qr.make();
    return qr.createDataURL(cellSize, 4 * cellSize);
  };

  // App original: qr_flutter (correção de erro "L", sem margem).
  RA.qrSVG = function (text, level, margin) {
    if (!window.qrcode) return "";
    var qr = window.qrcode(0, level || "L");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: margin || 0, scalable: true });
  };

  RA.QRCODE_JS = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";

  // ------------------------------------------------------------------ URLs públicas
  RA.batchTagURL = function (id) {
    return RA.siteDomain() + "/etiqueta/" + id + "/";
  };
  RA.batchTagPrintURL = function (id) {
    return RA.siteDomain() + "/etiqueta/imprimir/" + id + "/";
  };
  RA.farmJournalPrintURL = function (id) {
    return RA.siteDomain() + "/cadernos/imprimir/" + id + "/";
  };
  RA.checkURL = function () {
    return RA.siteDomain() + "/consulta/";
  };

  // Lê o identificador de uma URL "/etiqueta/<id>/" ou "?id=<id>"
  RA.idFromPath = function (prefix) {
    var q = RA.param("id");
    if (q) return q;
    var path = window.location.pathname;
    var i = path.indexOf(prefix);
    if (i === -1) return null;
    var rest = path.slice(i + prefix.length).split("/")[0];
    return rest || null;
  };
})(window);
