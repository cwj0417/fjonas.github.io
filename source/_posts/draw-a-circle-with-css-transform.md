---
title: 用transform画一个圆
date: 2019-03-26 14:24:53
categories: 编码与分析
tags: [应用]
---
{% raw %}

<div class="stage"></div>

<style>
	.stage {
		width: 200px;
		height: 200px;
        margin: 0 0 50px 25px;
		transform-style: preserve-3d;
		animation: rotate 10s infinite linear;
	}
	.spot {
		width: 8px;
		height: 8px;
		top: 96px;
		left: 96px;
		background: #03A9F4;
		box-shadow: 0 0 5px #000000;
		border-radius: 50%;
		position: absolute;
	}
	@keyframes rotate {
		0% {
			transform: rotate3d(1, 1, 1, 0deg);
		}
		100% {
			transform: rotate3d(1, 1, 1, 360deg);
		}
	}
</style>
<script>
	let stage = document.getElementsByClassName('stage')[0]
	function addSpot (angleLO, angleLA) {
		let spot = document.createElement('div')
		spot.className = 'spot'
		spot.style.transform = `rotate3d(${Math.cos(angleLO)}, ${Math.sin(angleLO)}, 0, ${angleLA}deg) translateZ(100px)`
		stage.appendChild(spot)
	}
	let longitudeNum = 20
	let latitudeNum = 18
	let radius = 100
	for (let i = 0; i < latitudeNum; i++) {
		for (let j = 0; j < longitudeNum; j++) {
			addSpot(i / latitudeNum * 360 * Math.PI / 180, j / longitudeNum * 360)
		}
	}


</script>

{% endraw %}

{% raw %}

<div class="square">
    <div class="top">1</div><div class="bottom">2</div><div class="left">3</div><div class="right">4</div><div class="front">5</div><div class="back">6</div>
</div>

<style>
	.square {
		width: 100px;
		height: 100px;
		margin: 100px;
		transform-style: preserve-3d;
		animation: rotate 4s infinite linear;
	    top: 0;
    	right: 0;
    	position: absolute;
	}
	.square > div {
		width: 100px;
		height: 100px;
		position: absolute;
		font-size: 40px;
		line-height: 100px;
		text-align: center;
		color: #fff;
		opacity: 0.5;
	}
	.top {
		transform: rotateX(90deg) translateZ(50px);
		background-color: #ABFF96;
	}
	.bottom {
		transform: rotateX(-90deg) translateZ(50px);
		background-color: #F99F6D;
	}
	.left {
		transform: rotateY(90deg) translateZ(50px);
		background-color: #F859A3;
	}
	.right {
		transform: rotateY(-90deg) translateZ(50px);
		background-color: #B869FB;
	}
	.front {
		transform: translateZ(50px);
		background-color: #3F92FB;
	}
	.back {
		transform: translateZ(-50px);
		background-color: #C2FF43;
	}
	@keyframes rotate {
		0% {
			transform: rotate3d(0, 1, 1, 0deg);
		}
		50% {
			transform: rotate3d(1, 0, 1, 180deg);
		}
		100% {
			transform: rotate3d(1, 0, 1, 360deg);
		}
	}
</style>

看到soul上的球, 尝试用css画一个球, 本想应用到博客标签栏, 还是感觉不合适, 这篇文章来讲一下用css transform画这个球对这个css的理解.

<!--more-->

## 例子中的图像

通过抄了一个正方体的例子, 模仿了一个球, 因为球的点比较多, 所以不得已使用了js. 通过正方体思考了球表面的点的通解, 代码直接审查元素即可, 可以通过修改参数来调整球的点的个数. *(远古浏览器看不到例子)*

另外, [webpack](<https://webpack.github.io/>)的logo也是一个理解transform的很好的例子, 有兴趣也可以抄一下试试.

## transform的实现

主要用到的css属性是[transform](<https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Transforms/Using_CSS_transforms>)的3d部分, 并没有用到文档所有. transform有2d, 3d之分. 这里要提到几个相关属性: 

+ transform-style, 通过设置父元素的transform-style为`preserve-3d`来使容器内的空间变为3d.
+ transform-origin, 设置transform的轴, 对旋转, 缩放, 拉伸有影响.

无论是2d还是3d, 实现原理都是计算坐标, 3d只是把第三维的坐标通过三角比映射到2d坐标上. [文档](<https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function>)中详细说明了计算方法: **把原始坐标看做一个向量, 把transform的参数(变化方法)作为二维或三维向量, 把两个向量相乘, 获得结果坐标.**

transform有很多参数, 如rotate, translate, scale, skew. 其实都只是几个线性变换的快捷方式, 也就是通过自己计算也可以实现. 例如[rotate](<https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/rotate>)在二维变换中就是把[cos(a), -sin(a), sin(a), cos(a)]的2*2矩阵与初始坐标相乘.

为什么要知道一点transform是如何计算的? 因为光试属性会发现一些莫名其妙的现象, 光去猜测需要花更多的时间来掌控这些transform-function. 接下来很简单地介绍下transform-function和基本用法.

## transform-function

所有的function在上面发过的[文档](<https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function>)中都有, 这里简单的说一下transform都能做些什么变换. 注意, 所有变化都是可2d, 可3d的.

+ rotate系列, 作用是旋转, 默认轴是左上, 通过设置transform-origin改变.
+ translate系列, 作用是移动, 这个移动在画立体图形上非常有用, 并且需要仔细理解, 因为可以在第三维上移动, 并和其他transform-function有组合效果.
+ scale和skew系列, scale是保持比例的缩放, skew不保持比例, 在3d上用的时候可以改变模型的形状.
+ perspective, 调整视角.
+ matrix和matrix3d. 自定义线性变换. 当然可以操作任何其他的, 例如` matrix(cos(5), -sin(5), sin(5), cos(5), 0, 0)`就等价于`rotate(5)`. 看来对线性代数理解深的可以创造更有意思的线性变换吧.

这些变换都是可以叠加使用的, 同系列的也可以, 像: `transform: rotate(5deg) rotateX(10deg) rotateY(20deg)`都是可以的.

知道了这些知识就可以开始画方画圆啦.

## 如何把脑子里的图形画出来

之前使用transform都是比较简单的图形, 所以其实写错了, 但效果差距不多, 记得我之前自己画过一个方块, 但六个面并不能无缝连接起来, 当时没细想也就过去了. (甚至没有想过是自己的问题, 还觉得css只能实现成这样). 现在仔细思考, 自己画了一个球, 在过程中发现了几个比较重要的注意点, 并总结了画图形的思路.

先来说总体思路.

1. 在脑子里呈现你想画的图形.
2. 思考图形可以由哪些面组成.( 比如圆形就很多小面积的面.) 因为web里只有div, 也就是一个个面.
3. 思考可以有所有面通解公式的原点在哪里.
4. 创建所有面.
5. 把所有的面absolute定位到原点, 并设置通用css.
6. 思考公式, 把公式运用到每个面上.

至于公式的写法, 可以用这样的思路:

首先要明确: 你在操作向量. 如果按照之前的操作, 所有的面已经定位到原点了. 只要思考, 如何从原点*运动到*他应该在的地方就行了.

最后说一下注意的点, 也是之前画错图形的原因!

+ 因为矩阵乘法不满足交换律, 所以transform-function的顺序要注意. 从物理意义上思考, 一个向量先转向再直行, 和先直行再转向, 最后当然会到不同的地方了.
+ 坐标是一个向量, 而不是一个点, 一定要确定原点和坐标系方向再进行变换. 不然会变到莫名其妙的地方.

最后, 上面例子中把画好的图形加了各角度旋转的动画是为了证明图形没有画错.