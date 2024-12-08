---
title: vue客户端路由学习
categories: 工作笔记
date: 2024-11-29 15:18:29
tags: [vue]
---
学习vue-router, 完成了第一个阶段, 总结一下vue-router客户端部分的总体流程.

<!--more-->

这次先总结客户端路由, 下次再看服务端的.

## 路由行为总结

路由的行为分为2个大类, 初始化与跳转.

### 页面初始化

打开一个新窗口, 或者刷新页面, `router-view`会根据路由配置展示对应的组件.

另一个场景是`a`标签的跳转, 页面也会重新加载页面, 但历史会记录在`history`api里.

### 程序控制路由

通过`router-link`跳转或者router的api跳转.

虽然`router-link`产生的是一个`a`标签, 但`click`事件绑定的其实是router的api.

另外初始化路由库的时候会监听`popstate`事件, 如果是由程序控制的跳转, 也会通过程序跳转回去. 这个需要在后面部分展开.

## 路由行为分析

分析具体行为前, 先要知道路由库加载到主程序是通过`vue.use()`的, 所以除了2个component外, 再观察`install()`方法就可以了.

`router-view`和`router-link`这2个componnet也是在`install()`方法里被加载的, 下面我们开始具体进入上面2个行为的具体流程.

### router-link

router-link就是一个`a`标签, 根据路由匹配给标签active的类, 并且点击标签后会调用`router.push()`来变更路由.

从代码来看也非常简单, 也可以不看代码跳到下一节.

```js
{
  setup(props, { slots }) {
        const link = reactive(useLink(props));
        const { options } = inject(routerKey);
        const elClass = computed(() => ({...}));
        return () => {
            const children = slots.default && slots.default(link);
            return props.custom
                ? children
                : h('a', {
                    'aria-current': link.isExactActive
                        ? props.ariaCurrentValue
                        : null,
                    href: link.href,
                    // this would override user added attrs but Vue will still add
                    // the listener, so we end up triggering both
                    onClick: link.navigate,
                    class: elClass.value,
                }, children);
        };
    }
}
```

代码很少, 而且很多代码是兼容了些特殊用法, 不是主要功能.

`onClick`绑定的`link.navigate()`中的`link`是调用`useLink()`得到的, 最后也是调用`router.push()`或`router.replace()`, 其实是同一个东西, 后面再展开.

### router-view

router-view做的是判断需要加载的组件, 然后返回对应的vdom.

下面看一下代码, 再来分析下是根据什么判断需要加载什么组件的. (这里先不看嵌套路由相关的)

```typescript
{
  setup(props, { attrs, slots }) {
    
      const injectedRoute = inject(routerViewLocationKey)!
      const routeToDisplay = computed<RouteLocationNormalizedLoaded>(
        () => props.route || injectedRoute.value
      )
      const injectedDepth = inject(viewDepthKey, 0)
      // The depth changes based on empty components option, which allows passthrough routes e.g. routes with children
      // that are used to reuse the `path` property
      const depth = computed<number>(() => {
        let initialDepth = unref(injectedDepth)
        const { matched } = routeToDisplay.value
        let matchedRoute: RouteLocationMatched | undefined
        while (
          (matchedRoute = matched[initialDepth]) &&
          !matchedRoute.components
        ) {
          initialDepth++
        }
        return initialDepth
      })
      const matchedRouteRef = computed<RouteLocationMatched | undefined>(
        () => routeToDisplay.value.matched[depth.value]
      )

      provide(
        viewDepthKey,
        computed(() => depth.value + 1)
      )
      provide(matchedRouteKey, matchedRouteRef)
      provide(routerViewLocationKey, routeToDisplay)
      // ...
      return () => {
        const route = routeToDisplay.value
        // we need the value at the time we render because when we unmount, we
        // navigated to a different location so the value is different
        const currentName = props.name
        const matchedRoute = matchedRouteRef.value
        const ViewComponent =
          matchedRoute && matchedRoute.components![currentName]

        if (!ViewComponent) {
          return normalizeSlot(slots.default, { Component: ViewComponent, route })
        }

        // props from route configuration
        const routePropsOption = matchedRoute.props[currentName]
        const routeProps = routePropsOption
          ? routePropsOption === true
            ? route.params
            : typeof routePropsOption === 'function'
            ? routePropsOption(route)
            : routePropsOption
          : null

        const onVnodeUnmounted: VNodeProps['onVnodeUnmounted'] = vnode => {
          // remove the instance reference to prevent leak
          if (vnode.component!.isUnmounted) {
            matchedRoute.instances[currentName] = null
          }
        }

        const component = h(
          ViewComponent,
          assign({}, routeProps, attrs, {
            onVnodeUnmounted,
            ref: viewRef,
          })
        )
        // ...
        return (
          // pass the vnode to the slot as a prop.
          // h and <component :is="..."> both accept vnodes
          normalizeSlot(slots.default, { Component: component, route }) ||
          component
        )
      }
    }
  }
}
```

我们可以从`ViewComponent`顺着往上找到是从`inject(routerViewLocationKey)`取值的.

然后发现这个值是在`install()`里提供的`app.provide(routerViewLocationKey, currentRoute)`.

并且在`finalizeNavigation()`中mutate了值`currentRoute.value = toLocation`. (会在下面`router.push`章节展开)

### install

插件安装就做了一些初始化, 比较简单, 这里先贴出代码, 再一起看看做了哪些事.

```typescript
{
  	install(app: App) {
      const router = this
      app.component('RouterLink', RouterLink)
      app.component('RouterView', RouterView)

      app.config.globalProperties.$router = router
      Object.defineProperty(app.config.globalProperties, '$route', {
        enumerable: true,
        get: () => unref(currentRoute),
      })

      // this initial navigation is only necessary on client, on server it doesn't
      // make sense because it will create an extra unnecessary navigation and could
      // lead to problems
      if (
        isBrowser &&
        // used for the initial navigation client side to avoid pushing
        // multiple times when the router is used in multiple apps
        !started &&
        currentRoute.value === START_LOCATION_NORMALIZED
      ) {
        // see above
        started = true
        push(routerHistory.location).catch(err => {
          if (__DEV__) warn('Unexpected error when starting the router:', err)
        })
      }

      const reactiveRoute = {} as RouteLocationNormalizedLoaded
      for (const key in START_LOCATION_NORMALIZED) {
        Object.defineProperty(reactiveRoute, key, {
          get: () => currentRoute.value[key as keyof RouteLocationNormalized],
          enumerable: true,
        })
      }

      app.provide(routerKey, router)
      app.provide(routeLocationKey, shallowReactive(reactiveRoute))
      app.provide(routerViewLocationKey, currentRoute)
      // ...
    }
}
```

1. 注册了`router-link`和`router-view`组件.
2. 注册了变量让其他地方获取, 其中`$`开头的是兼容给option api用的, `provide()`是内部用, 以及通过`use`系列api暴露给用户的. (`use`系列api做的就是`return inject()`)
3. 如果是客户端的初次渲染, 则调用`router.push()`.

### 页面初始化

1. `install()`注册组件, 并调用`router.push()`.

2. 把`push()`通过`then()`放入微任务等待执行.

3. 渲染页面, 包括执行所有组件的`setup()`和他返回的函数, 完成第一次页面渲染.

   第一次渲染完成的时候`router-view`没有获得`ViewComponent`, 所以渲染的是空页面. (`router-view`的部分是空页面)

4. 开始执行第二步`push()`的微任务, 最终执行`finalizeNavigation()`.

5. 通过调用`routerHistory.replace()`改变url.

6. 通过mutate`currentRoute.value`触发`effect`更新组件, 这次`ViewComponent`获取到了预期的组件, `router-link`也给链接赋上了`active`类了.

### router.push

页面初始化, `router-link`, 浏览器回退监听简单过滤后, 都会最终调用`router.push()`, 或者是`replace()`, 这2个是通过不同参数调用了`pushWithRedirect()`.

```js
    function pushWithRedirect(to, redirectedFrom) {
        const targetLocation = (pendingLocation = resolve(to));
        const from = currentRoute.value;
        const data = to.state;
        const force = to.force;
				// ...
        const toLocation = targetLocation;
        toLocation.redirectedFrom = redirectedFrom;
        let failure;
        if (!force && isSameRouteLocation(stringifyQuery$1, from, targetLocation)) {
            // failure = ...
        }
        return (failure ? Promise.resolve(failure) : navigate(toLocation, from))
            .catch(
        		// ...
        		)
            .then((failure) => {
            if (failure) {
                // ...
            }
            else {
                // if we fail we don't finalize the navigation
                failure = finalizeNavigation(toLocation, from, true, replace, data);
            }
            triggerAfterEach(toLocation, from, failure);
            return failure;
        });
    }
```

可以看到在整理了参数后, 调用了`navigate(toLocation, from)`.

这个函数是用来跑路由钩子的, 在"页面初始化"的时候提到过.

分别顺序运行的钩子是: `leavingRecords`, `beforeGuards`, `updateGuards`, `beforeEnter`, `beforeResolveGuards`.

在跑完每个钩子后, 都会用`then()`来排队后续操作. (可能是处理同时多次调用产生的渲染顺序问题)

在跑完所有钩子没出现问题后, 会调用`finalizeNavigation()`来进行真正的跳转动作.

```js
    function finalizeNavigation(toLocation, from, isPush, replace, data) {
        // ...
        const isFirstNavigation = from === START_LOCATION_NORMALIZED;
        const state = !isBrowser ? {} : history.state;
        // change URL only if the user did a push/replace and if it's not the initial navigation because
        // it's just reflecting the url
        if (isPush) {
            // on the initial navigation, we want to reuse the scroll position from
            // history state if it exists
            if (replace || isFirstNavigation)
                routerHistory.replace(toLocation.fullPath, assign({
                    scroll: isFirstNavigation && state && state.scroll,
                }, data));
            else
                routerHistory.push(toLocation.fullPath, data);
        }
        // accept current navigation
        currentRoute.value = toLocation;
        handleScroll(toLocation, from, isPush, isFirstNavigation);
        markAsReady();
    }
```

这里有几个关键点:

1. `routerHistory.push()`: `routerHistory` 是工厂提供的实现, 以常用的`h5`为例, 就**调用`history` api来改变url和记录历史**.

2. mutate`currentRoute.value`来触发视图响应式, 重新渲染页面. 此时`router-link`和`router-view`都获取到了最新值, 就能达到预期的渲染效果了. (在此之前页面会进行一次关于路由的白屏渲染)

3. `markAsReady()`: 如果第一次执行这个函数, 会添加浏览器`popState`监听事件, 内容就是调用和`router.push()`一样的`navigate()`与`finalizeNavigation()`.

   (监听是在创建`routerHistory`时做的, `routerHistory`提供了`listen()`方法来添加回调事件.)

### a标签与浏览器退回

正常流程已经讲完了.

通过目前对`router`的理解, 我们聊一下通过`a`标签跳转的路由, 与浏览器退回与正常操作有什么区别.

1. js执行流程: `a`标签的跳转与退回, 都会与"初始化"执行的顺序一样: 先`install()`, 再白屏渲染, 再通过`install()`的`push()`最终渲染.

2. 浏览器地址栏: 通过`a`标签跳转与退回, 浏览器地址栏都在最初状态就是目标地址.

   通过程序正常跳转的, 会在执行`routerHistory.push()`的时候才改变浏览器地址栏. (退回也是先改变地址栏.)

3. 另外有个显而易见的, `a`标签不会像`router-link`一样给元素`active`类.

最后总结下浏览器退回的行为.

浏览器通过`history` api 跳转的退回, 也会由`histroy`退回. 由`a`标签跳转的, 退回也会刷新页面.

客户端的学习暂停一下, 下次看一下服务端是怎么做的. (和`vue`的`provide`与`inject`, 应该比较简单, 之前没看)
