/*
 * Reprodução da marcação HTML do painel Wagtail 2.11 usada pelo Rastrear AgriFamiliar
 * (templates wagtailadmin/*, modeladmin/* e os templates sobrescritos pelo projeto).
 * Os estilos são os originais do Wagtail (assets/wagtail/css/core.css).
 */
(function (window, $) {
  "use strict";

  var RA = window.RA;
  var e = RA.esc;
  var W = (window.W = {});

  // Textos do Wagtail em pt-BR. Quando a mesma frase existe em mais de um app, vale a
  // tradução do app listado primeiro em INSTALLED_APPS (regra do Django). Como o projeto
  // lista "django.contrib.admin" antes do Wagtail, "Delete" vira "Apagar" e
  // "Log out" vira "Encerrar sessão", exatamente como aparecia no sistema original.
  W.T = {
    dashboard: "Painel",
    accountSettings: "Configurações da Conta",
    logout: "Encerrar sessão",
    editAccount: "Edite sua conta",
    menu: "Menu",
    skip: "Ir para o conteúdo principal",
    save: "Salvar",
    saving: "Salvando…",
    delete: "Apagar",
    edit: "Editar",
    new: "Adicionar",
    editing: "Editando",
    previous: "Anterior",
    next: "Próximo",
    yesDelete: "Sim, exclua",
    noDelete: "Não, não apague",
    goBack: "Voltar a listagem",
    pagination: "Paginação",
    required: "Este campo é obrigatório.",
    noPermission: "Desculpe, você não tem permissão para acessar esta área."
  };

  // Caminho base das páginas do painel ("/admin/" no original)
  W.u = function (path) {
    return "#/" + String(path || "").replace(/^\/+/, "");
  };

  // wagtailConfig usado pelo seletor de datas (date-time-chooser.js)
  window.wagtailConfig = window.wagtailConfig || {};
  window.wagtailConfig.STRINGS = {
    MONTHS: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
    WEEKDAYS: ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"],
    WEEKDAYS_SHORT: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  };
  window.dateTimePickerTranslations = true;

  // core/wagtail_hooks.py insert_global_admin_js
  window.getCSRFToken = function () {
    return "local";
  };

  // wagtailadmin/js/core.js addMessage
  window.addMessage = function (status, text) {
    $(".messages")
      .addClass("new")
      .empty()
      .append('<ul><li class="' + status + '">' + text + "</li></ul>");
    var t = setTimeout(function () {
      $(".messages").addClass("appear");
      clearTimeout(t);
    }, 100);
  };

  // ------------------------------------------------------------------ ícones (shared/icon.html)
  W.icon = function (name, cls, wrapped) {
    var svg =
      '<svg class="icon icon-' + name + " " + (cls || "") + '" aria-hidden="true" focusable="false"><use href="#icon-' + name + '"></use></svg>';
    return wrapped ? '<span class="icon-wrapper">' + svg + "</span>" : svg;
  };

  var spriteLoaded = null;
  W.loadSprite = function () {
    if (!spriteLoaded) {
      spriteLoaded = fetch(RA.url("assets/wagtail/icons.svg"))
        .then(function (r) {
          return r.text();
        })
        .then(function (svg) {
          var holder = document.querySelector("[data-sprite]");
          if (holder) holder.innerHTML = svg;
        });
    }
    return spriteLoaded;
  };

  // ------------------------------------------------------------------ estilos e scripts por página
  // No original alguns arquivos CSS só eram incluídos em determinadas páginas.
  W.setCSS = function (keys) {
    keys = keys || [];
    Array.prototype.forEach.call(document.querySelectorAll("link[data-css]"), function (l) {
      var on = keys.indexOf(l.getAttribute("data-css")) !== -1;
      if (l.disabled === on) l.disabled = !on;
    });
  };

  // Executa novamente um script original (os scripts usam $(document).ready).
  W.loadScript = function (path) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = RA.url(path);
      s.onload = function () {
        s.remove();
        resolve();
      };
      s.onerror = reject;
      document.body.appendChild(s);
    });
  };

  // ------------------------------------------------------------------ mensagens (Django messages)
  var FLASH_KEY = "ra_admin_flash";
  W.flash = function (level, html) {
    var list = [];
    try {
      list = JSON.parse(sessionStorage.getItem(FLASH_KEY) || "[]");
    } catch (x) {}
    list.push({ level: level, html: html });
    try {
      sessionStorage.setItem(FLASH_KEY, JSON.stringify(list));
    } catch (x) {}
  };
  W.takeFlash = function () {
    var list = [];
    try {
      list = JSON.parse(sessionStorage.getItem(FLASH_KEY) || "[]");
      sessionStorage.removeItem(FLASH_KEY);
    } catch (x) {}
    return list;
  };

  // messages.success(..., buttons=[...]) -> wagtail/admin/messages.py render()
  W.messageWithButtons = function (text, buttons) {
    var h = e(text);
    if (buttons && buttons.length) {
      h +=
        '\n\n    <span class="buttons">\n' +
        buttons
          .map(function (b) {
            return '            <a href="' + b[0] + '" class="button button-small button-secondary">' + e(b[1]) + "</a>";
          })
          .join("\n") +
        "\n    </span>\n";
    }
    return h;
  };

  // messages.validation_error(): mensagem geral + lista de erros não ligados a campos
  W.validationErrorMessage = function (text, nonFieldErrors) {
    if (!nonFieldErrors || !nonFieldErrors.length) return e(text);
    return (
      e(text) +
      ' <ul class="errorlist">' +
      nonFieldErrors
        .map(function (m) {
          return "<li>" + e(m) + "</li>";
        })
        .join("\n") +
      "</ul>"
    );
  };

  W.messagesHTML = function (list) {
    if (!list || !list.length) return "";
    return (
      "<ul>" +
      list
        .map(function (m) {
          var icon = m.level === "error" ? "warning" : m.level;
          return '<li class="' + m.level + '">' + W.icon(icon, "messages-icon") + m.html + "</li>";
        })
        .join("") +
      "</ul>"
    );
  };

  // ------------------------------------------------------------------ estrutura da página (base.html)
  W.menuItem = function (it) {
    return (
      '<li class="menu-item' + (it.active ? " menu-active" : "") + '"><a href="' + it.url + '" class="' + (it.classnames || "") + '">' +
      (it.icon ? W.icon(it.icon, "icon--menuitem") : "") +
      e(it.label) +
      "</a></li>"
    );
  };

  W.shell = function (o) {
    // o: { menu: [...], userDisplay, isFarmer, content, messages }
    var menuHtml = o.menu.map(W.menuItem).join("");
    return (
      // templates/wagtailadmin/base.html (extra_css para produtores)
      (o.isFarmer
        ? "<style>.nav-main .account em {width: 180px !important;}.nav-main .account .avatar {width: 0px !important;}.footer-submenu li:first-child {display: none;}</style>"
        : "") +
      '<a class="skiplink button" href="#main" data-skiplink>' + W.T.skip + "</a>" +
      '<div class="wrapper">' +
      '<aside class="nav-wrapper" data-nav-primary><div class="inner">' +
      '<a href="' + W.u("") + '" class="logo" aria-label="' + W.T.dashboard + '">' +
      '<div class="wagtail-logo-container__mobile u-hidden@sm"><img class="wagtail-logo wagtail-logo__full" src="' + RA.url("assets/img/logo_small.svg") + '" alt="" width="80" /></div>' +
      '<div class="wagtail-logo-container__desktop u-hidden@xs"><img class="wagtail-logo wagtail-logo__full" style="width: 67px; margin: auto; position: relative;" src="' + RA.url("assets/img/logo_small.svg") + '" alt="" width="80" /></div>' +
      '<span class="u-hidden@sm">' + W.T.dashboard + "</span></a>" +
      '<form class="nav-search" action="#" method="get"><div><label for="menu-search-q">Pesquisar</label><input type="text" id="menu-search-q" name="q" placeholder="Pesquisar" /><button class="button" type="submit">Pesquisar</button></div></form>' +
      '<nav class="nav-main"><ul>' +
      menuHtml +
      '<li class="footer" id="footer"><div class="account" id="account-settings" title="' + W.T.editAccount + '">' +
      '<span class="avatar square avatar-on-dark"><img src="' + RA.url("assets/wagtail/images/default-user-avatar.png") + '" alt="" /></span>' +
      '<em class="icon icon-arrow-up-after">' + e(o.userDisplay) + "</em></div>" +
      '<ul class="footer-submenu"><li><a href="' + W.u("account/") + '" class="icon icon-user">' + W.T.accountSettings + '</a></li><li><a href="' + W.u("logout/") + '" class="icon icon-logout">' + W.T.logout + "</a></li></ul>" +
      "</li></ul></nav></div>" +
      '<div class="explorer__wrapper" data-explorer-menu></div></aside>' +
      '<main class="content-wrapper" role="main" id="main"><div class="content">' +
      '<div class="messages">' + W.messagesHTML(o.messages) + "</div>" +
      '<div id="nav-toggle" class="nav-toggle icon text-replace">' + W.T.menu + "</div>" +
      o.content +
      "</div></main></div>"
    );
  };

  // shared/header.html
  W.header = function (o) {
    return (
      '<header class="' + (o.merged ? "merged" : "") + " " + (o.tabbed ? "tab-merged" : "") + " " + (o.search ? "hasform" : "") + '">' +
      '<div class="row' + (o.tabbed ? "" : " nice-padding") + '"><div class="left"><div class="col header-title"><h1>' +
      (o.icon ? W.icon(o.icon, "header-title-icon") : "") +
      "\n                " + e(o.title) + (o.subtitle ? " <span>" + e(o.subtitle) + "</span>" : "") +
      "</h1></div>" +
      (o.search || "") +
      '</div><div class="right">' +
      (o.actionUrl
        ? '<div class="actionbutton"><a href="' + o.actionUrl + '" class="button bicolor button--icon">' + W.icon(o.actionIcon || "plus", "", true) + e(o.actionText) + "</a></div>"
        : "") +
      "</div></div></header>"
    );
  };

  // Formulário de busca do cabeçalho (shared/header.html com search_url)
  W.headerSearch = function (value, placeholder) {
    return (
      '<form class="col search-form" action="#" method="get" novalidate role="search"><ul class="fields">' +
      '<li class="required "><div class="field char_field text_input field-small iconfield">' +
      '<label for="id_q">Termo de pesquisa:</label><div class="field-content"><div class="input icon-search ">' +
      '<input type="text" name="q" placeholder="' + e(placeholder) + '" required id="id_q" value="' + e(value || "") + '"><span></span></div></div></div></li>' +
      '<li class="submit visuallyhidden"><input type="submit" value="Search" class="button" /></li></ul></form>'
    );
  };

  // ------------------------------------------------------------------ campos (shared/field.html)
  W.fieldHTML = function (f) {
    // f: { id, label, fieldtype, widgettype, widget, errors, help, helpHtml, showLabel, fieldClasses, inputClasses }
    var errs = f.errors && f.errors.length;
    var help = f.helpHtml || (f.help ? e(f.help) : "");
    return (
      '<div class="field ' + (f.fieldtype || "") + " " + (f.widgettype || "") + " " + (f.fieldClasses || "") + '">' +
      (f.showLabel === false || !f.label ? "" : '<label for="' + f.id + '">' + e(f.label) + ":</label>") +
      '<div class="field-content"><div class="input ' + (f.inputClasses || "") + ' ">' +
      f.widget +
      "<span></span></div>" +
      (help && f.showHelp !== false ? '<p class="help">' + help + "</p>" : "") +
      (errs
        ? '<p class="error-message">' +
          f.errors
            .map(function (m) {
              return "<span>" + e(m) + "</span>";
            })
            .join("") +
          "</p>"
        : "") +
      "</div></div>"
    );
  };

  // shared/field_as_li.html
  W.fieldLi = function (f) {
    return '<li class="' + (f.required ? "required" : "") + " " + (f.liClasses || "") + " " + (f.errors && f.errors.length ? "error" : "") + '">' + W.fieldHTML(f) + "</li>";
  };

  // ------------------------------------------------------------------ paginação do modeladmin (modeladmin/index.html)
  W.modelAdminPagination = function (page, numPages, urlFor) {
    // page: número da página começando em 1
    var h = '<nav class="pagination col12" aria-label="' + W.T.pagination + '"><p>Página ' + page + " de " + numPages + ".</p>";
    if (numPages > 1) {
      h += "<ul>";
      if (page > 1) h += '<li class="prev"><a href="' + urlFor(page - 2) + '" class="icon icon-arrow-left">' + W.T.previous + "</a></li>";
      if (page < numPages) h += '<li class="next"><a href="' + urlFor(page) + '" class="icon icon-arrow-right-after">' + W.T.next + "</a></li>";
      h += "</ul>";
    }
    return h + "</nav>";
  };

  // shared/pagination_nav.html
  W.paginationNav = function (page, numPages, urlFor) {
    return (
      '<nav class="pagination" aria-label="' + W.T.pagination + '"><p>Página ' + page + " de " + numPages + ".</p><ul>" +
      '<li class="prev">' + (page > 1 ? '<a href="' + urlFor(page - 1) + '" class="icon icon-arrow-left">' + W.T.previous + "</a>" : "") + "</li>" +
      '<li class="next">' + (page < numPages ? '<a href="' + urlFor(page + 1) + '" class="icon icon-arrow-right-after">' + W.T.next + "</a>" : "") + "</li>" +
      "</ul></nav>"
    );
  };

  // ------------------------------------------------------------------ comportamento (wagtailadmin/js/core.js)
  W.bindGlobal = function () {
    if (W._bound) return;
    W._bound = true;
    $(document).on("click", "#nav-toggle", function () {
      $("body").toggleClass("nav-open");
      if (!$("body").hasClass("nav-open")) $("body").addClass("nav-closed");
      else $("body").removeClass("nav-closed");
    });
    $(document).on("click", "#account-settings", function () {
      $(".nav-main").toggleClass("nav-main--open-footer");
      $(this).find("em").toggleClass("icon-arrow-down-after icon-arrow-up-after");
    });
    $(document).on("focus mouseover", "input,textarea,select", function () {
      $(this).closest(".field").addClass("focused");
      $(this).closest("fieldset").addClass("focused");
      $(this).closest("li").addClass("focused");
    });
    $(document).on("blur mouseout", "input,textarea,select", function () {
      $(this).closest(".field").removeClass("focused");
      $(this).closest("fieldset").removeClass("focused");
      $(this).closest("li").removeClass("focused");
    });
    // Abas (bootstrap-tab). A aba ativa fica guardada no endereço, como no original.
    $(document).on("click", ".tab-nav a", function (ev) {
      ev.preventDefault();
      $(this).tab("show");
      if (W.onTabShown) W.onTabShown($(this).attr("href"));
    });
    $(document).on("click", ".tab-toggle", function (ev) {
      ev.preventDefault();
      $('.tab-nav a[href="' + $(this).attr("href") + '"]').trigger("click");
    });
    $(document).on("shown.bs.tab", function () {
      if (window.autosize) {
        $("textarea[data-autosize-on]").each(function () {
          window.autosize.update($(this).get());
        });
      }
    });
    $(window).on("resize", function () {
      $(".nav-wrapper").css("min-height", $(window).height());
    });
    // Botões "button-longrunning" (spinner ao enviar)
    $(document).on("click", "button.button-longrunning", function () {
      var $self = $(this);
      var $em = $("em", $self);
      var form = $self.closest("form").get(0);
      if (form && form.checkValidity && !form.noValidate && !form.checkValidity()) return;
      setTimeout(function () {
        if ($self.data("clicked-text") && $em.length) {
          $self.data("original-text", $em.text());
          $em.text($self.data("clicked-text"));
        }
        $self.addClass("button-longrunning-active").prop("disabled", "true");
      }, 10);
    });
    // Atalho Ctrl+S (page-editor.js initKeyboardShortcuts)
    $(document).on("keydown", function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === "s" || ev.key === "S")) {
        var $save = $(".action-save").first();
        if ($save.length) {
          ev.preventDefault();
          $save.trigger("click");
        }
      }
    });
  };

  W.cancelSpinner = function (root) {
    $("button.button-longrunning", root || document).each(function () {
      var $self = $(this);
      $self.prop("disabled", false).removeClass("button-longrunning-active");
      if ($self.data("original-text")) $("em", $self).text($self.data("original-text"));
    });
  };

  W.initDropdowns = function (root) {
    $(".dropdown", root).each(function () {
      var $dropdown = $(this);
      $(".dropdown-toggle", $dropdown).on("click", function (ev) {
        ev.stopPropagation();
        $dropdown.toggleClass("open");
        if ($dropdown.hasClass("open")) {
          $(document).on("click.dropdown.cancel", function (e2) {
            var rel = e2.relatedTarget || e2.toElement;
            if (!$(rel).parents().is($dropdown)) {
              $dropdown.removeClass("open");
              $(document).off("click.dropdown.cancel");
            }
          });
        } else {
          $(document).off("click.dropdown.cancel");
        }
      });
    });
  };

  // page-editor.js initErrorDetection
  W.initErrorDetection = function (root) {
    var errorSections = {};
    $(".error-message", root).each(function () {
      var id = $(this).closest("section").attr("id");
      errorSections[id] = (errorSections[id] || 0) + 1;
    });
    for (var index in errorSections) {
      $('.tab-nav a[href="#' + index + '"]', root).addClass("errors").attr("data-count", errorSections[index]);
    }
  };

  W.afterRender = function (root) {
    $("body").addClass("ready");
    $(".nav-wrapper").css("min-height", $(window).height());
    W.initDropdowns(root);
    if (window.autosize) {
      $("textarea[data-autosize-on]", root).each(function () {
        window.autosize($(this).get());
      });
    }
    setTimeout(function () {
      $(".messages").addClass("appear");
    }, 50);
  };

  // Formato de data e hora do Django pt-BR: "j \d\e F \d\e Y à\s H:i"
  var MESES = window.wagtailConfig.STRINGS.MONTHS;
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  W.djangoDateTime = function (v) {
    var d = RA.toDate(v);
    if (!d) return "";
    return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear() + " às " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  };

  // Filtro date:"d M Y H:i" (título da coluna "Último login")
  var MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  W.djangoShortDateTime = function (v) {
    var d = RA.toDate(v);
    if (!d) return "";
    return pad(d.getDate()) + " " + MESES_ABREV[d.getMonth()] + " " + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  };

  // Filtro timesince do Django em pt-BR (até duas unidades, ex.: "2 dias, 3 horas")
  W.timesince = function (v) {
    var d = RA.toDate(v);
    if (!d) return "";
    var s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    var chunks = [
      [365 * 24 * 3600, "ano", "anos"],
      [30 * 24 * 3600, "mês", "meses"],
      [7 * 24 * 3600, "semana", "semanas"],
      [24 * 3600, "dia", "dias"],
      [3600, "hora", "horas"],
      [60, "minuto", "minutos"]
    ];
    var i, n;
    for (i = 0; i < chunks.length; i++) {
      n = Math.floor(s / chunks[i][0]);
      if (n !== 0) break;
    }
    if (i === chunks.length) return "0 minutos";
    var out = n + " " + (n === 1 ? chunks[i][1] : chunks[i][2]);
    if (i + 1 < chunks.length) {
      var n2 = Math.floor((s - n * chunks[i][0]) / chunks[i + 1][0]);
      if (n2 !== 0) out += ", " + n2 + " " + (n2 === 1 ? chunks[i + 1][1] : chunks[i + 1][2]);
    }
    return out;
  };
})(window, window.jQuery);
