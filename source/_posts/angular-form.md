---
title: Angular表单
date: 2016-08-08 14:45:37
categories: 代码
tags: angular 1.x
---
从零开始跟着文档学习angular表单
<!--more-->

**打开了angular1.5.9的form文档开始一行行了解下angular表单的东西吧**

*暂时跳过的部分用这个字体表示， 以便查漏补缺*

[写作时查看的文档地址](https://docs.angularjs.org/api/ng/directive/form)

---

+ *form这个directive是提供api的， 提供了方法和属性。*
+ *如果form有`name`这个属性， form的api会挂在当前scope的这个字段下(后面会有例子)。*
+ *form有个别名是`ng-form`， 作用是浏览器不允许嵌套form的， 用别名可以嵌套了， 嵌套场景可能是有父子关系的input组？*

---

form会被加上一些class， 尝试：
代码中
```html
<form></form>
```
编译后变为了
```html
<form class="ng-pristine ng-valid"></form>
```
也就是angular的form永远会存在一些(2+个)状态class， 这很方便， 并且`ngAmimate`可以自动对这些class进行动画， 这些class为：
> ng-valid is set if the form is valid.
ng-invalid is set if the form is invalid.
ng-pending is set if the form is pending.
ng-pristine is set if the form is pristine.
ng-dirty is set if the form is dirty.
ng-submitted is set if the form was submitted.

---

因为angular的适用场景是SPA， 所以form的提交默认被阻止， 除非form上存在`action`属性。
所以form的提交行为就交给`ng-click`处理吧， 或者使用`form`上的`ng-submit`来指定提交动作以后执行的方法。(提交动作就是触发普通form提交的行为：点击botton和点击type为submit的input）
**重要：为防止重复提交，`ng-click`与`ng-submit`只能使用一种。(不是一个， 是一种)**
`ng-click`执行会在`ng-model`更新前触发， 所以尽量使用`ng-submit`

---

form状态改变导致的class改变都可以和`ngAnimate`配合的， css大概是这样的(在form上加了个my-form的class来区分不同地方的动画):

```css
//be sure to include ngAnimate as a module to hook into more
//advanced animations
.my-form {
  transition:0.5s linear all;
  background: white;
}
.my-form.ng-invalid {
  background: red;
  color:white;
}
```

---

（万万没想到文档竟然这么短。）
文档已经教我们如何拿到form的状态了， 写个简单的form来看一下form的状态如何吧:)

html代码：
```html
	<form ng-submit='submit()' name='form'>
		<input type="text" required ng-model='a'>
		<input type="text" ng-minlength=5 ng-model='b'>
		<input type="number" min=5 ng-model='c'>
		<input type="date" ng-min='123' ng-model='d'>
		<button>submit</button>
	</form>
	<span>{{form}}</span>
```
我把所有input都弄成错的状态了， 以下是form的class情况和页面上打出的结果。
```html
<form ng-submit="submit()" name="form" class="ng-dirty ng-valid-parse ng-invalid ng-invalid-minlength ng-valid-number ng-invalid-min ng-invalid-required ng-valid-date"></form>
```
```js
{
    "$error": {
        "minlength": [
            {
                "$viewValue": "test",
                "$validators": {},
                "$asyncValidators": {},
                "$parsers": [],
                "$formatters": [
                    null
                ],
                "$viewChangeListeners": [],
                "$untouched": false,
                "$touched": true,
                "$pristine": false,
                "$dirty": true,
                "$valid": false,
                "$invalid": true,
                "$error": {
                    "minlength": true
                },
                "$name": "",
                "$options": null
            }
        ],
        "min": [
            {
                "$viewValue": "2",
                "$validators": {},
                "$asyncValidators": {},
                "$parsers": [
                    null,
                    null
                ],
                "$formatters": [
                    null
                ],
                "$viewChangeListeners": [],
                "$untouched": false,
                "$touched": true,
                "$pristine": false,
                "$dirty": true,
                "$valid": false,
                "$invalid": true,
                "$error": {
                    "min": true
                },
                "$name": "",
                "$options": null
            }
        ],
        "required": [
            {
                "$viewValue": "",
                "$validators": {},
                "$asyncValidators": {},
                "$parsers": [],
                "$formatters": [
                    null
                ],
                "$viewChangeListeners": [],
                "$untouched": false,
                "$touched": true,
                "$pristine": false,
                "$dirty": true,
                "$valid": false,
                "$invalid": true,
                "$error": {
                    "required": true
                },
                "$name": "",
                "$options": null
            }
        ]
    },
    "$name": "form",
    "$dirty": true,
    "$pristine": false,
    "$valid": false,
    "$invalid": true,
    "$submitted": false
}
```

---

我猜想一般使用的话只要全局给个ng-invalid的样式就可以实时置红invalid的form，各个地方写验证很麻烦吧。
不允许提交也很简单：
```js
<button ng-disabled='form.$invalid'>submit</button>
```

---

### 细节

+ input的validator一定要配合`ng-model`食用， 否则无效。
+ `ng-required`效果等于`required`， 以此推测pattern也是如此。
+ 其实每个input需要去看各自的文档。
+ 事实证明， 不去disable`button`的话angular也阻止函数执行的。 disable只是样式问题。
