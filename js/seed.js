/*
 * Dados iniciais do modo local (navegador). Vêm dos próprios arquivos de
 * demonstração do sistema original:
 *  - web/scripts/demo_user.py  (usuário de demonstração)
 *  - web/scripts/demo_data.py  (usuário da equipe / administrador)
 *  - web/scripts/products.py   (catálogo de produtos da CEASA)
 *  - app/lib/core/api/mocks/demo_data.dart (propriedades, lotes, etiquetas, cadernos)
 *
 * LOGINS DE TESTE (somente para o modo local):
 *  - Produtor de demonstração: CPF 495.127.660-78  senha: demo
 *  - Administrador (equipe FETAEP): CPF 386.194.520-70  senha: test
 */
(function (window) {
  "use strict";

  var RA = window.RA;
  var db = RA.db;
  var SEED_VERSION = 1;

  function img(path) {
    return RA.fetchAsDataURL(RA.url(path)).catch(function () {
      return null;
    });
  }

  function daysAgo(n) {
    return RA.addDays(new Date(), -n);
  }

  function seed() {
    var ids = {
      certOrganico: "d1651b8b-9cc3-4da2-ac0e-e1c1dee22ffc",
      certSPDH: "a86bd401-78c2-425d-9562-44a1169f7c3f",
      unitKg: "3fe2502a-aff4-47b8-aef7-8b7783d36523",
      unitCx: "34b3e043-444a-4cd6-bde8-ef8b764a2eb5",
      demoProfile: "5b0c8f74-6d2b-4b43-9a9c-1c1f2a8f0d11",
      demoUser: "7f2d5a3e-0b8c-4d6f-9e1a-2c3b4d5e6f70",
      staffUser: "0e9d8c7b-6a5f-4e3d-8c2b-1a0f9e8d7c6b",
      farm1: "accc71a3-0f61-443d-b3f3-54976e32100f",
      farm2: "6f1303b7-ffce-408d-829b-398fb387e6a8",
      tm1: "0abaf704-a5d7-49a6-a78f-276777aa4e85",
      tm2: "9d2a0715-3bc6-4bd0-93fe-8eefda31a54e",
      cert1: "d2986de0-4c87-487f-839b-52e07e88c53c",
      cert2: "ac769a92-08d3-4b9d-a9c7-105939f90632"
    };

    return Promise.all([
      fetch(RA.url("assets/data/products.json")).then(function (r) {
        return r.json();
      }),
      img("assets/img/demo/logo_organico.png"),
      img("assets/img/demo/logo_spdh.png"),
      img("assets/img/demo/logo_agrifam.png"),
      img("assets/img/demo/batch.png")
    ]).then(function (r) {
      var productList = r[0],
        logoOrganico = r[1],
        logoSPDH = r[2],
        logoFarmer = r[3],
        batchImage = r[4];

      var products = productList.map(function (p) {
        return { id: RA.uuid(), name: p.name, variety: p.variety };
      });
      var productBy = function (name, variety) {
        return products.filter(function (p) {
          return p.name === name && (!variety || p.variety === variety);
        })[0];
      };
      var alface = productBy("Alface", "Crespa/Lisa Grande") || products[0];
      var batata = productBy("Batata", "Lisa Primeira") || products[1];
      var maca = productBy("Maçã (importada)") || productBy("Maçã (nacional)") || products[2];

      var certificateTypes = [
        {
          id: ids.certOrganico,
          name: "Orgânico",
          alert_message:
            "Ao selecionar um certificado de orgânicos, você deve prestar atenção à data de validade do certificado.",
          is_active: true,
          certificate_logo: logoOrganico
        },
        {
          id: ids.certSPDH,
          name: "SPDH",
          alert_message:
            "Para o consumidor ter a certeza de que o produto foi produzido seguindo o Sistema de Plantio Direto de Hortaliças, insira uma foto na imagem do lote que comprove essa atividade.",
          is_active: true,
          certificate_logo: logoSPDH
        }
      ];

      var units = [
        { id: ids.unitKg, name: "Quilograma", symbol: "kg" },
        { id: ids.unitCx, name: "Caixa", symbol: "cx" }
      ];

      var demoProfile = {
        id: ids.demoProfile,
        telephone: "4184707225",
        description: "Usuário de Demonstração",
        logo_image: logoFarmer,
        profile_image: null,
        birth_date: null,
        subscription_id: null,
        is_demo: true
      };

      var farms = [
        {
          id: ids.farm1,
          farmer_profile_id: ids.demoProfile,
          name: "Fazenda Demonstrativa",
          street: "Rua dos Louros",
          number: null,
          neighborhood: "Fazendinha",
          extra: "",
          city_id: RA.cityId("PR", "Curitiba"),
          state_id: "PR",
          latitude: null,
          longitude: null,
          zip_code: "00000000",
          ccir: null,
          total_hectares: 10.0
        },
        {
          id: ids.farm2,
          farmer_profile_id: ids.demoProfile,
          name: "Chácara Recanto Verde",
          street: "Estrada Municipal",
          number: "1200",
          neighborhood: "Zona Rural",
          extra: "",
          city_id: RA.cityId("PR", "São José dos Pinhais"),
          state_id: "PR",
          latitude: -25.5847,
          longitude: -49.1239,
          zip_code: "83005000",
          ccir: null,
          total_hectares: 12.0
        }
      ];

      var tms = [
        { id: ids.tm1, farmer_profile_id: ids.demoProfile, name: "Paulo Santos", number: "1234", number_type: "CREA" },
        { id: ids.tm2, farmer_profile_id: ids.demoProfile, name: "Carlos Siqueira", number: "4321", number_type: "CREA" }
      ];

      var certs = [
        {
          id: ids.cert1,
          farmer_profile_id: ids.demoProfile,
          certifier: "IBD",
          number: "128744",
          certificate_type_id: ids.certOrganico,
          valid_until_date: null
        },
        {
          id: ids.cert2,
          farmer_profile_id: ids.demoProfile,
          certifier: null,
          number: null,
          certificate_type_id: ids.certSPDH,
          valid_until_date: null
        }
      ];

      var b1 = {
        id: "7919e17f-2beb-4fee-be6b-7120ae714394",
        farm_id: ids.farm1,
        product_id: maca.id,
        unit_id: ids.unitKg,
        technical_manager_id: ids.tm1,
        certificate_ids: [],
        number: "N04J21",
        harvest_date: RA.isoDate(daysAgo(3)),
        created_at: daysAgo(3).toISOString(),
        image: batchImage
      };
      var b2 = {
        id: "feff227f-92f6-4812-9237-5387fd3a4509",
        farm_id: ids.farm2,
        product_id: batata.id,
        unit_id: ids.unitCx,
        technical_manager_id: ids.tm2,
        certificate_ids: [ids.cert1],
        number: "N04J22",
        harvest_date: RA.isoDate(daysAgo(2)),
        created_at: daysAgo(2).toISOString(),
        image: null
      };
      var b3 = {
        id: "c34ac5dc-2945-449b-b9c6-55f3f4fe887b",
        farm_id: ids.farm2,
        product_id: alface.id,
        unit_id: ids.unitCx,
        technical_manager_id: ids.tm1,
        certificate_ids: [ids.cert1, ids.cert2],
        number: "N04J23",
        harvest_date: RA.isoDate(daysAgo(1)),
        created_at: daysAgo(1).toISOString(),
        image: null
      };

      var tags = [
        { id: "174bb233-7f4e-42c6-8132-a85dbfadd314", batch_id: b1.id, date: daysAgo(3).toISOString(), amount: 10 },
        { id: "c07d2a74-1bea-4d21-96aa-967f74bd7b0e", batch_id: b2.id, date: daysAgo(2).toISOString(), amount: 30 }
      ];

      var j1 = {
        id: "88e30755-b0d1-49b3-b80b-c3ff0af46a86",
        creation_date: RA.isoDate(daysAgo(20)),
        field_identification: "Talhão 1",
        farm_id: ids.farm1,
        total_hectares: 12,
        product_ids: [maca.id],
        last_cultural_method: null,
        plantation_date: RA.isoDate(daysAgo(20)),
        harvest_date: null,
        has_subsolagem: true,
        has_aracao: false,
        has_enxada_rotativa: false,
        has_gradagem_leve: true,
        has_gradagem_pesada: false,
        has_gradagem_niveladora: false,
        extra_soil_preparation_operation: null,
        is_practice_not_required: true,
        has_plantio_nivel: false,
        has_terracos: false,
        has_rotacao_culturas: false,
        has_adubacao_verde: false,
        has_plantio_direto: false,
        extra_soil_preparation_practice: null,
        has_origem_propria: true,
        origem_terceiros: null,
        has_tratamento_termico: false,
        irrigation_method: "Água",
        water_source: "Represa",
        polygon: null
      };
      var j2 = RA.clone(j1);
      j2.id = "74f93d03-01c2-403d-9888-f65e004c6453";
      j2.field_identification = "Talhão 2";
      j2.farm_id = ids.farm2;
      j2.creation_date = RA.isoDate(daysAgo(10));
      j2.plantation_date = RA.isoDate(daysAgo(10));

      var fert = [
        {
          id: "a90081d1-2ef2-4d32-ae75-ddccebaaace3",
          farm_journal_id: j1.id,
          application_date: RA.isoDate(daysAgo(15)),
          formula_name: "Adubo",
          dose: 10,
          unity: "KGM",
          application_method: "Aplicação manual",
          application_responsible: "João Nunes",
          note: null
        },
        {
          id: "90bcd911-0e09-49a9-a278-28ec9893bbfe",
          farm_journal_id: j1.id,
          application_date: RA.isoDate(daysAgo(14)),
          formula_name: "Cal",
          dose: 2,
          unity: "KGM",
          application_method: "Aplicação manual",
          application_responsible: "João Nunes",
          note: null
        }
      ];
      var pest = [
        {
          id: "bc2ab075-b654-4c5b-b2c5-fa01b7db5299",
          farm_journal_id: j1.id,
          date: RA.isoDate(daysAgo(12)),
          grace_period: "3 meses",
          target_disease: "Fungo",
          product_name: "Defensivo XYZ",
          dose: "125 ml por m2",
          volume: "150",
          operator: "Antônio Carlos da Silva"
        }
      ];
      var harv = [
        {
          id: "67fa01a6-a5e6-4047-9c95-247018042c6c",
          farm_journal_id: j1.id,
          date: RA.isoDate(daysAgo(5)),
          amount: "1200 pés de alface",
          destination: "CEASA/PR",
          responsible: "Antônio Carlos da Silva"
        }
      ];
      var post = [
        {
          id: "c6d3cd92-fd7d-4ea6-a030-f38dccdcebe7",
          farm_journal_id: j1.id,
          date: RA.isoDate(daysAgo(4)),
          product_name: "Produto XYZ",
          dose: "120 ml",
          grace_period: "3 meses",
          responsible: "Antônio Carlos da Silva"
        }
      ];

      var demoUser = {
        id: ids.demoUser,
        farmer_profile_id: ids.demoProfile,
        name: "Usuário de Demonstração",
        email: "demo@user.com",
        cpf_cnpj: "49512766078",
        is_staff: false,
        is_superuser: false,
        is_farmer: true,
        is_active: true,
        date_joined: RA.nowISO(),
        person_type: "PF",
        last_login: null
      };
      var staffUser = {
        id: ids.staffUser,
        farmer_profile_id: null,
        name: "Staff User 1",
        email: "staff1@user.com",
        cpf_cnpj: "38619452070",
        is_staff: true,
        is_superuser: true,
        is_farmer: false,
        is_active: true,
        date_joined: RA.nowISO(),
        person_type: "PF",
        last_login: null
      };

      return Promise.all([
        db.putMany("products", products),
        db.putMany("units", units),
        db.putMany("certificate_types", certificateTypes),
        db.put("farmer_profiles", demoProfile),
        db.putMany("farms", farms),
        db.putMany("technical_managers", tms),
        db.putMany("certificates", certs),
        db.putMany("batches", [b1, b2, b3]),
        db.putMany("batch_tags", tags),
        db.putMany("farm_journals", [j1, j2]),
        db.putMany("fertilizing_entries", fert),
        db.putMany("pesticide_entries", pest),
        db.putMany("harvest_entries", harv),
        db.putMany("postharvest_entries", post),
        RA.api.setPassword(demoUser, "demo"),
        RA.api.setPassword(staffUser, "test")
      ]);
    });
  }

  RA.seed = {
    ensure: function () {
      return db.get("meta", "seed").then(function (m) {
        if (m && m.version >= SEED_VERSION) return;
        return seed().then(function () {
          return db.put("meta", { id: "seed", version: SEED_VERSION, at: RA.nowISO() });
        });
      });
    },
    reset: function () {
      return db.clearAll().then(function () {
        return RA.seed.ensure();
      });
    }
  };
})(window);
