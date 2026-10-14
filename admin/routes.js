/*
 * Respostas locais para os endereços que os scripts do painel chamam
 * (no original eram views do Django: core/edit_handlers.py, products/views.py,
 * subscriptions/views/*, accounts/views/farmers.py, farmers/views/farmers.py e
 * wagtailmodelchoosers/views.py).
 */
(function (window, $) {
  "use strict";

  var RA = window.RA;
  var W = window.W;
  var F = window.F;
  var MA = window.MA;
  var PG = window.PG;
  var api = RA.api;
  var local = RA.local;
  var e = RA.esc;

  function ctx() {
    return window.ADMIN.context();
  }

  function forbidden() {
    return local.json({ detail: "Você não tem permissão para executar essa ação." }, 403);
  }

  // DRF PageNumberPagination
  function paginate(list, query, pageSize, path) {
    var page = parseInt(query.page || "1", 10) || 1;
    var count = list.length;
    var pages = Math.max(1, Math.ceil(count / pageSize));
    if (page > pages) page = pages;
    var results = list.slice((page - 1) * pageSize, page * pageSize);
    function link(p) {
      var q = $.extend({}, query, { page: p });
      return path + "?" + $.param(q);
    }
    return {
      count: count,
      next: page < pages ? link(page + 1) : null,
      previous: page > 1 ? link(page - 1) : null,
      results: results,
      _page: page,
      _pages: pages
    };
  }

  // django.contrib.admin display_for_field / display_for_value
  function display(v, kind) {
    if (v === null || v === undefined) return "-";
    if (kind === "date") return RA.fmtDate(v);
    if (kind === "float") return String(Number.isInteger(Number(v)) ? Number(v).toFixed(1) : v).replace(".", ",");
    if (String(v) === "") return "&nbsp;";
    return e(v);
  }

  // ------------------------------------------------------------------ registros do caderno (NestedModelAdminPanel)
  var ENTRY_FORMS = {
    fertilizingentry: {
      type: "fertilizing",
      field: "fertilizing_entry",
      verbose: "registro de adubação",
      heading: "",
      fields: [
        { name: "application_date", label: "Data da aplicação", kind: "date", required: true },
        { name: "formula_name", label: "Nome do produto fórmula", kind: "textarea", required: true },
        { name: "dose", label: "Dose", kind: "number", required: true },
        { name: "unity", label: "Unidade", kind: "choice", required: true, choices: api.FERTILIZING_UNITS },
        { name: "application_method", label: "Forma de aplicação", kind: "textarea", required: true },
        { name: "application_responsible", label: "Responsável pela aplicação", kind: "textarea", required: true },
        { name: "note", label: "Observação", kind: "textarea" }
      ],
      list: [["application_date", "date"], ["formula_name"], ["dose", "float"], ["application_method"], ["application_responsible"], ["note"]]
    },
    pesticideentry: {
      type: "pesticide",
      field: "pesticide_entry",
      verbose: "registro de defensivos",
      heading: "Dados de defensivos",
      fields: [
        { name: "date", label: "Data", kind: "date", required: true },
        { name: "grace_period", label: "Período de carência", kind: "textarea", required: true },
        { name: "target_disease", label: "Praga ou doença alvo", kind: "textarea", required: true },
        { name: "product_name", label: "Nome do produto", kind: "textarea", required: true },
        { name: "dose", label: "Dose", kind: "textarea", required: true },
        { name: "volume", label: "Volume de calda", kind: "textarea", required: true },
        { name: "operator", label: "Operador", kind: "textarea", required: true }
      ],
      list: [["date", "date"], ["grace_period"], ["target_disease"], ["product_name"], ["dose"], ["volume"], ["operator"]]
    },
    harvestentry: {
      type: "harvest",
      field: "harvest_entry",
      verbose: "registro de colheita",
      heading: "Dados de colheita",
      fields: [
        { name: "date", label: "Data", kind: "date", required: true },
        { name: "amount", label: "Quantidade colhida", kind: "textarea", required: true },
        { name: "destination", label: "Destino", kind: "textarea", required: true },
        { name: "responsible", label: "Responsável", kind: "textarea", required: true }
      ],
      list: [["date", "date"], ["amount"], ["destination"], ["responsible"]]
    },
    postharvestentry: {
      type: "postharvest",
      field: "postharvest_entry",
      verbose: "registro pós-colheita",
      heading: "Dados de pós-colheita",
      fields: [
        { name: "date", label: "Data", kind: "date", required: true },
        { name: "product_name", label: "Nome do produto aplicado", kind: "textarea", required: true },
        { name: "dose", label: "Dose", kind: "textarea", required: true },
        { name: "grace_period", label: "Período de carência", kind: "textarea", required: true },
        { name: "responsible", label: "Responsável", kind: "textarea", required: true }
      ],
      list: [["date", "date"], ["product_name"], ["dose"], ["grace_period"], ["responsible"]]
    }
  };
  var BY_FIELD = {};
  Object.keys(ENTRY_FORMS).forEach(function (m) {
    ENTRY_FORMS[m].model = m;
    BY_FIELD[ENTRY_FORMS[m].field] = ENTRY_FORMS[m];
  });

  // Confere se o caderno é do produtor logado (BaseFarmJournalNestedAdmin.get_queryset)
  function journalOf(c, journalId) {
    var j = c.idx.farm_journals[journalId];
    if (!j) return null;
    var f = c.idx.farms[j.farm_id];
    if (!f || !c.profile || f.farmer_profile_id !== c.profile.id) return null;
    return j;
  }

  function entryButtons(cfg, entry) {
    var base = "/admin/farm_journals/" + cfg.model + "/";
    return [
      { url: base + "edit/" + entry.id + "/", label: W.T.edit, classname: "button button-small button-secondary", title: "Editar este " + cfg.verbose },
      { url: base + "delete/" + entry.id + "/", label: W.T.delete, classname: "button no button-small button-secondary", title: "Remover este " + cfg.verbose }
    ];
  }

  local.route("GET", /^\/admin\/api\/nested-model-admin\/(\w+)\/?$/, function (req) {
    var cfg = BY_FIELD[req.params[1]];
    return ctx().then(function (c) {
      if (!c || !cfg) return forbidden();
      var j = journalOf(c, req.query.farm_journal_id);
      if (!j) return local.json({ detail: "Não encontrado." }, 404);
      return api.entries(cfg.type, j.id).then(function (list) {
        var rows = list.map(function (en) {
          var d = { pk: en.id, _buttons: entryButtons(cfg, en) };
          cfg.list.forEach(function (l) {
            d[l[0]] = display(en[l[0]], l[1]);
          });
          return d;
        });
        var p = paginate(rows, req.query, parseInt(req.query.page_size || "10", 10) || 10, req.path);
        return local.json({ count: p.count, next: p.next, previous: p.previous, results: p.results });
      });
    });
  });

  // nested_model_admin_create.html / _edit.html
  function entryFormHTML(cfg, action, parentId, fk, values, errors, messages) {
    var form = new F.Form(
      {
        objects: [
          {
            panel: "multi",
            heading: cfg.heading,
            children: cfg.fields.map(function (f) {
              return { panel: "field", field: $.extend({}, f) };
            })
          }
        ]
      },
      values || {},
      errors || {}
    );
    var content = form.render();
    // Scripts dos widgets (date_input.html e auto_height_text_input.html)
    var scripts = "";
    cfg.fields.forEach(function (f) {
      if (f.kind === "date") scripts += '<script>initDateChooser("id_' + f.name + '", {"dayOfWeekStart": 0, "format": "d/m/Y"});</script>';
      if (f.kind === "textarea") scripts += '<script>autosize($("#id_' + f.name + '"));</script>';
    });
    return (
      '<link rel="stylesheet" href="' + RA.url("assets/wagtail/css/layouts/page-editor.css") + '" />' +
      "<div>\n\t<div class=\"messages\">" + W.messagesHTML(messages) + "</div>\n\t" +
      '<form action="' + action + "?parent_id=" + parentId + "&fk_field_name=" + fk + '" method="POST" novalidate>' +
      '<input type="hidden" name="csrfmiddlewaretoken" value="local"><input type="hidden" name="' + fk + '" value="' + e(parentId) + '">' +
      '<div style="max-height: calc( 80vh - 165px ); overflow: auto;">' + content + "</div>" +
      '<footer style="position: relative; margin-top: 0px; text-align: right; background: transparent;"><ul style="display: inline-block;"><li class="actions">' +
      '<div class="dropdown dropup dropdown-button match-width"><button type="submit" class="button action-save button-longrunning" style="text-align: center;" data-clicked-text="' + W.T.saving + '">' +
      W.icon("spinner") + "<em>" + W.T.save + "</em></button></div></li></ul></footer></form>" +
      scripts +
      "</div>"
    );
  }

  function readEntry(cfg, data) {
    var v = {};
    cfg.fields.forEach(function (f) {
      var raw = data[f.name];
      if (raw === undefined) raw = "";
      if (f.kind === "date") v[f.name] = raw ? RA.parseBRDate(raw) || raw : "";
      else v[f.name] = raw;
    });
    return v;
  }

  local.route("*", /^\/admin\/farm_journals\/(\w+)\/create\/?$/, function (req) {
    var cfg = ENTRY_FORMS[req.params[1]];
    return ctx().then(function (c) {
      if (!c || !cfg) return forbidden();
      var parentId = req.query.parent_id,
        fk = req.query.fk_field_name || "farm_journal_id";
      var j = journalOf(c, parentId);
      if (!j) return forbidden();
      var action = "/admin/farm_journals/" + cfg.model + "/create/";
      if (req.method === "GET") return local.html(entryFormHTML(cfg, action, parentId, fk));
      var values = readEntry(cfg, req.data);
      values.farm_journal_id = parentId;
      return api
        .saveEntry(cfg.type, values, null)
        .then(function () {
          // redirect(reverse("nested_model_admin_refresh")) -> "refresh"
          return { text: "refresh" };
        })
        .catch(function (err) {
          if (!err || err.name !== "ValidationError") throw err;
          var raw = $.extend({}, req.data);
          return local.html(
            entryFormHTML(cfg, action, parentId, fk, raw, err.errors, [{ level: "error", html: "O " + cfg.verbose + " não pode ser criado devido a erros." }])
          );
        });
    });
  });

  local.route("*", /^\/admin\/farm_journals\/(\w+)\/edit\/([\w-]+)\/?$/, function (req) {
    var cfg = ENTRY_FORMS[req.params[1]];
    return ctx().then(function (c) {
      if (!c || !cfg) return forbidden();
      return api.getEntry(cfg.type, req.params[2]).then(function (entry) {
        if (!entry || !journalOf(c, entry.farm_journal_id)) return local.html("<h1>Not Found</h1>", 404);
        var parentId = req.query.parent_id || entry.farm_journal_id,
          fk = req.query.fk_field_name || "farm_journal_id";
        var action = "/admin/farm_journals/" + cfg.model + "/edit/" + entry.id + "/";
        if (req.method === "GET") {
          var msgs = window.NESTED._flash || null;
          window.NESTED._flash = null;
          return local.html(entryFormHTML(cfg, action, parentId, fk, entry, null, msgs));
        }
        var values = readEntry(cfg, req.data);
        values.farm_journal_id = entry.farm_journal_id;
        return api
          .saveEntry(cfg.type, values, entry)
          .then(function (saved) {
            // Sucesso: volta para a mesma página com a mensagem (NestedModelAdminEditView)
            var msg = MA.capfirst(cfg.verbose) + " atualizado.";
            return local.html(entryFormHTML(cfg, action, parentId, fk, saved, null, [{ level: "success", html: e(msg) }]));
          })
          .catch(function (err) {
            if (!err || err.name !== "ValidationError") throw err;
            return local.html(
              entryFormHTML(cfg, action, parentId, fk, $.extend({}, req.data), err.errors, [{ level: "error", html: "O " + cfg.verbose + " não pôde ser salvo devido a erros." }])
            );
          });
      });
    });
  });

  local.route("*", /^\/admin\/farm_journals\/(\w+)\/delete\/([\w-]+)\/?$/, function (req) {
    var cfg = ENTRY_FORMS[req.params[1]];
    return ctx().then(function (c) {
      if (!c || !cfg) return forbidden();
      return api.getEntry(cfg.type, req.params[2]).then(function (entry) {
        if (!entry || !journalOf(c, entry.farm_journal_id)) return local.html("<h1>Not Found</h1>", 404);
        if (req.method === "POST") {
          return api.deleteEntry(cfg.type, entry.id).then(function () {
            return { text: "refresh" };
          });
        }
        // nested_model_admin_delete.html
        return local.html(
          '<div>\n\t<div class="messages"></div>\n\t<div class="nice-padding" style="margin: 20px 0px;">' +
            "<p>Tem certeza de que quer apagar este " + e(cfg.verbose) + "?</p>" +
            '<form action="/admin/farm_journals/' + cfg.model + "/delete/" + entry.id + '/" method="POST"><input type="hidden" name="csrfmiddlewaretoken" value="local">' +
            '<input type="submit" value="' + W.T.yesDelete + '" class="button serious" />\n                    <a href="#" class="button button-secondary ra-cancel-delete">' + W.T.noDelete + "</a></form></div>\n</div>"
        );
      });
    });
  });

  // ------------------------------------------------------------------ assinatura (subscriptions/views/farmers.py e staff.py)
  local.route("GET", /^\/api\/subscriptions\/subscription-transactions\/?$/, function (req) {
    return ctx().then(function (c) {
      if (!c || !c.user.is_farmer) return forbidden();
      if (c.profile.is_demo) return local.json({ count: 0, next: null, previous: null, results: [] });
      return api.subscriptionTransactions(c.subscription).then(function (list) {
        var results = list.map(function (t) {
          return {
            status: api.transactionStatusDisplay(t.status),
            date_created: RA.fmtDate(t.date_created),
            payment_method: api.paymentMethodName(t.payment_method),
            amount: "R$ " + (t.amount / 100).toFixed(2).replace(".", ","),
            buttons: t.boleto_url ? "<a class='button button-small button-secondary' target='_blank' href='" + e(t.boleto_url) + "'>Visualizar boleto</a>" : ""
          };
        });
        return local.json({ count: results.length, next: null, previous: null, results: results });
      });
    });
  });

  local.route("GET", /^\/api\/subscriptions\/subscription\/?$/, function () {
    return ctx().then(function (c) {
      if (!c || !c.user.is_farmer) return forbidden();
      if (c.profile.is_demo) {
        return local.json({
          subscription: {
            plan_id: "demo",
            plan_name: "Plano demonstrativo",
            trialing: false,
            date_created: "2021-01-01T00:00:00Z",
            payment_method_id: "boleto",
            payment_method_name: "Boleto Bancário",
            card_brand: null,
            card_last_digits: null,
            current_period_end: "3000-01-01T00:00:00Z",
            manage_url: "https://agrifamiliar.com/",
            can_manage_subscription: false,
            status_display: "Pagamento em dia"
          }
        });
      }
      var s = c.subscription;
      return local.json({
        subscription: {
          plan_id: s.plan,
          plan_name: api.planName(s.plan),
          trialing: s.status === api.SUB.TRIALING,
          date_created: s.date_created,
          payment_method_id: s.payment_method,
          payment_method_name: api.paymentMethodName(s.payment_method),
          card_brand: s.card_brand,
          card_last_digits: s.card_last_digits,
          current_period_end: s.current_period_end,
          manage_url: window.FARMER.manageURL(),
          can_manage_subscription: api.subCanManage(s),
          status_display: api.subStatusDisplay(s)
        }
      });
    });
  });

  local.route("POST", /^\/api\/subscriptions\/change-plan\/?$/, function (req) {
    return ctx().then(function (c) {
      if (!c || !c.user.is_farmer || !c.subscription) return forbidden();
      return api
        .changeSubscriptionPlan(c.subscription, req.data.new_plan_id)
        .then(function () {
          return local.json(null, 200);
        })
        .catch(function () {
          return local.json(["Não foi possível alterar o seu plano. Por gentileza, tente novamente mais tarde."], 400);
        });
    });
  });

  local.route("POST", /^\/api\/subscriptions\/settle-charge\/?$/, function (req) {
    return ctx().then(function (c) {
      if (!c || !(c.user.is_staff || c.user.is_superuser)) return forbidden();
      return api
        .settleCharge(req.data.subscription_id)
        .then(function () {
          return local.json(null, 200);
        })
        .catch(function () {
          return local.json(["Não foi possível marcar esta assinatura como paga. Por gentileza, tente novamente mais tarde."], 400);
        });
    });
  });

  // Página local de gerenciamento da assinatura (substitui a página do Pagar.me)
  local.route("POST", /^\/api\/subscriptions\/manage\/?$/, function (req) {
    return ctx().then(function (c) {
      if (!c || !c.subscription) return forbidden();
      var s = c.subscription;
      if (req.data.action === "cancel") {
        return api.cancelSubscription(s).then(function () {
          return local.json(null, 200);
        });
      }
      if (req.data.payment_method) {
        return api.setSubscriptionPaymentMethod(s, req.data.payment_method).then(function () {
          return local.json(null, 200);
        });
      }
      return local.json(null, 200);
    });
  });

  // ------------------------------------------------------------------ etiquetas do produtor (products/views.py FarmerBatchTagsListView)
  local.route("GET", /^\/admin\/products\/farmer-batch-tags\/?$/, function (req) {
    return ctx().then(function (c) {
      if (!c || !(c.user.is_staff || c.user.is_superuser)) return forbidden();
      var idx = c.idx;
      var farmerId = req.query.farmer_id;
      var list = idx.batch_tags_list
        .filter(function (t) {
          var b = idx.batches[t.batch_id];
          var f = b ? idx.farms[b.farm_id] : null;
          return f && f.farmer_profile_id === farmerId;
        })
        .sort(function (a, b) {
          return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
        })
        .map(function (t) {
          var b = idx.batches[t.batch_id];
          var p = idx.products[b.product_id];
          var f = idx.farms[b.farm_id];
          return { id: t.id, product_name: p ? p.name : "", amount: t.amount, batch_number: b.number, date: t.date, farm_name: f ? f.name : "" };
        });
      var p = paginate(list, req.query, 10, req.path);
      return local.json({ count: p.count, next: p.next, previous: p.previous, results: p.results });
    });
  });

  // ------------------------------------------------------------------ wagtailmodelchoosers (ModelView)
  var CHOOSER_SEARCH = {
    farmer_farm_chooser: function (f, idx) {
      var u = idx.userByProfile[f.farmer_profile_id];
      return [u ? u.name : "", u ? u.cpf_cnpj : ""];
    },
    staff_farm_chooser: function (f, idx) {
      var u = idx.userByProfile[f.farmer_profile_id];
      return [u ? u.name : "", u ? u.cpf_cnpj : ""];
    },
    farmer_batch_chooser: function (b, idx) {
      var f = idx.farms[b.farm_id],
        p = idx.products[b.product_id];
      return [f ? f.name : "", p ? p.name : "", p ? p.variety : ""];
    },
    staff_batch_chooser: function (b, idx) {
      var f = idx.farms[b.farm_id],
        p = idx.products[b.product_id];
      var u = f ? idx.userByProfile[f.farmer_profile_id] : null;
      return [u ? u.name : "", u ? u.cpf_cnpj : "", p ? p.name : "", p ? p.variety : ""];
    }
  };

  function serializeFarm(f, idx) {
    return {
      id: f.id,
      farmer_profile: f.farmer_profile_id,
      name: f.name,
      street: f.street,
      number: f.number,
      neighborhood: f.neighborhood,
      extra: f.extra,
      city: f.city_id,
      state: f.state_id,
      latitude: f.latitude,
      longitude: f.longitude,
      zip_code: f.zip_code,
      ccir: f.ccir,
      total_hectares: f.total_hectares,
      get_farmer_name: MA.S.farmerName(f, idx),
      get_city: RA.cityName(f.city_id),
      get_state_abbreviation: f.state_id
    };
  }

  function serializeBatch(b, idx) {
    var f = idx.farms[b.farm_id];
    return {
      id: b.id,
      farm: b.farm_id,
      product: b.product_id,
      unit: b.unit_id,
      technical_manager: b.technical_manager_id,
      number: b.number,
      harvest_date: b.harvest_date,
      created_at: b.created_at,
      image: b.image ? "imagem" : null,
      get_farmer_name: MA.S.farmerName(f, idx),
      get_farm_name: f ? f.name : "",
      get_product_name: MA.S.batchProductName(b, idx),
      get_formatted_harvest_date: RA.fmtDate(b.harvest_date)
    };
  }

  local.route("GET", /^\/admin\/modelchoosers\/api\/v1\/model\/([\w-]+)\/?$/, function (req) {
    var chooser = req.params[1];
    return ctx().then(function (c) {
      if (!c) return forbidden();
      var idx = c.idx;
      var list;
      var isFarm = chooser.indexOf("farm_chooser") !== -1;
      var mine = chooser.indexOf("farmer_") === 0;
      if (isFarm) {
        list = idx.farms_list.filter(function (f) {
          return !mine || (c.profile && f.farmer_profile_id === c.profile.id);
        });
        list = MA.sortBy(list, ["name"], function (o, k) {
          return o[k];
        });
      } else {
        list = idx.batches_list.filter(function (b) {
          var f = idx.farms[b.farm_id];
          return !mine || (f && c.profile && f.farmer_profile_id === c.profile.id);
        });
        list = MA.sortBy(list, ["-created_at"], function (o, k) {
          return o[k];
        });
      }
      var search = req.query.search;
      if (search) {
        var s = String(search).toLowerCase();
        list = list.filter(function (o) {
          return CHOOSER_SEARCH[chooser](o, idx).some(function (v) {
            return String(v || "").toLowerCase().indexOf(s) !== -1;
          });
        });
      }
      var rows = list.map(function (o) {
        return isFarm ? serializeFarm(o, idx) : serializeBatch(o, idx);
      });
      var p = paginate(rows, req.query, parseInt(req.query.page_size || "12", 10) || 12, req.path);
      return local.json({ results: p.results, page: p._page, num_pages: p._pages, next: p.next, previous: p.previous, count: p.count });
    });
  });

  // ------------------------------------------------------------------ alterar senha do produtor (farmers/views/farmers.py farmer_change_password)
  function changePasswordHTML(errors) {
    return (
      "<style>\n    #farmer-password-form .field-content {\n        width: 80%;\n    }\n    #farmer-password-form label {\n        width: 20%;\n    }\n</style>\n" +
      '<div class="nice-padding">\n        <form id="farmer-password-form" action="/api/farmers/change-password/" style="display: flex; flex-direction: column;" method="POST" novalidate>' +
      '<input type="hidden" name="csrfmiddlewaretoken" value="local"><ul class="fields">' +
      PG.passwordChangeFields(errors) +
      '</ul><button style="align-self: flex-end;" type="submit" class="button">Alterar senha</button></form>\n</div>\n'
    );
  }

  local.route("*", /^\/api\/farmers\/change-password\/?$/, function (req) {
    return ctx().then(function (c) {
      if (!c) return forbidden();
      if (req.method === "GET") return local.html(changePasswordHTML(null));
      return api
        .changePasswordForm(c.user, req.data)
        .then(function () {
          return local.html('<div class="nice-padding">\n    Sua senha foi alterada!\n</div>\n');
        })
        .catch(function (err) {
          if (!err || err.name !== "ValidationError") throw err;
          return local.html(changePasswordHTML(err.errors));
        });
    });
  });

  // ------------------------------------------------------------------ cadastro e reativação (accounts/views/farmers.py)
  function rejectWith(list) {
    return local.json(list, 400);
  }

  local.route("POST", /^\/api\/auth\/reactivate\/?$/, function (req) {
    return ctx().then(function (c) {
      if (!c || !c.user.is_farmer) return forbidden();
      if (!c.subscription || c.subscription.status !== api.SUB.CANCELED) return rejectWith(["Você já possui uma assinatura ativa."]);
      return api
        .validateAddressData(req.data)
        .then(function () {
          if (!req.data.plan_id || !req.data.payment_method) throw ["x"];
          return api.reactivate(c.user, req.data);
        })
        .then(function () {
          return local.json(null, 200);
        })
        .catch(function (err) {
          if (Array.isArray(err)) {
            if (err[0] === "Você já possui uma assinatura ativa.") return rejectWith(err);
            return rejectWith(["Não foi possível reativar a sua assinatura. Por gentileza, verifique os seus dados e tente novamente."]);
          }
          throw err;
        });
    });
  });

})(window, window.jQuery);
