---
title: 简单说一嘴asset module
categories: 工作笔记
date: 2023-05-23 11:55:50
tags: [webpack]
---
续上次接了svgr插件, 产生的疑问, 可不可以不实用`file-loader`的情况来加载svgr, 简单的看了下记录个结论.

<!--more-->

## 目标和问题

前面的文章已经提到, 因为迁移关系, 我们期望的目标是: 通过`{ ReactComponent }`来把svg作为组件引入, 并且default引入行为是base64.

为了达到目的, 除了加载svgr外, 还需要依赖file-loader.

而在公司脚手架里是没有使用file-loader的, 使用的是webpack的asset module.

而在文档里, webpack的asset module只能通过`resouceQuery`来区分base64还是组件. 这样需要用户改代码, 这是不可接受的. 所以只能加file-loader的依赖了.

## 原因总结

看了下文档和代码, 一句话总结: **配置了rule.type的会被识别为对应的asset module, 并被设置对应的parser和generator, asset module对资源的处理在generate时, 所以一定晚于loader, 不符合svgr的要求.**

细一步说一下同时配置了`rule.type`和svg-loader的时候, 引入到svg module的大概流程:

1. webpack在处理option的时候注册了asset module插件, 为asset module设置了对应的parser和generator.
2. 在module build的时候会先运行loader. svg-loader在此时生效, 效果根据前面的文章分析, 是把svg作为组件, 并作为default export输出.
3. module在parse的时候处理一些参数, 并在generate的时候处理, 最后根据参数来决定把svg-loader处理结果进行类似file-loader的处理.(奇怪的是generate的时候type竟然是javascript, 没深看)

## 细节

说了原因, 这里再说一下具体是哪几个点, 调用了相关的东西的. (以上面说的同时设置rule.type和loader为例)

在`lib/webpackOptionsApply.js`中调用插件:

```js
new AssetModulesPlugin().apply(compiler);
```

插件中, 在`type`属于asset module的`createParser`和`createGenerator`的hook里返回`AssetParser`和`getAssetGenerator`:

```js
normalModuleFactory.hooks.createParser
  .for(ASSET_MODULE_TYPE)
  .tap(plugin, parserOptions => {
    // ...
    return new AssetParser(dataUrlCondition);
  });
```

```js
normalModuleFactory.hooks.createGenerator
  .for(type)
  .tap(plugin, generatorOptions => {
  // ...
    return new AssetGenerator(
      dataUrl,
      filename,
      publicPath,
      outputPath,
      generatorOptions.emit !== false
    );
  });
```

在`lib/NormalModuleFactory.js`中的resolve.TapAsync里, 在遍历了`this.ruleSet.exec()`的结果后, 设置asset module 的type为"asset", 在之后的`this.getParser(type, settings.parser)`, 和`this.getGenerator(type, settings.generator)`的时候, 因为type是"asset"而在module上注册到了asset module的parser和generator. 

在`lib/NormalModule.js`的build方法调用了_doBuild中调用了`runLoaders()`让svgr-loader处理了文件.

并随后在_doBuild的回调中调用了`parse`, 在codeGeneration里调用了`generate`.

最后在`lib/asset/AssetGenerator.js`的`generate`方法中输出了结果. 但asset module在这里的type竟然是javascript, 这个还没深入看, 对我们现在问题来说不太重要.

## todo

说到这里, 我认为有2个点: 一是东西很浅没进入细节, 二是对一些基础概念没解释.

但说了一些应该已经对一个module的流程先后有一定的概念了: module create -> build -> loader -> parse -> codegen. 这些步骤都是webpack的make阶段, 之后还有seal和emit阶段.

所以如果有时间, 打算(按顺序)深入写一下以下内容:

+ webpack简单流程以及一些基础概念, 阶段名字, webpack内部互相调用的代码风格.
+ resolve和run-loader进一步深入.
+ 其他功能的深入. (比如asset module具体实现或者是别的功能dynamic import/module federation/lazy compilation)
