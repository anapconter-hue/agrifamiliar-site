$(document).ready(function() {
	/**
		PREPARO DO SOLO - OPERAÇÕES REALIZADAS
		- Caso algum item do Grupo 1 esteja marcado, o Grupo 2 deverá estar desabilitado.
		- Caso o item do Grupo 2 esteja preenchido, todos os itens do Grupo 1 deverão estar desmarcados.
		Grupo 1
			- Subsolagem
			- Aração
			- Enxada rotativa
			- Gradagem com grade leve
			- Gradagem com grade pesada
			- Gradagem com grade niveladora
		Grupo 2
			- Outros
	*/
	(function setupOperacoesRealizadas() {
		var $parent = $("#id_has_subsolagem").closest(".multi-field");
		var $group1 = $parent.find("input[type=checkbox]");
		var $group2 = $("#id_extra_soil_preparation_operation");

		$group1.on("change", function () {
			var anyIsChecked = $group1.filter(":checked").length > 0;
			if (anyIsChecked) {
				$group2.val("");
			}
		});

		$group2.on("input", function() {
			$group1.prop('checked', false);
		});


	})();

	/**
		PREPARO DO SOLO - ADOÇÃO DE PRÁTICAS CONSERVACIONISTAS
		- Caso o item do Grupo 1 esteja marcado, todos os itens do Grupo 2 deverão estar desmarcados e o campo Outros desabilitado.
		- Caso algum item do Grupo 2 esteja marcado e/ou o campo Outros preenchido, o item do Grupo 1 deverá estar desmarcado.
		Grupo 1
			- Não são necessárias
		Grupo 2
			- Plantio em nivel
			- Terraços
			- Rotação de culturas
			- Adubação verde
			- Outros
	*/
	(function setupPraticasConservacionistas() {
		var $parent = $("#id_is_practice_not_required").closest(".multi-field");
		var $group1 = $("#id_is_practice_not_required");
		var $group2 = $parent.find("input[type=checkbox]:not(#id_is_practice_not_required),textarea");

		$group1.on("change", function() {
			if ($group1.prop("checked")) {
				$group2.filter("input[type=checkbox]").prop('checked', false);
				$group2.filter("textarea").val("");
			}
		});

		$group2.filter("input[type=checkbox]").on("change", function() {
			var anyIsChecked = $group2.filter(":checked").length > 0;
			if (anyIsChecked) {
				$group1.prop('checked', false);
			}
		});

		$group2.filter("textarea").on("input", function() {
			$group1.prop('checked', false);
		});
	})();

	/**
		SEMENTES E MUDAS
		- Caso o item do Grupo 1 esteja marcado, o item do Grupo 2 deverá estar desabilitado.
		- Caso o item do Grupo 2 esteja preenchido, o item do Grupo 1 deverá estar desmarcado.
		- O Grupo 3 é independente.
		Grupo 1
			- Origem própria
		Grupo 2
			- Origem de terceiros (local)
		Grupo 3
			- Viveiro com tratamento térmico

	*/

	(function setupSementesEMudas() {
		var $group1 = $("#id_has_origem_propria");
		var $group2 = $("#id_origem_terceiros");

		$group1.on("change", function() {
			if ($group1.prop("checked")) {
				$group2.val("");
			}
		});

		$group2.on("input", function() {
			$group1.prop("checked", false);
		});

	})()
});