// EChartsDialog.js
// 弹窗预览脚本：轮询 PluginStorage 中的 echarts_config 配置，渲染图表；提供图片导出按钮。
// 注意：本脚本由 main.js 在 WPS 全局环境加载，同时通过 EChartsDialog.html 的 <script> 标签重复加载（UMD 短路无副作用）。

var EChartsDialog = (function () {
    var STORAGE_KEY = "echarts_config";
    var EXPORT_STATUS_KEY = "echarts_export_status";
    var EXPORT_REQUEST_KEY = "echarts_export_request";
    var LAST_CONFIG_KEY = "echarts_config_last";

    var chart = null;
    var lastTimestamp = 0;
    var pollTimer = null;
    var currentConfig = null;

    // ===================== 内部工具 =====================
    function setStatus(msg, cls) {
        var el = document.getElementById("status");
        if (!el) { console.log("[Dialog] " + msg); return; }
        el.textContent = msg;
        el.className = cls || "";
    }

    function setInfo(text) {
        var el = document.getElementById("chartInfo");
        if (el) el.textContent = text;
    }

    function getStorage(key) {
        try { return window.Application.PluginStorage.getItem(key); }
        catch (e) { return null; }
    }
    function setStorage(key, val) {
        try { window.Application.PluginStorage.setItem(key, val); }
        catch (e) { console.log("[Dialog] setStorage 失败 " + key + ": " + e.message); }
    }

    // ===================== ECharts 实例管理 =====================
    function ensureChart() {
        if (chart) return chart;
        var dom = document.getElementById("chart");
        if (!dom) throw new Error("找不到 #chart 容器");
        // 显式设置 dom 高度，避免 floating taskpane 下 flex 计算为 0
        if (!dom.offsetHeight || dom.offsetHeight < 100) {
            dom.style.height = "300px";
        }
        chart = echarts.init(dom, null, { renderer: "canvas" });
        window.addEventListener("resize", function () { try { chart.resize(); } catch (e) {} });
        // 兜容：100ms 后强制 resize 一次，等 taskpane 完全展开
        setTimeout(function () { try { chart.resize(); } catch (e) {} }, 100);
        setTimeout(function () { try { chart.resize(); } catch (e) {} }, 500);
        return chart;
    }

    function applyConfig(cfg) {
        if (!cfg) { setStatus("配置为空", "warn"); return; }
        currentConfig = cfg;
        try {
            var c = ensureChart();
            // 兼容 v1 旧格式（直接含 option）
            if (cfg.option) {
                var opt = (typeof cfg.option === "string") ? JSON.parse(cfg.option) : cfg.option;
                c.clear();
                c.setOption(opt, true);
                setInfo((cfg.chartType || "?") + "  数据：" + (cfg.dataAddr || "?"));
                setStatus("渲染成功（v1 option 直传，" + new Date().toLocaleTimeString() + "）", "ok");
                return;
            }
            // v2 格式：Dialog 自己 readRangeData + buildOption
            if (!cfg.dataAddr) { setStatus("[诊断] 配置中无 dataAddr。cfg 键：" + Object.keys(cfg).join(","), "warn"); return; }
            if (typeof EChartsTaskPane === "undefined") {
                setStatus("[诊断] EChartsTaskPane 全局未定义。Dialog HTML 是否加载了 EChartsTaskPane.js？", "fail");
                return;
            }
            if (!EChartsTaskPane.readRangeData || !EChartsTaskPane.buildOption) {
                setStatus("[诊断] EChartsTaskPane 缺少 readRangeData/buildOption 方法", "fail");
                return;
            }
            setStatus("[诊断] 正在读取数据 " + cfg.dataAddr + " ...", "");
            var data;
            try { data = EChartsTaskPane.readRangeData(cfg.dataAddr); }
            catch (e) { setStatus("[诊断] readRangeData 失败：" + e.message, "fail"); return; }
            setStatus("[诊断] 数据读取完成，行数=" + (data ? data.length : 0) + "，开始 build...", "");
            var option;
            try {
                option = EChartsTaskPane.buildOption(cfg.chartType, data, cfg.layout, cfg.commonOpts || {}, cfg.specificOpts || {});
            } catch (e) { setStatus("[诊断] buildOption 失败：" + e.message, "fail"); return; }
            if (typeof option === "string") {
                try { option = JSON.parse(option); }
                catch (e) { setStatus("[诊断] option JSON 解析失败：" + e.message, "fail"); return; }
            }
            c.clear();
            c.setOption(option, true);
            setInfo("类型：" + (cfg.chartType || "未知") + "  数据：" + cfg.dataAddr);
            setStatus("渲染成功（" + new Date().toLocaleTimeString() + "）", "ok");
        } catch (e) {
            setStatus("渲染失败：" + e.message, "fail");
        }
    }

    // 渲染一个 demo 图，确认 echarts 在 Dialog 中能工作
    function renderDemo() {
        try {
            var c = ensureChart();
            c.setOption({
                color: ['#5470c6', '#91cc75'],
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: ['A','B','C','D'] },
                yAxis: { type: 'value' },
                series: [{ type: 'bar', data: [5, 12, 8, 15] }]
            }, true);
            setStatus("[demo] echarts 工作正常，等待 TaskPane 渲染请求…", "ok");
        } catch (e) {
            setStatus("[demo] echarts 渲染失败：" + e.message, "fail");
        }
    }

    // ===================== 轮询通信 =====================
    function pollConfig() {
        var raw = getStorage(STORAGE_KEY);
        if (!raw) return;
        var cfg;
        try { cfg = JSON.parse(raw); }
        catch (e) { return; }
        if (!cfg.timestamp || cfg.timestamp === lastTimestamp) return;
        lastTimestamp = cfg.timestamp;
        applyConfig(cfg);
        // 处理 action
        if (cfg.action === "close") {
            closeSelf();
            return;
        }
    }

    function pollExportRequest() {
        var raw = getStorage(EXPORT_REQUEST_KEY);
        if (!raw) return;
        setStorage(EXPORT_REQUEST_KEY, ""); // 消费掉
        var req;
        try { req = JSON.parse(raw); }
        catch (e) { setStatus("导出请求格式错误：" + e.message, "fail"); return; }
        if (!req.target) return;
        if (req.target === "local") {
            exportLocal(req.pixelRatio || 2, req.bgColor || "#fff");
        } else if (req.target === "sheet") {
            exportToSheet(req.pixelRatio || 2, req.bgColor || "#fff");
        }
    }

    function pollExportStatus() {
        // 由 TaskPane 拉取 EXPORT_STATUS_KEY，这里无需处理
    }

    function startPolling() {
        if (pollTimer) return;
        pollTimer = setInterval(function () {
            try { pollConfig(); pollExportRequest(); pollExportStatus(); }
            catch (e) { console.log("[Dialog] poll error: " + e.message); }
        }, 300);
    }

    function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    // ===================== 图片导出 =====================
    // excludeComponents：导出图片时不包含 toolbox（保存为图片/还原/数据视图/刷新按钮）
    // echarts 原生支持，导出后不影响显示的图表本身
    function getDataURL(pixelRatio, bgColor) {
        if (!chart) throw new Error("尚未渲染图表");
        return chart.getDataURL({
            type: "png",
            pixelRatio: pixelRatio || 2,
            backgroundColor: bgColor || "#fff",
            excludeComponents: ["toolbox"]
        });
    }

    function base64ToUint8Array(base64) {
        var bin = atob(base64);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
    }

    // 创建 COM 对象：优先 ActiveXObject，失败时用 Application.CreateObject
    function createCOMObj(name) {
        // 1. 浏览器原生 ActiveXObject（IE 内核或 Chromium+ActiveX 支持）
        try {
            return new ActiveXObject(name);
        } catch (e1) {
            // console.log("[Dialog] ActiveXObject(" + name + ") 不可用：" + e1.message);
        }
        // 2. WPS Application.CreateObject（WPS 加载项专用）
        try {
            var app = window.Application;
            if (app && app.CreateObject) return app.CreateObject(name);
            // 部分 WPS 版本用 Wps
            if (typeof Wps !== "undefined" && Wps.CreateObject) return Wps.CreateObject(name);
            // 兜容：app.GetNamespace 或类似
            if (app && app.GetObject) {
                try { return app.GetObject("", name); } catch (e2) {}
            }
        } catch (e3) {
            // console.log("[Dialog] Application.CreateObject(" + name + ") 不可用：" + e3.message);
        }
        return null;
    }

    function writeBinaryFile(path, uint8arr) {
        // 方案1：ADODB.Stream 写二进制（最稳）
        var stream = createCOMObj("ADODB.Stream");
        if (stream) {
            try {
                stream.Type = 1; // binary
                stream.Open();
                // Uint8Array 需要转成可被 COM 接受的字节数组
                // 在 WPS 加载项 webview 中，VBArray 或直接传 Uint8Array 都可能工作
                try {
                    stream.Write(uint8arr);
                } catch (e1) {
                    // 兜容：转成普通数组再传
                    var arr = [];
                    for (var i = 0; i < uint8arr.length; i++) arr.push(uint8arr[i]);
                    stream.Write(arr);
                }
                stream.SaveToFile(path, 2); // 2 = adSaveCreateOverWrite
                stream.Close();
                return true;
            } catch (e) {
                console.log("[Dialog] ADODB.Stream 写文件失败：" + e.message);
                try { stream.Close(); } catch (e2) {}
            }
        }
        // 方案2：FileSystemObject + Scripting.TextStream（仅适合文本，二进制不可用，跳过）
        // 方案3：通过 WPS Application 的 Workbook/Sheet 直接插入（不走文件）
        throw new Error("ADODB.Stream 不可用，无法写二进制文件到本地。请尝试以下任一方案：(1) 用「另存为图片」+ 浏览器下载；(2) 右键图表 → 图片另存为；(3) 截图后手动粘贴。");
    }

    function exportLocal(pixelRatio, bgColor) {
        try {
            var url = getDataURL(pixelRatio, bgColor);
            var base64 = url.split(",")[1];
            var arr = base64ToUint8Array(base64);
            var app = window.Application;
            var path = null;
            // 优先 GetSaveAsFilename
            try {
                path = app.GetSaveAsFilename("图表_" + Date.now() + ".png", "PNG 图片|*.png");
            } catch (e) {
                path = null;
            }
            if (!path) {
                // 降级为输入框
                var manual = prompt("请输入保存路径（含文件名 .png）：", "C:\\" + "图表_" + Date.now() + ".png");
                if (!manual) { setStatus("已取消导出。", "warn"); return; }
                path = manual;
            }
            writeBinaryFile(path, arr);
            setStorage(EXPORT_STATUS_KEY, JSON.stringify({ ok: true, msg: "图片已保存到：" + path }));
            setStatus("图片已保存到：" + path, "ok");
        } catch (e) {
            setStorage(EXPORT_STATUS_KEY, JSON.stringify({ ok: false, msg: "图片导出失败：" + e.message }));
            setStatus("图片导出失败：" + e.message + "（可右键图片→图片另存为）", "fail");
        }
    }

    function exportToSheet(pixelRatio, bgColor) {
        var dataUrl = null;
        try {
            dataUrl = getDataURL(pixelRatio, bgColor);
            var app = window.Application;
            // 选位置
            var r = null;
            try {
                r = app.InputBox("请选择图片插入位置（图片将作为静态图片粘贴到该单元格）：", "选择位置", "", undefined, undefined, undefined, undefined, 8);
            } catch (e) { r = null; }
            if (!r || !r.Address) { setStatus("已取消插入。", "warn"); return; }
            var sheet = app.ActiveSheet;
            if (!sheet) throw new Error("没有活动工作表");
            var addr = (typeof r.Address === "function") ? r.Address(true, true) : r.Address;
            var left = r.Left, top = r.Top;
            var added = null;
            var diag = [];

            // 方案A：document.execCommand('copy') 复制图片到剪贴板（旧 API，不需要 focus）
            // 然后用 WPS Sheet.Paste 粘贴
            try {
                var canvas = chart.getDom().querySelector("canvas");
                if (canvas && document.execCommand) {
                    // 把 canvas 转成 <img>，选中后 execCommand('copy') 复制
                    var img = new Image();
                    img.onload = function () {
                        var pasted = false;
                        try {
                            img.style.position = "fixed";
                            img.style.left = "-9999px";
                            img.style.top = "0";
                            document.body.appendChild(img);
                            var range = document.createRange();
                            range.selectNode(img);
                            var sel = window.getSelection();
                            sel.removeAllRanges();
                            sel.addRange(range);
                            var ok = document.execCommand("copy");
                            sel.removeAllRanges();
                            try { document.body.removeChild(img); } catch (e) {}
                            if (!ok) { diag.push("execCommand('copy') 返回 false"); tryClipboardFallback(); return; }
                            // 粘贴到目标位置
                            try { r.Select(); } catch (e) {}
                            try { sheet.Paste(); pasted = true; } catch (e) { diag.push("Sheet.Paste失败:" + e.message); }
                            if (!pasted) {
                                try { app.Paste(); pasted = true; } catch (e) { diag.push("App.Paste失败:" + e.message); }
                            }
                            if (!pasted) {
                                try { app.Selection.Paste(); pasted = true; } catch (e) { diag.push("Selection.Paste失败:" + e.message); }
                            }
                            if (pasted) {
                                setStorage(EXPORT_STATUS_KEY, JSON.stringify({ ok: true, msg: "图片已通过剪贴板插入到 " + addr }));
                                setStatus("图片已插入到 " + addr + "（execCommand 剪贴板方式）", "ok");
                            } else {
                                tryClipboardFallback();
                            }
                        } catch (e) {
                            diag.push("execCommand方案异常:" + e.message);
                            try { document.body.removeChild(img); } catch (e2) {}
                            tryClipboardFallback();
                        }
                    };
                    img.onerror = function (e) {
                        diag.push("img.onload 失败");
                        tryClipboardFallback();
                    };
                    img.src = dataUrl;
                    // 异步路径，提前返回
                    return;
                }
            } catch (e) { diag.push("execCommand方案异常:" + e.message); }

            // 同步路径的兜底
            tryClipboardFallback();

            function tryClipboardFallback() {
                // 方案B：写文件 + AddPicture2
                var base64 = dataUrl.split(",")[1];
                var arr = base64ToUint8Array(base64);
                var tmpDir = "C:\\";
                try {
                    if (app.Path) tmpDir = app.Path + "\\";
                    else if (app.DefaultFilePath) tmpDir = app.DefaultFilePath + "\\";
                } catch (e) {}
                var tmpPath = tmpDir + "echarts_tmp_" + Date.now() + ".png";
                var fileWritten = false;
                try { writeBinaryFile(tmpPath, arr); fileWritten = true; }
                catch (writeErr) { diag.push("写文件失败:" + writeErr.message); }

                if (fileWritten) {
                    try { added = sheet.Shapes.AddPicture2(tmpPath, true, true, left, top, -1, -1); } catch (e) {
                        try { added = sheet.Shapes.AddPicture(tmpPath, true, true, left, top, -1, -1); } catch (e2) {
                            try { added = sheet.Pictures.Insert(tmpPath); } catch (e3) {}
                        }
                    }
                    // 清理临时
                    if (added) {
                        try {
                            var fso = createCOMObj("Scripting.FileSystemObject");
                            if (fso && fso.FileExists(tmpPath)) fso.DeleteFile(tmpPath);
                        } catch (e) {}
                    }
                }

                // 方案C：直接传 dataURL
                if (!added) {
                    try { added = sheet.Shapes.AddPicture2(dataUrl, true, true, left, top, -1, -1); } catch (e) {}
                }
                if (!added) {
                    try { added = sheet.Shapes.AddPicture(dataUrl, true, true, left, top, -1, -1); } catch (e) {}
                }

                if (added) {
                    setStorage(EXPORT_STATUS_KEY, JSON.stringify({ ok: true, msg: "图片已插入到 " + addr }));
                    setStatus("图片已插入到 " + addr + (fileWritten ? "（文件方式）" : "（dataURL方式）"), "ok");
                } else {
                    var msg = "图片插入失败，所有方案均不可用。诊断信息：" + diag.join(" | ");
                    msg += "。建议：(1) 右键图表 → 图片另存为到本地；(2) 在 WPS 表格中 菜单→插入→图片 选择刚才保存的文件。";
                    setStorage(EXPORT_STATUS_KEY, JSON.stringify({ ok: false, msg: msg }));
                    setStatus(msg, "fail");
                }
            }
        } catch (e) {
            setStorage(EXPORT_STATUS_KEY, JSON.stringify({ ok: false, msg: "图片插入表格失败：" + e.message }));
            setStatus("图片插入表格失败：" + e.message, "fail");
        }
    }

    // canvas toBlob Promise 包装
    function awaitableToBlob(canvas) {
        return new Promise(function (resolve, reject) {
            try {
                canvas.toBlob(function (b) {
                    if (b) resolve(b); else reject(new Error("toBlob 返回空"));
                }, "image/png");
            } catch (e) { reject(e); }
        });
    }

    function closeSelf() {
        // 回写最后配置，便于 TaskPane 同步
        if (currentConfig) {
            try { setStorage(LAST_CONFIG_KEY, JSON.stringify(currentConfig)); } catch (e) {}
        }
        setStorage("echarts_dialog_opened", "");
        setStorage("echarts_dialog_id", ""); // 清除 floating taskpane id
        stopPolling();
        if (chart) { try { chart.dispose(); } catch (e) {} chart = null; }
        try { window.close(); } catch (e) {}
    }

    function refresh() {
        if (!currentConfig) { setStatus("尚无配置可刷新", "warn"); return; }
        // 重新读最新数据并重新构建 option
        applyConfig(currentConfig);
    }

    // ===================== 入口 =====================
    function init() {
        // 输出诊断信息：环境是否就绪
        var diag = [];
        diag.push("echarts=" + (typeof echarts !== "undefined" ? "OK" : "❌"));
        diag.push("App=" + (typeof window.Application !== "undefined" ? "OK" : "❌"));
        diag.push("ETP=" + (typeof EChartsTaskPane !== "undefined" ? "OK" : "❌"));
        setInfo("环境：" + diag.join(" "));
        setStatus("预览窗口已就绪 [" + diag.join(" | ") + "]", "");
        console.log("[Dialog] init diag: " + diag.join(", "));

        // 立即渲染 demo 图，确认 echarts 工作
        renderDemo();

        startPolling();

        if (typeof window.Application === "undefined") {
            setStatus("当前非 WPS 对话框环境（调试模式），图片导出/插入表格功能不可用。", "warn");
        }
        window.addEventListener("beforeunload", function () {
            try {
                if (currentConfig) setStorage(LAST_CONFIG_KEY, JSON.stringify(currentConfig));
                setStorage("echarts_dialog_opened", "");
                setStorage("echarts_dialog_id", "");
                stopPolling();
                if (chart) { try { chart.dispose(); } catch (e) {} chart = null; }
            } catch (e) {}
        });
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        init();
    } else {
        document.addEventListener("DOMContentLoaded", init);
    }

    return {
        refresh: refresh,
        exportLocal: function () { exportLocal(2, "#fff"); },
        exportToSheet: function () { exportToSheet(2, "#fff"); },
        closeSelf: closeSelf
    };
})();
