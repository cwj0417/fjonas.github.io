---
title: 如何通过webpack插件修改代码
categories: 工作笔记
date: 2023-01-04 01:06:05
tags: [webpack,webpack-plugin]
---
工作遇到要写webpack插件的情况, 记录一下是如何完成需求的.

因为webpack插件的文档是没有插件相关api的, 要写webpack插件只有通过看webpack代码或webpack插件代码. 所以虽然是调用api级别的代码, 也有记录的价值.

<!--more-->

## 背景和思路

### 需求概述

我领导基于hel-micro开发了个微模块系统, 基本原理非常简单: 把微模块打包成挂在window上的library, 项目加载的时候预加载, 此时window上已经有微模块了, 调用模块的入口也已经经过改造会去从window找, 整个流程就串起来了.

(基础简单, 但整个流程并不简单, 因为包含了打包, 使用的脚手架, 和模块/项目的ci, 控制版本的服务.)

detail到使用微模块的项目, 需要进行2个改造:

1. 在首页进行微模块预加载, 具体是调用一个方法, 传入微模块的名字.
2. 在业务代码中引入微模块. 我们的改动是在普通模块后加"/mlib".

这种改造方案, 有2个问题. 首页改造比较大, 并且每增加一个微模块, 都需要到首页注册, 如果忘记了页面就丢组件了.

### 需求总结

于是想到是不是可以通过webpack插件来解决用户心智负担, 需要做的事情也很简单:

1. 从所有代码中找到微模块的名字. (特征是import的内容包含"/mlib")
2. 修改入口文件, 调用预加载函数, 调用参数是从步骤1中找到的微模块.

### 为什么不走babel

说到修改代码, 其实大家第一反应应该是babel, 说说我考虑不走babel的原因:

1. babel的插件是处里单模块的, 能力范围小, 完不成需求.
2. 加载比webpack麻烦. 需要先找到loader, 再修改option.
3. webpack的流程可以不用babel. (虽然如果用vite, 这就变成了优点, 但公司基建是基于webpack的)

### 要注意的点

在实施过程中还有一些要注意的细节, 如果没注意是达不到目标效果的.

1. 首页的import是修改依赖树的.
2. 添加的代码中有需要走babel的代码.
3. 需要在修改首页前, 就获取到微模块依赖信息. 而处理文件顺序首页是第一处理的.

## 观察webpack流程

要想办法解决上面的问题, 就需要知道文件被webpack处理的流程, 并找到合适的查找和修改的点.

### 代码在webpack里的流程

我们视角里的"文件", 在webpack处理的时候是`module`. 

我关心的module经过的流程是: module -> loaders -> compile. 把webpack的compile中关心的部分展开:

> file(module) -> loaders -> wp parse -> wp codegen
>
> 所有module跑完, 最后wp seal(optimize)

更详细的流程是: (选读, 不重要)

1. 创建module的时候, 通过 设置了parser和generator的`createData`, 一起创建了`JavascriptParser`和`JavascriptGenerator`.
2. compilation调用`executeModule()`.
3. `executeModule()`通过构造的时候注册的`buildQueue`调用module的`build()`.
4. `build()`调用`_doBuild()`, 执行loader, 获得loader返回的值后, 用`RawSource`包一层存起来.
5. `_doBuild()`的回调里调用`parse()`, 获取module的ast.
6. `build()`调用完成,  `executeModule()`继续调用`_codeGenerationModule()`来调用`module.generator.generate()`.
7. `generate()`方法通过 `sourceModule/sorceBlock`, `sourceDependency`, 最后调用到`template.apply()`生成代码.
8. 在外层调用`compilation.seal()`.

上面提到的具体变量方法都在后续在wp plugin的操作中会看到, 但知道了操作方法后, 调用链就没那么重要了.

### 可以遍历ast的点

+ loader. 自己写loader或者babel插件都算是loader流程里的.
+ webpack parse. 通过webpack plugin api 的 JavascriptParser钩子.

### 可以修改ast的点

+ loader. 自己写loader返回字符串, 或者通过babel插件.
+ webpack codegen.
+ webpack optimize.

这里我们发现, webpack parse阶段明明能直接获取ast, 缺不能修改, 因为webpack在调用钩子的前后会记录/恢复状态:

```js
const oldState = this.state;
// ...
this.state = oldState;
```

## 具体操作

说完了思路, 说说具体的api怎么调用.

虽然webpack文档里, 与plugin相关的变量结构都没有. 需要去看webpack代码或者其他插件代码和搜索引擎, 但在写完插件以后, 回头看文档, 我认为webpack文档写得非常好了. 并且在文档里写那么多东西确实不如直接看源码.

### webpack插件开发简介

webpack插件是一个类. 有一个apply方法, 接受参数是compiler. (完, 形式很简单)

webpack会在加载插件的时候调用apply方法并把compiler传进来, 配置插件方法看文档就行.

**plugin的插入方式是Tapable.** 我目前没有深入理解, 简单地认为他是一个发布订阅系统. 在webpack执行的过程中会在指定的一些地方调用指定的方法(并传入一些内部变量作为参数), 插件通过注册这些指定名字钩子, 来获取变量, 并调用api.

另外提一下, webpack内部很多功能也是通过Tapable的方式实现的, 所以甚至可以认为webpack plugin是webpack源码的扩展.

另外, 因为对Tapable的了解基本算不了解, 所以这个可能以后会展开钩子的类型或者Tapable的源码.

### 从webpack plugin 加载loader

```js
compiler.hooks.thisCompilation.tap(pluginname, (compilation) => {
  compiler.webpack?.NormalModule.getCompilationHooks(
    compilation,
  ).beforeLoaders.tap(pluginname, (_, module) => {
    if (module.request.includes('src/index.jsx')) {
      module.loaders.push({
        loader: require.resolve('./loader.js'),
        options: {
          lazy: this.option.lazy ?? false,
        },
        ident: '',
        type: '',
      });
    }
  });
});
```

这个钩子调用在`_doBuild()`中, 调用`runLoaders()`前, 这个点可以插入loader.

在上面的例子中, 我们可以通过`module`里的信息来决定需要执行loader的文件. 还可以把传入plugin的option带给loader的option.

在这里, loader的顺序一定要注意, loaders和redux的middleware一样是反向执行的, push和unshift的的效果是不相同的. (这里知道顺序是matters的就可以, 如果发生了非预期的情况知道调换loader顺序调试就行了)

### parse阶段访问ast

```js
const walk = require('acorn-walk');
compiler.hooks.normalModuleFactory.tap(pluginname, (factory) => {
  factory.hooks.parser.for('javascript/auto').tap(pluginname, (parser) => {
    parser.hooks.import.tap(
      pluginname,
      (_stmt: unknown, source: string) => {
        if (!parser.state?.module?.resource.includes('node_modules')) {
          if ((this.option.rule ?? /@xforce\/.*\/mlib/).test(source)) {
            this.remoteLibs.push(source);
          }
        }
      },
    );
    parser.hooks.program.tap(pluginname, (ast: any) => {
      if (parser.state?.module?.resource.includes('src/index.jsx')) {
        walk.simple(ast, {
          Identifier: (node: any) => {},
          ImportDeclaration: (node: any) => {},
        });
      }
    });
  });
});
```

`parser`的钩子是在`JavascriptParser`实例运行`parse()`时候调用的. 目的就是纯帮我们遍历ast.

遍历ast的节点的钩子名字文档里有, 自己去看.

这里说几个细节:

1. 我们依旧可以通过`parser.state.module`里的属性来过滤需要处理的文件.
2. 上文提到的, 这里修改ast是不起作用的.
3. 如果在`program`钩子遍历拿到的ast, 需要用`acron`的api, 用babel的是会报错的.
4. 如果`program`钩子设置了返回值, parser就不会遍历ast了, 在不需要遍历ast的项目里, 通过这个钩子可以提升wp性能.

关于第二点和第四点, 想看代码去wp代码里搜`program.call`就行了.

### 在codegen阶段增加调用自定义template

```js
import NullFactory from 'webpack/lib/dependencies/NullDependency';
class ModifyDependency extends NullFactory {
  constructor(param: string) {
    super();
    this.param = param;
  }
}

ModifyDependency.Template = class ModifyDependencyTemplate extends (
  NullFactory.Template
) {
  apply(dependency, source) {
    source.insert(0, `// ${dependency.param}`);
  }
};

// ... 在apply方法中

compiler.hooks.compilation.tap(pluginname, (compilation) => {
  compilation.dependencyTemplates.set(
    ModifyDependency,
    new ModifyDependency.Template(),
  );
});

compiler.hooks.normalModuleFactory.tap(pluginname, (factory) => {
  factory.hooks.parser.for('javascript/auto').tap(pluginname, (parser) => {
    parser.hooks.import.tap(
      pluginname,
      (_stmt: unknown, source: string) => {
        if (!parser.state?.module?.resource.includes('node_modules')) {
          if (/@xforce\/.*\/mlib/.test(source)) {
            const dep = new ModifyDependency(`添加一点注释: ${source}`);
            parser.state.current.addDependency(dep);
          }
        }
      },
    );
  });
});
```

这里自定义程度比较高, 我从执行角度的流程分析会比较容易:

1. 通过钩子找到需要处理的文件(module), 为当前模块一个自定义的dependency. (`addDependency(dep)`)
2. codegen在执行到`sourceDependency()`的时候, 会发现这个dependency(即**new ModifyDependency(\`添加一点注释: ${source}\`)**).
3. 执行的时候会从`dependencyTemplates`中根据dependency的构造器来找对应的Template. (所以我们要调用`dependencyTemplates.set()`)
4. 找到Template以后, 会执行Template的`apply()`方法.
5. `apply()`方法接受3个参数, 第一个是dep实例, 我们可以通过这个实例把参数传给Template, dep里还可以获取当前代码的位置等信息.
6. `apply()`的第二个参数`source`是一个`ReplaceSource`实例, 调用方法可以替换, 添加代码.

另外, 在合适的情况下, 我们是可以使用webpack内部定义好的dependency的.

最后, 上面提到调用template.apply的过程在`lib/javascript/JavascriptGenerators.js`里, `ReplaceSource`在webpack-source里, 需要的可以自行去看详情.

### 在optimize阶段修改输出

```js
import { ConcatSource } from 'webpack-sources';
compiler.hooks.compilation.tap(pluginname, (compilation) => {
  compilation.hooks.optimizeChunkAssets.tap(pluginname, (chunks) => {
    chunks.forEach((chunk) => {
      chunk.files.forEach((filename) => {
        if (filename.includes('index')) {
          compilation.assets[filename] = new ConcatSource(
            (compilation.assets[filename].source() as string).replace(
              'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
              this.remoteLibs[0].replace('/mlib', ''),
            ),
          ) as any;
        }
      });
    });
  });
});
```

通过上面代码的这些钩子与变量判断, 找到我们想要的文件就可以像loader里一样替换了.

这里说三个点:

+ optimize是在wp seal的时候调用的, seal是在所有module都运行完后才调用的, 只有在这个时间其他的module才都运行过. 这点对我的目标需求非常重要, 因为其他钩子的点是拿不到收集的信息的.

+ 这个时候拿到的代码已经是准备输出成文件的最终代码了.

+ wp里的source是webpack-source的实例, 但我们只要知道`source()`方法获取字符串, 再重新new一下返回就可以了.

  并且这里可以用字符串操作, 也就是可以自己用ast/magic string来分析操作字符串.

### 附送: 指定某个文件不要被tree-shaking

这个是在看老板写的plugin时候, 比较简单又不值得开一篇post分析的api. (记录一下)

```js
compiler.hooks.compilation.tap(
  { name: this.constructor.name },
  (compilation) => {
    const { moduleGraph } = compilation;
    compilation.hooks.afterOptimizeChunkModules.tap(
      { name: this.constructor.name },
      (chunks) => {
        const indexChunk = Array.from(chunks).find(
          (chunk) => chunk.name === this._chunkName,
        );
        if (indexChunk) {
          compilation.chunkGraph
            .getChunkModules(indexChunk)
            .forEach((module) => {
            if (
              module.type === 'javascript/auto' &&
              module.resource.endsWith(this._moduleSource)
            ) {
              const exportsInfo = moduleGraph.getExportsInfo(module);
              exportsInfo.setUsedInUnknownWay(undefined);
            }
          });
        }
      },
    );
  },
);
```

## 完成需求的方案

我选择了 loader + optimize 的方案. 说说原因:

+ 我在首页添加的代码包含新的import, 所以在loader添加代码才会被module-graph收录.

+ module的处理顺序是从根节点开始遍历(深度还是广度我不在意).

  我需要在遍历的时候收集信息, 收集完再写到入口文件. 所以只有通过seal的时候(此时已经执行完所有module), 再回头处理入口文件.

遍历ast的过程我选择wp parse阶段, 原因是执行所有的module只加载一次plugin实例. 而不确定用loader或babel plugin可以把收集的信息放到同一个变量里. (不确定是不是同一个作用域, 也没去试)

## 总结

需要遍历的话, 文件的顺序是: loader wp parse. 不同阶段获取的ast是不同的, loader的顺序也讲究.

如果要修改, 通过loader比较好. (修改后的代码可以顺利经过其他所有处理, 自己的loader要注意顺序)

