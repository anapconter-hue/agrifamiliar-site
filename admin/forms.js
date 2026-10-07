/*
 * Formulários do painel: reproduz os "edit handlers" do Wagtail 2.11
 * (ObjectList, TabbedInterface, MultiFieldPanel, FieldRowPanel, FieldPanel, InlinePanel)
 * e os widgets usados pelo projeto (core/widgets.py, wagtailmodelchoosers,
 * farm_journals/edit_handlers.py).
 *
 * Campo: { name, key, label, kind, required, choices, help, helpHtml, maxlength, classname,
 *          readOnly, loader(triggerValue) -> Promise<[{value,label,...}]>, trigger,
 *          optionHTML(item, checked, name), chooser: {...}, inputType, autocomplete }
 *   name = nome do campo no HTML; key = chave em values (padrão = name)
 * kind: text | textarea | number | date | checkbox | select | choice | file | password |
 *       hidden | chooser | chained | chainedMulti | scrollCheckbox | polygon
 * Painéis: {panel:"field", field}, {panel:"multi", heading, children, classname},
 *          {panel:"row", children, classname},
 *          {panel:"inline", name, prefix, heading, label, children, minNum, maxNum, classname, readOnly},
 *          {panel:"separator"}, {panel:"html", html, onBind, classname}
 * Erros: { "campo": [...], "prefixo.0.campo": [...], "prefixo.__all__": [...] }
 */
(function (window, $) {
  "use strict";

  var RA = window.RA;
  var W = window.W;
  var e = RA.esc;
  var F = (window.F = {});

  // Tipo do campo e do widget (classes usadas pelo CSS do Wagtail)
  var KIND = {
    text: ["char_field", "text_input"],
    email: ["email_field", "email_input"],
    password: ["char_field", "password_input"],
    textarea: ["char_field", "admin_auto_height_text_input"],
    number: ["float_field", "number_input"],
    date: ["date_field", "admin_date_input"],
    checkbox: ["boolean_field", "checkbox_input"],
    select: ["model_choice_field", "select"],
    choice: ["typed_choice_field", "select"],
    file: ["image_field", "custom_file_input"],
    hidden: ["float_field", "hidden_input"],
    chooser: ["model_choice_field", "model_chooser_widget"],
    chained: ["model_choice_field", "chained_select_widget"],
    chainedMulti: ["model_multiple_choice_field", "certificates_chained_multi_select_widget"],
    scrollCheckbox: ["model_multiple_choice_field", "scrollable_checkbox_select_multiple"],
    polygon: ["polygon_field", "google_map_polygon_widget"]
  };

  function keyOf(def) {
    return def.key || def.name;
  }

  function Form(spec, values, errors, opts) {
    this.spec = spec; // { objects: [...] } ou { tabs: [{heading, objects}] }
    this.values = values || {};
    this.errors = errors || {};
    this.opts = opts || {};
    this.binders = [];
  }
  F.Form = Form;

  function fid(def, prefix) {
    return "id_" + (prefix ? prefix + "-" : "") + def.name;
  }
  function fname(def, prefix) {
    return (prefix ? prefix + "-" : "") + def.name;
  }
  F.fid = fid;

  Form.prototype.value = function (def, prefix, ctx) {
    var src = ctx || this.values;
    return src[keyOf(def)];
  };

  // "farm_set-0" + "name" -> "farm_set.0.name"
  Form.prototype.errs = function (def, prefix) {
    var k = (prefix ? prefix.replace(/-(\d+)$/, ".$1") + "." : "") + def.name;
    return this.errors[k] || [];
  };

  // Valor de número como o Django exibe um FloatField (str(float): 10 -> "10.0")
  function numberValue(v) {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "number") return Number.isInteger(v) ? v.toFixed(1) : String(v);
    return String(v);
  }

  // ------------------------------------------------------------------ widgets
  Form.prototype.widget = function (def, prefix, ctx) {
    var id = fid(def, prefix),
      name = fname(def, prefix);
    var v = this.value(def, prefix, ctx);
    var req = def.required && !def.readOnly ? " required" : "";
    var dis = def.readOnly ? " disabled" : "";
    var self = this;
    var str = v === null || v === undefined ? "" : v;
    switch (def.kind) {
      case "text":
      case "email":
        return (
          '<input type="' + (def.kind === "email" ? "email" : "text") + '" name="' + name + '" value="' + e(str) + '"' +
          (def.maxlength ? ' maxlength="' + def.maxlength + '"' : "") + req + dis + ' id="' + id + '">'
        );
      case "password":
        return (
          '<input type="password" name="' + name + '"' + (def.autocomplete ? ' autocomplete="' + def.autocomplete + '"' : "") +
          (def.autofocus ? " autofocus" : "") + req + ' id="' + id + '">'
        );
      case "textarea":
        return '<textarea name="' + name + '" cols="40" rows="1"' + req + dis + ' id="' + id + '" data-autosize-on="true">\n' + e(str) + "</textarea>";
      case "number":
        return '<input type="number" name="' + name + '" value="' + e(numberValue(v)) + '" step="any"' + req + dis + ' id="' + id + '">';
      case "date":
        if (!def.readOnly) {
          this.binders.push(function () {
            if (window.initDateChooser) window.initDateChooser(id, { dayOfWeekStart: 0, format: "d/m/Y" });
          });
        }
        return (
          '<input type="text" name="' + name + '" value="' + e(v ? (/^\d{4}-\d{2}-\d{2}$/.test(v) ? RA.fmtDate(v) : v) : "") + '" autocomplete="off"' +
          req + dis + ' id="' + id + '">'
        );
      case "checkbox":
        return '<input type="checkbox" name="' + name + '" id="' + id + '"' + (v ? " checked" : "") + dis + ">";
      case "hidden":
        return '<input type="hidden" name="' + name + '" value="' + e(str) + '" id="' + id + '">';
      case "select":
      case "choice":
      case "chained":
        var opts = (def.choices || [])
          .map(function (c) {
            return '<option value="' + e(c[0]) + '"' + (String(c[0]) === String(str) ? " selected" : "") + ">" + e(c[1]) + "</option>";
          })
          .join("");
        var empty = def.noEmpty ? "" : '<option value=""' + (str === "" ? " selected" : "") + ">---------</option>";
        if (def.kind === "chained") {
          this.binders.push(function (root) {
            self.bindChained(def, prefix, root, ctx);
          });
        }
        return '<select name="' + name + '"' + req + dis + ' id="' + id + '">' + empty + opts + "</select>";
      case "file":
        return F.fileWidget(def, id, name, v, ctx || self.values);
      case "chooser":
        this.binders.push(function (root) {
          F.bindChooser(def, id, root);
        });
        return F.chooserWidget(def, id, name, v, ctx || self.values);
      case "chainedMulti":
        this.binders.push(function (root) {
          self.bindChained(def, prefix, root, ctx);
        });
        return '<div class="chained-multi-select" name="' + name + '" id="' + id + '"></div>';
      case "scrollCheckbox":
        this.binders.push(function (root) {
          F.bindScrollableCheckbox(root, id);
        });
        return F.scrollableCheckboxWidget(def, id, name, v || []);
      case "polygon":
        this.binders.push(function (root) {
          F.bindPolygon(def, id, root, self);
        });
        return F.polygonWidget(def, id, name, v);
    }
    return "";
  };

  // core/widgets/custom_file_input.html
  F.fileWidget = function (def, id, name, v, values) {
    var h = "";
    var dis = def.readOnly ? " disabled" : "";
    var fileName = def.fileName ? def.fileName(values) : "imagem";
    if (v) {
      h += '\n\t<p><label>Imagem atual:</label> <a href="' + e(v) + '">' + e(fileName) + "</a></p>\n";
      h += '\n<div style="display: flex; flex-direction: row;">\n\t<label>Escolher outra:</label>\n';
    }
    h += '\t<input style="flex-grow: 1" type="file" name="' + name + '" accept="image/*"' + (def.required && !v ? " required" : "") + ' id="' + id + '"' + dis + ">\n";
    if (v) h += "</div>\n";
    if (!def.required && v) {
      h +=
        '\n<div style="display: flex; flex-direction: row;">\n\t<label for="' + name + '-clear_id">Remover imagem:</label>\n\t<input style="top: 18px;" type="checkbox" name="' + name + '-clear" id="' + name + '-clear_id"' + dis + ">\n</div>\n";
    }
    return h;
  };

  // ------------------------------------------------------------------ painéis
  Form.prototype.fieldInfo = function (def, prefix, ctx, showLabel) {
    var k = KIND[def.kind] || ["char_field", "text_input"];
    return {
      id: fid(def, prefix),
      label: def.label,
      fieldtype: def.fieldtype || k[0],
      widgettype: def.widgettype || k[1],
      widget: this.widget(def, prefix, ctx),
      errors: this.errs(def, prefix),
      help: def.help,
      helpHtml: def.helpHtml,
      showLabel: showLabel,
      showHelp: showLabel,
      required: def.required && !def.readOnly
    };
  };

  // EditHandler.classes(): classname (+ colN em FieldRowPanel, + disabled em ReadOnlyFieldPanel),
  // required, error e o tipo do campo
  Form.prototype.panelClasses = function (p, prefix, colClass) {
    var c = [];
    var cn = p.classname || "";
    if (colClass && !/\bcol\d+\b/.test(cn)) cn += colClass;
    if (p.panel === "field" && p.field.readOnly) cn = cn ? cn + " disabled" : "disabled";
    if (cn) c.push(cn.trim());
    if (p.panel === "field") {
      if (p.field.required && !p.field.readOnly) c.push("required");
      if (this.errs(p.field, prefix).length) c.push("error");
      c.push(p.field.fieldtype || (KIND[p.field.kind] || ["char_field"])[0]);
    } else if (p.panel === "multi") c.push("multi-field");
    return c.join(" ");
  };

  // render_as_field
  Form.prototype.asField = function (p, prefix, ctx) {
    var self = this;
    if (p.panel === "field") {
      if (p.field.kind === "hidden") return this.widget(p.field, prefix, ctx); // core/edit_handlers/hidden_field_panel.html
      return W.fieldHTML(this.fieldInfo(p.field, prefix, ctx, true));
    }
    if (p.panel === "row") {
      var col = " col" + Math.floor(12 / p.children.length);
      return (
        '<ul class="field-row ' + (p.classname || "") + '">' +
        p.children
          .map(function (c) {
            return '<li class="field-col ' + self.panelClasses(c, prefix, col) + '">' + self.asField(c, prefix, ctx) + "</li>";
          })
          .join("") +
        "</ul>"
      );
    }
    if (p.panel === "multi") return this.multi(p, prefix, ctx);
    if (p.panel === "separator") return "<hr style='margin: 0px;'>";
    if (p.panel === "html") {
      if (p.onBind) {
        this.binders.push(function (root) {
          p.onBind(root, prefix, ctx);
        });
      }
      return typeof p.html === "function" ? p.html(prefix, ctx) : p.html;
    }
    if (p.panel === "inline") return this.inline(p);
    return "";
  };

  // multi_field_panel.html
  Form.prototype.multi = function (p, prefix, ctx) {
    var self = this;
    return (
      "<fieldset>\n    <legend>" + e(p.heading || "") + '</legend>\n    <ul class="fields">' +
      p.children
        .map(function (c) {
          return '<li class="' + self.panelClasses(c, prefix) + '">' + self.asField(c, prefix, ctx) + "</li>";
        })
        .join("") +
      "</ul>\n</fieldset>"
    );
  };

  // render_as_object
  Form.prototype.asObject = function (p) {
    if (p.panel === "field") {
      // single_field_panel.html
      var info = this.fieldInfo(p.field, null, null, false);
      return (
        "<fieldset>\n    <legend>" + e(p.field.label) + '</legend>\n    <ul class="fields">\n        <li>' +
        W.fieldHTML(info) +
        "</li>\n    </ul>\n</fieldset>"
      );
    }
    if (p.panel === "multi") return this.multi(p, null, null);
    if (p.panel === "inline") return this.inline(p);
    return this.asField(p, null, null);
  };

  // object_list.html
  Form.prototype.objectList = function (panels) {
    var self = this;
    return (
      '<ul class="objects">' +
      panels
        .map(function (p) {
          var heading = p.panel === "field" ? p.field.label : p.heading;
          var forId = p.panel === "field" ? fid(p.field, null) : "";
          var help = p.panel === "field" ? p.field.objectHelp : p.help;
          return (
            '<li class="object ' + self.panelClasses(p, null) + '">' +
            (heading ? '<div class="title-wrapper"><label' + (forId ? ' for="' + forId + '"' : "") + ">" + e(heading) + "</label></div>" : "") +
            '<div class="object-layout">' +
            (help ? '<div class="object-layout_small-part"><div class="object-help help">' + W.icon("help", "default") + e(help) + "</div></div>" : "") +
            '<div class="object-layout_big-part">' + self.asObject(p) + "</div></div></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  };

  // django cautious_slugify
  F.slug = function (s) {
    return String(s)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[-\s]+/g, "-");
  };

  // tabbed_interface.html
  Form.prototype.tabbed = function (tabs) {
    var self = this;
    return (
      '<ul class="tab-nav merged" role="tablist">' +
      tabs
        .map(function (t, i) {
          var s = F.slug(t.heading);
          return '<li class="' + (t.classname || "") + " " + (i === 0 ? "active" : "") + '" role="tab" aria-controls="tab-' + s + '"><a href="#tab-' + s + '" class="' + (i === 0 ? "active" : "") + '">' + e(t.heading) + "</a></li>";
        })
        .join("") +
      '</ul><div class="tab-content">' +
      tabs
        .map(function (t, i) {
          var s = F.slug(t.heading);
          var inner;
          if (t.html !== undefined) {
            inner = typeof t.html === "function" ? t.html() : t.html;
            if (t.onBind) self.binders.push(t.onBind);
          } else inner = self.objectList(t.objects);
          return '<section id="tab-' + s + '" class="' + (t.classname || "") + " " + (i === 0 ? "active" : "") + '" role="tabpanel" aria-labelledby="tab-label-' + s + '">' + inner + "</section>";
        })
        .join("") +
      "</div>"
    );
  };

  // inline_panel.html + inline_panel_child.html (e read_only_inline_panel.html)
  Form.prototype.inline = function (p) {
    var self = this;
    var rows = this.values[p.name] || [];
    var prefix = p.prefix || p.name;
    var html =
      '<input type="hidden" name="' + prefix + '-TOTAL_FORMS" value="' + rows.length + '" id="id_' + prefix + '-TOTAL_FORMS">' +
      '<input type="hidden" name="' + prefix + '-INITIAL_FORMS" value="' + rows.filter(function (r) {
        return r.id;
      }).length + '" id="id_' + prefix + '-INITIAL_FORMS">' +
      '<input type="hidden" name="' + prefix + '-MIN_NUM_FORMS" value="' + (p.minNum || 0) + '" id="id_' + prefix + '-MIN_NUM_FORMS">' +
      '<input type="hidden" name="' + prefix + '-MAX_NUM_FORMS" value="' + (p.maxNum || 1000) + '" id="id_' + prefix + '-MAX_NUM_FORMS">';
    html += '\n\n<ul class="multiple" id="id_' + prefix + '-FORMS"' + (p.readOnly ? ' style="min-height: 200px;"' : "") + ">";
    var nonForm = this.errors[prefix + ".__all__"];
    if (nonForm && nonForm.length) {
      html +=
        '<li class="error-message">' +
        nonForm
          .map(function (m) {
            return "<span>" + e(m) + "</span>";
          })
          .join("") +
        "</li>";
    }
    rows.forEach(function (row, i) {
      html += self.inlineChild(p, prefix + "-" + i, row);
    });
    html += "</ul>";
    if (!p.readOnly) {
      html +=
        '\n\n<p class="add">\n    <a class="button bicolor button--icon" id="id_' + prefix + '-ADD">' + W.icon("plus", "", true) +
        "\n        Adicionar " + e(p.label ? p.label.toLowerCase() : "") + "\n    </a>\n</p>";
    }
    this.binders.push(function (root) {
      F.bindInline(self, p, prefix, root);
    });
    return html;
  };

  Form.prototype.inlineChild = function (p, childPrefix, row) {
    var self = this;
    var body =
      "<fieldset>\n    <legend>" + e(p.heading || "") + '</legend>\n    <ul class="fields">' +
      p.children
        .map(function (c) {
          return '<li class="' + self.panelClasses(c, childPrefix) + '">' + self.asField(c, childPrefix, row) + "</li>";
        })
        .join("") +
      "</ul>\n</fieldset>";
    if (p.readOnly) return '<li data-inline-panel-child id="inline_child_' + childPrefix + '">\n    ' + body + "</li>";
    return (
      '<li data-inline-panel-child id="inline_child_' + childPrefix + '" data-prefix="' + childPrefix + '">' +
      '<ul class="controls"><li><button type="button" class="button button-small button--icon text-replace white hover-no" id="id_' + childPrefix + '-DELETE-button" title="' + W.T.delete + '">' + W.icon("bin") + W.T.delete + "</button></li></ul>" +
      body +
      '<input type="hidden" name="' + childPrefix + '-id" value="' + e(row.id || "") + '" id="id_' + childPrefix + '-id">' +
      '<input type="hidden" name="' + childPrefix + '-DELETE" value="' + (row._delete ? "1" : "") + '" id="id_' + childPrefix + '-DELETE">' +
      "</li>"
    );
  };

  // page-editor.js InlinePanel + expanding_formset.js
  F.bindInline = function (form, p, prefix, root) {
    if (p.readOnly) return;
    var $root = $(root);
    var $list = $root.find("#id_" + prefix + "-FORMS");
    function setHasContent() {
      if ($list.children("li").not(".deleted").length) $list.parent().removeClass("empty");
      else $list.parent().addClass("empty");
    }
    function updateAddButtonState() {
      if (p.maxNum) {
        var n = $list.children("[data-inline-panel-child]").not(".deleted").length;
        $root.find("#id_" + prefix + "-ADD").toggleClass("disabled", n >= p.maxNum);
      }
    }
    function initChild($li) {
      var childPrefix = $li.attr("data-prefix");
      var $del = $li.find("#id_" + childPrefix + "-DELETE");
      $li.find("#id_" + childPrefix + "-DELETE-button").on("click", function () {
        $del.val("1");
        $li.addClass("deleted").slideUp(function () {
          updateAddButtonState();
          setHasContent();
        });
      });
      if ($del.val() === "1") {
        $li.addClass("deleted").hide(0, function () {
          updateAddButtonState();
          setHasContent();
        });
        $li.find(".error-message").remove();
      }
    }
    $list.children("[data-inline-panel-child]").each(function () {
      initChild($(this));
    });
    setHasContent();
    updateAddButtonState();
    $root.find("#id_" + prefix + "-ADD").on("click", function () {
      if ($(this).hasClass("disabled")) return;
      var $total = $root.find("#id_" + prefix + "-TOTAL_FORMS");
      var n = parseInt($total.val(), 10) || 0;
      var childPrefix = prefix + "-" + n;
      var sub = new Form(form.spec, {}, {}, form.opts);
      var $child = $(sub.inlineChild(p, childPrefix, {}));
      $list.append($child);
      $total.val(n + 1);
      sub.binders.forEach(function (b) {
        b($child[0], form);
      });
      W.afterRender($child[0]);
      initChild($child);
      setHasContent();
      updateAddButtonState();
      if (p.onAdd) p.onAdd($child[0]);
    });
  };

  // Monta o HTML completo do formulário (render_form_content)
  Form.prototype.render = function () {
    this.binders = [];
    if (this.spec.tabs) return this.tabbed(this.spec.tabs);
    return this.objectList(this.spec.objects);
  };

  Form.prototype.bind = function (root) {
    var self = this;
    this.root = root;
    this.binders.forEach(function (b) {
      b(root, self);
    });
  };

  // Lê os valores digitados de volta (como o request.POST do Django)
  Form.prototype.collect = function () {
    var root = this.root;
    var self = this;
    var out = RA.clone(this.values) || {};
    var readFile = [];
    function q(sel) {
      return root.querySelector(sel);
    }
    function read(def, prefix, target) {
      var id = fid(def, prefix);
      var k = keyOf(def);
      var el = q("#" + CSS.escape(id));
      if (!el && def.kind !== "chainedMulti" && def.kind !== "scrollCheckbox") return;
      switch (def.kind) {
        case "checkbox":
          target[k] = el.checked;
          break;
        case "date":
          var dv = el.value.trim();
          target[k] = dv ? RA.parseBRDate(dv) || dv : null;
          break;
        case "file":
          var clear = q("#" + CSS.escape(fname(def, prefix) + "-clear_id"));
          if (clear && clear.checked) target[k] = null;
          if (el.files && el.files[0]) {
            var file = el.files[0];
            readFile.push(
              RA.readImage(file, 1600, 0.85).then(function (d) {
                target[k] = d;
                if (def.fileKey) target[def.fileKey] = def.uploadPath ? def.uploadPath(file.name) : file.name;
              })
            );
          }
          break;
        case "chainedMulti":
          target[k] = Array.prototype.map.call(root.querySelectorAll("#" + CSS.escape(id) + " input[type=checkbox]:checked"), function (x) {
            return x.value;
          });
          break;
        case "scrollCheckbox":
          target[k] = Array.prototype.map.call(root.querySelectorAll('[name="' + fname(def, prefix) + '"]:checked'), function (x) {
            return x.value;
          });
          break;
        case "polygon":
          var coords = null;
          try {
            coords = el.value ? JSON.parse(el.value) : null;
          } catch (x) {
            coords = null;
          }
          target[k] = coords && coords.length ? coords : null;
          break;
        default:
          target[k] = el.value;
      }
    }
    function walk(panels, prefix, target) {
      panels.forEach(function (p) {
        if (p.panel === "field" && !p.field.readOnly) read(p.field, prefix, target);
        else if (p.panel === "multi" || p.panel === "row") walk(p.children, prefix, target);
        else if (p.panel === "inline" && !p.readOnly) {
          var pre = p.prefix || p.name;
          var rows = [];
          Array.prototype.forEach.call(root.querySelectorAll("#id_" + pre + "-FORMS > [data-inline-panel-child]"), function (li) {
            var cp = li.getAttribute("data-prefix");
            var row = {};
            row.id = (li.querySelector("#" + CSS.escape("id_" + cp + "-id")) || {}).value || null;
            row._delete = (li.querySelector("#" + CSS.escape("id_" + cp + "-DELETE")) || {}).value === "1";
            var old = (self.values[p.name] || []).filter(function (r) {
              return r.id && r.id === row.id;
            })[0];
            if (old) row = Object.assign({}, old, row);
            walk(p.children, cp, row);
            rows.push(row);
          });
          target[p.name] = rows;
        }
      });
    }
    if (this.spec.tabs) {
      this.spec.tabs.forEach(function (t) {
        if (t.objects) walk(t.objects, null, out);
      });
    } else walk(this.spec.objects, null, out);
    return Promise.all(readFile).then(function () {
      return out;
    });
  };

  // ------------------------------------------------------------------ chained select (core/widgets/chained_select.html)
  Form.prototype.bindChained = function (def, prefix, root, ctx) {
    var self = this;
    var $trigger = $(root).find("#" + fid({ name: def.trigger }, prefix));
    var $own = $(root).find("#" + fid(def, prefix));
    function render(items, selected) {
      if (def.kind === "chainedMulti") {
        var sel = selected || [];
        var html = items
          .map(function (it) {
            var checked = sel.indexOf(it.value) !== -1;
            return def.optionHTML
              ? def.optionHTML(it, checked, fname(def, prefix))
              : '<label><input type="checkbox" name="' + fname(def, prefix) + '" value="' + e(it.value) + '"' + (checked ? ' checked="checked"' : "") + ">" + e(it.label) + "</label>";
          })
          .join("");
        if (!items.length && !sel.length) html = "Não há opções disponíveis.";
        $own.html(html);
      } else {
        var h = '<option value=""' + (!selected ? ' selected=""' : "") + ">---------</option>";
        var inList = false;
        items.forEach(function (it) {
          var s = String(it.value) === String(selected);
          if (s) inList = true;
          h += '<option value="' + e(it.value) + '"' + (s ? ' selected=""' : "") + ">" + e(it.label) + "</option>";
        });
        if (selected && !inList && def.selectedLabel) {
          h += '<option value="' + e(selected) + '" selected="">' + e(def.selectedLabel(selected)) + "</option>";
        }
        $own.html(h);
      }
    }
    // Opções iniciais (geradas pelo servidor no original)
    var initialTrigger = $trigger.val();
    var initialSelected = self.value(def, prefix, ctx);
    Promise.resolve(initialTrigger ? def.loader(initialTrigger) : []).then(function (items) {
      render(items, initialSelected || (def.kind === "chainedMulti" ? [] : null));
      if (def.onRendered) def.onRendered($own);
    });
    $trigger.on("change", function () {
      var newValue = $trigger.val();
      if (!newValue) return;
      Promise.resolve(def.loader(newValue)).then(function (items) {
        render(items, def.kind === "chainedMulti" ? [] : null);
        $own.trigger("options_changed");
      });
    });
  };

  // ------------------------------------------------------------------ wagtailmodelchoosers (ModelChooserPanel)
  // templates/wagtailmodelchoosers/widgets/model_chooser.html + client/components/BaseChooser.js
  F.chooserWidget = function (def, id, name, v, values) {
    var display = v && def.display ? def.display(v, values) : "";
    return (
      '<div class="model-chooser">\n    <input type="hidden" value="' + e(v || "") + '" name="' + name + '" id="' + id + '">\n' +
      '    <div data-model-chooser-mount><div><div class="model-chooser__container">' +
      '<span class="model-chooser__label">' + e(display) + "</span>" +
      F.chooserButtons(def, !!v) +
      "</div></div></div>\n</div>"
    );
  };

  function secondaryButton(label, cls) {
    return '<button type="button" class="action-choose button-small button-secondary button ' + (cls || "") + '">' + e(label) + "</button>";
  }

  F.chooserButtons = function (def, hasValue) {
    var t = def.chooser.translations;
    if (!hasValue) return secondaryButton(t.choose, "ra-choose");
    return (
      "<span>" +
      secondaryButton(t.choose_again, "ra-choose") +
      (def.chooser.editUrl ? secondaryButton(t.edit || "Edit", "ra-edit") : "") +
      (def.chooserOptional ? secondaryButton(t.clear, "ra-clear") : "") +
      "</span>"
    );
  };

  F.bindChooser = function (def, id, root) {
    var $input = $(root).find("#" + CSS.escape(id));
    var $w = $input.closest(".model-chooser");
    function update(item) {
      $input.val(item ? String(item.id).replace(/ /g, "") : "");
      var ev = new Event("change", { bubbles: true });
      $input[0].dispatchEvent(ev);
      $w.find(".model-chooser__label").text(item ? item[def.chooser.displayKey] || item.id : "");
      $w.find(".model-chooser__container > :not(.model-chooser__label)").remove();
      $w.find(".model-chooser__container").append(F.chooserButtons(def, !!item));
    }
    $w.on("click", ".ra-choose", function () {
      F.chooserModal(def, $w.find("[data-model-chooser-mount] > div"), update);
    });
    $w.on("click", ".ra-clear", function (ev) {
      ev.preventDefault();
      update(null);
    });
    $w.on("click", ".ra-edit", function () {
      window.open(def.chooser.editUrl($input.val()), "_blank");
    });
  };

  // client/components/ModelPicker.js
  F.chooserModal = function (def, $mount, onSelect) {
    var c = def.chooser,
      t = c.translations;
    var pageSize = 10;
    var state = { models: [], loading: true, next: null, previous: null, count: 0, numPages: 0, page: 0, suggestions: [], showSuggestions: false };
    var $m = $(
      '<div class="modal admin-modal"><div class="admin-modal__dialog">' +
        '<div class="admin-modal__header"><h2>' + e(t.choose) + " " + e(c.label) + '</h2><button type="button" class="close icon text-replace icon-cross button">x</button></div>' +
        '<div class="admin-modal__actions"><div class="admin-modal__action"><div><div class="react-autosuggest__container">' +
        '<input type="text" autocomplete="off" class="react-autosuggest__input" placeholder="' + e(t.type_to_search) + '" value=""></div></div></div>' +
        '<div class="admin-modal__action"></div></div>' +
        '<div class="admin-modal__content_wrapper"><div class="admin-modal__content"></div></div>' +
        "</div></div>"
    );
    $mount.append($m);
    document.body.style.overflow = "hidden";
    document.body.style.width = document.body.offsetWidth + "px";

    function plural(n) {
      return n === 1 ? t.result : t.results;
    }
    function models() {
      return state.showSuggestions ? state.suggestions : state.models;
    }
    function draw() {
      var list = models();
      var count = state.showSuggestions ? state.suggestions.length : state.count;
      var pageText = state.showSuggestions ? "1 / 1 " + t.page : state.page + " / " + state.numPages + " " + plural(state.numPages);
      var prevOn = !state.showSuggestions && !!state.previous,
        nextOn = !state.showSuggestions && !!state.next;
      $m.find(".admin-modal__action").eq(1).html(
        '<span class="admin-modal__results">' + count + " " + plural(count) + "</span>" +
          '<span class="admin-modal__pagination">' + pageText + "</span>" +
          '<span><button type="button" class="button' + (prevOn ? "" : " button--disabled") + ' ra-prev">' + e(t.previous) + "</button>" +
          '<button type="button" class="button' + (nextOn ? "" : " button--disabled") + ' ra-next">' + e(t.next) + "</button></span>"
      );
      var h = '<table class="chooser-table"><thead><tr>' +
        c.listDisplay
          .map(function (f) {
            return "<td>" + e(f.label) + "</td>";
          })
          .join("") +
        "</tr></thead><tbody>";
      if (list.length) {
        list.forEach(function (it, i) {
          h += '<tr class="chooser__item" data-i="' + i + '">' +
            c.listDisplay
              .map(function (f) {
                return '<td class="chooser__cell">' + e(it[f.name] === null || it[f.name] === undefined ? "" : it[f.name]) + "</td>";
              })
              .join("") +
            "</tr>";
        });
      } else {
        h += '<tr class="chooser__item"><td colspan="' + c.listDisplay.length + '" class="chooser__cell chooser__cell--disabled">' + e(state.loading ? t.loading : t.no_results) + "</td></tr>";
      }
      h += "</tbody></table>";
      $m.find(".admin-modal__content").html(h).scrollTop(0);
    }
    function closeWith(cb) {
      $m.addClass("admin-modal--exit");
      setTimeout(function () {
        $m.remove();
        document.body.style.overflow = "";
        document.body.style.width = "";
        if (cb) cb();
      }, 400);
    }
    function navigate(page) {
      state.loading = true;
      fetch(c.endpoint + "/?page_size=" + pageSize + (page ? "&page=" + page : ""))
        .then(function (r) {
          return r.json();
        })
        .then(function (json) {
          state.numPages = json.num_pages || (json.count ? Math.ceil(json.count / pageSize) : 0);
          state.page = json.page;
          state.models = json.results;
          state.count = json.count;
          state.next = json.next;
          state.previous = json.previous;
          state.loading = false;
          draw();
        });
    }
    $m.on("click", ".close", function () {
      closeWith();
    });
    $m.on("click", "tr.chooser__item[data-i]", function () {
      var it = models()[+$(this).attr("data-i")];
      closeWith(function () {
        onSelect(it);
      });
    });
    $m.on("click", ".ra-prev", function () {
      if (!state.showSuggestions) navigate(state.page - 1);
    });
    $m.on("click", ".ra-next", function () {
      if (!state.showSuggestions) navigate(state.page + 1);
    });
    $m.find(".react-autosuggest__input").on("input", function () {
      var value = this.value;
      state.showSuggestions = value.trim().length > 2;
      fetch(c.endpoint + "/?search=" + encodeURIComponent(value))
        .then(function (r) {
          return r.json();
        })
        .then(function (json) {
          state.suggestions = json.results;
          draw();
        });
      draw();
    });
    draw();
    setTimeout(function () {
      navigate(0);
    }, 650);
  };

  // ------------------------------------------------------------------ core/widgets/scrollable_checkbox_select.html
  F.scrollableCheckboxWidget = function (def, id, name, selected) {
    var items = def.choices || [];
    return (
      '<style type="text/css">.scrollable_checkbox_select_multiple ul {display: flex;flex-wrap: wrap;}' +
      ".scrollable_checkbox_select_multiple li {flex-shrink: 0;width: calc(33% - 7px);}" +
      ".scrollable_checkbox_select_multiple .filter-options {display: flex;flex-direction: row;margin-bottom: 20px;margin-left: 10px;}" +
      ".scrollable_checkbox_select_multiple .selected-items {font-weight: bold;}" +
      ".scrollable_checkbox_select_multiple .selection-subtitle {flex-grow: 1;margin: 0;}" +
      ".scrollable_checkbox_select_multiple .multi-items-wrapper {max-height: 200px;margin-top: 10px;overflow: auto;border-radius: 10px;border: 1px solid #e6e6e6;padding: 20px;}</style>" +
      '<div class="filter-options"><p class="selection-subtitle"><span class="items-count"> 0 itens selecionados</span> <span class="selected-items"><span></span></span></p>' +
      '<a href="#" class="btn-clear-selection" style="display: none;">Limpar seleção</a></div>' +
      '<div class="input"><input type="text" class="multi-select-search" placeholder="Buscar produto"></div>' +
      '<div class="multi-items-wrapper"><ul id="' + id + '">' +
      items
        .map(function (c, i) {
          var checked = selected.indexOf(c[0]) !== -1;
          return '<li><label for="' + id + "_" + i + '"><input type="checkbox" name="' + name + '" value="' + e(c[0]) + '" id="' + id + "_" + i + '"' + (checked ? " checked" : "") + (def.readOnly ? " disabled" : "") + ">\n " + e(c[1]) + "</label>\n\n</li>";
        })
        .join("") +
      "</ul></div>"
    );
  };

  F.bindScrollableCheckbox = function (root, id) {
    var $w = $(root).find("#" + id).closest(".field-content");
    var state = { searchText: "", selectedItems: [] };
    var $searchBar = $w.find(".multi-select-search"),
      $itemsCount = $w.find(".items-count"),
      $selectedItems = $w.find(".selected-items"),
      $btnClear = $w.find(".btn-clear-selection");
    function updateViewport() {
      var items = $w.find(".multi-items-wrapper li");
      var searchText = state.searchText.trim().toUpperCase();
      if (searchText.length === 0) {
        items.show();
        return;
      }
      var keywords = searchText.split(" ");
      items.each(function () {
        var text = $(this).text().trim().toUpperCase();
        var matches = keywords.filter(function (k) {
          return text.indexOf(k) !== -1;
        }).length;
        $(this).toggle(matches === keywords.length);
      });
    }
    function updateSelection() {
      if (state.selectedItems.length === 0) {
        $itemsCount.text("0 items selecionados");
        $selectedItems.hide();
        $btnClear.hide();
      } else {
        $btnClear.show();
        $itemsCount.text(state.selectedItems.length === 1 ? "1 item selecionado: " : state.selectedItems.length + " itens selecionados: ");
        $selectedItems.text(state.selectedItems.join(", ")).show();
      }
    }
    $searchBar.on("input", function () {
      state.searchText = $searchBar.val();
      updateViewport();
      updateSelection();
    });
    $btnClear.on("click", function (ev) {
      ev.preventDefault();
      $w.find(".multi-items-wrapper li input:checked").prop("checked", false);
      state.selectedItems = [];
      updateSelection();
    });
    var checked = $w.find(".multi-items-wrapper li input:checked");
    if (checked.length) {
      checked.each(function () {
        state.selectedItems.push($(this).parent().text().trim());
      });
      updateSelection();
    }
    $w.find(".multi-items-wrapper li input").on("change", function (ev) {
      var text = $(ev.target).parent().text().trim();
      if (ev.target.checked) state.selectedItems.push(text);
      else
        state.selectedItems = state.selectedItems.filter(function (v) {
          return v !== text;
        });
      updateSelection();
    });
  };

  // ------------------------------------------------------------------ croqui (farm_journals/panels/google_map_polygon_widget.html)
  F.polygonWidget = function (def, id, name, v) {
    return (
      '<style type="text/css">.map-widget ol li {list-style-type: decimal;}' +
      ".map-widget .map-controls {margin-bottom: 20px;display: flex;align-items: center;}" +
      ".map-widget .map-controls button {flex-shrink: 0;}" +
      ".error .map-widget .help-block {border: 1px solid #cd3238;border-radius: 8px;}" +
      "#map-search {flex-grow: 1;margin-left: 10px;padding-top: 8px;padding-bottom: 8px;}" +
      "#map {height: 600px;}#" + id + " {display: none;}</style>" +
      '<div class="map-widget">' +
      '<textarea id="' + id + '" class="required" cols="150" rows="10" name="' + name + '">' + e(v && v.length ? JSON.stringify(v) : "") + "</textarea>" +
      '<div class="help-block"><p>Utilize o mapa abaixo para localizar o talhão em sua propriedade. Siga os seguintes passos:</p><ol>' +
      "<li>Clique e arraste o mapa abaixo até localizar sua propriedade.</li>" +
      "<li>Clique no botão <strong>Adicionar talhão</strong>.</li>" +
      "<li>Clique e arraste os pontos do polígono para equivaler às fronteiras do talhão.</li>" +
      "<li>Caso deseje recomeçar o desenho, clique em <strong>Remover talhão</strong> e depois em <strong>Adicionar talhão</strong>.</li></ol></div>" +
      '<div class="map-controls"><button id="btn-add-polygon" type="button" class="button">Adicionar talhão</button>' +
      '<button id="btn-remove-polygon" type="button" class="button no" disabled>Remover talhão</button>' +
      '<button id="btn-center-polygon" type="button" class="button" disabled>Centralizar talhão</button>' +
      '<input id="map-search" type="text" placeholder="Buscar localidade"></div>' +
      '<div id="map"></div></div>'
    );
  };

  F.bindPolygon = function (def, id, root, form) {
    var $input = $(root).find("#" + id);
    var $add = $(root).find("#btn-add-polygon"),
      $remove = $(root).find("#btn-remove-polygon"),
      $center = $(root).find("#btn-center-polygon");
    var initial = form.value(def) || null;
    var editor = null;
    function updateState() {
      var has = editor && editor.hasPolygon();
      $add.prop("disabled", !!has);
      $remove.prop("disabled", !has);
      $center.prop("disabled", !has);
    }
    Promise.resolve(def.initialCenter ? def.initialCenter() : null).then(function (center) {
      center = center || { lat: -25.4490342, lng: -49.2591763 };
      RA.maps
        .polygonEditor({
          container: $(root).find("#map")[0],
          center: center,
          initial: initial,
          searchInput: RA.maps.hasGoogle() ? $(root).find("#map-search")[0] : null,
          onChange: function (coords) {
            $input.val(JSON.stringify(coords));
            updateState();
          }
        })
        .then(function (ed) {
          editor = ed;
          updateState();
        });
    });
    $add.on("click", function () {
      if (editor) editor.add();
    });
    $center.on("click", function () {
      if (editor) editor.center();
    });
    $remove.on("click", function () {
      $.confirm({
        title: "Remover talhão",
        useBootstrap: false,
        boxWidth: "400px",
        content: "Tem certeza que deseja remover o talhão desenhado?",
        buttons: {
          confirm: {
            text: "Sim",
            btnClass: "button",
            action: function () {
              editor.remove();
            }
          },
          cancel: { btnClass: "button no", text: "Cancelar" }
        }
      });
    });
    if (!RA.maps.hasGoogle()) {
      // Sem Google Maps: a busca de localidade usa o OpenStreetMap
      var t = null;
      $(root)
        .find("#map-search")
        .on("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            if (editor && editor.search) editor.search(this.value);
          }
        })
        .on("input", function () {
          var v = this.value;
          clearTimeout(t);
          t = setTimeout(function () {
            if (v.length > 3 && editor && editor.search) editor.search(v);
          }, 900);
        });
    }
  };
})(window, window.jQuery);
