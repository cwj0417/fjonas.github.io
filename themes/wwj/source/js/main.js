$(function() {
	$('a').each(function() {
		var href = $(this).attr('href');
		if(href && href.substr(0, 4) == 'http') {
			$(this).attr('target', '_blank');
		}	
	});
});