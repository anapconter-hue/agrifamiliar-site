/*
 * wagtail.contrib.modeladmin: listagem (IndexView), inclusão (CreateView), edição (EditView)
 * e exclusão (DeleteView), com os templates do Wagtail 2.11 e os sobrescritos pelo projeto
 * (templates/modeladmin/index.html, includes/button.html, includes/search_form.html).
 * As definições de cada cadastro ficam em models.js.
 */
(function (window, $) {
  "use strict";

  var RA = window.RA;
  var W = window.W;
  var F = window.F;
  var api = RA.api;
  var e = RA.esc;
  var MA = (window.MA = { admins: [] });

  function capfirst(s) {
    s = String(s || "");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  MA.capfirst = capfirst;

  MA.register = function (def) {
    MA.admins.push(def);
    return def;
  };

  // ProxyModelAdmin: escolhe a versão (equipe ou produtor) para o usuário
  MA.find = function (url, ctx) {
    var candidates = MA.admins.filter(function (a) {
      return a.url === url;
    });
    for (var i = 0; i < candidates.length; i++) if (candidates[i].canProcess(ctx)) return candidates[i];
    return null;
  };

  // ------------------------------------------------------------------ ordenação e busca
  function cmp(a, b) {
    // NULLS LAST em ordem crescente (PostgreSQL)
    var an = a === null || a === undefined || a === "",
      bn = b === null || b === undefined || b === "";
    if (an && bn) return 0;
    if (an) return 1;
    if (bn) return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), "pt-BR");
  }

  MA.sortBy = function (list, ordering, valueOf) {
    // ordering: ["campo", "-campo", ...]; valueOf(obj, campo) -> valor
    return list.slice().sort(function (x, y) {
      for (var i = 0; i < ordering.length; i++) {
        var f = ordering[i],
          desc = f.charAt(0) === "-";
        if (desc) f = f.slice(1);
        var r = cmp(valueOf(x, f), valueOf(y, f));
        if (r !== 0) return desc ? -r : r;
      }
      return 0;
    });
  };

  // DjangoORMSearchHandler: cada palavra deve aparecer em algum dos campos
  MA.search = function (list, term, fieldsOf) {
    if (!term || !term.trim()) return list;
    var bits = term.split(/\s+/).filter(Boolean);
    return list.filter(function (o) {
      var vals = fieldsOf(o).map(function (v) {
        return String(v === null || v === undefined ? "" : v).toLowerCase();
      });
      return bits.every(function (b) {
        b = b.toLowerCase();
        return vals.some(function (v) {
          return v.indexOf(b) !== -1;
        });
      });
    });
  };

  // ------------------------------------------------------------------ botões (ButtonHelper)
  MA.button = function (b) {
    // modeladmin/includes/button.html (os atributos extras ficam colados, como no original)
    var attrs = "";
    if (b.attrs) {
      Object.keys(b.attrs).forEach(function (k) {
        attrs += k + '="' + e(b.attrs[k]) + '"';
      });
    }
    return (
      "<a" + (b.url ? ' href="' + b.url + '"' : "") + ' class="' + b.classname + '" title="' + e(b.title) + '"' +
      (b.target ? ' target="' + b.target + '"' : "") + (b.rel ? ' rel="' + b.rel + '"' : "") + attrs + ">" + e(b.label) + "</a>"
    );
  };

  MA.editButton = function (def, obj, cls) {
    return {
      url: W.u(def.url + "edit/" + obj.id + "/"),
      label: def.editLabel || W.T.edit,
      classname: "button" + (cls ? " " + cls : ""),
      title: "Editar este " + def.verbose
    };
  };

  MA.deleteButton = function (def, obj, cls) {
    return {
      url: W.u(def.url + "delete/" + obj.id + "/"),
      label: W.T.delete,
      classname: "button no" + (cls ? " " + cls : ""),
      title: "Remover este " + def.verbose
    };
  };

  MA.addButton = function (def) {
    return {
      url: W.u(def.url + "create/"),
      label: "Adicionar " + def.verbose,
      classname: "button bicolor icon icon-plus",
      title: "Adicionar um novo " + def.verbose
    };
  };

  MA.buttonsFor = function (def, ctx, obj) {
    var b = [];
    var cls = "button-small button-secondary";
    if (def.perms.edit(ctx, obj)) b.push(MA.editButton(def, obj, cls));
    if (def.perms.delete(ctx, obj)) b.push(MA.deleteButton(def, obj, cls));
    if (def.extraButtons) b = b.concat(def.extraButtons(ctx, obj));
    return b;
  };

  // ------------------------------------------------------------------ IndexView
  MA.indexView = function (def, ctx, query) {
    var q = query.q || "";
    var page0 = parseInt(query.p || "0", 10) || 0;
    var o = query.o;
    return def.queryset(ctx).then(function (base) {
      var allCount = base.length;
      // ordenação: padrão do modelo ou a escolhida no cabeçalho (?o=)
      var ordering = (def.ordering || []).slice();
      var sortedCols = {}; // índice -> asc/desc
      if (o !== undefined && o !== null && o !== "") {
        ordering = [];
        String(o)
          .split(".")
          .forEach(function (p) {
            var desc = p.charAt(0) === "-";
            var idx = parseInt(desc ? p.slice(1) : p, 10);
            var col = def.list[idx];
            if (!col || !col.sort) return;
            ordering.push((desc ? "-" : "") + col.sort);
            sortedCols[idx] = desc ? "desc" : "asc";
          });
      } else {
        (def.ordering || []).forEach(function (f) {
          var desc = f.charAt(0) === "-";
          var name = desc ? f.slice(1) : f;
          for (var i = 0; i < def.list.length; i++) {
            if (def.list[i].sort === name) {
              sortedCols[i] = desc ? "desc" : "asc";
              break;
            }
          }
        });
      }
      ordering = ordering.concat(def.extraOrdering || []).concat(["-id"]);
      var list = MA.sortBy(base, ordering, def.sortValue || function (obj, f) {
        return obj[f];
      });
      list = MA.search(list, q, def.searchValues);
      var perPage = def.perPage || 100;
      var numPages = Math.max(1, Math.ceil(list.length / perPage));
      if (page0 + 1 > numPages || page0 < 0) page0 = 0;
      var pageItems = list.slice(page0 * perPage, page0 * perPage + perPage);
      var userCanCreate = def.perms.create(ctx);

      function qs(params) {
        var p = {};
        if (q) p.q = q;
        if (o !== undefined && o !== null && o !== "") p.o = o;
        Object.keys(params).forEach(function (k) {
          if (params[k] === null) delete p[k];
          else p[k] = params[k];
        });
        var s = $.param(p);
        return W.u(def.url) + (s ? "?" + s : "");
      }

      // cabeçalho (templates/modeladmin/index.html do projeto)
      var add = userCanCreate ? '<div class="actionbutton">' + MA.button(MA.addButton(def)) + "</div>" : "";
      var search = def.searchValues
        ? '<form id="changelist-search" class="col search-form" action="' + W.u(def.url) + '" method="get"><ul class="fields"><li class="required">' +
          '<div class="field char_field text_input field-small iconfield"><label for="id_q" class="visuallyhidden">Procurar por</label>' +
          '<div class="field-content"><div class="input icon-search "><input id="id_q" name="q" value="' + e(q) + '" placeholder="Buscar ' + e(def.verbosePlural.toLowerCase()) + '" type="text"><span></span></div></div></div></li>' +
          '<li class="submit visuallyhidden"><input type="submit" value="Search" class="button"></li></ul></form>'
        : "";
      var h =
        '<header class="nice-padding hasform"><div class="row header-title"><div class="left"><div class="col">' +
        '<h1 class="icon">' + W.icon(def.icon, "header-title-icon") + e(capfirst(def.verbosePlural)) + "<span></span></h1></div>" +
        search +
        '</div><div class="right">' + add + "</div></div></header>";

      h += '<div><div class="row"><div class="result-list col12">';
      if (!allCount) {
        // core/admin/empty_text_fix.html + admin/male_add_one.js
        h +=
          '<div class="nice-padding" style="margin-top:30px;"><p>' + e(def.emptyText) +
          (userCanCreate
            ? "\n                                        \n                                                Porque não <a href=\"" + W.u(def.url + "create/") + '">' +
              (def.maleAddOne ? "adicionar um" : "adicionar uma") + "</a>?\n                                            \n                                        "
            : "") +
          "</p></div>";
      } else if (!list.length) {
        h +=
          '<div class="nice-padding no-search-results"><p>Desculpe, não há ' + e(def.verbosePlural) + " que satisfazem os seus parâmetros de pesquisa.</p></div>";
      } else {
        h += '<table class="listing full-width"><thead><tr>';
        def.list.forEach(function (col, i) {
          var name = col.name;
          if (!col.sort) {
            h += '<th scope="col"  class="column-' + name + '">\n                \n                ' + e(capfirst(col.label)) + "\n                \n           </th>";
            return;
          }
          var isSorted = sortedCols[i] !== undefined;
          var orderType = isSorted ? sortedCols[i] : "";
          var newType = orderType === "asc" ? "desc" : "asc";
          // url_primary: esta coluna vai para o início da ordenação
          var parts = [];
          Object.keys(sortedCols).forEach(function (j) {
            j = +j;
            if (j === i) parts.unshift((newType === "desc" ? "-" : "") + j);
            else parts.push((sortedCols[j] === "desc" ? "-" : "") + j);
          });
          if (!isSorted) parts.unshift((newType === "desc" ? "-" : "") + i);
          var cls = "sortable column-" + name + (isSorted ? " sorted " + orderType + "ending" : "");
          h +=
            '<th scope="col"  class="' + cls + '">\n                <a href="' + qs({ o: parts.join("."), p: null }) + '" class="icon ' +
            (orderType === "asc" ? "icon-arrow-up-after" : "icon-arrow-down-after") + '">\n                ' + e(capfirst(col.label)) + "\n                </a>\n           </th>";
        });
        h += "</tr></thead><tbody>";
        pageItems.forEach(function (obj, i) {
          h += '<tr data-object-pk="' + e(obj.id) + '" class="' + (i % 2 === 0 ? "odd" : "even") + '">';
          def.list.forEach(function (col, ci) {
            var v = col.value(obj, ctx);
            if (v === null || v === undefined) v = "-";
            if (String(v) === "") v = "&nbsp;";
            h += '<td class="field-' + col.name + (col.nowrap ? " nowrap" : "") + '">' + v;
            if (ci === 0) {
              var btns = MA.buttonsFor(def, ctx, obj);
              if (btns.length) {
                h +=
                  '\n    \n    <ul class="actions">\n        ' +
                  btns
                    .map(function (b) {
                      return "\n            <li>" + MA.button(b) + "\n</li>";
                    })
                    .join("\n        ") +
                  "\n    </ul>\n    \n    ";
              }
            }
            h += "</td>";
          });
          h += "</tr>";
        });
        h += "</tbody></table>";
      }
      h += "</div>";
      h += W.modelAdminPagination(page0 + 1, numPages, function (p0) {
        return qs({ p: p0 });
      });
      h += "</div></div>";
      return {
        title: capfirst(def.verbosePlural),
        css: ["index"].concat(def.indexCss || []),
        html: h,
        after: function (root) {
          var input = root.querySelector("#id_q");
          if (input) input.focus();
          $(root)
            .find("#changelist-search")
            .on("submit", function (ev) {
              ev.preventDefault();
              var v = $(this).find("#id_q").val();
              location.hash = W.u(def.url) + (v ? "?" + $.param({ q: v }) : "");
            });
          if (def.afterIndex) def.afterIndex(root, ctx);
        }
      };
    });
  };

  // ------------------------------------------------------------------ CreateView / EditView
  MA.formPage = function (o) {
    // o: { def, ctx, obj, form, title, subtitle, action, canDelete, headerHtml, footer }
    var def = o.def;
    var header =
      o.headerHtml ||
      W.header({ title: o.title, subtitle: o.subtitle, icon: def.icon, merged: true, tabbed: true });
    var footer =
      o.footer !== undefined
        ? o.footer
        : "<footer><ul><li class=\"actions\"><div class=\"dropdown dropup dropdown-button match-width\">" +
          '<button type="submit" class="button action-save button-longrunning" data-clicked-text="' + W.T.saving + '">' + W.icon("spinner") + "<em>" + W.T.save + "</em></button>" +
          (o.canDelete
            ? '<div class="dropdown-toggle">' + W.icon("arrow-up") + '</div><ul><li><a href="' + W.u(def.url + "delete/" + o.obj.id + "/") + '" class="shortcut">' + W.T.delete + "</a></li></ul>"
            : "") +
          "</div></li></ul></footer>";
    return (
      header +
      '<form action="' + (o.action || "#") + '" enctype="multipart/form-data" method="POST" novalidate class="ra-model-form">' +
      '<input type="hidden" name="csrfmiddlewaretoken" value="local">' +
      o.form.render() +
      footer +
      "</form>"
    );
  };

  // Liga o envio do formulário: coleta, valida/salva e mostra os erros como o Django
  MA.bindForm = function (root, form, onSubmit) {
    form.bind(root);
    $(root)
      .find("form.ra-model-form")
      .on("submit", function (ev) {
        ev.preventDefault();
        form.collect().then(function (values) {
          return onSubmit(values);
        });
      });
  };

  MA.createView = function (def, ctx) {
    if (!def.perms.create(ctx)) return Promise.reject(MA.denied());
    return MA.renderForm(def, ctx, null, null, null);
  };

  MA.editView = function (def, ctx, id) {
    return def.get(id, ctx).then(function (obj) {
      if (!obj) throw MA.notFound();
      if (!def.perms.edit(ctx, obj)) throw MA.denied();
      return MA.renderForm(def, ctx, obj, null, null);
    });
  };

  // Monta a página do formulário (também usada para mostrar os erros após "salvar")
  MA.renderForm = function (def, ctx, obj, values, errors, messages) {
    return Promise.resolve(def.formSpec(ctx, obj)).then(function (spec) {
      var vals = values || (obj ? def.formValues(obj, ctx) : def.initialValues ? def.initialValues(ctx) : {});
      var form = new F.Form(spec, vals, errors || {});
      var isEdit = !!obj;
      var html = MA.formPage({
        def: def,
        ctx: ctx,
        obj: obj,
        form: form,
        title: isEdit ? def.editTitle || W.T.editing : W.T.new,
        subtitle: isEdit ? (def.editSubtitle !== undefined ? def.editSubtitle : def.str(obj, ctx)) : capfirst(def.verbose),
        canDelete: isEdit && def.perms.delete(ctx, obj),
        headerHtml: def.formHeader ? def.formHeader(ctx, obj) : null,
        footer: def.formFooter
      });
      return {
        title: isEdit ? "Editando " + def.verbose : "Adicionar novo " + def.verbose,
        css: ["editor"].concat(def.formCss || []),
        messages: messages,
        html: html,
        after: function (root) {
          MA.bindForm(root, form, function (data) {
            return MA.submit(def, ctx, obj, data);
          });
          W.initErrorDetection(root);
          if (def.afterForm) def.afterForm(root, ctx, obj, form);
        }
      };
    });
  };

  // Mostra de novo o formulário com os erros (form_invalid)
  MA.showErrors = function (def, ctx, obj, values, err) {
    var msg = obj ? "O " + def.verbose + " não pôde ser salvo devido a erros." : "O " + def.verbose + " não pode ser criado devido a erros.";
    var errors = (err && err.errors) || {};
    var nonField = errors.__all__ || [];
    return MA.renderForm(def, ctx, obj, values, def.mapErrors ? def.mapErrors(errors) : errors, [
      { level: "error", html: W.validationErrorMessage(msg, nonField) }
    ]).then(function (page) {
      window.ADMIN.renderPage(page);
    });
  };

  MA.submit = function (def, ctx, obj, values) {
    return def
      .save(values, obj, ctx)
      .then(function (saved) {
        var isEdit = !!obj;
        var msg = def.successMessage
          ? def.successMessage(saved, isEdit, ctx)
          : capfirst(def.verbose) + " '" + def.str(saved, ctx) + "' " + (isEdit ? "atualizado." : "criado.");
        var buttons = def.successButtons ? def.successButtons(saved, isEdit) : [[W.u(def.url + "edit/" + saved.id + "/"), W.T.edit]];
        W.flash("success", W.messageWithButtons(msg, buttons));
        location.hash = def.successUrl ? def.successUrl(saved, isEdit) : W.u(def.url);
      })
      .catch(function (err) {
        if (err && err.name === "ValidationError" && err.protected && def.onProtected) return def.onProtected(err, values, obj, ctx);
        if (err && err.name === "ValidationError") return MA.showErrors(def, ctx, obj, values, err);
        console.error(err);
        W.cancelSpinner();
        window.addMessage("error", "Ocorreu um erro. Por favor, tente novamente.");
      });
  };

  // ------------------------------------------------------------------ DeleteView
  MA.deleteView = function (def, ctx, id) {
    return def.get(id, ctx).then(function (obj) {
      if (!obj) throw MA.notFound();
      if (!def.perms.delete(ctx, obj)) throw MA.denied();
      return MA.deletePage(def, ctx, obj, null);
    });
  };

  MA.deletePage = function (def, ctx, obj, linked) {
    var h = W.header({ title: W.T.delete, subtitle: def.str(obj, ctx), icon: def.icon });
    h += '<div class="nice-padding">';
    if (linked) {
      h +=
        "<h2>" + e(capfirst(def.verbose)) + " não pode ser excluído</h2>" +
        "<p>'" + e(def.str(obj, ctx)) +
        "' é atualmente referenciada por outros objetos, e não pode ser excluído, sem comprometer a integridade dos dados. Para excluí-lo com sucesso, em primeiro lugar remover referências a partir dos seguintes objetos, em seguida, tente novamente:</p><ul>" +
        linked
          .map(function (l) {
            return "<li><b>" + e(l.type) + ":</b> " + e(l.str) + "</li>";
          })
          .join("") +
        '</ul><p><a href="' + W.u(def.url) + '" class="button">' + W.T.goBack + "</a></p>";
    } else {
      h +=
        "<p>Tem certeza de que quer apagar este " + e(def.verbose) +
        "? Se outras coisas em seu site estão relacionadas a ele, eles também podem ser afetados.</p>" +
        '<form action="#" method="POST" class="ra-delete-form"><input type="hidden" name="csrfmiddlewaretoken" value="local">' +
        '<input type="submit" value="' + W.T.yesDelete + '" class="button serious" />\n                    <a href="' + W.u(def.url) + '" class="button button-secondary">' + W.T.noDelete + "</a></form>";
    }
    h += "</div>";
    return {
      title: "Confirmar a exclusão de " + def.verbose,
      css: [],
      html: h,
      after: function (root) {
        $(root)
          .find("form.ra-delete-form")
          .on("submit", function (ev) {
            ev.preventDefault();
            var msg = def.verbose + " '" + def.str(obj, ctx) + "' excluído.";
            Promise.resolve(def.remove(obj, ctx))
              .then(function () {
                W.flash("success", e(msg));
                location.hash = W.u(def.url);
              })
              .catch(function (err) {
                if (err && err.protected) {
                  window.ADMIN.renderPage(MA.deletePage(def, ctx, obj, err.linkedDisplay || []));
                  return;
                }
                console.error(err);
                window.addMessage("error", "Ocorreu um erro. Por favor, tente novamente.");
              });
          });
      }
    };
  };

  // ------------------------------------------------------------------ erros de navegação
  MA.denied = function () {
    var x = new Error("PermissionDenied");
    x.denied = true;
    return x;
  };
  MA.notFound = function () {
    var x = new Error("Http404");
    x.notFound = true;
    return x;
  };
})(window, window.jQuery);
