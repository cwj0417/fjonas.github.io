---
title: codemirror处理图片的插件
categories: 工作笔记
date: 2023-03-26 00:41:21
tags: [codemirror]
---
最近第一次用了codemirror.

基本配置外, 写了一个粗体md快捷键插件, 和一个拖拽/粘贴图片产生md格式并预览图片的插件.

记录一下开发过程. (但因为没有用过任何竞品包括monaco, 无法比较功能和开发体验)

<!--more-->

## codemirror基本概念

codemirror是个js写的编辑器(下文简称cm), 想给我做的效率软件的便签功能增加可操作性, 就打算引入cm.

是从一个以前关注的项目(不记得是什么了)得知的. 

至于为什么不用大名鼎鼎的monaco, 我只能说分析不了自己想法.

### 基本用法

用的版本自然是最新的6, 把包拆得比较细, 并且只提供了npm的输出, 还推荐用rollup打包代码.

基本用法是相当简单. 代码如下:

```js
new EditorView({
    state: EditorState.create({
        doc: ''
    }),
    parent: document.getElementById('editor'),
})
```

把初始值和dom节点设置好, 编辑器就出现了.

### 拓展功能的方式

在cm里, 功能拓展只通过一种方式: `extension`.

其实种类非常多, 但cm把各种拓展方式的集合称为`extension`, 为了便于抽取发布, 还可以随便嵌套. (我估计最后执行的时候一个方法flat一下)

虽然种类多, 但目标一定是编辑器本身: `editorView`. 这个对象里有一个同样重要的状态: `viewState`.

不同种类的`extension`最后一定会落到`editorView`上.

### 预设extension

文档里有这么一个预设: `basicSetup`, 在按照文档使用后发现和我项目的其他快捷键有冲突.

于是我尝试手动剔除一些`extension`, 结果花了很久还是不理想. 

最后看了`basicSetup`的代码, 注释里提示这个预设不支持自定义, 想自定义直接复制代码修改就是了.

于是按照他说的复制, 去掉了一些冲突的快捷键和不需要的功能. 代码比较长也无意义, 就不贴了.

当然只用预设还太不够, 下面开始记录我使用到的一些api.

### 准备动手: 变化后保存数据

在文档里找到个的api来监听编辑器update事件, 直接使用就可以了.

再加上个防抖, 把编辑器的内容传出去.

```js
EditorView.updateListener.of(function (e) {
    clearTimeout(debounce)
    debounce = setTimeout(() => onchange(e.state.doc.toString()), 350)
}),
```

### 简单的插件: md粗体快捷键

目标: 使用快捷键将选中的内容toggle粗体. 因为全局是md环境, 所以toggle的方式是增加/去掉边界的`*`符号.

方法: 通过绑定快捷键触发方法, 获取选中内容的内容, 位置. 分析内容来产生新的内容, 并设置新内容与选区.

绑定快捷键:

```js
extensions: [keymap.of([bold])]
```

bold方法:

```js
const bold: KeyBinding = {
    key: "Mod-b",
    run: (view: EditorView) => {
        view.dispatch(view.state.changeByRange(range => {
            let content = view.state.doc.sliceString(range.from, range.to)
            const originLenth = content.length;
            const isBold = /^\*\*.*\*\*$/.test(content);
            if (isBold) {
                content = content.replace(/^\*\*(.*)\*\*$/, '$1');
            } else {
                content = `**${content.replace(/^\**([^\*]*)\**$/g, '$1')}**`;
            }
            return {
                changes: [{ from: range.from, to: range.to, insert: content }],
                range: EditorSelection.range(range.from, range.to - originLenth + content.length),
            }
        }))
        return true;
    }
}
```

## 复杂些的插件

接下来最后一个比较复杂的插件, 做的时候还不确定可以实现, 很幸运最后捋顺了, 但不确定离最佳实实践多远.

### 需求的来源和细节

使用场景是, 一些图片/截图想暂存到便签里.

希望的方式是: 粘贴/拖动到编辑器中, 图片能展示在编辑器里.

编辑器整体设定是md环境, 所以顺带要做支持md的图片预览, 上面的需求也以md形式展现.

### 任务拆分

说一下任务的拆分, 这个拆分是结果倒推的, 不含摸索过程.

+ 建立一个widget extension. 在符合图片md语法的下方显示图片.
+ 监听paste和drop事件, 读取文件并存到缓存目录, 然后生成一个md图片贴到编辑器上.
+ 监听编辑器删除动作, 判断删除目标是图片, 就删除整个图片, 如果图片地址是缓存目录, 就删除图片.

### 实现流程

因为项目环境是electron和vue, 所以抽了个方法, 实现里掺杂一些vue和node的api.

```js
const { fs, join, ipcRenderer, Buffer } = (window as any).apis
import { onMounted } from 'vue';
import {
    EditorView,
    keymap,
    KeyBinding,
    ViewPlugin,
    DecorationSet,
    Decoration,
    WidgetType,
} from "@codemirror/view"
import { deleteCharBackward } from '@codemirror/commands';

export const useImgDnPPlugin = () => {
    let userPath: string
    const delImage: KeyBinding = {
        key: "Backspace",
        run: (view: EditorView) => {
            const anchor = view.state.selection.main.anchor
            const pictureRegex = /!\[([^\]]+)\]\(([^\)]+)\)$/;
            const isMatched = view.state.doc.text.join('-').slice(0, anchor).match(pictureRegex)
            if (isMatched) {
                const [string, , url] = isMatched;
                view.dispatch({
                    changes: {
                        from: anchor - string.length - 1,
                        to: anchor,
                        insert: ''
                    }
                })
                try {
                    if (url.startsWith('file')) {
                        fs.unlinkSync(url.substring(7));
                    }
                } catch (e) {
                    console.log(e);
                }
            } else {
                deleteCharBackward(view);
            }
            return true
        }
    }
    class ImageWidget extends WidgetType {
        constructor(private alt: string, private url: string) {
            super();
        }
        eq(prev: ImageWidget) {
            return prev.url === this.url && prev.alt === this.alt;
        }
        toDOM() {
            const img = document.createElement("img");
            img.style.width = '100px';
            img.alt = this.alt;
            img.title = this.alt;
            img.src = this.url;
            img.style.cursor = 'pointer';
            img.addEventListener('click', () => {
                if (img.style.width === '100px') {
                    img.style.width = '100%';
                } else {
                    img.style.width = '100px';
                }
            });
            return img;
        }
    }

    const createImage = (view: EditorView) => {
        const text = (view.state.doc as any).text.join('-'); // join '-' for doc range contains \n.
        const pictureRegex = /!\[([^\]]+)\]\(([^\)]+)\)/g;
        const matched = [];
        let isMatched: boolean | null | RegExpExecArray = true;
        while (isMatched) {
            isMatched = pictureRegex.exec(text);
            if (isMatched) {
                const dec = Decoration.widget({
                    widget: new ImageWidget(isMatched[1], isMatched[2])
                })
                matched.push(dec.range(isMatched.index + isMatched[0].length))
            }
        }
        return Decoration.set(matched);
    }

    const imagePlugin = ViewPlugin.fromClass(class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = createImage(view);
        }
        update(update: any) {
            if (update.docChanged || update.viewportChanged)
                this.decorations = createImage(update.view);
        }
    }, {
        decorations: v => v.decorations,
    })

    const saveImageToCache = (file: File, cb: (fname: string) => void) => {
        const fileName = join(userPath, 'imgcache', Date.now() + file.name)
        const reader = new FileReader()
        reader.readAsArrayBuffer(file)
        reader.onload = () => {
            const fcontent = reader.result as string
            fs.writeFileSync(fileName, Buffer.Buffer(fcontent))
            cb(fileName)
        }
    }
    const ImageDropAndPaste = [keymap.of([delImage]), imagePlugin, EditorView.domEventHandlers({
        paste(event: any, view) {
            if (event.clipboardData?.items?.[0]?.type?.startsWith('image')) {
                const file = event.clipboardData.items[0].getAsFile()!;
                saveImageToCache(file, (filename) => {
                    view.dispatch({
                        changes: {
                            from: event.target.cmView.posAtEnd,
                            insert: `\n![${file.name}](file://${filename})`
                        }
                    })
                })
            }
        },
        drop(event: any, view) {
            if (event.dataTransfer?.items?.[0]?.type?.startsWith('image')) {
                const file = event.dataTransfer?.items?.[0]?.getAsFile()!;
                saveImageToCache(file, (filename) => {
                    view.dispatch({
                        changes: {
                            from: event.target.cmView.posAtEnd,
                            insert: `\n![${file.name}](file://${filename})`
                        }
                    })
                })
            }
        }
    })];
    onMounted(() => {
        ipcRenderer.invoke('getUserPath')
            .then((path: string) => {
                userPath = path
                if (!fs.existsSync(join(path, 'imgcache'))) {
                    fs.mkdirSync(join(path, 'imgcache'))
                }
            })
        
    })
    return ImageDropAndPaste
}
```

`ImageDropAndPaste`是最后的输出, 最后给他加到`extensions`数组里就可以.

`ImageDropAndPaste`包含3个插件, 分别是上文所说的三个子任务: 删除操作, 图片widget, paste/drop响应.

#### 图片widget`imagePlugin`

+ 调用插件api, 在创建和更新的时候更新自己缓存的decorations. 第二个函数暴露decorations.
+ `createImage(view)`, 接受`EditorView`, 创建decoration. 从view的api里用正则抓所有的md图片语法. 在对应的地方创建widget.
+ `ImageWidget`是`WidgetType`的子类, 实例化的时候接受了url和alt存起来, eq方法来决定编辑器更新后是否重新渲染, toDOM方法就是widget的本体.

#### paste/drop事件处理

使用`EditorView.domEventHandlers`来监听paste和drop事件, 把文件存到缓存目录里, 再使用`EditorView`的api来把md图片语法插入编辑器.

需要注意的是, paste事件不能有返回值, 写了返回值原来的paste事件就没效果了.(编辑器不能粘贴了)

#### 编辑器删除动作处理

用`keymap.of()`绑定Backspace键, 在方法里用参数`EditorView`的api获取文本, 判断光标是不是在图片的右边.

如果在图片右边, 就把整个md图片语法都删除, 如果图片是file协议, 再尝试删除缓存图片.

这里要注意的是, 如果没有命中以上规则, 要手动调用`deleteCharBackward(view)`进行默认操作.

## 问题和下一步

上面实现里的一些`viewState`操作, 获取dom上的`cmView`, 都感觉不太正规, 不知道有没有正式api.

另外还有能想到的优化点: 

+ 当焦点不在图片md一行的时候, 隐藏md语法的一部分内容. (url, 或者是md语法)
+ 图片展示的处理, 优化空间比较大.



