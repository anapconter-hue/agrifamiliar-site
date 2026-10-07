$(document).ready(function() {

	// Labels dinâmicos
	function updateLabels() {
		var type = $("#id_user_set-0-person_type").val();

		var labelName = $("label[for=id_user_set-0-name]");
		var labelCPF = $("label[for=id_user_set-0-cpf_cnpj]");
		var birthDateField = $("#id_birth_date").closest("li");
		var cpfField = $("#id_user_set-0-cpf_cnpj");
		var telephoneField = $("#id_telephone");
		telephoneField.inputmask({mask: ['(99) 9999-9999', '(99) 99999-9999'], greedy: false});


		if (type === "PF") {
			// Labels
			labelName.text("Nome completo:")
			labelCPF.text("CPF:");

			// Fields
			birthDateField.show();

			// Masks
			$(cpfField).inputmask("999.999.999-99");
		} else {
			// Labels
			labelName.text("Nome ou razão social:")
			labelCPF.text("CNPJ:");

			// Fields
			birthDateField.hide();

			// Masks
			cpfField.inputmask("99.999.999/9999-99");
		}
	}

	updateLabels();
	$("#id_user_set-0-person_type").on("change", updateLabels);

	// Máscara para CEP
	$("input[name$=-zip_code]").inputmask("99.999-999");
	$("#id_farm_set-ADD").on("click", function() {
		$("input[name$=-zip_code]").inputmask("99.999-999");
	});


});