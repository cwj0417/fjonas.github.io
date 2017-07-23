---
title: 阅读vuex example
date: 2017-07-17 10:27:49
categories: 编码与分析
tags: [vue,vuex,应用]
---
阅读[vuex example](https://github.com/vuejs/vuex/tree/dev/examples)来感受与自己写法不同的细节.

<!--more-->

## state不绑定v-model

这个原则是显而易见的, 但是我们在实际操作中还是会因为遍历多层以后不注意, 或因为操作便利上的原因适用了`v-model`绑定state, 甚至做了一些多余的操作. 

再来重新分析一下为什么state不能绑定v-model:

+ state的改变必须通过mutation来进行, 而v-model会修改绑定属性的值, 并通过对象传地址的特性来改变了state的值.
+ state是一个computed属性. 而computed属性是不能绑定v-model的. example中有一个购物车的例子. 试想场景: computed属性是返回所有购物车中物品的价格总和, 改变了购物车的东西, computed总价自然会变, 而把总价绑定v-model去改变他在逻辑上就是错误的.

容易犯错的场景:

对于一个每个元素包含一些字段的列表, 每个元素的一些属性都可以修改并保存, 直觉上就会使用v-model去绑定这些元素.

解决方式:

不适用v-model绑定, 用v-bind:value来绑定, 并监听事件来使用mutation改变vuex的值.

### `v-model`有多甜?

[v-model](https://vuejs.org/v2/guide/components.html#Form-Input-Components-using-Custom-Events)为什么不可以被使用在computed属性呢, 因为v-model做了对computed属性赋值的操作.

vue组件交互是单向数据流的设计, 而v-model是一种双向绑定的语法糖. v-model做了两件事: 子接受父的`value`属性, 父接受子的`input`事件, 并把子组件的状态值赋给父组件的变量.

那么computed属性不能绑定v-model的情况问题出在接受了input时间并给变量赋值. 所以在computed属性我们需要分开做:

```html
<input v-model="description" /> // 错误
<input :value="description" @input="update($event.target.value)" /> // 正确
```



在update方法中调用mutation

```js
{
  methods: {
    update (description) {
      this.$store.commit(updateDescription, description)
    }
  }
}
```

而在自定义组件中, v-model的行为是:

```html
<custom-input
  :value="something"
  @input="value => { something = value }">
</custom-input>
```

只需要在自定义组件中的props接受value并在需要更新父组件值的时候`$emit`input事件就可以做到双向绑定, 而不需要在父组件中写方法.

**2.2+特性**

一些组件的`value`属性可能包含别的意义, 而更新父组件也不希望在`input`事件下进行, 所以v-model提供了配置语法糖属性/事件的功能.

```js
Vue.component('my-checkbox', {
  model: {
    prop: 'checked',
    event: 'change'
  },
  props: {
    checked: Boolean,
    // this allows using the `value` prop for a different purpose
    value: String
  },
  // ...
})
```

**2.3+特性**

在任何v-bind属性的时候加`.sync`修饰符, 只要在子组件种`.$emit`一个`update:binded`事件就可以双向绑定`binded`属性. 原理和v-model相同.

## 什么情况要拆分组件?

在todomvc的例子中学到了一种拆分组件可以解决的问题.

在todomvc种, 每个todo项都有一个`editing`状态, 作用是双击todo名字, 进入可编辑状态, 而这个`editing`状态又是一个组件的临时状态, 不需要存入vux中, 如果v-for中去添加这个`editing`属性, 会使vuex数据结构改变.

因为子组件的数据来源的`props`和`data`是分开的, `props`取得父组件的属性, `data`作为自己私有属性, 也就是组件的状态, 那么`editing`作为这个状态就再合适不过了.

## vuex插件

[vuex插件](https://vuex.vuejs.org/en/plugins.html)是vuex中的钩子, 在vuex**加载的时候**与**mutation发生的时候**分别调用.

加载方式为new Store时候的`plugin`属性, 语法是:

```js
const myPlugin = store => {
  // called when the store is initialized
  store.subscribe((mutation, state) => {
    // called after every mutation.
    // The mutation comes in the format of `{ type, payload }`.
  })
}
```

这个钩子可以在store合法变化的时候获取到store, 这样可以在一处对数据进行同步, 而不是在每个action/mutation中进行保存操作. 

在文档中还举了一些其他vuex插件的例子.

直接通过api而非界面操作来对vuex的state进行操作.

或是保存一些状态, 根据需要回滚状态来进行时间旅行. (实际操作时打开vuex的chrome调试插件一段时间会导致内存爆炸)