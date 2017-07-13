---
title: angular decorator
date: 2016-10-20 17:31:48
categories: 编码与分析
tags: [angular,代码组织,应用]
---
许多知识点只在脑内有印象而并没有实际应用, 比如我ng的decorator, 今终于有机会来一把体验.

<!--more-->

## 告老师, 这个lib写得不好

在某个项目中一直使用者[st-table](http://lorenzofox3.github.io/smart-table-website/)(这个得翻墙)然而某天出现了这样的需求: 后台定时刷新表格的数据.

问题出现了, 假若我正在查看一些第二页的数据, 后台数据一刷新, 也就是给`datas`赋了新值, st-table的分页插件给直接翻到了第一页呢. 看了文档以后觉得没有提供明显的接口, scope也是独立的, 这该如何是好.

### 先解决需求

脑子里第一个解决方案是最straight的: 刷新数据前保存当前页数, 刷新后手动翻页到指定页数, 也就是这样的:

```js
$scope.loadData = () => {
    let curPage = $scope.$$childHead ? $scope.$$childHead.currentPage : 1;
    loadService.load()
        .then(() => {
            $scope.treedata = treedata;
            $scope.topics = topics;
            $timeout(() => {
                $scope.$$childHead.selectPage(Math.min(curPage, $scope.$$childHead.pages.length));
            });
        })
};
```

运行一看, 还真对得起我这张脸, 可以正常运作, 强行深入敌后调用了分页scope的方法.

### 闪闪闪

上面的解决方案只要一刷新页面就会翻到第一页, 再翻回到之前的页面, 非常尴尬呢. 看了st-table的源码, 发现了一段逻辑如下:

```js
$scope.$watch(function () {
                return safeGetter($scope);
            }, function (newValue, oldValue) {
                if (newValue !== oldValue) {
                    tableState.pagination.start = 0;
                    updateSafeCopy();
                }
            });
```

我的天老爷, 数据一变化就给强行翻到第一页, 就是这么强势.

于是想了些方法, 比如刷新好检测是否与上次数据相同, 相同则不赋值, 这个想法非常简陋, 并没什么用(只能减少一部分闪的情景)

### 引言结束

终于引入了decorator, 之前一直有耳闻, 作用是改变已经加载的模块的行为, 也就是项目中暂时改写lib咯. 以上的例子只是一小点, 临时改变lib的行为的需求还是挺多的, 毕竟每个项目都可能有独特的奇怪的需求.

 下面来说一下decorator.

## decorator

何为decorator? 重写已经定义过的模块, 包括`service`,`directive`,`filter`. 如果对lib不满意, 或者是需要在某个项目特殊处理, decorator是您最好的选择.

[文档](https://code.angularjs.org/1.5.8/docs/guide/decorators)

### 怎么用

来段示例代码:

```js
angular.module('myApp', [])

.config([ '$provide', function($provide) {

  $provide.decorator('$log', [
    '$delegate',
    function $logDecorator($delegate) {

      var originalWarn = $delegate.warn;
      $delegate.warn = function decoratedWarn(msg) {
        msg = 'Decorated Warn: ' + msg;
        originalWarn.apply($delegate, arguments);
      };

      return $delegate;
    }
  ]);
}]);
```

在`.decorator()`中第一个参数就是被装潢的方法了, function中的`$delegate`可以看做被装换模块的复制, 可以对他做操作, 或者完全重写return回去.

### 被装潢名字的讲究

`$provide.decorator('$log', function(){})`中的`$log`就是被装潢的服务名字了, 然而`directive`和`filter`有些区别的.

+ `directive`装换需要加上`Directive`, 如`$provide.decorator('myDirectiveDirective', …)`
+ `filter`同样的需要加上`filter`

## 实际应用

好了, 文档看好了, 如何解决文章开头提到的问题呢, 也直接来代码吧.

```js
app
.config(($provide) => {
  let betterStTableCtrl = {
    //这里是修改的东西
  };
  $provide.decorator('stTableDirective', ($delegate) => {
        $delegate.controller = betterStTableCtrl;
        return $delegate;
    });
})
```

就是这么简单, 我需要修改的是`directive`, 名字是`stTable`, 那么注入名字就为`stTableDirective`, 然后对`$delegate`进行修改, 我这里需要修改的是他提供的api, 然后把修改后的return回去, 搞定了. 别的需要修改的也可以继续改咯.