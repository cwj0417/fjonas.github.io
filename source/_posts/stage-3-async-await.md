---
title: 体验stage-3 async/await
date: 2016-11-13 14:39:09
categories: 代码
tags: [javascript,stage-3]
---
ECMAScript官方提出的异步解决方案(可能是阶段性的终极方案), 原理是*generator*的执行器(官方逼死同人系列ww[*co*]). 越新的东西越傻瓜, 所以来体验下.

**本文所有的结论都是基于babel的preset-stage-1环境编译[实验](http://github.com/fjonas/ecma-feature-test)的结果**(这个性质是stage-3的, 只是偷懒?)

<!--more-->

## 基本语法

`async` 在`function`前修饰函数, 使函数变为async函数. 形如:

```js
async function() {
  //do sth.
}
```

在async函数内可以使用`await`来修饰async函数内的方法. 形如:

```js
async function() {
  await doSth();
  let result = await doSthElse();
}
```

## await

+ `await`可以用来修饰同步方法和promise方法.
+ `await`修饰callback方法没有意义. (也就是不会去取callback的结果)

### await修饰同步方法

如果一个async函数中存在多个`await`修饰的方法:

```js

let nonDelayFn = function() {
    return `result`;
};

let promiseNDAsync = async function() {
  let result = await nonDelayFn();
    console.log(result);
    let result2 = await nonDelayFn();
    console.log(result);
};
let NDFResult = promiseNDAsync();
```

执行结果与不加`await`相同. 顺序执行.

### await修饰promise方法

如果一个async函数中存在多个`await`修饰promise的方法:

```js
let promiseFn = function (sucPossibility = 1, delay = 0) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (Math.random() <= sucPossibility) {
                resolve(`sucMsg`);
            } else {
                reject(`errMsg`);
            }
        }, delay);
    })
};

let promiseAsync = async function () {
    let promiseSuc = await promiseFn(1, 5000);
    console.log(`promise suc: ${promiseSuc}`);
    let promiseErr = await promiseFn(0, 5000).catch(err => {
        console.log(`catched err: ${err}`)
    });
    console.log(`promise err: ${promiseErr}`);
};

let asyncReturn = promiseAsync();
```

以上是实验的代码, 得出几个结论:

+ 经过`await`修饰的方法会直接返回promise的resolve结果, 来替代promise
+ 如果有多个`await`修饰的promise函数, **无论是否有依赖关系**都将会依次执行并**等待promise返回结果**再执行下一步. 也就是这个地方以前需要用回调来些.
+ `await`修饰过的promise返回的是resolve结果, 如果失败程序会报错发出退出信号, 所以必须加catch来捕获错误, 或者把await放在`try`块中.
+ 如果promise被reject, catch到错误的话程序会继续运行, await修饰过的方法范围值为`undefined`.

## async

async函数的返回值很容易理解, 有以下特点:

+ `return`任何值的async函数都将被**立即**接收到. 

  ```js
  let promiseFn = function (sucPossibility = 1, delay = 0) {
      return new Promise((resolve, reject) => {
          setTimeout(() => {
              if (Math.random() <= sucPossibility) {
                  resolve(`sucMsg`);
              } else {
                  reject(`errMsg`);
              }
          }, delay);
      })
  };
  let promiseAsync = async function () {
      let promiseSuc = await promiseFn(1, 0);
      console.log(`promise suc: ${promiseSuc}`);
      let promiseErr = await promiseFn(0, 0).catch(err => {
          console.log(`catched err: ${err}`)
      });
      console.log(`promise err: ${promiseErr}`); 
  };

  let asyncReturn = promiseAsync();
  console.log(`async fn returned ${asyncReturn}`);
  ```

  以上代码执行的结果是

  ```
  async fn returned [object Promise]
  promise suc: sucMsg
  catched err: errMsg
  promise err: undefined
  ```

  也就是async的返回值行为与同步函数一样. 所以个人认为他要被应用在异步函数处理的时候大多数**会以匿名函数的形式出现**.

+ `return`的值会被promisefy. 如果返回一个基础类型的值(**包括`null`, `0`, `undefined`**)或者`function`, 会被包装在promise的resolve中.