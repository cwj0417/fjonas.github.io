$(function() {
	$('a').each(function() {
		var href = $(this).attr('href');
		if(href && href.substr(0, 4) == 'http') {
			$(this).attr('target', '_blank');
		}	
	});
});
window.onload = function(){
    function snowFall(snow) {
        snow = snow || {};
        this.Snow3num = 80;
        this.Snow3Size = 10;
        this.Snow3Speed = 1;
    }
    snowFall.prototype.start = function(){
        snowCanvas.apply(this);
        createFlakes.apply(this);
        drawSnow.apply(this)
    }

    function snowCanvas() {
        var snowcanvas = document.createElement("canvas");
        snowcanvas.id = "snowfall";
        snowcanvas.width = window.innerWidth;
        snowcanvas.height = window.innerHeight;
        snowcanvas.setAttribute("style", "position: fixed; top: 0; left: 0; z-index: 2999; pointer-events: none;");
        document.getElementsByTagName("body")[0].appendChild(snowcanvas);
        this.canvas = snowcanvas;
        this.ctx = snowcanvas.getContext("2d");
        window.onresize = function() {
            snowcanvas.width = window.innerWidth;
            snowcanvas.height = window.innerHeight
        }
    }

    function flakeMove(canvasWidth, canvasHeight, Snow3Size, Snow3Speed) {
        this.x = Math.floor(Math.random() * canvasWidth);
        this.y = Math.floor(Math.random() * canvasHeight);
        this.size = Math.random() * Snow3Size + 2;
        this.maxSize = Snow3Size;
        this.speed = Math.random() * 1 + Snow3Speed;
        this.Snow3Speed = Snow3Speed;
        this.velY = this.speed;
        this.velX = 0;
        this.stepSize = Math.random() / 30;
        this.step = 0;
    }

    flakeMove.prototype.update = function() {
        var x = this.x,
            y = this.y;
        this.velX *= 0.98;
        if (this.velY <= this.speed) {
            this.velY = this.speed
        }
        this.velX += Math.cos(this.step += .05) * this.stepSize;
        this.y += this.velY;
        this.x += this.velX;
        if (this.x >= canvas.width || this.x <= 0 || this.y >= canvas.height || this.y <= 0) {
            this.reset(canvas.width, canvas.height)
        }
    };
    flakeMove.prototype.reset = function(width, height) {
        this.x = Math.floor(Math.random() * width);
        this.y = 0;
        this.size = Math.random() * this.maxSize + 2;
        this.speed = Math.random() * 1 + this.Snow3Speed;
        this.velY = this.speed;
        this.velX = 0;
    };
    flakeMove.prototype.render = function(ctx) {
        var snowFlake = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        snowFlake.addColorStop(0, "rgba(255, 255, 255, 0.9)");
        snowFlake.addColorStop(.5, "rgba(255, 255, 255, 0.5)");
        snowFlake.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.save();
        ctx.fillStyle = snowFlake;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };
    function createFlakes() {
        var Snow3num = this.Snow3num,
            flakes = this.flakes = [],
            canvas = this.canvas;
        for (var i = 0; i < Snow3num; i++) {
            flakes.push(new flakeMove(canvas.width, canvas.height, this.Snow3Size, this.Snow3Speed))
        }
    }
    function drawSnow() {
        var Snow3num = this.Snow3num,
            flakes = this.flakes;
        ctx = this.ctx, canvas = this.canvas, that = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var e = 0; e < Snow3num; e++) {
            flakes[e].update();
            flakes[e].render(ctx);
        }
        this.loop = requestAnimationFrame(function() {
            drawSnow.apply(that);
        });
    }
    var snow = new snowFall({Snow3num:200});
    snow.start();
}