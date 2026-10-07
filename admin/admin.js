/*
 * Painel administrativo do Rastrear AgriFamiliar (réplica do Wagtail em /admin/).
 * Endereços no formato "#/products/batch/" reproduzem "/admin/products/batch/".
 */
(function (window, $) {
  "use strict";

  var RA = window.RA;
  var W = window.W;
  var MA = window.MA;
  var PG = window.PG;
  var FARMER = window.FARMER;
  var api = RA.api;
  var e = RA.esc;
  var ADMIN = (window.ADMIN = {});

  // ------------------------------------------------------------------ contexto da requisição (request.user etc.)
  ADMIN.context = function () {
    return api.ready().then(function () {
      return api.currentUser("admin").then(function (user) {
        if (!user) return null;
        return api.loadIndex().then(function (idx) {
          var profile = user.farmer_profile_id ? idx.farmer_profiles[user.farmer_profile_id] || null : null;
          var sub = profile && profile.subscription_id ? idx.subscriptions[profile.subscription_id] || null : null;
          return {
            user: user,
            profile: profile,
            subscription: sub,
            subscribed: !!profile && ((!!sub && api.subIsActive(sub)) || !!profile.is_demo),
            idx: idx
          };
        });
      });
    });
  };

  // ------------------------------------------------------------------ menu (wagtail_hooks: register_admin_menu_item)
  function menuFor(ctx, path) {
    var u = ctx.user;
    var staff = !!(u.is_staff || u.is_superuser);
    var items = [{ label: "Início", url: W.u(""), icon: "home", order: 0, exact: true }];
    function admin(url, order) {
      var def = MA.find(url, ctx);
      if (def && def.perms.list(ctx)) items.push({ label: def.menuLabel, url: W.u(url), icon: def.icon, order: order || 999 });
    }
    // Ordem de registro: core, farmers, products, farm_journals (INSTALLED_APPS)
    admin("farmers/farmerprofile/");
    if (u.is_farmer) items.push({ label: "Meus dados", url: W.u("p/meus-dados/"), icon: "user", order: 999 });
    if (u.is_farmer) items.push({ label: "Minha assinatura", url: W.u("p/minha-assinatura/"), icon: "shopping-cart", order: 1000 });
    admin("farmers/certificatetype/");
    admin("products/unit/");
    admin("products/product/");
    admin("products/batch/");
    admin("products/batchtag/");
    admin("farm_journals/farmjournal/");
    if (u.is_superuser) items.push({ label: "Administradores", url: W.u("users/"), icon: "user", order: 10000 });
    items = items
      .map(function (it, i) {
        it._i = i;
        return it;
      })
      .sort(function (a, b) {
        return a.order - b.order || a._i - b._i;
      });
    var current = "/" + path;
    items.forEach(function (it) {
      var url = it.url.replace(/^#/, "");
      it.active = it.exact ? current === url : current.indexOf(url) === 0;
    });
    return items;
  }

  // ------------------------------------------------------------------ renderização
  var current = { ctx: null, path: "" };

  ADMIN.renderPage = function (page) {
    if (!page) return;
    var root = document.getElementById("root");
    document.title = "Rastrear AF - " + (page.title || "");
    document.body.className = (page.bodyClass ? page.bodyClass + " " : "") + "focus-outline-on";
    W.setCSS(page.css || []);
    var messages = (page.messages || []).slice();
    var html;
    if (page.furniture) {
      html = '<a class="skiplink button" href="#main" data-skiplink>' + W.T.skip + '</a><div class="wrapper">' + page.html + "</div>";
    } else {
      var ctx = current.ctx;
      messages = W.takeFlash().concat(messages);
      if (messages.length) document.body.classList.add("has-messages");
      html = W.shell({
        menu: menuFor(ctx, current.path),
        userDisplay: api.userFirstName(ctx.user) || ctx.user.cpf_cnpj,
        isFarmer: !!ctx.user.is_farmer,
        messages: messages,
        content: page.html
      });
    }
    // Fecha janelas abertas da página anterior
    $(".jconfirm, .app-modal-overlay, .admin-modal, .xdsoft_datetimepicker").remove();
    $("body").removeClass("modal-open").css("overflow", "");
    root.innerHTML = html;
    W.afterRender(root);
    if (page.after) page.after(root);
    window.scrollTo(0, 0);
  };

  function deniedRedirect() {
    W.flash("error", e(W.T.noPermission));
    location.replace(W.u(""));
  }

  function notFoundPage() {
    // Django (DEBUG=False): página 404 padrão
    document.title = "Not Found";
    document.body.className = "";
    W.setCSS([]);
    document.getElementById("root").innerHTML =
      '<div style="background:#fff;color:#000;font-family:serif;padding:8px;"><h1>Not Found</h1><p>The requested resource was not found on this server.</p></div>';
  }

  function parseHash() {
    var h = location.hash || "";
    if (h.indexOf("#/") !== 0) h = "#/";
    h = h.slice(2);
    var tab = null;
    var ti = h.indexOf("#");
    if (ti !== -1) {
      tab = h.slice(ti);
      h = h.slice(0, ti);
    }
    var qi = h.indexOf("?");
    var path = qi === -1 ? h : h.slice(0, qi);
    var query = {};
    if (qi !== -1) {
      new URLSearchParams(h.slice(qi + 1)).forEach(function (v, k) {
        query[k] = v;
      });
    }
    if (path && path.charAt(path.length - 1) !== "/") path += "/";
    return { path: path, query: query, tab: tab };
  }

  // Guarda a aba ativa no endereço (wagtailadmin/js/core.js usa history.replaceState com o #tab)
  W.onTabShown = function (href) {
    var p = parseHash();
    var base = "#/" + p.path + (Object.keys(p.query).length ? "?" + $.param(p.query) : "");
    history.replaceState(null, null, base + href);
  };

  function restoreTab(tab) {
    if (!tab) return;
    var clean = tab.replace(/[^\w\-#]/g, "");
    var $a = $('.tab-nav a[href="' + clean + '"]');
    if ($a.length) $a.tab("show");
  }

  // ------------------------------------------------------------------ rotas
  function resolve(ctx, r) {
    var path = r.path,
      query = r.query,
      m;
    var u = ctx.user;
    var staff = !!(u.is_staff || u.is_superuser);

    if (path === "") return PG.dashboard(ctx);
    if (path === "account/") return PG.account(ctx);
    if (path === "account/change_name/") return PG.changeName(ctx);
    if (path === "account/change_email/") return PG.changeEmail(ctx);
    if (path === "account/change_password/") return PG.changePassword(ctx);
    if (path === "account/change_avatar/") return PG.changeAvatar(ctx);

    if (path === "p/meus-dados/") {
      if (!u.is_farmer) throw MA.denied();
      return FARMER.meusDados(ctx);
    }
    if (path === "p/minha-assinatura/") {
      if (!u.is_farmer) throw MA.denied();
      return FARMER.subscriptionPage(ctx);
    }

    if (path === "users/") {
      if (!u.is_superuser) throw MA.denied();
      return PG.users(ctx, query);
    }
    if (path === "users/add/") {
      if (!u.is_superuser) throw MA.denied();
      return PG.userCreate(ctx);
    }
    if ((m = /^users\/([\w-]+)\/delete\/$/.exec(path))) {
      if (!u.is_superuser) throw MA.denied();
      return PG.userDelete(ctx, m[1]);
    }
    if ((m = /^users\/([\w-]+)\/$/.exec(path))) {
      if (!u.is_superuser) throw MA.denied();
      return PG.userEdit(ctx, m[1]);
    }

    // Visualização do produtor (equipe)
    if ((m = /^farmers\/farmerprofile\/edit\/([\w-]+)\/$/.exec(path))) {
      if (!staff) throw MA.denied();
      return FARMER.staffView(ctx, m[1]);
    }
    // Caderno (abas e registros)
    if (path === "farm_journals/farmjournal/create/") {
      if (!MA.find("farm_journals/farmjournal/", ctx)) throw MA.denied();
      return FARMER.journalCreate(ctx);
    }
    if ((m = /^farm_journals\/farmjournal\/edit\/([\w-]+)\/$/.exec(path))) {
      if (!MA.find("farm_journals/farmjournal/", ctx)) throw MA.denied();
      return FARMER.journalEdit(ctx, m[1]);
    }

    // Cadastros (modeladmin): <app>/<model>/[create/|edit/<id>/|delete/<id>/]
    if ((m = /^(\w+\/\w+\/)(?:(create)\/|(edit|delete)\/([\w-]+)\/)?$/.exec(path))) {
      var base = m[1];
      var known = MA.admins.some(function (a) {
        return a.url === base;
      });
      if (!known) return null;
      var def = MA.find(base, ctx);
      if (!def) throw MA.denied();
      if (m[2] === "create") return MA.createView(def, ctx);
      if (m[3] === "edit") return MA.editView(def, ctx, m[4]);
      if (m[3] === "delete") return MA.deleteView(def, ctx, m[4]);
      if (!def.perms.list(ctx)) throw MA.denied();
      return MA.indexView(def, ctx, query).then(function (page) {
        if (base === "farmers/farmerprofile/") {
          var after = page.after;
          page.after = function (root) {
            after(root);
            FARMER.bindSettleCharge(root);
          };
        }
        return page;
      });
    }
    return null;
  }

  var routing = 0;
  ADMIN.route = function (force) {
    var r = parseHash();
    var token = ++routing;
    // Links "#main" (pular para o conteúdo) e âncoras internas não são páginas
    if (!force && location.hash && location.hash.indexOf("#/") !== 0) return;

    if (r.path === "logout/") {
      api.logout("admin").then(function () {
        W.takeFlash();
        W.flash("success", "Você foi desconectado com sucesso.");
        location.replace(W.u("login/"));
      });
      return;
    }

    ADMIN.context()
      .then(function (ctx) {
        if (token !== routing) return;
        if (r.path === "password_reset/") return ADMIN.renderPage(PG.passwordReset());
        if (r.path === "password_reset/done/") return ADMIN.renderPage(PG.passwordResetDone());
        var pm = /^password_reset\/confirm\/([\w-]+)\/([\w-]+)\/$/.exec(r.path);
        if (pm) {
          return PG.passwordResetConfirm(pm[1], pm[2]).then(function (page) {
            if (token === routing) ADMIN.renderPage(page);
          });
        }
        if (r.path === "password_reset/complete/") return ADMIN.renderPage(PG.passwordResetComplete());
        if (r.path === "primeiro-acesso/") {
          if (ctx) return location.replace(W.u(""));
          return ADMIN.renderPage(PG.bootstrapAdmin(r.query));
        }
        if (r.path === "login/") {
          if (ctx) return location.replace(W.u(""));
          return ADMIN.renderPage(PG.login(r.query));
        }
        if (!ctx) {
          // require_admin_access -> redirect_to_login
          location.replace(W.u("login/") + "?" + $.param({ next: "#/" + r.path + (Object.keys(r.query).length ? "?" + $.param(r.query) : "") }));
          return;
        }
        current.ctx = ctx;
        current.path = r.path;
        return Promise.resolve()
          .then(function () {
            return resolve(ctx, r);
          })
          .then(function (page) {
            if (token !== routing) return;
            if (!page) return notFoundPage();
            ADMIN.renderPage(page);
            restoreTab(r.tab);
          });
      })
      .catch(function (err) {
        if (err && err.denied) return deniedRedirect();
        if (err && err.notFound) return notFoundPage();
        console.error(err);
        document.getElementById("root").innerHTML =
          '<div style="padding:2em;font-family:sans-serif"><h1>Ocorreu um erro</h1><p>' + e(err && err.message ? err.message : String(err)) + "</p></div>";
      });
  };

  // ------------------------------------------------------------------ início
  W.bindGlobal();
  W.loadSprite();
  window.addEventListener("hashchange", function () {
    ADMIN.route();
  });
  ADMIN.route(true);
})(window, window.jQuery);
