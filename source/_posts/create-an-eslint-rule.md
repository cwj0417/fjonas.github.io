---
title: 编写一个eslint rule
categories: 工作笔记
date: 2022-08-29 23:42:27
tags: [eslint]
---
上周参加了职业生涯来第一次code review, 我的老板收集了好几个问题. review结束后我产生个想法, 是不是可以把这些rule写到公司的eslint里. 

于是看了下文档, 总结是: 流程非常简单.

<!--more-->

流程简单, 但rule的难度上限不低. 比如`useEffect`的依赖. 但大多数我认为还是挺简单的.

## rule构成

一个eslint rule的形式是一个对象. 类型是`import('eslint').Rule.RuleModule`.

很简单2个key: 

+ meta: 描述这个rule的名字, 文档地址, 描述等基本信息.
+ create: rule的具体内容.

## runtime开发流程

文档里对runtime的开发流程说得不太清爽, 所以这里说明一下.

首先: runtime开发指什么? 答: 直接在项目里编写规则, 而不是发到npm.

优点: 开发的时候可以直接使用项目代码作为开发资源, 不需要使用npm link.

缺点: 不能在ide上看到自己文件的划线. 因为eslint resolve plugin的方式不支持本地. (不确定, 只是经验性的)

解释优缺点, 说一下开发流程:

+ 创建一个文件夹.
+ 在运行eslint的时候加上配置: `--rulesdir [dir]`. (推荐写到npm script里)
+ 在这个文件夹下创建js文件. 每个js文件都会被读取.
+ js文件只要`module.exports = { meta: { type: 'name' }, create: function () {} }`就可以了.
+ 在eslintrc的`rules`字段配置自己写的rule.

然后一遍编写rule, 一边运行npx eslint就可以开发调试了.

##npm包开发流程

正儿八经的开发, 直接看文档就行了. 总结下:

+ 直接用yoeman生成模板, 文件结构都弄好了.
+ 开发的时候只能tdd开发, 可以把项目里真实的例子拷过来, 但不如直接写完在项目里跑爽, runtime开发等于直接加载了很多case.
+ 开发完按照一定命名规范发到npm上, ide里就可以看到划线了. (巨大优点, 真帅)

## 如何编写rule

终于到了正题, 如何编写rule. 

首先明确, rule的内容都在`create`方法里. 于是我们看一下`create`方法:

```js
create: function(context) {
  // declare the state of the rule
  return {
    ReturnStatement: function(node) {
      // at a ReturnStatement node while going down
    },
    // at a function expression node while going up:
    "FunctionExpression:exit": checkLastSegment,
    "ArrowFunctionExpression:exit": checkLastSegment,
    onCodePathStart: function (codePath, node) {
      // at the start of analyzing a code path
    },
    onCodePathEnd: function(codePath, node) {
      // at the end of analyzing a code path
    }
  };
}
```

文档里粘来的例子, 我们来看看结构:

1. 接受一个参数`context`, 提供了一系列方法.
2. 返回一个对象, 键是ast的节点名字, 会在遍历ast的时候调用.

(题外话: 之前看vuejs设计与实现编译部分还写了[一篇总结](/2022/05/04/compile-html-piece-to-sass-structure/), 但提到如何组织traverse函数, 如何组织context一笔略过了, 之后可能再补补详细内容)

`create`方法结构很简单, **我们要做的事也很简单**:

1. 在需要查找的ast节点中判断代码是否符合rule.
2. 使用`context.report`方法来报错. (如果判断到代码不符合rule的话)
3. 使用`fix`方法提供的`fixer`对象来进行修复. `fixer`的方法很少, 就简单的新增/替换/移除操作.

我猜想的执行方式是: 每个文件会新建一个context对象和一个新闭包, 遍历ast, 执行对应的create里的方法.

由此得出结论: 

1. 在`create`方法里可以保存变量来辅助我们判断和修复.
2. `create`方法返回的不同方法执行的顺序是遍历ast的顺序.

## 一个简单的例子

最后贴一下我假想的例子: 提示并修复魔法数字.

这是个简单的demo, 只处理了`res === 1`类似的情况, 甚至还没能处理`res.code === 1`(因为修复的时候比较麻烦). 所以只是个demo并不能使用. 

```js
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: "no-magic-string",
        fixable: "code",
    },
    create: function (context) {
        const enums = {}
        return {
            BinaryExpression(node) {
                if (node.operator === '===') {
                    if (node.left.type === 'Identifier' && node.right.type === 'Literal') {
                        context.report({
                            node,
                            message: 'magic string was not desirable',
                            fix(fixer) {
                                if (!enums[node.left.name]) enums[node.left.name] = new Set([])
                                enums[node.left.name].add(node.right.value)
                                return fixer.replaceText(node.right, `enum_${node.left.name}.type_${node.right.value}`)
                            }
                        })
                    }
                }
            },
            'Program:exit'(node) {
                if (Object.keys(enums).length) {
                    context.report({
                        node,
                        message: 'magic string was not desirable',
                        fix(fixer) {
                            return fixer.insertTextBefore(node.body[0],
                                Object.entries(enums)
                                    .map(([k, v]) => `const enum_${k} = { ${[...v].map(type => `type_${type}: 'type_${type}'`).join(',')} }
                                    `)
                                    .join('')
                            )
                        }
                    })
                }
            }
        };
    }
};
```

简单解释:

+ 寻找"变量 === 字面量"的情况, 并报错.
+ 建立一个上下文变量, 保存各个不符合rule的"变量"的名字, 并尝试把"字面量"的值直接改成设定的值.
+ 在遍历完整个ast后, 如果上下文变量有内容, 就在程序头部插入刚才替换掉"字面量"的设定的值的定义.

