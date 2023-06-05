---
title: webpack进度条plugin
categories: 工作笔记
date: 2023-06-02 14:32:30
tags: [webpack]
---
打包到65%老卡住是为什么? 为什么我的打包没有进度条? 进度条的真实度是怎么样的?

看完就了解.

<!--more-->

本来打算总结make阶段, 偶然间点到这个插件上, 觉得又简单又有用, 插队写个progress-plugin介绍.

这是一个webpack内置插件, 并且会在cli运行的时候加`--progress`的时候自动调用.

## 使用方法

接下来说说使用方法, 我觉得文档写得非常好和全, 这里做一下总结:

这个插件会在webpack的很多个hooks调用, 从而报告编译进度.

根据使用深度, 我认为配置有三层:

1. 配置handler. 上面说到插件会在各个hooks调用, 调用的就是handler, 通过构造函数注册, 不填的话有默认值.
2. 输出内容配置. 这里就有很多配置, 比如是否打印模块数量/入口数量/依赖数量, 多少模块开始调用等等. 没特殊要求的就不用配置, 都有默认值. 如果只配置handler, 就直接传函数到构造函数里就行了.
3. reportProgress. 在自己写的plugin里, 也可以通过api来向插件报告进度, 这样二开`webpack-progress-plugin`的plugin也都能收到你的报告. 但有一定限制, 后面会详细说.

自己用就这样, 很简单, 传个console.log作为handler就可以看到进度了, 而一般在脚手架里都会集成一定程度二开的`webpack-progress-plugin`.

下面看一下这个插件是怎么实现的, 能对配置有更好的理解.

## 实现方法

实现代码很简单, 所以本文目的是说得不用看也理解, 自己要看的话在`lib/ProgressPlugin.js`.

分三部分讲:

### 整理参数

整理参数在`constructor()`和`apply()`里都有.

`constructor()`里先对只有handler的配置做了兼容, 然后设置默认配置, 并赋值给实例的变量, 非常简单.

`apply()`里有2个点.

第一, 对多compiler处理(多compiler是多入口造成的), 处理方式给每个compiler注册一个新的`progress-plugin`, 通过handler报告给自己, 然后处理百分比(把百分比除以compiler的个数), 再调用自己的handler.

第二, 给handler赋默认值, 默认值是compiler里的webpack-logger. 我对这个行为不了解, 先不深入. 但可以知道一个点: `profile`这个配置只在这里生效, 所以就只在没有设置handler的时候生效.

最后调用`_applyOnCompiler()`, 所有路子一定最后都会走到这里, 是progress的核心. 多compiler的case只不过不调用这个实例的`_applyOnCompiler()`, 调用的是注册在每个子compiler里progress实例的`_applyOnCompiler()`.

### 实现主体

一句话说, 实现方法就是**在很多hooks里注册handler.** 于是hooks被call的时候就会调用handler了.

有一些hooks执行比较久, 就会用`intercept()`来指定开始或/和结束时调用.

但注册hooks的时候又不像我们写plugin时候那么单纯, 分为了2种情况.

(这2种情况在代码层面是可以交叉的, 但业务上可能不允许, 所以没有成为4种情况)

#### 重复调用的hooks

在整个流程中, 因为module是有多个的, 所以module相关的hooks是会被调用多次的.

很明显地, 在调用这些hooks的时候需要知道调用到的current/total module.

面对这个问题, 解决方法是:

1. 设置一些变量, 来记住module/entry/dependency总数, 和当前完成数.
2. 在一些特定的hooks触发的时候来改变这些变量. 举例: `factorizeQueue`的hooks, 让`dependenciesCount`数量加一.
3. 在改变了这些变量后, 节流地来调用handler.
4. 调用handler的时候, 会读取`percentBy`配置来决定怎么报告百分比.

贴一下刚才例子的相关代码:

```js
compilation.factorizeQueue.hooks.added.tap(
  "ProgressPlugin",
  factorizeAdd
);
```

```js
const factorizeAdd = () => {
  dependenciesCount++;
  if (dependenciesCount < 50 || dependenciesCount % 100 === 0)
    updateThrottled();
};
```

```js
const updateThrottled = () => {
  if (lastUpdate + 500 < Date.now()) update();
};
```

update方法太长不贴了,  就是整理一些参数, 最后调用handler.

#### reportProgress

在剩余的流程中只会调用一次的hooks, (其实只有make阶段会重复调用很多module相关的hooks), 其他hooks都还支持被其他plugin报告.

方法是通过`static getReporter()`暴露一个动态的方法.

这个被暴露的方法在一些hooks开始的时候被注册, 结束的时候被注销. 

这个方法调用效果是直接调用handler, 但百分比数量已经被指定. (但还要传, 这个设计有点尴尬, 可能是为了以后, 具体我不懂)

实现上述方法的办法也是`intercept()`. 随便来看一个:

```js
compilation.hooks[name].intercept({
    name: "ProgressPlugin",
    call() {
      handler(percentage, "sealing", title);
    },
    done() {
      progressReporters.set(compiler, undefined);
      handler(percentage, "sealing", title);
    },
    result() {
      handler(percentage, "sealing", title);
    },
    error() {
      handler(percentage, "sealing", title);
    },
    tap(tap) {
      // p is percentage from 0 to 1
      // args is any number of messages in a hierarchical matter
      progressReporters.set(compilation.compiler, (p, ...args) => {
        handler(percentage, "sealing", title, tap.name, ...args);
      });
      handler(percentage, "sealing", title, tap.name);
    }
  });
```

## 总结

看完代码, 很简单, 总结回答一下文章开头的问题, 和延展一下想到的问题.

### webpack进度条的意义

先说说为什么webpack的build没进度. 这个最简单, 可能是: 

+ 没加载插件.
+ handler没有输出在控制台.
+ 配置没达标. (比如`modulesCount`, 具体看文档)

然后说说webpack进度条代表了什么: **webpack流程中一些固定步骤, 这个插件给每个步骤定义了一个进度百分比, 运行到的时候就会调用handler输出.**

想知道有哪些固定步骤? 很简单, 直接把handler设为console.log就行了, 比看代码还清楚. 我看了下, 结论是:

+ 大多进度都是写死的, 比如0, 0.1, 0.95, 1. 等等. 只有2段进度是计算的.
+ 第一段是0.1\~0.65, make阶段, 会根据modules算, make阶段作者定义是10%\~65%的进度, 也能说明作者认为这个阶段是最花时间的.
+ 第二阶段是0.7\~0.95, seal阶段, 其实也是固定的, 但是根据一个hooks列表计算的. (我表达得不好, 不理解就看代码, 一看就明白)

### 一般这个插件什么姿势来使用

我这样典型对webpack不太了解的, 一般不会主动去用他, 一般都是公司/社区做好的脚本里带着的.

自己用的话很简单, 但效果不好, 因为我这样的人只会console.log.

我公司的脚手架(可能是社区方案) `progress-webpack-plugin`, 做的事情就是二开handler, 用chalk和log-update包装一下handler, 让控制台输出产生"进度条"的感觉.

还看了umi的, umi在dev时的行为我有点看不懂, 生产的时候用了`webpack-bar`, 也是用chalk和progress包了一下handler.

另外, 还有在自己的plugin reportProgress的写法, 但说实话作用不大, 因为只能报告一个参数, 进度不能自己控制. 我们来看这个插件自己的测试用例: 

```js
module.exports = {
	externals: {
		data: "commonjs " + path.resolve(__dirname, "data.js")
	},
	plugins: [
		new webpack.ProgressPlugin((value, ...messages) => {
			data.push(messages.join("|"));
		}),
		{
			apply: compiler => {
				compiler.hooks.compilation.tap("CustomPlugin", compilation => {
					compilation.hooks.optimize.tap("CustomPlugin", () => {
						const reportProgress = webpack.ProgressPlugin.getReporter(compiler);
						reportProgress(0, "custom category", "custom message");
					});
				});
			}
		}
	]
};
```

这个用例包含2个plugin, 第二个plugin发起了reportProgress, 第一个plugin拦截了handler, 把报告的内容存到了`data`里, 然后`data`里就会收到`custom category`的进度报告.

### 可以自己实现不用他吗, 插件可以加载多次吗

从上面的例子可以看到, 通过reportProgress, 可以让2个plugin之间产生联系.

所以最佳实践应该是, plugin作者通过reportProgress来报告进度, progress生态作者二开hander. 另外如果自己有特殊需求也可以通过在自己插件里调用`webpack-progress-plugin`来二开.

另外我产生的疑问是插件可不可以多次加载, 因为有些插件内部加载了`webpack-progress-plugin`, 可能在无意间加载了多次. 答案是可以的. 其实如果对tapable和class了解, 就能推出这个行为.
