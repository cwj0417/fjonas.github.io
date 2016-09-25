---
title: es6 in depth 箭头函数
date: 2016-09-10 17:26:14
categories: 代码
tags: [ES2015,es6-in-depth,翻译]
---
箭头从一开始就是javascript的一部分. 一开始javascript教程建议把脚本包起来作为注释. 这种表达会阻止浏览器把js代码错误地显示在html中. 你可能会写以下的代码:

```html
<script language="javascript">
<!--
  document.bgColor = "brown";  // red
// -->
</script>
```

老的浏览器会看到2个不支持的标签和一个注释, 只有新的浏览器可以识别这是js代码.

为了支持这个古老的坑, 你浏览器中的javascript引擎会把`<!--`开始的语句作为一行注释. 这不是玩笑. 这真的一直是语法的一部分, 并每天在生效, 不止是最上面的`<script>`标签而是js的任何地方. 这个特性在node中也有效.

既然这样了, [这样的注释标准第一时间被加入了es6](https://tc39.github.io/ecma262/#sec-html-like-comments). 但这不是今天要讲的箭头.





---

es in depth 系列 [目录](/2016/09/10/es6-in-depth-content/) [原文地址](https://hacks.mozilla.org/category/es6-in-depth/)