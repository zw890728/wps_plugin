//在后续的wps版本中，wps的所有枚举值都会通过wps.Enum对象来自动支持，现阶段先人工定义
var WPS_Enum = {
    msoCTPDockPositionLeft:0,
    msoCTPDockPositionRight:2,
    msoCTPDockPositionTop:1,
    msoCTPDockPositionBottom:3,
    msoCTPDockPositionFloating:4,
    msoCTPDockPositionBefore:0,
    msoCTPDockPositionAfter:2
}

function GetUrlPath() {
    let e = document.location.toString()
    return -1!=(e=decodeURI(e)).indexOf("/")&&(e=e.substring(0,e.lastIndexOf("/"))),e
}

// 获取加载项根 URL（不依赖当前页面所在目录，正确处理 ui/ 子目录下的页面）
// 例如 TaskPane 页面 URL = http://x/ui/EChartsTaskPane.html
// 本函数返回 http://x（去掉 /ui/EChartsTaskPane.html）
function GetRootPath() {
    let e = decodeURI(document.location.toString())
    // 去掉最后一段（页面文件名）
    let idx = e.lastIndexOf("/")
    if (idx > -1) e = e.substring(0, idx)
    // 如果当前目录是 ui，再退一层
    if (/\/ui$/.test(e)) e = e.replace(/\/ui$/, "")
    return e
}
/**
 * 通过wps提供的接口执行一段脚本
 * @param {*} param 需要执行的脚本
 */
function shellExecuteByOAAssist(param) {
    if (wps != null) {
        wps.OAAssist.ShellExecute(param)
    }
}