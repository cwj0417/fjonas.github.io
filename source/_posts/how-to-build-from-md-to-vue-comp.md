---
title: element-ui如何在文档中加载md文件
date: 2019-08-23 23:44:10
categories: 工作笔记
tags: [vue,webpack,分析]
---
上次看到element-ui的文档是一个vue项目, 注意到一个细节, 组件的文档是md文件, 并且能够展示组件的效果. 于是来仔细看一下其中的运行流程.

<!--more-->

## 如何把md文件加载到vue项目里

### 引入流程

代码里是直接引入并调用`Vue.component`的, 类似于:

```js
import docGuide from '../README.md';
Vue.component('docGuide', docGuide);
```

显然`docGuide`应该是一个vue实例而不可以是md文件. 所以找到webpack配置:

```js
{
  test: /\.md$/,
    use: [
      {
        loader: 'vue-loader',
        options: {
          compilerOptions: {
            preserveWhitespace: false
          }
        }
      },
      {
        loader: path.resolve(__dirname, './md-loader/index.js')
      }
    ]
},
```

原因是在webpack里配置了md的加载规则.

### webpack loader介绍

从这个场景我们可以快速得出两个结论.

+ loader是一个函数, 如果匹配到的项目进入了dep graph, 就会被作为参数传入loader函数, 并获取函数的输出内容作为打包结果.
+ 如果一个匹配`use`了多个loader, 那么loader会从下至上执行, 并且把执行后的结果作为下次执行的输入.

除此之外, loader还可以接受option来根据是否是生产环境/项目业务来定制行为.

特别注意的是, loader是运行在node环境里的, 所以在这里可以调用任何node的方法, 甚至在这里直接把文件写到输出目录里.

在我们的场景中, 可以看出, md文件先进入了自己写的`md-loader`中, 然后应该再被`vue-loader`处理. 那么我们可以猜到: 这个loader接受md文件类似于`# title`, 经过处理应该输出vue-loader可以处理的vue文件, 类似于: `<template><h1>title</h1></template>`. 接下来就看看`md-loader`的处理流程.

## md-loader

按照道理说到这已经没有什么值得看下去的了, md的js库用一下就可以获得html, 外面再包一层template就是标准vue文件了. 其实vue里写个组件parse一下md文件就行了, 这里为什么要用loader? 因为有更厉害的功能.

这里的md支持一个语法: `:::demo ${描述} (组件例子)`就会自动展示组件效果, 并且可以看到当前效果的代码, 操作代码显示/隐藏.

于是我们必须来看一下这个用起来很帅的loader了.

```js
module.exports = function (source) {
  const content = md.render(source); // 步骤1: 渲染md文件
	/* ... */
  // 步骤2: 对demo进行读取, 并生成必须的js. (demo中包含js)
  return `
    <template>
      <section class="content element-doc">
        ${output.join('')}
      </section>
    </template>
    ${pageScript}
  `;
};
```

### brief

我粗略把md处理分成2个步骤. 首先我们得知道这个loader的输入, 输出是什么, 并且sample是如何运行的.

举一个例子来查看输入输出: 正常的md都会被普通的parse成html, 假设我在md里输入了sample, 那么最后的输出会类似于:

html部分

```html
<demo-block>
    <div>
        <p>${描述}</p>
    </div>
    <template slot="source">
        <element-demo0 />
  	</template>
    <template slot="highlight">
        <pre v-pre><code class="html"><xf-input-range v-model="inputRangeData" />
      <script>
        export default {
          data () {
            return {
              inputRangeData: [1, 2]
            }
          }
        }
      </script>
</code></pre></template>
</demo-block>
```

script部分

```js
<script>
export default {
    name: 'component-doc',
    components: {
        "element-demo0": (function() {
          /** 处理输出 **/
            return {
                render,
                staticRenderFns,
                ...democomponentExport
            }
        })(),
    }
}
</script>
```

在html中看到了`demo-block`, 我们就来看一下这个组件.

### demo-block

这个组件是在文档入口被引入的, 我们编写的组件也是在入口被引入的, 所以文档的sample才能识别这些组件.

`demo-block`就是展示sample效果和代码显示/隐藏的组件.

其实从md-loader编译后的html文件(上文中)就能看出: demo-block中有3个slot, 一个是default, 一个source, 一个是highlight. 

default是描述; source里的是一个奇怪的: `<element-demo0>`; highlight中是sample代码.

default和highlight都是普通的html, 值得继续看的是source的内容是一个临时组件.(从名字就可以看出来了)

于是看到script部分. `element-demo0`是在这里被定义的, 也就是loader把sample的行为写到这个临时组件里了.

看到这里, 已经完全了解了`md-loader`的输入输出了. 接下来仔细看看这个loader是如何把`:::demo`这个语法一步步编译成这样的输出的.

### md.render(source)

作者用了`markdown-it-chain`这个工具解析了md, 我没有去文档看, 但从api上来看这个工具很棒, 支持自定义标签, 用2个字段, 一个`validate`类似于webpack loader的`test`, 一个`render`类似于`use`. 所以很容易理解.

用了这个工具, 就可以轻松读到`:::demo`中的内容, 并写成想要的html.

经过这个处理, html已经变为了:

```html
<demo-block>
    <div>
        <p>${描述}</p>
    </div>
    <!--element-demo: <xf-input-range v-model="inputRangeData" />
    <script>
      export default {
        data () {
          return {
            inputRangeData: [1, 2]
          }
        }
      }
    </script>=
    :element-demo-->
    <template slot="highlight">
        <pre v-pre><code class="html"><xf-input-range v-model="inputRangeData" />
      <script>
        export default {
          data () {
            return {
              inputRangeData: [1, 2]
            }
          }
        }
      </script>
</code></pre></template>
</demo-block>
```

仔细与最终结果对比:

被`<!--element-demo:`包含的部分, 在最终输出里变成了: `<template slot="source"><element-demo0 /></template>`.

这样就很容易知道第二个步骤做了什么了.

### 整理页面所有sample

因为一个页面也许有很多sample. 那么就会有很多`<!--element-demo:`. 现在把一个md文件加载成一个vue component, 就只能有一个script, 所以必须把所有demo合并成一个script. 就是最终步骤了.

[代码](https://github.com/ElemeFE/element/blob/dev/build/md-loader/index.js)就不贴在这里太长了, 我总结一下流程:

1. 遍历所有`<!—element-demo:`, 并正则分析出他们的html和script部分.
2. 用`<element-demoX/>`来替换位置.
3. 把对应的html和script写成对应的临时component, 串在一起放到最终输出的script中.

这3个步骤只有步骤3是需要仔细看的, 其他2个都非常好理解, 代码也很直白.

[步骤3](https://github.com/ElemeFE/element/blob/dev/build/md-loader/util.js#L30)的思路其实也很简单, 要把html和script的信息写入`<element-demoX />`中. 使用`vue-template-compiler`把html编译成render方法, 再把script里所有内容原样放入就可以了. (其实vue本来就要把template转成render的)