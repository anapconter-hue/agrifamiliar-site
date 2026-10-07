/*
 * Páginas do produtor e da equipe que não são cadastros simples:
 *  - "Meus dados" (farmers/wagtail_hooks/farmers.py FarmerProfileDataModelAdmin)
 *  - "Minha assinatura" (FarmerSubscriptionAdmin) e o painel de assinatura bloqueada
 *  - "Visualizando" produtor (farmers/wagtail_hooks/staff.py FarmerProfileModelAdmin_Staff)
 *  - Caderno com abas e registros (farm_journals/wagtail_hooks/farmers.py)
 */
(function (window, $) {
  "use strict";

  var RA = window.RA;
  var W = window.W;
  var F = window.F;
  var MA = window.MA;
  var PG = window.PG;
  var api = RA.api;
  var e = RA.esc;
  var FARMER = (window.FARMER = {});

  function byName(a, b) {
    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
  }

  // ------------------------------------------------------------------ core/edit_handlers/select_coordinates_panel.html
  var COORD_STYLE =
    "<style>\n\t.app-modal-overlay {position: fixed;box-sizing: border-box;left: 0;top: 0;width: 100%;height: 100vh;background: rgba(0, 0, 0, 0.2);z-index: 999;opacity: 1;}" +
    ".app-modal-background-click {width: 100%;min-height: 100vh;height: auto;display: flex;flex-direction: column;align-items: center;}" +
    ".app-modal-box {overflow: auto;box-sizing: border-box;background-color: white;text-align: left;border-radius: 3px;box-shadow: 0 20px 60px -2px rgb(27 33 58 / 40%);padding: 0;height: 100%;margin: auto;}" +
    ".app-modal-content {padding: 30px;}.app-modal-footer {text-align: right;margin-top: 30px;}</style>";

  var CLOSE_SVG =
    '<svg style="cursor: pointer; width: 20px; height: 20px;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#ffffff" d="M13.313 11.313c0 0.219-0.094 0.438-0.25 0.594l-1.219 1.219c-0.156 0.156-0.375 0.25-0.625 0.25-0.219 0-0.438-0.094-0.594-0.25l-2.625-2.625-2.625 2.625c-0.156 0.156-0.375 0.25-0.594 0.25-0.25 0-0.469-0.094-0.625-0.25l-1.219-1.219c-0.156-0.156-0.25-0.375-0.25-0.594 0-0.25 0.094-0.438 0.25-0.625l2.625-2.625-2.625-2.625c-0.156-0.156-0.25-0.375-0.25-0.594 0-0.25 0.094-0.438 0.25-0.625l1.219-1.188c0.156-0.188 0.375-0.25 0.625-0.25 0.219 0 0.438 0.063 0.594 0.25l2.625 2.625 2.625-2.625c0.156-0.188 0.375-0.25 0.594-0.25 0.25 0 0.469 0.063 0.625 0.25l1.219 1.188c0.156 0.188 0.25 0.375 0.25 0.625 0 0.219-0.094 0.438-0.25 0.594l-2.625 2.625 2.625 2.625c0.156 0.188 0.25 0.375 0.25 0.625z"></path></svg>';
  FARMER.CLOSE_SVG = CLOSE_SVG;

  function selectCoordinatesPanel(prefix) {
    var id = prefix + "-select-coordinates";
    return {
      panel: "html",
      html: function () {
        return COORD_STYLE + '\n\n<div style="text-align: center;" id="' + id + '"></div>';
      },
      onBind: function (root) {
        var $entry = $(root).find("#" + id);
        var latId = "#id_" + prefix + "-latitude",
          lngId = "#id_" + prefix + "-longitude",
          cityId = "#id_" + prefix + "-city",
          stateId = "#id_" + prefix + "-state";
        var state = {
          coordinates: {
            lat: $(root).find(latId).val() ? Number($(root).find(latId).val()) : null,
            lng: $(root).find(lngId).val() ? Number($(root).find(lngId).val()) : null
          }
        };
        var $button = $('<button class="button" type="button">Localizar propriedade no mapa</button>');
        $entry.empty().append($button);
        $button.on("click", function () {
          var geocode;
          if ($(cityId).val() !== "" && $(stateId).val() !== "") {
            geocode = $(cityId + " option:selected").text() + ", " + $(stateId + " option:selected").text();
          }
          var $overlay = $('<div class="app-modal-overlay"></div>');
          var $bg = $('<div class="app-modal-background-click"></div>');
          var $box = $('<div class="app-modal-box"></div>').css("width", "800px");
          $bg.append($box);
          $overlay.append($bg);
          $("body").append($overlay);
          function close() {
            $overlay.remove();
          }
          $bg.on("click", function (ev) {
            if (ev.target === $bg[0]) close();
          });
          var $header = $('<header class="nice-padding" style="display:flex; flex-direction: row; justify-content: center; align-items: center; margin-bottom:0px;"></header>');
          var $close = $(CLOSE_SVG);
          $header.append('<h1 style="flex-grow: 1">Informar localização no mapa</h1>').append($close);
          var $map = $("<div style='height: 500px; width 100%;'></div>");
          var $save = $("<button type='button' class='button'>Salvar</button>");
          var $content = $("<div class='app-modal-content'></div>")
            .append(
              "<p>Para informar a <strong>localização</strong> da sua propriedade, mova o <strong>marcador vermelho</strong> que se encontra no <strong>centro</strong> do mapa até a localização desejada e clique em <strong>Salvar</strong>.</p>"
            )
            .append($map)
            .append($("<div class='app-modal-footer'></div>").append($save));
          $box.append($("<div></div>").append($header).append($content));
          $close.on("click", close);
          var editor = null;
          var has = !!state.coordinates.lat && !!state.coordinates.lng;
          Promise.resolve(has ? null : RA.maps.geocode(geocode)).then(function (found) {
            var center, zoom;
            if (has) {
              center = state.coordinates;
              zoom = 15;
            } else if (found) {
              center = found;
              zoom = 15;
            } else {
              center = { lat: -24.4382356, lng: -50.9296228 };
              zoom = 8;
            }
            RA.maps.pointEditor($map[0], center, zoom).then(function (ed) {
              editor = ed;
            });
          });
          $save.on("click", function () {
            if (!editor) return;
            var c = editor.getPosition();
            $(root).find(latId).val(c.lat);
            $(root).find(lngId).val(c.lng);
            state.coordinates = c;
            close();
          });
        });
      }
    };
  }

  // ------------------------------------------------------------------ Meus dados
  FARMER.meusDadosSpec = function (ctx, readOnly) {
    var idx = ctx.idx;
    var ro = !!readOnly;
    function f(def) {
      if (ro) def.readOnly = true;
      return { panel: "field", field: def };
    }
    return RA.loadStates().then(function (states) {
      var stateChoices = states.map(function (s) {
        return [s.abbreviation, s.name];
      });
      var citiesOf = function (stateId) {
        var s = states.filter(function (x) {
          return x.abbreviation === stateId;
        })[0];
        return s
          ? s.cities.map(function (c) {
              return { value: RA.cityId(s.abbreviation, c), label: c };
            })
          : [];
      };
      var certTypes = idx.certificate_types_list.filter(function (t) {
        return ro || t.is_active;
      });
      var userChildren = [
        f({ name: "person_type", label: "Tipo", kind: "choice", required: true, choices: [["PF", "Pessoa Física"], ["PJ", "Pessoa Jurídica"]] }),
        f({ name: "name", label: "Nome ou razão social", kind: "text", required: true, maxlength: 255 }),
        f({ name: "cpf_cnpj", label: "CPF ou CNPJ", kind: "text", required: true, maxlength: 30 }),
        f({ name: "email", label: "Email", kind: "email", required: true, maxlength: 254 })
      ];
      if (!ro) userChildren.push({ panel: "html", html: "<div id='change_password_app'></div>" });
      var cityField = ro
        ? f({ name: "city", label: "Cidade", kind: "select", classname: "city", required: true, choicesFor: true })
        : f({ name: "city", label: "Cidade", kind: "chained", required: true, trigger: "state", loader: citiesOf, fieldtype: "model_choice_field" });
      var farmChildren = [
        f({ name: "name", label: "Nome", kind: "text", required: true, maxlength: 255 }),
        { panel: "row", children: [
          f({ name: "street", label: "Logradouro", kind: "textarea", required: true }),
          f({ name: "number", label: "Número", kind: "text", maxlength: 10 })
        ].map(function (p, i) {
          p.classname = i === 0 ? "street" : "number";
          return p;
        }) },
        { panel: "row", children: [
          f({ name: "extra", label: "Complemento", kind: "textarea" }),
          f({ name: "neighborhood", label: "Bairro", kind: "textarea", required: true })
        ].map(function (p, i) {
          p.classname = i === 0 ? "extra" : "neighborhood";
          return p;
        }) },
        { panel: "row", children: [
          (function () {
            var p = f({ name: "state", label: "Estado", kind: "select", required: true, choices: stateChoices });
            p.classname = "state";
            return p;
          })(),
          (function () {
            if (ro) cityField.classname = "city";
            return cityField;
          })()
        ] },
        { panel: "row", children: [
          f({ name: "zip_code", label: "CEP", kind: "text", required: true, maxlength: 15 }),
          f({ name: "ccir", label: "CCIR", kind: "text", maxlength: 20 })
        ].map(function (p, i) {
          p.classname = i === 0 ? "zip_code" : "ccir";
          return p;
        }) }
      ];
      if (ro) {
        farmChildren.push({ panel: "row", children: [
          (function () {
            var p = f({ name: "latitude", label: "Latitude", kind: "number" });
            p.classname = "latitude";
            return p;
          })(),
          (function () {
            var p = f({ name: "longitude", label: "Longitude", kind: "number" });
            p.classname = "longitude";
            return p;
          })()
        ] });
      } else {
        farmChildren.push(f({ name: "total_hectares", label: "Área total em hectares", kind: "number", required: true }));
        var lat = f({ name: "latitude", label: "Latitude", kind: "hidden", fieldtype: "float_field" });
        lat.classname = "latitude";
        var lng = f({ name: "longitude", label: "Longitude", kind: "hidden", fieldtype: "float_field" });
        lng.classname = "longitude";
        farmChildren.push(lat, lng);
        farmChildren.push({ panel: "html", html: "", onBind: null, dynamic: "coords" });
      }
      var certChildren = [
        { panel: "row", children: [
          f({ name: "number", label: "Número", kind: "textarea" }),
          f({ name: "certifier", label: "Certificadora", kind: "textarea" })
        ] },
        ro
          ? { panel: "row", children: [f({ name: "certificate_type", label: "Tipo", kind: "select", required: true, choices: certTypes.map(function (t) {
              return [t.id, t.name];
            }) })] }
          : { panel: "row", children: [
              f({ name: "valid_until_date", label: "Data de validade", kind: "date" }),
              f({ name: "certificate_type", label: "Tipo", kind: "select", required: true, choices: certTypes.map(function (t) {
                return [t.id, t.name];
              }) })
            ] }
      ];
      var objects = [
        { panel: "inline", name: "user_set", heading: "Dados de acesso", classname: "user-info", minNum: 1, maxNum: 1, readOnly: ro, children: userChildren },
        { panel: "multi", heading: "Outras informações", children: [
          f({ name: "birth_date", label: "Data de nascimento", kind: "date" }),
          f({ name: "telephone", label: "Telefone", kind: "text", maxlength: 20 }),
          f({ name: "description", label: "Descrição", kind: "textarea" }),
          f({ name: "logo_image", label: "Logotipo", kind: "file", fileKey: "logo_image_name",
            uploadPath: function (n) {
              return "farmers/logos/" + n;
            },
            fileName: function (v) {
              return v.logo_image_name || "farmers/logos/logo.png";
            } }),
          f({ name: "profile_image", label: "Imagem de perfil", kind: "file", fileKey: "profile_image_name",
            uploadPath: function (n) {
              return "farmers/profile-images/" + n;
            },
            fileName: function (v) {
              return v.profile_image_name || "farmers/profile-images/perfil.png";
            } })
        ] },
        { panel: "inline", name: "farm_set", heading: "Propriedades", minNum: 1, readOnly: ro, children: farmChildren },
        { panel: "inline", name: "technicalmanager_set", heading: "Responsáveis técnicos", minNum: 0, readOnly: ro, children: [
          { panel: "row", children: [f({ name: "name", label: "Nome", kind: "textarea", required: true })] },
          { panel: "row", children: [
            f({ name: "number", label: "Número do registro", kind: "textarea", required: true }),
            f({ name: "number_type", label: "Entidade", kind: "choice", required: true, choices: [["CREA", "CREA"], ["CFTA", "CFTA"], ["CRMV", "CRMV"]] })
          ] }
        ] },
        { panel: "inline", name: "certificates", prefix: ro ? "certificate_set" : "get_active_certificates", heading: "Certificados", minNum: 0, readOnly: ro, children: certChildren }
      ];
      // Painel de coordenadas: precisa do prefixo de cada propriedade
      objects[2].children = objects[2].children.map(function (c) {
        if (c.dynamic !== "coords") return c;
        return {
          panel: "html",
          html: function (prefix) {
            return selectCoordinatesPanel(prefix).html();
          },
          onBind: function (root, prefix) {
            selectCoordinatesPanel(prefix).onBind(root);
          }
        };
      });
      return { objects: objects, states: states, citiesOf: citiesOf };
    });
  };

  FARMER.meusDadosValues = function (ctx, profile, user, readOnly) {
    var idx = ctx.idx;
    var farms = idx.farms_list
      .filter(function (f) {
        return f.farmer_profile_id === profile.id;
      })
      .sort(byName)
      .map(function (f) {
        var x = RA.clone(f);
        x.state = f.state_id;
        x.city = f.city_id;
        return x;
      });
    var tms = idx.technical_managers_list
      .filter(function (t) {
        return t.farmer_profile_id === profile.id;
      })
      .sort(byName);
    var certs = MA.sortBy(
      idx.certificates_list.filter(function (c) {
        var t = idx.certificate_types[c.certificate_type_id];
        return c.farmer_profile_id === profile.id && (readOnly || (t && t.is_active));
      }),
      ["certifier"],
      function (c, k) {
        return c[k];
      }
    ).map(function (c) {
      var x = RA.clone(c);
      x.certificate_type = c.certificate_type_id;
      return x;
    });
    return {
      user_set: [{ id: user.id, person_type: user.person_type, name: user.name, cpf_cnpj: user.cpf_cnpj, email: user.email }],
      birth_date: profile.birth_date,
      telephone: profile.telephone,
      description: profile.description,
      logo_image: profile.logo_image,
      logo_image_name: profile.logo_image_name,
      profile_image: profile.profile_image,
      profile_image_name: profile.profile_image_name,
      farm_set: farms,
      technicalmanager_set: tms,
      certificates: certs
    };
  };

  // Erros da API -> nomes dos campos do formulário do Django
  function mapFarmerErrors(errors) {
    var out = {};
    Object.keys(errors).forEach(function (k) {
      var nk = k
        .replace(/^user\./, "user_set.0.")
        .replace(/^profile\./, "")
        .replace(/^farms\./, "farm_set.")
        .replace(/^technical_managers\./, "technicalmanager_set.")
        .replace(/^certificates\./, "get_active_certificates.")
        .replace(/\.state_id$/, ".state")
        .replace(/\.city_id$/, ".city")
        .replace(/\.certificate_type_id$/, ".certificate_type");
      out[nk] = errors[k];
    });
    return out;
  }

  FARMER.meusDados = function (ctx, values, errors, messages) {
    var user = ctx.user,
      profile = ctx.profile;
    return FARMER.meusDadosSpec(ctx, false).then(function (spec) {
      var vals = values || FARMER.meusDadosValues(ctx, profile, user, false);
      var form = new F.Form({ objects: spec.objects }, vals, errors || {});
      var html = MA.formPage({
        def: { icon: "user", url: "p/meus-dados/" },
        form: form,
        title: "Meus dados",
        subtitle: "",
        canDelete: false
      });
      return {
        title: "Editando produtor",
        css: ["editor", "profileform"],
        messages: messages,
        html: html,
        after: function (root) {
          MA.bindForm(root, form, function (v) {
            var data = {
              user: v.user_set[0],
              profile: {
                birth_date: v.birth_date,
                telephone: v.telephone,
                description: v.description,
                logo_image: v.logo_image,
                logo_image_name: v.logo_image_name,
                profile_image: v.profile_image,
                profile_image_name: v.profile_image_name
              },
              farms: (v.farm_set || []).map(function (f) {
                var x = RA.clone(f);
                x.state_id = f.state;
                x.city_id = f.city;
                return x;
              }),
              technical_managers: v.technicalmanager_set || [],
              certificates: (v.certificates || []).map(function (c) {
                var x = RA.clone(c);
                x.certificate_type_id = c.certificate_type;
                return x;
              })
            };
            return api
              .saveFarmerData(user.id, data)
              .then(function () {
                W.flash("success", "Seus dados foram atualizados.");
                window.ADMIN.route(true);
              })
              .catch(function (err) {
                if (err && err.protected) {
                  // core/middleware.py HandleProtectionErrorMiddleware
                  W.flash("error", e(err.errors.__all__[0]));
                  window.ADMIN.route(true);
                  return;
                }
                if (!err || err.name !== "ValidationError") throw err;
                FARMER.meusDados(ctx, v, mapFarmerErrors(err.errors), [{ level: "error", html: "O produtor não pôde ser salvo devido a erros." }]).then(
                  window.ADMIN.renderPage
                );
              });
          });
          W.initErrorDetection(root);
          // Scripts originais da página
          W.loadScript("assets/js/farmer_profile_form@0.0.1.js");
          W.loadScript("assets/js/change_password@0.0.1.js");
        }
      };
    });
  };

  // ------------------------------------------------------------------ Visualizando produtor (equipe)
  FARMER.staffView = function (ctx, id) {
    var idx = ctx.idx;
    var profile = idx.farmer_profiles[id];
    if (!profile) return Promise.reject(MA.notFound());
    var user = idx.userByProfile[profile.id];
    return FARMER.meusDadosSpec(ctx, true).then(function (spec) {
      var vals = FARMER.meusDadosValues(ctx, profile, user, true);
      // Campos "somente leitura" do Django mostram o valor bruto (cidade com a lista completa)
      spec.objects[2].children.forEach(function (c) {
        if (c.panel === "row") {
          c.children.forEach(function (cc) {
            if (cc.field && cc.field.choicesFor) {
              cc.field.choices = [];
              cc.field.choicesFromRow = true;
            }
          });
        }
      });
      vals.farm_set.forEach(function (f) {
        f._cityChoice = [[f.city_id, RA.cityName(f.city_id)]];
      });
      var form = new F.Form(
        {
          tabs: [
            { heading: "Dados cadastrais", objects: spec.objects },
            { heading: "Etiquetas", html: '<ul class="objects"><li class="object "><div class="object-layout"><div class="object-layout_big-part"><div id=\'batch_tags_app\'></div></div></div></li></ul>' }
          ]
        },
        vals,
        {}
      );
      // As opções de cidade dependem de cada linha
      var origWidget = form.widget;
      form.widget = function (def, prefix, rowCtx) {
        if (def.choicesFromRow && rowCtx) def = $.extend({}, def, { choices: rowCtx._cityChoice || [] });
        return origWidget.call(this, def, prefix, rowCtx);
      };
      var str = user.name + " (" + RA.fmtCpfCnpj(user.cpf_cnpj) + ")";
      var html =
        '<style type="text/css">\n    \tfooter {\n    \t\tdisplay: none;\n    \t}\n    </style>' +
        MA.formPage({
          def: { icon: "users", url: "farmers/farmerprofile/" },
          form: form,
          headerHtml: W.header({ title: "Visualizando", subtitle: str, icon: "users", merged: true, tabbed: true }),
          canDelete: false
        });
      return {
        title: "Editando produtor",
        css: ["editor"],
        html: html,
        after: function (root) {
          form.bind(root);
          $(root)
            .find("form.ra-model-form")
            .on("submit", function (ev) {
              ev.preventDefault();
            });
          window.NESTED.batchTagsTable(root, profile.id);
        }
      };
    });
  };

  // ------------------------------------------------------------------ Minha assinatura
  function subscriptionContext(ctx) {
    var profile = ctx.profile;
    if (profile.is_demo) {
      return {
        plans: api.getPlans(false),
        canChangePlan: false,
        canManage: false,
        sub: {
          plan_id: "demo",
          plan_name: "Plano demonstrativo",
          trialing: false,
          date_created: "2021-01-01T00:00:00Z",
          status_display: "Pagamento em dia",
          payment_method_name: "Boleto Bancário",
          current_period_end: "3000-01-01T00:00:00Z",
          manage_url: null
        }
      };
    }
    var s = ctx.subscription;
    var trialing = s.status === api.SUB.TRIALING;
    var plans = api.getPlans(trialing);
    var my = api.plans().filter(function (p) {
      return p.plan_id === String(s.plan);
    })[0];
    plans = plans.filter(function (p) {
      return p.plan_id !== my.plan_id && p.trial_plan_id !== my.plan_id;
    });
    plans.unshift(my);
    return {
      plans: plans,
      canChangePlan: api.subCanManage(s),
      canManage: api.subCanManage(s),
      sub: {
        plan_id: s.plan,
        plan_name: api.planName(s.plan),
        trialing: trialing,
        date_created: s.date_created,
        status_display: api.subStatusDisplay(s),
        payment_method_name: api.paymentMethodName(s.payment_method),
        current_period_end: s.current_period_end,
        manage_url: FARMER.manageURL()
      }
    };
  }

  // Página de gerenciamento da assinatura (no original era a página do Pagar.me)
  FARMER.manageURL = function () {
    return RA.url("admin/gerenciar-assinatura.html");
  };

  // farmers/templates/farmers/includes/manage_subscription_dialog.html
  window.openSubscriptionManagementDialog = function (manageUrl, closeCallback) {
    var content = '<div><iframe height="800" width="100%" src="' + manageUrl + '" frameborder="0"></iframe></iframe></div>';
    $.dialog({
      title: "Gerenciar assinatura e forma de pagamento",
      content: content,
      onContentReady: function () {
        $(".jconfirm-open").addClass("manage-subscription-dialog");
      },
      onClose: function () {
        if (closeCallback) closeCallback();
      },
      draggable: false,
      useBootstrap: false,
      boxWidth: "800px",
      buttons: {}
    });
  };

  var MANAGE_DIALOG_STYLE =
    '<style type="text/css">\n\t.manage-subscription-dialog .jconfirm-content-pane {\n\t\tpadding: 0px !important;\n\t\tmargin-bottom: 0px !important;\n\t}\n\n\t.manage-subscription-dialog .jconfirm-buttons {\n\t\tpadding: 0px !important;\n\t}\n</style>';

  FARMER.subscriptionPage = function (ctx) {
    var c = subscriptionContext(ctx);
    var s = c.sub;
    var planPanel =
      "<style>\n\t.btn-confirm-plan {\n\t\tflex-grow: 0 !important;\n\t\talign-self: flex-end !important;\n\t\tmargin-bottom: 20px;\n\t}\n\n\t.plan-wrapper {\n\t\tmin-height: 235px;\n\t}\n</style>" +
      '\n\n<div style="display:flex; flex-direction: row;">\n\t<div style="display:flex; flex-direction: column; min-width: 300px;">\n\t\t<label style="width: 100%;" id="plan-name">' + e(s.plan_name) + "</label>" +
      '\n\t\t<p>Contratado em: <span id="date-subscription-created">' + e(RA.fmtDate(s.date_created)) + "</span></p>" +
      '\n\t\t<p id="subscription-status">Situação: ' + e(s.status_display) + "</p>\n\t</div>\n\t<div>\n\t\t" +
      (c.canChangePlan ? '<button class="button button-secondary" type="button" id="btn-change-plan">Mudar plano</button>' : "") +
      "\n\t</div>\n</div>";
    var payPanel =
      MANAGE_DIALOG_STYLE +
      '\n\n<div style="display:flex; flex-direction: row;">\n\t<div style="display:flex; flex-direction: column; min-width: 300px;">\n\t\t<label style="width: 100%;" id="payment-method-name">' + e(s.payment_method_name) + "</label>" +
      // O template original testava "subscription.payment_method" (inexistente): os dados do cartão nunca aparecem
      '\n\t\t<p id="payment-card-info" style="display:none"> </p>' +
      '\n\t\t<p>Próxima cobrança: <span id="next-charge-date" >' + e(s.current_period_end ? RA.fmtDate(s.current_period_end) : "-") + "</span></p>\n\t</div>\n\t<div>\n\t\t" +
      (c.canManage ? '<button type="button" class="button button-secondary" id="btn-manage-subscription">Gerenciar assinatura e forma de pagamento</button>' : "") +
      "\n\t</div>\n</div>";
    var nested = window.NESTED.panelHTML({ fieldName: "transaction_history", userCanCreate: false });
    function obj(heading, inner, cls) {
      return (
        '<li class="object ' + (cls ? cls + " " : "") + 'multi-field"><div class="title-wrapper"><label>' + heading + "</label></div>" +
        '<div class="object-layout"><div class="object-layout_big-part"><fieldset>\n    <legend>' + heading + '</legend>\n    <ul class="fields"><li class="">' +
        inner + "</li></ul>\n</fieldset></div></div></li>"
      );
    }
    var html =
      "<style>\n    \t.transaction-history {\n    \t\tpadding-right: 0px;\n    \t}\n\n    \t.transaction-history fieldset {\n    \t\tpadding-top: 32px;\n    \t\tmax-width: initial;\n    \t}\n\n    \t.transaction-history .pagination {\n    \t\tdisplay: none;\n    \t}\n    </style>" +
      '<header class="nice-padding merged"><div class="row header-title"><div class="left"><div class="col">' +
      '<h1 class="icon icon-shopping-cart">' + W.icon("shopping-cart", "header-title-icon") + "Minha assinatura<span></span></h1></div></div></div></header>" +
      '<form><ul class="objects">' +
      obj("Plano", planPanel) +
      obj("Forma de pagamento", payPanel) +
      obj("Histórico de pagamentos", nested, "transaction-history") +
      "</ul></form>";
    return {
      title: "Minha assinatura",
      css: ["editor", "datatable", "signup"],
      html: html,
      after: function (root) {
        FARMER.bindPlanPanel(root, c);
        FARMER.bindPaymentPanel(root, c);
        window.NESTED.initPanel(root, {
          fieldName: "transaction_history",
          columns: [
            { label: "Data", field: "date_created" },
            { label: "Forma de pagamento", field: "payment_method" },
            { label: "Valor", field: "amount" },
            { label: "Situação", field: "status" },
            { label: "", field: "buttons" }
          ],
          url: "/api/subscriptions/subscription-transactions/",
          pageSize: 10,
          parentId: "None",
          fkFieldName: "_id",
          buttonsFieldName: "date_created",
          userCanCreate: false,
          emptyText: "Nenhum item a exibir."
        });
      }
    };
  };

  // farmers/templates/farmers/edit_handlers/subscription_plan_panel.html
  FARMER.bindPlanPanel = function (root, c) {
    window.myPlanId = String(c.sub.plan_id);
    window.trialing = !!c.sub.trialing;
    window.allPlans = c.plans;
    function updatePlan(newPlanId, successCallback, errorCallback) {
      $.ajax({
        method: "POST",
        headers: { "X-CSRFToken": window.getCSRFToken() },
        contentType: "application/json",
        url: "/api/subscriptions/change-plan/",
        data: JSON.stringify({ new_plan_id: newPlanId }),
        success: function () {
          successCallback();
        },
        error: function (error) {
          errorCallback(error.status, error.responseJSON);
        }
      });
    }
    $(root)
      .find("#btn-change-plan")
      .on("click", function () {
        var content = "<div class='plans-container'>";
        for (var i = 0; i < window.allPlans.length; i++) {
          var plan = window.allPlans[i];
          content +=
            "<div data-plan-id='" + plan.plan_id + "' data-plan-name='" + plan.name + "' class='plan-wrapper" + (plan.plan_id === window.myPlanId ? " selected" : "") + "'>" +
            "<div class='radio-selection'></div><div class='plan-content'><p class='plan-name'>" + plan.name + "</p>" +
            "<p class='plan-short-description'>" + plan.short_description + "</p><p class='plan-description'>" + plan.description + "</p></div></div>";
        }
        content += "<p class='help-block help-warning' style='display: none;max-width: 80%;margin: 20px auto;'></p></div>";
        $.confirm({
          closeIcon: true,
          title: "Mudar plano",
          content: content,
          draggable: false,
          useBootstrap: false,
          boxWidth: "900px",
          onContentReady: function () {
            var self = this;
            this.$content.find(".plan-wrapper").on("click", function () {
              self.$content.find(".plan-wrapper").removeClass("selected");
              var planId = $(this).data("planId");
              $(this).addClass("selected");
              if (planId + "" !== window.myPlanId) self.buttons.confirm.enable();
              else self.buttons.confirm.disable();
            });
          },
          buttons: {
            confirm: {
              isDisabled: true,
              text: "Mudar plano",
              btnClass: "button btn-confirm-plan",
              action: function () {
                var self = this;
                var selectedPlan = self.$content.find(".plan-wrapper.selected");
                var newPlanId = selectedPlan.data("planId");
                var newPlanName = selectedPlan.data("planName");
                var helpBlock = self.$content.find(".help-block");
                self.showLoading(true);
                $(helpBlock).hide();
                updatePlan(
                  newPlanId,
                  function () {
                    window.myPlanId = newPlanId + "";
                    $("#plan-name").text(newPlanName);
                    self.hideLoading(true);
                    self.close();
                  },
                  function (statusCode, jsonBody) {
                    if (statusCode === 400) helpBlock.html(jsonBody[0]);
                    else helpBlock.html("Ocorreu um erro. Por favor, tente novamente mais tarde.");
                    $(helpBlock).css("display", "inline-block");
                    self.hideLoading(true);
                  }
                );
                return false;
              }
            }
          }
        });
      });
  };

  // farmers/templates/farmers/edit_handlers/subscription_payment_method_panel.html
  FARMER.bindPaymentPanel = function (root, c) {
    function refreshSubscription() {
      $.ajax({
        url: "/api/subscriptions/subscription/",
        type: "GET",
        contentType: "text/html",
        success: function (data) {
          var subscription = data.subscription;
          $("#payment-method-name").text(subscription.payment_method_name);
          if (subscription.card_brand) $("payment-card-info").text(subscription.card_brand + " " + subscription.card_last_digits);
          else $("payment-card-info").css("display", "none");
          if (subscription.current_period_end) {
            var date = new Date(subscription.current_period_end);
            $("#next-charge-date").text(
              String(date.getDate()).padStart(2, "0") + "/" + String(date.getMonth() + 1).padStart(2, "0") + "/" + date.getFullYear()
            );
          } else $("#next-charge-date").text("-");
          if (!subscription.can_manage_subscription) {
            $("#btn-manage-subscription").hide();
            $("#btn-change-plan").hide();
          }
          $("#subscription-status").text("Situação: " + subscription.status_display);
        }
      });
    }
    $(root)
      .find("#btn-manage-subscription")
      .on("click", function () {
        window.openSubscriptionManagementDialog(c.sub.manage_url, function () {
          refreshSubscription();
        });
      });
  };

  // ------------------------------------------------------------------ painel de assinatura bloqueada (farmers/blocked_subscription_panel.html)
  FARMER.blockedPanel = function (ctx) {
    var s = ctx.subscription;
    var action = s.status === api.SUB.UNPAID ? FARMER.manageURL() : "reactivate";
    var validUntil = s.status === api.SUB.CANCELED && s.current_period_end && new Date(s.current_period_end) > new Date() ? s.current_period_end : null;
    var html =
      MANAGE_DIALOG_STYLE +
      '<div id="app-entrypoint"></div>' +
      '<script type="text/x-template" id="blocked-access-template">\n    <div style="text-align: center">\n        <button type="button" id="button-blocked-access" v-on:click="onFixSubscription()" class="button">\n        \t<loading-text v-bind:color="\'#ffffff\'" v-bind:loading="loading">{{ action === \'reactivate\' ? \'Reativar assinatura\' : \'Regularizar assinatura\'}}</loading-text>\n        </button>\n    </div>\n</script>' +
      window.SIGNUP_TEMPLATES;
    function after() {
      window.config = {
        encryption_key: "",
        plans: api.getPlans(false),
        payment_methods: RA.config.SUBSCRIPTION_PAYMENT_METHODS
      };
      window.MOCK = false;
      window.subscriptionAction = action;
      window.confirmationURL = "/api/auth/reactivate/";
      window.confirmText = "Confirmar assinatura";
      if (action !== "reactivate") {
        window.steps = [
          {
            title: "Vamos continuar?",
            subtitle: "O seu pagamento não foi realizado",
            text: "<p>Para continuar a utilizar o <strong>Rastrear AgriFamiliar</strong>, você precisa <strong>regularizar</strong> o pagamento de sua assinatura.</p>",
            component: "blocked-access"
          }
        ];
      } else {
        window.steps = [
          {
            title: "Vamos continuar?",
            subtitle: "A sua assinatura foi cancelada",
            text: validUntil
              ? "<p>O seu acesso é válido até <strong>" + RA.fmtDate(validUntil) + "</strong>. Após essa data, para continuar a utilizar o <strong>Rastrear AgriFamiliar</strong>, você precisa <strong>reativar</strong> sua assinatura.</p>"
              : "<p>Para continuar a utilizar o <strong>Rastrear AgriFamiliar</strong>, você precisa <strong>reativar</strong> sua assinatura.</p>",
            component: "blocked-access"
          },
          {
            title: "Reativar assinatura",
            subtitle: "Tenha acesso novamente ao controle e emissão de suas etiquetas",
            text: "<p>Para poder reativar a sua <strong>assinatura</strong>, precisamos atualizar <strong>algumas informações</strong> em seu cadastro.</p><p>Informe os dados solicitados e volte a ter acesso ao <strong>Rastrear AgriFamiliar!</strong>",
            component: "address-data"
          },
          {
            title: "Reativar assinatura",
            subtitle: "Tenha acesso novamente ao controle e emissão de suas etiquetas",
            text: "<p>Ótimo! Agora você precisa aderir a um dos nossos <strong>planos de assinatura</strong>.</p>",
            component: "plan-selection"
          },
          {
            title: "Reativar assinatura",
            subtitle: "Tenha acesso novamente ao controle e emissão de suas etiquetas",
            text: "<p>Estamos finalizando! Agora você precisa informar uma <strong>forma de pagamento</strong>.",
            component: "payment-method-selection"
          },
          {
            title: "Tudo certo!",
            subtitle: "A reativação da sua assinatura foi realizada com sucesso",
            text: "<p>Assim que o pagamento for confirmado, você poderá utilizar o <strong>Rastrear AgriFamiliar</strong> e voltar a <strong>emitir</strong> as suas <strong>etiquetas</strong>!</p>",
            component: "reactivation-success"
          }
        ];
      }
      Vue.component("blocked-access", {
        template: "#blocked-access-template",
        data: function () {
          return { loading: false, action: window.subscriptionAction };
        },
        methods: {
          onFixSubscription: function () {
            if (this.action === "reactivate") {
              this.$emit("continue");
            } else {
              var self = this;
              window.openSubscriptionManagementDialog(this.action, function () {
                self.loading = true;
                window.location.reload();
              });
            }
          }
        }
      });
      Vue.component("reactivation-success", { template: "<div></div>" });
      W.loadScript("assets/js/signup@0.0.3.js");
    }
    return { html: html, after: after };
  };

  // ------------------------------------------------------------------ Cadernos (abas e registros)
  function journalSpec(ctx) {
    var idx = ctx.idx;
    var products = MA.sortBy(idx.products_list, ["name", "variety"], function (p, k) {
      return p[k];
    });
    function cb(name, label) {
      return { panel: "field", field: { name: name, label: label, kind: "checkbox" } };
    }
    function ta(name, label, required) {
      return { panel: "field", field: { name: name, label: label, kind: "textarea", required: !!required } };
    }
    var myFarms = idx.farms_list
      .filter(function (f) {
        return ctx.profile && f.farmer_profile_id === ctx.profile.id;
      })
      .sort(byName);
    return {
      heading: "Talhão",
      objects: [
        ta("field_identification", "Número e/ou identificação do talhão", true),
        { panel: "field", field: { name: "farm", key: "farm_id", label: "Propriedade", kind: "chooser", required: true, chooser: MA.CHOOSERS.farmer_farm_chooser,
          display: function (v) {
            var f = idx.farms[v];
            return f ? f.name : "";
          } } },
        { panel: "field", field: { name: "total_hectares", label: "Área total em hectares", kind: "number", required: true } },
        { panel: "field", field: { name: "products", key: "product_ids", label: "Produtos", kind: "scrollCheckbox",
          choices: products.map(function (p) {
            return [p.id, p.name + " (" + p.variety + ")"];
          }) } },
        ta("last_cultural_method", "Cultura anterior", true),
        { panel: "field", field: { name: "plantation_date", label: "Data de plantio", kind: "date", required: true } },
        { panel: "field", field: { name: "harvest_date", label: "Data provável de colheita", kind: "date" } },
        { panel: "multi", heading: "Preparo do solo - Operações realizadas", children: [
          { panel: "row", children: [cb("has_subsolagem", "Subsolagem"), cb("has_aracao", "Aração"), cb("has_enxada_rotativa", "Enxada rotativa")] },
          { panel: "row", classname: "no-padding-bottom", children: [cb("has_gradagem_leve", "Gradagem com grade leve"), cb("has_gradagem_pesada", "Gradagem com grade pesada"), cb("has_gradagem_niveladora", "Gradagem com grade niveladora")] },
          { panel: "separator" },
          { panel: "row", children: [ta("extra_soil_preparation_operation", "Outros")] }
        ] },
        { panel: "multi", heading: "Preparo do solo - Adoção de práticas conservacionistas", children: [
          { panel: "row", classname: "no-padding-bottom", children: [cb("is_practice_not_required", "Não foram aplicadas")] },
          { panel: "separator" },
          { panel: "row", children: [cb("has_plantio_nivel", "Plantio em nivel"), cb("has_terracos", "Terraços")] },
          { panel: "row", children: [cb("has_adubacao_verde", "Adubação verde"), cb("has_rotacao_culturas", "Rotação de culturas")] },
          { panel: "row", children: [cb("has_plantio_direto", "Plantio direto"), ta("extra_soil_preparation_practice", "Outros")] }
        ] },
        { panel: "multi", heading: "Sementes e mudas", children: [
          { panel: "row", children: [cb("has_origem_propria", "Origem própria")] },
          { panel: "row", classname: "no-padding-bottom", children: [ta("origem_terceiros", "Origem de terceiros (local)")] },
          { panel: "separator" },
          { panel: "row", children: [cb("has_tratamento_termico", "Viveiro com tratamento térmico")] }
        ] },
        { panel: "multi", heading: "Irrigação", children: [ta("irrigation_method", "Sistema de irrigação", true), ta("water_source", "Origem da água", true)] },
        { panel: "multi", heading: "Croqui", children: [
          { panel: "field", field: { name: "polygon", label: "Croqui", kind: "polygon", required: true,
            initialCenter: function () {
              // farm_journals/wagtail_hooks/farmers.py get_map_center
              var farm = myFarms[0];
              if (!farm) return null;
              if (farm.latitude && farm.longitude) return { lat: farm.latitude, lng: farm.longitude };
              var st = null;
              return RA.loadStates().then(function (states) {
                st = states.filter(function (s) {
                  return s.abbreviation === farm.state_id;
                })[0];
                var attempts = [api.farmAddress(farm, true), RA.cityName(farm.city_id) + ", " + (st ? st.name : farm.state_id)];
                function next() {
                  if (!attempts.length) return null;
                  return RA.maps.geocode(attempts.shift()).then(function (r) {
                    return r || next();
                  });
                }
                return next();
              });
            } } }
        ] }
      ]
    };
  }

  var ENTRY_TABS = [
    { type: "fertilizing", heading: "Adubação", field: "fertilizing_entry", model: "fertilizingentry", verbose: "registro de adubação",
      columns: [["application_date", "data da aplicação"], ["formula_name", "nome do produto fórmula"], ["dose", "dose"], ["application_method", "forma de aplicação"], ["application_responsible", "responsável pela aplicação"], ["note", "observação"]] },
    { type: "pesticide", heading: "Defensivos", field: "pesticide_entry", model: "pesticideentry", verbose: "registro de defensivos",
      columns: [["date", "data"], ["grace_period", "período de carência"], ["target_disease", "praga ou doença alvo"], ["product_name", "nome do produto"], ["dose", "dose"], ["volume", "volume de calda"], ["operator", "operador"]] },
    { type: "harvest", heading: "Colheita", field: "harvest_entry", model: "harvestentry", verbose: "registro de colheita",
      columns: [["date", "data"], ["amount", "quantidade colhida"], ["destination", "destino"], ["responsible", "responsável"]] },
    { type: "postharvest", heading: "Pós-colheita", field: "postharvest_entry", model: "postharvestentry", verbose: "registro pós-colheita",
      columns: [["date", "data"], ["product_name", "nome do produto aplicado"], ["dose", "dose"], ["grace_period", "período de carência"], ["responsible", "responsável"]] }
  ];
  FARMER.ENTRY_TABS = ENTRY_TABS;

  function journalValues(j) {
    var v = RA.clone(j);
    return v;
  }

  FARMER.journalForm = function (ctx, journal, values, errors, messages) {
    var def = MA.find("farm_journals/farmjournal/", ctx);
    var tab = journalSpec(ctx);
    var tabs = [{ heading: "Talhão", objects: tab.objects }];
    if (journal) {
      ENTRY_TABS.forEach(function (t) {
        tabs.push({
          heading: t.heading,
          html: function () {
            return window.NESTED.panelHTML({ fieldName: t.field, userCanCreate: true, addLabel: "Adicionar " + t.verbose, addTitle: "Adicionar um novo " + t.verbose, addUrl: "/admin/farm_journals/" + t.model + "/create/" });
          }
        });
      });
    }
    var form = new F.Form({ tabs: tabs }, values || (journal ? journalValues(journal) : {}), errors || {});
    var html = MA.formPage({
      def: def,
      obj: journal,
      form: form,
      title: journal ? "Caderno" : W.T.new,
      subtitle: journal ? "" : "Caderno",
      canDelete: !!journal && def.perms.delete(ctx, journal)
    });
    return {
      title: journal ? "Editando caderno" : "Adicionar novo caderno",
      css: ["editor", "journaledit", "datatable"],
      messages: messages,
      html: html,
      after: function (root) {
        MA.bindForm(root, form, function (v) {
          var data = RA.clone(v);
          if (data.farm_id && !ctx.idx.farms[data.farm_id]) data.farm_id = "";
          return api
            .saveFarmJournal(data, journal, { web: true })
            .then(function (saved) {
              if (journal) {
                W.flash("success", "Os dados do caderno foram atualizados.");
                location.hash = W.u("farm_journals/farmjournal/");
              } else {
                W.flash("success", e("Caderno '" + saved.field_identification + "' criado."));
                location.hash = W.u("farm_journals/farmjournal/edit/" + saved.id + "/");
              }
            })
            .catch(function (err) {
              if (!err || err.name !== "ValidationError") throw err;
              var msg = journal ? "O caderno não pôde ser salvo devido a erros." : "O caderno não pode ser criado devido a erros.";
              window.ADMIN.renderPage(FARMER.journalForm(ctx, journal, v, err.errors, [{ level: "error", html: msg }]));
            });
        });
        W.initErrorDetection(root);
        if (journal) {
          ENTRY_TABS.forEach(function (t) {
            window.NESTED.initPanel(root, {
              fieldName: t.field,
              columns: t.columns.map(function (c) {
                return { label: c[1], field: c[0] };
              }),
              url: "/admin/api/nested-model-admin/" + t.field + "/",
              pageSize: 10,
              parentId: journal.id,
              fkFieldName: "farm_journal_id",
              buttonsFieldName: t.columns[0][0],
              userCanCreate: true,
              emptyText: "Nenhum item a exibir."
            });
          });
        }
        W.loadScript("assets/js/farm_journals_edit@0.0.1.js");
      }
    };
  };

  FARMER.journalCreate = function (ctx) {
    return FARMER.journalForm(ctx, null, null, null, null);
  };

  FARMER.journalEdit = function (ctx, id) {
    var def = MA.find("farm_journals/farmjournal/", ctx);
    var j = ctx.idx.farm_journals[id];
    if (!j) throw MA.notFound();
    if (!def.perms.edit(ctx, j)) throw MA.denied();
    return FARMER.journalForm(ctx, j, null, null, null);
  };

  // ------------------------------------------------------------------ "Marcar assinatura como paga" (farmers/staff/farmer_profile_index.html)
  FARMER.bindSettleCharge = function (root) {
    function settleCharge(subscriptionId, successCallback, errorCallback) {
      $.ajax({
        method: "POST",
        headers: { "X-CSRFToken": window.getCSRFToken() },
        contentType: "application/json",
        url: "/api/subscriptions/settle-charge/",
        data: JSON.stringify({ subscription_id: subscriptionId }),
        success: function () {
          successCallback();
        },
        error: function (error) {
          errorCallback(error.status, error.responseJSON);
        }
      });
    }
    $(root)
      .find(".btn-settle")
      .on("click", function () {
        var subscriptionId = $(this).data("subscriptionId");
        var content =
          "<div><p>Você tem certeza que deseja marcar essa assinatura como paga?</p><p class='help-block help-warning' style='display: none;max-width: 80%;margin: 20px auto;'></p></div>";
        $.confirm({
          closeIcon: true,
          title: "Marcar assinatura como paga",
          content: content,
          draggable: false,
          useBootstrap: false,
          boxWidth: "500px",
          buttons: {
            confirm: {
              text: "Confirmar",
              btnClass: "button",
              action: function () {
                var self = this;
                var helpBlock = self.$content.find(".help-block");
                self.showLoading(true);
                $(helpBlock).hide();
                settleCharge(
                  subscriptionId,
                  function () {
                    $("#subscription-status-" + subscriptionId).text("Paga");
                    self.close();
                  },
                  function (statusCode, jsonBody) {
                    if (statusCode === 400) helpBlock.html(jsonBody[0]);
                    else helpBlock.html("Ocorreu um erro. Por favor, tente novamente mais tarde.");
                    $(helpBlock).css("display", "inline-block");
                    self.hideLoading(true);
                  }
                );
                return false;
              }
            },
            cancel: { text: "Voltar", btnClass: "button no" }
          }
        });
      });
  };
})(window, window.jQuery);
