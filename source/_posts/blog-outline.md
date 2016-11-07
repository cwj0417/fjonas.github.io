---
title: 博客生成目录
date: 2016-11-07 17:28:14
categories: 代码
tags: hexo
---
本次尝试给博客的文章加个目录. 完成了第一版, 虽然还存在各种问题, 但是大概的样子已经有了.
前前后后的东西也不多吹了, 直接由步骤作为大标题了.
<!--more-->

## 放置

由于每个文章目录不同, 第一想法是必须有js来生成, 所以没有放在widget中, 暂时选择放在`post.jade`中引入的`post.js`中来用jquery强行append一个目录.

## 检索标题

由于博客标题, 文章标题都是H1标题, 一般文章内容从H2开始(并不是什么一般, 其实是不由H2开始那目录就乱了).
思路很简单, 代码也很简单, 所以只能用代码撑一下文章字数:
```js
//过滤一下特殊字符
function escp(a) {
        return a.replace(/([\s\.\*\=\+\>\,\[\]\:\~\?\'\"\(\)])/g, '\\$1');
    }
//从dom树种检索标题
function getOutLine(titles, startNum) {
    var content = [];
    [].filter.call(titles, function (item) {
        return item.tagName == "H" + startNum;
    }).forEach(function (item) {
        content.push(generateOutline(item, startNum));
    });
    function generateOutline(item, tagn) {
        $(item).attr('id', escp(item.textContent));
        var result = {
            name: item.textContent,
            depth: +tagn,
            child: []
        };
        var flag = false;
        for (var index = 0; index < titles.length; index++) {
            if (titles[index] == item) {
                flag = true;
                continue;
            }
            if (flag) {
                if (titles[index].tagName == "H" + tagn) {
                    break;
                }
                if (titles[index].tagName == "H" + (+tagn + 1)) {
                    result.child.push(generateOutline(titles[index], +tagn + 1));
                }
            }
        }
        return result;
    };
    return content;
}
```
然后调用一下:

```js
var titles = $('h2,h3,h4,h5');
var content = getOutLine(titles, 2);
```

当然是依赖了jquery, 所以好像不能在别的地方服用, 要用的话得简单修改下.

这样`content`是获得到的标题树了, 现在直接复制代码在浏览器的控制台就能看到`content`的内容了.

## 生成目录

由于目录是由结构的(虽然大多文章结构并不多), 所以不能一个循环完成, 需要多写几行: 

```js
function appendMess(target, data) {
  var li = $('<li>');
  var a = $('<a>');
  a.attr('href', "#" + escp(data.name));
  a.html(data.name);
  li.html(a);
  li.addClass('depth' + data.depth);
  target.append(li);
  if (data.child.length > 0) {
    var ul = $('<ul>');
    ul.addClass('nav');
    ul.addClass('depth' + (+data.depth + 1));
    li.append(ul);
    data.child.forEach(function (each) {
      appendMess(ul, each);
    });
  }
}
```

然后把数据, 生成到的标的dom传入就可以了, 再加个标题'目录', 用jquery加到右边的widget上就可以了.

## spy

当然有了目录要知道当前滚到哪里, 所以找到了这个[lib](https://github.com/forsigner/scroll-spy), 会把当前滚到的地方加上`active`类, 但这不是我理想的lib, 优化时需要修改用法或者换别的lib.

代码的话是:

```js
scrollSpy.init({nodeList: $("nav a")});
```

这样滚动到哪会给加上`active`类, 在css里处理下就ok了.

## pin

当然作为目录需要被固定, 要不spy还有什么意义. 于是也找到了个[lib](https://github.com/webpop/jquery.pin), 这个非常炫酷了. 

代码的话也一样简单:

```js
$("#outline").pin();
```



## 总结

初步的, 难看的, bug很多的目录就做好了, 今后会改(lan)进(wei)的.

以上一切都需要jquery, 哈哈. 正好也不浪费.