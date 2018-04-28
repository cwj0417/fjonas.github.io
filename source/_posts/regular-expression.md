---
title: 正则从零到简单分析html标签
date: 2018-04-28 14:17:47
categories: 编码与分析
tags: [正则,入门]
---
对于正则之前一直是一个"百度程序员", 也许超过一半甚至更多的程序员也是, 那么这次来学习一下正则表达式.

<!--more-->

## 事出有因

这部分介绍一下需求的由来, 与主要内容无关.

工作上有了这样的需求: 

web端从ueditor来的数据格式是html, 也就是`<p>文章内容</p>`, 并夹杂着诸多标签和嵌套. 

然而正在开发的是react-native项目, rn的标签和html完全不兼容, 是`View, Text, Image`等. 

那么把从web存入的数据读取到rn上就出了大麻烦, 甚至有些地方要进行跳转, 有些图片要显示, 那么怎么办呢.

通过百度"js如何验证邮箱"已经无法满足需求了, 只能学一下了.

## 目标

万事有目标, 我们要把一下内容转换成rn的内容:

```html
<p>嘿嘿嘿<img class="currentImg" id="currentImg" src="https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1524647151050&di=d488d0e93e72f13643d843066ef26836&imgtype=0&src=http%3A%2F%2Fimg02.imgcdc.com%2Fgame%2Fzh_cn%2Fpicnews%2F11128819%2F20160518%2F22678501_20160518152946632994008.jpg" width="201.33333333333" height="302" title="点击查看源网页"/>拖过来的图片哦<img class="currentImg" id="currentImg" src="https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1524647205890&di=5bf77e1d35941def729d2059d91deba8&imgtype=0&src=http%3A%2F%2Fnds.tgbus.com%2FUploadFiles%2F201208%2F20120817142937519.jpg" width="201.17405063291" height="302" title="点击查看源网页"/><br/>a<img src=‘test1’ />b<img src=‘test2’ />c<img src=‘test3’ />d</p>
```

转换结果是: 

```html
<Text>嘿嘿嘿</Text>
<Image source={{uri: 'https://timgsa.baxxxx'}}></Image>
<Text>拖过来的图片哦</Text>
<Image source={{uri: 'https://txx'}}></Image>
<Text>a</Text>
<Image source={{uri: 'test1'}}></Image>
<Text>b</Text>
...
```

本文会从零基础出发达成这个目标.

讲解顺序: 正则介绍 => 正则语法系统 => 简单的例子讲解 => 尝试实现目标以及碰到的问题 => 实现目标

## 什么是正则

初中时候学的通配符, 用`?`代表一个任意字符, 用`*`代表任意个任意字符来进行搜索, 正则也是如此. 比如:

`123[abc]`匹配以下哪组字符?

1. 123c
2. 123d
3. 123e
4. 123f

选了1的朋友你已经知道正则是什么了. `123[abc]`就是正则, 代表匹配内容为: 前三个字符分别为123, 第四个字符是abc中的一个, 这个正则遇到`123a`, `123b`, `123c`都可以匹配成功, 其他任何都匹配失败.

## 正则语法

百度了正则表达式看到的东西都用了很多术语, 让人有点犯浑. 我经过学习把正则抽象为两个部分: `内容`和`修饰`.

看到一长串正则觉得稀里哗啦, 但是里面的每个符号一定都属于`内容`或是`修饰`.

### 内容

内容的形式有3种: 

1. 直接匹配: 举例就是刚才的`123[abc]`中的`123`, 这种匹配需要完全吻合才能匹配, `123`就唯一匹配`123`.
2. 范围匹配: 用中括号表示, 也就是刚才例子中的`[abc]`. 这种情况也就是三选一. 任意匹配`a`或`b`或`c`, 而不是匹配`abc`. 还有两种形式: 加`-`来表示范围, 比如`[a-z]`; 表示排除范围内的`^`, 比如`[^abc]`
3. 匹配并选择缓存到子匹配: 用圆括号表示, 圆括号中的内容语法是"直接匹配"但会被记入缓存作为子匹配, 我记得我最初接触正则就是url rewrite, 写了url正则之后用`$1, $2`来重写url.

在范围匹配中, 我们经常会用: 数字/字母, 也就是`[0-9]`, `[a-zA-Z]`, 但是经常用到重复地写麻烦又看不能装逼了, 所以产生了一些快捷方式: `\d`代表`[0-9]`, `\w`代表`[0-9a-zA-Z_]`这正好是常用的用户名和密码的规则.

这里深入一下圆括号匹配的两个点. 作为拓展, 可以先不看一下的内容直接到下一部分.

因为圆括号中可以用`|`符号来表示或的关系, 但有时候又不想被加入缓存. 于是可以用`?:`来表示不需要缓存. 例子:`hello (?:world|regular expression)`, 用来匹配`hello world`或者`hello regular expression`, 但又不需要把`world`储存为缓存.

如果之前已经用圆括号, 那么期望之后出现同样的内容, 可以用`\1`这样`\`加数字来表示. 举个例子: 单引号和双引号, 我们要匹配`'123'`或者`"123"`, 但是要保持引号一致.  `('|")123\1`就可以解决问题.

### 修饰

我把修饰部分分为数量修饰和边界修饰.

1. 数量修饰: 符号为{}, 想到了谷歌: `go{2,4}gle`这个正则可以匹配`google`, `gooogle`, `goooogle`, 代表这个`o`可以匹配2或者4次. 当然只是为了举例可以枚举, 因为`go{2,}gle`代表可以无限个`o`, 这样举例不方便.

   与之前的范围匹配一样, 数量修饰也有快捷符号: `?`代表{0,1}, `*`代表{0,}, `+`代表{1,}. 都很形象, 不用死记, 就像刚才的d for digital, w for word. 看过一个例子: `colou?r` 这里的`?`表示可有可无, 美式和英式的拼写都可以匹配.

   另外在"无上限"的数量的右边加`?`代表不贪婪匹配, 会匹配数量最少的内容. 举例: `a+`匹配`aaaaa`的结果为`aaaaa`, `a+?`匹配`aaaaa`的结果为`a`.

2. 边界修饰: `^`表示字符串的头, `$`表示字符串的尾, `\b`表示字母与空格间的位置. 用来给匹配定位, 具体用法在实际中操作就会有具体感受了.

   另外, 正则有一种匹配模式是`m`, 多行匹配模式, 这个情况里`^`和`$`也能匹配每一行的开头和结尾.

## javascript相关函数

首先明确正则是"正则表达式"与"字符串"发生的匹配关系.

js有个对象是`RegExp`, 使用方法是`new RegExp(pattern, mode)`, 或者是用`/`包裹的字面量: `/pattern/mode`.

这里发现提到了`mode`匹配模式, 一共三种:

1. g: 全局匹配, 匹配到一次不会停止, `/a/`匹配`aaa`, 如果没有g结果是一个`a`, 有g结果是3个`a`.
2. i: 忽略大小写.
3. m: 多行模式. 和之前提到的`\b`有联动.

三个模式不互斥, 叠加的, 也就是可以`new RegExp(patter, 'gin')`.

正则的方法有:

1. `.test()`: 返回是否匹配成功, true或者false.
2. `.exec()`: 失败返回null, 成功返回数组, 位置0是匹配内容, 之后是圆括号匹配的内容. 要注意的是exec是忽略'g'模式的.

字符串的方法:

1. `.replace(pattern, replacement)`: replacement可以字符串或方法, 方法的话参数是匹配到的内容.
2. `.match(pattern)`: 返回数组, 所有匹配到的内容.

## 分析一些简单常用的例子

### 是否小数

```js
function isDecimal(strValue )  {  
   var  objRegExp= /^\d+\.\d+$/;
   return  objRegExp.test(strValue);  
}  
```

`\d`代表数字, `+`代表至少有1个数字,  `\.`转移小数点.

连起来看就是: 至少一个数字(`\d+`) 小数点(`\.`) 至少一个数字(`\d+`) .

`^`和`$`代表头尾, 真个字符串是小数的全部, 而不是包含小数.

### 是否中文名

```js
function ischina(str) {
    var reg=/^[\u4E00-\u9FA5]{2,4}$/;   /*定义验证表达式*/
    return reg.test(str);     /*进行验证*/
}
```

这个范围是中文的编码范围: `[\u4E00-\u9FA5]`, `{2,4}`匹配2~4个. 也就是匹配2~4个中文.

### 是否八位数字

```js
function isStudentNo(str) {
    var reg=/^\d{8}$/;   /*定义验证表达式*/
    return reg.test(str);     /*进行验证*/
}
```

### 是否电话号码

```js
function isTelCode(str) {
    var reg= /^((0\d{2,3}-\d{7,8})|(1[3584]\d{9}))$/;
    return reg.test(str);
}
```

分两个部分: 座机号和手机号, 用`|`隔开了.

座机号: 0开头的三位数或四位数 短杠 7~8位数字.

手机号: 第一位1, 第二位3584的一个, 剩下由9个数字凑满11位电话.

### 邮箱地址

```js
function IsEmail(str) {
    var reg=/^([a-zA-Z0-9_-])+@([a-zA-Z0-9_-])+(\.[a-zA-Z0-9_-])+$/;
    return reg.test(str);
}
```

## 迈向目标

这个章节开始整理实现需求的思路.

先回忆一下正则的规则, 其实很简单, 和加减乘除一样, 有各种符号: [], (), |, -, {}, +, *, ?. 当然也可以很复杂, 因为也和加减乘除一样, 可以嵌套, 而正则的符号本来就多, 嵌套起来更是晕, 有一些符号在不同地方有不同作用, 比如`\`和`^`.(思考题: 分析一下这两个符号有哪些作用, 在什么场景).

那么我们的目标是: 把一段html分析称rn的标签.

因为rn没有parse的功能, 所以不可以使用replace. (replace是代码高亮的常用手段).

所以我们必须把html分解成js对象, 再从js对象里去分析输出rn标签.

因为html标签分为多种, 为了保证完整性和可维护性, 要把各个标签的正则分开写, 也便于之后在分析每个片段的时候来取子匹配, 比如img标签的src, a标签的href.

经过研究, 正则是不可以拼接的, 只有字符串可以拼接. 所以我们要把不同标签的正则写成字符串, 再在需要的时候拼接. `new RegExp(pattern)`的pattern参数是可以接受字符串的.

## 匹配text的难题与正则匹配的动作分析

众所周知, 在html里的text是可以光秃秃的(在rn里必须加上Text标签). 那么如何匹配这光秃秃的东西呢, 我开始想了一个办法: 因为text都在标签之外, 也就是"夹在>和<中的字符", 或者在开头(^)和<间的, 或者>和结尾($)间的. 结果标签全都匹配不到了.

原因是这样的, 如果有'g'的模式, 匹配的过程是这样的: 

1. 进行第一次匹配, 匹配成功后把匹配部分排除待匹配内容.
2. 进行第二次匹配, 匹配成功后把匹配部分排除待匹配内容.
3. 直到匹配失败, 返回所有结果.

举个例子: 

```js
'applebananaapple'.match(/(apple|banana)/g)
```

结果是`["apple", "banana", "apple"]`

如果把banana的最后一个字母和apple的第一个字母写成一个:

```js
'applebananapple'.match(/(apple|banana)/g)
```

那么结果就是`["apple", "banana"]`了.

反而利用了这个特点, 把text的正则写成: 不包含`<>/` (`[^<>/]+`), 并添加在最后一个匹配, 就能正确地匹配出text啦.

## 揭晓答案

写得急促也许有遗漏, 最后贴上完成需求的代码, 语言是rn, 在map输出的时候带着一些项目业务的逻辑请无视.

```js
import React, {Component} from 'react'
import {Text, View, Image, Platform, StyleSheet, TouchableOpacity} from 'react-native'
import {ENVS} from '../../config/apiHost'

/*
    必须props: @html: html内容
    可选props:  @style: 字体style; @magnifyImg: 显示大图
 */

const regex = {  // '_' for close tag
    p: `<p[^>]*?>`,
    _p: `<\/p>`,
    span: `<span[^>]*?>`,
    _span: `<\/span>`,
    br: `<br\/>`,
    a: `<a[^>]*?href=(\'|")([^>]+?)\\1[^>]*?>([^<]+?)<\\/a>`, // $1 是标点符号用来处理匹配 $2 href的带引号的内容 $3 文件名(a标签的innerText),
    img: `<img[^>]*?src=('|")([^>]+?)\\1[^>]*?\\/>`, // $1 标点符号 $2 src的内容
    text: `[^<>/]+`, // 匹配剩下的, 一定要放在最后
}

const tobeRemoved = new RegExp(`(?:${[regex.p, regex._p, regex.span, regex._span, regex.br].join('|')})`, 'g')

const parseToAst = new RegExp(`(?:${[regex.a, regex.img, regex.text].join('|')})`, 'g')

export default class Parsed extends Component {
    render () {
        let str = this.props.html.trim()
        if (!str) {
            return (
                <Text>html attr not passed to component 'parseHtml'</Text>
            )
        }
        matches = str.replace(tobeRemoved, '').match(parseToAst)
        return (
            <View>
                {matches.map((block, index) => {
                    for (let [key, value] of Object.entries(regex)) {
                        let res = new RegExp(value).exec(block)
                        if (res) {
                            if (key === 'text') {
                                return (
                                    <Text style={this.props.style} key={index}>{block}</Text>
                                )
                            }
                            if (key === 'a') {
                                if (res[2].includes('files')) { // 判断附件
                                    if (/[jpg|png|jpeg]/i.test(res[3])) { // 判断图片
                                        let imgId = res[2].match(/\d+/)[0]
                                        return (
                                            <TouchableOpacity key={index} onPress={() => {this.props.magnifyImg && this.props.magnifyImg(ENVS.production.api_base_url + '/files/' + imgId)}} >
                                                <Image style={{width: 100, height: 100, margin: 10}} source={{uri: ENVS.production.api_base_url + '/files/' + imgId}}></Image>
                                            </TouchableOpacity>
                                        )
                                    }
                                }
                            }
                            if (key === 'img') {
                                return (
                                    <TouchableOpacity key={index} onPress={() => {this.props.magnifyImg && this.props.magnifyImg(res[2])}}>
                                        <Image style={{width: 100, height: 100, margin: 10}} source={{uri: res[2]}}></Image>
                                    </TouchableOpacity>
                                )
                            }
                        }
                    }
                })}
            </View>
        )
    }
}
```
