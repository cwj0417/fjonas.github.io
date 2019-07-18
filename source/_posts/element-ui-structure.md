---
title: element-ui项目结构概览
date: 2019-07-18 10:07:29
categories: [编码与分析]
tags: [vue,webpack,分析]
---
vue的生态环境的ui组件从一开始就只有element可以用, 因为有团队维护, 也慢慢发展到别的ui组件没有竞争能力的地位了. 来看看element是如何组织代码的. 代码是写作的时候新拉的`2.10.1`.

{% raw %}

<style>
  table {
    table-layout: fixed;
    width: calc(1030px * 0.75 - 40px);
    word-break: break-word;
  }
</style>

{% endraw %}

<!--more-->

## 入口

从`package.json`的`main`字段和webpack配置找到入口是`src/index.js`.

这个文件是从`build/bin/build-entry.js`根据配置生成而来的, 内容没有什么特别的, 大致是:

+ 引入每个组件.
+ install方法里注册组件, 一些快捷方式, i18n处理, (并vue-i18n的api对接), 接受一些业务相关的参数.
+ export单个组件和install方法.

## 构建

构建命令是`dist`(contributing guide中提到的), 所以我们来看一下`dist`命令做了些什么事.

| 命令                                        | 操作 | 源                                                | 目标                                 | 描述                                                        |
| :------------------------------------------ | ---- | ------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| npm run clean                               | 删除 | lib等编译结                                       |                                      |                                                             |
| npm run build:file                          |      |                                                   |                                      | 初步编译到各个语言的vue文件                                 |
| — node build/bin/iconInit.js                | 整理 | packages/theme-chalk/src/icon.scss                | examples/icon.json                   | 整理有哪些icon                                              |
| — node build/bin/build-entry.js             | 生成 | components.json                                   | src/index.js                         | make new 会修改components.json                              |
| — node build/bin/i18n.js                    | 编译 | examples/pages/template/${page}.tpl               | examples/pages/\${lang}/​\${page}.tpl | 根据examples/i18n/page.json的配置来把tpl编译成vue(正则替换) |
| — node build/bin/version.js                 | 整理 | package.json                                      | examples/versions.json               | 文档切版本用的version配置文件, 把当前版本兼容进去           |
| npm run lint                                |      |                                                   |                                      | 运行eslint                                                  |
| webpack --config build/webpack.conf.js      | 编译 | src/index.js                                      | lib                                  | umd                                                         |
| webpack --config build/webpack.common.js    | 编译 | src/index.js                                      | lib                                  | commonjs                                                    |
| webpack --config build/webpack.component.js | 编译 | 配置在components.json中, 都是packages下的index.js | lib                                  |                                                             |
| npm run build:utils                         |      |                                                   |                                      |                                                             |
| npm run build:umd                           |      |                                                   |                                      |                                                             |
| npm run build:theme                         |      |                                                   |                                      |                                                             |

总结: 输出的内容就是`src/index.js`export出来的各个组件, 如果直接`use`, 就会加载所有组件. 复杂在还提供了主题/i18n/不同加载方式的处理, 这些之后再细看.

知道了输出了什么, 接下来要看的是如何进行开发.

## 开发

`package.json`提供了两个命令, `dev`和`dev:play`.

先来看`dev`命令.

### dev

1. `npm run build:file`: 对代码进行初步编译, 从tpl编译到vue文件, 对版本和i18n做处理.
2. `webpack-dev-server --config build/webpack.demo.js`: 编译文档页面`examples/entry.js`
3. `node build/bin/template.js`: 对tpl的修改做监听实时编译成各个语言的vue文件.

### example页面

先从webpack配置说起.

```js
entry: isProd ? {
    docs: './examples/entry.js',
    'element-ui': './src/index.js'
  } : (isPlay ? './examples/play.js' : './examples/entry.js'),
```

+ dev命令入口`entry.js`
+ dev:play命令入口`play.js`
+ 正式环境入口`entry.js`, 另外同时编译组件库源码.

`entry.js`是文档页面的入口, 文档页面是个独立的vue项目了. 唯一值得element自己写了一个loader把md编译成vue文件:

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

webpack的use是reverse执行的, 所以先把md文件编译成vue文件, 再由vue-loader处理.

### dev:play

play使用了同一个webpack配置, 但入口是`play.js`, examples有个play文件夹, 下面只有个index.vue, 是用来开发单个组件时候调试的.

## todo

+ 自定义主题的实现
+ template和render的选择原则