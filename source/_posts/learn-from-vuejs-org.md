---
title: 借鉴vue文档改版博客
date: 2019-02-22 16:28:41
categories: 编码与分析
tags: [博客装饰]
---
vue的文档是hexo写的, 我的博客也是hexo写的, 虽然性质不同但为什么别人的好看这么多呢.

我自己修改主题也比较多次了, 看看文档代码学了点细节, 算作一次博客小改版.

<!--more-->

## 总览

从layout开始看vue的文档, 发现也没什么特别的, 但很多细节特别巧妙, 用普通的技术达成高端的效果, 尤老不愧是设计出身的. 本文的标题会一个个分散地列出这次博客改版的内容.

## 基本样式

vue的主题色是两个, 主色绿, 副色橙. 这两个颜色在色盘上应该是接近180度的. 分别用在小代码块和链接上. 于是我尝试根据类似思路修改了`小代码块`和[链接](https://vuejs.org/)的css.

另外我的主题的*斜体*和**粗体**区别不大, 普通的字也太淡了, 一并修改了.

## 引用块和代码块

vue的引用快和代码块均使用了hexo的tag plugin, 而我用了原生的markdown.

我的主题的引用块特别难看, 一开始我以为是plugin和markdown的区别, 后发现plugin也是渲染成markdown的. 只是我css的问题. 代码块也改一下颜色了, 再修改一下引用块的css.

```js
let foo = {
    bar: foo,
    fn: function () {
        return null
    }
}
foo.fn()
```



> 现在引用块的css比较能看了.

## rawhtml

vue文档中感到比较神奇的是一些"提示"之类的块, 感觉不是markdown. 从主题代码中看不出原因, 结果在hexo文档中找到了解释. 使用`{ % raw %}`和`{ % endraw %}`就可以打出生html.

因为这个功能, 我放弃了使用了2年的typora.(卸载纪念) 还是分割型的md工具好用.

于是有两个好处, 一是可以在解释代码的时候直接贴一些效果, 比如:

{% raw %}

<input id="rawhtmltest" placeholder="在文章中写小例子是ok的"/>

<button>但复杂的还是需要jsfiddle</button>

<style>
    #rawhtmltest {background: pink; width: 300px;}
</style>

</style>

{% endraw %}

还有个拓展, vue文档中还有些很帅的标签, 只需要加上类就可以使用效果, 我直接抄过来, 改了下颜色, 以作别的用处. (因为博客和文档性质不同)

{% raw %}

<div class="summary">
{% endraw %}

这是一段章节总结. 这对于写博客比较有用, 采用的是vue的tips样式.

{% raw %}

</div>

{% endraw %}