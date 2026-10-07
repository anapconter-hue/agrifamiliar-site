/*
 * Respostas locais da API de cadastro (accounts/urls/farmers.py e accounts/views/farmers.py):
 * /api/auth/validate-access-data/, validate-zip-code/, validate-address-data/ e signup/.
 * Usadas pela página /cadastro/ e pelo painel de reativação da assinatura.
 */
(function (window) {
  "use strict";

  var RA = window.RA;
  var api = RA.api;
  var local = RA.local;

  function handle(promise) {
    return promise
      .then(function (data) {
        return local.json(data === undefined ? null : data, 200);
      })
      .catch(function (err) {
        // As views respondem 400 com a lista de mensagens (RestValidationError)
        if (Array.isArray(err)) return local.json(err, 400);
        throw err;
      });
  }

  local.route("POST", /^\/api\/auth\/validate-access-data\/?$/, function (req) {
    return handle(api.validateAccessData(req.data));
  });

  local.route("POST", /^\/api\/auth\/validate-zip-code\/?$/, function (req) {
    return handle(
      api.lookupZipCode(req.data.zip_code).then(function (a) {
        return { address_street: a.address_street, address_neighborhood: a.address_neighborhood };
      })
    );
  });

  local.route("POST", /^\/api\/auth\/validate-address-data\/?$/, function (req) {
    return handle(api.validateAddressData(req.data));
  });

  local.route("POST", /^\/api\/auth\/signup\/?$/, function (req) {
    return handle(
      api.signup(req.data).then(function () {
        return undefined;
      })
    );
  });

  // Pagar.me Checkout: esta versão ainda não tem cobrança ligada, então o cartão não é pedido
  // e o cadastro segue como se o cartão tivesse sido informado.
  window.PagarMeCheckout = window.PagarMeCheckout || {
    Checkout: function (opts) {
      this.open = function () {
        setTimeout(function () {
          opts.success({ card_hash: "local" });
        }, 0);
      };
    }
  };
})(window);
