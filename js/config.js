/*
 * Configuração do Rastrear AgriFamiliar (versão HTML/JavaScript).
 * Os valores abaixo reproduzem os do sistema original (fetaep/settings e
 * core/core_constants.dart). Nenhuma senha ou chave secreta deve ser colocada aqui:
 * este arquivo é público.
 */
window.RASTREAR_CONFIG = {
  // Onde ficam os dados:
  //  "supabase" = banco de dados real no Supabase (todos os usuários compartilham os dados);
  //  "local"    = demonstração dentro do navegador (cada navegador tem os seus dados de teste).
  BACKEND: "supabase",

  // Projeto Supabase (endereço e chave pública "publishable"; a chave pública pode ficar
  // no site: o acesso aos dados é controlado pelas regras de segurança do banco)
  SUPABASE_URL: "https://sgbluqhrgeazdficjjts.supabase.co",
  SUPABASE_KEY: "sb_publishable_ksPk7hmka75ufuvejkBx7w_2Wi9CrRq",

  // Endereço público do sistema. É usado nos QR Codes das etiquetas
  // (original: WEBSITE_DOMAIN = "https://rastrear.agrifamiliar.agr.br").
  // Vazio = usa o endereço em que o site estiver aberto.
  WEBSITE_DOMAIN: "",

  APP_VERSION: "1.3.1",

  // Página para onde a raiz do site ("/") redireciona (INDEX_URL do original)
  INDEX_URL: "https://agrifamiliar.agr.br/rastrear/",

  // Contatos (core_constants.dart e templates originais)
  CONTACT_EMAIL: "rastrear@agrifamiliar.agr.br",
  CONTACT_WHATSAPP: "(41) 98470-7225",
  FOOTER_EXTERNAL:
    "Fone/WhatsApp: (41) 98470-7225 | E-mail: rastrear@agrifamiliar.agr.br | https://rastrear.agrifamiliar.agr.br",
  SIGNUP_FOOTER_PHONE: "(41) 3149-9200",
  SIGNUP_FOOTER_WHATSAPP: "(41) 99515-4564",

  // Google Maps (opcional). A chave original ficava no servidor e deve ser trocada.
  // Sem chave, os mapas usam imagens de satélite gratuitas (Esri) e o OpenStreetMap.
  GOOGLE_MAPS_API_KEY: "",

  // Planos de assinatura (SUBSCRIPTION_PLANS de fetaep/settings/prod.py, os mesmos códigos usados em produção)
  SUBSCRIPTION_PLANS: [
    {
      plan_id: "3915460",
      name: "Plano semestral",
      amount: 300,
      days: 180,
      trial_days: 30,
      short_description: "R$ 50,00 por mês.",
      description:
        "Você receberá uma <strong>cobrança semestral</strong> de <strong>R$ 300,00</strong> via boleto ou cartão, e ganha 30 dias de acesso grátis.",
      has_trial_days: true
    },
    {
      plan_id: "3915456",
      name: "Plano semestral",
      amount: 300,
      days: 180,
      trial_days: 0,
      short_description: "R$ 50,00 por mês.",
      description:
        "Você receberá uma <strong>cobrança semestral</strong> de <strong>R$ 300,00</strong> via boleto ou cartão.",
      has_trial_days: false,
      trial_plan_id: "3915460"
    },
    {
      plan_id: "3915457",
      name: "Plano anual",
      amount: 500,
      days: 365,
      trial_days: 60,
      short_description: "R$ 41,67 por mês.",
      description:
        "Você receberá uma <strong>cobrança anual</strong> de <strong>R$ 500,00</strong> via boleto ou cartão, e ganha 60 dias de acesso grátis.",
      has_trial_days: true
    },
    {
      plan_id: "3915455",
      name: "Plano anual",
      amount: 500,
      days: 365,
      trial_days: 0,
      short_description: "R$ 41,67 por mês.",
      description:
        "Você receberá uma <strong>cobrança anual</strong> de <strong>R$ 500,00</strong> via boleto ou cartão.",
      has_trial_days: false,
      trial_plan_id: "3915457"
    }
  ],

  SUBSCRIPTION_PAYMENT_METHODS: [
    {
      payment_method: "credit_card",
      name: "Cartão de crédito",
      description:
        "Você receberá uma <strong>cobrança em seu cartão de crédito</strong> de acordo com o plano escolhido."
    },
    {
      payment_method: "boleto",
      name: "Boleto bancário",
      description: "Você receberá o <strong>boleto por e-mail</strong> de acordo com o plano escolhido."
    }
  ]
};

// Para testes: localStorage.ra_backend = "local" usa a demonstração dentro do navegador
// (só naquele navegador; os dados reais continuam no Supabase).
(function () {
  try {
    var forced = window.localStorage && window.localStorage.getItem("ra_backend");
    if (forced === "local" || forced === "supabase") window.RASTREAR_CONFIG.BACKEND = forced;
  } catch (e) {
    // navegação privada sem localStorage: mantém o padrão
  }
})();
