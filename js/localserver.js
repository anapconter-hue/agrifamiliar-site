/*
 * "Servidor local": responde, dentro do navegador, aos endereços de API do sistema
 * original (/api/..., /admin/products/farmer-batch-tags/ etc.). Assim os scripts
 * originais do painel (troca de plano, tabelas Vue, cadastro, alteração de senha)
 * funcionam sem modificação. Intercepta window.fetch e as requisições do jQuery.
 */
(function (window) {
  "use strict";

  var RA = window.RA;
  var routes = [];
  var local = (RA.local = {});

  local.route = function (method, pattern, handler) {
    routes.push({ method: method.toUpperCase(), re: pattern, handler: handler });
  };

  function pathOf(url) {
    try {
      return new URL(url, window.location.href).pathname;
    } catch (e) {
      return url;
    }
  }

  function queryOf(url) {
    try {
      var u = new URL(url, window.location.href);
      var q = {};
      u.searchParams.forEach(function (v, k) {
        q[k] = v;
      });
      return q;
    } catch (e) {
      return {};
    }
  }

  // Remove o caminho base (site publicado em subpasta) antes de comparar
  function normalize(path) {
    var base = RA.base.replace(/\/$/, "");
    if (base && path.indexOf(base + "/") === 0) path = path.slice(base.length);
    return path;
  }

  function match(method, url) {
    var path = normalize(pathOf(url));
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      if (r.method !== method.toUpperCase() && r.method !== "*") continue;
      var m = r.re.exec(path);
      if (m) return { route: r, match: m, path: path };
    }
    return null;
  }

  function parseBody(body, contentType) {
    if (body === null || body === undefined || body === "") return {};
    if (typeof body === "object" && !(body instanceof URLSearchParams)) return body;
    var s = String(body);
    if ((contentType || "").indexOf("json") !== -1 || /^\s*[{[]/.test(s)) {
      try {
        return JSON.parse(s);
      } catch (e) {}
    }
    var out = {};
    new URLSearchParams(s).forEach(function (v, k) {
      if (out[k] === undefined) out[k] = v;
      else if (Array.isArray(out[k])) out[k].push(v);
      else out[k] = [out[k], v];
    });
    return out;
  }

  function run(m, method, url, body, contentType) {
    var req = { method: method, url: url, path: m.path, params: m.match, query: queryOf(url), data: parseBody(body, contentType) };
    return Promise.resolve()
      .then(function () {
        return RA.api.ready();
      })
      .then(function () {
        return m.route.handler(req);
      })
      .then(function (res) {
        res = res || {};
        var status = res.status || 200;
        var isJson = res.json !== undefined;
        return {
          status: status,
          body: isJson ? JSON.stringify(res.json) : res.html !== undefined ? res.html : res.text || "",
          contentType: isJson ? "application/json" : res.html !== undefined ? "text/html; charset=utf-8" : "text/plain"
        };
      })
      .catch(function (err) {
        console.error(err);
        var msg = err && err.message ? err.message : "Ocorreu um erro.";
        if (Array.isArray(err)) return { status: 400, body: JSON.stringify(err), contentType: "application/json" };
        return { status: err && err.name === "ValidationError" ? 400 : 500, body: JSON.stringify([msg]), contentType: "application/json" };
      });
  }

  // fetch -------------------------------------------------------------
  var originalFetch = window.fetch.bind(window);
  local.originalFetch = originalFetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input.url;
    var method = (init && init.method) || (typeof input !== "string" && input.method) || "GET";
    var m = match(method, url);
    if (!m) return originalFetch(input, init);
    var headers = (init && init.headers) || {};
    var ct = headers["Content-Type"] || headers["content-type"] || "";
    return run(m, method, url, init && init.body, ct).then(function (r) {
      return new Response(r.body, { status: r.status, headers: { "Content-Type": r.contentType } });
    });
  };

  // jQuery ------------------------------------------------------------
  local.installJQuery = function ($) {
    if (!$ || $.__raLocal) return;
    $.__raLocal = true;
    var originalAjax = $.ajax;
    $.ajax = function (url, options) {
      if (typeof url === "object") {
        options = url;
        url = options.url;
      }
      options = options || {};
      var method = String(options.method || options.type || "GET").toUpperCase();
      var data = options.data;
      if (method === "GET" && data && typeof data === "object") {
        url += (url.indexOf("?") === -1 ? "?" : "&") + $.param(data);
        data = null;
      }
      var m = match(method, url);
      if (!m) return originalAjax.apply($, arguments);
      var d = $.Deferred();
      run(m, method, url, data, options.contentType).then(function (r) {
        var json;
        try {
          json = JSON.parse(r.body);
        } catch (e) {}
        var xhr = {
          status: r.status,
          responseText: r.body,
          responseJSON: json,
          getResponseHeader: function () {
            return r.contentType;
          }
        };
        var payload = r.contentType.indexOf("json") !== -1 ? json : r.body;
        if (r.status < 400) {
          if (options.success) options.success.call(options.context || window, payload, "success", xhr);
          d.resolve(payload, "success", xhr);
        } else {
          if (options.error) options.error.call(options.context || window, xhr, "error", "");
          d.reject(xhr, "error", "");
        }
        if (options.complete) options.complete.call(options.context || window, xhr, r.status < 400 ? "success" : "error");
      });
      var p = d.promise();
      p.abort = function () {};
      return p;
    };
  };
  if (window.jQuery) local.installJQuery(window.jQuery);

  local.json = function (data, status) {
    return { json: data, status: status || 200 };
  };
  local.html = function (html, status) {
    return { html: html, status: status || 200 };
  };
})(window);
