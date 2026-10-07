/*
 * Definições dos cadastros do painel (wagtail_hooks de cada app do sistema original):
 * farmers/wagtail_hooks, products/wagtail_hooks e farm_journals/wagtail_hooks.
 */
(function (window, $) {
  "use strict";

  var RA = window.RA;
  var W = window.W;
  var MA = window.MA;
  var api = RA.api;
  var e = RA.esc;

  // ------------------------------------------------------------------ permissões
  // core/model_admin.py
  function isStaff(ctx) {
    return !!(ctx.user.is_staff || ctx.user.is_superuser);
  }
  function isSubscribedFarmer(ctx) {
    return !!ctx.user.is_farmer && ctx.subscribed;
  }
  var allowAll = {
    list: function () {
      return true;
    },
    create: function () {
      return true;
    },
    edit: function () {
      return true;
    },
    delete: function () {
      return true;
    }
  };

  // ------------------------------------------------------------------ escolha de modelos (MODEL_CHOOSERS_OPTIONS)
  var CHOOSER_T = {
    choose: "Selecionar",
    result: "Resultado",
    results: "Resultados",
    no_results: "Nenhum resultado encontrado",
    loading: "Carregando...",
    previous: "Anterior",
    page: "Página",
    pages: "Páginas",
    next: "Próxima",
    type_to_search: "Buscar",
    clear: "Remover seleção"
  };
  function chooserT(extra) {
    return $.extend({}, CHOOSER_T, extra);
  }
  MA.CHOOSERS = {
    farmer_farm_chooser: {
      endpoint: "/admin/modelchoosers/api/v1/model/farmer_farm_chooser",
      label: "Propriedade",
      displayKey: "name",
      translations: chooserT({ choose_again: "Selecionar outra" }),
      listDisplay: [
        { label: "Nome", name: "name" },
        { label: "Cidade", name: "get_city" },
        { label: "Estado", name: "get_state_abbreviation" }
      ]
    },
    staff_farm_chooser: {
      endpoint: "/admin/modelchoosers/api/v1/model/staff_farm_chooser",
      label: "Propriedade",
      displayKey: "name",
      translations: chooserT({ choose_again: "Selecionar outra" }),
      listDisplay: [
        { label: "Nome", name: "name" },
        { label: "Produtor", name: "get_farmer_name" },
        { label: "Cidade", name: "get_city" },
        { label: "Estado", name: "get_state_abbreviation" }
      ]
    },
    farmer_batch_chooser: {
      endpoint: "/admin/modelchoosers/api/v1/model/farmer_batch_chooser",
      label: "Lote",
      displayKey: "batch_name",
      translations: chooserT({ choose_again: "Selecionar outro", edit: "Editar lote" }),
      editUrl: function (id) {
        return RA.url("admin/") + "#/products/batch/edit/" + id + "/";
      },
      listDisplay: [
        { label: "Propriedade", name: "get_farm_name" },
        { label: "Produto", name: "get_product_name" },
        { label: "Data da colheita", name: "get_formatted_harvest_date" },
        { label: "Número", name: "number" }
      ]
    },
    staff_batch_chooser: {
      endpoint: "/admin/modelchoosers/api/v1/model/staff_batch_chooser",
      label: "Lote",
      displayKey: "batch_name",
      translations: chooserT({ choose_again: "Selecionar outro", edit: "Editar lote" }),
      editUrl: function (id) {
        return RA.url("admin/") + "#/products/batch/edit/" + id + "/";
      },
      listDisplay: [
        { label: "Produtor", name: "get_farmer_name" },
        { label: "Propriedade", name: "get_farm_name" },
        { label: "Produto", name: "get_product_name" },
        { label: "Data da colheita", name: "get_formatted_harvest_date" },
        { label: "Número", name: "number" }
      ]
    }
  };

  // ------------------------------------------------------------------ textos (__str__ e métodos dos models)
  var S = (MA.S = {
    farmerName: function (farm, idx) {
      var u = farm ? idx.userByProfile[farm.farmer_profile_id] : null;
      return u ? u.name : "";
    },
    batchProductName: function (b, idx) {
      // BatchMixin.get_product_name
      var p = idx.products[b.product_id],
        u = idx.units[b.unit_id];
      return (p ? p.name : "") + " (" + (u ? u.symbol : "") + ")";
    },
    batchName: function (b, idx) {
      return "Lote nº " + b.number + " de " + S.batchProductName(b, idx);
    },
    product: function (p) {
      return p ? p.name + " (" + p.variety + ")" : "";
    },
    certificate: function (c, idx) {
      var t = idx.certificate_types[c.certificate_type_id];
      var certifier = " ";
      if (c.certifier !== null && c.certifier !== undefined && String(c.certifier).trim() !== "") certifier = " (" + c.certifier + ") - ";
      // No original, number vazio (None) quebrava a página; aqui fica em branco
      return (c.number === null || c.number === undefined ? "" : c.number) + certifier + (t ? t.name : "");
    },
    batchTag: function (t, idx) {
      var b = idx.batches[t.batch_id];
      var p = b ? idx.products[b.product_id] : null;
      return t.id + " (" + (p ? p.name : "") + ")";
    },
    amountUnit: function (t, idx) {
      var b = idx.batches[t.batch_id];
      var u = b ? idx.units[b.unit_id] : null;
      return RA.intcomma(t.amount) + " " + (u ? u.symbol : "");
    }
  });

  // Valores das listas (django.contrib.admin display_for_field)
  function txt(v) {
    return v === null || v === undefined ? null : e(v);
  }

  // ------------------------------------------------------------------ Produtores (FarmerProfileModelAdmin_Staff)
  MA.register({
    key: "farmers.farmerprofile",
    url: "farmers/farmerprofile/",
    icon: "users",
    menuLabel: "Produtores",
    verbose: "produtor",
    verbosePlural: "produtores",
    canProcess: isStaff,
    perms: {
      list: isStaff,
      create: function () {
        return false;
      },
      edit: function () {
        return true;
      },
      delete: function () {
        return false;
      }
    },
    editLabel: "Visualizar",
    maleAddOne: true,
    emptyText: "Nenhum produtor foi cadastrado ainda.",
    indexCss: [],
    ordering: ["user__name"],
    sortValue: function (p, f) {
      if (f === "user__name") return p._user ? p._user.name : null;
      return p[f];
    },
    queryset: function (ctx) {
      var idx = ctx.idx;
      return Promise.resolve(
        idx.farmer_profiles_list.map(function (p) {
          var x = RA.clone(p);
          x._user = idx.userByProfile[p.id] || null;
          x._sub = p.subscription_id ? idx.subscriptions[p.subscription_id] : null;
          return x;
        })
      );
    },
    get: function (id, ctx) {
      var p = ctx.idx.farmer_profiles[id];
      return Promise.resolve(p ? $.extend({}, p, { _user: ctx.idx.userByProfile[p.id] || null }) : null);
    },
    searchValues: function (p) {
      return [p._user ? p._user.name : "", p._user ? p._user.cpf_cnpj : "", p._user ? p._user.email : "", p.telephone];
    },
    list: [
      { name: "get_name", label: "Nome ou razão social", value: function (p) {
        return txt(p._user ? p._user.name : "");
      } },
      { name: "get_cpf_cnpj", label: "CPF ou CNPJ", value: function (p) {
        return txt(RA.fmtCpfCnpj(p._user ? p._user.cpf_cnpj : ""));
      } },
      { name: "get_email", label: "E-mail", value: function (p) {
        return txt(p._user ? p._user.email : "");
      } },
      { name: "get_telephone", label: "Telefone", value: function (p) {
        return txt(RA.fmtPhone(p.telephone || ""));
      } },
      { name: "get_plan_name", label: "Plano", value: function (p) {
        return p._sub ? e(api.planName(p._sub.plan)) : "-";
      } },
      { name: "get_subscription_status", label: "Situação", value: function (p) {
        return p._sub ? "<span id='subscription-status-" + e(p._sub.subscription_id) + "'>" + e(api.subStatusDisplay(p._sub)) + "</span>" : "-";
      } }
    ],
    extraButtons: function (ctx, p) {
      if (p._sub && api.subCanSettle(p._sub)) {
        return [
          {
            url: "",
            label: "Marcar assinatura como paga",
            classname: "button button-small btn-settle",
            title: "Marcar assinatura como paga",
            attrs: { "data-subscription-id": String(p._sub.subscription_id), style: "cursor: pointer;" }
          }
        ];
      }
      return [];
    },
    str: function (p, ctx) {
      var u = p._user || ctx.idx.userByProfile[p.id];
      return u ? u.name + " (" + RA.fmtCpfCnpj(u.cpf_cnpj) + ")" : "";
    }
    // afterIndex, formSpec, etc. em pages.js (página "Visualizando")
  });

  // ------------------------------------------------------------------ Certificados (CertificateTypeModelAdmin_Staff)
  MA.register({
    key: "farmers.certificatetype",
    url: "farmers/certificatetype/",
    icon: "doc-full-inverse",
    menuLabel: "Certificados",
    verbose: "certificado",
    verbosePlural: "certificados",
    canProcess: isStaff,
    perms: allowAll,
    maleAddOne: true,
    emptyText: "Nenhum tipo de certificado foi adicionado ainda.",
    ordering: [],
    queryset: function (ctx) {
      return Promise.resolve(
        ctx.idx.certificate_types_list.filter(function (t) {
          return t.is_active;
        })
      );
    },
    get: function (id, ctx) {
      return Promise.resolve(ctx.idx.certificate_types[id] || null);
    },
    searchValues: function (t) {
      return [t.name, t.alert_message];
    },
    list: [
      { name: "name", label: "Nome", sort: "name", value: function (t) {
        return txt(t.name);
      } },
      { name: "alert_message", label: "Mensagem de alerta", sort: "alert_message", value: function (t) {
        return txt(t.alert_message);
      } }
    ],
    formSpec: function () {
      return {
        objects: [
          { panel: "row", children: [
            { panel: "field", field: { name: "name", label: "Nome", kind: "textarea", required: true } },
            { panel: "field", field: { name: "alert_message", label: "Mensagem de alerta", kind: "textarea" } }
          ] },
          { panel: "row", children: [
            { panel: "field", field: { name: "certificate_logo", label: "Logotipo", kind: "file", required: true, fileKey: "certificate_logo_name",
              uploadPath: function (n) {
                return n;
              },
              fileName: function (v) {
                // certificate_logo_image_path: "certificates/logos/cert_<id>/<arquivo>"
                return "certificates/logos/cert_" + (v.id || "") + "/" + (v.certificate_logo_name || "logo.png");
              } } }
          ] }
        ]
      };
    },
    formValues: function (t) {
      return RA.clone(t);
    },
    save: function (v, obj) {
      return api.saveCertificateType(v, obj);
    },
    remove: function (t) {
      return api.deactivateCertificateType(t.id);
    },
    str: function (t) {
      return t.name;
    }
  });

  // ------------------------------------------------------------------ Unidades (UnitModelAdmin_Staff)
  function linkedBatchesDisplay(err, ctx) {
    return (err.linked || []).map(function (b) {
      return { type: "Lote", str: b.number };
    });
  }

  MA.register({
    key: "products.unit",
    url: "products/unit/",
    icon: "balance-scale",
    menuLabel: "Unidades",
    verbose: "unidade",
    verbosePlural: "unidades",
    canProcess: isStaff,
    perms: allowAll,
    maleAddOne: false,
    emptyText: "Nenhuma unidade foi adicionada ainda.",
    ordering: [],
    queryset: function (ctx) {
      return Promise.resolve(ctx.idx.units_list.slice());
    },
    get: function (id, ctx) {
      return Promise.resolve(ctx.idx.units[id] || null);
    },
    searchValues: function (u) {
      return [u.name, u.symbol];
    },
    list: [
      { name: "name", label: "nome", sort: "name", value: function (u) {
        return txt(u.name);
      } },
      { name: "symbol", label: "Símbolo", sort: "symbol", value: function (u) {
        return txt(u.symbol);
      } }
    ],
    formSpec: function () {
      return {
        objects: [
          { panel: "field", field: { name: "name", label: "Nome", kind: "textarea", required: true } },
          { panel: "field", field: { name: "symbol", label: "Símbolo", kind: "textarea", required: true } }
        ]
      };
    },
    formValues: function (u) {
      return RA.clone(u);
    },
    save: function (v, obj) {
      return api.saveUnit(v, obj);
    },
    remove: function (u, ctx) {
      return api.deleteUnit(u.id).catch(function (err) {
        if (err.protected) err.linkedDisplay = linkedBatchesDisplay(err, ctx);
        throw err;
      });
    },
    str: function (u) {
      return u.name + " (" + u.symbol + ")";
    }
  });

  // ------------------------------------------------------------------ Produtos (ProductModelAdmin_Staff)
  MA.register({
    key: "products.product",
    url: "products/product/",
    icon: "carrot",
    menuLabel: "Produtos",
    verbose: "produto",
    verbosePlural: "produtos",
    canProcess: isStaff,
    perms: allowAll,
    maleAddOne: true,
    emptyText: "Nenhum produto foi adicionado ainda.",
    ordering: ["name", "variety"],
    queryset: function (ctx) {
      return Promise.resolve(ctx.idx.products_list.slice());
    },
    get: function (id, ctx) {
      return Promise.resolve(ctx.idx.products[id] || null);
    },
    searchValues: function (p) {
      return [p.name, p.variety];
    },
    list: [
      { name: "name", label: "nome", sort: "name", value: function (p) {
        return txt(p.name);
      } },
      { name: "variety", label: "variedade", sort: "variety", value: function (p) {
        return txt(p.variety);
      } }
    ],
    formSpec: function () {
      return {
        objects: [
          { panel: "field", field: { name: "name", label: "Nome", kind: "textarea", required: true } },
          { panel: "field", field: { name: "variety", label: "Variedade", kind: "textarea", required: true } }
        ]
      };
    },
    formValues: function (p) {
      return RA.clone(p);
    },
    save: function (v, obj) {
      return api.saveProduct(v, obj);
    },
    remove: function (p, ctx) {
      return api.deleteProduct(p.id).catch(function (err) {
        if (err.protected) err.linkedDisplay = linkedBatchesDisplay(err, ctx);
        throw err;
      });
    },
    str: function (p) {
      return S.product(p);
    }
  });

  // ------------------------------------------------------------------ Lotes (BatchModelAdmin_Staff / BatchModelAdmin_Farmer)
  function batchOwner(ctx, b) {
    var f = ctx.idx.farms[b.farm_id];
    return !!f && !!ctx.profile && f.farmer_profile_id === ctx.profile.id;
  }
  function batchHasTags(ctx, b) {
    return ctx.idx.batch_tags_list.some(function (t) {
      return t.batch_id === b.id;
    });
  }

  function batchList(staff) {
    var cols = [
      { name: "number", label: "número", sort: "number", value: function (b) {
        return txt(b.number);
      } },
      { name: "get_product_name", label: "Produto", value: function (b, ctx) {
        return txt(S.batchProductName(b, ctx.idx));
      } }
    ];
    if (staff) {
      cols.push({ name: "get_farmer_name", label: "Produtor", value: function (b, ctx) {
        return txt(S.farmerName(ctx.idx.farms[b.farm_id], ctx.idx));
      } });
    }
    cols.push(
      { name: "get_farm_name", label: "Propriedade", value: function (b, ctx) {
        var f = ctx.idx.farms[b.farm_id];
        return txt(f ? f.name : "");
      } },
      { name: "harvest_date", label: "data da colheita", sort: "harvest_date", nowrap: true, value: function (b) {
        return txt(RA.fmtDate(b.harvest_date));
      } },
      { name: "technical_manager", label: "responsável técnico", sort: "technical_manager", nowrap: true, value: function (b, ctx) {
        var t = ctx.idx.technical_managers[b.technical_manager_id];
        return t ? e(api.str.technicalManager(t)) : null;
      } },
      { name: "get_certificates", label: "Certificados", value: function (b, ctx) {
        return (
          "<ul>" +
          (b.certificate_ids || [])
            .map(function (id) {
              var c = ctx.idx.certificates[id];
              return c ? "<li>" + e(S.certificate(c, ctx.idx)) + "</li>" : "";
            })
            .join("") +
          "</ul>"
        );
      } },
      { name: "get_batch_tags_count", label: "Número de etiquetas", value: function (b, ctx) {
        return String(
          ctx.idx.batch_tags_list.filter(function (t) {
            return t.batch_id === b.id;
          }).length
        );
      } }
    );
    return cols;
  }

  function batchFormSpec(staff) {
    return function (ctx) {
      var idx = ctx.idx;
      var products = MA.sortBy(idx.products_list, ["name", "variety"], function (p, f) {
        return p[f];
      });
      var certAlerts = !staff;
      return {
        objects: [
          { panel: "field", field: { name: "farm", key: "farm_id", label: "Propriedade", kind: "chooser", required: true,
            chooser: MA.CHOOSERS[staff ? "staff_farm_chooser" : "farmer_farm_chooser"],
            display: function (v) {
              var f = idx.farms[v];
              return f ? f.name : "";
            } } },
          { panel: "field", field: { name: "number", label: "Número", kind: "textarea", required: true } },
          { panel: "field", field: { name: "harvest_date", label: "Data da colheita", kind: "date", required: true } },
          { panel: "field", field: { name: "product", key: "product_id", label: "Produto", kind: "select", required: true,
            choices: products.map(function (p) {
              return [p.id, S.product(p)];
            }) } },
          { panel: "field", field: { name: "unit", key: "unit_id", label: "Unidade", kind: "select", required: true,
            choices: idx.units_list.map(function (u) {
              return [u.id, u.name + " (" + u.symbol + ")"];
            }) } },
          { panel: "field", field: { name: "technical_manager", key: "technical_manager_id", label: "Responsável técnico", kind: "chained", trigger: "farm",
            loader: function (farmId) {
              var f = idx.farms[farmId];
              if (!f) return [];
              return MA.sortBy(
                idx.technical_managers_list.filter(function (t) {
                  return t.farmer_profile_id === f.farmer_profile_id;
                }),
                ["name"],
                function (t, k) {
                  return t[k];
                }
              ).map(function (t) {
                return { value: t.id, label: api.str.technicalManager(t) };
              });
            },
            selectedLabel: function (id) {
              var t = idx.technical_managers[id];
              return t ? api.str.technicalManager(t) : "";
            } } },
          { panel: "field", field: { name: "certificates", key: "certificate_ids", label: "Certificados", kind: "chainedMulti", trigger: "farm",
            widgettype: certAlerts ? "certificates_chained_multi_select_widget" : "chained_multi_select_widget",
            loader: function (farmId) {
              var f = idx.farms[farmId];
              if (!f) return [];
              var today = RA.today();
              return MA.sortBy(
                idx.certificates_list.filter(function (c) {
                  var t = idx.certificate_types[c.certificate_type_id];
                  return c.farmer_profile_id === f.farmer_profile_id && t && t.is_active && (!c.valid_until_date || c.valid_until_date >= today);
                }),
                ["certifier"],
                function (c, k) {
                  return c[k];
                }
              ).map(function (c) {
                var t = idx.certificate_types[c.certificate_type_id];
                return { value: c.id, label: S.certificate(c, idx), alert: t && t.alert_message ? t.alert_message : "" };
              });
            },
            optionHTML: certAlerts
              ? function (it, checked, name) {
                  // products/widgets.py CertificatesChainedMultiSelectWidget
                  return (
                    '\n        <label>\n            <input type="checkbox" name="' + name + '" value="' + e(it.value) + '" ' + (checked ? 'checked="checked"' : "") + ">" + e(it.label) +
                    '\n        </label>\n        <p class="certificate-alert" style="color: #717171; padding-left: 35px; ' + (checked ? "" : "display: none;") + '">' + e(it.alert) + "</p>\n        "
                  );
                }
              : null } },
          { panel: "field", field: { name: "image", label: "Imagem do lote", kind: "file", fileKey: "image_name",
            uploadPath: function (n) {
              return "products/batch-images/" + n;
            },
            fileName: function (v) {
              return v.image_name || "products/batch-images/batch.png";
            } } }
        ]
      };
    };
  }

  function batchAdmin(staff) {
    return {
      key: "products.batch",
      url: "products/batch/",
      icon: "box",
      menuLabel: "Lotes",
      verbose: "lote",
      verbosePlural: "lotes",
      canProcess: staff ? isStaff : isSubscribedFarmer,
      perms: {
        list: function () {
          return true;
        },
        create: function () {
          return true;
        },
        edit: function (ctx, b) {
          return (staff || batchOwner(ctx, b)) && !batchHasTags(ctx, b);
        },
        delete: function (ctx, b) {
          return (staff || batchOwner(ctx, b)) && !batchHasTags(ctx, b);
        }
      },
      maleAddOne: true,
      emptyText: "Nenhum lote foi adicionado ainda.",
      ordering: ["-created_at"],
      sortValue: function (b, f, ctx) {
        if (f === "technical_manager") {
          var t = MA._idx && MA._idx.technical_managers[b.technical_manager_id];
          return t ? t.name : null;
        }
        return b[f];
      },
      queryset: function (ctx) {
        MA._idx = ctx.idx;
        return Promise.resolve(
          ctx.idx.batches_list.filter(function (b) {
            return staff || batchOwner(ctx, b);
          })
        );
      },
      get: function (id, ctx) {
        return Promise.resolve(ctx.idx.batches[id] || null);
      },
      searchValues: function (b) {
        var idx = MA._idx;
        return [S.farmerName(idx.farms[b.farm_id], idx), b.number];
      },
      list: batchList(staff),
      formSpec: batchFormSpec(staff),
      formCss: [],
      formValues: function (b) {
        return RA.clone(b);
      },
      afterForm: function () {
        if (!staff) W.loadScript("assets/js/certificates_chained_multi_select@0.0.1.js");
      },
      save: function (v, obj, ctx) {
        // ModelChooser: só aceita propriedades da lista do usuário
        if (v.farm_id && !ctx.idx.farms[v.farm_id]) v.farm_id = "";
        return api.saveBatch(v, obj);
      },
      mapErrors: function (errors) {
        return errors;
      },
      remove: function (b) {
        return api.deleteBatch(b.id);
      },
      str: function (b) {
        return b.number;
      }
    };
  }
  MA.register(batchAdmin(true));
  MA.register(batchAdmin(false));

  // ------------------------------------------------------------------ Etiquetas (BatchTagModelAdmin_Staff / _Farmer)
  function batchTagAdmin(staff) {
    var cols = [
      { name: "id", label: "Código", sort: "id", value: function (t) {
        return txt(t.id);
      } },
      { name: "get_product", label: "Produto", value: function (t, ctx) {
        var b = ctx.idx.batches[t.batch_id];
        return txt(S.product(b ? ctx.idx.products[b.product_id] : null));
      } },
      { name: "get_amount_unit", label: "Quantidade", value: function (t, ctx) {
        return txt(S.amountUnit(t, ctx.idx));
      } },
      { name: "get_batch_number", label: "Lote", value: function (t, ctx) {
        var b = ctx.idx.batches[t.batch_id];
        return txt(b ? b.number : "");
      } },
      { name: "date", label: "emissão", sort: "date", nowrap: true, value: function (t) {
        return txt(W.djangoDateTime(t.date));
      } }
    ];
    if (staff) {
      cols.push({ name: "get_farmer_name", label: "Produtor", value: function (t, ctx) {
        var b = ctx.idx.batches[t.batch_id];
        return txt(b ? S.farmerName(ctx.idx.farms[b.farm_id], ctx.idx) : "");
      } });
    } else {
      cols.push({ name: "get_farm_name", label: "Propriedade", value: function (t, ctx) {
        var b = ctx.idx.batches[t.batch_id];
        var f = b ? ctx.idx.farms[b.farm_id] : null;
        return txt(f ? f.name : "");
      } });
    }
    return {
      key: "products.batchtag",
      url: "products/batchtag/",
      icon: "qrcode",
      menuLabel: "Etiquetas",
      verbose: "etiqueta",
      verbosePlural: "etiquetas",
      canProcess: staff ? isStaff : isSubscribedFarmer,
      perPage: 10,
      perms: {
        list: function () {
          return true;
        },
        create: function () {
          return true;
        },
        edit: function () {
          return false;
        },
        delete: function () {
          return false;
        }
      },
      maleAddOne: false,
      emptyText: "Nenhuma etiqueta foi adicionada ainda.",
      ordering: ["-date"],
      queryset: function (ctx) {
        MA._idx = ctx.idx;
        return Promise.resolve(
          ctx.idx.batch_tags_list.filter(function (t) {
            if (staff) return true;
            var b = ctx.idx.batches[t.batch_id];
            return b && batchOwner(ctx, b);
          })
        );
      },
      get: function (id, ctx) {
        return Promise.resolve(ctx.idx.batch_tags[id] || null);
      },
      searchValues: function (t) {
        var idx = MA._idx;
        var b = idx.batches[t.batch_id];
        var p = b ? idx.products[b.product_id] : null;
        return [b ? S.farmerName(idx.farms[b.farm_id], idx) : "", b ? b.number : "", p ? p.name : ""];
      },
      list: cols,
      extraButtons: function (ctx, t) {
        return [
          { url: RA.url("etiqueta/" + t.id + "/"), label: "Visualizar", classname: "button button-small icon icon-view", title: "Visualizar etiqueta", target: "_blank" },
          { url: RA.url("etiqueta/imprimir/" + t.id + "/"), label: "Imprimir", classname: "button button-small icon icon-doc-empty", title: "Imprimir etiqueta", target: "_blank" }
        ];
      },
      formSpec: function (ctx) {
        var idx = ctx.idx;
        return {
          objects: [
            { panel: "field", field: { name: "batch", key: "batch_id", label: "Lote", kind: "chooser", required: true, chooserOptional: true,
              chooser: MA.CHOOSERS[staff ? "staff_batch_chooser" : "farmer_batch_chooser"],
              display: function (v) {
                var b = idx.batches[v];
                return b ? S.batchName(b, idx) : "";
              } } },
            { panel: "field", field: { name: "amount", label: "Quantidade do produto", kind: "number", required: true } }
          ]
        };
      },
      formValues: function (t) {
        return RA.clone(t);
      },
      save: function (v, obj, ctx) {
        var b = ctx.idx.batches[v.batch_id];
        if (v.batch_id && (!b || (!staff && !batchOwner(ctx, b)))) v.batch_id = "";
        return api.createBatchTag({ batch_id: v.batch_id, amount: v.amount });
      },
      str: function (t, ctx) {
        return S.batchTag(t, ctx.idx || MA._idx);
      },
      successMessage: function (t, isEdit, ctx) {
        return "Etiqueta '" + S.batchTag(t, MA._idxAfterSave || ctx.idx) + "' " + (isEdit ? "atualizado." : "criado.");
      }
    };
  }
  MA.register(batchTagAdmin(true));
  MA.register(batchTagAdmin(false));

  // ------------------------------------------------------------------ Cadernos (FarmJournalModelAdmin_Farmer)
  MA.register({
    key: "farm_journals.farmjournal",
    url: "farm_journals/farmjournal/",
    icon: "clipboard-list",
    menuLabel: "Cadernos",
    verbose: "caderno",
    verbosePlural: "cadernos",
    canProcess: isSubscribedFarmer,
    perms: {
      list: function () {
        return true;
      },
      create: function () {
        return true;
      },
      edit: function (ctx, j) {
        var f = ctx.idx.farms[j.farm_id];
        return !!f && !!ctx.profile && f.farmer_profile_id === ctx.profile.id;
      },
      delete: function () {
        return true;
      }
    },
    maleAddOne: true,
    emptyText: "Nenhum caderno foi adicionado ainda.",
    ordering: ["-plantation_date"],
    extraOrdering: ["-creation_date"],
    queryset: function (ctx) {
      MA._idx = ctx.idx;
      return Promise.resolve(
        ctx.idx.farm_journals_list.filter(function (j) {
          var f = ctx.idx.farms[j.farm_id];
          return f && ctx.profile && f.farmer_profile_id === ctx.profile.id;
        })
      );
    },
    get: function (id, ctx) {
      return Promise.resolve(ctx.idx.farm_journals[id] || null);
    },
    searchValues: function (j) {
      var f = MA._idx.farms[j.farm_id];
      return [f ? f.name : "", j.field_identification];
    },
    list: [
      { name: "field_identification", label: "número e/ou identificação do talhão", sort: "field_identification", value: function (j) {
        return txt(j.field_identification);
      } },
      { name: "get_farm_name", label: "Propriedade", value: function (j, ctx) {
        var f = ctx.idx.farms[j.farm_id];
        return txt(f ? f.name : "");
      } },
      { name: "get_products", label: "Produto(s)", value: function (j, ctx) {
        // display_for_value(lista) -> ", ".join; lista vazia -> "-"
        var names = (j.product_ids || [])
          .map(function (id) {
            var p = ctx.idx.products[id];
            return p ? p.name + " " + p.variety : null;
          })
          .filter(Boolean);
        return e(names.join(", "));
      } },
      { name: "plantation_date", label: "data de plantio", sort: "plantation_date", nowrap: true, value: function (j) {
        return txt(RA.fmtDate(j.plantation_date));
      } }
    ],
    extraButtons: function (ctx, j) {
      return [{ url: RA.url("cadernos/imprimir/" + j.id + "/"), label: "Imprimir", classname: "button button-small icon icon-doc-empty", title: "Imprimir caderno", target: "_blank" }];
    },
    str: function (j) {
      return j.field_identification;
    }
    // formulário com abas: pages.js (journalForm)
  });
})(window, window.jQuery);
