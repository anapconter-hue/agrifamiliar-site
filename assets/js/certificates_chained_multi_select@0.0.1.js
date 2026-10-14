$(document).ready(function() {
	function initCheckboxes() {
		$("#id_certificates input").on("change", function(event) {
			var input = event.target;
			var alert = $(input).parent().next();
			if (alert.text() != "") {
				var checked = $(input).prop("checked");
				if (checked) {
					alert.show();
				} else {
					alert.hide();
				}
			}
		});
	}

	initCheckboxes();
	$("#id_certificates").on("options_changed", function() {
		initCheckboxes();
	})

});