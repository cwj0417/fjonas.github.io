$(function() {
	var config = {
		cursor:['/images/ico/you.ico','/images/ico/riko.ico','/images/ico/chika.ico']
	};
	var changeCursor = function(url) {
		$('html').css('cursor', 'url(' + url +'), auto');
	};
	$('a').each(function() {
		var href = $(this).attr('href');
		if(href && href.substr(0, 4) == 'http') {
			$(this).attr('target', '_blank');
		}	
	});
	changeCursor(config.cursor[Math.floor(Math.random()*config.cursor.length)]);
	setInterval(function() {
		changeCursor(config.cursor[Math.floor(Math.random()*config.cursor.length)]);
	}, 60000)
});