/*
 * Páginas do painel: entrada (login), saída, recuperação de senha, painel inicial
 * (wagtailadmin/home.html + painéis do projeto), conta (wagtailadmin/account/*)
 * e administradores (templates/wagtailusers/users/* do projeto).
 */
(function (window, $) {
  "use strict";

  var RA = window.RA;
  var W = window.W;
  var MA = window.MA;
  var api = RA.api;
  var e = RA.esc;
  var PG = (window.PG = {});

  PG.avatarURL = function (user) {
    return (user && user.avatar) || RA.url("assets/wagtail/images/default-user-avatar.png");
  };

  // shared/field_as_li.html para um campo simples
  PG.simpleField = function (o) {
    // o: { name, label, type, value, required, errors, help, helpHtml, fieldtype, widgettype, attrs }
    var widget =
      '<input type="' + (o.type || "text") + '" name="' + o.name + '"' +
      (o.value !== undefined && o.type !== "password" ? ' value="' + e(o.value) + '"' : "") +
      (o.attrs || "") + (o.required ? " required" : "") + ' id="id_' + o.name + '">';
    return W.fieldLi({
      id: "id_" + o.name,
      label: o.label,
      fieldtype: o.fieldtype || "char_field",
      widgettype: o.widgettype || (o.type === "password" ? "password_input" : o.type === "email" ? "email_input" : "text_input"),
      widget: widget,
      errors: o.errors,
      help: o.help,
      helpHtml: o.helpHtml,
      required: o.required
    });
  };

  function formData(root) {
    var out = {};
    $(root)
      .find("input[name], select[name], textarea[name]")
      .each(function () {
        if (this.type === "checkbox") out[this.name] = this.checked;
        else out[this.name] = this.value;
      });
    return out;
  }
  PG.formData = formData;

  // ------------------------------------------------------------------ entrada (templates/wagtailadmin/login.html do projeto)
  PG.login = function (query, values, hasError) {
    var msgs = W.takeFlash();
    var next = query.next || W.u("");
    var list = "";
    if (hasError || msgs.length) {
      list =
        '<div class="messages"><ul>' +
        (hasError ? '<li class="error">Dados de acesso inválidos. Por favor, tente novamente.</li>' : "") +
        msgs
          .map(function (m) {
            return '<li class="' + m.level + '">' + m.html + "</li>";
          })
          .join("") +
        "</ul></div>";
    }
    var html =
      "<style>.content-wrapper, body, html {background-color: #22736C !important;}.button {background: #35A49A;}" +
      ".full .iconfield .input:before {color: #b1b1b1;border: 2px solid #b1b1b1;}.content-wrapper {margin-top: -10vh;}" +
      "#logo {height: 150px;margin-bottom: 10vh;}h1 {font-size: 3em;}</style>" +
      '<main class="content-wrapper" role="main">' +
      list +
      '<img id="logo" src="' + RA.url("assets/img/logo.svg") + '">' +
      '<p style="margin-bottom: 30px;">Não tem uma conta? <a href="' + RA.url("cadastro/") + '" class="button" style="margin-left: 5px; padding: 2px 12px;line-height: initial;height: initial;text-transform: none;font-size: 14px;position: relative;top: -2px;">Experimente grátis!</a></p>' +
      '<form action="#" method="post" autocomplete="off" novalidate class="ra-login-form">' +
      '<input type="hidden" name="csrfmiddlewaretoken" value="local"><input type="hidden" name="next" value="' + e(next) + '" />' +
      '<ul class="fields">' +
      '<li class="full"><div class="field iconfield"><label for="id_username">CPF ou CNPJ:</label><div class="input icon-user">' +
      '<input type="text" name="username" maxlength="30" placeholder="Digite seu CPF ou CNPJ" required id="id_username" value="' + e((values && values.username) || "") + '"></div></div></li>' +
      '<li class="full"><div class="field iconfield"><label for="id_password">Password:</label><div class="input icon-password">' +
      '<input type="password" name="password" placeholder="Digite sua senha" required id="id_password"></div></div></li>' +
      '<li class="submit"><button type="submit" class="button button-longrunning" data-clicked-text="Entrando...">' + W.icon("spinner") + "<em>Entrar</em></button></li>" +
      "</ul>" +
      '<p class="help"><a href="' + W.u("password_reset/") + '" aria-label="Redefina sua senha">Esqueceu a senha?</a></p>' +
      "</form></main>";
    return {
      title: "Entrar",
      bodyClass: "login",
      furniture: true,
      css: ["login"],
      html: html,
      after: function (root) {
        $(root).find("input[name=username]").trigger("focus");
        $(root)
          .find(".ra-login-form")
          .on("submit", function (ev) {
            ev.preventDefault();
            var username = $(this).find("[name=username]").val();
            var password = $(this).find("[name=password]").val();
            api
              .loginAdmin(username, password)
              .then(function () {
                location.replace(next.charAt(0) === "#" ? next : W.u(""));
              })
              .catch(function () {
                window.ADMIN.renderPage(PG.login(query, { username: username }, true));
              });
          });
      }
    };
  };

  // ------------------------------------------------------------------ recuperação de senha (wagtailadmin/account/password_reset/*)
  PG.passwordReset = function (value, errors) {
    var errs = errors || [];
    var html =
      '<main class="content-wrapper" role="main"><form method="post" novalidate class="ra-reset-form">' +
      '<input type="hidden" name="csrfmiddlewaretoken" value="local"><h1>Redefina sua senha</h1><ul class="fields"><li><div class="field">' +
      '<label for="id_email">Entre com seu email para resetar sua senha:</label>' +
      '<input type="email" name="email" maxlength="254" required id="id_email" value="' + e(value || "") + '">' +
      '<div class="messages"><ul>' +
      errs
        .map(function (m) {
          return '<li class="error">' + e(m) + "</li>";
        })
        .join("") +
      "</ul></div></div></li>" +
      '<li class="submit"><button type="submit" class="button">Resetar senha</button></li></ul></form></main>';
    return {
      title: "Resetar senha",
      bodyClass: "login",
      furniture: true,
      css: ["login"],
      html: html,
      after: function (root) {
        $(root)
          .find(".ra-reset-form")
          .on("submit", function (ev) {
            ev.preventDefault();
            var v = $(this).find("[name=email]").val().trim();
            if (!v) return window.ADMIN.renderPage(PG.passwordReset(v, [api.REQUIRED]));
            if (!RA.isEmail(v)) return window.ADMIN.renderPage(PG.passwordReset(v, [api.INVALID_EMAIL]));
            api
              .requestPasswordReset(v)
              .then(function (r) {
                PG.resetEmailBackend = !!(r && r.email_backend);
                location.hash = W.u("password_reset/done/");
              })
              .catch(function (err) {
                var msgs = err && err.errors ? err.errors.email || err.errors.__all__ : null;
                window.ADMIN.renderPage(PG.passwordReset(v, msgs || ["Ocorreu um erro. Tente novamente."]));
              });
          });
      }
    };
  };

  PG.passwordResetDone = function () {
    return {
      title: "Resetar senha",
      bodyClass: "login",
      furniture: true,
      css: ["login"],
      html:
        '<main class="content-wrapper" role="main"><h1>Verifique seu e-mail</h1>' +
        "<p>Um link para redefinir sua senha foi enviado para você, caso exista uma conta para esse endereço.</p>" +
        // Sem servidor de e-mail configurado: avisa em vez de fingir o envio
        (PG.resetEmailBackend
          ? ""
          : '<p class="ra-local-note">Atenção: nesta versão o envio de e-mails ainda não está ligado. Peça a um administrador para redefinir a sua senha.</p>') +
        "</main>"
    };
  };

  // ------------------------------------------------------------------ link do e-mail (wagtailadmin/account/password_reset/confirm.html e complete.html)
  // Como o Django (PasswordResetConfirmView), o código sai do endereço e fica guardado na sessão.
  var RESET_KEY = "ra_admin_reset_token";

  function resetToken(uidb64, token) {
    if (token !== "set-password") {
      try {
        sessionStorage.setItem(RESET_KEY, JSON.stringify({ uidb64: uidb64, token: token }));
      } catch (x) {}
      history.replaceState(null, null, W.u("password_reset/confirm/" + uidb64 + "/set-password/"));
      return token;
    }
    try {
      var s = JSON.parse(sessionStorage.getItem(RESET_KEY) || "null");
      return s && s.uidb64 === uidb64 ? s.token : null;
    } catch (x) {
      return null;
    }
  }

  function resetInvalidPage() {
    return {
      title: "Link de redefinição de senha inválido",
      bodyClass: "login",
      furniture: true,
      css: ["login"],
      html:
        '<main class="content-wrapper" role="main"><h1>Link de redefinição de senha inválido</h1>' +
        '<div class="messages"><ul><li class="error">O link de redefinição de senha é inválido, possivelmente porque já foi usado.</li></ul></div>' +
        '<a href="' + W.u("password_reset/") + '" class="button">Solicitar uma nova redefinição de senha</a></main>'
    };
  }

  function resetField(name, label, errors) {
    var errs = (errors && errors[name]) || [];
    return (
      '<li><div class="field"><label for="id_' + name + '">' + label + ":</label>" +
      '<input type="password" name="' + name + '" autocomplete="new-password" required id="id_' + name + '">' +
      (errs.length
        ? '<div class="help-block help-critical">' +
          errs
            .map(function (m) {
              return '<p class="error">' + e(m) + "</p>";
            })
            .join("") +
          "</div>"
        : "") +
      "</div></li>"
    );
  }

  function resetFormPage(uidb64, token, errors) {
    return {
      title: "Definir sua nova senha",
      bodyClass: "login",
      furniture: true,
      css: ["login"],
      html:
        '<main class="content-wrapper" role="main"><form method="post" novalidate class="ra-reset-confirm">' +
        '<input type="hidden" name="csrfmiddlewaretoken" value="local"><h1>Definir sua nova senha</h1><ul class="fields">' +
        resetField("new_password1", "Nova senha", errors) +
        resetField("new_password2", "Confirmação da nova senha", errors) +
        '<li class="submit"><button type="submit" class="button">Resetar senha</button></li></ul></form></main>',
      after: function (root) {
        $(root)
          .find(".ra-reset-confirm")
          .on("submit", function (ev) {
            ev.preventDefault();
            var p1 = $(this).find("[name=new_password1]").val();
            var p2 = $(this).find("[name=new_password2]").val();
            api
              .passwordResetConfirm(uidb64, token, p1, p2)
              .then(function () {
                try {
                  sessionStorage.removeItem(RESET_KEY);
                } catch (x) {}
                location.replace(W.u("password_reset/complete/"));
              })
              .catch(function (err) {
                if (err && err.invalidLink) return window.ADMIN.renderPage(resetInvalidPage());
                if (err && err.name === "ValidationError") return window.ADMIN.renderPage(resetFormPage(uidb64, token, err.errors));
                window.ADMIN.renderPage(resetFormPage(uidb64, token, { new_password2: ["Ocorreu um erro. Tente novamente."] }));
              });
          });
      }
    };
  }

  PG.passwordResetConfirm = function (uidb64, rawToken) {
    var token = resetToken(uidb64, rawToken);
    if (!token) return Promise.resolve(resetInvalidPage());
    return api.passwordResetCheck(uidb64, token).then(function (valid) {
      return valid ? resetFormPage(uidb64, token) : resetInvalidPage();
    });
  };

  PG.passwordResetComplete = function () {
    return {
      title: "Resetar senha",
      bodyClass: "login",
      furniture: true,
      css: ["login"],
      html:
        '<main class="content-wrapper" role="main"><h1>Senha alterada com sucesso</h1>' +
        '<p><a href="' + W.u("login/") + '" class="button button-primary">Entrar</a></p></main>'
    };
  };

  // ------------------------------------------------------------------ primeiro acesso (cria o primeiro administrador)
  // Não existia no original (lá o primeiro usuário vinha do comando "createsuperuser").
  PG.bootstrapAdmin = function (query, values, errors) {
    var v = values || { code: query.codigo || "" };
    errors = errors || {};
    function errs(name) {
      var list = errors[name] || [];
      return list.length
        ? '<div class="messages"><ul>' +
            list
              .map(function (m) {
                return '<li class="error">' + e(m) + "</li>";
              })
              .join("") +
            "</ul></div>"
        : "";
    }
    function field(name, label, type, extra) {
      return (
        '<li><div class="field"><label for="id_' + name + '">' + label + ":</label>" +
        '<input type="' + (type || "text") + '" name="' + name + '" id="id_' + name + '"' +
        (type === "password" ? ' autocomplete="new-password"' : ' value="' + e(v[name] || "") + '"') + (extra || "") + " required>" +
        errs(name) + "</div></li>"
      );
    }
    var personSelect =
      '<li><div class="field"><label for="id_person_type">Tipo:</label><select name="person_type" id="id_person_type" required>' +
      '<option value=""' + (!v.person_type ? " selected" : "") + ">---------</option>" +
      '<option value="PF"' + (v.person_type === "PF" ? " selected" : "") + ">Pessoa Física</option>" +
      '<option value="PJ"' + (v.person_type === "PJ" ? " selected" : "") + ">Pessoa Jurídica</option></select>" +
      errs("person_type") + "</div></li>";
    var html =
      '<main class="content-wrapper" role="main">' + errs("__all__") +
      '<form method="post" novalidate class="ra-bootstrap-form"><h1>Primeiro acesso</h1>' +
      "<p>Crie o primeiro administrador do Rastrear AgriFamiliar usando o código de instalação.</p><ul class=\"fields\">" +
      field("code", "Código de instalação") +
      field("name", "Nome completo", "text", ' maxlength="255"') +
      personSelect +
      field("cpf_cnpj", "CPF ou CNPJ", "text", ' maxlength="30"') +
      field("email", "E-mail", "email", ' maxlength="254"') +
      field("password1", "Senha", "password") +
      '<li><div class="help">' + api.PASSWORD_HELP_HTML + "</div></li>" +
      field("password2", "Confirmação de senha", "password") +
      '<li class="submit"><button type="submit" class="button button-longrunning" data-clicked-text="Criando...">' + W.icon("spinner") +
      "<em>Criar administrador</em></button></li></ul></form></main>";
    return {
      title: "Primeiro acesso",
      bodyClass: "login",
      furniture: true,
      css: ["login"],
      html: html,
      after: function (root) {
        $(root)
          .find(".ra-bootstrap-form")
          .on("submit", function (ev) {
            ev.preventDefault();
            var d = formData(this);
            api
              .bootstrapAdmin(d)
              .then(function () {
                W.flash("success", "Administrador criado. Bem-vindo ao Rastrear AgriFamiliar!");
                location.replace(W.u(""));
              })
              .catch(function (err) {
                var errors2 = err && err.name === "ValidationError" ? err.errors : { __all__: ["Ocorreu um erro. Tente novamente."] };
                window.ADMIN.renderPage(PG.bootstrapAdmin(query, d, errors2));
              });
          });
      }
    };
  };

  // ------------------------------------------------------------------ painel inicial (wagtailadmin/home.html)
  function countSummary(icon, url, n, label, plural) {
    // core/templates/core/summary/count_summary.html
    return (
      "<style>\n\t.summary-" + icon + " {\n\t\tcolor: #CCCCCC;\n\t\theight: 60px;\n\t}\n</style>\n<li>\n\t" +
      '<div style="display: flex; flex-direction: row; max-width: 180px; text-align: center;">\n\t\t' +
      W.icon(icon, "summary-" + icon) +
      '\n\t    <a href="' + W.u(url) + '">\n\t        <span>' + n + "</span> " + (n === 0 || n > 1 ? plural : label) + "\n\t    </a>\n\t</div>\n</li>"
    );
  }

  PG.dashboard = function (ctx) {
    var u = ctx.user,
      idx = ctx.idx,
      profile = ctx.profile,
      sub = ctx.subscription;
    var panels = []; // [ordem, html]
    var css = ["home", "editor"];
    var after = null;

    if (u.is_farmer && profile) {
      var farms = idx.farms_list.filter(function (f) {
        return f.farmer_profile_id === profile.id;
      });
      var hasIncomplete = farms.length === 0;
      var isIncomplete = !profile.birth_date || !profile.telephone || !profile.description || !profile.logo_image || !profile.profile_image || farms.length === 0;
      // farmers/wagtail_hooks/farmers.py IncompleteProfilePanel
      if (isIncomplete) {
        panels.push(
          '\n        <section class="panel summary nice-padding">\n          <div class="help-block help-warning">\n            <p><strong>Atenção, </strong>você precisa completar o preenchimento dos seus dados! Clique na opção <strong>Meus dados</strong> no menu ao lado para completar o preenchimento.</p>\n          </div>\n        </section>\n        '
        );
      }
      // farmers/panels.py WelcomePanel
      if (hasIncomplete && !(sub && api.subWillBeBlocked(sub))) {
        panels.push(
          '<div style="text-align: center; margin-top: 70px;">\n\t<h1>Bem-vindo ao Rastrear AgriFamiliar!</h1>\n\t<p>Antes de começar a cadastrar os seus <strong>lotes</strong> e emitir as suas <strong>etiquetas</strong>, você deve completar o seu <strong>perfil</strong>, informando os dados de sua propriedade.</p>\n\n\t<p><a href="' +
            W.u("p/meus-dados/") + '">Clique aqui</a> e complete o seu perfil agora mesmo!</p>\n</div>'
        );
      }
      // farmers/panels.py BlockedSubscriptionPanel
      if (sub && api.subWillBeBlocked(sub)) {
        var blocked = window.FARMER.blockedPanel(ctx);
        panels.push(blocked.html);
        css.push("signup");
        after = blocked.after;
      }
    }

    // SiteSummaryPanel
    var items = [];
    if (u.is_superuser) {
      items.push(countSummary("users", "farmers/farmerprofile/", idx.farmer_profiles_list.length, "Produtor", "Produtores"));
      items.push(countSummary("carrot", "products/product/", idx.products_list.length, "Produto", "Produtos"));
    }
    if (u.is_farmer && profile && ctx.subscribed) {
      var myFarms = {};
      idx.farms_list.forEach(function (f) {
        if (f.farmer_profile_id === profile.id) myFarms[f.id] = true;
      });
      var hasIncomplete2 = Object.keys(myFarms).length === 0;
      var okSub = !!sub && !api.subWillBeBlocked(sub) && !hasIncomplete2;
      var myBatches = idx.batches_list.filter(function (b) {
        return myFarms[b.farm_id];
      });
      var batchIds = {};
      myBatches.forEach(function (b) {
        batchIds[b.id] = true;
      });
      if (okSub || profile.is_demo) {
        items.push(
          countSummary(
            "qrcode",
            "products/batchtag/",
            idx.batch_tags_list.filter(function (t) {
              return batchIds[t.batch_id];
            }).length,
            "Etiqueta",
            "Etiquetas"
          )
        );
        items.push(countSummary("box", "products/batch/", myBatches.length, "Lote", "Lotes"));
      }
      if (okSub) {
        items.push(
          countSummary(
            "clipboard-list",
            "farm_journals/farmjournal/",
            idx.farm_journals_list.filter(function (j) {
              return myFarms[j.farm_id];
            }).length,
            "Caderno",
            "Cadernos"
          )
        );
      }
    }
    if (items.length) {
      panels.push('<section class="panel summary nice-padding">\n    <h2 class="visuallyhidden">Resumo do site</h2>\n    <ul class="stats">\n        ' + items.join("\n        ") + "\n    </ul>\n</section>\n");
    }

    var html =
      '<header class="merged nice-padding"><div class="row"><div class="col1"><div class="avatar"><img src="' + PG.avatarURL(u) + '" alt="" /></div></div>' +
      '<div class="col9"><h1>Rastrear AgriFamiliar</h1><div class="user-name">' + e(u.name || RA.fmtCpfCnpj(u.cpf_cnpj)) + "</div></div></div></header>" +
      panels.join("\n");
    return { title: "Painel", bodyClass: "homepage", css: css, html: html, after: after };
  };

  // ------------------------------------------------------------------ conta (wagtailadmin/account/*)
  PG.account = function () {
    var items = [
      [W.u("account/change_avatar/"), "Definir foto do perfil", "Alterar sua foto de perfil."],
      [W.u("account/change_email/"), "Alterar e-mail", "Altere o endereço de e-mail vinculado à sua conta."],
      [W.u("account/change_password/"), "Alterar senha", "Altere sua senha para entrar."],
      [W.u("account/change_name/"), "Alterar o nome", "Alterar seu nome e sobrenome em sua conta."]
    ];
    var html =
      W.header({ title: "Conta" }) +
      '<div class="nice-padding"><ul class="listing">' +
      items
        .map(function (it) {
          return '<li class="row row-flush"><div class="col6"><a href="' + it[0] + '" class="button button-primary">' + it[1] + '</a></div><small class="col6">' + it[2] + "</small></li>";
        })
        .join("") +
      "</ul></div>";
    return { title: "Conta", html: html };
  };

  PG.changeName = function (ctx, value, errors) {
    var html =
      W.header({ title: "Alterar o nome" }) +
      '<div class="nice-padding"><form action="#" method="POST" novalidate class="ra-account-form"><input type="hidden" name="csrfmiddlewaretoken" value="local"><ul class="fields">' +
      PG.simpleField({ name: "name", label: "Nome", value: value !== undefined ? value : ctx.user.name, required: true, errors: errors && errors.name }) +
      '</ul><input type="submit" value="Alterar o nome" class="button" /></form></div>';
    return {
      title: "Alterar o nome",
      html: html,
      after: function (root) {
        $(root)
          .find(".ra-account-form")
          .on("submit", function (ev) {
            ev.preventDefault();
            var v = $(this).find("[name=name]").val();
            api
              .changeName(ctx.user, v)
              .then(function () {
                W.flash("success", "Seu nome foi alterado com sucesso!");
                location.hash = W.u("account/");
              })
              .catch(function (err) {
                window.ADMIN.renderPage(PG.changeName(ctx, v, err.errors));
              });
          });
      }
    };
  };

  PG.changeEmail = function (ctx, value, errors) {
    var html =
      W.header({ title: "Alterar e-mail" }) +
      '<div class="nice-padding"><form action="#" method="POST" novalidate class="ra-account-form"><input type="hidden" name="csrfmiddlewaretoken" value="local"><ul class="fields">' +
      PG.simpleField({ name: "email", type: "email", label: "E-mail", fieldtype: "email_field", value: value !== undefined ? value : ctx.user.email || "", required: true, errors: errors && errors.email }) +
      '</ul><input type="submit" value="Alterar e-mail" class="button" /></form></div>';
    return {
      title: "Alterar e-mail",
      html: html,
      after: function (root) {
        $(root)
          .find(".ra-account-form")
          .on("submit", function (ev) {
            ev.preventDefault();
            var v = $(this).find("[name=email]").val();
            api
              .changeEmail(ctx.user, v)
              .then(function () {
                W.flash("success", "Seu email foi alterado com sucesso!");
                location.hash = W.u("account/");
              })
              .catch(function (err) {
                window.ADMIN.renderPage(PG.changeEmail(ctx, v, err.errors));
              });
          });
      }
    };
  };

  // django.contrib.auth.forms.PasswordChangeForm (campos usados também no modal do produtor)
  PG.passwordChangeFields = function (errors) {
    errors = errors || {};
    return (
      PG.simpleField({ name: "old_password", type: "password", label: "Senha antiga", required: true, errors: errors.old_password, attrs: ' autocomplete="current-password" autofocus' }) +
      PG.simpleField({ name: "new_password1", type: "password", label: "Nova senha", required: true, errors: errors.new_password1, helpHtml: api.PASSWORD_HELP_HTML, attrs: ' autocomplete="new-password"' }) +
      PG.simpleField({ name: "new_password2", type: "password", label: "Confirmação da nova senha", required: true, errors: errors.new_password2, attrs: ' autocomplete="new-password"' })
    );
  };

  PG.changePassword = function (ctx, errors) {
    var html =
      W.header({ title: "Alterar senha" }) +
      '<div class="nice-padding"><form action="#" method="POST" novalidate class="ra-account-form"><input type="hidden" name="csrfmiddlewaretoken" value="local"><ul class="fields">' +
      PG.passwordChangeFields(errors) +
      '</ul><button type="submit" class="button">Alterar senha</button></form></div>';
    return {
      title: "Alterar senha",
      html: html,
      after: function (root) {
        $(root)
          .find(".ra-account-form")
          .on("submit", function (ev) {
            ev.preventDefault();
            var d = formData(this);
            api
              .changePasswordForm(ctx.user, d)
              .then(function () {
                W.flash("success", "Sua senha foi alterada com sucesso!");
                location.hash = W.u("account/");
              })
              .catch(function (err) {
                window.ADMIN.renderPage(PG.changePassword(ctx, err.errors));
              });
          });
      }
    };
  };

  PG.changeAvatar = function (ctx) {
    var u = ctx.user;
    var widget = u.avatar
      ? 'Atualmente: <a href="' + e(u.avatar) + '">' + e(u.avatar_name || "avatar_images/avatar.png") + '</a>\n<input type="checkbox" name="avatar-clear" id="avatar-clear_id">\n<label for="avatar-clear_id">Limpar</label><br>\nModificar: <input type="file" name="avatar" accept="image/*" id="id_avatar">'
      : '<input type="file" name="avatar" accept="image/*" id="id_avatar">';
    var html =
      W.header({ title: "Alterar foto do perfil" }) +
      '<div class="nice-padding"><p>Sua foto atual do perfil:</p><p><span class="avatar square"><img src="' + PG.avatarURL(u) + '" alt=""></span></p>' +
      '<form action="#" method="POST" enctype="multipart/form-data" class="ra-account-form"><input type="hidden" name="csrfmiddlewaretoken" value="local"><ul class="fields">' +
      W.fieldLi({ id: "id_avatar", label: "Foto do perfil", fieldtype: "image_field", widgettype: "clearable_file_input", widget: widget }) +
      '<li class="submit"><button class="button">Atualizar</button></li></ul></form></div>';
    return {
      title: "Alterar foto do perfil",
      html: html,
      after: function (root) {
        $(root)
          .find(".ra-account-form")
          .on("submit", function (ev) {
            ev.preventDefault();
            var file = $(this).find("#id_avatar")[0].files[0];
            var clear = $(this).find("#avatar-clear_id").prop("checked");
            Promise.resolve(file ? RA.readImage(file, 200, 0.9) : null).then(function (data) {
              if (clear) {
                u.avatar = null;
                u.avatar_name = null;
              }
              if (data) {
                u.avatar = data;
                u.avatar_name = "avatar_images/" + file.name;
              }
              return RA.db.put("users", u).then(function () {
                W.flash("success", "Suas preferências foram atualizadas com sucesso!");
                window.ADMIN.route(true);
              });
            });
          });
      }
    };
  };

  // ------------------------------------------------------------------ administradores (templates/wagtailusers/users/*)
  var PER_PAGE_USERS = 20;

  function userResults(ctx, users, q, page) {
    // SearchForm exige o termo: busca vazia não conta como busca
    var isSearching = q !== null && q !== undefined && String(q).trim() !== "";
    var numPages = Math.max(1, Math.ceil(users.length / PER_PAGE_USERS));
    if (page > numPages || page < 1) page = page < 1 ? 1 : numPages;
    var slice = users.slice((page - 1) * PER_PAGE_USERS, page * PER_PAGE_USERS);
    var h = "";
    if (users.length) {
      if (isSearching) h += '<h2 role="alert">\n            Há ' + users.length + " " + (users.length === 1 ? "resultado" : "resultados") + "\n        </h2>";
      h +=
        '<table class="listing"><thead><tr><th class="name"><a href="' + W.u("users/") + '" class="icon icon-arrow-down-after teal">\n                        Nome\n                    </a></th>' +
        '<th class="cpf_cnpj">CPF ou CNPJ</th><th class="level">Nível</th><th class="status">Status</th><th class="last-login">Último login</th></tr></thead><tbody>';
      slice.forEach(function (u) {
        var btns = '<li><a href="' + W.u("users/" + u.id + "/") + '" class="button button-secondary button-small" title="Editar este usuário">Editar</a></li>';
        if (api.userCanDeleteUser(ctx.user, u)) {
          btns += '<li><a href="' + W.u("users/" + u.id + "/delete/") + '" class="button button-secondary button-small no" title="Deletar este usuário">' + W.T.delete + "</a></li>";
        }
        h +=
          '<tr><td class="title" valign="top"><div class="title-wrapper"><span class="avatar small"><img src="' + PG.avatarURL(u) + '" alt="" /></span>' +
          '<a href="' + W.u("users/" + u.id + "/") + '">' + e(u.name) + "</a></div>" +
          '<ul class="actions">' + btns + "</ul></td>" +
          '<td class="cpf_cnpj" valign="top">' + e(RA.fmtCpfCnpj(u.cpf_cnpj)) + "</td>" +
          '<td class="level" valign="top">' + (u.is_superuser ? "Admin" : "") + "</td>" +
          '<td class="status" valign="top"><div class="status-tag ' + (u.is_active ? "primary" : "") + '">' + (u.is_active ? "Ativo" : "Inativo") + "</div></td>" +
          "<td" + (u.last_login ? ' class="human-readable-date" title="' + e(W.djangoShortDateTime(u.last_login)) + '"' : "") + ">" + (u.last_login ? e(W.timesince(u.last_login)) + " atrás" : "") + "</td></tr>";
      });
      h += "</tbody></table>";
      h += W.paginationNav(page, numPages, function (p) {
        return W.u("users/") + "?" + $.param($.extend(isSearching ? { q: q } : {}, { p: p }));
      });
    } else if (isSearching) {
      h += '<h2 role="alert">Desculpe, nenhum usuário coincide com "<em>' + e(q) + '</em>"</h2>';
    } else {
      h += '<p>Não há usuários configurados. Por que não <a href="' + W.u("users/add/") + '">adicionar alguns</a>?</p>';
    }
    return h;
  }

  function adminUsersFiltered(q) {
    return api.adminUsers().then(function (users) {
      users = users.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name, "pt-BR") || String(a.date_joined).localeCompare(String(b.date_joined));
      });
      if (q !== null && q !== undefined && String(q).trim() !== "") {
        var bits = String(q).split(/\s+/).filter(Boolean);
        if (bits.length) {
          users = users.filter(function (u) {
            return bits.some(function (t) {
              t = t.toLowerCase();
              return [u.name, u.email, u.cpf_cnpj].some(function (v) {
                return String(v || "").toLowerCase().indexOf(t) !== -1;
              });
            });
          });
        }
      }
      return users;
    });
  }

  PG.users = function (ctx, query) {
    var q = query.q !== undefined ? query.q : null;
    var page = parseInt(query.p || "1", 10) || 1;
    return adminUsersFiltered(q).then(function (users) {
      var html =
        W.header({
          title: "Administradores",
          icon: "user",
          search: W.headerSearch(q || "", "Buscar"),
          actionUrl: W.u("users/add/"),
          actionText: "Adicionar administrador"
        }).replace('class="  "', 'class="  hasform"') +
        '<div class="nice-padding"><div id="user-results" class="users">' + userResults(ctx, users, q, page) + "</div></div>";
      return {
        title: "Usuários",
        html: html,
        after: function (root) {
          // wagtailadmin/js/core.js window.headerSearch (busca enquanto digita)
          var $input = $(root).find("#id_q");
          var timer = null;
          $input.trigger("focus");
          $input.on("keyup cut paste change", function () {
            clearTimeout(timer);
            timer = setTimeout(function () {
              var v = $input.val();
              if (String(query.q || "").trim() === v.trim()) return;
              query.q = v;
              $input.parent().addClass("icon-spinner");
              adminUsersFiltered(v).then(function (list) {
                $(root).find("#user-results").html(userResults(ctx, list, v, 1)).slideDown(800);
                $input.parent().removeClass("icon-spinner");
                history.replaceState(null, null, W.u("users/") + "?q=" + v);
              });
            }, 200);
          });
          $(root)
            .find("form.search-form")
            .on("submit", function (ev) {
              ev.preventDefault();
            });
        }
      };
    });
  };

  // templates/wagtailusers/users/create.html e edit.html do projeto
  function userForm(ctx, user, values, errors) {
    var editing = !!user;
    var v = values || (user ? { name: user.name, person_type: user.person_type, cpf_cnpj: user.cpf_cnpj, email: user.email } : {});
    errors = errors || {};
    var personSelect =
      '<select name="person_type" required id="id_person_type"><option value=""' + (!v.person_type ? " selected" : "") + ">---------</option>" +
      '<option value="PF"' + (v.person_type === "PF" ? " selected" : "") + ">Pessoa Física</option>" +
      '<option value="PJ"' + (v.person_type === "PJ" ? " selected" : "") + ">Pessoa Jurídica</option></select>";
    var fields =
      PG.simpleField({ name: "name", label: "Nome", value: v.name || "", required: true, errors: errors.name, attrs: ' maxlength="255"' }) +
      W.fieldLi({ id: "id_person_type", label: "Tipo", fieldtype: "typed_choice_field", widgettype: "select", widget: personSelect, required: true, errors: errors.person_type }) +
      PG.simpleField({ name: "cpf_cnpj", label: "CPF ou CNPJ", value: v.cpf_cnpj || "", required: true, errors: errors.cpf_cnpj, attrs: ' maxlength="30"' }) +
      PG.simpleField({ name: "email", type: "email", label: "E-mail", fieldtype: "email_field", value: v.email || "", required: true, errors: errors.email }) +
      PG.simpleField({
        name: "password1",
        type: "password",
        label: "Senha",
        required: !editing,
        errors: errors.password1,
        help: editing ? "Deixe em branco se não estiver alterando." : null,
        helpHtml: editing ? null : api.PASSWORD_HELP_HTML,
        attrs: ' autocomplete="new-password"'
      }) +
      PG.simpleField({
        name: "password2",
        type: "password",
        label: "Confirmação de senha",
        required: !editing,
        errors: errors.password2,
        help: "Digite a mesma senha como acima, para verificação.",
        attrs: ' autocomplete="new-password"'
      }) +
      '<input type="hidden" name="is_superuser" id="id_is_superuser" value="on">';
    var buttons = editing
      ? '<li>\n                <input type="submit" value="Salvar" class="button" />\n                ' +
        (api.userCanDeleteUser(ctx.user, user) ? '<a href="' + W.u("users/" + user.id + "/delete/") + '" class="button button-secondary no">Excluir usuário</a>' : "") +
        "\n            </li>"
      : '<li><button class="button">Adicionar administrador</button></li>';
    var header = editing
      ? W.header({ title: "Editando", subtitle: user.cpf_cnpj, icon: "user", merged: true, tabbed: true })
      : W.header({ title: "Adicionar administrador", icon: "user", merged: true, tabbed: true });
    return (
      header +
      '<form action="#" method="POST" novalidate class="ra-user-form"><div class="tab-content"><input type="hidden" name="csrfmiddlewaretoken" value="local">' +
      '<section id="account" class="active nice-padding"><ul class="fields">' +
      fields +
      buttons +
      "</ul></section></div></form>"
    );
  }

  // templates/wagtailusers/users/includes/user_form_masks.html
  function bindUserMasks(root) {
    function updateLabels() {
      var type = $("#id_person_type", root).val();
      var labelName = $("label[for=id_name]", root);
      var labelCPF = $("label[for=id_cpf_cnpj]", root);
      var cpfField = $("#id_cpf_cnpj", root);
      if (type === "PF") {
        labelName.text("Nome completo:");
        labelCPF.text("CPF:");
        $(cpfField).inputmask("999.999.999-99");
      } else {
        labelName.text("Nome ou razão social:");
        labelCPF.text("CNPJ:");
        cpfField.inputmask("99.999.999/9999-99");
      }
    }
    updateLabels();
    $("#id_person_type", root).on("change", updateLabels);
  }

  PG.userCreate = function (ctx, values, errors, messages) {
    return {
      title: "Adicionar administrador",
      css: ["editor"],
      messages: messages,
      html: userForm(ctx, null, values, errors),
      after: function (root) {
        bindUserMasks(root);
        $(root)
          .find(".ra-user-form")
          .on("submit", function (ev) {
            ev.preventDefault();
            var d = formData(this);
            api
              .saveAdminUser(d, null)
              .then(function (u) {
                W.flash("success", W.messageWithButtons("Usuário '" + u.cpf_cnpj + "' criado.", [[W.u("users/" + u.id + "/"), W.T.edit]]));
                location.hash = W.u("users/");
              })
              .catch(function (err) {
                if (!err || err.name !== "ValidationError") throw err;
                window.ADMIN.renderPage(PG.userCreate(ctx, d, err.errors, [{ level: "error", html: "O usuário não pôde ser criado devido à erros." }]));
              });
          });
      }
    };
  };

  PG.userEdit = function (ctx, id, values, errors, messages) {
    return RA.db.get("users", id).then(function (user) {
      if (!user) throw MA.notFound();
      return {
        title: "Editando " + user.cpf_cnpj,
        css: ["editor"],
        messages: messages,
        html: userForm(ctx, user, values, errors),
        after: function (root) {
          bindUserMasks(root);
          $(root)
            .find(".ra-user-form")
            .on("submit", function (ev) {
              ev.preventDefault();
              var d = formData(this);
              api
                .saveAdminUser(d, user)
                .then(function (u) {
                  W.flash("success", W.messageWithButtons("Usuário '" + u.cpf_cnpj + "' atualizado.", [[W.u("users/" + u.id + "/"), W.T.edit]]));
                  location.hash = W.u("users/");
                })
                .catch(function (err) {
                  if (!err || err.name !== "ValidationError") throw err;
                  PG.userEdit(ctx, id, d, err.errors, [{ level: "error", html: "O usuário não pôde ser salvo devido à erros." }]).then(window.ADMIN.renderPage);
                });
            });
        }
      };
    });
  };

  PG.userDelete = function (ctx, id) {
    return RA.db.get("users", id).then(function (user) {
      if (!user) throw MA.notFound();
      if (!api.userCanDeleteUser(ctx.user, user)) throw MA.denied();
      return {
        title: "Excluir usuário",
        html:
          W.header({ title: "Excluir usuário", subtitle: user.cpf_cnpj, icon: "user" }) +
          '<div class="nice-padding"><p>Tem certeza que deseja excluir este usuário?</p><form action="#" method="POST" class="ra-user-delete">' +
          '<input type="hidden" name="csrfmiddlewaretoken" value="local"><input type="submit" value="Sim, exclua" class="button serious" /></form></div>',
        after: function (root) {
          $(root)
            .find(".ra-user-delete")
            .on("submit", function (ev) {
              ev.preventDefault();
              api.deleteUser(user.id).then(function () {
                W.flash("success", e("Usuário '" + user.cpf_cnpj + "' removido."));
                location.hash = W.u("users/");
              });
            });
        }
      };
    });
  };
})(window, window.jQuery);
