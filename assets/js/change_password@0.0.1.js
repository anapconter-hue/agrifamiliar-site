var ChangePasswordModal = {
	template: "" +
	"<div>" +
		'<header class="nice-padding" style="display:flex; flex-direction: row; justify-content: center; align-items: center; margin-bottom: 20px;">' +
			'<h1 style="flex-grow: 1">Alterar senha</h1>' +
			'<svg style="cursor: pointer; width: 20px; height: 20px;" v-on:click="onClose()" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
				'<path fill="#ffffff" d="M13.313 11.313c0 0.219-0.094 0.438-0.25 0.594l-1.219 1.219c-0.156 0.156-0.375 0.25-0.625 0.25-0.219 0-0.438-0.094-0.594-0.25l-2.625-2.625-2.625 2.625c-0.156 0.156-0.375 0.25-0.594 0.25-0.25 0-0.469-0.094-0.625-0.25l-1.219-1.219c-0.156-0.156-0.25-0.375-0.25-0.594 0-0.25 0.094-0.438 0.25-0.625l2.625-2.625-2.625-2.625c-0.156-0.156-0.25-0.375-0.25-0.594 0-0.25 0.094-0.438 0.25-0.625l1.219-1.188c0.156-0.188 0.375-0.25 0.625-0.25 0.219 0 0.438 0.063 0.594 0.25l2.625 2.625 2.625-2.625c0.156-0.188 0.375-0.25 0.594-0.25 0.25 0 0.469 0.063 0.625 0.25l1.219 1.188c0.156 0.188 0.25 0.375 0.25 0.625 0 0.219-0.094 0.438-0.25 0.594l-2.625 2.625 2.625 2.625c0.156 0.188 0.25 0.375 0.25 0.625z"></path>' +
			'</svg>' +
		'</header>' +
		'<div id="modal-content" style="margin: 20px 0px;" v-if="!loading">Hello!</div>' +
		'<pulse-loader v-if="loading" :color="\'#107D7E\'"></pulse-loader>' +
	"</div>",
	data: function() {
		return {
			loading: false
		};
	},
	mounted: function() {
		this.loadData();
	},
	methods: {
		loadData: function() {
			var self = this;
			self.loading = true;
			$.ajax({
			    url: "/api/farmers/change-password/",
			    type: 'GET',
			    contentType: 'text/html',
			    success: function(response) {
			    	self.loading = false;
			    	self.renderHtml(response);
			    }
			});
		},
		renderHtml: function(html) {
			var self = this;
			setTimeout(function() {
				$("#modal-content").html(html);
				var form = $("#modal-content form");
				form.on("submit", function(event) {
					event.preventDefault();
					self.loading = true;
					var action = form.attr("action");
					$.ajax({
						url: action,
						type: 'POST',
						contentType: 'application/x-www-form-urlencoded',
			    		data: form.serialize(),
			    		success: function(response) {
			    			self.loading = false;
			    			self.renderHtml(response);
			    		}
					});
				});
			});
		},
		onClose: function() {
			this.$emit('close');
		}
	}
};


$(document).ready(function() {
	Vue.use(window["vue-js-modal"].default, {dynamic: true, injectModalsContainer: true});

	var app = new Vue({
		el: '#change_password_app',
		template: '<button class="button" v-on:click="onShowModal()" type="button">Alterar senha</button>',
		methods: {
			onShowModal: function() {
				this.$modal.show(ChangePasswordModal, {}, { height: 'auto', width: 800, clickToClose: false });
			}
		}
	});
});