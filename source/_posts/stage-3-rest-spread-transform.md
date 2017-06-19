---
title: stage-3 rest函数和解构赋值
date: 2016-12-02 08:20:33
categories: 胡乱编码
tags: [javascript,stage-3,ES2015]
---
已经使用了一段时间es的新标准, 很明显感受到编码的感觉与之前不同了. 一开始以为没什么用的rest和解构倒反而使用得较多. 所以来看一下他们的便利的例子.

<!--more-->

## 语法描述

### 解构赋值/rest参数

所以解构赋值就是按照格式取值, 如下:

```js
let [foo, [[bar], baz]] = [1, [[2], 3]];
foo // 1
bar // 2
baz // 3
```

如果格式没对上取到的是`undefined`, 或者外层数据类型就不同则报TypeError.

rest参数的语法:

```js
let getParam = function(head, second, ...tails) {
  console.log(head, second, tails);
}
getParam(1,2,3);// => 1 2 [3]
getParam();// => undefined undefined []
```

我把这2个一起讲的原因是因为他们差不多, 根据结构取值. 把取到的东西放在数组里. 并且没取到的情况不是`undefined`而是一个空数组.

### 默认参数

默认参数在给对象属性默认值的时候有时候令人迷糊, 但是仔细考虑原则:

> **默认值生效的条件是, 对象的属性值严格等于`undefined`**

```js
function move({x, y} = { x: 0, y: 0 }) {
  return [x, y];
}

move({x: 3, y: 8}); // [3, 8]
move({x: 3}); // [3, undefined]
move({}); // [undefined, undefined]
move(); // [0, 0]
```

这个行为的原因是, 只有当参数不传时才会全等于`undefined`. 所以我个人认为**这种写法是不推荐的**, 应该换成下面这种:

```js
function move({x = 0, y = 0} = {}) {
  return [x, y];
}
```

## 应用

### 解构取值

这个做法很基本, 但是实际使用中用得非常多. 

```js
let fn = function({state, commit}) {
  commit(state);
}
fn({
  state: "state",
  commit: function(state) {
    //actions
  }
})
```

这样的写法等同于: 

```js
let fn = function(param) {
  let {state, commit} = param;
  commit(state);
}
```

当然如果调用`fn()`会报匹配失败, 调用`fn({})` 在`commit(state)`处会报错. 所以我们可以给这个取值也加上默认值:

```js
let fn = function({state = "state was missiong", commit = function(){
  console.log("i can not commit anything")
}} = {}) {
  commit(state);
}
```

这样是完美的, 但是如果某个参数是必须的请不要这样做啦. 

### rest参数

这是一个百度到的柯里化的实现:

```js
function currying(fn) {
            var slice = Array.prototype.slice,
            __args = slice.call(arguments, 1);
            return function () {
                var __inargs = slice.call(arguments);
                return fn.apply(null, __args.concat(__inargs));
            };
        }
```

使用了rest参数:

```js
let currying = function(fn, ...tails) {
  return function(...args) {
    return fn(...tails, ...args);
  }
}
```

好处真的不用说了, 好写, 好看, 好理解, 无敌.

另外提一点, rest参数是可以取字符串的, 但是会把字符串取成数组, 如下:

```js
let fn = separateString(head, ...tails) {
  console.log(head, tails);
}
fn("1234");
// => 1 [2,3,4]
```

然后把他们join回去就可以了.

### stage-3的rest取值

我们取到一个对象以后可能要为他增加键值, 可能会这么写:

```js
let obj = {
  key: "value"
};
```

```js
obj.newKey = "newValue";
```

这样修改了元数据, 是函数式编程的大忌. 所以我们只能写一个数据副本:

```js
let newObj = _.clonedeep(obj);
newObj.newKey = "newValue";
```

看一下新语法:

```js
{
  ...obj,
  newKey: "newValue"
}
```

嘿嘿.