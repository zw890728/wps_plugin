
//这个函数在整个wps加载项中是第一个执行的
function OnAddinLoad(ribbonUI) {
    if (typeof (window.Application.ribbonUI) != "object") {
        window.Application.ribbonUI = ribbonUI
    }

    if (typeof (window.Application.Enum) != "object") { // 如果没有内置枚举值
        window.Application.Enum = WPS_Enum
    }

    window.Application.PluginStorage.setItem("EnableFlag", false) //往PluginStorage中设置一个标记，用于控制两个按钮的置灰
    window.Application.PluginStorage.setItem("ApiEventFlag", false) //往PluginStorage中设置一个标记，用于控制ApiEvent的按钮label
    return true
}

var WebNotifycount = 0;
function OnAction(control) {
    const eleId = control.Id
    switch (eleId) {
        case "btnShowMsg":
            {
                const doc = window.wps.ActiveWorkbook
                if (!doc) {
                    alert("当前没有打开任何文档")
                    return
                }
                alert(doc.Name)
            }
            break;
        case "btnIsEnbable":
            {
                let bFlag = window.Application.PluginStorage.getItem("EnableFlag")
                window.Application.PluginStorage.setItem("EnableFlag", !bFlag)

                //通知wps刷新以下几个按饰的状态
                window.Application.ribbonUI.InvalidateControl("btnIsEnbable")
                window.Application.ribbonUI.InvalidateControl("btnShowDialog")
                window.Application.ribbonUI.InvalidateControl("btnShowTaskPane")
                //window.Application.ribbonUI.Invalidate(); 这行代码打开则是刷新所有的按钮状态
                break
            }
        case "btnShowDialog":
            window.Application.ShowDialog(GetUrlPath() + "/ui/dialog.html", "这是一个对话框网页", 400 * window.devicePixelRatio, 400 * window.devicePixelRatio, false)
            break
        case "btnShowTaskPane":
            {
                let tsId = window.Application.PluginStorage.getItem("taskpane_id")
                if (!tsId) {
                    let tskpane = window.Application.CreateTaskPane(GetUrlPath() + "/ui/taskpane.html")
                    let id = tskpane.ID
                    window.Application.PluginStorage.setItem("taskpane_id", id)
                    tskpane.Visible = true
                } else {
                    let tskpane = window.Application.GetTaskPane(tsId)
                    tskpane.Visible = !tskpane.Visible
                }
            }
            break
        case "btnApiEvent":
            {
                let bFlag = window.Application.PluginStorage.getItem("ApiEventFlag")
                let bRegister = bFlag ? false : true
                window.Application.PluginStorage.setItem("ApiEventFlag", bRegister)
                if (bRegister) {
                    window.Application.ApiEvent.AddApiEventListener('NewWorkbook', OnNewDocumentApiEvent)
                }
                else {
                    window.Application.ApiEvent.RemoveApiEventListener('NewWorkbook', OnNewDocumentApiEvent)
                }

                window.Application.ribbonUI.InvalidateControl("btnApiEvent")
            }
            break
        case "btnWebNotify":
            {
                let currentTime = new Date()
                let timeStr = currentTime.getHours() + ':' + currentTime.getMinutes() + ":" + currentTime.getSeconds()
                window.Application.OAAssist.WebNotify("这行内容由wps加载项主动送达给业务系统，可以任意自定义, 比如时间值:" + timeStr + "，次数：" + (++WebNotifycount), true)
            }
            break
        // ====== G1-G6 按钮：调用对应中文函数 ======
        case "btn区域复制到所有表":
            区域复制到所有表()
            break
        case "btn人民币大写金额":
            人民币大写金额()
            break
        case "btn乘以1万":
            乘以1万()
            break
        case "btn除以1万":
            除以1万()
            break
        case "btn按选定列去重":
            按选定列去重()
            break
        case "btn删除空格":
            删除空格()
            break
        case "btn数据合并":
            数据合并()
            break
        case "btn仅保留可见":
            仅保留可见()
            break
        case "btn拆分为工作表":
            拆分为工作表()
            break
        case "btn拆分为工作簿":
            拆分为工作簿()
            break
        case "btn每表一簿":
            每表一簿()
            break
        case "btn查询LPR":
            查询LPR()
            break
        case "btn发票识别":
            {
                var pendingRaw = Application.PluginStorage.getItem("invoice_ocr_pending");
                if (pendingRaw) {
                    // 有待识别数据，直接执行识别
                    发票识别()
                } else {
                    // 无配置，直接打开对话框
                    var cfgRaw = Application.PluginStorage.getItem("invoice_ocr_config");
                    if (!cfgRaw) {
                        Application.ShowDialog(GetUrlPath() + "/ui/InvoiceOCR.html", "发票识别", 780 * window.devicePixelRatio, 720 * window.devicePixelRatio, false)
                    } else {
                        // 有配置，先在主上下文中测试连通性，成功后打开对话框
                        发票识别_测试AndOpen()
                    }
                }
            }
            break
        case "btn规划求解":
            规划求解()
            break
        case "btn万能计算":
            Application.ShowDialog(GetUrlPath() + "/ui/calc.html", "万能计算", 620 * window.devicePixelRatio, 680 * window.devicePixelRatio, false)
            break
        case "btn随机填充":
            Application.ShowDialog(GetUrlPath() + "/ui/ChanceFill.html", "Chance 随机填充", 760 * window.devicePixelRatio, 720 * window.devicePixelRatio, false)
            break
        case "btnECharts绘图":
            // 创建/显示 TaskPane（多 Tab 配置），图表预览由 TaskPane 内按钮触发 ShowDialog 弹出
            {
                let storedId = Application.PluginStorage.getItem("echarts_taskpane_id")
                if (storedId) {
                    let tp = Application.GetTaskPane(storedId)
                    if (tp) {
                        // 复用时也强制设固定宽度，避免用户上次拖窄后显示不全
                        try { tp.Width = 800; } catch (e) {}
                        tp.Visible = true
                        break
                    }
                }
                let tp = Application.CreateTaskPane(GetUrlPath() + "/ui/EChartsTaskPane.html")
                if (tp) {
                    Application.PluginStorage.setItem("echarts_taskpane_id", tp.ID)
                    // 固定宽度 400px，避免 WPS 默认宽度根据上次使用情况导致显示不全
                    try { tp.Width = 800; } catch (e) {}
                    tp.Visible = true
                    // 兜底：100ms 后再设一次（部分 WPS 需窗口可见后才能改宽度）
                    setTimeout(function() {
                        try {
                            let tp2 = Application.GetTaskPane(tp.ID)
                            if (tp2) tp2.Width = 800
                        } catch (e) {}
                    }, 100)
                }
            }
            break
        default:
            break
    }
    return true
}

function GetImage(control) {
    const eleId = control.Id
    switch (eleId) {
        case "btnShowMsg":
            return "images/1.svg"
        case "btnShowDialog":
            return "images/2.svg"
        case "btnShowTaskPane":
            return "images/3.svg"
        case "btnWebNotify":
            return "images/sound.svg"
        // ====== G1-G6 按钮图标（暂用占位图，待替换为正式 SVG）======
        case "btn区域复制到所有表": // imageMso="Paste"
            return "images/newFromTemp.svg"
        case "btn人民币大写金额": // imageMso="TranslateToSimplifiedChinese"
            return "images/newFromTemp.svg"
        case "btn乘以1万": // imageMso="CommaStyle"
            return "images/newFromTemp.svg"
        case "btn除以1万": // imageMso="CommaStyle"
            return "images/newFromTemp.svg"
        case "btn按选定列去重": // imageMso="Clear"
            return "images/newFromTemp.svg"
        case "btn删除空格": // imageMso="Clear"
            return "images/newFromTemp.svg"
        case "btn数据合并": // imageMso="FillUp"
            return "images/newFromTemp.svg"
        case "btn仅保留可见": // imageMso="Filter"
            return "images/newFromTemp.svg"
        case "btn拆分为工作表": // imageMso="SplitCells"
            return "images/newFromTemp.svg"
        case "btn拆分为工作簿": // imageMso="SplitCells"
            return "images/newFromTemp.svg"
        case "btn每表一簿": // imageMso="SplitCells"
            return "images/newFromTemp.svg"
        case "btn查询LPR": // imageMso="Chart3DColumnChart"
            return "images/newFromTemp.svg"
        case "btn发票识别": // imageMso="FileInspect"
            return "images/newFromTemp.svg"
        case "btn规划求解": // imageMso="GoTo"
            return "images/newFromTemp.svg"
        case "btn万能计算": // imageMso="Calculator"
            return "images/newFromTemp.svg"
        case "btn随机填充": // imageMso="Randomize"
            return "images/newFromTemp.svg"
        case "btnECharts绘图": // imageMso="ChartInsert"
            return "images/newFromTemp.svg"
        default:
            ;
    }
    return "images/newFromTemp.svg"
}

function OnGetEnabled(control) {
    const eleId = control.Id
    switch (eleId) {
        case "btnShowMsg":
            return true
            break
        case "btnShowDialog":
            {
                let bFlag = window.Application.PluginStorage.getItem("EnableFlag")
                return bFlag
                break
            }
        case "btnShowTaskPane":
            {
                let bFlag = window.Application.PluginStorage.getItem("EnableFlag")
                return bFlag
                break
            }
        default:
            break
    }
    return true
}

function OnGetVisible(control) {
    return true
}

function OnGetLabel(control) {
    const eleId = control.Id
    switch (eleId) {
        case "btnIsEnbable":
            {
                let bFlag = window.Application.PluginStorage.getItem("EnableFlag")
                return bFlag ? "按钮Disable" : "按钮Enable"
                break
            }
        case "btnApiEvent":
            {
                let bFlag = window.Application.PluginStorage.getItem("ApiEventFlag")
                return bFlag ? "清除新建文件事件" : "注册新建文件事件"
                break
            }
        // ====== G1-G6 按钮返回对应 label ======
        case "btn区域复制到所有表":
            return "区域复制到所有表"
        case "btn人民币大写金额":
            return "人民币大写金额"
        case "btn乘以1万":
            return "乘以1万"
        case "btn除以1万":
            return "除以1万"
        case "btn按选定列去重":
            return "按选定列去重"
        case "btn删除空格":
            return "删除空格"
        case "btn数据合并":
            return "数据合并"
        case "btn仅保留可见":
            return "仅保留可见"
        case "btn拆分为工作表":
            return "拆分为工作表"
        case "btn拆分为工作簿":
            return "拆分为工作簿"
        case "btn每表一簿":
            return "每表一簿"
        case "btn查询LPR":
            return "查询LPR"
        case "btn发票识别":
            return "发票识别"
        case "btn规划求解":
            return "规划求解"
        case "btn万能计算":
            return "万能计算"
        case "btn随机填充":
            return "随机填充"
        case "btnECharts绘图":
            return "ECharts绘图"
    }
    return ""
}

function OnGetSupertip(control) {
    const eleId = control.Id
    switch (eleId) {
        case "btn区域复制到所有表":
            return "将选定区域的数据，复制到所有表的相同位置。"
        case "btn数据合并":
            return "类似数据透视表的功能，先选定目标数据，再选定若干列作为合并标准。"
        case "btn仅保留可见":
            return "删除隐藏内容，选择整行或整列"
        case "btn拆分为工作表":
            return "选定一列，按其内容拆分当前表格为多个工作表。"
        case "btn拆分为工作簿":
            return "选定一列，按其内容拆分当前表格为多个工作簿。"
        case "btn每表一簿":
            return "将每个工作表保存为一个工作簿。"
        case "btn查询LPR":
            return "查询 LPR（贷款市场报价利率）历史数据，自动写入工作表。"
        case "btn发票识别":
            return "使用百度 OCR API 识别增值税发票，支持 PDF（多页）和图片，结果写入工作表。"
        case "btn规划求解":
            return "X，Y，Y目标，可接受误差，迭代上限"
        case "btn万能计算":
            return "对选定区域按 if / then / else 批量改写单元格，x 代表当前格值。支持自动识别赋值语句或纯表达式。"
        case "btn随机填充":
            return "用 Chance.js 在选定区域批量生成随机值：人名、地址、邮箱、ID、骰子等 100+ 类函数，参数可配。"
        case "btnECharts绘图":
            return "从表格数据生成 ECharts 动态图表：19 种类型（柱/折/饼/散/箱/K线/雷达/地图/桑基/树图等），多 Tab 配置，预览独立弹窗，配置可存单元格重绘，图片可导出本地或插入表格。完全离线。"
        default:
            return ""
    }
}

function OnNewDocumentApiEvent(doc) {
    alert("新建文件事件响应，取文件名: " + doc.Name)
}

// ====== G1-G6 按钮函数实现（来自 func.js）======

function 区域复制到所有表() {
    let add = wps.Selection.Address();
    let val = wps.Selection.Value2;
    for (let k = 1; k <= wps.Sheets.Count; k++) { wps.Sheets.Item(k).Range(add).Value2 = val; }
}

function 人民币大写金额() {
    let rng = wps.Intersect(wps.Selection, wps.ActiveSheet.UsedRange);
    if (rng) {
        let cells = rng.Cells;
        for (let k = 1; k <= cells.Count; k++) {
            let c = cells.Item(k);
            if (typeof (c.Value2) === "number") {
                let M = c.Value2;
                let a1 = Math.floor(Math.round(100 * Math.abs(M)) / 100);
                let a2 = Math.round(100 * Math.abs(M) + 0.00001) - a1 * 100;
                let a3 = (a2 / 10 - Math.floor(a2 / 10)) * 10;
                let a4 = (a1 < 1 ? "" : wps.WorksheetFunction.Text(a1, "[DBNum2]") + "元");
                let a5 = (a2 > 9.5 ? wps.WorksheetFunction.Text(Math.floor(a2 / 10), "[DBNum2]") + "角" : (a1 < 1 ? "" : (a3 > 1 ? "零" : "")));
                let a6 = (a3 < 1 ? "整" : wps.WorksheetFunction.Text(Math.round(a3, 0), "[DBNum2]") + "分");
                c.Value2 = (Math.abs(M) < 0.005 ? "" : (M < 0 ? "负" + a4 + a5 + a6 : a4 + a5 + a6));
            }
        }
    }
}

function 乘以1万() {
    let rng = wps.Intersect(wps.Selection, wps.ActiveSheet.UsedRange);
    if (rng) {
        let cells = rng.Cells;
        for (let k = 1; k <= cells.Count; k++) {
            let c = cells.Item(k);
            if (typeof (c.Value2) === "number") c.Value2 = c.Value2 * 10000;
        }
    }
}

function 除以1万() {
    let rng = wps.Intersect(wps.Selection, wps.ActiveSheet.UsedRange);
    if (rng) {
        let cells = rng.Cells;
        for (let k = 1; k <= cells.Count; k++) {
            let c = cells.Item(k);
            if (typeof (c.Value2) === "number") c.Value2 = c.Value2 / 10000;
        }
    }
}

function 按选定列去重() {
    let rng = wps.ActiveSheet.UsedRange;
    rng.RemoveDuplicates([wps.Selection.Column - rng.Column + 1])
}

function 删除空格() {
    let rng = wps.Intersect(wps.Selection, wps.ActiveSheet.UsedRange);
    let rngToDelete = undefined;
    if (rng) {
        let cells = rng.Cells;
        for (let k = 0; k <= cells.Count; k++) {
            let cell = cells.Item(k);
            let v = cell.Value2;
            if (v === undefined || v === null || v === "" || !/\S/.exec(String(v))) {
                if (!rngToDelete) {
                    rngToDelete = cell;
                } else {
                    rngToDelete = wps.Union(rngToDelete, cell);
                }
            }
        }
    }
    if (rngToDelete) rngToDelete.Delete(2);
}

function 数据合并() {
    if (wps.Selection.Areas.Count < 2) {
        alert("实现类似数据透视表的功能，对数据进行加总合并或计数合并。\n\n例子：\n①选择A1:C100；②再选择A列；③再选择B列；④点击按钮。\n\n效果：对A1:C100列进行数据合并，先按A列统计，再按B列细分。\n\n统计标准：数字求和，其他计数。")
    } else {
        let rng = wps.Intersect(wps.Selection.Areas.Item(1), wps.ActiveSheet.UsedRange);
        let cols = [];
        for (let i = 2; i <= wps.Selection.Areas.Count; i++) {
            let rng2 = wps.Intersect(wps.Selection.Areas.Item(i), rng);
            cols.push(rng2.Item(1, 1).Value2);
        }
        let tb = new Table(rng.Value2, true);
        rng.ClearContents();
        tb.groupBy(...cols).aggregate().print(rng.Item(1, 1));
    }
}

function 仅保留可见() {
    function fill(arr, data) { //填充二维数组
        return arr.map(x => x.map(() => data))
    }
    let sel = wps.Selection;
    let rng = wps.Intersect(sel, wps.ActiveSheet.UsedRange); // 选中的区域
    if (wps.Columns.Count === wps.Selection.Columns.Count) { // 选择整行情况
        if (rng) { // 先删除隐藏列的选中部分
            let invisibleColumnNum = [];
            let row1Cells = wps.Range(rng.Rows.Item(1).Address()).Cells;
            for (let k = 1; k <= row1Cells.Count; k++) {
                let cell = row1Cells.Item(k);
                if (cell.EntireColumn.Hidden) {
                    invisibleColumnNum.push(cell.Column); // 隐藏列的列号
                }
            }
            if (invisibleColumnNum[0]) {
                let invisibleColumns = wps.Intersect(rng, wps.Columns.Item(invisibleColumnNum[0]));
                for (let i of invisibleColumnNum) {
                    invisibleColumns = wps.Union(invisibleColumns, wps.Intersect(rng, wps.Columns.Item(i)));
                }
                rng.EntireColumn.Hidden = false;
                invisibleColumns.Delete(1);
            }
        }
        rng = wps.Intersect(sel, wps.ActiveSheet.UsedRange);
        if (rng) { // 再删除隐藏行整行
            let invisibleRowNum = [];
            let col1Cells = wps.Range(rng.Columns.Item(1).Address()).Cells;
            for (let k = 1; k <= col1Cells.Count; k++) {
                let cell = col1Cells.Item(k);
                if (cell.EntireRow.Hidden) {
                    invisibleRowNum.push(cell.Row); // 隐藏行的行号
                }
            }
            if (invisibleRowNum[0]) {
                rng.EntireRow.Hidden = false;
                let invisibleRows = wps.Rows.Item(invisibleRowNum[0]);
                for (let i of invisibleRowNum) {
                    invisibleRows = wps.Union(invisibleRows, wps.Rows.Item(i));
                }
                invisibleRows.Delete();
            }
        }
        } else if (wps.Rows.Count === wps.Selection.Rows.Count) { // 选择整列情况
        if (rng) { // 先删除隐藏行的选中部分
            let invisibleRowNum = [];
            let col1Cells = wps.Range(rng.Columns.Item(1).Address()).Cells;
            for (let k = 1; k <= col1Cells.Count; k++) {
                let cell = col1Cells.Item(k);
                if (cell.EntireRow.Hidden) {
                    invisibleRowNum.push(cell.Row); // 隐藏行的行号
                }
            }
            if (invisibleRowNum[0]) {
                let invisibleRows = wps.Intersect(rng, wps.Rows.Item(invisibleRowNum[0]));
                for (let i of invisibleRowNum) {
                    invisibleRows = wps.Union(invisibleRows, wps.Intersect(rng, wps.Rows.Item(i)));
                }
                rng.EntireRow.Hidden = false;
                invisibleRows.Delete(2);
            }
        }
        rng = wps.Intersect(sel, wps.ActiveSheet.UsedRange);
        if (rng) { // 再删除隐藏行整列
            let invisibleColumnNum = [];
            let row1Cells = wps.Range(rng.Rows.Item(1).Address()).Cells;
            for (let k = 1; k <= row1Cells.Count; k++) {
                let cell = row1Cells.Item(k);
                if (cell.EntireColumn.Hidden) {
                    invisibleColumnNum.push(cell.Column); // 隐藏列的列号
                }
            }
            if (invisibleColumnNum[0]) {
                rng.EntireColumn.Hidden = false;
                let invisibleColumns = wps.Columns.Item(invisibleColumnNum[0]);
                for (let i of invisibleColumnNum) {
                    invisibleColumns = wps.Union(invisibleColumns, wps.Columns.Item(i));
                }
                invisibleColumns.Delete();
            }
        }
    } else {
        alert("请选择整行或整列！")
    }
}

function 拆分为工作表() { // 按列拆分成工作表
    if (wps.Rows.Count === wps.Selection.Rows.Count) { // 选择整列
        let ex = wps.ActiveWorkbook.GetWorkbookEx();
        ex.SplitSheet(wps.ActiveSheet.UsedRange, wps.Selection.Column - 1, true, 0, 0, undefined);
    } else {
        alert("请选择整列！")
    }
    //参数1 range:Range
    //参数2 colIdx:number 从0开始
    //参数3 hasTite:boolean
    //参数4 dateType:number 年月日格式
    //参数5 outputType:number 0.新工作表; 1.新工作簿
    //参数6 dirpath:string
}

function 拆分为工作簿() { // 按列拆分成工作簿
    wps.ScreenUpdating = false;
    if (wps.Rows.Count === wps.Selection.Rows.Count) { // 选择整列
        let ex = wps.ActiveWorkbook.GetWorkbookEx();
        ex.SplitSheet(wps.ActiveSheet.UsedRange, wps.Selection.Column - 1, true, 0, 1, wps.ActiveWorkbook.Path);
    } else {
        alert("请选择整列！")
    }
    wps.ScreenUpdating = true;
}

function 每表一簿() { // 工作表拆分成工作簿
    wps.ScreenUpdating = false;
    let ex = wps.ActiveWorkbook.GetWorkbookEx();
    ex.SplitBook(wps.ActiveWorkbook.Path, undefined);
    //ex.SplitBook(wps.ActiveWorkbook.Path, wps.ActiveSheet.Sheets);
    wps.ScreenUpdating = true;
}

async function 查询LPR() {
    // 东方财富 LPR 历史数据接口（直接取 JSON，不用 JSONP 包裹）
    //  - pageSize=5000 一次性取全量（接口默认只有 500 条，共 4 页）
    //  - sortColumns=TRADE_DATE & sortTypes=-1 按日期倒序，保证最新的在最前面
    const url = "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_WEB_RATE&columns=ALL&pageSize=5000&sortColumns=TRADE_DATE&sortTypes=-1";

    function httpGetText(url) {
        return new Promise(function (resolve, reject) {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.timeout = 15000;
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            resolve(xhr.responseText || "");
                        } else {
                            reject(new Error("HTTP " + xhr.status + " " + (xhr.statusText || "")));
                        }
                    }
                };
                xhr.onerror = function () { reject(new Error("网络请求失败，可能被防火墙拦截或无网络")); };
                xhr.ontimeout = function () { reject(new Error("请求超时（15秒）")); };
                xhr.send(null);
            } catch (e) {
                reject(e);
            }
        });
    }

    try {
        // 1. 拉取并解析数据
        const rawText = await httpGetText(url);
        let payload;
        try {
            // 不带 callback 参数时接口直接返回 JSON；若后续又加了 callback，这里也兼容 JSONP 包裹
            if (/^\s*[A-Za-z_][\w.]*\s*\(/.test(rawText)) {
                const m = rawText.match(/^[\s\S]*?\(([\s\S]*)\)\s*;?\s*$/);
                if (!m) throw new Error("JSONP 解析失败");
                payload = JSON.parse(m[1]);
            } else {
                payload = JSON.parse(rawText);
            }
        } catch (parseErr) {
            throw new Error("接口返回解析失败：" + parseErr.message + "，响应前80字：" + String(rawText).slice(0, 80));
        }
        if (payload.code !== 0 || !payload.result || !payload.result.data) {
            throw new Error("接口返回异常：code=" + payload.code + " msg=" + (payload.message || ""));
        }
        let rows = payload.result.data.slice(); // 拷贝一份，避免污染原数组

        // 2. 从表尾 pop 掉没有 LPR5Y 的老数据
        //    说明：接口最早期（2017 年前后）只发布了基准利率 RATE_1/RATE_2，LPR 字段为 null
        let n = rows.length;
        while (n > 0 && rows[n - 1] && (rows[n - 1].LPR5Y === null || rows[n - 1].LPR5Y === undefined || rows[n - 1].LPR5Y === "")) {
            rows.pop();
            n -= 1;
        }
        if (n <= 0) throw new Error("接口数据为空：没有可用的 LPR 记录");

        // 3. 构造输出矩阵：[日期(10位), LPR1Y, LPR5Y]
        const TRADE_DATE_LEN = 10;
        const output = rows.map(function (x) {
            const d = String(x.TRADE_DATE || "").slice(0, TRADE_DATE_LEN);
            return [d, x.LPR1Y, x.LPR5Y];
        });

        // 4. 新建工作表并写入
        const xlCenter = -4108;
        const xlCellValue = 1;
        const xlGreater = 5;
        const xlLess = 6;
        let sh;
        if (wps.Sheets && wps.Sheets.Count) {
            sh = wps.Sheets.Add({ After: wps.Sheets.Item(wps.Sheets.Count) });
        } else {
            sh = wps.ActiveSheet;
        }
        sh.Range("A1:E1").Value2 = ["日期", "1Y", "5Y", "1Y变化", "5Y变化"];
        sh.Range("A2").Resize(n, 3).Value2 = output;

        // 5. 写变化公式：本交易日 - 上一个交易日 = 与上期差值
        //    注意：只有 n-1 行能算出差值，最后一行（最早的日期）没有"上一期"可比较，
        if (n > 1) {
            // D2: D[n] 对应 B2-B3, B3-B4, ..., B[n-1]-B[n]
            sh.Range("D2").Resize(n - 1, 1).FormulaR1C1 = "=RC[-2]-R[1]C[-2]";
            sh.Range("E2").Resize(n - 1, 1).FormulaR1C1 = "=RC[-2]-R[1]C[-2]";
        }

        // 6. 格式
        sh.Range("A:E").HorizontalAlignment = xlCenter;
        sh.Range("A:A").ColumnWidth = 12;
        sh.Range("B:E").ColumnWidth = 8;
        sh.Range("A:A").NumberFormatLocal = "YYYY/MM/DD";
        sh.Range("B:E").NumberFormatLocal = "#,##0.00";
        try {
            const fmtRng = sh.Range("D2:E" + (n + 1 > 2 ? n + 1 : 999));
            const cond1 = fmtRng.FormatConditions.Add(xlCellValue, xlGreater, 0);
            cond1.Interior.ColorIndex = 3; // 上涨：红
            const cond2 = fmtRng.FormatConditions.Add(xlCellValue, xlLess, 0);
            cond2.Interior.ColorIndex = 4; // 下降：绿
        } catch (fmtErr) {
            // 条件格式不是强功能，失败不影响主流程
            console.log("[警告] 条件格式设置失败：" + fmtErr.message);
        }

        try { sh.Activate(); } catch (_) { /* 忽略激活失败 */ }
    } catch (e) {
        const msg = "查询 LPR 失败：" + (e && e.message ? e.message : e) + "\n\n请检查：\n① 网络是否可访问东方财富(datacenter-web.eastmoney.com)\n② 是否被防火墙/WPS 信任中心拦截";
        console.error(msg);
        if (typeof alert === "function") {
            alert(msg);
        } else if (typeof MsgBox === "function") {
            MsgBox(msg);
        }
    }
}

// ============ 发票识别 ============
// VBA 常量
var msoFileDialogFilePicker = 3;
var xlCenter = -4108;
var xlUp = -4162;

// 发票识别专用 HTTP 工具（使用 COM 对象绕过 CORS 限制）
// MSXML2.XMLHTTP 是 Windows COM 对象，不受浏览器 CORS 策略限制

// 创建 COM 对象（多策略尝试）
function 发票识别_createCOMObj(name) {
    // 1. ActiveXObject（IE 内核可用）
    try { return new ActiveXObject(name); } catch (e1) {}
    // 2. WPS Application.CreateObject
    try {
        var app = window.Application;
        if (app && app.CreateObject) return app.CreateObject(name);
    } catch (e2) {}
    // 3. Wps.CreateObject
    try {
        if (typeof Wps !== "undefined" && Wps.CreateObject) return Wps.CreateObject(name);
    } catch (e3) {}
    // 4. wps 全局对象
    try {
        if (typeof wps !== "undefined" && wps.CreateObject) return wps.CreateObject(name);
    } catch (e4) {}
    return null;
}

// 创建 HTTP COM 对象（尝试多种 ProGID）
function 发票识别_createHTTPCOM() {
    var progIds = [
        "MSXML2.XMLHTTP",
        "MSXML2.XMLHTTP.6.0",
        "MSXML2.ServerXMLHTTP",
        "MSXML2.ServerXMLHTTP.6.0",
        "WinHttp.WinHttpRequest.5.1"
    ];
    for (var i = 0; i < progIds.length; i++) {
        var obj = 发票识别_createCOMObj(progIds[i]);
        if (obj) return obj;
    }
    return null;
}

// 检测可用的 HTTP 引擎
var _invoiceHttpEngine = null;
function 发票识别_getHttpEngine() {
    if (_invoiceHttpEngine) return _invoiceHttpEngine;
    // 测试是否能创建 HTTP COM 对象
    var com = 发票识别_createHTTPCOM();
    if (com) {
        try { com.abort && com.abort(); } catch (e) {}
        _invoiceHttpEngine = "com";
    } else {
        _invoiceHttpEngine = "xhr";
    }
    return _invoiceHttpEngine;
}

function 发票识别_httpGet(url) {
    var engine = 发票识别_getHttpEngine();
    if (engine === "com") return 发票识别_httpGetViaCOM(url);
    return 发票识别_httpGetViaXHR(url);
}

function 发票识别_httpPost(url, body) {
    var engine = 发票识别_getHttpEngine();
    if (engine === "com") return 发票识别_httpPostViaCOM(url, body);
    return 发票识别_httpPostViaXHR(url, body);
}

// ---- COM 版（MSXML2/WinHttp，无 CORS 限制）----
function 发票识别_httpGetViaCOM(url) {
    return new Promise(function (resolve, reject) {
        try {
            var xhr = 发票识别_createHTTPCOM();
            if (!xhr) { reject(new Error("COM 对象创建失败")); return; }
            xhr.open("GET", url, true);
            try { xhr.setTimeouts(15000, 15000, 15000, 15000); } catch (e) {}
            var completed = false;
            // MSXML2 支持 onreadystatechange；WinHttp 部分版本不支持，用轮询
            var useEvent = false;
            try {
                xhr.onreadystatechange = function () {
                    if (completed) return;
                    try {
                        if (xhr.readyState === 4) {
                            completed = true;
                            var st = 0;
                            try { st = xhr.status; } catch (e) {}
                            if (st === 200) resolve(xhr.responseText || "");
                            else if (st === 0) reject(new Error("HTTP 0: COM 请求被拦截"));
                            else reject(new Error("HTTP " + st));
                        }
                    } catch (err) {
                        if (!completed) { completed = true; reject(err); }
                    }
                };
                useEvent = true;
            } catch (e) {
                // WinHttp 可能不支持 onreadystatechange
            }
            xhr.send(null);
            if (!useEvent) {
                // 轮询方式（WinHttp 回退）
                var pollTimer = setInterval(function () {
                    if (completed) { clearInterval(pollTimer); return; }
                    try {
                        if (xhr.readyState === 4) {
                            clearInterval(pollTimer);
                            completed = true;
                            var st = 0;
                            try { st = xhr.status; } catch (e) {}
                            if (st === 200) resolve(xhr.responseText || "");
                            else if (st === 0) reject(new Error("HTTP 0: COM 请求被拦截"));
                            else reject(new Error("HTTP " + st));
                        }
                    } catch (err) {
                        clearInterval(pollTimer);
                        if (!completed) { completed = true; reject(err); }
                    }
                }, 100);
            }
            setTimeout(function () {
                if (!completed) { completed = true; reject(new Error("请求超时(15秒)")); }
            }, 16000);
        } catch (e) { reject(e); }
    });
}

function 发票识别_httpPostViaCOM(url, body) {
    return new Promise(function (resolve, reject) {
        try {
            var xhr = 发票识别_createHTTPCOM();
            if (!xhr) { reject(new Error("COM 对象创建失败")); return; }
            xhr.open("POST", url, true);
            try { xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded"); } catch (e) {}
            try { xhr.setTimeouts(30000, 30000, 30000, 30000); } catch (e) {}
            var completed = false;
            var useEvent = false;
            try {
                xhr.onreadystatechange = function () {
                    if (completed) return;
                    try {
                        if (xhr.readyState === 4) {
                            completed = true;
                            var st = 0;
                            try { st = xhr.status; } catch (e) {}
                            if (st === 200) {
                                try { resolve(JSON.parse(xhr.responseText || "{}")); }
                                catch (e) { reject(new Error("响应解析失败: " + (xhr.responseText || "").slice(0, 100))); }
                            } else if (st === 0) reject(new Error("HTTP 0: COM 请求被拦截"));
                            else reject(new Error("HTTP " + st));
                        }
                    } catch (err) {
                        if (!completed) { completed = true; reject(err); }
                    }
                };
                useEvent = true;
            } catch (e) {}
            xhr.send(body);
            if (!useEvent) {
                var pollTimer = setInterval(function () {
                    if (completed) { clearInterval(pollTimer); return; }
                    try {
                        if (xhr.readyState === 4) {
                            clearInterval(pollTimer);
                            completed = true;
                            var st = 0;
                            try { st = xhr.status; } catch (e) {}
                            if (st === 200) {
                                try { resolve(JSON.parse(xhr.responseText || "{}")); }
                                catch (e) { reject(new Error("响应解析失败: " + (xhr.responseText || "").slice(0, 100))); }
                            } else if (st === 0) reject(new Error("HTTP 0: COM 请求被拦截"));
                            else reject(new Error("HTTP " + st));
                        }
                    } catch (err) {
                        clearInterval(pollTimer);
                        if (!completed) { completed = true; reject(err); }
                    }
                }, 100);
            }
            setTimeout(function () {
                if (!completed) { completed = true; reject(new Error("请求超时(30秒)")); }
            }, 31000);
        } catch (e) { reject(e); }
    });
}

// ---- XHR 回退版（受 CORS 限制，仅适用于返回 CORS 头的 API）----
function 发票识别_httpGetViaXHR(url) {
    return new Promise(function (resolve, reject) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.timeout = 15000;
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) resolve(xhr.responseText || "");
                    else if (xhr.status === 0) reject(new Error("HTTP 0: 请求被 CORS 或 WPS 安全策略拦截"));
                    else reject(new Error("HTTP " + xhr.status));
                }
            };
            xhr.onerror = function () { reject(new Error("网络请求失败")); };
            xhr.send(null);
        } catch (e) { reject(e); }
    });
}

function 发票识别_httpPostViaXHR(url, body) {
    return new Promise(function (resolve, reject) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("POST", url, true);
            xhr.timeout = 30000;
            try { xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded"); } catch (e) {}
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try { resolve(JSON.parse(xhr.responseText || "{}")); }
                        catch (e) { reject(new Error("响应解析失败: " + (xhr.responseText || "").slice(0, 100))); }
                    } else if (xhr.status === 0) reject(new Error("HTTP 0: 请求被拦截"));
                    else reject(new Error("HTTP " + xhr.status));
                }
            };
            xhr.onerror = function () { reject(new Error("网络请求失败")); };
            xhr.send(body);
        } catch (e) { reject(e); }
    });
}

// 连通性测试 + 打开对话框（在主上下文中执行，无 CORS 限制）
async function 发票识别_测试AndOpen() {
    Application.StatusBar = "测试百度 OCR API 连通性...";
    try {
        var engine = 发票识别_getHttpEngine();
        var engineMsg = engine === "com" ? "COM (MSXML2/WinHttp) 无 CORS 限制" : "XMLHttpRequest 受 CORS 限制";
        
        var cfgRaw = Application.PluginStorage.getItem("invoice_ocr_config");
        var cfg = JSON.parse(cfgRaw);
        var tokenUrl = "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials" +
            "&client_id=" + encodeURIComponent(cfg.apiKey) +
            "&client_secret=" + encodeURIComponent(cfg.secretKey);
        var tokenText = await 发票识别_httpGet(tokenUrl);
        var tokenData = JSON.parse(tokenText);
        if (tokenData.error) {
            throw new Error("Token 获取失败: " + (tokenData.error_description || tokenData.error));
        }
        Application.StatusBar = false;
        // 连通性测试通过
        Application.ShowDialog(GetUrlPath() + "/ui/InvoiceOCR.html", "发票识别", 780 * window.devicePixelRatio, 720 * window.devicePixelRatio, false);
    } catch (e) {
        Application.StatusBar = false;
        var engine2 = 发票识别_getHttpEngine();
        var engineName = engine2 === "com" ? "COM" : "XMLHttpRequest";
        MsgBox("百度 OCR API 连接失败（HTTP 引擎: " + engineName + "）：\n\n" + e.message + "\n\n请检查：\n① API Key / Secret Key 是否正确\n② 网络是否可访问 aip.baidubce.com\n③ 若 XMLHttpRequest 回退，百度 API 不返回 CORS 头，需 COM 才能绕过");
    }
}

async function 发票识别() {
    // 1. 读取配置
    var cfg;
    try {
        var raw = Application.PluginStorage.getItem("invoice_ocr_config");
        if (!raw) { alert("请先在「发票识别」对话框中配置 API Key"); return; }
        cfg = JSON.parse(raw);
    } catch (e) { alert("配置读取失败: " + e.message); return; }

    // 2. 读取待识别数据
    var pending;
    try {
        var pendingRaw = Application.PluginStorage.getItem("invoice_ocr_pending");
        if (!pendingRaw) {
            // 无待识别数据，打开对话框
            Application.ShowDialog(GetUrlPath() + "/ui/InvoiceOCR.html", "发票识别", 780 * window.devicePixelRatio, 720 * window.devicePixelRatio, false);
            return;
        }
        pending = JSON.parse(pendingRaw);
        // 清除待识别数据
        Application.PluginStorage.setItem("invoice_ocr_pending", "");
    } catch (e) { alert("待识别数据读取失败: " + e.message); return; }

    if (!pending.files || pending.files.length === 0) {
        alert("没有待识别的文件，请在对话框中选择文件后点击「准备识别」");
        return;
    }

    // 3. Token 管理
    var tokenCache = { token: "", expire: 0 };
    function getToken() {
        var now = Date.now();
        if (tokenCache.token && tokenCache.expire > now) return Promise.resolve(tokenCache.token);
        var url = "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials" +
            "&client_id=" + encodeURIComponent(cfg.apiKey) +
            "&client_secret=" + encodeURIComponent(cfg.secretKey);
        return 发票识别_httpGet(url).then(function (text) {
            var data = JSON.parse(text);
            if (data.error) throw new Error("Token 获取失败: " + (data.error_description || data.error));
            tokenCache.token = data.access_token;
            tokenCache.expire = now + (data.expires_in - 300) * 1000;
            return tokenCache.token;
        });
    }

    // 5. 结果解析
    function parseResult(result) {
        if (!result || result.error_code) return null;
        var wr = result.words_result || {};
        var names = wr.CommodityName || [];
        if (!Array.isArray(names)) {
            if (names && names.word) names = [names];
            else return null;
        }
        var rows = [];
        for (var i = 0; i < names.length; i++) {
            var row = [];
            row.push(wr.InvoiceNum || "");
            row.push(wr.InvoiceDate || "");
            row.push(wr.SellerName || "");
            row.push(wr.PurchaserName || "");
            row.push(names[i].word || "");
            row.push(wr.CommodityType && wr.CommodityType[i] ? wr.CommodityType[i].word || "" : "");
            row.push(wr.CommodityUnit && wr.CommodityUnit[i] ? wr.CommodityUnit[i].word || "" : "");
            row.push(wr.CommodityNum && wr.CommodityNum[i] ? wr.CommodityNum[i].word || "" : "");
            row.push(wr.CommodityPrice && wr.CommodityPrice[i] ? wr.CommodityPrice[i].word || "" : "");
            row.push(wr.CommodityAmount && wr.CommodityAmount[i] ? wr.CommodityAmount[i].word || "" : "");
            row.push(wr.CommodityTaxRate && wr.CommodityTaxRate[i] ? wr.CommodityTaxRate[i].word || "" : "");
            row.push(wr.CommodityTax && wr.CommodityTax[i] ? wr.CommodityTax[i].word || "" : "");
            var amt = Number(wr.CommodityAmount && wr.CommodityAmount[i] ? wr.CommodityAmount[i].word : 0) || 0;
            var tax = Number(wr.CommodityTax && wr.CommodityTax[i] ? wr.CommodityTax[i].word : 0) || 0;
            row.push(String(amt + tax));
            rows.push(row);
        }
        return rows;
    }

    // 6. 主流程
    Application.ScreenUpdating = false;
    Application.StatusBar = "正在获取 Token...";

    try {
        var token = await getToken();
        var allResults = [];
        var header = ["发票号码", "开票日期", "销售方", "购买方", "项目名称", "规格型号", "单位", "数量", "单价", "金额", "税率", "税额", "价税合计"];

        var files = pending.files;
        for (var idx = 0; idx < files.length; idx++) {
            var fileItem = files[idx];
            var fileName = fileItem.name;
            var fileType = fileItem.type;
            var fileData = fileItem.data;

            Application.StatusBar = "识别中 [" + (idx + 1) + "/" + files.length + "]: " + fileName;

            try {
                if (fileType === "pdf") {
                    // PDF 直接识别（仅首页，作为回退）
                    var body = "pdf_file=" + encodeURIComponent(fileData);
                    var ocrResult = await 发票识别_httpPost("https://aip.baidubce.com/rest/2.0/ocr/v1/vat_invoice?access_token=" + token, body);
                    var rows = parseResult(ocrResult);
                    allResults.push({
                        fileName: fileName,
                        rows: rows || [],
                        error: rows ? null : "未识别到发票信息"
                    });
                } else {
                    // 图片识别
                    var body2 = "image=" + encodeURIComponent(fileData);
                    var ocrRes = await 发票识别_httpPost("https://aip.baidubce.com/rest/2.0/ocr/v1/vat_invoice?access_token=" + token, body2);
                    var parsed = parseResult(ocrRes);
                    allResults.push({
                        fileName: fileName,
                        rows: parsed || [],
                        error: parsed ? null : "未识别到发票信息"
                    });
                }
            } catch (e) {
                allResults.push({ fileName: fileName, rows: [], error: e.message });
            }
        }

        // 7. 写入工作表
        Application.StatusBar = "写入工作表...";
        var data = [header];
        for (var i = 0; i < allResults.length; i++) {
            var item = allResults[i];
            if (item.rows && item.rows.length > 0) {
                for (var j = 0; j < item.rows.length; j++) data.push(item.rows[j]);
            }
        }

        var wb = Application.ActiveWorkbook;
        if (!wb) throw new Error("没有打开的工作簿");

        var sh = wb.Sheets.Add(undefined, wb.Sheets.Item(wb.Sheets.Count));
        sh.Name = "发票识别_" + Date.now().toString(36).slice(-4);

        sh.Range("A1").Resize(data.length, 13).Value2 = data;

        // 格式设置
        sh.Range("1:1").HorizontalAlignment = xlCenter;
        sh.Range("A:A").NumberFormat = "@";
        sh.Range("A:A").ColumnWidth = 21;
        sh.Range("B:B").NumberFormat = "YYYY/MM/DD";
        sh.Range("B:B").ColumnWidth = 14;
        sh.Range("C:D").ColumnWidth = 30;
        sh.Range("E:E").ColumnWidth = 20;
        sh.Range("F:H").ColumnWidth = 10;
        sh.Range("I:I").ColumnWidth = 12;
        sh.Range("J:J,L:M").NumberFormat = "###,##0.00";
        sh.Range("J:J,L:M").ColumnWidth = 12;

        try { sh.Activate(); } catch (e) {}

        // 汇总消息
        var totalRows = data.length - 1;
        var successCount = allResults.filter(function (r) { return !r.error; }).length;
        var failFiles = allResults.filter(function (r) { return r.error; });
        var msg = "识别完成！\n\n共 " + allResults.length + " 个文件，成功 " + successCount + "，识别 " + totalRows + " 行";
        if (failFiles.length > 0) {
            msg += "\n\n失败文件：";
            for (var f = 0; f < failFiles.length; f++) msg += "\n  • " + failFiles[f].fileName + ": " + failFiles[f].error;
        }
        Application.StatusBar = false;
        MsgBox(msg);

    } catch (e) {
        Application.StatusBar = false;
        alert("发票识别失败: " + e.message);
    } finally {
        try { Application.ScreenUpdating = true; } catch (e) {}
    }
}

function 规划求解() {
    let msg = "使用说明：\n\nCtrl+鼠标左键，依次选中以下单元格。\n";
    msg += "①自变量X ②因变量Y ③目标Y ④可接受误差 ⑤迭代次数\n\n";
    msg += "至少选中前两项，③目标Y默认为0，④可接受误差默认为10e-5，⑤迭代次数默认为50次。\n\n";
    msg += "前三项可为数组，需长度一致，一一对应。";
    let args = getArgs();
    if (args) {
        var n = args[0].Count;
        var [rng1, rng2, targetValue, acceptableDifference, iterationLimit] = args;
    } else {
        alert(msg);
        return;
    }
    // ScreenUpdating 只切换一次，避免每个单元格都刷新屏幕
    wps.ScreenUpdating = false;
    let notConvergedCount = 0;
    try {
        for (let i = 1; i <= n; i++) {
            let converged = goalseek(rng1.Item(i), rng2.Item(i), targetValue[i], undefined, acceptableDifference, iterationLimit);
            if (!converged) notConvergedCount++;
        }
    } finally {
        wps.ScreenUpdating = true;
    }
    if (notConvergedCount > 0) {
        alert("求解完成，其中 " + notConvergedCount + " 个方程在迭代次数内未达到目标精度。");
    }

    function rng(i) { // 返回wps.Selection中第i个选区Range对象
        return wps.Selection.Areas.Item(i);
    }

    function getArgs() { // 通过wps.Selection获得参数数组
        let argsCount = wps.Selection.Areas.Count; // 选区数，即参数数目
        if (argsCount >= 2 && argsCount <= 5) {
            var rng1 = wps.Intersect(wps.ActiveSheet.UsedRange, rng(1));
            var rng2 = wps.Intersect(wps.ActiveSheet.UsedRange, rng(2));
            if (!rng1 || !rng2 || rng1.Count !== rng2.Count) return; // 参数1、2不合规
            var targetValue = []; // 参数3默认值
            if (argsCount >= 3) {
                let rng3 = wps.Intersect(wps.ActiveSheet.UsedRange, rng(3));
                if (!rng3) return; // 参数3不合规
                if (rng3.Count === 1) {
                    targetValue = Array(rng1.Count + 1).fill(rng3.Value2 || 0);
                } else if (rng3.Count === rng1.Count) {
                    targetValue = [0].concat(rng3.Value2.flat());
                } else {
                    return; // 参数3不合规
                }
            }
            if (argsCount >= 4 && rng(4).Count === 1) {
                var acceptableDifference = rng(4).Value2;
            } else if (argsCount >= 4 && rng(4).Count > 1) {
                var acceptableDifference = rng(4).Item(1).Value2;
            }
            if (argsCount === 5 && rng(5).Count === 1) {
                var iterationLimit = rng(5).Value2;
            } else if (argsCount === 5 && rng(5).Count > 1) {
                var iterationLimit = rng(5).Item(1).Value2;
            }
        } else {
            return; // 参数总数不合规
        }
        return [rng1, rng2, targetValue, acceptableDifference, iterationLimit];
    }

    function goalseek(variableRange, targetRange, targetValue, variableInitial, acceptableDifference, iterationLimit) {
        // 参数预设
        targetValue = targetValue ?? 0;
        variableInitial = variableInitial ?? variableRange.Value2;
        acceptableDifference = acceptableDifference ?? 1E-5;
        iterationLimit = iterationLimit ?? 50;
        if (iterationLimit > 1000) iterationLimit = 1000;
        // 函数实现
        let lastx = variableInitial;
        variableRange.Value2 = variableInitial;
        let lasty = targetRange.Value2 - targetValue;
        let converged = Math.abs(lasty) < acceptableDifference;
        for (let i = 0; i < iterationLimit && !converged; i++) {
            // 步长 h 随 x 量级自适应：|x|*1E-2，下限 1E-3 避免 x=0 时步长为 0
            let h = Math.max(Math.abs(lastx) * 1E-2, 1E-3);
            variableRange.Value2 = lastx - h; // x-h
            let y1 = targetRange.Value2 - targetValue;
            variableRange.Value2 = lastx + h; // x+h
            let y2 = targetRange.Value2 - targetValue;
            let r = (y2 - y1) / (2 * h);
            if (r !== 0) {
                variableRange.Value2 = lastx - lasty / r;
                lastx = variableRange.Value2;
                lasty = targetRange.Value2 - targetValue;
                converged = Math.abs(lasty) < acceptableDifference;
            } else {
                variableRange.Value2 = lastx;
            }
        }
        return converged;
    }
}
