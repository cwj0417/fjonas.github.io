---
title: code-mirror块高亮
categories: 工作笔记
date: 2025-02-08 13:52:13
tags: [codemirror]
---
之前用code-mirror些了个便签, 最近又开始想复习找工作, 用起来还差点意思.

markdown比较适合写作, 用在"便签"系统, 在需要"给列表打钩"来表示完成状态的时候就没招了.

而我这复习列表正是需要给列表标注状态.

<!--more-->

这里记录实现思路, 再结合上次存放图片的功能聊聊对decoration的认识.

## 需求和思路

与存放图片功能的类似, 希望选中一段文本, 快捷键操作让他改变背景颜色, 并且产生对应的标签语法, 因为毕竟在markdown环境中.

于是需求就拆分成了2个:

+ 快捷键给选中的文本增加标签, 我这里暂定的是这样的标签:`#(数字)#(内容)$$` 其中数字表示颜色序号.

  (这里我直接使用了标签的9个颜色主题, 他们是被仔细选过与文字颜色对比和谐的, 也已经处理过黑暗模式)

+ 给有对应标签语法的文字背景样式.

## 实现

实现这2个功能都是通过extension.

### keybinding

先来说keybinding, 我希望 cmd + 数字1~9 来触发, 但cm的keybinding只能指定按键, 于是就直接绑定9个按键.

```js
[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => getKeyBinding(i))
```

在`getKeyBinding()`方法里返回一个`KeyBinding`对象.

```typescript
const getKeyBinding: (i: number) => KeyBinding = (i) => {
    return {
        key: `Mod-${i}`,
        run: (view: EditorView) => {
            view.dispatch(view.state.changeByRange(range => {
                let content = view.state.doc.sliceString(range.from, range.to)
                const originLenth = content.length;
                const isMatched = /^#(\d)#.*\$\$$/.exec(content)
                if (isMatched) {
                    if (isMatched[1] === i.toString()) {
                        content = content.replace(/^#\d#(.*)\$\$$/, '$1');
                    } else {
                        content = content.replace(/^#\d#(.*)\$\$$/, '#' + i.toString() + '#' + '$1' + '$$$');
                    }
                } else {
                    content = `#${i}#${content}$$`;
                }
                return {
                    changes: [{ from: range.from, to: range.to, insert: content }],
                    range: EditorSelection.range(range.from, range.to - originLenth + content.length),
                }
            }))
            return true;
        }
    }
}
```

1. 通过api获取到选中的文本`content`.
2. 判断文本`content`的情况, 对`content`进行处理.
3. 通过api把修改的`content`插入会文本.

修改`content`的情况分为这3种:

1. 正则不命中, 则是普通文本, 那就在文本两侧加上标记.
2. 通过正则取出"标记数字"如果和目标数字相同, 则取消标记.
3. 如果和目标数字不同, 则把数字修改为目标数字.

### 通过标记语法修改背景颜色

插件的入口和插入图片的入口是一样的:

```typescript
const bgRenderer = ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
        this.decorations = createBgDecro(view)
    }
    update(update: any) {
        if (update.docChanged || update.viewportChanged)
            this.decorations = createBgDecro(update.view)
    }
}, {
    decorations: (v) => v.decorations,
})
```

这是控制在初始化和更新的时候重新渲染decoration.

下面是decoration的主体部分:

```typescript
const createBgDecro = (view: EditorView) => {
    const text = [...view.state.doc].join('')
    // #1#content$$
    const bgRegex = /#(\d)#(.+)(\$\$)/g
    let builder = new RangeSetBuilder<Decoration>()
    let isMatched: boolean | null | RegExpExecArray = true;
    while (isMatched) {
        isMatched = bgRegex.exec(text);
        if (isMatched) {
            // bg color
            builder.add(isMatched.index, isMatched.index + isMatched[0].length, Decoration.mark({
                attributes: {
                    style: `background-color: var(--sticky-${isMatched[1]})`
                }
            }))
            // prefix small text
            builder.add(isMatched.index, isMatched.index + 3, Decoration.mark({
                attributes: {
                    style: `font-size: 10px`
                }
            }))
            // postfix small text
            builder.add(isMatched.index + isMatched[0].length - 2, isMatched.index + isMatched[0].length, Decoration.mark({
                attributes: {
                    style: `font-size: 10px`
                }
            }))
        }
    }
    return builder.finish()
}
```

`createBgDecro()`接受`EditorView`参数, 获取当前文档内容, 返回一个decoration.

这里的decoration和extension一样, 可以返回数组, cm在处理的时候会先flatten.

`RangeSetBuilder()`的作用就是最后返回[decoration, decoration, decoration], 上次做显示图片功能的时候就是直接返回的.

[文档对decoration的介绍](https://codemirror.net/docs/ref/#view.Decoration)解释了不能直接操作dom, 是无效的, 要通过decoration来改变样式或者增加一些表现.

decoration类是继承于rangeValue类的, 所以decoration必须会有range信息, 再根据不同的decoration类型有一些额外的属性.

decoration的类型都是由decoration的静态方法创建的. 我们这里用到了`mark`, 是给指定的range加上一些attr.

之前显示图片功能用到的是`widget`, 因为图片需要增加dom, 光修改样式不够.

### 加载

我们把2个写好的extension加载到配置里就完成了.

```typescript
export const blockbg = [bgRenderer, keymap.of([1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => getKeyBinding(i)))]
```

```typescript
let startState = EditorState.create({
    doc: init(),
    extensions: [
        // ...
        blockbg,
    ]
})
new EditorView({
    state: startState,
    parent: dom(),
}).focus()
```

