import {
  callPageHook
} from '../util'

function addKeepAliveInclude (componentName) {
  if (this.keepAliveInclude.indexOf(componentName) === -1) { // 目标页面,自动 include
    this.keepAliveInclude.push(componentName)
  }
}

function removeKeepAliveInclude (componentName) {
  const index = this.keepAliveInclude.indexOf(componentName)
  if (index !== -1) {
    this.keepAliveInclude.splice(index, 1)
  }
}

function switchTab (routes) {
  // 关闭非 tabBar 页面
  const pages = getCurrentPages()
  for (let i = pages.length - 1; i >= 0; i--) {
    const pageVm = pages[i]
    const meta = pageVm.$page.meta
    if (!meta.isTabBar) {
      removeKeepAliveInclude.call(this, meta.name + '-' + pageVm.$page.id)
      callPageHook(pageVm, 'onUnload')
    }
  }
}

function reLaunch (toName) {
  __uniConfig.reLaunch = (__uniConfig.reLaunch || 1) + 1
  // 关闭所有页面
  const pages = getCurrentPages()
  for (let i = pages.length - 1; i >= 0; i--) {
    callPageHook(pages[i], 'onUnload')
  }
  this.keepAliveInclude = []
}

function beforeEach (to, from, next, routes) {
  const fromId = from.params.__id__
  const toId = to.params.__id__
  if (toId === fromId) { // 相同页面阻止
    next(false)
  } else if (to.meta.id && to.meta.id !== toId) { // id 不妥，replace跳转
    next({
      path: to.path,
      replace: true
    })
  } else {
    const fromName = from.meta.name + '-' + fromId
    const toName = to.meta.name + '-' + toId

    switch (to.type) {
      case 'navigateTo':
        break
      case 'redirectTo':
        // 关闭前一个页面
        removeKeepAliveInclude.call(this, fromName)
        break
      case 'switchTab':
        switchTab.call(this, routes)
        break
      case 'reLaunch':
        reLaunch.call(this, toName)
        break
      default:
        // 后退或非 API 访问
        if (fromId && fromId > toId) { // back
          removeKeepAliveInclude.call(this, fromName)
        }
        break
    }

    if (to.type !== 'reLaunch' && from.meta.id) { // 如果不是 reLaunch，且 meta 指定了 id
      addKeepAliveInclude.call(this, fromName)
    }
    // if (to.type !== 'reLaunch') { // TODO 如果 reLaunch，1.keepAlive的话，无法触发页面生命周期，并刷新页面，2.不 keepAlive 的话，页面状态无法再次保留,且 routeView 的 cache 有问题
    addKeepAliveInclude.call(this, toName)
    // }
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`Core：keepAliveInclude=${JSON.stringify(this.keepAliveInclude)}`)
    }
    /* eslint-disable no-undef */
    if (__PLATFORM__ === 'h5') {
      if (to.meta && to.meta.name) {
        document.body.className = 'uni-body ' + to.meta.name
      }
    }

    next()
  }
}

function afterEach (to, from) {
  const fromId = from.params.__id__
  const toId = to.params.__id__

  const fromVm = getCurrentPages(true).find(pageVm => pageVm.$page.id === fromId)

  switch (to.type) {
    case 'navigateTo': // 前一个页面触发 onHide
      fromVm && callPageHook(fromVm, 'onHide')
      break
    case 'redirectTo': // 前一个页面触发 onUnload
      fromVm && callPageHook(fromVm, 'onUnload')
      break
    case 'switchTab':
      if (from.meta.isTabBar) { // 前一个页面是 tabBar 触发 onHide，非 tabBar 页面在 beforeEach 中已触发 onUnload
        fromVm && callPageHook(fromVm, 'onHide')
      }
      break
    case 'reLaunch':
      break
    default:
      if (fromId && fromId > toId) { // history back
        fromVm && callPageHook(fromVm, 'onUnload')
      }
      break
  }
  if (to.type !== 'reLaunch') { // 因为 reLaunch 会重置 id，故不触发 onShow,switchTab 在 beforeRouteEnter 中触发
    // 直接获取所有 pages,getCurrentPages 正常情况下仅返回页面栈内，传 true 则返回所有已存在（主要是 tabBar 页面）
    const toVm = getCurrentPages(true).find(pageVm => pageVm.$page.id === toId)
    if (toVm) { // 目标页面若已存在，则触发 onShow
      // 延迟执行 onShow，防止与 UniServiceJSBridge.emit('onHidePopup') 冲突。
      setTimeout(function () {
        callPageHook(toVm, 'onShow')
      }, 0)
    }
  }
}
export default function initRouterGuard (appVm, routes) {
  // 处理keepAliveInclude
  appVm.$router.beforeEach(function (to, from, next) {
    beforeEach.call(appVm, to, from, next, routes)
  })
  // 处理前进时的 onUnload,onHide 和后退时的 onShow
  appVm.$router.afterEach(function (to, from) {
    afterEach.call(appVm, to, from)
  })
}
