---
title: webpack执行流程
categories: 工作笔记
date: 2023-05-31 08:01:00
tags: [webpack]
---
接上回asset module的时候没有说基础概念.

这里说一下执行一次webpack流程的最外层的行为, 之后有时间的话再继续深入.

<!--more-->

## 准备

在正文前, 必须得先说说我是怎么调试的, 和tapable. 看似和内容无关, 但是自己去看过程里必须的内容.

另外有一些asyncqueue和arrayqueue还比较简单可以晚点看.

### 怎么调试好

不管别人的看法, 起码在这个场景, 我认为最好的调试办法是: 看源码+console.log+debug结合.

光下断点跟着一步步走, 根本不知道自己在走点啥, 哪个方法应该进去, 哪个应该跳过, 该进没进的话则莫名其妙事情都做好了, 不该进也进的话跟着被绕晕. 如果光下断点就能看懂, 那我们也不会讨厌报错堆栈里的react报错了.

来说说我的做法(不一定最合理, 有场景关系):

用cra创建了个简单的项目, 然后eject. 然后把首页写得很简单, 减少模块, 把代码改成想看的问题的最小实现.

然后到node_modules里该console就console, 该断点就断点. 用vscode的npmscript或者debugger跑build.

在过程中可以不断调整webpack配置和项目代码.

### tapable

下面说几个我认为比较重要的点. 细节也可能在以后的文章里说.

+ tapable是wepack中占比很大的方法调用手段. 其次可能是callback.
+ 一些核心功能和一些可选功能都是通过tapable调用的. 所以产生了个难点: 理调用关系的时候要付出额外精力.
+ tapable的hooks有很多类型, 效果是不同的.

其实很多额外功能是通过tapable实现的, 所以理论来说, 厉害的人自己也可以通过plugin来二开webpack.

## 执行流程

我这里执行的是build流程, dev流程中间的流程也是一样的, 可以以后再看.

和以前一样, 先说总结, 如果有兴趣的或者正在看webpack的可以去下一部分看细节.

### 总结流程

1. 调用`webpack()`, 创建包含`webpackOptions`的`compiler`, 并调用内部和外部plugins来注册hooks.
2. 调用`compiler.run()`. `run()`里调用`compiler.compile()`.
3. `compile()`创建`compilation`实例, (`compilation`里也是包含`webpackOptions`的信息的).
4. 进行make阶段: 比较特殊的是, 这里啥都没做, 主流程是通过tapable调用的.
5. make的hooks触发了`EntryPlugin`的`compilation.addEntry()`. (`EntryPlugin`是在第一步注册的)
6. 随着`addEntry()`一路调用, 用`factory`创建`module`, 并调用`module.build()`. (这里我们简单理解为make阶段一系列执行后, `compilation`的内部状态有了改变)
7. 进入seal阶段, 调用`compilation.seal()`, 生成`ChunkGraph`, 并设置`compilation.assets`.
8. 进入emit阶段, 调用`compiler.emitAssets()`, 通过`compilation.getAssets()`获取到assets, 并用nodeapi写到磁盘.

### 总结结构

刚接触plugin的时候, 好奇为什么每次都tap compile再tap compilation, 现在这系列问题有了答案.

+ 一次`webpack()`调用可以有多个`compiler`. 在webpack配置是数组的情况下, 所以一般是一个.
+ 一个`compiler`可以有多个`compilation`. `compilation`指是在`compiler.compile()`调用的时候被实例化. `compiler`的生命周期是比`compilation`长的.
+ 一次`compile()`流程: 创建`compilation`, make阶段: 创建module并build并整理moduleGraph, seal阶段整理chunkGraph生成assets, emit阶段根据assets写文件到磁盘.

### 细节

`lib/webpack.js`: 调用`webpack()`, 调用到: `compiler = createCompiler(webpackOptions)`创建compiler.

```js
const createCompiler = rawOptions => {
	const options = getNormalizedWebpackOptions(rawOptions);
	applyWebpackOptionsBaseDefaults(options);
	const compiler = new Compiler(options.context, options);
	new NodeEnvironmentPlugin({
		infrastructureLogging: options.infrastructureLogging
	}).apply(compiler);
	if (Array.isArray(options.plugins)) {
		for (const plugin of options.plugins) {
			if (typeof plugin === "function") {
				plugin.call(compiler, compiler);
			} else {
				plugin.apply(compiler);
			}
		}
	}
	applyWebpackOptionsDefaults(options);
	compiler.hooks.environment.call();
	compiler.hooks.afterEnvironment.call();
	new WebpackOptionsApply().process(options, compiler);
	compiler.hooks.initialize.call();
	return compiler;
};
```

`createCompiler()`里做的事:

+ `getNormalizedWebpackOptions()`, `applyWebpackOptionsBaseDefaults()`和后面的`    applyWebpackOptionsDefaults(options)`整理配置.
+ 通过整理后的配置实例化`compiler`.
+ 调用配置里的plugin. 这里的细节我们可以知道为什么plugin的类只有一个`apply()`, 也知道了, 如果plugin不需要option, 可以用函数来代替类.
+ 通过`applyWebpackOptionsDefaults()`调用一系列plugin.
+ 暴露了一系列hooks.

`lib/Compiler.js`: 创建完`compiler`后调用了`run()`. `run()`里调用了一些钩子后就调用`compile()`.

用配置实例化`compilation`. (先通过配置创建2个factory, 传给compilation构造函数, 这个以后再展开).

调用`make`hooks: `this.hooks.make.callAsync()`.

在`lib/EntryPlugin.js`中注册了`make`的行为:

```js
compiler.hooks.make.tapAsync("EntryPlugin", (compilation, callback) => {
  compilation.addEntry(context, dep, options, err => {
    callback(err);
  });
});
```

于是调用了`compilation`的`addEntry()`. 顺着一串会创建module, build. 我们简单地理解为build完以后更新了`compilation`内部的一些属性, 以便后续使用.

回到`compiler`, 在`make`的回调里调用了`compilation.seal()`, 根据配置把所有模块进行chunk.

然后在`compile()`的回调里通过`compilation.getAssets()`获取内容, `compilation.getPath()`获取目的文件夹, 把编译结果输出.

## todo

下一篇文章应该是进一步展开make, seal, emit. 

这三个步骤展开以后, 我猜可能对webpack的掌控感就比较强了.

如果再有空, 把make阶段的再深入一点. 或者分析一些别的细节.
