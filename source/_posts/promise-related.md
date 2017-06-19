---
title: 关于Promise
date: 2016-07-23 12:01:35
categories: 胡乱编码
tags: [javascript,promise,设计模式]
---
promise的理解于实践场景
<!--more-->
## 关于本文
这条是最后加上的, 本文语法来源都是正统的, 理解却是自己的经验产生的, 包括应用, 优缺点, 作用, **可能与部分朋友意见不同或者与主流观点不同.** 

## 关于异步
人是这样的:  有时候想找人说话, 有时候想静静.
女神想找我聊天的时候我想静静, 等我响应女神的时候他已经准备洗澡了. 同步和异步只是等不等的区别.

我与别人有时候关于同步异步有不同的看法, 在我看来同步异步只是等与不等的区别, 本质是一样的, 只是处理方式不同.

## 关于callback
之所以谈一下异步是因为我认为callback与promise也是一样, promise只是一个处理方式的封装, 和callback之间是可以互相替代的.

## promise的优缺点

### promise的优点

#### 避免callback hell

这是聪明的你第一个会想到的.
以下callback伪代码: 
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
如果以上获取信息的方式全是promise的话: 
```js
getSchoolInfo('spicyChickenScool')
.then(schoolInfo => getGradeInfo(2))
.then(gradeInfo => getClassInfo(3))
.then(classInfo => getStudent(4))
.then((student) => {
	//查出了小姐姐的梦想是成为校园偶像
})
```
光从美观上就已分出了胜负.

#### 避免callback的copy paste代码

**本条添加于2016/07/24**

promise把对成功失败的处理统一放在了回调中, 而callback可能反复调用一些方法的时候会需要重复一些代码.

举个简单的例子, 对用户的所有操作（给用户设置权限、更新用户数据、把用户加入某个缓存列表）, 强调一下有许多操作, 接受了用户参数以后要去获取用户的信息, 代码类似以下: 

```js
var updateUser = function(uid, filed, value, callback) {
    getUser(uid, function(err, data) {
        if(err) {
            callback && callback(true);
        }else {
            update(uid, filed, value, function(err, data) {
                //
            })
        }
    })		
}
```

#### 方便组织代码

promise的形式就是为了组织代码而设计的, 下文将会仔细讲解各种实例.

### promise的缺点

#### 兼容问题

promise是个憋了很久的东西了, 市面上也有不同版本和规范的promise实现, 而es2015明确表示了建议使用原生promise.
新的node项目可以安心使用, 对于浏览器端新东西还得做不少处理.
	
#### 模式问题

怎么描述呢, 一但使用promise, 会发现非常不自由, 会期待各处返回值全是promise, 很明显大多数经典的、必须的api全是callback的, 必须包装他们, 这就成了负担, 当然新的api都已经包装成了promise.

#### 异常处理

promise内部异常是需要在error callback中写的, 如果不写内部异常会不抛出导致程序莫名卡死, 查bug无从下手, 导致到处打log查问题的狼狈局面.
具体也会在下文中详细说明.

## promise的实际应用情景

### 请求服务中有某个必须参数
模拟场景:  某个服务封装了一些统计游戏数据的请求, 大部分请求（非所有）需要带上游戏信息, 游戏信息本身就是http请求来的.
在特殊情况下（比如页面初始化, 获取游戏信息慢了）, 服务存储的游戏信息为空, 可能产生 ``getNewUser/game/undefined``类似的尴尬情况, 为处理类似情况,聪明的你可能会想到这些办法: 
+ 设置timeout
+ 查询错误重复查询
+ 设置是否取到游戏信息的标识, 把后续的请求建立队列重新处理

如此可能还有一些问题, 还是会产生有undefined的请求, 错误处理的不方便, 或许你聪明绝顶有更好的办法, 这里只是介绍下promise的使用场景, 并不是宗教战争.

```js
//获取游戏信息的服务
var changeGame = game => new Promise((resolve, reject) => {
    resolve({
        game:game
    })
});
//获取‘pokemon’这个游戏的信息, 其他需要游戏信息的服务取这里的数据就可以
var curGame = changeGame('pokemon');
//获取某个日期新增用户的服务
var getNewUser = date => curGame
    .then(game => new Promise((resolve, reject) => {
        resolve({
            date:date,
            game:game.game,
            newUser:233
        })
    }));
//如此调用
getNewUser('20160724')
.then((res) => {
    // 我们获得了新增数据{date: '20160724', game: 'pokemon', newUser: 233 }
})
```
讲一下原理, changeGame的时候就会马上发起请求, 并且一但resolve,curGame就一直是resolve状态, 调用就能直接获得结果.
如果发生错误可以在changeGame处理, 也能把错误传递到外部的promise, 本例子就写得很残缺了.

### 多组有依赖关系的请求

模拟场景:  获取一个班级列表里第一名学生的信息. （一组请求, 每组请求都有顺序了要求.）

```js
//简单模拟获取班级最强的学生和获取学生信息
var getTopStudent = clazz => Promise.resolve('top student in class' + clazz);
var getStudentInfo = student => Promise.resolve({
    name:student,
    age:18
});
//假设班级列表
var classList = [1,2,3];
//请求列表
var requests = [];
//开始请求
classList.forEach((clazz) => {
    requests.push(
        getTopStudent(clazz)
            .then(studentName => getStudentInfo(studentName))
    );
});
//获取结果
Promise.all(requests)
    .then((results) => {
        //获得的结果为[ { name: 'top student in class1', age: 18 },{ name: 'top student in class2', age: 18 },{ name: 'top student in class3', age: 18 } ]
    })
```

## 其他细节

+ 如果某一个请求依赖某个上上层的结果完全可以在回掉里进行下次请求, 并不是必须写成链式.
+ 同时向多个服务器发起请求, 使用响应最快的数据``Promise.race()``, 一系列请求全部完成再处理数据``Promise.all()``.


