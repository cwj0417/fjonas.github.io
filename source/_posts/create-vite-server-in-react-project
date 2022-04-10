---
title: 用vite来起公司的react项目
categories: 工作笔记
date: 2022-04-10 17:27:19
tags: [vite,react]
---
 尝试给公司脚手架新增个用vite起react项目的功能, 分享一下思路和遇到的问题.

<!--more-->

## 背景提要

因为是公司项目, 总体代码结构会顺着已有的走, 没有参考性, 所以本文只记录碰到的问题, 并贴一些代码片段, 没有贴出整个仓库.
另外, 经过了一段时间的努力, 电脑里的30个左右的项目都可以跑了, 但方法也许并不通用, 并且有许多地方可以优化的.

## 思路

现有的dev server用的是webpack, 迁移vite的大方向要先看看他们间的区别.

+ webpack用了自己写的一些函数把module graph连接起来, vite作为bundleless工具的根本是基于esm. 于是非esm的module就成了问题, vite目前解决得也不太好, 需要我们进一步操作.
+ webpack加载module的时候可以用loader/plugin进行一些操作, vite也有插件系统, 所以我们的工作之一就是要让webpack存在的配置迁移到vite上.

## 关于vite插件

在vite插件上我算是踩了一些坑, vite(写作时版本2.9.1)对于plugin文档写得比较粗糙.
文档里的意思是`vite插件包含rollup插件`, 所以文档的hook分为2部分: universal和vite-specific.
而事实是: 很多rollup插件是不兼容vite的, vite在dev的时候options只有`ssr`, 而没有rollup的所有options.
所以vite插件的开发办法是: console.log硬调试. 安东尼大佬的`vite-plugin-inspect`在很多场景(并不是所有)上很有用.

## 实施细节

与webpack的dev-server一样, 先获取一些配置, 入口文件等, 用api起一个dev-server. 报什么错就处理什么的方式来调试这个vite服务.

### rollup兼容插件

因为公司脚手架已经写了一套对应着webpack配置的rollup配置, 就直接拿来用了. 这些配置我把他们分成2类.
+ 与vite兼容的插件, 如resolve, alias, image, json, polyfill, babel等.
+ 在vite环境下要禁用的插件. 我们传个参数就可以解决禁用的问题. 而这些插件又分为2类: 第一类是vite out-of-box的功能, 比如sass/less, postcss, ts. 第二类是会报错的不兼容插件, 比如cjs插件用到了`isEntry`.

### index.html

vite的index.html需要有script[type=module]的引入, 秉持让用户不动的原则, 我们要给index.html插入这段js.
幸运的是, vite提供了这个hook, 很方便.

```js
transformIndexHtml() {
    return [{
        tag: 'script',
        attrs: { type: 'module', src: './' + basename(entry) },
    }]
}
```

有一个包报了`global is not defined`的错误, 也可以用这个hook来解决. 只要加一个script让global指向window或globalThis.

### multiple entry

webpack的entry如果配置成Array, 那么会依次引入并打到一个bundle里.
而vite/rollup没有这个功能.
我们公司脚手架在项目entry前还引入了antd的css和babel的polyfill, 如果不引入就会失去样式, 或是报async/await失去垫片的错误`regeneratorxxx is not defined`.

这个问题我选择了transform的时候, 判断是否是入口文件来添上对应的引入.
而判断入口文件, 只能靠自己, 而不能靠rollup的isEntry.

```js
transform(code, id) {
    if (id.endsWith(entry)) {
        return entries.map(eachentry => `import '${eachentry}';`).join('') + code;
    }
},
```

代码中的entries是外部传入的配置, 能让这个plugin更灵活, 完整的代码会在后面贴上.

### 神策埋点

也不是说埋点有问题, 我们项目中是用神策压缩后的js放在项目文件里的. 鉴于dev时本来就不需要埋点, 于是我用正则的方式把神策埋点都去掉了.

```js
transform(code, id) {
    if (id.endsWith(entry)) {
        return code.replace(/sensorsdata\.init\([^)]*\);/g, '').replace(/.*sensorsdata.*\n/g, '')
    }
}
```

### umd+external包

项目中有个包是rollup打的umd+external包. 我尝试了很多插件, (也许是基础不牢固的原因), 我没能力把umd转esm.

最后解决方案, degit那个包, 然后修改rollup配置, 获得一个esm包, 直接放脚手架里, 然后替换.

这里要用到2个新的hook, 因为transform的时候找不到这个import. (可能是node_module里的关系, 具体我不懂)

```js
resolveId(id) {
    if (id.includes('@hanyk/rc-viewer')) {
        return virtualImport;
    }
},
load(id) {
    if (id.includes(virtualImport)) {
        const code = readFileSync(resolve(__dirname, 'rc-view-esm.js')).toString()
        return { code }
    }
}
```

### 插件完整代码

到这里, 插件解决的问题都齐了, 把完整的插件贴上来记录一下.

```js
const inspect = require('vite-plugin-inspect')
const { basename, resolve } = require('path')
const { readFileSync } = require('fs-extra')

function replacercviewer() { // 因为rc-viewer的打包结果是umd+external. 我想不到怎么umd转esm, 直接把esm包打出来吧. (待优化?)
    const virtualImport = '\0rc-viewer'
    return {
        name: 'replacercviewer',
        enforce: 'pre',
        apply: 'serve',
        resolveId(id) {
            if (id.includes('@hanyk/rc-viewer')) {
                return virtualImport;
            }
        },
        load(id) {
            if (id.includes(virtualImport)) {
                const code = readFileSync(resolve(__dirname, 'rc-view-esm.js')).toString()
                return { code }
            }
        },
    }
}

function entryappendency({ entries, entry }) {
    return {
        name: 'entryappendency',
        enforce: 'pre',
        apply: "serve",
        transform(code, id) {
            if (id.endsWith(entry)) {
                return entries.map(eachentry => `import '${eachentry}';`).join('') + code;
            }
        },
        transformIndexHtml() {
            return [{
                tag: 'script',
                attrs: { type: 'module', src: './' + basename(entry) },
            }, {
                tag: 'script',
                children: 'global = globalThis'
            }]
        }
    };
}

function removeSensor({ entry }) { // todo: 改成修改ast, 粗糙正则必有问题
    return {
        name: 'removesensor',
        enforce: 'pre',
        apply: "serve",
        transform(code, id) {
            if (id.endsWith(entry)) {
                return code.replace(/sensorsdata\.init\([^)]*\);/g, '').replace(/.*sensorsdata.*\n/g, '')
            }
        }
    }
}

function reactProjCompatible(options) {
    const { entry, multiEntry, dev } = options;
    let plugins = [entryappendency({ entry, entries: multiEntry ?? [] }), removeSensor({ entry }), replacercviewer()]
    if (dev) {
        plugins.push(inspect())
    }
    return plugins;
}

module.exports = reactProjCompatible
```

调用的时候:

```js
plugins: [reactProjCompatible({
              dev: true,
              entry,
              multiEntry: ['@babel/polyfill', 'antd/dist/antd.css']
          }) // (当然还有别的很多plugin)
```

### react-virtualized

这个是react常用的table库, 而这个库有奇怪的引用, 提了issue作者也没回复. 所以我们只能通过hack的方式来处理了.
因为这个依赖项属于pre-bundle阶段的代码, 所以插件的hook不能获取到, 等以后提供esbuild插件的hook的时候可以用esbuild插件来处理.
方式有2个, 一个是用patch-package, 一个是修改node_modules.
还是出于"让用户修改最少"的角度, 我选择修改node_modules. 所以写了个脚本, 在每次起dev-server前把node_modules修改了.

```js
const fse = require('fs-extra')
const os = require('os')

const slash = os.platform() === 'win32' ? '\\' : '/';

const bogusImportString = `import { bpfrpt_proptype_WindowScroller } from "../WindowScroller.js";`

const removeBogusImportLine = () => {
    try {
        const rvPath = require.resolve('react-virtualized', {
            paths: [process.cwd()]
        })
        const filePath = rvPath.replace(/([\\\/])commonjs\1index.js/, `${slash}es${slash}WindowScroller${slash}utils${slash}onScroll.js`)
        const filecontent = fse.readFileSync(filePath)
        if (filecontent.toString().includes(bogusImportString)) {
            console.log('removing bogus import')
            fse.writeFileSync(filePath, filecontent.toString().replace(bogusImportString, ''))
        }
    } catch (e) {
        console.log('react-virtualized not found')
    }
}

module.exports = removeBogusImportLine
```

相关issue: 
+ https://github.com/bvaughn/react-virtualized/issues/1632 : 问题没人管
+ https://github.com/vitejs/vite/issues/1652 : evanyou说只能删, 或者用patch-package(不兼容pnpm)
+ https://github.com/vitejs/vite/issues/3124 : 因为是pre-bundle, vite插件touch不到, 等支持esbuild钩子可以解决. 这个issue暂时还open.

### 错误的文件拓展名

记得在做这个迁移项目前我就看到过一个issue, webpack可以把js也是用jsx的loader, 但vite不行, evan认为这是错误的, 正确做法是把js改成jsx.

把转换做在vite插件里又难又没有必要, 只需要第一次执行的时候检查所有文件就可以了. 于是我写了段脚本.

```js
const { extname, join } = require('path')

const { readdirSync, lstatSync, readFileSync, renameSync, writeFileSync } = require('fs');

const excludes = ['node_modules']

const cwd = process.cwd()

const walk = (dir, cb) => {
    readdirSync(dir).forEach(d => {
        const curDir = join(dir, d);
        const stat = lstatSync(curDir)
        if (stat.isDirectory() && !excludes.includes(d)) {
            walk(curDir, cb)
        } else if (stat.isFile()) {
            cb(curDir)
        }
    })
}

const getUnusedImport = (content) => { // todo: 混合使用的case没写: import React, { useState } from 'react'
    const defaultImportRegex = /import (\w+)\b from/g
    const multiImportRegex = /import \{(.*)\} from/g
    const defaultImports = [...content.matchAll(defaultImportRegex)].map(i => i[1])
    const multiImports = [...content.matchAll(multiImportRegex)].map(i => i[1].split(',')).flat().map(s => s.trim())
    return {
        defaultImports,
        multiImports,
    }
}

const isJsx = (content) => {
    return /<(\w+)([^>]|\n)+>/.test(content) // todo: 完全不对, 太难写, 感觉正则搞不定
}

const isTs = (content) => {
    return /(\bdeclare\b|\binterface\b|import type|function \w+\b\(\w+\b: \w+\b)/.test(content) // todo: 也是很草率
}

const transform = (file) => {
    const fileExt = extname(file)
    let newExt = fileExt
    if (!['.js', '.ts', '.jsx', '.tsx'].includes(fileExt)) return
    let content = readFileSync(file).toString()
    const { defaultImports, multiImports } = getUnusedImport(content)
    if (defaultImports.length || multiImports.length) {
        let changed = false
        function isUnused (str) { // todo: 在注释中的case还没考虑到
            return content.match(new RegExp(`\\b${str}\\b`, 'g')).length === 1
        }
        defaultImports.forEach((item) => {
            if (isUnused(item)) {
                changed = true
                content = content.replace(new RegExp(`import ${item} from .*\n`), '')
            }
        })
        multiImports.forEach((item) => {
            if (isUnused(item)) {
                changed = true
                content = content.replace(new RegExp(`(?<=import.*)\s?${item},?\s?`), '')
            }
        })
        if (changed) {
            writeFileSync(file, content)
        }
    }
    if (isJsx(content) && !fileExt.endsWith('x')) newExt += 'x'
    if (isTs(content) && !fileExt.includes('t')) newExt.replace('j', 't')
    if (fileExt !== newExt) renameSync(file, file.replace(fileExt, newExt))
}

const transformfile = () => {
    if (!readdirSync(cwd).find(dir => ['src', 'packages'].includes(dir))) {
        console.log('请在项目下运行')
        return
    }
    walk(cwd, transform)
}

module.exports = transformfile
```

## 总结

1. webpack转vite, 非esm的第三方包会是个问题.
2. webpack转vite, 各种特性会是个问题. (就像不同浏览器对同一个约定进行了不同的实现)
3. webpack转vite不容易写成共用库, 反而更像是修修补补, 在内部小范围可以快速响应问题的地方使用更合理.
4. 期待vite后续版本解决这系列问题. (如果vite足够流行, 都用vite起项目, 那这也将会不成为问题, 就像抛弃ie)
