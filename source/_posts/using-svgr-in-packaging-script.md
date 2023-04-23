---
title: 在公司的打包脚本中使用svgr
categories: 工作笔记
date: 2023-04-19 11:31:46
tags: [webpack-plugin]
---
有同事在迁移到公司打包脚本的时候遇到了不支持svg作为组件引入的问题. 

在应用svgr的时候要注意不能影响打包脚本原来对svg的处理逻辑.

<!--more-->

## 目标和使用方法

在引入插件前, 所有svg都是走`type: 'asset'`的. (在webpack5前是file-loader/url-loader). 希望引入插件后不影响原来功能, 并且在尝试引用 `{ ReactComponent }`的时候把svg作为react组件暴露出来.

使用方法是:

```js
{
  test: /\.svg$/i,
  use: ['@svgr/webpack', 'url-loader'],
}
```

这里有一个要注意的, 一定要让svg先走url-loader,  并且loader是有顺序的. 如果没有配置url-loader, 效果是default export就是react组件, 这样会影响原先打包脚本的行为.

在我看来, 如果让我写一个svgr功能的loader, 我是不需要url-loader的, 于是去看了下svgr需要加载url-loader的原因.

## 正文

我以空option来调试webpack的svgr, 有个注意点, dev的时候loader会有缓存, 在代码里打log不是每次都会打出来的.

### file-loader

如果svg没经过file-loader, 走进svgr-loader的时候是svg的文件内容字符串.

经过file-loader, 走进svgr-loader的内容是`export default __webpack_public_path__ + "static/media/logo.6ce24c58023cc2f8fd88fe9d219db6c6.svg";`.

我猜想file-loader做的事就是根据配置生成文件名, emit file, 然后输入 export default 文件url. 如果命中base64规则的话就直接 export base64.

这个区别也应该是影响svgr输出的唯一因素了.

### svgr入口

```js
function svgrLoader(
  this: webpack.LoaderContext<LoaderOptions>,
  contents: string,
): void {
  this.cacheable && this.cacheable()
  const callback = this.async()

  const options = this.getOptions()

  const previousExport = (() => {
    if (contents.startsWith('export ')) return contents
    const exportMatches = contents.match(/^module.exports\s*=\s*(.*)/)
    return exportMatches ? `export default ${exportMatches[1]}` : null
  })()

  const state = {
    caller: {
      name: '@svgr/webpack',
      previousExport,
      defaultPlugins: [svgo, jsx],
    },
    filePath: normalize(this.resourcePath),
  }

  if (!previousExport) {
    tranformSvg(contents, options, state, callback)
  } else {
    this.fs.readFile(this.resourcePath, (err, result) => {
      if (err) {
        callback(err)
        return
      }
      tranformSvg(String(result), options, state, (err, content) => {
        if (err) {
          callback(err)
          return
        }
        callback(null, content)
      })
    })
  }
}
```

这里做的事情是: 处理配置, 然后把文件内容传给`tranformSvg()`处理.

这里说个点:

+ 处理配置的时候会传入2个"plugin": svgo和jsx. 所谓的"plugin"都是内部的方法.
+ 如果从上一个loader没有拿到svg的内容, 会直接从`resourcePath`读取svg内容.
+ 如果上个loader有内容, 会把内容作为`previousExport`配置给`tranformSvg()`处理. 

而经过file-loader的处理后, `previousExport`是有值的, 否则是null, 所以我们关注的行为差异应该也和这个参数有关系了.

### 运行plugin

`transformSvg()`方法做的事是整理配置, 整理plugin, 运行plugin. 这个plugin的概念是svgr内部的概念.

整理plugin的时候尝试多种方式resolve plugin, 如果想基于svgr写plugin或者自己写一些东西可以参考. 我们啥都不配置, 最后运行的就是svgo和jsx这2个plugin.

```js
const run = (code: string, config: Config, state: Partial<State>): string => {
  const expandedState = expandState(state)
  const plugins = getPlugins(config, state).map(resolvePlugin)
  let nextCode = String(code).replace('\0', '')
  // eslint-disable-next-line no-restricted-syntax
  for (const plugin of plugins) {
    nextCode = plugin(nextCode, config, expandedState)
  }
  return nextCode
}
```

通过运行plugin的代码可以知道, 这个和webpack的loader是差不多的, 把plugin串起来逐个运行, 参数就是简单的字符串(硬说的话也可以不是). 区别他是正序的, webpack的loader可能是用compose串起来的.

### jsx-plugin

svgo-plugin就是调用了npm包来对svg进行处理, 就直接看jsx-plugin.

在进行了一堆整理后, jsx-plugin最后是调用了babel. 这里会根据配置调用一大堆babel的plugin. 而我在里面找到了我关心的: `transformSvgComponent`.

这个方法也比较粗糙地在`Program`里用个模板直接替换了原来的. 模板里一些信息是通过`getVariables({ opts, jsx })`来获得的, 之前的配置`previousExport`为空的时候, 经过了`getVariables`和模板的处理, 就没有输出namedExport.

所以总结这个行为是出于设计, 不是出于技术限制. 在我看来完全可以很简单的写这些功能, 为什么代码设计得比较复杂, 应该是在迭代中遇到了很多需求和问题. 看来看代码不光要看最新的, 还要看代码的演变和issue. 我就先不深入了.

## todo

还有一个问题, webpack5项目现在是配置的`type:'asset'的`, 这个在文档看来就没办法无伤应用svgr了, 而`type:'asset'`的行为比看loader代码复杂, 有时间的话以后再看.
