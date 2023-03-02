---
title: 处理不支持ie11的第三方包
categories: 工作笔记
date: 2023-03-01 15:21:33
tags: [webpack-plugin]
---
公司一些客户需要支持ie11, 而有一些第三方包表示不爱支持ie11了. 所以使用的时候需要一些额外的工作.

这里简单记录下处理方式, 和轻度聊聊npm包输出格式的问题.

<!--more-->

## 关于不支持ie11的包的讨论

### 不支持ie11的包在哪里报了错

先定个前提, 问题是出现在webpack build时候的, 因为node或dev不存在ie11.

在webpack build的前提下, 我们使用npm包的流程是这样的: 

1. 在代码中`import`或者`require`的时候, webpack尝试resolve, 从`node_modules`里找到了目标包.
2. 根据目标包的`package.json`找到目标文件. 根据模块语法获取到目标js对象.
3. 根据目标文件中的`import`或者`require`分析依赖树, 使用webpack内部方法替换他们.
4. webpack压缩/混淆代码.

到这里, 我们发现, npm包里的内容没有经过babel处理. 只是处理了import和压缩/混淆, 如果node_modules里的目标文件里有es6语法, 那么到ie11里就会报错了.

而我们写的业务代码, 在上面步骤3和步骤4中间, 还会命中loader的规则, 走一下babel.

所以解决方案很简单, 就是让不支持ie11的第三方包走一下babel, 在聊具体的解决方案前, 浅浅聊一下为什么react-dnd和react-router决定不支持ie11.

### 兼容打包形式有什么问题

看了[react-dnd作者对pure esm package的看法](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c), 简单总结下.

+ cjs和esm的模块语法不同, 可能造成[dual-package-hazard](https://nodejs.org/api/packages.html#dual-package-hazard).

  对同一个包, `require`来的和`import`来的js对象是不同的, 如果是类, `instanceof`实例的结果也是`false`. 如此可能导致一些非预期的bug.

+ 因为兼容, 实际npm包输出了2份结果, 导致npm install变慢. (这个量其实很小)

+ 因为cjs和esm的ast不同, 给各个编译器也造成了双倍负担.

我认为说得都有道理, 随着打包工具的普及, 其实cjs/umd的场景大量减少, 并且esm可以被tree-shaking, 对宿主项目打包体积也很有好处.

但这些矛头都指向cjs/umd, 并没有说es target为什么要不支持ie11, react-dnd把target设成es2017, 却只解释了esm输出. 我的看法是, 不支持ie11的做法**比较任性, 并不合理**.

### 公司组件可以直接发布源码吗

接上一章, react-dnd作者认为"慢慢推"不可行的原因有2个. 第一是很少人理解, 第二是紧急度不够, 渐进式就没人愿意推pure esm package.

那么如果在公司内部的环境里, 是不是可以发布源码, 在公司脚手架配置下规则, 从而享受各种方便呢?

找朋友讨论了下, 朋友告诉我**组件打包有一个职能是减少项目打包时间**. 我之前一直没有意识到这个问题.

所以公司组件最佳权衡还是用rollup打出es语法支持ie11的esm包.

(至于我们公司现在还额外打个umd包, 我感觉是可以去掉这个步骤的)

## 如何处理不支持ie11的包

接下来聊一聊具体怎么处理这些有脾气的第三方包. 因为具体代码都是在公司脚手架前提下的, 所以我选择不贴代码, 只说说要干点什么.

### 把额外的包交给babel处理

之所以这些包没有走babel, 是因为一般都会把node_modules设置为loader规则的exclude.

于是我们把原先的exclude规则删掉, 再重新加上**在node_modules里, 并且不是不支持ie的第三方包**就行了. exclude是支持设置方法, 接受参数是模块的路径.

另外, 还可以另写一个rule, 把目标包作为include, 并使用和项目代码一样的loader. 这个方法比较好, 容易维护和配置.

### 让用户寻找不支持ie11的包

知道了怎么处理后, 还有个问题是处理哪些包.

项目打包结果一般都是经过压缩/混淆的, 为了让用户可以清楚的找到目标包, 我们要暂时关闭压缩/混淆, 下面这3个webpack配置都设置了, 一般就可以关闭压缩/混淆了. (我这里项目只设置了optimization.minimize就关闭了)

+ mode = 'development'. 这是一个配置集合, 这么设置可以关闭几个压缩/混淆配置.
+ devtool = false. 这也算个配置集合, 设置成false后打包结果不会被压缩和eval.
+ optimization.minimize = false. 关闭压缩.

关闭以后在打包结果里查看不支持ie11的语法, 再找到对应的第三方模块名字, 加入上一步的规则里就可以了.

### 进一步: 帮助用户寻找不支持ie11的包

这个方案在运行了一段时间后, 发现同事还是会在遇到问题后来问, 这说明这个方案用起来不方便.

按照我的理解, 不方便的点是:

+ 觉得修改webpack配置比较麻烦. (其实脚手架已经封装, 但记住使用方法也是额外的心智负担)
+ 对webpack打包结果不熟悉, 不知道如何寻找代码块对应的第三方模块. (这个在我以前的文章有简单的分析)
+ 模块本身也有依赖, 一个不支持ie11的模块会找出超过一个的模块.
+ 不支持ie11的语法比较多, 一个个搜, 如果量大的话找起来会比较痛苦. 甚至需要修改配置后反复打包-查找-验证.

而这些操作是我们可以在webpack插件中为用户做的, 只需要在调试模式下加载这个插件就可以了.

### 插件思路

与上一个插件思路差不多, 并且简单许多: 在合适的地方收集信息, 然后在一处打印出来.

收集的点和上个插件一样, 选择在了javascriptParser的program阶段. (详细解说流程在上个插件的文章)

为什么不使用javascriptParser的自带hook呢, 原因有二: 自带钩子不能满足需求, 不方便些单元测试.

于是在program阶段用`acorn`来遍历ast找到es6的语法.

在找es6语法的时候, 需要注意, 要去观察上下文的ast, 而不只是语法发生点, 不然可能会发生误判.

输出就比较简单, 我选择了`afterCompile`钩子, 直接把收集的信息打印出来就行了.

### 尝试优化

完成功能以后, 做一些简单的优化:

+ 把从ast找es语法的函数抽出来, 以便于写测试.
+ 在遍历ast前拦截已经被判定为目标包的子模块.

这两个优化很简单, 最后再聊2个放弃的优化.

+ 现在寻找粒度是"npm包名", 其实可以选择粒度到"模块"(具体文件), 这样用寻找时性能交换项目打包性能.

  但这样做会导致webpackconfig比较乱, 不一定会被用户理解, 所以暂缓.

+ 想让`program`钩子返回值, 以避免ast被webpack的parser再遍历一遍. 

  因为这个我调试了webpack代码, `parse`函数的输入输出没变, 用`===`可以返回true. 但在遍历过程收集了信息到内部, 所以`program`钩子返回数据并阻止后续遍历, 是会让打包进程报错的.

  顺便也理解了, webpack提供了一些ast节点的钩子, 只是顺便而已, 还是有自己的目的的.

最后的最后, 贴一下插件的代码.

```js
const pluginname = 'FindEs6PkgPlugin';

export const findes6 = (ast: acorn.Node, cb: () => any) => {
  simple(ast, {
    NewExpression: (node: any) => {
      if (['Map', 'Set'].includes(node?.callee?.name)) {
        cb();
      }
    },
    CallExpression: (node: any) => {
      if (
        ['includes', 'startsWith', 'endsWith'].includes(
          node?.callee?.property?.name,
        )
      ) {
        cb();
      }
      if (['Symbol'].includes(node.callee.name)) {
        cb();
      }
      if (
        node?.callee?.object?.name === 'Array' &&
        node?.callee?.property?.name === 'from'
      ) {
        cb();
      }
      if (
        node?.callee?.object?.name === 'Math' &&
        ['trunc', 'sign', 'cbrt', 'log2', 'log10'].includes(
          node?.callee?.property?.name,
        )
      ) {
        cb();
      }
    },
    VariableDeclaration: (node: any) => {
      if (['let', 'const'].includes(node.kind)) {
        cb();
      }
    },
    ArrowFunctionExpression: cb,
    SpreadElement: cb,
    ForOfStatement: cb,
    ClassDeclaration: cb,
    RestElement: cb,
  });
};

class FindEs6PkgPlugin {
  es6modules: Set<string> = new Set([]);

  apply(compiler: Compiler) {
    compiler.hooks.normalModuleFactory.tap(pluginname, (factory) => {
      factory.hooks.parser.for('javascript/auto').tap(pluginname, (parser) => {
        parser.hooks.program.tap(pluginname, (ast: any) => {
          if (parser.state?.module?.resource.includes('node_modules')) {
            const dep = parser.state.module.resource.replace(
              /.*node_modules\/([^\/]+)\/.*/,
              '$1',
            );
            if (!this.es6modules.has(dep)) {
              const addDep = () => {
                this.es6modules.add(dep);
              };
              findes6(ast, addDep);
            }
          }
        });
      });
    });
    compiler.hooks.afterCompile.tap(pluginname, () => {
      if (this.es6modules.size) {
        signale.info(`项目中有不支持ie11的第三方包, 请添加以下配置到webpack-chain.config.js:
        config.module
        .rule('extra')
        .include
        ${[...this.es6modules].map((i) => `.add(/${i}/)`).join('')}
        `);
      }
    });
  }
}
```

