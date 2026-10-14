// It's necessary to add the following variables to the page:
// emptyOriginal: the original text that needs to be replaced
// emptyReplace: the replacement

$(document).ready(function() {
	var el = $("p:contains(" + window.emptyOriginal + ")");
	if (el.length === 0) {
		return;
	}
	var html = el.html();
	html = html.replace(window.emptyOriginal, window.emptyReplace);
	$(el).html(html);
});
