---
title: 关于Promise
date: 2016-07-23 12:01:35
categories: 
- 工作相关
tags: 
- javascript	
- promise
- 设计模式
---

## 关于本文
这条是最后加上的， 本文语法来源都是正统的， 理解却是自己的经验产生的， 包括应用， 优缺点， 作用， **可能与部分朋友意见不同或者与主流观点不同。** 

## 关于异步
人是这样的： 有时候想找人说话， 有时候想静静。
女神想找我聊天的时候我想静静， 等我响应女神的时候他已经准备洗澡了。 同步和异步只是等不等的区别。

我与别人有时候关于同步异步有不同的看法， 在我看来同步异步只是等与不等的区别， 本质是一样的， 只是处理方式不同。

## 关于callback
之所以谈一下异步是因为我认为callback与promise也是一样， promise只是一个处理方式的封装， 和callback之间是可以互相替代的。

## promise的优缺点

### promise的优点

#### 避免callback hell

这是聪明的你第一个会想到的。
以下callback伪代码：
```js
getSchoolInfo('spicyChickenScool', (schoolInfo) => {
	getGradeInfo(2, (gradeInfo) => {
		getClassInfo(3, (classInfo) {
			getStudent(4, (student) => {
				//悄悄调查小姐姐的个人信息
			})
		})
	})
})
```
如果以上获取信息的方式全是promise的话：
```js
getSchoolInfo('spicyChickenScool')
.then(schoolInfo => getGradeInfo(2))
.then(gradeInfo => getClassInfo(3))
.then(classInfo => getStudent(4))
.then((student) => {
	//查出了小姐姐的梦想是成为校园偶像
})
```
光从美观上就已分出了胜负。

#### 方便组织代码

promise的形式就是为了组织代码而设计的， 下文将会仔细讲解各种实例。

### promise的缺点

#### 兼容问题

promise是个憋了很久的东西了， 市面上也有不同版本和规范的promise实现， 而es2015明确表示了建议使用原生promise。
新的node项目可以安心使用， 对于浏览器端新东西还得做不少处理。

#### 模式问题

怎么描述呢， 一但使用promise， 会发现非常不自由， 会期待各处返回值全是promise， 很明显大多数经典的、必须的api全是callback的， 必须包装他们， 这就成了负担， 当然新的api都已经包装成了promise。

#### 异常处理

promise内部异常是需要在error callback中写的， 如果不写内部异常会不抛出导致程序莫名卡死， 查bug无从下手， 导致到处打log查问题的狼狈局面。
具体也会在下文中详细说明。





