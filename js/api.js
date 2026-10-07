/*
 * Rastrear AgriFamiliar - regras de negócio e acesso aos dados.
 * Reproduz os models, managers, mixins e validações do sistema original (Django)
 * usando o banco de dados local do navegador (RA.db).
 */
(function (window) {
  "use strict";

  var RA = window.RA;
  var db = RA.db;
  var api = (RA.api = {});

  // "local" (banco do navegador) ou "supabase" (js/backend-supabase.js substitui as funções)
  api.backend = "local";

  // ------------------------------------------------------------------ erros
  function ValidationError(errors, message) {
    this.name = "ValidationError";
    this.errors = errors || {}; // { campo: [mensagens] } ; "__all__" para erros gerais
    this.message = message || firstMessage(this.errors);
  }
  ValidationError.prototype = Object.create(Error.prototype);
  api.ValidationError = ValidationError;

  function firstMessage(errors) {
    for (var k in errors) {
      if (errors[k] && errors[k].length) return errors[k][0];
    }
    return "";
  }

  api.REQUIRED = "Este campo é obrigatório.";
  api.INVALID_DATE = "Informe uma data válida.";
  api.INVALID_EMAIL = "Informe um endereço de email válido.";

  api.isISODate = function (v) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  };

  function addErr(errors, field, msg) {
    (errors[field] = errors[field] || []).push(msg);
  }

  function blank(v) {
    return v === null || v === undefined || String(v).trim() === "";
  }

  // ------------------------------------------------------------------ sessão
  var SESSION_KEYS = { admin: "ra_session_admin", app: "ra_session_app" };

  api.session = {
    get: function (scope) {
      try {
        return JSON.parse(localStorage.getItem(SESSION_KEYS[scope || "admin"]) || "null");
      } catch (e) {
        return null;
      }
    },
    set: function (scope, userId) {
      localStorage.setItem(SESSION_KEYS[scope], JSON.stringify({ userId: userId, at: RA.nowISO() }));
    },
    clear: function (scope) {
      localStorage.removeItem(SESSION_KEYS[scope]);
    }
  };

  // ------------------------------------------------------------------ inicialização
  var ready = null;
  api.ready = function () {
    if (!ready) {
      ready = RA.seed ? RA.seed.ensure() : Promise.resolve();
    }
    return ready;
  };

  // ------------------------------------------------------------------ assinaturas (subscriptions/models)
  api.SUB = {
    PAID: "paid",
    TRIALING: "trialing",
    PENDING_PAYMENT: "pending_payment",
    UNPAID: "unpaid",
    CANCELED: "canceled"
  };

  api.SUB_STATUS = [
    ["trialing", "Período gratuito"],
    ["paid", "Pagamento em dia"],
    ["pending_payment", "Pagamento pendente"],
    ["unpaid", "Pagamento expirado"],
    ["canceled", "Cancelada"]
  ];

  api.TRANSACTION_STATUS = [
    ["paid", "Paga"],
    ["waiting_payment", "Pagamento pendente"],
    ["refused", "Não autorizada"]
  ];

  function choice(list, value) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === value) return list[i][1];
    return value || "";
  }

  api.plans = function () {
    return RA.config.SUBSCRIPTION_PLANS || [];
  };

  api.getPlans = function (hasTrialDays) {
    if (hasTrialDays === undefined) hasTrialDays = true;
    return api.plans().filter(function (p) {
      return p.has_trial_days === hasTrialDays;
    });
  };

  api.planName = function (planId) {
    var p = api.plans().filter(function (x) {
      return x.plan_id === String(planId);
    })[0];
    return p ? p.name : "";
  };

  api.paymentMethodName = function (pm) {
    var m = (RA.config.SUBSCRIPTION_PAYMENT_METHODS || []).filter(function (x) {
      return x.payment_method === pm;
    })[0];
    return m ? m.name : pm || "";
  };

  api.subStatusDisplay = function (s) {
    return choice(api.SUB_STATUS, s && s.status);
  };

  api.transactionStatusDisplay = function (st) {
    return choice(api.TRANSACTION_STATUS, st);
  };

  api.subIsActive = function (s) {
    if (!s) return false;
    var S = api.SUB;
    return (
      [S.TRIALING, S.PENDING_PAYMENT, S.PAID].indexOf(s.status) !== -1 ||
      (s.status === S.CANCELED && !!s.current_period_end && new Date(s.current_period_end) > new Date())
    );
  };

  api.subWillBeBlocked = function (s) {
    return !!s && (s.status === api.SUB.UNPAID || s.status === api.SUB.CANCELED);
  };

  api.subCanManage = function (s) {
    return !!s && s.status !== api.SUB.CANCELED;
  };

  api.subCanSettle = function (s) {
    return !!s && [api.SUB.PENDING_PAYMENT, api.SUB.UNPAID].indexOf(s.status) !== -1;
  };

  // Cria a assinatura local (no original era criada no Pagar.me).
  api.createSubscription = function (data) {
    var plan = api.plans().filter(function (p) {
      return p.plan_id === String(data.plan_id);
    })[0];
    if (!plan) return Promise.reject(new ValidationError({ __all__: ["Plano inválido."] }));
    var now = new Date();
    var trial = plan.trial_days || 0;
    var periodEnd = RA.addDays(now, trial > 0 ? trial : plan.days);
    var sub = {
      id: RA.uuid(),
      status: trial > 0 ? api.SUB.TRIALING : api.SUB.PENDING_PAYMENT,
      subscription_id: String(Math.floor(100000 + Math.random() * 900000)),
      plan: plan.plan_id,
      payment_method: data.payment_method,
      date_created: now.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      card_brand: null,
      card_last_digits: null,
      customer_address_street: data.address_street || "",
      customer_address_street_number: data.address_street_number || "",
      customer_address_extra: data.address_extra || null,
      customer_address_neighborhood: data.address_neighborhood || "",
      customer_address_zipcode: RA.removeMask(data.address_zipcode || ""),
      customer_phone_ddd: data.phone_ddd || "",
      customer_phone_number: RA.removeMask(data.phone_number || ""),
      current_transaction_boleto_url: null,
      manage_url: null
    };
    return db.put("subscriptions", sub);
  };

  // subscriptions/utils.py change_subscription_plan
  api.changeSubscriptionPlan = function (sub, newPlanId) {
    if (String(sub.plan) === String(newPlanId)) {
      return Promise.reject(new ValidationError({ __all__: ["Não foi possível alterar o seu plano. Por gentileza, tente novamente mais tarde."] }));
    }
    sub.plan = String(newPlanId);
    return db.put("subscriptions", sub);
  };

  // subscriptions/utils.py settle_charge (Marcar assinatura como paga)
  api.settleCharge = function (subscriptionId) {
    return db.all("subscriptions").then(function (list) {
      var sub = list.filter(function (s) {
        return String(s.subscription_id) === String(subscriptionId);
      })[0];
      if (!sub || sub.status === api.SUB.PAID || sub.status === api.SUB.CANCELED) {
        throw new ValidationError({ __all__: ["Não foi possível marcar esta assinatura como paga. Por gentileza, tente novamente mais tarde."] });
      }
      var plan = api.plans().filter(function (p) {
        return p.plan_id === String(sub.plan);
      })[0];
      sub.status = api.SUB.PAID;
      sub.current_period_start = new Date().toISOString();
      sub.current_period_end = RA.addDays(new Date(), plan ? plan.days : 180).toISOString();
      return db
        .put("subscriptions", sub)
        .then(function () {
          return db.put("transactions", {
            id: RA.uuid(),
            subscription_id: sub.id,
            status: "paid",
            date_created: new Date().toISOString(),
            payment_method: sub.payment_method,
            amount: (plan ? plan.amount : 0) * 100,
            boleto_url: null
          });
        })
        .then(function () {
          return sub;
        });
    });
  };

  api.cancelSubscription = function (sub) {
    sub.status = api.SUB.CANCELED;
    return db.put("subscriptions", sub);
  };

  // Troca da forma de pagamento (no original era feita na página do Pagar.me)
  api.setSubscriptionPaymentMethod = function (sub, method) {
    sub.payment_method = method;
    return db.put("subscriptions", sub);
  };

  api.subscriptionTransactions = function (sub) {
    if (!sub) return Promise.resolve([]);
    return db.all("transactions").then(function (list) {
      return list
        .filter(function (t) {
          return t.subscription_id === sub.id;
        })
        .sort(function (a, b) {
          return a.date_created < b.date_created ? 1 : -1;
        });
    });
  };

  // ------------------------------------------------------------------ usuários (accounts)
  api.getUser = function (id) {
    return db.get("users", id);
  };

  api.users = function () {
    return db.all("users");
  };

  api.findUserByCpfCnpj = function (cpfCnpj) {
    var d = RA.removeMask(cpfCnpj || "");
    return db.all("users").then(function (list) {
      return (
        list.filter(function (u) {
          return u.cpf_cnpj === d;
        })[0] || null
      );
    });
  };

  api.userFirstName = function (u) {
    if (!u) return "";
    if (u.person_type === "PF") return (u.name || "").split(" ")[0];
    return u.name || "";
  };

  api.setPassword = function (user, password) {
    return RA.hashPassword(password).then(function (h) {
      user.password_hash = h.hash;
      user.password_salt = h.salt;
      return db.put("users", user);
    });
  };

  // Sessão e login ----------------------------------------------------
  api.currentUser = function (scope) {
    var s = api.session.get(scope);
    if (!s) return Promise.resolve(null);
    return db.get("users", s.userId).then(function (u) {
      if (!u || !u.is_active) {
        api.session.clear(scope);
        return null;
      }
      return u;
    });
  };

  // Login do painel web (Wagtail): CPF/CNPJ + senha.
  api.loginAdmin = function (username, password) {
    return api.findUserByCpfCnpj(username).then(function (u) {
      return RA.checkPassword(password, u).then(function (ok) {
        if (!u || !ok || !u.is_active || !(u.is_staff || u.is_superuser || u.is_farmer)) {
          throw new ValidationError({ __all__: ["Dados de acesso inválidos. Por favor, tente novamente."] });
        }
        u.last_login = RA.nowISO();
        return db.put("users", u).then(function () {
          api.session.set("admin", u.id);
          return u;
        });
      });
    });
  };

  // Login do app (oauth_validators.py): exige produtor com assinatura ativa.
  api.loginApp = function (username, password) {
    return api.findUserByCpfCnpj(username).then(function (u) {
      return RA.checkPassword(password, u).then(function (ok) {
        if (!u || !ok || !u.is_active || !u.is_farmer) {
          var e = new ValidationError({ __all__: ["invalid"] });
          e.authenticationFailed = true;
          throw e;
        }
        return api.profileForUser(u).then(function (p) {
          return api.isSubscribed(p).then(function (sub) {
            if (!sub) {
              var e2 = new ValidationError({ __all__: ["invalid"] });
              e2.authenticationFailed = true;
              throw e2;
            }
            api.session.set("app", u.id);
            return u;
          });
        });
      });
    });
  };

  api.logout = function (scope) {
    api.session.clear(scope);
    return Promise.resolve();
  };

  // accounts/views/farmers.py change_password
  api.changePassword = function (user, currentPassword, newPassword) {
    return RA.checkPassword(currentPassword, user).then(function (ok) {
      if (!ok)
        throw new ValidationError({
          current_password: ["A senha atual informada está incorreta. Por gentileza, verifique e tente novamente."]
        });
      if (blank(newPassword)) throw new ValidationError({ new_password: ["A nova senha não pode ser vazia. Por gentileza, verifique e tente novamente."] });
      return api.setPassword(user, newPassword);
    });
  };

  // accounts/views/farmers.py reset_password (sem servidor de e-mail no modo local)
  api.resetPassword = function (cpfCnpj) {
    return api.findUserByCpfCnpj(cpfCnpj).then(function (u) {
      if (!u) {
        var e = new ValidationError({ __all__: ["Não foi possível recuperar a senha para o CPF/CNPJ informado. Por gentileza, verifique e tente novamente."] });
        e.userNotFound = true;
        throw e;
      }
      return { masked_email: RA.maskEmail(u.email), email_backend: false };
    });
  };

  // wagtailadmin password_reset: envia o link por e-mail (o modo local não envia e-mails)
  api.requestPasswordReset = function () {
    return Promise.resolve({ email_backend: false });
  };

  // Link de redefinição (/admin/password_reset/confirm/<uidb64>/<token>/): só existe com o Supabase
  api.passwordResetCheck = function () {
    return Promise.resolve(false);
  };

  api.passwordResetConfirm = function () {
    var e = new ValidationError({});
    e.invalidLink = true;
    return Promise.reject(e);
  };

  // Primeiro administrador (código de instalação): só existe com o Supabase
  api.bootstrapAdmin = function () {
    return Promise.reject(new ValidationError({ __all__: ["Disponível apenas com o banco de dados do Supabase."] }));
  };

  // ------------------------------------------------------------------ produtores (farmers)
  api.getProfile = function (id) {
    return db.get("farmer_profiles", id);
  };

  api.profileForUser = function (user) {
    if (!user || !user.farmer_profile_id) return Promise.resolve(null);
    return db.get("farmer_profiles", user.farmer_profile_id);
  };

  api.userForProfile = function (profileId) {
    return db.all("users").then(function (list) {
      return (
        list.filter(function (u) {
          return u.farmer_profile_id === profileId;
        })[0] || null
      );
    });
  };

  api.subscriptionForProfile = function (profile) {
    if (!profile || !profile.subscription_id) return Promise.resolve(null);
    return db.get("subscriptions", profile.subscription_id);
  };

  // FarmerProfileMixin.is_subscribed -> devolve a assinatura (ou objeto demo) quando ativa
  api.isSubscribed = function (profile) {
    if (!profile) return Promise.resolve(false);
    return api.subscriptionForProfile(profile).then(function (s) {
      if (profile.is_demo) return s || { demo: true };
      return api.subIsActive(s) ? s : false;
    });
  };

  api.farmsForProfile = function (profileId) {
    return db.all("farms").then(function (list) {
      return list
        .filter(function (f) {
          return f.farmer_profile_id === profileId;
        })
        .sort(function (a, b) {
          return a.name.localeCompare(b.name, "pt-BR");
        });
    });
  };

  api.technicalManagersForProfile = function (profileId) {
    return db.all("technical_managers").then(function (list) {
      return list
        .filter(function (t) {
          return t.farmer_profile_id === profileId;
        })
        .sort(function (a, b) {
          return a.name.localeCompare(b.name, "pt-BR");
        });
    });
  };

  api.certificatesForProfile = function (profileId) {
    return Promise.all([db.all("certificates"), db.all("certificate_types")]).then(function (r) {
      var types = {};
      r[1].forEach(function (t) {
        types[t.id] = t;
      });
      return r[0]
        .filter(function (c) {
          return c.farmer_profile_id === profileId;
        })
        .map(function (c) {
          c.certificate_type = types[c.certificate_type_id] || null;
          return c;
        })
        .sort(function (a, b) {
          return String(a.certifier || "").localeCompare(String(b.certifier || ""), "pt-BR");
        });
    });
  };

  // FarmerProfileMixin.get_active_certificates
  api.activeCertificatesForProfile = function (profileId) {
    return api.certificatesForProfile(profileId).then(function (list) {
      return list.filter(function (c) {
        return c.certificate_type && c.certificate_type.is_active;
      });
    });
  };

  // CertificateManager.filter_by_farm (certificados válidos para lote)
  api.validCertificatesForProfile = function (profileId) {
    var today = RA.today();
    return api.activeCertificatesForProfile(profileId).then(function (list) {
      return list.filter(function (c) {
        return !c.valid_until_date || c.valid_until_date >= today;
      });
    });
  };

  api.hasIncompleteProfile = function (profile) {
    return api.farmsForProfile(profile.id).then(function (farms) {
      return farms.length === 0;
    });
  };

  api.isIncomplete = function (profile) {
    return api.farmsForProfile(profile.id).then(function (farms) {
      return (
        !profile.birth_date ||
        !profile.telephone ||
        !profile.description ||
        !profile.logo_image ||
        !profile.profile_image ||
        farms.length === 0
      );
    });
  };

  // Textos (__str__) ---------------------------------------------------
  api.str = {
    profile: function (user) {
      return user ? user.name + " (" + RA.fmtCpfCnpj(user.cpf_cnpj) + ")" : "";
    },
    technicalManager: function (t) {
      return t ? t.name + " (" + t.number + " - " + t.number_type + ")" : "";
    },
    certificate: function (c) {
      if (!c) return "";
      var certifier = " ";
      if (c.certifier && String(c.certifier).trim() !== "") certifier = " (" + c.certifier + ") - ";
      return (c.number || "") + certifier + (c.certificate_type ? c.certificate_type.name : "");
    },
    unit: function (u) {
      return u ? u.name + " (" + u.symbol + ")" : "";
    },
    product: function (p) {
      return p ? p.name + " (" + p.variety + ")" : "";
    },
    productFullName: function (p) {
      return p ? p.name + " " + p.variety : "";
    }
  };

  // FarmMixin
  api.farmAddress = function (farm, withZip) {
    var t = "";
    if (farm.street) t += farm.street;
    if (farm.number) t += ", " + farm.number;
    if (farm.extra) t += ", " + farm.extra;
    if (farm.neighborhood) t += " - " + farm.neighborhood;
    if (farm.city_id) t += ", " + RA.cityName(farm.city_id);
    if (farm.state_id) t += " - " + farm.state_id;
    if (withZip !== false && farm.zip_code) t += ", CEP " + RA.fmtCEP(farm.zip_code);
    return t;
  };

  api.farmHasCoordinates = function (farm) {
    return !!farm && !!farm.latitude && !!farm.longitude;
  };

  // ------------------------------------------------------------------ validação de CPF/CNPJ do perfil
  // core/utils.py is_cpf_valid / is_cnpj_valid (validação do servidor; diferente da do app,
  // por exemplo aceita "111.111.111-11")
  api.isCpfValid = function (cpf) {
    cpf = String(cpf || "");
    if (cpf.length !== 11 || !/^\d+$/.test(cpf)) return false;
    var inteiros = cpf.split("").map(Number);
    var novo = inteiros.slice(0, 9);
    while (novo.length < 11) {
      var s = 0;
      for (var i = 0; i < novo.length; i++) s += (novo.length + 1 - i) * novo[i];
      var r = s % 11;
      novo.push(r > 1 ? 11 - r : 0);
    }
    return novo.join("") === inteiros.join("");
  };

  api.isCnpjValid = function (cnpj) {
    cnpj = String(cnpj || "");
    if (cnpj.length !== 14 || !/^\d+$/.test(cnpj)) return false;
    var inteiros = cnpj.split("").map(Number);
    var novo = inteiros.slice(0, 12);
    var prod = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    while (novo.length < 14) {
      var s = 0;
      for (var i = 0; i < Math.min(novo.length, prod.length); i++) s += novo[i] * prod[i];
      var r = s % 11;
      novo.push(r > 1 ? 11 - r : 0);
      prod.unshift(6);
    }
    return novo.join("") === inteiros.join("");
  };

  // Outro usuário já usa este CPF/CNPJ ou e-mail? (validação de unicidade dos formulários)
  // opts.emailCaseInsensitive: compara o e-mail sem diferenciar maiúsculas.
  api.uniqueConflicts = function (userId, cpf, email, opts) {
    opts = opts || {};
    email = String(email || "").trim();
    return db.all("users").then(function (all) {
      var r = { cpf_cnpj: false, email: false };
      all.forEach(function (o) {
        if (o.id === userId) return;
        if (cpf && o.cpf_cnpj === cpf) r.cpf_cnpj = true;
        if (email && o.email && (opts.emailCaseInsensitive ? o.email.toLowerCase() === email.toLowerCase() : o.email === email)) r.email = true;
      });
      return r;
    });
  };

  // core/utils.py validate_cpf_cnpj
  api.validateCpfCnpj = function (personType, cpfCnpj) {
    if (personType === "PF" && !api.isCpfValid(cpfCnpj)) return "O CPF informado não é um CPF válido.";
    if (personType === "PJ" && !api.isCnpjValid(cpfCnpj)) return "O CNPJ informado não é um CNPJ válido.";
    return null;
  };

  // Salva "Meus dados" (FarmerProfileDataModelAdmin): usuário, perfil, propriedades,
  // responsáveis técnicos e certificados.
  api.saveFarmerData = function (userId, data) {
    var errors = {};
    var u = data.user;
    if (blank(u.person_type)) addErr(errors, "user.person_type", api.REQUIRED);
    if (blank(u.name)) addErr(errors, "user.name", api.REQUIRED);
    if (blank(u.cpf_cnpj)) addErr(errors, "user.cpf_cnpj", api.REQUIRED);
    if (blank(u.email)) addErr(errors, "user.email", api.REQUIRED);
    else if (!RA.isEmail(u.email)) addErr(errors, "user.email", "Informe um endereço de email válido.");
    var cpf = RA.removeMask(u.cpf_cnpj || "");
    // FarmerProfileAdminModelForm.clean: valida o CPF/CNPJ conforme o tipo de pessoa
    if (u.person_type === "PF" || u.person_type === "PJ") {
      var ce = api.validateCpfCnpj(u.person_type, cpf);
      if (ce) addErr(errors, "user.cpf_cnpj", ce);
    }
    var p0 = data.profile || {};
    if (!blank(p0.birth_date) && !api.isISODate(p0.birth_date)) addErr(errors, "profile.birth_date", api.INVALID_DATE);

    var farms = (data.farms || []).filter(function (f) {
      return !f._delete;
    });
    if (farms.length < 1) addErr(errors, "farms.__all__", "Por favor, envie 1 ou mais formulários.");
    (data.farms || []).forEach(function (f, i) {
      if (f._delete) return;
      ["name", "street", "neighborhood", "state_id", "city_id", "zip_code"].forEach(function (k) {
        if (blank(f[k])) addErr(errors, "farms." + i + "." + k, api.REQUIRED);
      });
      if (blank(f.total_hectares)) addErr(errors, "farms." + i + ".total_hectares", api.REQUIRED);
      else if (RA.parseNumber(f.total_hectares) === null) addErr(errors, "farms." + i + ".total_hectares", "Informe um número.");
    });
    (data.technical_managers || []).forEach(function (t, i) {
      if (t._delete) return;
      ["name", "number", "number_type"].forEach(function (k) {
        if (blank(t[k])) addErr(errors, "technical_managers." + i + "." + k, api.REQUIRED);
      });
    });
    (data.certificates || []).forEach(function (c, i) {
      if (c._delete) return;
      if (!blank(c.valid_until_date) && !api.isISODate(c.valid_until_date))
        addErr(errors, "certificates." + i + ".valid_until_date", api.INVALID_DATE);
      if (blank(c.certificate_type_id)) addErr(errors, "certificates." + i + ".certificate_type_id", api.REQUIRED);
    });

    return Promise.all([api.uniqueConflicts(userId, cpf, u.email), db.get("users", userId)]).then(function (r) {
      var dup = r[0],
        user = r[1];
      // O CPF só é comparado depois de validado (FarmerProfileAdminModelForm.clean)
      if (dup.cpf_cnpj && !(errors["user.cpf_cnpj"] || []).length)
        addErr(errors, "user.cpf_cnpj", "Já existe um usuário cadastrado com esse CPF ou CNPJ");
      if (dup.email && !(errors["user.email"] || []).length) addErr(errors, "user.email", "User com este Email já existe.");
      if (Object.keys(errors).length) throw new ValidationError(errors);

      // Propriedades protegidas (lotes ou cadernos associados: on_delete=PROTECT)
      var toDeleteFarms = (data.farms || []).filter(function (f) {
        return f._delete && f.id;
      });
      return Promise.all([db.all("batches"), db.all("farm_journals"), db.get("farmer_profiles", user.farmer_profile_id)]).then(function (rr) {
        var profile = rr[2];
        var protectedFarm = toDeleteFarms.some(function (f) {
          return (
            rr[0].some(function (b) {
              return b.farm_id === f.id;
            }) ||
            rr[1].some(function (j) {
              return j.farm_id === f.id;
            })
          );
        });

        user.person_type = u.person_type;
        user.name = String(u.name).trim();
        user.cpf_cnpj = cpf;
        user.email = String(u.email).trim();
        var p = data.profile || {};
        profile.birth_date = p.birth_date || null;
        profile.telephone = RA.removeMask(p.telephone || "");
        profile.description = blank(p.description) ? null : p.description;
        if (p.logo_image !== undefined) profile.logo_image = p.logo_image;
        if (p.logo_image_name !== undefined) profile.logo_image_name = p.logo_image_name;
        if (p.profile_image !== undefined) profile.profile_image = p.profile_image;
        if (p.profile_image_name !== undefined) profile.profile_image_name = p.profile_image_name;

        if (protectedFarm) {
          // No original o perfil e o usuário eram gravados antes de a exclusão da
          // propriedade falhar (sem transação); as demais alterações eram perdidas.
          return Promise.all([db.put("farmer_profiles", profile), db.put("users", user)]).then(function () {
            var pe = new ValidationError({
              __all__: [
                "A propriedade não pôde ser excluída porque existem lotes associados a ela. Para cancelar as alterações, apenas atualize a página."
              ]
            });
            pe.protected = true;
            throw pe;
          });
        }

        return Promise.resolve(profile).then(function (profile) {
          var ops = [db.put("users", user), db.put("farmer_profiles", profile)];
          (data.farms || []).forEach(function (f, i) {
            if (f._delete) {
              if (f.id) ops.push(db.del("farms", f.id));
              return;
            }
            // O original só removia a máscara do CEP do primeiro formulário ("farm_set-0-zip_code")
            ops.push(
              db.put("farms", {
                id: f.id || RA.uuid(),
                farmer_profile_id: profile.id,
                name: String(f.name).trim(),
                street: f.street || null,
                number: f.number || null,
                neighborhood: f.neighborhood || null,
                extra: f.extra || "",
                city_id: f.city_id,
                state_id: f.state_id,
                latitude: f.latitude === "" || f.latitude === null || f.latitude === undefined ? null : Number(f.latitude),
                longitude: f.longitude === "" || f.longitude === null || f.longitude === undefined ? null : Number(f.longitude),
                zip_code: i === 0 ? RA.removeMask(f.zip_code || "") : String(f.zip_code || "").trim(),
                ccir: f.ccir || null,
                total_hectares: RA.parseNumber(f.total_hectares)
              })
            );
          });
          (data.technical_managers || []).forEach(function (t) {
            if (t._delete) {
              if (t.id) ops.push(db.del("technical_managers", t.id));
              return;
            }
            ops.push(
              db.put("technical_managers", {
                id: t.id || RA.uuid(),
                farmer_profile_id: profile.id,
                name: t.name,
                number: t.number,
                number_type: t.number_type
              })
            );
          });
          (data.certificates || []).forEach(function (c) {
            if (c._delete) {
              if (c.id) ops.push(api.deleteCertificate(c.id));
              return;
            }
            ops.push(
              db.put("certificates", {
                id: c.id || RA.uuid(),
                farmer_profile_id: profile.id,
                certifier: c.certifier || null,
                number: c.number || null,
                certificate_type_id: c.certificate_type_id,
                valid_until_date: c.valid_until_date || null
              })
            );
          });
          return Promise.all(ops).then(function () {
            return { user: user, profile: profile };
          });
        });
      });
    });
  };

  // Remove um certificado e tira a referência dos lotes (ManyToMany).
  api.deleteCertificate = function (id) {
    return db.all("batches").then(function (batches) {
      var ops = [];
      batches.forEach(function (b) {
        if ((b.certificate_ids || []).indexOf(id) !== -1) {
          b.certificate_ids = b.certificate_ids.filter(function (x) {
            return x !== id;
          });
          ops.push(db.put("batches", b));
        }
      });
      ops.push(db.del("certificates", id));
      return Promise.all(ops);
    });
  };

  // Atualização de perfil pelo app (api/farmers/user-profile/)
  api.updateUserProfile = function (userId, data) {
    var errors = {};
    var cpf = RA.removeMask(data.cpf_cnpj || "");
    var e = api.validateCpfCnpj(data.person_type, cpf);
    if (e) addErr(errors, "cpf_cnpj", e);
    if (!RA.isEmail(data.email)) addErr(errors, "email", "Informe um endereço de email válido.");
    if (blank(data.name)) addErr(errors, "name", api.REQUIRED);
    return api.uniqueConflicts(userId, cpf, data.email, { emailCaseInsensitive: true }).then(function (dup) {
      if (dup.cpf_cnpj) addErr(errors, "cpf_cnpj", "Já existe um usuário cadastrado com esse CPF ou CNPJ.");
      if (dup.email) addErr(errors, "email", "Já existe um usuário cadastrado com esse e-mail.");
      if (Object.keys(errors).length) throw new ValidationError(errors);
      return db.get("users", userId).then(function (user) {
        user.person_type = data.person_type;
        user.name = data.name;
        user.cpf_cnpj = cpf;
        user.email = data.email;
        return db.put("users", user);
      });
    });
  };

  // ------------------------------------------------------------------ cadastro (accounts/views signup)
  api.validateAccessData = function (d) {
    var cpf = RA.removeMask(d.cpf_cnpj || "");
    return db.all("users").then(function (all) {
      var unique = all.some(function (o) {
        return o.cpf_cnpj === cpf || (o.email && d.email && o.email.toLowerCase() === String(d.email).toLowerCase());
      });
      if (unique) throw ["Você já está cadastrado no Rastrear AgriFamiliar."];
      if (
        blank(d.person_type) ||
        blank(d.name) ||
        blank(d.password) ||
        !RA.isEmail(d.email) ||
        api.validateCpfCnpj(d.person_type, cpf) !== null
      ) {
        throw ["Não foi possível seguir com o seu cadastro. Por gentileza, verifique os seus dados e tente novamente."];
      }
    });
  };

  // Consulta de CEP (no original: api.pagar.me/1/zipcodes). Usa o serviço público ViaCEP.
  api.lookupZipCode = function (zip) {
    var d = RA.digits(zip || "");
    var invalid = ["O CEP informado não é válido. Verifique e tente novamente."];
    if (d.length !== 8) return Promise.reject(invalid);
    return fetch("https://viacep.com.br/ws/" + d + "/json/")
      .then(function (r) {
        if (!r.ok) throw invalid;
        return r.json();
      })
      .then(function (j) {
        if (!j || j.erro) throw invalid;
        return {
          address_street: j.logradouro || "",
          address_neighborhood: j.bairro || "",
          city: j.localidade || "",
          state: j.uf || ""
        };
      })
      .catch(function (e) {
        if (Array.isArray(e)) throw e;
        throw ["Não foi possível consultar o CEP agora. Verifique sua conexão e tente novamente."];
      });
  };

  api.validateAddressData = function (d) {
    var ok =
      !blank(d.address_street) &&
      !blank(d.address_street_number) &&
      !blank(d.address_neighborhood) &&
      RA.digits(d.address_zipcode || "").length === 8 &&
      String(d.phone_ddd || "").length === 2 &&
      RA.removeMask(d.phone_number || "").length >= 8 &&
      RA.removeMask(d.phone_number || "").length <= 10;
    return ok
      ? Promise.resolve()
      : Promise.reject(["Não foi possível seguir com o seu cadastro. Por gentileza, verifique os seus dados e tente novamente."]);
  };

  api.signup = function (d) {
    return api.validateAccessData(d).then(function () {
      return api.validateAddressData(d).then(function () {
        if (blank(d.plan_id) || blank(d.payment_method)) {
          throw ["Não foi possível finalizar o seu cadastro. Por gentileza, verifique os seus dados e tente novamente."];
        }
        return api.createSubscription(d).then(function (sub) {
          var profile = {
            id: RA.uuid(),
            telephone: "",
            description: null,
            logo_image: null,
            profile_image: null,
            birth_date: null,
            subscription_id: sub.id,
            is_demo: false
          };
          var user = {
            id: RA.uuid(),
            farmer_profile_id: profile.id,
            name: String(d.name).trim(),
            email: String(d.email).trim(),
            cpf_cnpj: RA.removeMask(d.cpf_cnpj),
            is_staff: false,
            is_superuser: false,
            is_farmer: true,
            is_active: true,
            date_joined: RA.nowISO(),
            person_type: d.person_type,
            last_login: null
          };
          return db
            .put("farmer_profiles", profile)
            .then(function () {
              return api.setPassword(user, d.password);
            })
            .then(function () {
              api.session.set("admin", user.id);
              return user;
            });
        });
      });
    });
  };

  // Reativação (accounts/views reactivate)
  api.reactivate = function (user, d) {
    return api.profileForUser(user).then(function (profile) {
      return api.subscriptionForProfile(profile).then(function (old) {
        if (!old || old.status !== api.SUB.CANCELED) throw ["Você já possui uma assinatura ativa."];
        return api.createSubscription(d).then(function (sub) {
          profile.subscription_id = sub.id;
          return db.put("farmer_profiles", profile);
        });
      });
    });
  };

  // ------------------------------------------------------------------ catálogo (staff)
  api.units = function () {
    return db.all("units").then(function (l) {
      return l.sort(function (a, b) {
        return a.name.localeCompare(b.name, "pt-BR");
      });
    });
  };

  api.products = function () {
    return db.all("products").then(function (l) {
      return l.sort(function (a, b) {
        return a.name.localeCompare(b.name, "pt-BR") || a.variety.localeCompare(b.variety, "pt-BR");
      });
    });
  };

  api.certificateTypes = function (onlyActive) {
    return db.all("certificate_types").then(function (l) {
      return l.filter(function (t) {
        return !onlyActive || t.is_active;
      });
    });
  };

  // ------------------------------------------------------------------ objetos relacionados
  // Carrega todas as tabelas de uma vez e devolve índices por id (para montar listas).
  api.loadIndex = function () {
    var names = [
      "users",
      "farmer_profiles",
      "subscriptions",
      "farms",
      "technical_managers",
      "certificate_types",
      "certificates",
      "units",
      "products",
      "batches",
      "batch_tags",
      "farm_journals"
    ];
    return Promise.all(
      names.map(function (n) {
        return db.all(n);
      })
    ).then(function (r) {
      var idx = {};
      names.forEach(function (n, i) {
        idx[n] = {};
        idx[n + "_list"] = r[i];
        r[i].forEach(function (o) {
          idx[n][o.id] = o;
        });
      });
      idx.userByProfile = {};
      r[0].forEach(function (u) {
        if (u.farmer_profile_id) idx.userByProfile[u.farmer_profile_id] = u;
      });
      idx.certificates_list.forEach(function (c) {
        c.certificate_type = idx.certificate_types[c.certificate_type_id] || null;
      });
      return idx;
    });
  };

  // Lote completo (com propriedade, produto, unidade, responsável técnico e certificados)
  api.expandBatch = function (b, idx) {
    if (!b) return null;
    var x = RA.clone(b);
    x.farm = idx.farms[b.farm_id] || null;
    x.product = idx.products[b.product_id] || null;
    x.unit = idx.units[b.unit_id] || null;
    x.technical_manager = idx.technical_managers[b.technical_manager_id] || null;
    x.certificates = (b.certificate_ids || [])
      .map(function (id) {
        var c = idx.certificates[id];
        if (!c) return null;
        var cc = RA.clone(c);
        cc.certificate_type = idx.certificate_types[c.certificate_type_id] || null;
        return cc;
      })
      .filter(Boolean);
    x.farmer_profile = x.farm ? idx.farmer_profiles[x.farm.farmer_profile_id] || null : null;
    x.farmer = x.farm ? idx.userByProfile[x.farm.farmer_profile_id] || null : null;
    x.batch_tags_count = idx.batch_tags_list.filter(function (t) {
      return t.batch_id === b.id;
    }).length;
    return x;
  };

  api.expandBatchTag = function (t, idx) {
    if (!t) return null;
    var x = RA.clone(t);
    x.batch = api.expandBatch(idx.batches[t.batch_id], idx);
    return x;
  };

  api.expandFarmJournal = function (j, idx) {
    if (!j) return null;
    var x = RA.clone(j);
    x.farm = idx.farms[j.farm_id] || null;
    x.products = (j.product_ids || [])
      .map(function (id) {
        return idx.products[id];
      })
      .filter(Boolean);
    x.farmer = x.farm ? idx.userByProfile[x.farm.farmer_profile_id] || null : null;
    return x;
  };

  // ------------------------------------------------------------------ lotes (products.Batch)
  api.batchesForProfile = function (profileId, idx) {
    return (idx ? Promise.resolve(idx) : api.loadIndex()).then(function (ix) {
      return ix.batches_list
        .filter(function (b) {
          var f = ix.farms[b.farm_id];
          return !profileId || (f && f.farmer_profile_id === profileId);
        })
        .map(function (b) {
          return api.expandBatch(b, ix);
        })
        .sort(function (a, b) {
          return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
        });
    });
  };

  api.saveBatch = function (data, existing) {
    var errors = {};
    if (blank(data.farm_id)) addErr(errors, "farm", api.REQUIRED);
    if (blank(data.number)) addErr(errors, "number", api.REQUIRED);
    if (blank(data.harvest_date)) addErr(errors, "harvest_date", api.REQUIRED);
    else if (!api.isISODate(data.harvest_date)) addErr(errors, "harvest_date", api.INVALID_DATE);
    if (blank(data.product_id)) addErr(errors, "product", api.REQUIRED);
    if (blank(data.unit_id)) addErr(errors, "unit", api.REQUIRED);
    if ((data.certificate_ids || []).length > 3) addErr(errors, "certificates", "Você pode selecionar no máximo 3 certificados.");
    if (Object.keys(errors).length) return Promise.reject(new ValidationError(errors));
    var batch = {
      id: (existing && existing.id) || data.id || RA.uuid(),
      farm_id: data.farm_id,
      product_id: data.product_id,
      unit_id: data.unit_id,
      technical_manager_id: data.technical_manager_id || null,
      certificate_ids: data.certificate_ids || [],
      number: String(data.number),
      harvest_date: data.harvest_date,
      created_at: RA.nowISO(), // auto_now=True no original
      image: data.image !== undefined ? data.image : existing ? existing.image : null
    };
    // Nome do arquivo escolhido (aparece em "Imagem atual" e dá nome ao arquivo enviado)
    var imageName = data.image_name !== undefined ? data.image_name : existing ? existing.image_name : undefined;
    if (imageName !== undefined) batch.image_name = batch.image ? imageName : null;
    return db.put("batches", batch);
  };

  api.batchHasTags = function (batchId) {
    return db.all("batch_tags").then(function (l) {
      return l.some(function (t) {
        return t.batch_id === batchId;
      });
    });
  };

  api.deleteBatch = function (batchId) {
    return api.batchHasTags(batchId).then(function (has) {
      if (has) {
        var e = new ValidationError({ __all__: ["Existem referências para o objeto que você tentou excluir, por isso ele não pôde ser removido."] });
        e.protected = true;
        throw e;
      }
      return db.del("batches", batchId);
    });
  };

  // ------------------------------------------------------------------ etiquetas (products.BatchTag)
  api.batchTagsForProfile = function (profileId, idx) {
    return (idx ? Promise.resolve(idx) : api.loadIndex()).then(function (ix) {
      return ix.batch_tags_list
        .map(function (t) {
          return api.expandBatchTag(t, ix);
        })
        .filter(function (t) {
          return !profileId || (t.batch && t.batch.farm && t.batch.farm.farmer_profile_id === profileId);
        })
        .sort(function (a, b) {
          return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
        });
    });
  };

  api.createBatchTag = function (data) {
    var errors = {};
    if (blank(data.batch_id)) addErr(errors, "batch", api.REQUIRED);
    if (blank(data.amount)) addErr(errors, "amount", api.REQUIRED);
    else if (RA.parseNumber(data.amount) === null) addErr(errors, "amount", "Informe um número.");
    if (Object.keys(errors).length) return Promise.reject(new ValidationError(errors));
    return db.put("batch_tags", {
      id: data.id || RA.uuid(),
      batch_id: data.batch_id,
      date: data.date || RA.nowISO(),
      amount: RA.parseNumber(data.amount)
    });
  };

  api.getBatchTag = function (id) {
    return api.loadIndex().then(function (ix) {
      var t = ix.batch_tags[String(id || "").toLowerCase()];
      return t ? api.expandBatchTag(t, ix) : null;
    });
  };

  // Textos da página pública e impressão (BatchTagMixin)
  api.tagInfo = function (tag) {
    var b = tag.batch || {};
    var farm = b.farm || {};
    var profile = b.farmer_profile || {};
    var tm = b.technical_manager;
    var tmText = null;
    if (tm) {
      tmText = tm.name;
      if (tm.number) tmText += " (" + tm.number + " - " + tm.number_type + ")";
    }
    return {
      productFullName: api.str.productFullName(b.product),
      productName: b.product ? b.product.name + " (" + (b.unit ? b.unit.symbol : "") + ")" : "",
      amountUnit: RA.intcomma(tag.amount) + " " + (b.unit ? b.unit.symbol : ""),
      farmerName: b.farmer ? b.farmer.name : "",
      farmerCpfCnpj: b.farmer ? RA.fmtCpfCnpj(b.farmer.cpf_cnpj) : "",
      farmName: farm.name || "",
      address: api.farmAddress(farm, true),
      shortAddress: api.farmAddress(farm, false),
      zip: farm.zip_code ? "CEP " + RA.fmtCEP(farm.zip_code) : "",
      technicalManager: tmText,
      certificates: (b.certificates || []).map(function (c) {
        var t = c.certificate_type ? c.certificate_type.name : "";
        if (c.number) t += " " + c.number;
        return t;
      }),
      certificateLogos: (b.certificates || [])
        .map(function (c) {
          return c.certificate_type ? c.certificate_type.certificate_logo : null;
        })
        .filter(Boolean),
      logo: profile.logo_image || null,
      profileImage: profile.profile_image || null,
      description: profile.description || null,
      hasCoordinates: api.farmHasCoordinates(farm),
      lat: farm.latitude,
      lng: farm.longitude,
      batchImage: b.image || null,
      harvestDate: RA.fmtDate(b.harvest_date),
      batchNumber: b.number
    };
  };

  // ------------------------------------------------------------------ cadernos de campo (farm_journals)
  var JOURNAL_BOOLS = [
    "has_subsolagem",
    "has_aracao",
    "has_enxada_rotativa",
    "has_gradagem_leve",
    "has_gradagem_pesada",
    "has_gradagem_niveladora",
    "is_practice_not_required",
    "has_plantio_nivel",
    "has_terracos",
    "has_rotacao_culturas",
    "has_adubacao_verde",
    "has_plantio_direto",
    "has_origem_propria",
    "has_tratamento_termico"
  ];
  api.JOURNAL_BOOLS = JOURNAL_BOOLS;

  api.farmJournalsForProfile = function (profileId, idx) {
    return (idx ? Promise.resolve(idx) : api.loadIndex()).then(function (ix) {
      return ix.farm_journals_list
        .filter(function (j) {
          var f = ix.farms[j.farm_id];
          return !profileId || (f && f.farmer_profile_id === profileId);
        })
        .map(function (j) {
          return api.expandFarmJournal(j, ix);
        })
        .sort(function (a, b) {
          return a.creation_date < b.creation_date ? 1 : a.creation_date > b.creation_date ? -1 : 0;
        });
    });
  };

  api.getFarmJournal = function (id) {
    return api.loadIndex().then(function (ix) {
      var j = ix.farm_journals[id];
      return j ? api.expandFarmJournal(j, ix) : null;
    });
  };

  // validate=true reproduz as regras do formulário web (campos obrigatórios do model)
  api.saveFarmJournal = function (data, existing, opts) {
    opts = opts || {};
    var errors = {};
    if (blank(data.field_identification)) addErr(errors, "field_identification", api.REQUIRED);
    if (blank(data.farm_id)) addErr(errors, "farm", api.REQUIRED);
    if (blank(data.total_hectares)) addErr(errors, "total_hectares", api.REQUIRED);
    else if (RA.parseNumber(data.total_hectares) === null) addErr(errors, "total_hectares", "Informe um número.");
    if (blank(data.plantation_date)) addErr(errors, "plantation_date", api.REQUIRED);
    else if (!api.isISODate(data.plantation_date)) addErr(errors, "plantation_date", api.INVALID_DATE);
    if (!blank(data.harvest_date) && !api.isISODate(data.harvest_date)) addErr(errors, "harvest_date", api.INVALID_DATE);
    if (opts.web) {
      if (blank(data.last_cultural_method)) addErr(errors, "last_cultural_method", api.REQUIRED);
      if (blank(data.irrigation_method)) addErr(errors, "irrigation_method", api.REQUIRED);
      if (blank(data.water_source)) addErr(errors, "water_source", api.REQUIRED);
      if (!data.polygon || !data.polygon.length) addErr(errors, "polygon", api.REQUIRED);
    }
    if (Object.keys(errors).length) return Promise.reject(new ValidationError(errors));
    var j = {
      id: (existing && existing.id) || data.id || RA.uuid(),
      creation_date: (existing && existing.creation_date) || data.creation_date || RA.today(),
      field_identification: data.field_identification,
      farm_id: data.farm_id,
      total_hectares: RA.parseNumber(data.total_hectares),
      product_ids: data.product_ids || [],
      last_cultural_method: blank(data.last_cultural_method) ? null : data.last_cultural_method,
      plantation_date: data.plantation_date,
      harvest_date: data.harvest_date || null,
      extra_soil_preparation_operation: blank(data.extra_soil_preparation_operation) ? null : data.extra_soil_preparation_operation,
      extra_soil_preparation_practice: blank(data.extra_soil_preparation_practice) ? null : data.extra_soil_preparation_practice,
      origem_terceiros: blank(data.origem_terceiros) ? null : data.origem_terceiros,
      irrigation_method: blank(data.irrigation_method) ? null : data.irrigation_method,
      water_source: blank(data.water_source) ? null : data.water_source,
      polygon: data.polygon !== undefined ? data.polygon : existing ? existing.polygon || null : null
    };
    JOURNAL_BOOLS.forEach(function (k) {
      j[k] = !!data[k];
    });
    return db.put("farm_journals", j);
  };

  // Excluir caderno apaga os registros (on_delete=CASCADE)
  api.deleteFarmJournal = function (id) {
    return Promise.all(
      ["fertilizing_entries", "pesticide_entries", "harvest_entries", "postharvest_entries"].map(function (s) {
        return db.all(s).then(function (l) {
          return Promise.all(
            l
              .filter(function (e) {
                return e.farm_journal_id === id;
              })
              .map(function (e) {
                return db.del(s, e.id);
              })
          );
        });
      })
    ).then(function () {
      return db.del("farm_journals", id);
    });
  };

  // Registros do caderno ---------------------------------------------------
  api.ENTRY = {
    fertilizing: {
      store: "fertilizing_entries",
      dateField: "application_date",
      verbose: "registro de adubação",
      required: ["application_date", "formula_name", "dose", "unity", "application_method", "application_responsible"],
      numeric: ["dose"]
    },
    pesticide: {
      store: "pesticide_entries",
      dateField: "date",
      verbose: "registro de defensivos",
      required: ["date", "grace_period", "target_disease", "product_name", "dose", "volume", "operator"]
    },
    harvest: {
      store: "harvest_entries",
      dateField: "date",
      verbose: "registro de colheita",
      required: ["date", "amount", "destination", "responsible"]
    },
    postharvest: {
      store: "postharvest_entries",
      dateField: "date",
      verbose: "registro pós-colheita",
      required: ["date", "product_name", "dose", "grace_period", "responsible"]
    }
  };

  api.FERTILIZING_UNITS = [
    ["KGM", "kg/m²"],
    ["LM", "l/m²"],
    ["GP", "g/planta"]
  ];

  api.unitDescription = function (u) {
    return choice(api.FERTILIZING_UNITS, u);
  };

  api.entries = function (type, farmJournalId) {
    var cfg = api.ENTRY[type];
    return db.all(cfg.store).then(function (l) {
      return l
        .filter(function (e) {
          return e.farm_journal_id === farmJournalId;
        })
        .sort(function (a, b) {
          var x = a[cfg.dateField],
            y = b[cfg.dateField];
          return x < y ? 1 : x > y ? -1 : 0;
        });
    });
  };

  api.getEntry = function (type, id) {
    return db.get(api.ENTRY[type].store, id);
  };

  api.saveEntry = function (type, data, existing) {
    var cfg = api.ENTRY[type];
    var errors = {};
    cfg.required.forEach(function (k) {
      if (blank(data[k])) addErr(errors, k, api.REQUIRED);
      else if (k === cfg.dateField && !api.isISODate(data[k])) addErr(errors, k, api.INVALID_DATE);
    });
    if (type === "fertilizing" && !blank(data.unity) && !api.FERTILIZING_UNITS.some(function (u) {
      return u[0] === data.unity;
    }))
      addErr(errors, "unity", "Faça uma escolha válida. " + data.unity + " não é uma das escolhas disponíveis.");
    (cfg.numeric || []).forEach(function (k) {
      if (!blank(data[k]) && RA.parseNumber(data[k]) === null) addErr(errors, k, "Informe um número.");
    });
    if (Object.keys(errors).length) return Promise.reject(new ValidationError(errors));
    var e = RA.clone(data);
    e.id = (existing && existing.id) || data.id || RA.uuid();
    e.farm_journal_id = data.farm_journal_id || (existing && existing.farm_journal_id);
    (cfg.numeric || []).forEach(function (k) {
      e[k] = RA.parseNumber(data[k]);
    });
    if (type === "fertilizing" && blank(e.note)) e.note = null;
    return db.put(cfg.store, e);
  };

  api.deleteEntry = function (type, id) {
    return db.del(api.ENTRY[type].store, id);
  };

  // ------------------------------------------------------------------ validação de senha
  // django.contrib.auth.password_validation com os 4 validadores de fetaep/settings
  // (UserAttributeSimilarity, MinimumLength(8), CommonPassword, NumericPassword).
  // A lista de senhas comuns é uma versão reduzida da lista do Django.
  var COMMON_PASSWORDS = (
    "123456 password 12345678 qwerty 123456789 12345 1234 111111 1234567 dragon 123123 baseball abc123 football monkey " +
    "letmein 696969 shadow master 666666 qwertyuiop 123321 mustang 1234567890 michael 654321 pussy superman 1qaz2wsx " +
    "7777777 fuckyou 121212 000000 qazwsx 123qwe killer trustno1 jordan jennifer zxcvbnm asdfgh hunter buster soccer " +
    "harley batman andrew tigger sunshine iloveyou fuckme 2000 charlie robert thomas hockey ranger daniel starwars klaster " +
    "112233 george asshole computer michelle jessica pepper 1111 zxcvbn 555555 11111111 131313 freedom 777777 pass maggie " +
    "159753 aaaaaa ginger princess joshua cheese amanda summer love ashley 6969 nicole chelsea biteme matthew access " +
    "yankees 987654321 dallas austin thunder taylor matrix minecraft admin senha senha123 mudar123 brasil 102030 " +
    "abcdef 12341234 qwerty123 password1 welcome login 1q2w3e4r 1q2w3e qwe123 changeme"
  ).split(" ");

  // difflib.SequenceMatcher.quick_ratio
  function quickRatio(a, b) {
    var counts = {};
    var i, matches = 0;
    for (i = 0; i < b.length; i++) counts[b[i]] = (counts[b[i]] || 0) + 1;
    for (i = 0; i < a.length; i++) {
      if (counts[a[i]] > 0) {
        counts[a[i]] -= 1;
        matches += 1;
      }
    }
    var t = a.length + b.length;
    return t ? (2 * matches) / t : 1;
  }

  api.validatePassword = function (password, user) {
    var errors = [];
    password = String(password || "");
    if (user && user.email) {
      var value = String(user.email);
      var parts = value.split(/\W+/).concat([value]);
      for (var i = 0; i < parts.length; i++) {
        if (quickRatio(password.toLowerCase(), parts[i].toLowerCase()) >= 0.7) {
          errors.push("A senha é muito parecida com email");
          break;
        }
      }
    }
    if (password.length < 8) errors.push("Esta senha é muito curta. Ela precisa conter pelo menos 8 caracteres.");
    if (COMMON_PASSWORDS.indexOf(password.toLowerCase().trim()) !== -1) errors.push("Esta senha é muito comum.");
    if (/^\d+$/.test(password)) errors.push("Esta senha é inteiramente numérica.");
    return errors;
  };

  // password_validators_help_text_html()
  api.PASSWORD_HELP_HTML =
    "<ul><li>Sua senha não pode ser muito parecida com o resto das suas informações pessoais.</li>" +
    "<li>Sua senha precisa conter pelo menos 8 caracteres.</li>" +
    "<li>Sua senha não pode ser uma senha comumente utilizada.</li>" +
    "<li>Sua senha não pode ser inteiramente numérica.</li></ul>";

  // django.contrib.auth.forms.PasswordChangeForm (painel: "Alterar senha")
  api.changePasswordForm = function (user, data) {
    var errors = {};
    var oldP = data.old_password || "",
      p1 = data.new_password1 || "",
      p2 = data.new_password2 || "";
    if (!oldP) addErr(errors, "old_password", api.REQUIRED);
    if (!p1) addErr(errors, "new_password1", api.REQUIRED);
    if (!p2) addErr(errors, "new_password2", api.REQUIRED);
    return RA.checkPassword(oldP, user).then(function (ok) {
      if (oldP && !ok) addErr(errors, "old_password", "A senha antiga foi digitada incorretamente. Por favor, informe-a novamente.");
      if (p1 && p2) {
        if (p1 !== p2) addErr(errors, "new_password2", "Os dois campos de senha não correspondem.");
        else
          api.validatePassword(p2, user).forEach(function (m) {
            addErr(errors, "new_password2", m);
          });
      }
      if (Object.keys(errors).length) throw new ValidationError(errors);
      return api.setPassword(user, p1);
    });
  };

  // ------------------------------------------------------------------ conta do administrador
  // accounts.forms.CustomNameForm
  api.changeName = function (user, name) {
    if (blank(name)) return Promise.reject(new ValidationError({ name: [api.REQUIRED] }));
    user.name = String(name).trim();
    return db.put("users", user);
  };

  // wagtail.users.forms.EmailForm
  api.changeEmail = function (user, email) {
    email = String(email || "").trim();
    var errors = {};
    if (!email) addErr(errors, "email", api.REQUIRED);
    else if (!RA.isEmail(email)) addErr(errors, "email", api.INVALID_EMAIL);
    return (email && !errors.email ? api.uniqueConflicts(user.id, null, email) : Promise.resolve({})).then(function (dup) {
      if (dup.email) addErr(errors, "email", "User com este Email já existe.");
      if (Object.keys(errors).length) throw new ValidationError(errors);
      user.email = email;
      return db.put("users", user);
    });
  };

  // ------------------------------------------------------------------ administradores (wagtail.users + accounts.forms)
  api.adminUsers = function () {
    return db.all("users").then(function (l) {
      return l.filter(function (u) {
        return u.is_staff || u.is_superuser;
      });
    });
  };

  // wagtail.users.utils.user_can_delete_user
  api.userCanDeleteUser = function (current, target) {
    if (!current || !current.is_superuser) return false;
    if (current.id === target.id) return false;
    if (target.is_superuser && !current.is_superuser) return false;
    return true;
  };

  // CustomUserCreationForm / CustomUserEditForm
  api.saveAdminUser = function (data, existing) {
    var errors = {};
    var creating = !existing;
    var cpf = RA.removeMask(data.cpf_cnpj || "");
    if (blank(data.name)) addErr(errors, "name", api.REQUIRED);
    if (blank(data.person_type)) addErr(errors, "person_type", api.REQUIRED);
    if (blank(cpf)) addErr(errors, "cpf_cnpj", api.REQUIRED);
    var email = String(data.email || "").trim();
    if (!email) addErr(errors, "email", api.REQUIRED);
    else if (!RA.isEmail(email)) addErr(errors, "email", api.INVALID_EMAIL);
    var p1 = data.password1 || "",
      p2 = data.password2 || "";
    if (creating) {
      if (!p1) addErr(errors, "password1", api.REQUIRED);
      if (!p2) addErr(errors, "password2", api.REQUIRED);
    }
    if (p2 !== p1) addErr(errors, "password2", "Os dois campos de senha não coincidem.");
    return db.all("users").then(function (all) {
      var others = all.filter(function (o) {
        return !existing || o.id !== existing.id;
      });
      if (!errors.cpf_cnpj && others.some(function (o) {
        return o.cpf_cnpj === cpf;
      }))
        addErr(errors, "cpf_cnpj", "Já existe um usuário cadastrado com esse CPF ou CNPJ");
      if (!errors.email && others.some(function (o) {
        return o.email === email;
      }))
        addErr(errors, "email", "User com este Email já existe.");
      var user = existing
        ? RA.clone(existing)
        : {
            id: RA.uuid(),
            farmer_profile_id: null,
            is_staff: false,
            is_farmer: false,
            is_active: true,
            date_joined: RA.nowISO(),
            last_login: null
          };
      user.name = String(data.name || "").trim();
      user.person_type = data.person_type;
      user.cpf_cnpj = cpf;
      user.email = email;
      user.is_superuser = true; // <input type="hidden" name="is_superuser" value="on">
      if (p1 && p2 && p1 === p2) {
        api.validatePassword(p1, user).forEach(function (m) {
          addErr(errors, "password2", m);
        });
      }
      // accounts.forms._clean: valida o CPF/CNPJ conforme o tipo de pessoa
      if (data.person_type && !blank(cpf) && !errors.cpf_cnpj) {
        var ce = api.validateCpfCnpj(data.person_type, cpf);
        if (ce) addErr(errors, "cpf_cnpj", ce);
      }
      if (Object.keys(errors).length) throw new ValidationError(errors);
      if (p1) return api.setPassword(user, p1);
      return db.put("users", user);
    });
  };

  api.deleteUser = function (id) {
    return db.del("users", id);
  };

  // ------------------------------------------------------------------ catálogo (equipe)
  function linkedBatches(field, id) {
    return db.all("batches").then(function (l) {
      return l.filter(function (b) {
        return b[field] === id;
      });
    });
  }

  function protectedError(linked) {
    var pe = new ValidationError({ __all__: ["protected"] });
    pe.protected = true;
    pe.linked = linked;
    return pe;
  }

  api.saveUnit = function (data, existing) {
    var errors = {};
    if (blank(data.name)) addErr(errors, "name", api.REQUIRED);
    if (blank(data.symbol)) addErr(errors, "symbol", api.REQUIRED);
    if (Object.keys(errors).length) return Promise.reject(new ValidationError(errors));
    return db.put("units", { id: (existing && existing.id) || RA.uuid(), name: data.name, symbol: data.symbol });
  };

  api.deleteUnit = function (id) {
    return linkedBatches("unit_id", id).then(function (linked) {
      if (linked.length) throw protectedError(linked);
      return db.del("units", id);
    });
  };

  api.saveProduct = function (data, existing) {
    var errors = {};
    if (blank(data.name)) addErr(errors, "name", api.REQUIRED);
    if (blank(data.variety)) addErr(errors, "variety", api.REQUIRED);
    if (Object.keys(errors).length) return Promise.reject(new ValidationError(errors));
    return db.put("products", { id: (existing && existing.id) || RA.uuid(), name: data.name, variety: data.variety });
  };

  api.deleteProduct = function (id) {
    return linkedBatches("product_id", id).then(function (linked) {
      if (linked.length) throw protectedError(linked);
      // ManyToMany com os cadernos: só remove a ligação
      return db.all("farm_journals").then(function (journals) {
        var ops = [];
        journals.forEach(function (j) {
          if ((j.product_ids || []).indexOf(id) !== -1) {
            j.product_ids = j.product_ids.filter(function (x) {
              return x !== id;
            });
            ops.push(db.put("farm_journals", j));
          }
        });
        ops.push(db.del("products", id));
        return Promise.all(ops);
      });
    });
  };

  api.saveCertificateType = function (data, existing) {
    var errors = {};
    if (blank(data.name)) addErr(errors, "name", api.REQUIRED);
    var logo = data.certificate_logo !== undefined ? data.certificate_logo : existing ? existing.certificate_logo : null;
    if (!logo) addErr(errors, "certificate_logo", api.REQUIRED);
    if (Object.keys(errors).length) return Promise.reject(new ValidationError(errors));
    var t = existing ? RA.clone(existing) : { id: RA.uuid(), is_active: true };
    t.name = data.name;
    t.alert_message = blank(data.alert_message) ? null : data.alert_message;
    t.certificate_logo = logo;
    if (data.certificate_logo_name) t.certificate_logo_name = data.certificate_logo_name;
    return db.put("certificate_types", t);
  };

  // farmers.views.staff.CertificateTypeDeleteView: apenas desativa
  api.deactivateCertificateType = function (id) {
    return db.get("certificate_types", id).then(function (t) {
      t.is_active = false;
      return db.put("certificate_types", t);
    });
  };

  // ------------------------------------------------------------------ cache offline de etiqueta (app)
  api.storeOfflineBatchTagCache = function (tag) {
    return Promise.resolve(true);
  };
})(window);
