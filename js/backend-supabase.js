/*
 * Rastrear AgriFamiliar - ligação com o Supabase.
 *
 * Com RASTREAR_CONFIG.BACKEND = "supabase" este arquivo troca o banco local do
 * navegador (RA.db) pelas tabelas do Supabase, que têm os mesmos nomes do banco
 * original em Django, e as funções de conta (login, cadastro, senhas,
 * administradores e assinatura) pelas do servidor:
 *   - tabelas: protegidas por Row Level Security (cada produtor só vê os seus dados);
 *   - imagens: bucket "media" do Supabase Storage (mesmas pastas do MEDIA original);
 *   - login: Supabase Auth com CPF/CNPJ e senha;
 *   - cadastro, senhas e administradores: Edge Function "contas";
 *   - assinatura, etiqueta e caderno públicos: funções do banco (supabase.rpc).
 * As regras de negócio (validações e mensagens) continuam em js/api.js.
 */
(function (window) {
  "use strict";

  var RA = window.RA;
  var cfg = RA.config || {};
  var api = RA.api;
  if (cfg.BACKEND !== "supabase") return;

  api.backend = "supabase";
  var ValidationError = api.ValidationError;

  if (!window.supabase || !window.supabase.createClient) {
    console.error("A biblioteca do Supabase não foi carregada.");
    api.ready = function () {
      return Promise.reject(new Error("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."));
    };
    return;
  }

  var SB_URL = String(cfg.SUPABASE_URL || "").replace(/\/+$/, "");
  var SB_KEY = cfg.SUPABASE_KEY;
  var AUTH_DOMAIN = "cpf.rastrear.invalid";
  var MEDIA = SB_URL + "/storage/v1/object/public/media/";
  var PAGE = 1000; // linhas por requisição (limite do PostgREST)
  var CACHE_MS = 3000; // uma tela costuma pedir as mesmas tabelas várias vezes seguidas
  var original = { getBatchTag: api.getBatchTag, getFarmJournal: api.getFarmJournal };

  // ------------------------------------------------------------------ clientes
  // Painel e cadastro usam a sessão "admin"; o aplicativo tem a sua ("app"), como no
  // original (sessão do Django x token do aplicativo). Páginas públicas não usam sessão.
  var path = window.location.pathname;
  var SCOPE = cfg.SUPABASE_SCOPE || (/\/app\//.test(path) ? "app" : /\/(admin|cadastro)\//.test(path) ? "admin" : "public");
  var clients = {};

  function nativeFetch() {
    return (RA.local && RA.local.originalFetch) || window.fetch.bind(window);
  }

  function client(scope) {
    scope = scope || SCOPE;
    if (!clients[scope]) {
      var auth =
        scope === "public"
          ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
          : { storageKey: "ra-auth-" + scope, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false };
      var f = nativeFetch();
      clients[scope] = window.supabase.createClient(SB_URL, SB_KEY, {
        auth: auth,
        global: {
          fetch: function () {
            return f.apply(window, arguments);
          }
        }
      });
    }
    return clients[scope];
  }
  RA.supabase = client;

  // ------------------------------------------------------------------ erros
  function dbError(err) {
    if (!err) return new Error("Ocorreu um erro.");
    var e = new Error(err.message || err.error_description || "Ocorreu um erro.");
    e.code = err.code;
    e.details = err.details;
    e.hint = err.hint;
    e.status = err.status || err.statusCode;
    return e;
  }

  function permissionError() {
    var e = new Error("Você não tem permissão para alterar este registro.");
    e.code = "42501";
    return e;
  }

  function protectedError(linked) {
    var pe = new ValidationError({ __all__: ["protected"] });
    pe.protected = true;
    pe.linked = linked;
    return pe;
  }

  // ------------------------------------------------------------------ imagens (Storage "media")
  function mediaUrl(v) {
    if (!v) return null;
    v = String(v);
    if (/^(data:|blob:|https?:\/\/)/.test(v)) return v;
    if (v.indexOf("site:") === 0) return RA.url(v.slice(5)); // arquivo do próprio site
    return MEDIA + v.split("/").map(encodeURIComponent).join("/");
  }

  // Endereço mostrado na tela -> caminho gravado no banco
  function storedPath(v) {
    v = String(v);
    if (v.indexOf(MEDIA) === 0) return v.slice(MEDIA.length).split("/").map(decodeURIComponent).join("/");
    if (!/^[a-z]+:/i.test(v) && v.indexOf(RA.base) === 0 && v.length > RA.base.length) return "site:" + v.slice(RA.base.length);
    return v;
  }

  function baseName(v) {
    return String(v || "").split(/[\\/]/).pop();
  }

  function imageToLocal(o, field, nameStyle) {
    var v = o[field];
    var name = v ? (String(v).indexOf("site:") === 0 ? String(v).slice(5) : String(v)) : null;
    o[field + "_name"] = name && nameStyle === "base" ? baseName(name) : name;
    o[field] = mediaUrl(v);
  }

  var EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

  function dataUrlToBlob(u) {
    var m = /^data:([^;,]*)(;base64)?,(.*)$/.exec(u);
    if (!m) throw new Error("Imagem inválida.");
    var bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] || "application/octet-stream" });
  }

  // django get_valid_filename (sem acentos: o Storage só aceita letras simples)
  function safeFileName(name, mime) {
    name = baseName(name).trim().replace(/\s+/g, "_");
    if (name.normalize) name = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
    name = name.replace(/[^-\w.]/g, "");
    var m = /^(.*?)(?:\.([^.]*))?$/.exec(name);
    var base = (m && m[1]) || "imagem";
    var cur = m && m[2] ? m[2].toLowerCase() : "";
    var ext = EXT[mime];
    if (ext && cur !== ext && !(ext === "jpg" && cur === "jpeg")) return base + "." + ext;
    return cur ? base + "." + cur : base;
  }

  function randomString(n) {
    var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return Array.prototype.map
      .call(b, function (x) {
        return chars[x % chars.length];
      })
      .join("");
  }

  // Envia a imagem; se o nome já existir, acrescenta 7 letras como o Django faz
  function upload(folder, name, dataUrl) {
    var blob = dataUrlToBlob(dataUrl);
    function attempt(fileName, n) {
      var p = folder + fileName;
      return client()
        .storage.from("media")
        .upload(p, blob, { contentType: blob.type, upsert: false, cacheControl: "31536000" })
        .then(function (r) {
          if (!r.error) return p;
          var msg = String(r.error.message || "") + " " + String(r.error.statusCode || r.error.status || "");
          if (n < 3 && /exist|duplicate|409/i.test(msg)) {
            return attempt(
              fileName.replace(/(\.[^.]*)?$/, function (ext) {
                return "_" + randomString(7) + (ext || "");
              }),
              n + 1
            );
          }
          throw dbError(r.error);
        });
    }
    return attempt(safeFileName(name || "imagem", blob.type), 0);
  }

  // Valor do campo de imagem -> caminho no banco (enviando o arquivo quando é novo)
  function imageToRemote(folderOf, obj, field) {
    var v = obj[field];
    if (!v) return Promise.resolve(null);
    if (String(v).indexOf("data:") !== 0) return Promise.resolve(storedPath(v));
    return Promise.resolve(folderOf(obj)).then(function (folder) {
      return upload(folder, baseName(obj[field + "_name"]) || "imagem", v);
    });
  }

  // ------------------------------------------------------------------ estados, cidades e propriedades
  var stateIds = null;
  function stateUuid(abbr) {
    if (!abbr) return Promise.resolve(null);
    if (!stateIds) {
      stateIds = client()
        .from("farmers_state")
        .select("id,abbreviation")
        .then(function (r) {
          if (r.error) throw dbError(r.error);
          var m = {};
          r.data.forEach(function (s) {
            m[s.abbreviation] = s.id;
          });
          return m;
        });
      stateIds.catch(function () {
        stateIds = null;
      });
    }
    return stateIds.then(function (m) {
      if (!m[abbr]) throw new Error("Estado não encontrado: " + abbr);
      return m[abbr];
    });
  }

  var cityIds = {};
  function cityUuid(code) {
    if (!code) return Promise.resolve(null);
    if (!cityIds[code]) {
      cityIds[code] = client()
        .from("farmers_city")
        .select("id")
        .eq("code", code)
        .maybeSingle()
        .then(function (r) {
          if (r.error) throw dbError(r.error);
          if (!r.data) throw new Error("Cidade não encontrada: " + code);
          return r.data.id;
        });
      cityIds[code].catch(function () {
        delete cityIds[code];
      });
    }
    return cityIds[code];
  }

  function farmProfileId(farmId) {
    return client()
      .from("farmers_farm")
      .select("farmer_profile_id")
      .eq("id", farmId)
      .maybeSingle()
      .then(function (r) {
        if (r.error) throw dbError(r.error);
        if (!r.data) throw new Error("Propriedade não encontrada.");
        return r.data.farmer_profile_id;
      });
  }

  // ------------------------------------------------------------------ tabelas
  var JOURNAL_COLS = [
    "id", "creation_date", "field_identification", "farm_id", "total_hectares", "last_cultural_method",
    "plantation_date", "harvest_date", "has_subsolagem", "has_aracao", "has_enxada_rotativa", "has_gradagem_leve",
    "has_gradagem_pesada", "has_gradagem_niveladora", "extra_soil_preparation_operation", "is_practice_not_required",
    "has_plantio_nivel", "has_terracos", "has_rotacao_culturas", "has_adubacao_verde", "has_plantio_direto",
    "extra_soil_preparation_practice", "has_origem_propria", "origem_terceiros", "has_tratamento_termico",
    "irrigation_method", "water_source", "polygon"
  ];

  // write: "upsert" (padrão), "update" (só altera colunas liberadas), "insert" (só inclui) ou "none"
  var STORES = {
    users: {
      table: "accounts_user",
      write: "update",
      cols: ["name", "email", "cpf_cnpj", "person_type", "avatar"],
      images: {
        avatar: function (o) {
          return "avatar_images/" + o.id + "/";
        }
      }
    },
    farmer_profiles: {
      table: "farmers_farmerprofile",
      write: "update",
      cols: ["telephone", "description", "logo_image", "profile_image", "birth_date"],
      images: {
        logo_image: function (o) {
          return "farmers/logos/" + o.id + "/";
        },
        profile_image: function (o) {
          return "farmers/profile-images/" + o.id + "/";
        }
      }
    },
    subscriptions: { table: "subscriptions_subscription", write: "none" },
    transactions: { table: "subscriptions_transaction", write: "none" },
    farms: {
      table: "farmers_farm",
      select: "*,city:farmers_city(code),state:farmers_state(abbreviation)",
      cols: ["id", "farmer_profile_id", "name", "street", "number", "neighborhood", "extra", "city_id", "state_id", "latitude", "longitude", "zip_code", "ccir", "total_hectares"]
    },
    technical_managers: { table: "farmers_technicalmanager", cols: ["id", "farmer_profile_id", "name", "number", "number_type"] },
    certificate_types: {
      table: "farmers_certificatetype",
      cols: ["id", "name", "alert_message", "is_active", "certificate_logo"],
      images: {
        certificate_logo: function (o) {
          return "certificates/logos/cert_" + o.id + "/";
        }
      },
      imageNames: "base"
    },
    certificates: { table: "farmers_certificate", cols: ["id", "farmer_profile_id", "certifier", "number", "certificate_type_id", "valid_until_date"] },
    units: { table: "products_unit", cols: ["id", "name", "symbol"] },
    products: { table: "products_product", cols: ["id", "name", "variety"] },
    batches: {
      table: "products_batch",
      select: "*,links:products_batch_certificates(id,certificate_id)",
      cols: ["id", "farm_id", "product_id", "unit_id", "technical_manager_id", "number", "harvest_date", "image"],
      m2m: { field: "certificate_ids", table: "products_batch_certificates", fk: "batch_id", other: "certificate_id" },
      images: {
        image: function (o) {
          return farmProfileId(o.farm_id).then(function (pid) {
            return "products/batch-images/" + pid + "/";
          });
        }
      }
    },
    // date: auto_now_add (gravada pelo banco)
    batch_tags: { table: "products_batchtag", write: "insert", cols: ["id", "batch_id", "amount"] },
    farm_journals: {
      table: "farm_journals_farmjournal",
      select: "*,links:farm_journals_farmjournal_products(id,product_id)",
      cols: JOURNAL_COLS,
      m2m: { field: "product_ids", table: "farm_journals_farmjournal_products", fk: "farmjournal_id", other: "product_id" }
    },
    fertilizing_entries: {
      table: "farm_journals_fertilizingentry",
      cols: ["id", "farm_journal_id", "application_date", "formula_name", "dose", "unity", "application_method", "application_responsible", "note"]
    },
    pesticide_entries: {
      table: "farm_journals_pesticideentry",
      cols: ["id", "farm_journal_id", "date", "grace_period", "target_disease", "product_name", "dose", "volume", "operator"]
    },
    harvest_entries: { table: "farm_journals_harvestentry", cols: ["id", "farm_journal_id", "date", "amount", "destination", "responsible"] },
    postharvest_entries: {
      table: "farm_journals_postharvestentry",
      cols: ["id", "farm_journal_id", "date", "product_name", "dose", "grace_period", "responsible"]
    },
    offline_batch_tag_cache: { table: "products_offlinebatchtagcache", write: "insert", cols: ["id", "data"] }
  };

  function toLocal(store, row) {
    var def = STORES[store];
    if (store === "farms") {
      row.city_id = row.city ? row.city.code : null;
      row.state_id = row.state ? row.state.abbreviation : null;
      delete row.city;
      delete row.state;
    }
    if (def.m2m) {
      row[def.m2m.field] = (row.links || [])
        .slice()
        .sort(function (a, b) {
          return a.id - b.id;
        })
        .map(function (l) {
          return l[def.m2m.other];
        });
      delete row.links;
    }
    Object.keys(def.images || {}).forEach(function (field) {
      imageToLocal(row, field, def.imageNames);
    });
    return row;
  }

  function toRemote(store, obj) {
    var def = STORES[store];
    var row = {};
    def.cols.forEach(function (k) {
      if (obj[k] !== undefined) row[k] = obj[k];
    });
    var tasks = [];
    Object.keys(def.images || {}).forEach(function (field) {
      if (!(field in row)) return;
      tasks.push(
        imageToRemote(def.images[field], obj, field).then(function (v) {
          row[field] = v;
        })
      );
    });
    if (store === "farms") {
      tasks.push(
        cityUuid(obj.city_id).then(function (v) {
          row.city_id = v;
        })
      );
      tasks.push(
        stateUuid(obj.state_id).then(function (v) {
          row.state_id = v;
        })
      );
    }
    return Promise.all(tasks).then(function () {
      return row;
    });
  }

  // ManyToMany: remove os vínculos que saíram e inclui os novos (como related_manager.set).
  // Sem a lista (undefined), só lê os vínculos atuais.
  function syncLinks(spec, ownerId, wanted) {
    var c = client();
    var readOnly = wanted === undefined;
    wanted = (wanted || []).filter(function (v, i, a) {
      return v && a.indexOf(v) === i;
    });
    return c
      .from(spec.table)
      .select("id," + spec.other)
      .eq(spec.fk, ownerId)
      .then(function (r) {
        if (r.error) throw dbError(r.error);
        var have = r.data;
        if (readOnly) return have;
        var remove = have
          .filter(function (l) {
            return wanted.indexOf(l[spec.other]) === -1;
          })
          .map(function (l) {
            return l.id;
          });
        var haveIds = have.map(function (l) {
          return l[spec.other];
        });
        var add = wanted.filter(function (v) {
          return haveIds.indexOf(v) === -1;
        });
        var step = remove.length
          ? c
              .from(spec.table)
              .delete()
              .in("id", remove)
              .then(function (d) {
                if (d.error) throw dbError(d.error);
              })
          : Promise.resolve();
        return step
          .then(function () {
            if (!add.length) return null;
            return c
              .from(spec.table)
              .insert(
                add.map(function (v) {
                  var o = {};
                  o[spec.fk] = ownerId;
                  o[spec.other] = v;
                  return o;
                })
              )
              .then(function (i) {
                if (i.error) throw dbError(i.error);
              });
          })
          .then(function () {
            return c.from(spec.table).select("id," + spec.other).eq(spec.fk, ownerId);
          })
          .then(function (f) {
            if (f.error) throw dbError(f.error);
            return f.data;
          });
      });
  }

  // ------------------------------------------------------------------ cache curto
  var cache = {};

  function cached(key, loader) {
    var c = cache[key];
    if (!c || Date.now() - c.at > CACHE_MS) {
      c = cache[key] = { at: Date.now(), promise: loader() };
      c.promise.catch(function () {
        if (cache[key] === c) delete cache[key];
      });
    }
    return c.promise.then(function (v) {
      return RA.clone(v);
    });
  }

  function invalidate(store) {
    if (!store) {
      cache = {};
      return;
    }
    delete cache["all:" + store];
    if (store === "users") {
      Object.keys(cache).forEach(function (k) {
        if (k.indexOf("me:") === 0) delete cache[k];
      });
    }
  }
  RA.invalidateCache = invalidate;

  function selectOf(def) {
    return def.select || "*";
  }

  function fetchRows(store, field, value) {
    var def = STORES[store];
    var out = [];
    function page(from) {
      var q = client().from(def.table).select(selectOf(def));
      if (field) q = q.eq(field, value);
      return q
        .order("id")
        .range(from, from + PAGE - 1)
        .then(function (r) {
          if (r.error) throw dbError(r.error);
          out = out.concat(r.data);
          return r.data.length === PAGE ? page(from + PAGE) : out;
        });
    }
    return page(0).then(function (rows) {
      return rows.map(function (row) {
        return toLocal(store, row);
      });
    });
  }

  // ------------------------------------------------------------------ RA.db (mesmos métodos do banco local)
  var memory = {}; // "meta" e outros dados só da tela

  function mem(store) {
    memory[store] = memory[store] || {};
    return memory[store];
  }

  var remoteDb = {
    all: function (store) {
      if (!STORES[store]) {
        var m = mem(store);
        return Promise.resolve(
          Object.keys(m).map(function (k) {
            return RA.clone(m[k]);
          })
        );
      }
      return cached("all:" + store, function () {
        return fetchRows(store);
      });
    },

    where: function (store, field, value) {
      return fetchRows(store, field, value);
    },

    get: function (store, id) {
      if (id === null || id === undefined || id === "") return Promise.resolve(null);
      if (!STORES[store]) return Promise.resolve(RA.clone(mem(store)[id]) || null);
      var c = cache["all:" + store];
      if (c && Date.now() - c.at <= CACHE_MS) {
        return c.promise.then(function (list) {
          var o = list.filter(function (x) {
            return x.id === id;
          })[0];
          return o ? RA.clone(o) : null;
        });
      }
      if (!RA.UUID_RE.test(String(id))) return Promise.resolve(null);
      var def = STORES[store];
      return client()
        .from(def.table)
        .select(selectOf(def))
        .eq("id", id)
        .maybeSingle()
        .then(function (r) {
          if (r.error) throw dbError(r.error);
          return r.data ? toLocal(store, r.data) : null;
        });
    },

    put: function (store, obj) {
      var def = STORES[store];
      if (!def) {
        mem(store)[obj.id] = RA.clone(obj);
        return Promise.resolve(obj);
      }
      if (def.write === "none") return Promise.reject(new Error("Esta informação só pode ser alterada pelo servidor (" + store + ")."));
      return toRemote(store, obj)
        .then(function (row) {
          var q = client().from(def.table);
          var req = def.write === "update" ? q.update(row).eq("id", obj.id) : def.write === "insert" ? q.insert(row) : q.upsert(row, { onConflict: "id" });
          return req.select(selectOf(def)).then(function (r) {
            if (r.error) throw dbError(r.error);
            if (!r.data || !r.data.length) throw permissionError();
            var saved = r.data[0];
            if (!def.m2m) return saved;
            return syncLinks(def.m2m, saved.id, obj[def.m2m.field]).then(function (links) {
              saved.links = links;
              return saved;
            });
          });
        })
        .then(
          function (saved) {
            invalidate(store);
            var fresh = toLocal(store, saved);
            Object.keys(fresh).forEach(function (k) {
              obj[k] = fresh[k];
            });
            return obj;
          },
          function (err) {
            invalidate(store);
            throw err;
          }
        );
    },

    putMany: function (store, list) {
      return list.reduce(function (p, o) {
        return p.then(function () {
          return remoteDb.put(store, o);
        });
      }, Promise.resolve()).then(function () {
        return list;
      });
    },

    del: function (store, id) {
      var def = STORES[store];
      if (!def) {
        delete mem(store)[id];
        return Promise.resolve(true);
      }
      return client()
        .from(def.table)
        .delete()
        .eq("id", id)
        .select("id")
        .then(function (r) {
          invalidate(store);
          if (r.error) {
            var e = dbError(r.error);
            // on_delete=PROTECT do Django (lotes ou cadernos ligados)
            if (e.code === "23503") {
              var pe = new ValidationError({
                __all__: ["Existem referências para o objeto que você tentou excluir, por isso ele não pôde ser removido."]
              });
              pe.protected = true;
              throw pe;
            }
            throw e;
          }
          if (!r.data || !r.data.length) throw permissionError();
          return true;
        });
    },

    clearAll: function () {
      return Promise.reject(new Error("Operação não disponível com o Supabase."));
    }
  };

  // api.js e os demais arquivos guardaram a referência de RA.db: troca os métodos no mesmo objeto
  Object.keys(remoteDb).forEach(function (k) {
    RA.db[k] = remoteDb[k];
  });
  var db = RA.db;

  // ------------------------------------------------------------------ Edge Function "contas"
  function callFunction(action, data, opts) {
    opts = opts || {};
    var tokenP = opts.anonymous
      ? Promise.resolve(null)
      : client()
          .auth.getSession()
          .then(function (r) {
            return r.data && r.data.session ? r.data.session.access_token : null;
          });
    return tokenP
      .then(function (token) {
        var headers = { "Content-Type": "application/json", apikey: SB_KEY };
        if (token) headers.Authorization = "Bearer " + token;
        var body = { action: action };
        Object.keys(data || {}).forEach(function (k) {
          body[k] = data[k];
        });
        return nativeFetch()(SB_URL + "/functions/v1/contas", { method: "POST", headers: headers, body: JSON.stringify(body) });
      })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (j) {
            if (res.ok) return j;
            var e = new Error((j.messages && j.messages[0]) || "Ocorreu um erro. Tente novamente.");
            e.status = res.status;
            e.messages = j.messages || [e.message];
            e.errors = j.errors || null;
            e.invalidLink = !!j.invalid_link;
            throw e;
          });
      });
  }

  function formError(err) {
    if (err && err.status === 400 && err.errors) return new ValidationError(err.errors);
    if (err && (err.status === 400 || err.status === 403 || err.status === 429) && err.messages) return new ValidationError({ __all__: err.messages });
    return err;
  }

  // ------------------------------------------------------------------ sessão e login
  var readyPromise = null;
  api.ready = function () {
    if (!readyPromise) {
      readyPromise = Promise.resolve().then(function () {
        client();
      });
    }
    return readyPromise;
  };

  function authEmail(cpf) {
    return cpf + "@" + AUTH_DOMAIN;
  }

  function invalidCredentials() {
    var e = new Error("invalid");
    e.invalidCredentials = true;
    return e;
  }

  // Entra com CPF/CNPJ e senha. Usuários vindos do sistema antigo entram com a senha
  // antiga (hash do Django), que a Edge Function confere e grava no Supabase Auth.
  function signIn(scope, username, password) {
    var c = client(scope);
    var cpf = RA.removeMask(username || "");
    if (!cpf || !password) return Promise.reject(invalidCredentials());
    return c.auth.signInWithPassword({ email: authEmail(cpf), password: password }).then(function (r) {
      if (!r.error) return r.data;
      var wrong = r.error.code === "invalid_credentials" || /invalid login credentials/i.test(r.error.message || "");
      if (!wrong) throw dbError(r.error);
      return callFunction("legacy-login", { username: cpf, password: password }, { anonymous: true }).then(
        function (res) {
          var next =
            res.mode === "token"
              ? c.auth.verifyOtp({ token_hash: res.token_hash, type: "magiclink" })
              : c.auth.signInWithPassword({ email: authEmail(cpf), password: password });
          return next.then(function (r2) {
            if (r2.error) throw dbError(r2.error);
            return r2.data;
          });
        },
        function (err) {
          if (err && err.status === 400) throw invalidCredentials();
          throw err;
        }
      );
    });
  }

  function signOut(scope) {
    invalidate();
    return client(scope)
      .auth.signOut({ scope: "local" })
      .then(
        function () {},
        function () {}
      );
  }

  api.currentUser = function (scope) {
    scope = scope || SCOPE;
    var c = client(scope);
    return c.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) return null;
      return cached("me:" + scope + ":" + s.user.id, function () {
        return c
          .from("accounts_user")
          .select("*")
          .eq("auth_user_id", s.user.id)
          .maybeSingle()
          .then(function (q) {
            if (q.error) throw dbError(q.error);
            return q.data ? toLocal("users", q.data) : null;
          });
      }).then(function (u) {
        if (!u || !u.is_active) {
          return signOut(scope).then(function () {
            return null;
          });
        }
        return u;
      });
    });
  };

  // Login do painel (Wagtail): CPF/CNPJ + senha
  api.loginAdmin = function (username, password) {
    var invalid = new ValidationError({ __all__: ["Dados de acesso inválidos. Por favor, tente novamente."] });
    invalid.authenticationFailed = true;
    return signIn("admin", username, password)
      .then(
        function () {
          invalidate();
          return api.currentUser("admin");
        },
        function () {
          throw invalid;
        }
      )
      .then(function (u) {
        if (!u || !(u.is_staff || u.is_superuser || u.is_farmer)) {
          return signOut("admin").then(function () {
            throw invalid;
          });
        }
        // django.contrib.auth.login: last_login
        return client("admin")
          .rpc("register_login")
          .then(function () {
            return u;
          });
      });
  };

  // Login do aplicativo (oauth_validators.py): produtor com assinatura ativa
  api.loginApp = function (username, password) {
    function failed() {
      var e = new ValidationError({ __all__: ["invalid"] });
      e.authenticationFailed = true;
      return e;
    }
    return signIn("app", username, password)
      .then(
        function () {
          invalidate();
          return api.currentUser("app");
        },
        function (err) {
          if (err && err.invalidCredentials) throw failed();
          throw err;
        }
      )
      .then(function (u) {
        if (!u || !u.is_farmer) {
          return signOut("app").then(function () {
            throw failed();
          });
        }
        return api.profileForUser(u).then(function (p) {
          return api.isSubscribed(p).then(function (sub) {
            if (!sub) {
              return signOut("app").then(function () {
                throw failed();
              });
            }
            return u;
          });
        });
      });
  };

  api.logout = function (scope) {
    return signOut(scope || SCOPE);
  };

  // ------------------------------------------------------------------ senhas
  // Aplicativo (api/farmers/change-password/)
  api.changePassword = function (user, currentPassword, newPassword) {
    return callFunction("change-password", { form: "app", current_password: currentPassword, new_password: newPassword }).catch(function (err) {
      throw formError(err);
    });
  };

  // Painel (PasswordChangeForm)
  api.changePasswordForm = function (user, data) {
    return callFunction("change-password", {
      form: "admin",
      old_password: data.old_password || "",
      new_password1: data.new_password1 || "",
      new_password2: data.new_password2 || ""
    }).catch(function (err) {
      throw formError(err);
    });
  };

  // Aplicativo: "Esqueci minha senha" (por CPF/CNPJ)
  api.resetPassword = function (cpfCnpj) {
    return callFunction("reset-password", { cpf_cnpj: cpfCnpj, site_url: RA.siteDomain() + "/" }, { anonymous: true }).catch(function (err) {
      var e = formError(err);
      if (err && err.status === 400) e.userNotFound = true;
      throw e;
    });
  };

  // Painel: "Esqueceu a senha?" (por e-mail)
  api.requestPasswordReset = function (email) {
    return callFunction("reset-password", { email: email, site_url: RA.siteDomain() + "/" }, { anonymous: true }).catch(function (err) {
      throw formError(err);
    });
  };

  api.passwordResetCheck = function (uidb64, token) {
    return callFunction("reset-check", { uidb64: uidb64, token: token }, { anonymous: true }).then(function (r) {
      return !!r.valid;
    });
  };

  api.passwordResetConfirm = function (uidb64, token, p1, p2) {
    return callFunction("reset-confirm", { uidb64: uidb64, token: token, new_password1: p1, new_password2: p2 }, { anonymous: true }).catch(function (err) {
      if (err && err.invalidLink) {
        var e = new ValidationError({});
        e.invalidLink = true;
        throw e;
      }
      throw formError(err);
    });
  };

  // Primeiro administrador (código de instalação); entra no painel em seguida
  api.bootstrapAdmin = function (d) {
    return callFunction("bootstrap-admin", d, { anonymous: true }).then(
      function (r) {
        return api.loginAdmin(d.cpf_cnpj, d.password1).then(function () {
          return r.user;
        });
      },
      function (err) {
        throw formError(err);
      }
    );
  };

  // ------------------------------------------------------------------ cadastro e assinatura
  function signupError(err) {
    // As rotas de cadastro respondem 400 com a lista de mensagens (RestValidationError)
    if (err && (err.status === 400 || err.status === 429) && err.messages) return err.messages;
    return err;
  }

  api.validateAccessData = function (d) {
    return callFunction("validate-access-data", d, { anonymous: true }).then(
      function () {},
      function (err) {
        throw signupError(err);
      }
    );
  };

  api.signup = function (d) {
    return callFunction("signup", d, { anonymous: true }).then(
      function () {
        // Como no original (login logo após o cadastro); se falhar, o cadastro continua valendo
        return signIn("admin", d.cpf_cnpj, d.password).then(
          function () {
            invalidate();
          },
          function () {}
        );
      },
      function (err) {
        throw signupError(err);
      }
    );
  };

  function rpc(name, args, stores) {
    return client()
      .rpc(name, args || {})
      .then(function (r) {
        (stores || []).forEach(invalidate);
        if (r.error) throw dbError(r.error);
        return r.data;
      });
  }

  var SUB_STORES = ["subscriptions", "transactions", "farmer_profiles"];

  api.reactivate = function (user, d) {
    var p = {};
    ["plan_id", "payment_method", "address_street", "address_street_number", "address_extra", "address_neighborhood", "address_zipcode", "phone_ddd", "phone_number"].forEach(function (k) {
      if (d[k] !== undefined) p[k] = d[k];
    });
    return rpc("reactivate_subscription", { p: p }, SUB_STORES).catch(function (err) {
      throw [err.message];
    });
  };

  api.changeSubscriptionPlan = function (sub, newPlanId) {
    return rpc("change_subscription_plan", { p_new_plan_id: String(newPlanId) }, SUB_STORES).then(
      function () {
        sub.plan = String(newPlanId);
        return sub;
      },
      function (err) {
        throw new ValidationError({ __all__: [err.message] });
      }
    );
  };

  api.settleCharge = function (subscriptionId) {
    return rpc("settle_charge", { p_subscription_id: String(subscriptionId) }, SUB_STORES).catch(function (err) {
      throw new ValidationError({ __all__: [err.message] });
    });
  };

  api.cancelSubscription = function (sub) {
    return rpc("cancel_subscription", {}, SUB_STORES).then(function () {
      sub.status = api.SUB.CANCELED;
      return sub;
    });
  };

  api.setSubscriptionPaymentMethod = function (sub, method) {
    return rpc("set_subscription_payment_method", { p_method: method }, SUB_STORES).then(function () {
      sub.payment_method = method;
      return sub;
    });
  };

  // ------------------------------------------------------------------ usuários
  // O produtor não enxerga os outros usuários: a unicidade é conferida no banco
  api.uniqueConflicts = function (userId, cpf, email, opts) {
    return rpc("user_conflicts", {
      p_cpf_cnpj: cpf || "",
      p_email: String(email || "").trim(),
      p_email_ci: !!(opts && opts.emailCaseInsensitive)
    }).then(function (r) {
      return r || { cpf_cnpj: false, email: false };
    });
  };

  // Administradores (wagtail.users): a senha e o CPF ficam no Supabase Auth
  api.saveAdminUser = function (data, existing) {
    var payload = {};
    ["name", "person_type", "cpf_cnpj", "email", "password1", "password2"].forEach(function (k) {
      payload[k] = data[k] === undefined ? "" : data[k];
    });
    if (existing) payload.id = existing.id;
    return callFunction(existing ? "admin-update" : "admin-create", payload).then(
      function (r) {
        invalidate("users");
        return r.user;
      },
      function (err) {
        throw formError(err);
      }
    );
  };

  api.deleteUser = function (id) {
    return callFunction("admin-delete", { id: id }).then(function () {
      invalidate("users");
      return true;
    });
  };

  // ------------------------------------------------------------------ exclusões (on_delete do banco)
  // Certificado: os vínculos com os lotes saem junto (ManyToMany, CASCADE)
  api.deleteCertificate = function (id) {
    return db.del("certificates", id).then(function () {
      invalidate("batches");
    });
  };

  // Produto: protegido pelos lotes; os vínculos com os cadernos saem junto
  api.deleteProduct = function (id) {
    return db.all("batches").then(function (l) {
      var linked = l.filter(function (b) {
        return b.product_id === id;
      });
      if (linked.length) throw protectedError(linked);
      return db.del("products", id).then(function () {
        invalidate("farm_journals");
      });
    });
  };

  // Caderno: os registros saem junto (CASCADE)
  api.deleteFarmJournal = function (id) {
    return db.del("farm_journals", id).then(function () {
      ["fertilizing_entries", "pesticide_entries", "harvest_entries", "postharvest_entries"].forEach(invalidate);
    });
  };

  // ------------------------------------------------------------------ páginas públicas (etiqueta e caderno)
  function batchFromPublic(b) {
    if (!b) return null;
    b.farm_id = b.farm ? b.farm.id : null;
    b.product_id = b.product ? b.product.id : null;
    b.unit_id = b.unit ? b.unit.id : null;
    b.technical_manager_id = b.technical_manager ? b.technical_manager.id : null;
    b.certificate_ids = (b.certificates || []).map(function (c) {
      return c.id;
    });
    imageToLocal(b, "image");
    if (b.farmer_profile) {
      imageToLocal(b.farmer_profile, "logo_image");
      imageToLocal(b.farmer_profile, "profile_image");
    }
    (b.certificates || []).forEach(function (c) {
      if (c.certificate_type) imageToLocal(c.certificate_type, "certificate_logo", "base");
    });
    return b;
  }

  function publicBatchTag(id) {
    return rpc("get_batch_tag_public", { p_id: id }).then(function (t) {
      if (!t || !t.batch) return null;
      t.batch = batchFromPublic(t.batch);
      return t;
    });
  }

  // Etiqueta: nas páginas públicas vem da função do banco (qualquer pessoa com o código);
  // no painel e no aplicativo vem das tabelas do usuário
  api.getBatchTag = function (id) {
    id = String(id || "").toLowerCase();
    if (!RA.UUID_RE.test(id)) return Promise.resolve(null);
    if (SCOPE === "public") return publicBatchTag(id);
    return original.getBatchTag(id).then(function (t) {
      return t || publicBatchTag(id);
    });
  };

  var ENTRY_STORES = ["fertilizing_entries", "pesticide_entries", "harvest_entries", "postharvest_entries"];
  var publicEntries = {};

  function publicFarmJournal(id) {
    return rpc("get_farm_journal_public", { p_id: id }).then(function (j) {
      if (!j) return null;
      publicEntries[j.id] = {};
      ENTRY_STORES.forEach(function (s) {
        publicEntries[j.id][s] = j[s] || [];
        delete j[s];
      });
      j.product_ids = (j.products || []).map(function (p) {
        return p.id;
      });
      return j;
    });
  }

  api.getFarmJournal = function (id) {
    if (!RA.UUID_RE.test(String(id || ""))) return Promise.resolve(null);
    if (SCOPE === "public") return publicFarmJournal(id);
    return original.getFarmJournal(id);
  };

  api.entries = function (type, farmJournalId) {
    var c = api.ENTRY[type];
    var pub = publicEntries[farmJournalId];
    var p = pub ? Promise.resolve(RA.clone(pub[c.store] || [])) : db.where(c.store, "farm_journal_id", farmJournalId);
    return p.then(function (l) {
      return l.sort(function (a, b) {
        var x = a[c.dateField],
          y = b[c.dateField];
        return x < y ? 1 : x > y ? -1 : 0;
      });
    });
  };
})(window);
