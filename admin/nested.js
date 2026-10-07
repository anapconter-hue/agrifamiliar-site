/*
 * Tabelas internas do painel (Vue 2 + vue-data-table + vue-js-modal):
 *  - core/templates/core/panels/nested_model_admin_panel.html (registros do caderno e
 *    histórico de pagamentos da assinatura)
 *  - products/templates/products/admin/batch_tags_table.html (aba "Etiquetas" do produtor)
 */
(function (window, $) {
  "use strict";

  var RA = window.RA;
  var W = window.W;
  var e = RA.esc;
  var NESTED = (window.NESTED = {});

  var registered = false;
  function setupVue() {
    if (registered) return;
    registered = true;
    Vue.use(window["vue-js-modal"].default, { dynamic: true, injectModalsContainer: true });
    Vue.component("pulse-loader", window.VueSpinner.PulseLoader);
  }
  NESTED.setupVue = setupVue;

  var PANEL_STYLE =
    "<style>\n\t.nested-model-admin-panel {\n\t\tmargin-bottom: 20px;\n\t}\n\t.nested-model-admin-panel .actionbutton {\n\t\tmargin-top: 20px;\n\t    margin-left: calc(50px - .75em);\n\t}\n\n\t.loading-wrapper {\n\t\tpadding: 40px;\n\t}\n\n\t.actionbutton a {\n\t\tcursor: pointer;\n\t}\n</style>";

  // HTML do painel (entrada + template do componente)
  NESTED.panelHTML = function (o) {
    // o: { fieldName, columns, buttonsFieldName, userCanCreate, addLabel, addUrl, addTitle, emptyText }
    var f = o.fieldName;
    return (
      PANEL_STYLE +
      '\n<!-- Entrypoint -->\n<div id="' + f + '-nested-model-admin-entrypoint"></div>' +
      '\n<!-- [TEMPLATES] -->\n<script type="text/x-template" id="' + f + '-nested-model-admin-panel-component" data-ra-template="1"></script>' +
      (o.userCanCreate ? '<span class="ra-add-data" data-label="' + e(o.addLabel || "") + '" data-url="' + e(o.addUrl || "") + '" data-title="' + e(o.addTitle || "") + '" hidden></span>' : "")
    );
  };

  function componentTemplate(o) {
    var cols = o.columns
      .map(function (c) {
        return (
          "\n\t\t\t\t\t\t<td>\n\t\t\t\t\t\t\t<span v-html=\"props.item." + c.field + '"></span>' +
          (c.field === o.buttonsFieldName
            ? '\n\t\t\t\t\t\t\t<ul class="actions">\n\t\t\t\t\t\t\t\t<li v-for="button in props.item._buttons">\n\t\t\t\t\t\t\t\t\t<a v-on:click="onShowModal(button.label, button.url)" v-bind:class="[button.classname]" v-bind:title="button.title" v-html="button.label"></a>\n\t\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t</ul>'
            : "") +
          "\n\t\t\t\t\t\t</td>"
        );
      })
      .join("");
    return (
      '\n\t<div class="nested-model-admin-panel ' + o.fieldName + '-nested-model-admin-panel">\n\t\t<div class="data-table-wrapper">' +
      '\n\t\t\t<data-table-component ref="dataTable" v-bind:tableSetup="tableSetup" v-bind:itemsPerPage="itemsPerPage" v-bind:threshold="threshold" v-bind:dataFetcher="dataFetcher" v-bind:emptyText="\'' + e(o.emptyText) + '\'" v-bind:appendItems="false">' +
      '\n\t\t\t\t<template v-slot:row="props">\n\t\t\t\t\t<tr>' + cols + "\n\t\t\t\t\t</tr>\n\t\t\t\t</template>\n\t\t\t</data-table-component>" +
      '\n\t\t\t<div class="pagination" aria-label="Paginação">\n\t\t\t\t<div class="prev" style="flex-grow: 1; text-align: left;">\n\t\t\t\t\t<a v-if="pagination.hasPrevious" v-on:click="onPreviousPage()" class="icon icon-arrow-left">Anterior</a>\n\t\t\t\t</div>' +
      "\n\t\t\t\t<p>Página {{ pagination.currentPage }} de {{ pagination.totalPages }}.</p>" +
      '\n\t\t\t\t<div class="next">\n\t\t\t\t\t<a v-if="pagination.hasNext" v-on:click="onNextPage()" class="icon icon-arrow-right-after">Próximo</a>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t</div>' +
      (o.userCanCreate
        ? '\n\n\t\t<div class="actionbutton">\n\t\t\t<a v-on:click="onShowModal(\'' + e(o.addLabel) + "', '" + e(o.addUrl) + '\')" class="button bicolor icon icon-plus" title="' + e(o.addTitle) + '">' + e(o.addLabel) + "</a>\n\t\t</div>"
        : "") +
      "\n\t</div>\n"
    );
  }

  // generateFormModal (nested_model_admin_panel.html)
  function generateFormModal(title, url, onRefreshCallback, onCloseCallback) {
    return {
      template:
        "<div>" +
        '<header class="nice-padding" style="display:flex; flex-direction: row; justify-content: center; align-items: center; margin-bottom:0px;">' +
        '<h1 style="flex-grow: 1">' + title + "</h1>" +
        window.FARMER.CLOSE_SVG.replace("<svg ", '<svg v-on:click="onClose()" ') +
        "</header>" +
        '<div id="modal-content" style="margin: 0px;" v-show="!loading"></div>' +
        '<div class="loading-wrapper" v-if="loading">' +
        "<pulse-loader :color=\"'#107D7E'\"></pulse-loader>" +
        "</div>" +
        "</div>",
      data: function () {
        return { loading: false };
      },
      mounted: function () {
        this.loadData();
      },
      methods: {
        loadData: function () {
          var self = this;
          self.loading = true;
          $.ajax({
            url: url,
            type: "GET",
            contentType: "text/html",
            success: function (response) {
              self.renderHtml(response, function () {
                self.loading = false;
              });
            }
          });
        },
        renderHtml: function (html, callback) {
          var self = this;
          setTimeout(function () {
            if (html === "refresh") {
              if (onRefreshCallback) onRefreshCallback();
              self.$emit("close");
              return;
            }
            var $html = $(html);
            $("#modal-content").empty();
            $("#modal-content").append($html);
            if (callback) callback();
            // "Não, não apague": no original levava a uma página com erro; aqui fecha a janela
            $("#modal-content .ra-cancel-delete").on("click", function (ev) {
              ev.preventDefault();
              self.onClose();
            });
            var form = $("#modal-content form");
            form.on("submit", function (event) {
              event.preventDefault();
              self.loading = true;
              var action = form.attr("action");
              $.ajax({
                url: action,
                type: "POST",
                contentType: "application/x-www-form-urlencoded",
                data: form.serialize(),
                success: function (response) {
                  self.loading = false;
                  self.renderHtml(response, function () {
                    self.loading = false;
                  });
                }
              });
            });
          });
        },
        onClose: function () {
          this.$emit("close");
          if (onCloseCallback) onCloseCallback();
        }
      }
    };
  }

  // initializeNestedModelAdminPanel
  NESTED.initPanel = function (root, o) {
    setupVue();
    var add = $(root).find("#" + o.fieldName + "-nested-model-admin-entrypoint").siblings(".ra-add-data");
    if (add.length) {
      o.addLabel = add.attr("data-label");
      o.addUrl = add.attr("data-url");
      o.addTitle = add.attr("data-title");
    }
    var tableComponentName = o.fieldName + "-nested-model-admin-panel-component";
    var entrypoint = o.fieldName + "-nested-model-admin-entrypoint";
    var tpl = document.getElementById(tableComponentName);
    if (tpl) tpl.innerHTML = componentTemplate(o);
    var columns = o.columns,
      itemsPerPage = o.pageSize,
      fkFieldName = o.fkFieldName,
      parentId = o.parentId;

    Vue.component(tableComponentName, {
      template: "#" + tableComponentName,
      data: function () {
        var self = this;
        var tableColumns = columns.map(function (definition) {
          return { label: definition.label, width: ((1 / columns.length) * 100).toFixed(1) + "%" };
        });
        return {
          tableSetup: { columns: tableColumns },
          itemsPerPage: itemsPerPage,
          threshold: 3,
          pagination: { hasNext: false, hasPrevious: false, totalPages: 1, currentPage: 1 },
          dataFetcher: function (options, callback) {
            var queryParams = { page: options.pageNumber, page_size: itemsPerPage };
            queryParams[fkFieldName] = parentId;
            $.ajax({
              url: o.url + "?" + $.param(queryParams),
              type: "GET",
              contentType: "application/json",
              success: function (response) {
                self.pagination.currentPage = options.pageNumber;
                self.pagination.hasNext = !!response.next;
                self.pagination.hasPrevious = self.pagination.currentPage > 1;
                self.pagination.totalPages = Math.max(1, Math.ceil(response.count / self.itemsPerPage));
                callback(response);
              }
            });
          }
        };
      },
      methods: {
        onNextPage: function () {
          this.$refs.dataTable.onNextPage();
        },
        onPreviousPage: function () {
          this.$refs.dataTable.onPreviousPage();
        },
        onShowModal: function (title, url) {
          var self = this;
          var finalUrl = url + "?fk_field_name=" + fkFieldName + "&parent_id=" + parentId + "&" + fkFieldName + "=" + parentId;
          var FormModal = generateFormModal(
            title,
            finalUrl,
            function () {
              self.$refs.dataTable.refreshData({ keepPage: true });
            },
            function () {
              self.$refs.dataTable.refreshData({ keepPage: true });
            }
          );
          this.$modal.show(FormModal, {}, { height: "auto", width: 800, clickToClose: false });
        }
      }
    });
    new Vue({
      el: "#" + entrypoint,
      template: "<" + tableComponentName + "></" + tableComponentName + ">"
    });
  };

  // ------------------------------------------------------------------ products/admin/batch_tags_table.html
  var TAGS_STYLE =
    "<style>\n\t#tab-etiquetas {\n\tpadding-top: 0px !important;\n\t}\n\t#tab-etiquetas .object {\n\t\tpadding: 0px !important;\n\t}" +
    "\n\t.table-wrapper {\n\tborder-bottom: 1px dashed #d9d9d9;\n\t}" +
    "\n\t.data-table-wrapper table {-webkit-font-smoothing: antialiased;font-family: Open Sans,Arial,sans-serif;line-height: 1.5em;border-collapse: collapse;border-spacing: 0;color: #262626;font-size: 13px;width: 100%;}" +
    '\n\t.data-table-wrapper thead {font-family: "Open Sans","Arial",sans-serif;line-height: 1.5em;border-collapse: collapse;border-spacing: 0;font-size: 1.1em;color: #262626;border-bottom: 1px solid #e6e6e6;}' +
    '\n\t.data-table-wrapper th {font-family: "Open Sans","Arial",sans-serif;line-height: 1.5em;border-collapse: collapse;border-spacing: 0;color: #262626;padding: .6em 1em;vertical-align: top;font-size: .9em;text-align: left;font-weight: 400;white-space: nowrap;text-transform: uppercase;background-color: #fafafa;padding-left: 25px;}' +
    '\n\t.data-table-wrapper tbody {font-family: "Open Sans", "Arial", sans-serif;line-height: 1.5em;border-collapse: collapse;border-spacing: 0;color: #262626;font-size: 13px;overflow: auto;border: 0;}' +
    "\n\t.data-table-wrapper tbody tr {font-family: Open Sans,Arial,sans-serif;line-height: 1.5em;border-collapse: collapse;border-spacing: 0;color: #262626;font-size: 13px;border-top: 1px dashed #e6e6e6;}" +
    "\n\t.data-table-wrapper tbody td {-webkit-font-smoothing: antialiased;font-family: Open Sans,Arial,sans-serif;line-height: 1.5em;border-collapse: collapse;border-spacing: 0;color: #262626;font-size: 13px;padding: 1.2em 1em;vertical-align: top;background-color: inherit;padding-left: 25px;}" +
    "\n\t.pagination {margin-top: 3em;display: flex;flex-direction: row;justify-content: center;border:none;padding-right: 50px;padding-left: 50px;}" +
    "\n\t.pagination .next, .pagination .prev {flex-grow: 1;text-align: left;cursor: pointer;}\n\t.pagination .next {text-align: right;}" +
    "\n\t.data-table-wrapper .actions {-webkit-font-smoothing: antialiased;font-family: Open Sans,Arial,sans-serif;line-height: 1.5em;border-collapse: collapse;border-spacing: 0;color: #262626;margin: 1em 0;padding: 0 0 0 40px;list-style-type: none;padding-left: 0;margin-top: .8em;text-transform: uppercase;margin-bottom: -.5em;font-size: .8rem;visibility: hidden;}" +
    "\n\t.data-table-wrapper tbody tr:hover ul.actions {\n\tvisibility: visible;\n\t}\n</style>";

  NESTED.batchTagsTable = function (root, farmerId) {
    setupVue();
    if (!$(root).find("#batch_tags_app").length) return;
    $(root).find("#batch_tags_app").before(TAGS_STYLE);
    var componentTemplate =
      "<div><div class=\"data-table-wrapper\">" +
      "<data-table-component ref=\"dataTable\" v-bind:tableSetup=\"tableSetup\" v-bind:itemsPerPage=\"itemsPerPage\" v-bind:threshold=\"threshold\" v-bind:dataFetcher=\"dataFetcher\" v-bind:emptyText=\"'Nenhuma etiqueta foi criada para esse produtor.'\" v-bind:appendItems=\"false\">" +
      '<template v-slot:row="props"><tr><td>{{ props.item.id }}<ul class="actions"><li>' +
      "<a v-bind:href=\"'" + RA.url("etiqueta/") + "' + props.item.id + '/'\" class=\"button button-small icon icon-view\" title=\"Visualizar etiqueta\" target=\"_blank\">Visualizar</a>\n" +
      "<a v-bind:href=\"'" + RA.url("etiqueta/imprimir/") + "' + props.item.id + '/'\" class=\"button button-small icon icon-doc-empty\" title=\"Imprimir etiqueta\" target=\"_blank\">Imprimir</a>" +
      "</li></ul></td><td>{{ props.item.product_name }}</td><td>{{ props.item.amount }}</td><td>{{ props.item.batch_number }}</td>" +
      "<td>{{ formatDate(props.item.date) }}</td><td>{{ props.item.farm_name }}</td></tr></template></data-table-component>" +
      '<div class="pagination" aria-label="Paginação"><div class="prev" style="flex-grow: 1; text-align: left;">' +
      '<a v-if="pagination.hasPrevious" v-on:click="onPreviousPage()" class="icon icon-arrow-left">Anterior</a></div>' +
      "<p>Página {{ pagination.currentPage }} de {{ pagination.totalPages }}.</p>" +
      '<div class="next"><a v-if="pagination.hasNext" v-on:click="onNextPage()" class="icon icon-arrow-right-after">Próximo</a></div></div></div>' +
      '<div style="padding: 3em 1em 0px;"><a href="' + W.u("products/batchtag/create/") + '" class="button bicolor icon icon-plus" title="Adicionar um novo etiqueta">Adicionar etiqueta</a></div></div>';

    var comp = {
      template: componentTemplate,
      data: function () {
        var self = this;
        var col = function (l) {
          return { label: l, width: "16.6%" };
        };
        return {
          tableSetup: { columns: [col("Código"), col("Produto"), col("Quantidade"), col("Lote"), col("Emissão"), col("Propriedade")] },
          itemsPerPage: 10,
          threshold: 3,
          pagination: { hasNext: false, hasPrevious: false, totalPages: 1, currentPage: 1 },
          dataFetcher: function (options, callback) {
            var queryParams = { page: options.pageNumber, farmer_id: farmerId };
            $.ajax({
              url: "/admin/products/farmer-batch-tags/?" + $.param(queryParams),
              type: "GET",
              contentType: "application/json",
              success: function (response) {
                self.pagination.currentPage = options.pageNumber;
                self.pagination.hasNext = !!response.next;
                self.pagination.hasPrevious = self.pagination.currentPage > 1;
                self.pagination.totalPages = Math.ceil(response.count / self.itemsPerPage);
                callback(response);
              }
            });
          }
        };
      },
      methods: {
        formatDate: function (strDate) {
          var date = new Date(strDate);
          var year = date.getFullYear(),
            month = date.getMonth() + 1,
            day = date.getDate(),
            hour = date.getHours(),
            minute = date.getMinutes();
          return (
            "" + (day > 9 ? "" : "0") + day + "/" + (month > 9 ? "" : "0") + month + "/" + year + " " + (hour > 9 ? "" : "0") + hour + ":" + (minute > 9 ? "" : "0") + minute
          );
        },
        onNextPage: function () {
          this.$refs.dataTable.onNextPage();
        },
        onPreviousPage: function () {
          this.$refs.dataTable.onPreviousPage();
        }
      }
    };
    new Vue({ el: "#batch_tags_app", render: function (h) {
      return h(comp);
    } });
  };
})(window, window.jQuery);
