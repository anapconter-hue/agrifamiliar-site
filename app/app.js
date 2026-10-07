/*
 * Rastrear AgriFamiliar - app do produtor.
 * Cópia em HTML/JavaScript do app Flutter (fetaep_app 1.3.1), tela por tela.
 * Cada tela indica o arquivo .dart de origem.
 */
(function (window, document) {
  "use strict";

  var RA = window.RA;
  var api = RA.api;
  var e = RA.esc;
  var root = document.getElementById("app");

  var session = { user: null, profile: null };

  // ------------------------------------------------------------------ ícones
  var FA = {
    box: '<svg class="fa-svg" viewBox="0 0 512 512"><path d="M509.5 184.6L458.9 32.8C452.4 13.2 434.1 0 413.4 0H272v192h238.7c-.4-2.5-.4-5-1.2-7.4zM240 0H98.6c-20.7 0-39 13.2-45.5 32.8L2.5 184.6c-.8 2.4-.8 4.9-1.2 7.4H240V0zM0 224v240c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V224H0z"/></svg>',
    qrcode: '<svg class="fa-svg" viewBox="0 0 448 512"><path d="M0 224h192V32H0v192zM64 96h64v64H64V96zm192-64v192h192V32H256zm128 128h-64V96h64v64zM0 480h192V288H0v192zm64-128h64v64H64v-64zm352-64h32v128h-96v-32h-32v96h-64V288h96v32h64v-32zm0 160h32v32h-32v-32zm-64 0h32v32h-32v-32z"/></svg>',
    clipboardList: '<svg class="fa-svg" viewBox="0 0 384 512"><path d="M336 64h-80c0-35.3-28.7-64-64-64s-64 28.7-64 64H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM96 424c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm0-96c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm0-96c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm96-192c13.3 0 24 10.7 24 24s-10.7 24-24 24-24-10.7-24-24 10.7-24 24-24zm128 368c0 4.4-3.6 8-8 8H168c-4.4 0-8-3.6-8-8v-16c0-4.4 3.6-8 8-8h144c4.4 0 8 3.6 8 8v16zm0-96c0 4.4-3.6 8-8 8H168c-4.4 0-8-3.6-8-8v-16c0-4.4 3.6-8 8-8h144c4.4 0 8 3.6 8 8v16zm0-96c0 4.4-3.6 8-8 8H168c-4.4 0-8-3.6-8-8v-16c0-4.4 3.6-8 8-8h144c4.4 0 8 3.6 8 8v16z"/></svg>'
  };
  var CHECK_SVG = '<svg viewBox="0 0 24 24"><path fill="#fff" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

  function mi(name, extra) {
    return '<span class="mi ' + (extra || "") + '">' + name + "</span>";
  }

  // ------------------------------------------------------------------ utilidades de interface
  function h(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function spinner() {
    return '<svg class="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20"></circle></svg>';
  }

  // CustomProgressIndicator
  function progressBox() {
    return '<div class="progress-box"><div class="card">' + spinner() + "</div></div>";
  }

  // ItemsLoadingIndicator
  function itemsLoading() {
    return '<div class="items-loading">' + spinner() + "</div>";
  }

  // feedback.dart showFeedback
  var snackTimer = null;
  function showFeedback(message, ms) {
    var old = document.querySelector(".snackbar");
    if (old) old.remove();
    var s = h('<div class="snackbar"></div>');
    s.textContent = message;
    document.body.appendChild(s);
    clearTimeout(snackTimer);
    snackTimer = setTimeout(function () {
      s.remove();
    }, ms || 4000);
  }

  function showRequestError(error) {
    if (error && error.name === "ValidationError" && error.message) showFeedback(error.message);
    else showFeedback("Ocorreu um erro. Por favor, tente novamente");
  }

  // ProgressDialogManager / ProgressHUD
  function withProgress(promise) {
    var hud = h('<div class="hud">' + spinner() + "</div>");
    document.body.appendChild(hud);
    return Promise.resolve(promise).then(
      function (r) {
        hud.remove();
        return r;
      },
      function (err) {
        hud.remove();
        throw err;
      }
    );
  }

  // Diálogos ---------------------------------------------------------
  function openDialog(inner, opts) {
    opts = opts || {};
    var back = h('<div class="dialog-backdrop"></div>');
    var box = h('<div class="dialog ' + (opts.cls || "") + '"></div>');
    if (typeof inner === "string") box.innerHTML = inner;
    else box.appendChild(inner);
    back.appendChild(box);
    document.body.appendChild(back);
    var close = function () {
      back.remove();
      if (opts.onClose) opts.onClose();
    };
    if (opts.dismissible !== false) {
      back.addEventListener("click", function (ev) {
        if (ev.target === back) close();
      });
    }
    return { el: box, close: close };
  }

  // dialogs.dart showConfirmationDialog
  function confirmDialog(title, text, onOk, opts) {
    opts = opts || {};
    var d = openDialog(
      '<div class="simple-dialog">' +
        '<div class="dialog-title">' + e(title) + "</div>" +
        '<div style="margin: 10px 20px 0" class="dialog-text">' + e(text) + "</div>" +
        '<div class="dialog-buttons"><button class="btn btn-secondary" data-cancel>CANCELAR</button><button class="btn btn-accent" data-ok>' +
        e(opts.confirmText || "OK") +
        "</button></div></div>"
    );
    d.el.querySelector("[data-cancel]").onclick = d.close;
    d.el.querySelector("[data-ok]").onclick = function () {
      if (opts.dismissOnConfirmation) d.close();
      onOk(d);
    };
    return d;
  }

  // ------------------------------------------------------------------ campos de formulário
  var V = {
    REQUIRED: 1,
    EMAIL: 2,
    CPF: 16,
    CPF_OR_CNPJ: 2048,
    DECIMAL: 4096,
    CNPJ: 8192
  };
  var VALIDATORS = [
    [V.REQUIRED, "Campo obrigatório.", function (v) { return v !== null && v !== undefined && String(v).trim().length > 0; }],
    [V.EMAIL, "E-mail inválido.", function (v) { return RA.isEmail(v); }],
    [V.CPF, "CPF inválido.", function (v) { return RA.isCPF(v); }],
    [V.CPF_OR_CNPJ, "CPF ou CNPJ inválido.", function (v) { return RA.isCPF(v) || RA.isCNPJ(v); }],
    [V.CNPJ, "CNPJ inválido.", function (v) { return RA.isCNPJ(v); }],
    [V.DECIMAL, "Número inválido", function (v) { return v !== null && v !== undefined && !isNaN(Number(String(v).replace(",", "."))) && String(v).trim() !== ""; }]
  ];
  // validators.dart getValidator
  function getValidator(type) {
    return function (val) {
      for (var i = 0; i < VALIDATORS.length; i++) {
        var vv = VALIDATORS[i];
        if ((vv[0] & type) === vv[0] && !vv[2](val)) return vv[1];
      }
      return null;
    };
  }
  function requiredItem(item) {
    return item === null || item === undefined || (Array.isArray(item) && false) ? "" : null;
  }

  function Form() {
    this.fields = [];
  }
  Form.prototype.add = function (f) {
    this.fields.push(f);
    return f;
  };
  Form.prototype.validate = function () {
    var ok = true;
    this.fields.forEach(function (f) {
      if (!f.validate()) ok = false;
    });
    return ok;
  };

  // InternalTextFormField
  function textField(o) {
    var el = h(
      '<div class="field">' +
        (o.prefixIcon ? '<div class="with-prefix">' + mi(o.prefixIcon) : "") +
        '<input class="input" autocomplete="off">' +
        (o.prefixIcon ? "</div>" : "") +
        '<div class="error-text"></div></div>'
    );
    var input = el.querySelector("input");
    input.type = o.obscure ? "password" : "text";
    input.placeholder = o.hint || "";
    if (o.keyboard === "number") input.inputMode = "numeric";
    if (o.keyboard === "decimal") input.inputMode = "decimal";
    if (o.capitalization) input.setAttribute("autocapitalize", o.capitalization);
    if (o.value !== undefined && o.value !== null) input.value = o.value;
    if (o.mask === "cpfcnpj") {
      input.addEventListener("input", function () {
        input.value = RA.maskCpfCnpj(input.value);
      });
    }
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        var all = Array.prototype.slice.call(document.querySelectorAll(".screen:last-child input"));
        var i = all.indexOf(input);
        if (i >= 0 && all[i + 1]) all[i + 1].focus();
        else input.blur();
      }
    });
    var f = {
      el: el,
      input: input,
      get value() {
        return input.value;
      },
      set value(v) {
        input.value = v;
      },
      setError: function (msg) {
        el.classList.toggle("has-error", msg !== null && msg !== undefined);
        el.querySelector(".error-text").textContent = msg || "";
      },
      validate: function () {
        var msg = o.validator ? o.validator(input.value) : null;
        f.setError(msg);
        return msg === null || msg === undefined;
      }
    };
    if (o.onInput) input.addEventListener("input", o.onInput);
    return f;
  }

  // ExternalIconTextFormField (login)
  function extField(o) {
    var el = h(
      '<div class="ext-field"><div class="wrap">' + mi(o.icon) + '<input class="input" autocomplete="off"></div><div class="error-text"></div></div>'
    );
    var input = el.querySelector("input");
    input.type = o.obscure ? "password" : "text";
    input.placeholder = o.hint;
    if (o.mask === "cpfcnpj") {
      input.inputMode = "numeric";
      input.addEventListener("input", function () {
        input.value = RA.maskCpfCnpj(input.value);
      });
    }
    return {
      el: el,
      input: input,
      get value() {
        return input.value;
      },
      validate: function () {
        var msg = o.validator ? o.validator(input.value) : null;
        el.querySelector(".error-text").textContent = msg || "";
        return !msg;
      }
    };
  }

  // PickerButton
  function pickerButton(o) {
    var el = h(
      '<div><div class="picker"><div class="text"></div>' + mi(o.rightIcon || "arrow_drop_down") + '</div><div class="picker-error"></div></div>'
    );
    var btn = el.querySelector(".picker");
    var f = {
      el: el,
      setText: function (text, selected) {
        btn.querySelector(".text").textContent = text;
        btn.classList.toggle("selected", !!selected);
      },
      setError: function (msg) {
        btn.classList.toggle("has-error", msg !== null && msg !== undefined);
        el.querySelector(".picker-error").textContent = msg && msg.trim() ? msg : "";
      }
    };
    btn.addEventListener("click", function () {
      if (document.activeElement) document.activeElement.blur();
      o.onPressed();
    });
    return f;
  }

  function sameItem(a, b) {
    if (a === b) return true;
    if (a && b && typeof a === "object" && typeof b === "object" && a.id !== undefined) return a.id === b.id;
    return false;
  }

  // SimplePickerDialog
  function pickerDialog(o, onChange) {
    var selected = (o.initialSelection || []).slice();
    var d = openDialog('<div class="picker-dialog">' + itemsLoading() + "</div>", { cls: "" });
    var box = d.el.querySelector(".picker-dialog");
    Promise.resolve(o.items ? o.items : o.itemsLoader())
      .then(function (items) {
        function draw() {
          var html = "";
          if (o.title) html += '<div class="p-title">' + e(o.title) + "</div>";
          if (!items.length) {
            html += '<div class="empty">' + e(o.emptyText || "Nenhum item a exibir.") + "</div>";
          } else {
            items.forEach(function (it, idx) {
              var checked = selected.some(function (s) {
                return sameItem(s, it);
              });
              var label = o.itemBuilder ? o.itemBuilder(it, checked) : '<span style="color:var(--gray);font-size:15px">' + e(String(it)) + "</span>";
              if (o.multi) {
                html +=
                  '<div class="picker-item top" data-i="' + idx + '"><span class="m-checkbox ' + (checked ? "checked" : "") + '" style="--cb-color: var(--gray)"><span class="box">' + CHECK_SVG + '</span></span><div class="label">' + label + "</div></div>";
              } else {
                html +=
                  '<div class="picker-item" data-i="' + idx + '"><span class="m-radio ' + (checked ? "checked" : "") + '"><span class="ring"></span></span><div class="label">' + label + "</div></div>";
              }
            });
          }
          var above = o.max && selected.length > o.max;
          if (above) html += '<div class="max-warning">Você pode selecionar no máximo ' + o.max + " itens.</div>";
          if (o.multi) html += '<div style="height:15px"></div><button class="btn btn-accent" data-ok ' + (above ? "disabled" : "") + ">OK</button>";
          box.innerHTML = html;
          Array.prototype.forEach.call(box.querySelectorAll(".picker-item"), function (row) {
            row.addEventListener("click", function () {
              var it = items[+row.getAttribute("data-i")];
              if (o.multi) {
                var i = -1;
                selected.forEach(function (s, k) {
                  if (sameItem(s, it)) i = k;
                });
                if (i >= 0) selected.splice(i, 1);
                else selected.push(it);
                draw();
              } else {
                selected = [it];
                onChange(selected);
                d.close();
              }
            });
          });
          var ok = box.querySelector("[data-ok]");
          if (ok)
            ok.addEventListener("click", function () {
              onChange(selected);
              d.close();
            });
        }
        draw();
      })
      .catch(function () {
        box.innerHTML =
          '<div style="text-align:center;padding:30px 20px">Ocorreu um erro. Tente novamente.</div><div style="margin-top:20px"><button class="btn btn-accent">Tentar novamente</button></div>';
        box.querySelector("button").onclick = function () {
          d.close();
          pickerDialog(o, onChange);
        };
      });
  }

  // SinglePickerFormField / MultiPickerFormField
  function pickerField(o) {
    var value = o.multi ? (o.initialValue || []).slice() : o.initialValue === undefined ? null : o.initialValue;
    var pb = pickerButton({
      onPressed: function () {
        pickerDialog(
          {
            title: o.dialogTitle || o.hint,
            items: o.items,
            itemsLoader: o.itemsLoader,
            multi: o.multi,
            max: o.max,
            emptyText: o.emptyText,
            itemBuilder: o.itemBuilder,
            initialSelection: o.multi ? value : value !== null ? [value] : []
          },
          function (items) {
            value = o.multi ? items : items.length ? items[0] : null;
            update();
            if (o.onChange) o.onChange(value);
          }
        );
      }
    });
    function isSelected() {
      return o.multi ? value.length > 0 : value !== null && value !== undefined;
    }
    function update() {
      pb.setText(isSelected() ? (o.multi ? o.selectionText(value) : o.selectionText(value)) : o.hint, isSelected());
    }
    update();
    var f = {
      el: pb.el,
      get value() {
        return value;
      },
      setValue: function (v) {
        value = v;
        update();
      },
      validate: function () {
        var msg = o.validator ? o.validator(o.multi ? (value.length ? value : null) : value) : null;
        pb.setError(msg);
        return msg === null || msg === undefined;
      }
    };
    return f;
  }

  // DatePickerFormField
  function dateField(o) {
    var value = o.initialValue || null;
    var pb = pickerButton({
      rightIcon: "calendar_today",
      onPressed: function () {
        datePicker(o.hint, o.maxDate, function (d) {
          value = RA.isoDate(d);
          update();
        });
      }
    });
    function update() {
      pb.setText(value ? RA.fmtDate(value) : o.hint, !!value);
    }
    update();
    return {
      el: pb.el,
      get value() {
        return value;
      },
      validate: function () {
        var msg = o.validator ? o.validator(value) : null;
        pb.setError(msg);
        return msg === null || msg === undefined;
      }
    };
  }

  // showDatePicker do Flutter (tema e textos padrão, em inglês)
  var MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MONTHS_SHORT_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAYS_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function datePicker(helpText, maxDate, onPick) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var last = maxDate ? RA.toDate(maxDate) : RA.addDays(today, 365);
    var sel = new Date(today.getTime());
    var view = new Date(sel.getFullYear(), sel.getMonth(), 1);
    var mode = "day";
    var d = openDialog('<div class="date-dialog"></div>', { cls: "date-dialog" });
    var box = d.el;
    box.innerHTML = "";
    function draw() {
      var html =
        '<div class="dh"><div class="help">' + e(helpText || "SELECT DATE") + '</div><div class="big">' +
        DAYS_SHORT_EN[sel.getDay()] + ", " + MONTHS_SHORT_EN[sel.getMonth()] + " " + sel.getDate() + "</div></div>";
      html +=
        '<div class="nav"><div class="ym" data-mode>' + MONTHS_EN[view.getMonth()] + " " + view.getFullYear() + " " + mi(mode === "day" ? "arrow_drop_down" : "arrow_drop_up") + "</div>";
      if (mode === "day") html += '<button data-prev>' + mi("chevron_left") + '</button><button data-next>' + mi("chevron_right") + "</button>";
      html += "</div>";
      if (mode === "day") {
        html += '<div class="grid">';
        ["S", "M", "T", "W", "T", "F", "S"].forEach(function (w) {
          html += '<div class="wd">' + w + "</div>";
        });
        var first = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
        var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
        for (var i = 0; i < first; i++) html += '<div class="d"></div>';
        for (var dd = 1; dd <= days; dd++) {
          var dt = new Date(view.getFullYear(), view.getMonth(), dd);
          var cls = "d";
          if (dt.getTime() === today.getTime()) cls += " today";
          if (dt.getTime() === sel.getTime()) cls += " sel";
          if (dt > last) cls += " dis";
          html += '<div class="' + cls + '" data-day="' + dd + '"><span>' + dd + "</span></div>";
        }
        html += "</div>";
      } else {
        html += '<div class="years">';
        for (var y = 1970; y <= last.getFullYear(); y++)
          html += '<span data-year="' + y + '" class="' + (y === view.getFullYear() ? "sel" : "") + '">' + y + "</span>";
        html += "</div>";
      }
      html += '<div class="db"><button data-cancel>CANCEL</button><button data-ok>OK</button></div>';
      box.innerHTML = html;
      box.querySelector("[data-mode]").onclick = function () {
        mode = mode === "day" ? "year" : "day";
        draw();
        var s = box.querySelector(".years .sel");
        if (s) s.scrollIntoView({ block: "center" });
      };
      var prev = box.querySelector("[data-prev]");
      if (prev)
        prev.onclick = function () {
          view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
          draw();
        };
      var next = box.querySelector("[data-next]");
      if (next)
        next.onclick = function () {
          view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
          draw();
        };
      Array.prototype.forEach.call(box.querySelectorAll("[data-day]"), function (c) {
        if (c.classList.contains("dis")) return;
        c.onclick = function () {
          sel = new Date(view.getFullYear(), view.getMonth(), +c.getAttribute("data-day"));
          draw();
        };
      });
      Array.prototype.forEach.call(box.querySelectorAll("[data-year]"), function (c) {
        c.onclick = function () {
          view = new Date(+c.getAttribute("data-year"), view.getMonth(), 1);
          mode = "day";
          draw();
        };
      });
      box.querySelector("[data-cancel]").onclick = d.close;
      box.querySelector("[data-ok]").onclick = function () {
        d.close();
        onPick(sel);
      };
    }
    draw();
  }

  // CheckboxGroup + CheckboxField
  function checkboxGroup(items) {
    var el = h('<div class="checkbox-group' + (items.length === 1 ? " single" : "") + '"></div>');
    var api2 = {};
    items.forEach(function (it) {
      var row = h(
        '<div class="checkbox-field"><span class="m-checkbox"><span class="box">' + CHECK_SVG + '</span></span><div class="label"></div></div>'
      );
      row.querySelector(".label").textContent = it.text;
      var cb = row.querySelector(".m-checkbox");
      var state = !!it.value;
      cb.classList.toggle("checked", state);
      row.addEventListener("click", function () {
        state = !state;
        cb.classList.toggle("checked", state);
        if (it.onChange) it.onChange(state);
      });
      api2[it.key] = {
        get value() {
          return state;
        },
        set value(v) {
          state = !!v;
          cb.classList.toggle("checked", state);
        }
      };
      el.appendChild(row);
    });
    api2.el = el;
    return api2;
  }

  // ImagePickerButton (+ _ImagePickerMenu)
  function imagePickerField(hint, onPicked) {
    var picked = null;
    var pb = pickerButton({
      rightIcon: "cloud_upload",
      onPressed: function () {
        var back = h(
          '<div class="sheet-backdrop"><div class="sheet"><div class="tile" data-camera>' + mi("photo_camera") + 'Tirar foto</div><div class="tile" data-gallery>' + mi("photo_album") + "Buscar na galeria</div></div></div>"
        );
        document.body.appendChild(back);
        back.addEventListener("click", function (ev) {
          if (ev.target === back) back.remove();
        });
        function pick(capture) {
          var inp = document.createElement("input");
          inp.type = "file";
          inp.accept = "image/*";
          if (capture) inp.setAttribute("capture", "environment");
          inp.onchange = function () {
            var file = inp.files && inp.files[0];
            back.querySelector(".sheet").innerHTML = '<div style="padding:20px">' + progressBox() + "</div>";
            RA.readImage(file, 1280, 0.5).then(function (dataUrl) {
              back.remove();
              if (dataUrl) {
                picked = dataUrl;
                pb.setText("1 imagem selecionada", true);
                onPicked(dataUrl);
              }
            });
          };
          inp.click();
        }
        back.querySelector("[data-camera]").onclick = function () {
          pick(true);
        };
        back.querySelector("[data-gallery]").onclick = function () {
          pick(false);
        };
      }
    });
    pb.setText(hint, false);
    return {
      el: pb.el,
      get value() {
        return picked;
      },
      validate: function () {
        return true;
      }
    };
  }

  // ------------------------------------------------------------------ estruturas de tela
  // CustomAppBar
  function appBar(title, opts) {
    opts = opts || {};
    var bar = h(
      '<div class="app-bar' + (opts.sliver ? " sliver" : "") + '"><div class="toolbar">' +
        (opts.noBack ? "" : '<button class="back" aria-label="Voltar">' + mi("arrow_back") + "</button>") +
        '<div class="title' + (opts.noBack ? " no-back" : "") + '"></div><div class="actions"></div></div><div class="bottom"></div></div>'
    );
    bar.querySelector(".title").textContent = title;
    var back = bar.querySelector(".back");
    if (back)
      back.onclick = function () {
        if (opts.onBack) opts.onBack();
        else nav.back();
      };
    return bar;
  }

  // BasicScreen
  function basicScreen(title, opts) {
    var s = h('<div class="screen"></div>');
    s.appendChild(appBar(title, opts));
    var body = h('<div class="body-list"></div>');
    s.appendChild(body);
    return { el: s, body: body };
  }

  // BasicFutureRequestScreen
  function futureScreen(title, futureCreator, successBuilder) {
    var sc = basicScreen(title);
    function load() {
      sc.body.innerHTML = progressBox();
      futureCreator()
        .then(function (r) {
          if (r === null || r === undefined) throw new Error("vazio");
          sc.body.innerHTML = "";
          successBuilder(sc.body, r);
        })
        .catch(function (err) {
          console.error(err);
          sc.body.innerHTML =
            '<div style="display:flex;flex-direction:column;align-items:stretch;text-align:center">' +
            '<div style="font-weight:900;color:var(--gray);font-size:24px">Ops!</div>' +
            '<div style="height:50px"></div><div>' + mi("error", "") + '</div><div style="height:50px"></div>' +
            '<div style="color:var(--medium-gray);font-size:16px;font-weight:500">Verifique a sua conexão<br>e tente novamente.</div>' +
            '<div style="height:50px"></div><button class="btn btn-accent">TENTAR NOVAMENTE</button></div>';
          var icon = sc.body.querySelector(".mi");
          icon.style.fontSize = "100px";
          icon.style.color = "var(--light-primary)";
          sc.body.querySelector("button").onclick = load;
        });
    }
    load();
    return sc;
  }

  // BasicListScreen (lista com app bar flutuante, busca e botão)
  function listScreen(o) {
    var s = h('<div class="screen"></div>');
    var bar = appBar(o.title, { sliver: true, onBack: o.onBack });
    var bottom = bar.querySelector(".bottom");
    var search = null;
    if (o.displaySearch) {
      search = textField({ hint: "Pesquisar", prefixIcon: "search" });
      bottom.appendChild(search.el);
      bottom.appendChild(h('<div class="h5" style="height:5px"></div>'));
    }
    if (o.buttonText) {
      var b = h('<button class="btn btn-accent"></button>');
      b.textContent = o.buttonText;
      b.onclick = o.onPressed;
      bottom.appendChild(b);
      bottom.appendChild(h('<div style="height:15px"></div>'));
    }
    var subtitle = h('<p class="subtitle hidden"></p>');
    bottom.appendChild(subtitle);
    if (o.actions) bar.querySelector(".actions").appendChild(o.actions);
    s.appendChild(bar);
    var list = h('<div class="list-items"></div>');
    s.appendChild(list);

    // SliverAppBar(floating: true, snap: true)
    var lastY = window.scrollY;
    var onScroll = function () {
      if (!document.body.contains(s)) return window.removeEventListener("scroll", onScroll);
      var y = window.scrollY;
      if (y > lastY && y > 60) bar.classList.add("hidden");
      else if (y < lastY) bar.classList.remove("hidden");
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    var searchText = "";
    var timer = null;
    function load() {
      list.innerHTML = itemsLoading();
      Promise.resolve(o.fetch(searchText))
        .then(function (items) {
          list.innerHTML = "";
          if (!items.length) {
            list.innerHTML = '<div class="empty-text">Não há itens a exibir.</div>';
            return;
          }
          items.forEach(function (it, i) {
            list.appendChild(o.itemBuilder(it, i, items));
          });
        })
        .catch(function (err) {
          console.error(err);
          list.innerHTML =
            '<div style="padding:30px 20px;text-align:center">Ocorreu um erro. Tente novamente.</div><div style="margin-top:20px"><button class="btn btn-accent">Tentar novamente</button></div>';
          list.querySelector("button").onclick = load;
        });
    }
    if (search) {
      search.input.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          searchText = search.value.trim();
          load();
        }, 500);
      });
    }
    load();
    return {
      el: s,
      reload: load,
      setSubtitle: function (t) {
        subtitle.textContent = t || "";
        subtitle.classList.toggle("hidden", !t);
      }
    };
  }

  // CellCard
  function cellCard(inner, onPressed, active) {
    var c = h('<div class="cell' + (active ? " active" : "") + (onPressed ? "" : " static") + '"></div>');
    c.innerHTML = inner;
    if (onPressed) c.addEventListener("click", onPressed);
    else c.style.cursor = "default";
    return c;
  }

  function cellHead(title, primary) {
    return '<div class="row"><div class="grow"><div class="cell-title">' + e(title) + '</div></div><div class="cell-primary-title">' + e(primary) + "</div></div>";
  }
  function cellText(t) {
    return '<div class="cell-text">' + e(t) + "</div>";
  }
  function info(title, text) {
    return '<div class="info-title">' + e(title) + '</div><div class="info-text">' + e(text) + "</div>";
  }

  // PaginatedResourcePickerScreen (tela de seleção de produto / lote)
  function resourcePicker(o, onDone) {
    var selected = (o.initialSelection || []).slice();
    var overlay = h('<div class="screen" style="position:fixed;inset:0;z-index:50;overflow:auto;max-width:480px;margin:0 auto"></div>');
    var ls;
    function isSel(it) {
      return selected.some(function (s) {
        return s.id === it.id;
      });
    }
    function finish() {
      overlay.remove();
      onDone(selected);
    }
    ls = listScreen({
      title: o.title,
      displaySearch: true,
      onBack: function () {
        overlay.remove();
      },
      fetch: o.fetch,
      itemBuilder: function (it) {
        var cell = o.itemBuilder(it, isSel(it));
        cell.addEventListener("click", function () {
          if (o.multi) {
            if (isSel(it)) selected = selected.filter(function (s) { return s.id !== it.id; });
            else selected.push(it);
            cell.classList.toggle("active", isSel(it));
            ls.setSubtitle(o.selectionText(selected));
          } else {
            selected = [it];
            finish();
          }
        });
        return cell;
      }
    });
    if (o.multi) ls.setSubtitle(o.selectionText(selected));
    overlay.appendChild(ls.el);
    if (o.multi) {
      var fab = h('<button class="fab" aria-label="Confirmar">' + mi("check") + "</button>");
      fab.onclick = finish;
      overlay.appendChild(fab);
    }
    document.body.appendChild(overlay);
    overlay.scrollTop = 0;
  }

  // SinglePaginatedResourcePickerFormField / MultiPaginatedResourcePickerFormField
  function resourcePickerField(o) {
    var value = o.multi ? (o.initialValue || []).slice() : o.initialValue || null;
    var pb = pickerButton({
      onPressed: function () {
        resourcePicker(
          {
            title: o.screenTitle,
            multi: o.multi,
            fetch: o.fetch,
            itemBuilder: o.itemBuilder,
            selectionText: o.selectionText,
            initialSelection: o.multi ? value : value ? [value] : []
          },
          function (items) {
            value = o.multi ? items : items[0] || null;
            update();
          }
        );
      }
    });
    function isSelected() {
      return o.multi ? value.length > 0 : !!value;
    }
    function update() {
      pb.setText(isSelected() ? o.selectionText(o.multi ? value : value) : o.hint, isSelected());
    }
    update();
    return {
      el: pb.el,
      get value() {
        return value;
      },
      validate: function () {
        var msg = o.validator ? o.validator(isSelected() ? value : null) : null;
        pb.setError(msg);
        return msg === null || msg === undefined;
      }
    };
  }

  // ------------------------------------------------------------------ navegação
  var nav = {
    go: function (path) {
      window.location.hash = "#/" + path.replace(/^\//, "");
    },
    replace: function (path) {
      window.location.replace("#/" + path.replace(/^\//, ""));
    },
    back: function () {
      if (window.history.length > 1) window.history.back();
      else nav.replace("home/");
    }
  };

  var UUID = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
  var routes = [
    ["login/", LoginScreen, false],
    ["home/", HomeScreen],
    ["home/profile/", ProfileScreen],
    ["home/profile/change-password/", PasswordChangeScreen],
    ["home/subscription/", SubscriptionScreen],
    ["home/settings/", SettingsScreen],
    ["home/batches/", BatchListScreen],
    ["home/batches/create/", BatchCreateScreen],
    ["home/batches/" + UUID + "/", BatchDetailScreen],
    ["home/batch-tags/", BatchTagListScreen],
    ["home/batch-tags/create/", BatchTagCreateScreen],
    ["home/batch-tags/" + UUID + "/", BatchTagDetailScreen],
    ["home/batch-tags/" + UUID + "/print/", BatchTagPrintScreen],
    ["home/farm-journals/", FarmJournalListScreen],
    ["home/farm-journals/create-update/", FarmJournalCreateUpdateScreen],
    ["home/farm-journals/" + UUID + "/", FarmJournalDetailScreen],
    ["home/farm-journals/" + UUID + "/edit/", FarmJournalCreateUpdateScreen],
    ["home/farm-journals/" + UUID + "/print/", FarmJournalPrintScreen],
    ["home/farm-journals/" + UUID + "/(fertilizing|pesticide|harvest|post-harvest)-entries/", EntryListScreen],
    ["home/farm-journals/" + UUID + "/(fertilizing|pesticide|harvest|post-harvest)-entries/create-update/", EntryCreateUpdateScreen],
    ["home/farm-journals/(fertilizing|pesticide|harvest|post-harvest)-entries/" + UUID + "/", EntryDetailScreen],
    ["home/farm-journals/(fertilizing|pesticide|harvest|post-harvest)-entries/" + UUID + "/edit/", EntryCreateUpdateScreen]
  ];

  function currentPath() {
    var p = window.location.hash.replace(/^#\/?/, "");
    return p || "";
  }

  function render() {
    var path = currentPath();
    document.querySelectorAll(".dialog-backdrop,.sheet-backdrop,.hud").forEach(function (x) {
      x.remove();
    });
    for (var i = 0; i < routes.length; i++) {
      var m = new RegExp("^" + routes[i][0] + "$").exec(path);
      if (m) {
        var needsAuth = routes[i][2] !== false;
        if (needsAuth && !session.user) {
          nav.replace("login/");
          return;
        }
        if (!needsAuth && session.user && path === "login/") {
          nav.replace("home/");
          return;
        }
        var screen = routes[i][1].apply(null, m.slice(1).concat([path]));
        root.innerHTML = "";
        if (screen) root.appendChild(screen.el || screen);
        window.scrollTo(0, 0);
        return;
      }
    }
    nav.replace(session.user ? "home/" : "login/");
  }

  function loadSession() {
    return api.currentUser("app").then(function (u) {
      if (!u) {
        session.user = session.profile = null;
        return;
      }
      return api.profileForUser(u).then(function (p) {
        return api.isSubscribed(p).then(function (sub) {
          if (!sub) {
            // checkAccess: assinatura inativa encerra a sessão do app
            api.logout("app");
            session.user = session.profile = null;
            return;
          }
          session.user = u;
          session.profile = p;
        });
      });
    });
  }

  // ------------------------------------------------------------------ TELAS
  // auth/screens/login_screen.dart
  function LoginScreen() {
    var s = h(
      '<div class="screen login"><div class="inner">' +
        '<img class="logo" src="../assets/img/logo_white@3x.png" srcset="../assets/img/logo_white.png 1x, ../assets/img/logo_white@2x.png 2x, ../assets/img/logo_white@3x.png 3x" alt="">' +
        '<div class="tagline">Controle e emissão de\netiquetas para a sua produção!</div>' +
        '<div style="height:40px"></div><div class="form-area"></div></div></div>'
    );
    var area = s.querySelector(".form-area");
    var user = extField({ icon: "person", hint: "CPF/CNPJ", mask: "cpfcnpj", validator: getValidator(V.REQUIRED | V.CPF_OR_CNPJ) });
    var pass = extField({ icon: "lock", hint: "Senha", obscure: true, validator: getValidator(V.REQUIRED) });
    function content() {
      area.innerHTML = "";
      area.appendChild(user.el);
      area.appendChild(h('<div style="height:20px"></div>'));
      area.appendChild(pass.el);
      area.appendChild(h('<div style="height:30px"></div>'));
      var b = h('<button class="btn btn-accent">ENTRAR</button>');
      b.onclick = submit;
      area.appendChild(b);
      var l = h('<button class="btn-link white">Esqueci minha senha</button>');
      l.onclick = showPasswordResetDialog;
      area.appendChild(l);
    }
    pass.input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") submit();
    });
    function submit() {
      var ok1 = user.validate(),
        ok2 = pass.validate();
      if (!ok1 || !ok2) return;
      var username = RA.digits(user.value),
        password = pass.input.value;
      area.innerHTML = progressBox();
      api
        .loginApp(username, password)
        .then(function () {
          return loadSession();
        })
        .then(function () {
          content();
          nav.replace("home/");
        })
        .catch(function (err) {
          content();
          showFeedback(
            err && err.authenticationFailed
              ? "Você digitou dados de acesso inválidos ou sua assinatura não está ativa."
              : "Ocorreu um erro de conexão."
          );
        });
    }
    content();
    return s;
  }

  // auth/screens/reset_password_dialog.dart
  function showPasswordResetDialog() {
    var d = openDialog('<div class="simple-dialog"><div class="dialog-title">Recuperar senha</div><div class="rp"></div></div>');
    var rp = d.el.querySelector(".rp");
    function content() {
      rp.innerHTML =
        '<div style="margin:10px 20px 0" class="dialog-text">Digite abaixo seu CPF/CNPJ e enviaremos uma mensagem com instruções para que você recupere sua senha.</div>' +
        '<div class="ff" style="margin:15px 20px 0"></div>' +
        '<div class="dialog-buttons"><button class="btn btn-secondary" data-cancel>CANCELAR</button><button class="btn btn-accent" data-ok>OK</button></div>';
      var f = textField({ hint: "CPF/CNPJ", keyboard: "number", mask: "cpfcnpj", validator: getValidator(V.REQUIRED | V.CPF_OR_CNPJ) });
      rp.querySelector(".ff").appendChild(f.el);
      rp.querySelector("[data-cancel]").onclick = d.close;
      rp.querySelector("[data-ok]").onclick = function () {
        if (!f.validate()) return;
        var username = RA.digits(f.value);
        rp.innerHTML = itemsLoading();
        api
          .resetPassword(username)
          .then(function (r) {
            var text =
              "Foram enviadas instruções para que você recupere sua senha" +
              ".\n\nSe você por acaso não receber o e-mail, " +
              "por favor verifique sua pasta de lixo eletrônico.";
            if (r && r.email_backend === false) {
              text =
                "O envio de e-mail ainda não está ativo nesta versão do Rastrear AgriFamiliar. " +
                "Para recuperar sua senha, entre em contato pelo e-mail " + RA.config.CONTACT_EMAIL + " ou pelo WhatsApp " + RA.config.CONTACT_WHATSAPP + ".";
            }
            rp.innerHTML =
              '<div style="margin:10px 20px 0"><div class="dialog-text"></div><div style="height:20px"></div><button class="btn btn-accent">OK</button></div>';
            rp.querySelector(".dialog-text").textContent = text;
            rp.querySelector("button").onclick = d.close;
          })
          .catch(function (err) {
            content();
            if (err && err.userNotFound) showFeedback("Usuário não cadastrado.");
            else showRequestError();
          });
      };
    }
    content();
  }

  // modules/home/home_screen.dart
  function HomeScreen() {
    var s = h(
      '<div class="screen home">' +
        '<div class="flex1"></div>' +
        '<div style="display:flex;align-items:center"><div style="flex:1" class="hello-wrap"><div class="hello">Olá!</div><div class="hello-sub">O que deseja fazer?</div></div><div class="offline"></div></div>' +
        '<div style="height:20px"></div><div class="flex3"></div>' +
        homeCard("Lotes", "Antes de emitir suas etiquetas, você deve criar seus lotes. Clique aqui para visualizar e criar lotes para a sua produção.", FA.box, "batches") +
        '<div style="height:10px"></div><div class="flex1"></div>' +
        homeCard("Etiquetas", "Clique aqui para visualizar e criar as etiquetas para os seus produtos.", FA.qrcode, "tags") +
        '<div style="height:10px"></div><div class="flex1"></div>' +
        homeCard("Cadernos do campo", "Clique aqui para visualizar e criar os registros da sua produção.", FA.clipboardList, "journals") +
        '<div style="height:30px"></div><div class="flex1"></div><div class="flex3"></div>' +
        '<div class="home-buttons">' +
        squareButton("person", "Meus dados", "profile") +
        squareButton("shopping_cart", "Assinatura", "subscription") +
        squareButton("settings", "Opções", "settings") +
        "</div></div>"
    );
    var go = { batches: "home/batches/", tags: "home/batch-tags/", journals: "home/farm-journals/", profile: "home/profile/", subscription: "home/subscription/", settings: "home/settings/" };
    Array.prototype.forEach.call(s.querySelectorAll("[data-go]"), function (x) {
      x.addEventListener("click", function () {
        nav.go(go[x.getAttribute("data-go")]);
      });
    });
    // Pressionar "Olá!" por 5 segundos reinicia o cache de consultas
    var hello = s.querySelector(".hello-wrap"),
      t = null;
    var start = function () {
      t = setTimeout(function () {
        showFeedback("Cache de consultas reinicializado.");
      }, 5000);
    };
    var stop = function () {
      clearTimeout(t);
    };
    hello.addEventListener("pointerdown", start);
    hello.addEventListener("pointerup", stop);
    hello.addEventListener("pointerleave", stop);
    return s;
  }

  function homeCard(title, text, icon, key) {
    return '<div class="home-card" data-go="' + key + '"><div class="head"><div class="t">' + e(title) + "</div>" + icon + '</div><div class="text">' + e(text) + "</div></div>";
  }

  function squareButton(icon, title, key) {
    return '<div class="square-button" data-go="' + key + '"><div class="sq">' + mi(icon) + '</div><div class="lbl">' + e(title) + "</div></div>";
  }

  // modules/profile/profile_screen.dart
  function ProfileScreen() {
    return futureScreen(
      "Meus dados",
      function () {
        return api.getUser(session.user.id);
      },
      function (body, user) {
        var profileType = user.person_type;
        var name = user.name,
          username = user.cpf_cnpj;
        var form = new Form();
        var typeField = form.add(
          pickerField({
            hint: "Tipo",
            items: ["PF", "PJ"],
            initialValue: profileType,
            validator: requiredItem,
            itemBuilder: function (t) {
              return '<span style="color:var(--gray);font-size:15px">' + (t === "PF" ? "Pessoa física" : "Pessoa jurídica") + "</span>";
            },
            selectionText: function (t) {
              return t === "PF" ? "Pessoa Física" : "Pessoa Jurídica";
            },
            onChange: function (t) {
              profileType = t;
              nameField.input.placeholder = profileType === "PJ" ? "Razão social" : "Nome";
              userField.input.placeholder = profileType === "PJ" ? "CNPJ" : "CPF";
            }
          })
        );
        var nameField = form.add(textField({ value: name, hint: profileType === "PJ" ? "Razão social" : "Nome", validator: getValidator(V.REQUIRED) }));
        var userField = form.add(
          textField({
            value: RA.maskCpfCnpj(username),
            hint: profileType === "PJ" ? "CNPJ" : "CPF",
            mask: "cpfcnpj",
            validator: function (v) {
              return profileType === "PJ" ? getValidator(V.REQUIRED | V.CNPJ)(v) : getValidator(V.REQUIRED | V.CPF)(v);
            }
          })
        );
        var emailField = form.add(textField({ value: user.email, hint: "E-mail", validator: getValidator(V.REQUIRED | V.EMAIL) }));
        body.appendChild(typeField.el);
        body.appendChild(h('<div style="height:10px"></div>'));
        body.appendChild(nameField.el);
        body.appendChild(h('<div style="height:10px"></div>'));
        body.appendChild(userField.el);
        body.appendChild(h('<div style="height:10px"></div>'));
        body.appendChild(emailField.el);
        body.appendChild(h('<div style="height:20px"></div>'));
        var save = h('<button class="btn btn-accent">SALVAR</button>');
        body.appendChild(save);
        body.appendChild(h('<div style="height:20px"></div>'));
        var change = h('<button class="btn btn-border">ALTERAR SENHA</button>');
        body.appendChild(change);
        change.onclick = function () {
          nav.go("home/profile/change-password/");
        };
        save.onclick = function () {
          if (!form.validate()) return;
          // No original o e-mail não é salvo pela tela do app (onSaved vazio).
          var updated = { person_type: profileType, name: nameField.value, cpf_cnpj: RA.digits(userField.value), email: user.email };
          withProgress(api.updateUserProfile(user.id, updated))
            .then(function () {
              nav.back();
            })
            .catch(function (err) {
              showRequestError(err);
            });
        };
      }
    );
  }

  // modules/profile/password_change_screen.dart
  function PasswordChangeScreen() {
    var sc = basicScreen("Alterar senha");
    var form = new Form();
    var changed = false;
    var current = form.add(textField({ obscure: true, hint: "Senha atual", validator: getValidator(V.REQUIRED) }));
    var newP = form.add(
      textField({
        obscure: true,
        hint: "Nova senha",
        validator: function (v) {
          return v !== null && v === "" ? "" : null;
        }
      })
    );
    var rep = form.add(
      textField({
        obscure: true,
        hint: "Repetir nova senha",
        validator: function (v) {
          return v !== newP.value ? "" : null;
        }
      })
    );
    var save = h('<button class="btn btn-accent" disabled>SALVAR</button>');
    function onChanged() {
      changed = true;
      save.disabled = !form.validate();
    }
    [current, newP, rep].forEach(function (f) {
      f.input.addEventListener("input", onChanged);
    });
    var forgot = h('<button class="btn-link">Esqueci minha senha</button>');
    forgot.onclick = showPasswordResetDialog;
    sc.body.appendChild(current.el);
    sc.body.appendChild(forgot);
    sc.body.appendChild(h('<div style="height:10px"></div>'));
    sc.body.appendChild(newP.el);
    sc.body.appendChild(rep.el);
    sc.body.appendChild(h('<div style="height:20px"></div>'));
    sc.body.appendChild(save);
    save.onclick = function () {
      if (!form.validate()) return;
      var content = Array.prototype.slice.call(sc.body.children);
      content.forEach(function (c) {
        c.classList.add("hidden");
      });
      var loading = h(itemsLoading());
      sc.body.appendChild(loading);
      api
        .getUser(session.user.id)
        .then(function (u) {
          return api.changePassword(u, current.value, newP.value);
        })
        .then(function () {
          nav.back();
        })
        .catch(function (err) {
          loading.remove();
          content.forEach(function (c) {
            c.classList.remove("hidden");
          });
          showRequestError(err);
        });
    };
    return sc;
  }

  // modules/subscription/subscription_screen.dart
  function SubscriptionScreen() {
    return futureScreen(
      "Assinatura",
      function () {
        return api.subscriptionForProfile(session.profile).then(function (sub) {
          if (session.profile.is_demo) {
            return {
              planName: "Plano demonstrativo",
              dateCreated: "2021-01-01",
              status: "Pagamento em dia",
              paymentMethod: "Boleto Bancário",
              nextPaymentDate: "3000-01-01",
              info: "Nenhuma alteração a ser feita."
            };
          }
          return {
            planName: api.planName(sub.plan),
            dateCreated: sub.date_created,
            status: api.subStatusDisplay(sub),
            paymentMethod: api.paymentMethodName(sub.payment_method),
            nextPaymentDate: sub.current_period_end,
            info:
              "Para realizar alterações na sua assinatura, como mudança de plano ou forma de pagamento, acesse a sua conta do Rastrear AgriFamiliar em um navegador web."
          };
        });
      },
      function (body, s) {
        body.innerHTML =
          info("Plano", s.planName) +
          '<div style="height:25px"></div>' +
          info("Contratação", RA.fmtDate(s.dateCreated)) +
          '<div style="height:25px"></div>' +
          info("Situação", s.status) +
          '<div style="height:25px"></div>' +
          info("Forma de pagamento", s.paymentMethod) +
          '<div style="height:25px"></div>' +
          info("Próxima cobrança", RA.fmtDate(s.nextPaymentDate)) +
          '<div style="height:25px"></div>' +
          info("Alterações", s.info);
      }
    );
  }

  // modules/settings/settings_screen.dart
  function SettingsScreen() {
    var sc = basicScreen("Opções");
    var c = RA.config;
    sc.body.innerHTML =
      '<div class="info-title">Fale conosco!</div>' +
      '<div class="info-text">Em caso de dúvidas sobre o uso do aplicativo Rastrear AgriFamiliar, você pode entrar em contato conosco pelos canais abaixo:</div>' +
      '<div style="height:30px"></div>' +
      '<div class="contact" data-email><div class="t">E-mail</div><div class="v">' + e(c.CONTACT_EMAIL) + "</div></div>" +
      '<div style="height:20px"></div>' +
      '<div class="contact" data-whats><div class="t">WhatsApp</div><div class="v">' + e(c.CONTACT_WHATSAPP) + "</div></div>" +
      '<div style="height:30px"></div><button class="btn btn-accent" data-logout>DESCONECTAR DO APLICATIVO</button>' +
      '<div style="height:30px"></div><div class="version">Versão: ' + e(c.APP_VERSION) + "</div>";
    sc.body.querySelector("[data-email]").onclick = function () {
      window.location.href = "mailto:" + c.CONTACT_EMAIL;
    };
    sc.body.querySelector("[data-whats]").onclick = function () {
      window.open("https://wa.me/55" + RA.digits(c.CONTACT_WHATSAPP), "_blank");
    };
    sc.body.querySelector("[data-logout]").onclick = function () {
      confirmDialog(
        "Sair",
        "Você tem certeza que deseja desconectar do aplicativo?\nVocê precisará fazer login novamente para voltar a ter acesso aos seus dados.",
        function (d) {
          d.close();
          withProgress(api.logout("app")).then(function () {
            session.user = session.profile = null;
            nav.replace("login/");
          });
        },
        { confirmText: "SAIR" }
      );
    };
    return sc;
  }

  // ------------------------------------------------------------------ Lotes
  function batchDescription(b) {
    return (b.product ? b.product.name : "") + " (" + (b.unit ? b.unit.symbol : "") + ")";
  }

  // modules/batches/batch_cell.dart
  function batchCell(b, onPressed, active) {
    return cellCard(
      cellHead(batchDescription(b), b.number) + cellText(b.farm ? b.farm.name : "") + cellText("Colheita em " + RA.fmtDate(b.harvest_date)),
      onPressed,
      active
    );
  }

  // modules/batches/product_cell.dart
  function productCell(p, active) {
    return cellCard('<div class="cell-title">' + e(p.name) + "</div>" + cellText(p.variety), null, active);
  }

  // modules/batches/batch_list_screen.dart
  function BatchListScreen() {
    return listScreen({
      title: "Lotes",
      displaySearch: false,
      buttonText: "ADICIONAR LOTE",
      onPressed: function () {
        nav.go("home/batches/create/");
      },
      fetch: function () {
        return api.batchesForProfile(session.profile.id);
      },
      itemBuilder: function (b) {
        return batchCell(b, function () {
          nav.go("home/batches/" + b.id + "/");
        });
      }
    }).el;
  }

  // modules/batches/batch_detail_screen.dart
  function BatchDetailScreen(id) {
    var sc = basicScreen("Lote");
    sc.body.innerHTML = itemsLoading();
    api.batchesForProfile(session.profile.id).then(function (list) {
      var b = list.filter(function (x) {
        return x.id === id;
      })[0];
      if (!b) {
        sc.body.innerHTML = '<div class="empty-text">Não há itens a exibir.</div>';
        return;
      }
      var certs = b.certificates.length
        ? b.certificates
            .map(function (c) {
              return '<div class="info-text">' + e(certDescription(c)) + "</div>";
            })
            .join("")
        : '<div class="info-text">-</div>';
      var html =
        cellHead(batchDescription(b), b.number) +
        cellText(b.farm ? b.farm.name : "") +
        cellText("Colheita em " + RA.fmtDate(b.harvest_date)) +
        '<div style="height:25px"></div>' +
        info("Unidade", b.unit ? b.unit.name + " (" + b.unit.symbol + ")" : "") +
        '<div style="height:25px"></div>' +
        info("Responsável técnico", b.technical_manager ? b.technical_manager.name : "-") +
        '<div style="height:25px"></div><div class="info-title">Certificados</div>' +
        certs;
      if (b.image) {
        html += '<div style="height:25px"></div><div class="info-title">Imagem do lote</div><img class="batch-image" src="' + e(b.image) + '">';
      }
      sc.body.innerHTML = "";
      sc.body.appendChild(cellCard(html, null));
    });
    return sc;
  }

  // models/certificate.dart description
  function certDescription(c) {
    var t = "";
    if (c.certifier) t += c.certifier + " ";
    t += c.certificate_type ? c.certificate_type.name : "";
    if (c.number) t += " " + c.number;
    return t;
  }

  // modules/batches/batch_create_screen.dart
  function BatchCreateScreen() {
    var sc = basicScreen("Adicionar lote");
    var pid = session.profile.id;
    var form = new Form();
    var image = null;
    var farm = form.add(
      pickerField({
        hint: "Propriedade",
        validator: requiredItem,
        itemsLoader: function () {
          return api.farmsForProfile(pid);
        },
        itemBuilder: function (f) {
          return '<span style="color:var(--gray);font-size:15px">' + e(f.name) + "</span>";
        },
        selectionText: function (f) {
          return f.name;
        }
      })
    );
    var number = form.add(textField({ hint: "Número", validator: getValidator(V.REQUIRED) }));
    var harvest = form.add(dateField({ hint: "Data da colheita", validator: requiredItem }));
    var product = form.add(
      resourcePickerField({
        hint: "Produto",
        screenTitle: "Selecionar produto",
        validator: requiredItem,
        fetch: function (search) {
          return api.products().then(function (l) {
            return l.filter(function (p) {
              return RA.matchSearch(search, [p.name, p.variety]);
            });
          });
        },
        itemBuilder: function (p, sel) {
          return productCell(p, sel);
        },
        selectionText: function (p) {
          return p.name;
        }
      })
    );
    var unit = form.add(
      pickerField({
        hint: "Unidade",
        validator: requiredItem,
        itemsLoader: function () {
          return api.units();
        },
        itemBuilder: function (u) {
          return '<span style="color:var(--gray);font-size:15px">' + e(u.name) + "</span>";
        },
        selectionText: function (u) {
          return u.name;
        }
      })
    );
    var tm = form.add(
      pickerField({
        hint: "Responsável técnico",
        emptyText: "Nenhum responsável técnico cadastrado.",
        itemsLoader: function () {
          return api.technicalManagersForProfile(pid);
        },
        itemBuilder: function (t) {
          return '<span style="color:var(--gray);font-size:15px">' + e(t.name) + "</span>";
        },
        selectionText: function (t) {
          return t.name;
        }
      })
    );
    var certs = form.add(
      pickerField({
        hint: "Certificados",
        multi: true,
        max: 3,
        emptyText: "Nenhum certificado válido disponível.",
        itemsLoader: function () {
          return api.validCertificatesForProfile(pid);
        },
        itemBuilder: function (c, checked) {
          var alert = c.certificate_type && c.certificate_type.alert_message;
          if (!checked || !alert) return '<span style="color:var(--medium-gray);font-size:15px">' + e(certDescription(c)) + "</span>";
          return (
            '<div style="color:var(--heavy-gray);font-size:15px">' + e(certDescription(c)) + '</div><div style="height:4px"></div><div style="color:var(--gray);font-size:14px">' + e(alert) + "</div>"
          );
        },
        selectionText: function (items) {
          return items.length > 1 ? items.length + " certificados" : "1 certificado";
        }
      })
    );
    var img = imagePickerField("Imagem do lote...", function (d) {
      image = d;
    });
    var fields = [farm, number, harvest, product, unit, tm, certs, img];
    var content = h("<div></div>");
    fields.forEach(function (f, i) {
      if (i) content.appendChild(h('<div style="height:10px"></div>'));
      content.appendChild(f.el);
    });
    content.appendChild(h('<div style="height:20px"></div>'));
    var save = h('<button class="btn btn-accent">SALVAR</button>');
    content.appendChild(save);
    sc.body.appendChild(content);
    save.onclick = function () {
      if (!form.validate()) return;
      if (!farm.value || !String(number.value).trim() || !harvest.value || !product.value || !unit.value) return;
      content.classList.add("hidden");
      var loading = h(itemsLoading());
      sc.body.appendChild(loading);
      var id = RA.uuid();
      api
        .saveBatch({
          id: id,
          farm_id: farm.value.id,
          number: number.value,
          harvest_date: harvest.value,
          product_id: product.value.id,
          unit_id: unit.value.id,
          technical_manager_id: tm.value ? tm.value.id : null,
          certificate_ids: (certs.value || []).map(function (c) {
            return c.id;
          }),
          image: image
        })
        .then(function () {
          nav.replace("home/batches/" + id + "/");
        })
        .catch(function (err) {
          loading.remove();
          content.classList.remove("hidden");
          showRequestError(err);
        });
    };
    return sc;
  }

  // ------------------------------------------------------------------ Etiquetas
  function tagQuantity(t) {
    return RA.fmtDecimal(t.amount) + " " + (t.batch && t.batch.unit ? t.batch.unit.symbol : "");
  }

  // modules/batch_tags/batch_tag_cell.dart
  function batchTagCell(t, onPressed) {
    return cellCard(
      cellHead(t.batch.product ? t.batch.product.name : "", tagQuantity(t)) +
        '<div class="row" style="align-items:center"><div class="grow">' +
        cellText(t.batch.farm ? t.batch.farm.name : "") +
        cellText("Emitida em " + RA.fmtDate(t.date)) +
        '</div><div style="width:25px;height:25px;fill:var(--primary);color:var(--primary)">' +
        FA.qrcode.replace('class="fa-svg"', 'class="fa-svg" width="25" height="25"') +
        "</div></div>",
      onPressed
    );
  }

  // modules/batch_tags/batch_tag_list_screen.dart
  function BatchTagListScreen() {
    return listScreen({
      title: "Etiquetas",
      buttonText: "ADICIONAR ETIQUETA",
      displaySearch: false,
      onPressed: function () {
        nav.go("home/batch-tags/create/");
      },
      fetch: function () {
        return api.batchTagsForProfile(session.profile.id);
      },
      itemBuilder: function (t) {
        return batchTagCell(t, function () {
          nav.go("home/batch-tags/" + t.id + "/");
        });
      }
    }).el;
  }

  // modules/batch_tags/batch_tag_detail_screen.dart
  function BatchTagDetailScreen(id) {
    var sc = basicScreen("Etiqueta");
    sc.body.innerHTML = itemsLoading();
    api.getBatchTag(id).then(function (t) {
      if (!t || !t.batch) {
        sc.body.innerHTML = '<div class="empty-text">Não há itens a exibir.</div>';
        return;
      }
      var url = RA.batchTagURL(t.id);
      var html =
        cellHead(t.batch.product ? t.batch.product.name : "", tagQuantity(t)) +
        cellText(t.batch.farm ? t.batch.farm.name : "") +
        cellText("Emitida em " + RA.fmtDate(t.date)) +
        '<div style="height:25px"></div>' +
        info("Lote", t.batch.number) +
        '<div style="height:25px"></div>' +
        info("Código", t.id) +
        '<div style="height:25px"></div><div class="qr-holder">' + RA.qrSVG(url, "L", 0) + "</div>" +
        '<div style="height:20px"></div><button class="btn btn-accent" data-view>VISUALIZAR ETIQUETA</button><div style="height:10px"></div><button class="btn btn-border" data-print>IMPRIMIR ETIQUETA</button>';
      sc.body.innerHTML = "";
      var card = cellCard(html, null);
      sc.body.appendChild(card);
      card.querySelector("[data-view]").onclick = function () {
        window.open(RA.url("etiqueta/?id=" + t.id), "_blank");
      };
      card.querySelector("[data-print]").onclick = function () {
        nav.go("home/batch-tags/" + t.id + "/print/");
      };
    });
    return sc;
  }

  // modules/batch_tags/batch_tag_print_screen.dart
  function BatchTagPrintScreen(id) {
    return webviewScreen("Imprimir etiqueta", RA.url("etiqueta/imprimir/?id=" + id));
  }

  function webviewScreen(title, url) {
    var s = h('<div class="screen"></div>');
    s.appendChild(appBar(title));
    var wv = h('<div class="webview"><div class="linear-progress"></div><iframe></iframe></div>');
    var frame = wv.querySelector("iframe");
    frame.addEventListener("load", function () {
      var p = wv.querySelector(".linear-progress");
      if (p) p.remove();
    });
    frame.src = url;
    s.appendChild(wv);
    return s;
  }

  // modules/batch_tags/batch_tag_create_screen.dart
  function BatchTagCreateScreen() {
    var sc = basicScreen("Adicionar etiqueta");
    var form = new Form();
    var batch = form.add(
      resourcePickerField({
        hint: "Lote",
        screenTitle: "Selecionar lote",
        validator: requiredItem,
        fetch: function () {
          return api.batchesForProfile(session.profile.id);
        },
        itemBuilder: function (b) {
          return batchCell(b, function () {});
        },
        selectionText: function (b) {
          return batchDescription(b);
        }
      })
    );
    var amount = form.add(textField({ hint: "Quantidade", keyboard: "decimal", validator: getValidator(V.REQUIRED | V.DECIMAL) }));
    var content = h("<div></div>");
    content.appendChild(batch.el);
    content.appendChild(h('<div style="height:10px"></div>'));
    content.appendChild(amount.el);
    content.appendChild(h('<div style="height:20px"></div>'));
    var save = h('<button class="btn btn-accent">SALVAR</button>');
    content.appendChild(save);
    sc.body.appendChild(content);
    save.onclick = function () {
      if (!form.validate()) return;
      var value = RA.parseNumber(amount.value);
      if (!batch.value || value === null) return;
      content.classList.add("hidden");
      var loading = h(itemsLoading());
      sc.body.appendChild(loading);
      var id = RA.uuid();
      api
        .createBatchTag({ id: id, batch_id: batch.value.id, amount: value })
        .then(function () {
          nav.replace("home/batch-tags/" + id + "/");
        })
        .catch(function (err) {
          loading.remove();
          content.classList.remove("hidden");
          showRequestError(err);
        });
    };
    return sc;
  }

  // ------------------------------------------------------------------ Cadernos do campo
  function hectares(j) {
    return RA.fmtDecimal(j.total_hectares) + " ha";
  }

  // modules/farm_journals/farm_journal_cell.dart
  function farmJournalCell(j, onPressed) {
    return cellCard(cellHead(j.field_identification, hectares(j)) + cellText(j.farm ? j.farm.name : "") + cellText("Plantio em " + RA.fmtDate(j.plantation_date)), onPressed);
  }

  // modules/farm_journals/farm_journal_list_screen.dart
  function FarmJournalListScreen() {
    return listScreen({
      title: "Cadernos do campo",
      displaySearch: false,
      buttonText: "ADICIONAR CADERNO",
      onPressed: function () {
        nav.go("home/farm-journals/create-update/");
      },
      fetch: function () {
        return api.farmJournalsForProfile(session.profile.id);
      },
      itemBuilder: function (j) {
        return farmJournalCell(j, function () {
          nav.go("home/farm-journals/" + j.id + "/");
        });
      }
    }).el;
  }

  // modules/farm_journals/farm_journal_detail_screen.dart
  function FarmJournalDetailScreen(id) {
    var sc = basicScreen("Caderno");
    sc.body.innerHTML = itemsLoading();
    api.getFarmJournal(id).then(function (j) {
      if (!j) {
        sc.body.innerHTML = '<div class="empty-text">Não há itens a exibir.</div>';
        return;
      }
      var html =
        cellHead(j.field_identification, hectares(j)) +
        cellText(j.farm ? j.farm.name : "") +
        cellText("Plantio em " + RA.fmtDate(j.plantation_date)) +
        '<div style="height:25px"></div><div style="height:10px"></div>' +
        '<button class="btn btn-border" data-print>IMPRIMIR</button><div style="height:10px"></div>' +
        '<button class="btn btn-accent" data-edit>EDITAR</button><div style="height:10px"></div>' +
        '<button class="btn btn-border" data-delete>EXCLUIR</button><div style="height:30px"></div>' +
        '<button class="btn btn-primary" data-entries="fertilizing">REGISTROS DE ADUBAÇÃO</button><div style="height:10px"></div>' +
        '<button class="btn btn-primary" data-entries="pesticide">REGISTROS DE DEFENSIVOS</button><div style="height:10px"></div>' +
        '<button class="btn btn-primary" data-entries="harvest">REGISTROS DE COLHEITA</button><div style="height:10px"></div>' +
        '<button class="btn btn-primary" data-entries="post-harvest">REGISTROS DE PÓS-COLHEITA</button>';
      sc.body.innerHTML = "";
      var card = cellCard(html, null);
      sc.body.appendChild(card);
      card.querySelector("[data-print]").onclick = function () {
        nav.go("home/farm-journals/" + j.id + "/print/");
      };
      card.querySelector("[data-edit]").onclick = function () {
        nav.go("home/farm-journals/" + j.id + "/edit/");
      };
      card.querySelector("[data-delete]").onclick = function () {
        confirmDialog(
          "Excluir",
          "Você tem certeza que deseja excluir este caderno do campo?",
          function () {
            withProgress(api.deleteFarmJournal(j.id))
              .then(function () {
                nav.back();
              })
              .catch(function () {
                showFeedback("Ocorreu um erro.");
              });
          },
          { dismissOnConfirmation: true }
        );
      };
      Array.prototype.forEach.call(card.querySelectorAll("[data-entries]"), function (b) {
        b.onclick = function () {
          nav.go("home/farm-journals/" + j.id + "/" + b.getAttribute("data-entries") + "-entries/");
        };
      });
    });
    return sc;
  }

  // modules/farm_journals/farm_journal_print_screen.dart
  function FarmJournalPrintScreen(id) {
    return webviewScreen("Imprimir caderno", RA.url("cadernos/imprimir/?id=" + id));
  }

  // modules/farm_journals/farm_journal_create_update_screen.dart (+ create_steps 1 a 4)
  function FarmJournalCreateUpdateScreen(editId) {
    if (editId && !RA.UUID_RE.test(editId)) editId = null;
    var sc = basicScreen("Adicionar caderno");
    var pid = session.profile.id;
    var item = null;
    var stepsData = [null, null, null, null];
    var current = 0;
    var holder = h("<div></div>");
    var dots = h('<div class="dots"></div>');
    var buttons = h("<div></div>");
    sc.body.appendChild(holder);
    sc.body.appendChild(dots);
    sc.body.appendChild(h('<div style="height:20px"></div>'));
    sc.body.appendChild(buttons);
    var stepState = null;

    function step1(data) {
      var form = new Form();
      var root1 = h('<div><div class="step-title">Informações do talhão</div></div>');
      var fi = form.add(textField({ hint: "Número/identificação do talhão", value: data && data.field_identification, validator: getValidator(V.REQUIRED) }));
      var farm = form.add(
        pickerField({
          hint: "Propriedade",
          initialValue: data ? data.farm : undefined,
          emptyText: "Nenhuma propriedade cadastrada.",
          validator: requiredItem,
          itemsLoader: function () {
            return api.farmsForProfile(pid);
          },
          itemBuilder: function (f) {
            return '<span style="color:var(--gray);font-size:15px">' + e(f.name) + "</span>";
          },
          selectionText: function (f) {
            return f.name;
          }
        })
      );
      var area = form.add(
        textField({
          hint: "Área em hectares",
          value: data && data.total_hectares !== null && data.total_hectares !== undefined ? RA.fmtDecimal(data.total_hectares) : "",
          keyboard: "decimal",
          validator: getValidator(V.REQUIRED | V.DECIMAL)
        })
      );
      var products = form.add(
        resourcePickerField({
          hint: "Produtos",
          multi: true,
          initialValue: data ? data.products : [],
          screenTitle: "Selecionar produto",
          validator: requiredItem,
          fetch: function (search) {
            return api.products().then(function (l) {
              return l.filter(function (p) {
                return RA.matchSearch(search, [p.name, p.variety]);
              });
            });
          },
          itemBuilder: function (p, sel) {
            return productCell(p, sel);
          },
          selectionText: function (items) {
            return items.length === 1 ? "1 produto selecionado" : items.length + " produtos selecionados";
          }
        })
      );
      var last = form.add(textField({ hint: "Cultura anterior", value: data && data.last_cultural_method, capitalization: "sentences" }));
      var plant = form.add(dateField({ hint: "Data de plantio", initialValue: data && data.plantation_date, validator: requiredItem }));
      var harv = form.add(dateField({ hint: "Data provável de colheita", initialValue: data && data.harvest_date }));
      [fi, farm, area, products, last, plant, harv].forEach(function (f, i) {
        if (i) root1.appendChild(h('<div style="height:10px"></div>'));
        root1.appendChild(f.el);
      });
      return {
        el: root1,
        validate: function () {
          return form.validate();
        },
        data: function () {
          return {
            field_identification: fi.value,
            farm: farm.value,
            total_hectares: RA.parseNumber(area.value),
            products: products.value,
            last_cultural_method: last.value || null,
            plantation_date: plant.value,
            harvest_date: harv.value || null
          };
        }
      };
    }

    function step2(data) {
      data = data || {};
      var root2 = h('<div><div class="step-title">Preparo do solo - Operações realizadas</div></div>');
      var extra;
      var onCb = function () {
        extra.value = "";
        if (document.activeElement) document.activeElement.blur();
      };
      var g = checkboxGroup([
        { key: "has_subsolagem", text: "Subsolagem", value: data.has_subsolagem, onChange: onCb },
        { key: "has_aracao", text: "Aração", value: data.has_aracao, onChange: onCb },
        { key: "has_enxada_rotativa", text: "Enxada rotativa", value: data.has_enxada_rotativa, onChange: onCb },
        { key: "has_gradagem_leve", text: "Gradagem com grade leve", value: data.has_gradagem_leve, onChange: onCb },
        { key: "has_gradagem_pesada", text: "Gradagem com grade pesada", value: data.has_gradagem_pesada, onChange: onCb },
        { key: "has_gradagem_niveladora", text: "Gradagem com grade niveladora", value: data.has_gradagem_niveladora, onChange: onCb }
      ]);
      extra = textField({
        hint: "Outros",
        value: data.extra_soil_preparation_operation || "",
        capitalization: "sentences",
        onInput: function () {
          if (extra.value) {
            ["has_subsolagem", "has_aracao", "has_enxada_rotativa", "has_gradagem_leve", "has_gradagem_pesada", "has_gradagem_niveladora"].forEach(function (k) {
              g[k].value = false;
            });
          }
        }
      });
      root2.appendChild(g.el);
      root2.appendChild(h('<div style="height:10px"></div>'));
      root2.appendChild(extra.el);
      root2.appendChild(h('<div style="height:10px"></div>'));
      return {
        el: root2,
        validate: function () {
          return true;
        },
        data: function () {
          var d = { extra_soil_preparation_operation: extra.value || null };
          ["has_subsolagem", "has_aracao", "has_enxada_rotativa", "has_gradagem_leve", "has_gradagem_pesada", "has_gradagem_niveladora"].forEach(function (k) {
            d[k] = g[k].value;
          });
          return d;
        }
      };
    }

    function step3(data) {
      data = data || {};
      var root3 = h('<div><div class="step-title">Preparo do solo - Práticas conservacionistas</div></div>');
      var extra;
      var group2 = ["has_plantio_nivel", "has_terracos", "has_adubacao_verde", "has_rotacao_culturas", "has_plantio_direto"];
      var g = checkboxGroup([
        {
          key: "is_practice_not_required",
          text: "Não foram aplicadas",
          value: data.is_practice_not_required,
          onChange: function () {
            extra.value = "";
            group2.forEach(function (k) {
              g[k].value = false;
            });
            if (document.activeElement) document.activeElement.blur();
          }
        },
        { key: "has_plantio_nivel", text: "Plantio em nível", value: data.has_plantio_nivel, onChange: g2 },
        { key: "has_terracos", text: "Terraços", value: data.has_terracos, onChange: g2 },
        { key: "has_adubacao_verde", text: "Adubação verde", value: data.has_adubacao_verde, onChange: g2 },
        { key: "has_rotacao_culturas", text: "Rotação de culturas", value: data.has_rotacao_culturas, onChange: g2 },
        { key: "has_plantio_direto", text: "Plantio direto", value: data.has_plantio_direto, onChange: g2 }
      ]);
      function g2() {
        g.is_practice_not_required.value = false;
        if (document.activeElement) document.activeElement.blur();
      }
      extra = textField({
        hint: "Outros",
        value: data.extra_soil_preparation_practice || "",
        capitalization: "sentences",
        onInput: function () {
          if (extra.value) g.is_practice_not_required.value = false;
        }
      });
      root3.appendChild(g.el);
      root3.appendChild(h('<div style="height:10px"></div>'));
      root3.appendChild(extra.el);
      root3.appendChild(h('<div style="height:10px"></div>'));
      return {
        el: root3,
        validate: function () {
          return true;
        },
        data: function () {
          var d = { extra_soil_preparation_practice: extra.value || null, is_practice_not_required: g.is_practice_not_required.value };
          group2.forEach(function (k) {
            d[k] = g[k].value;
          });
          return d;
        }
      };
    }

    function step4(data) {
      data = data || {};
      var root4 = h('<div><div class="step-title">Sementes e mudas</div></div>');
      var terceiros;
      var g1 = checkboxGroup([
        {
          key: "has_origem_propria",
          text: "Origem própria",
          value: data.has_origem_propria,
          onChange: function () {
            terceiros.value = "";
          }
        }
      ]);
      terceiros = textField({
        hint: "Origem de terceiros",
        value: data.origem_terceiros || "",
        capitalization: "sentences",
        onInput: function () {
          if (terceiros.value) g1.has_origem_propria.value = false;
        }
      });
      var g2 = checkboxGroup([{ key: "has_tratamento_termico", text: "Viveiro com tratamento térmico", value: data.has_tratamento_termico }]);
      var irr = textField({ hint: "Sistema de irrigação", value: data.irrigation_method || "", capitalization: "sentences" });
      var water = textField({ hint: "Origem da água", value: data.water_source || "", capitalization: "sentences" });
      root4.appendChild(g1.el);
      root4.appendChild(h('<div style="height:10px"></div>'));
      root4.appendChild(terceiros.el);
      root4.appendChild(h('<div style="height:10px"></div>'));
      root4.appendChild(g2.el);
      root4.appendChild(h('<div style="height:30px"></div>'));
      root4.appendChild(h('<div class="step-title">Irrigação</div>'));
      root4.appendChild(irr.el);
      root4.appendChild(water.el);
      return {
        el: root4,
        validate: function () {
          return true;
        },
        data: function () {
          return {
            has_origem_propria: g1.has_origem_propria.value,
            origem_terceiros: terceiros.value || null,
            has_tratamento_termico: g2.has_tratamento_termico.value,
            irrigation_method: irr.value || null,
            water_source: water.value || null
          };
        }
      };
    }

    var builders = [step1, step2, step3, step4];

    function draw() {
      holder.innerHTML = "";
      stepState = builders[current](stepsData[current]);
      holder.appendChild(stepState.el);
      dots.innerHTML = [0, 1, 2, 3]
        .map(function (i) {
          return '<div class="dot-wrap"><div class="dot' + (i === current ? " on" : "") + '"></div></div>';
        })
        .join("");
      buttons.innerHTML = "";
      var cont = h('<button class="btn btn-accent"></button>');
      cont.textContent = current < 3 ? "CONTINUAR" : "SALVAR";
      cont.onclick = onContinue;
      buttons.appendChild(cont);
      if (current > 0) {
        var prev = h('<div style="padding-top:10px"><button class="btn btn-secondary">ANTERIOR</button></div>');
        prev.querySelector("button").onclick = function () {
          current -= 1;
          draw();
          window.scrollTo({ top: 0, behavior: "smooth" });
        };
        buttons.appendChild(prev);
      }
    }

    function onContinue() {
      if (!stepState.validate()) return;
      window.scrollTo({ top: 0, behavior: "smooth" });
      stepsData[current] = stepState.data();
      if (current < 3) {
        current += 1;
        draw();
      } else {
        onSave();
      }
    }

    function onSave() {
      var d1 = stepsData[0],
        d2 = stepsData[1],
        d3 = stepsData[2],
        d4 = stepsData[3];
      var id = item ? item.id : RA.uuid();
      var payload = Object.assign({ id: id }, d2, d3, d4, {
        field_identification: d1.field_identification,
        farm_id: d1.farm.id,
        total_hectares: d1.total_hectares,
        product_ids: d1.products.map(function (p) {
          return p.id;
        }),
        last_cultural_method: d1.last_cultural_method,
        plantation_date: d1.plantation_date,
        harvest_date: d1.harvest_date,
        creation_date: item ? item.creation_date : RA.today()
      });
      var isUpdating = !!item;
      withProgress(api.saveFarmJournal(payload, item))
        .then(function () {
          if (isUpdating) nav.back();
          else nav.replace("home/farm-journals/" + id + "/");
        })
        .catch(function () {
          showFeedback("Ocorreu um erro.");
        });
    }

    if (editId) {
      holder.innerHTML = itemsLoading();
      api.getFarmJournal(editId).then(function (j) {
        item = j;
        var base = RA.clone(j);
        stepsData = [
          {
            field_identification: j.field_identification,
            farm: j.farm,
            total_hectares: j.total_hectares,
            products: j.products,
            last_cultural_method: j.last_cultural_method,
            plantation_date: j.plantation_date,
            harvest_date: j.harvest_date
          },
          base,
          base,
          base
        ];
        draw();
      });
    } else {
      draw();
    }
    return sc;
  }

  // ------------------------------------------------------------------ Registros do caderno
  var ENTRY_TYPES = {
    fertilizing: {
      api: "fertilizing",
      listTitle: "Adubação",
      detailTitle: "Registro de adubação",
      formTitle: "Registrar adubação",
      cell: function (x) {
        return cellHead(x.formula_name, RA.fmtDate(x.application_date)) + cellText(RA.fmtDecimal(x.dose) + " " + api.unitDescription(x.unity)) + cellText(x.application_method);
      },
      detail: function (x) {
        return (
          ENTRY_TYPES.fertilizing.cell(x) +
          '<div style="height:25px"></div>' +
          info("Responsável pela aplicação", x.application_responsible) +
          '<div style="height:25px"></div>' +
          info("Observação", x.note ? x.note : " - ") +
          '<div style="height:20px"></div>'
        );
      },
      fields: function (x) {
        x = x || {};
        return [
          ["date", "application_date", "Data da aplicação", x.application_date],
          ["text", "formula_name", "Nome do produto/formulário", x.formula_name, V.REQUIRED, "sentences"],
          ["text", "dose", "Dose", x.dose !== undefined && x.dose !== null ? RA.fmtDecimal(x.dose) : "", V.REQUIRED | V.DECIMAL, null, "decimal"],
          ["unit", "unity", "Unidade", x.unity],
          ["text", "application_method", "Forma de aplicação", x.application_method, V.REQUIRED, "sentences"],
          ["text", "application_responsible", "Responsável pela aplicação", x.application_responsible, V.REQUIRED, "words"],
          ["text", "note", "Observação", x.note, 0, "sentences"]
        ];
      },
      gaps: [10, 10, 10, 10, 10, 10, 20],
      deleteMessage: "Você tem certeza que deseja excluir este registro?"
    },
    pesticide: {
      api: "pesticide",
      listTitle: "Defensivos",
      detailTitle: "Registro de defensivo",
      formTitle: "Registrar defensivo",
      cell: function (x) {
        return cellHead(x.product_name, RA.fmtDate(x.date)) + cellText(x.target_disease) + cellText(x.dose);
      },
      detail: function (x) {
        return (
          ENTRY_TYPES.pesticide.cell(x) +
          '<div style="height:25px"></div>' +
          info("Operador", x.operator) +
          '<div style="height:25px"></div>' +
          info("Volume de calda", x.volume) +
          '<div style="height:25px"></div>' +
          info("Período de carência", x.grace_period) +
          '<div style="height:20px"></div>'
        );
      },
      fields: function (x) {
        x = x || {};
        return [
          ["date", "date", "Data da aplicação", x.date],
          ["text", "grace_period", "Período de carência", x.grace_period, V.REQUIRED],
          ["text", "target_disease", "Praga ou doença alvo", x.target_disease, V.REQUIRED, "sentences"],
          ["text", "product_name", "Nome do produto", x.product_name, V.REQUIRED, "sentences"],
          ["text", "dose", "Dose", x.dose, V.REQUIRED],
          ["text", "volume", "Volume de calda", x.volume, V.REQUIRED],
          ["text", "operator", "Operador", x.operator, V.REQUIRED, "words"]
        ];
      },
      gaps: [10, 10, 10, 10, 10, 10, 20]
    },
    harvest: {
      api: "harvest",
      listTitle: "Colheita",
      detailTitle: "Registro de colheita",
      formTitle: "Registrar colheita",
      cell: function (x) {
        return cellHead(x.amount, RA.fmtDate(x.date)) + cellText(x.destination) + cellText(x.responsible);
      },
      detail: function (x) {
        return ENTRY_TYPES.harvest.cell(x) + '<div style="height:20px"></div>';
      },
      fields: function (x) {
        x = x || {};
        return [
          ["date", "date", "Data da aplicação", x.date],
          ["text", "amount", "Quantidade colhida", x.amount, V.REQUIRED],
          ["text", "destination", "Destino", x.destination, V.REQUIRED, "sentences"],
          ["text", "responsible", "Responsável", x.responsible, V.REQUIRED, "words"]
        ];
      },
      gaps: [10, 10, 10, 20]
    },
    "post-harvest": {
      api: "postharvest",
      listTitle: "Pós-colheita",
      detailTitle: "Registro de pós-colheita",
      formTitle: "Registrar pós-colheita",
      cell: function (x) {
        return cellHead(x.product_name, RA.fmtDate(x.date)) + cellText(x.dose) + cellText(x.responsible);
      },
      detail: function (x) {
        return ENTRY_TYPES["post-harvest"].cell(x) + '<div style="height:25px"></div>' + info("Período de carência", x.grace_period) + '<div style="height:20px"></div>';
      },
      fields: function (x) {
        x = x || {};
        return [
          ["date", "date", "Data da aplicação", x.date],
          ["text", "product_name", "Nome do produto", x.product_name, V.REQUIRED, "sentences"],
          ["text", "dose", "Dose", x.dose, V.REQUIRED],
          ["text", "grace_period", "Período de carência", x.grace_period, V.REQUIRED],
          ["text", "responsible", "Responsável", x.responsible, V.REQUIRED, "words"]
        ];
      },
      gaps: [10, 10, 20, 10, 10]
    }
  };

  // modules/farm_journals/*_entries/*_entry_list_screen.dart
  function EntryListScreen(fjId, type) {
    var cfg = ENTRY_TYPES[type];
    return listScreen({
      title: cfg.listTitle,
      displaySearch: false,
      buttonText: "ADICIONAR REGISTRO",
      onPressed: function () {
        nav.go("home/farm-journals/" + fjId + "/" + type + "-entries/create-update/");
      },
      fetch: function () {
        return api.entries(cfg.api, fjId);
      },
      itemBuilder: function (x) {
        return cellCard(cfg.cell(x), function () {
          nav.go("home/farm-journals/" + type + "-entries/" + x.id + "/");
        });
      }
    }).el;
  }

  // modules/farm_journals/*_entries/*_entry_detail_screen.dart
  function EntryDetailScreen(type, id) {
    var cfg = ENTRY_TYPES[type];
    var sc = basicScreen(cfg.detailTitle);
    sc.body.innerHTML = itemsLoading();
    api.getEntry(cfg.api, id).then(function (x) {
      if (!x) {
        sc.body.innerHTML = '<div class="empty-text">Não há itens a exibir.</div>';
        return;
      }
      var card = cellCard(
        cfg.detail(x) + '<button class="btn btn-accent" data-edit>EDITAR</button><div style="height:10px"></div><button class="btn btn-border" data-delete>EXCLUIR</button>',
        null
      );
      sc.body.innerHTML = "";
      sc.body.appendChild(card);
      card.querySelector("[data-edit]").onclick = function () {
        nav.go("home/farm-journals/" + type + "-entries/" + x.id + "/edit/");
      };
      card.querySelector("[data-delete]").onclick = function () {
        confirmDialog(
          "Excluir",
          "Você tem certeza que deseja excluir este registro?",
          function () {
            withProgress(api.deleteEntry(cfg.api, x.id))
              .then(function () {
                nav.back();
              })
              .catch(function () {
                showFeedback("Ocorreu um erro.");
              });
          },
          { dismissOnConfirmation: true }
        );
      };
    });
    return sc;
  }

  // modules/farm_journals/*_entries/*_entry_create_update_screen.dart
  // Rotas: (fjId, type, "create-update") para criar ou (type, entryId, "edit") para editar.
  function EntryCreateUpdateScreen(a, b) {
    var creating = RA.UUID_RE.test(a);
    var type = creating ? b : a;
    var fjId = creating ? a : null;
    var entryId = creating ? null : b;
    var cfg = ENTRY_TYPES[type];
    var sc = basicScreen(cfg.formTitle);

    function build(x) {
      var form = new Form();
      var values = {};
      var content = h("<div></div>");
      cfg.fields(x).forEach(function (def, i) {
        var kind = def[0],
          key = def[1],
          hint = def[2],
          val = def[3];
        var f;
        if (kind === "date") f = dateField({ hint: hint, initialValue: val, validator: requiredItem });
        else if (kind === "unit")
          f = pickerField({
            hint: hint,
            items: ["KGM", "LM", "GP"],
            initialValue: val,
            validator: requiredItem,
            itemBuilder: function (c) {
              return '<span style="color:var(--gray);font-size:15px">' + e(api.unitDescription(c)) + "</span>";
            },
            selectionText: function (c) {
              return api.unitDescription(c);
            }
          });
        else
          f = textField({
            hint: hint,
            value: val,
            validator: def[4] ? getValidator(def[4]) : null,
            capitalization: def[5],
            keyboard: def[6]
          });
        form.add(f);
        values[key] = f;
        content.appendChild(f.el);
        content.appendChild(h('<div style="height:' + cfg.gaps[i] + 'px"></div>'));
      });
      var save = h('<button class="btn btn-accent">SALVAR</button>');
      content.appendChild(save);
      sc.body.innerHTML = "";
      sc.body.appendChild(content);
      save.onclick = function () {
        if (!form.validate()) return;
        var data = { farm_journal_id: x ? x.farm_journal_id : fjId };
        Object.keys(values).forEach(function (k) {
          data[k] = values[k].value;
        });
        withProgress(api.saveEntry(cfg.api, data, x))
          .then(function () {
            nav.back();
          })
          .catch(function () {
            showFeedback("Ocorreu um erro.");
          });
      };
    }

    if (entryId) {
      sc.body.innerHTML = itemsLoading();
      api.getEntry(cfg.api, entryId).then(build);
    } else build(null);
    return sc;
  }

  // ------------------------------------------------------------------ início
  window.addEventListener("hashchange", render);
  api
    .ready()
    .then(loadSession)
    .then(function () {
      if (!window.location.hash) nav.replace(session.user ? "home/" : "login/");
      else render();
    })
    .catch(function (err) {
      console.error(err);
      root.innerHTML = '<div class="empty-text">Ocorreu um erro. Tente novamente.</div>';
    });
})(window, document);
