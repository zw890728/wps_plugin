// EChartsTaskPane.js
// TaskPane 多 Tab 配置 + 数据读取 + 19 种图表 build + 通信 + 配置存取 + 历史
// 与 EChartsDialog.js 通过 window.Application.PluginStorage "echarts_config" 通信

var EChartsTaskPane = (function () {
    // ===================== 常量与状态 =====================
    var STORAGE_KEY = "echarts_config";
    var DIALOG_OPENED_KEY = "echarts_dialog_opened";
    var HISTORY_KEY = "echarts_history";
    var EXPORT_REQUEST_KEY = "echarts_export_request";
    var EXPORT_STATUS_KEY = "echarts_export_status";
    var MAX_HISTORY = 5;
    var MAX_CELL_LEN = 32000; // 单格字符安全上限（WPS 单元格上限 ~32767）

    // 配色方案
    var COLOR_THEMES = {
        default: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
        warm:    ['#dd6b66', '#759aa0', '#e69d87', '#8dc1a9', '#ea7ccc', '#f7b94a', '#73c0de', '#5ab1ef', '#fc8452'],
        cool:    ['#5ab1ef', '#0ab6bf', '#67e0e3', '#a0d2eb', '#c4ebad', '#ffdb5c', '#f17171', '#6dc8ec', '#6495ed'],
        retro:   ['#5f8f9e', '#70c1b3', '#f3a712', '#a06cd5', '#6a4c93', '#8a6d3b', '#b07b9e', '#5c809e', '#9b1d20'],
        dark:    ['#51689b', '#ce5c52', '#f6c846', '#89c3eb', '#94d82d', '#fc8452', '#b6b6b6', '#9a60b4', '#ef9b50']
    };

    // 当前状态（配置）
    var state = {
        dataMode: "selection",         // selection / address / inputbox
        dataAddr: "",
        layout: "seriesInCol",         // seriesInCol / seriesInRow / matrix / relational
        hasHeader: true,
        chartType: "bar",
        commonOpts: getDefaultCommonOpts(),
        specificOpts: {},              // 由 SPECIFIC_OPTS[chartType] 决定
        currentData: null              // 已读取的二维数组
    };

    // ===================== 默认值 =====================
    function getDefaultCommonOpts() {
        return {
            titleText: "",
            subtitleText: "",
            titleLeft: "left",
            titleTop: "top",
            legendShow: true,
            legendLeft: "right",
            legendTop: "top",
            legendOrient: "horizontal",
            xAxisName: "",
            yAxisName: "",
            xAxisType: "category",
            yAxisType: "value",
            xAxisInverse: false,
            showGrid: true,
            dualYAxis: false,
            colorTheme: "default",
            gradient: false,
            borderRadius: 4,
            opacity: 1,
            labelShow: false,
            labelPosition: "top",
            animation: true,
            animationDuration: 1000,
            toolbox: true,
            dataZoom: false,
            tooltipShow: true,
            tooltipTrigger: "auto",    // auto / item / axis / none
            emphasis: true,
            selectedMode: false
        };
    }

    // ===================== 图表注册表 =====================
    var CHART_TYPES = {
        "基础统计": {
            bar:           { desc: "柱状图：用柱子高度表示数值大小", layout: ["seriesInCol","seriesInRow"], build: buildBar },
            line:          { desc: "折线图：观察数值随类目变化的趋势", layout: ["seriesInCol","seriesInRow"], build: buildLine },
            pie:           { desc: "饼图：占比构成", layout: ["seriesInCol","seriesInRow"], build: buildPie },
            scatter:       { desc: "散点图：观察两变量关系", layout: ["seriesInCol","seriesInRow","matrix"], build: buildScatter },
            effectScatter: { desc: "涟漪散点图：突出显示的点", layout: ["seriesInCol","seriesInRow","matrix"], build: buildEffectScatter }
        },
        "高级统计": {
            boxplot:       { desc: "箱线图：四分位与异常点", layout: ["seriesInCol","seriesInRow"], build: buildBoxplot },
            candlestick:   { desc: "K 线图：开盘/收盘/最高/最低", layout: ["seriesInCol","seriesInRow"], build: buildCandlestick },
            parallel:      { desc: "平行坐标图：多维数据对比", layout: ["seriesInCol","seriesInRow"], build: buildParallel },
            themeRiver:    { desc: "主题河流图：随时间演化的多类目流", layout: ["matrix"], build: buildThemeRiver }
        },
        "关系与层次": {
            graph:         { desc: "关系图：节点与连线", layout: ["relational"], build: buildGraph },
            tree:          { desc: "树图：层次结构", layout: ["relational"], build: buildTree },
            treemap:       { desc: "矩形树图：占比层次", layout: ["relational"], build: buildTreemap },
            sunburst:      { desc: "旭日图：层次占比", layout: ["relational"], build: buildSunburst },
            sankey:        { desc: "桑基图：流量关系", layout: ["relational"], build: buildSankey }
        },
        "地理空间": {
            map:           { desc: "中国地图：省份分布", layout: ["seriesInCol","seriesInRow"], build: buildMap },
            lines:         { desc: "迁徙线图：地理连线", layout: ["relational"], build: buildLines },
            heatmap:       { desc: "热力图：密度可视化", layout: ["matrix"], build: buildHeatmap }
        },
        "形态化装饰": {
            radar:         { desc: "雷达图：多维能力对比", layout: ["seriesInCol","seriesInRow"], build: buildRadar },
            funnel:        { desc: "漏斗图：转化流程", layout: ["seriesInCol","seriesInRow"], build: buildFunnel },
            gauge:         { desc: "仪表盘：进度/指标", layout: ["seriesInCol","seriesInRow"], build: buildGauge },
            pictorialBar:  { desc: "象形柱图：图形化柱状", layout: ["seriesInCol","seriesInRow"], build: buildPictorialBar }
        },
        "时序日历": {
            calendar:      { desc: "日历热力图：按日历着色", layout: ["matrix"], build: buildCalendar }
        }
    };

    // ===================== 专属选项 Schema =====================
    var SPECIFIC_OPTS = {
        bar: [
            { key: "stack", label: "堆叠", type: "checkbox", default: false, hint: "多条柱叠加成一摞" },
            { key: "horizontal", label: "水平条形图", type: "checkbox", default: false, hint: "横着画（柱子躺倒）" },
            { key: "barWidth", label: "条宽(%)", type: "number", default: "", min: 1, max: 100, hint: "柱子宽度占比" }
        ],
        line: [
            { key: "smooth", label: "平滑曲线", type: "checkbox", default: false, hint: "折线变成贝塞尔曲线" },
            { key: "area", label: "面积填充", type: "checkbox", default: false, hint: "折线下方填色" },
            { key: "step", label: "阶梯", type: "checkbox", default: false, hint: "折线变成阶梯状" },
            { key: "showSymbol", label: "显示数据点", type: "checkbox", default: true, hint: "线上是否画圆点" },
            { key: "lineType", label: "线型", type: "select", default: "solid", options: ["solid","dashed","dotted"], hint: "实线/虚线/点线" }
        ],
        pie: [
            { key: "innerRadius", label: "内径(0~100)", type: "number", default: 0, min: 0, max: 95, hint: "0=饼图，>0=环图" },
            { key: "roseType", label: "玫瑰图", type: "select", default: "off", options: ["off","radius","area"], hint: "off=普通，radius=半径渐变，area=面积渐变" },
            { key: "centerX", label: "中心X(%)", type: "number", default: 50, min: 0, max: 100 },
            { key: "centerY", label: "中心Y(%)", type: "number", default: 50, min: 0, max: 100 }
        ],
        scatter: [
            { key: "symbolSize", label: "点大小", type: "number", default: 10, min: 1, max: 80, hint: "散点的直径" }
        ],
        effectScatter: [
            { key: "symbolSize", label: "点大小", type: "number", default: 12, min: 1, max: 80 },
            { key: "rippleScale", label: "涟漪倍数", type: "number", default: 3, min: 1, max: 10 }
        ],
        radar: [
            { key: "shape", label: "形状", type: "select", default: "polygon", options: ["polygon","circle"], hint: "多边形或圆形" },
            { key: "area", label: "面积填充", type: "checkbox", default: false },
            { key: "maxValue", label: "最大值(留空自动)", type: "number", default: "" }
        ],
        funnel: [
            { key: "sort", label: "排序", type: "select", default: "descending", options: ["descending","ascending","none"], hint: "从大到小/从小到大/原序" },
            { key: "align", label: "对齐", type: "select", default: "center", options: ["left","center","right"] }
        ],
        gauge: [
            { key: "maxValue", label: "最大值", type: "number", default: 100 },
            { key: "progressWidth", label: "进度条宽", type: "number", default: 14, min: 2, max: 60 }
        ],
        boxplot: [
            { key: "showOutlier", label: "显示异常点", type: "checkbox", default: true }
        ],
        candlestick: [
            { key: "upColor", label: "涨色", type: "select", default: "#ec0000", options: ["#ec0000","#ff0000","#e6550d","#ff7f0e"] },
            { key: "downColor", label: "跌色", type: "select", default: "#00da3c", options: ["#00da3c","#00aa00","#2ca02c","#31a354"] }
        ],
        graph: [
            { key: "layout", label: "布局", type: "select", default: "force", options: ["force","circular"] },
            { key: "nodeSize", label: "节点大小", type: "number", default: 20, min: 4, max: 100 },
            { key: "lineWidth", label: "连线宽", type: "number", default: 1, min: 0.1, max: 10 }
        ],
        tree: [
            { key: "orient", label: "布局方向", type: "select", default: "orthogonal", options: ["orthogonal","radial"], hint: "正交/径向" },
            { key: "leafLabel", label: "显示叶子标签", type: "checkbox", default: true }
        ],
        treemap: [
            { key: "roam", label: "可缩放", type: "checkbox", default: false },
            { key: "leafLabel", label: "叶子标签", type: "checkbox", default: true }
        ],
        sunburst: [
            { key: "innerRadius", label: "内径(%)", type: "number", default: 0, min: 0, max: 80 },
            { key: "labelRotate", label: "标签旋转", type: "select", default: "tangential", options: ["tangential","radial","none"] }
        ],
        sankey: [
            { key: "nodeWidth", label: "节点宽", type: "number", default: 20, min: 4, max: 80 },
            { key: "nodeGap", label: "节点间距", type: "number", default: 8, min: 0, max: 50 },
            { key: "lineCurveness", label: "连线弯曲", type: "number", default: 0.5, min: 0, max: 1 }
        ],
        heatmap: [
            { key: "minValue", label: "最小值", type: "number", default: "" },
            { key: "maxValue", label: "最大值", type: "number", default: "" }
        ],
        parallel: [
            { key: "axisStyle", label: "轴线样式", type: "select", default: "line", options: ["line","dashed"] }
        ],
        themeRiver: [
            { key: "colorByCategory", label: "按类目着色", type: "checkbox", default: true }
        ],
        map: [
            { key: "mapName", label: "地图名", type: "select", default: "china", options: ["china"] },
            { key: "visualMin", label: "视觉最小值", type: "number", default: "" },
            { key: "visualMax", label: "视觉最大值", type: "number", default: "" }
        ],
        lines: [
            { key: "effect", label: "特效", type: "select", default: "arrow", options: ["arrow","train","none"], hint: "箭头/火车/无" },
            { key: "curveness", label: "线曲度", type: "number", default: 0.2, min: 0, max: 1 }
        ],
        pictorialBar: [
            { key: "symbol", label: "象形", type: "select", default: "rect", options: ["rect","roundRect","triangle","diamond","pin","arrow"] },
            { key: "stack", label: "堆叠", type: "checkbox", default: false }
        ],
        calendar: [
            { key: "yearRange", label: "年份", type: "text", default: "", hint: "如 2024 或 2023,2024" },
            { key: "cellSize", label: "单元格宽", type: "number", default: 16, min: 4, max: 50 }
        ]
    };

    // ===================== 数据读取 =====================
    // 整行/整列选择时截取到 UsedRange，避免读取百万行/列导致卡顿
    function trimToUsedRange(app, rng) {
        try {
            var ws = rng.Worksheet || rng.Parent;
            if (!ws) return rng;
            var isFullCol = rng.Rows.Count >= ws.Rows.Count;
            var isFullRow = rng.Columns.Count >= ws.Columns.Count;
            if (!isFullCol && !isFullRow) return rng; // 非整行/整列，原样返回
            var used = ws.UsedRange;
            if (!used) return rng;
            // 优先用 Intersect 求交
            try {
                var inter = app.Intersect(rng, used);
                if (inter) return inter;
            } catch (e) {}
            // 回退：按 UsedRange 的行/列范围手动重建
            var ur1 = used.Row, ur2 = used.Row + used.Rows.Count - 1;
            var uc1 = used.Column, uc2 = used.Column + used.Columns.Count - 1;
            var r1, r2, c1, c2;
            if (isFullCol && !isFullRow) {
                r1 = ur1; r2 = ur2;
                c1 = rng.Column; c2 = rng.Column + rng.Columns.Count - 1;
            } else if (isFullRow && !isFullCol) {
                r1 = rng.Row; r2 = rng.Row + rng.Rows.Count - 1;
                c1 = uc1; c2 = uc2;
            } else {
                r1 = ur1; r2 = ur2; c1 = uc1; c2 = uc2;
            }
            return ws.Range(ws.Cells(r1, c1), ws.Cells(r2, c2));
        } catch (e) {
            return rng;
        }
    }

    // 读取 Range 对象的 Value2 并归一化为二维数组
    function readRangeValue(rng) {
        var v;
        try { v = rng.Value2; }
        catch (e) { throw new Error("读取区域失败：" + e.message); }
        // 单值 / 一维 / 二维
        if (!Array.isArray(v)) return [[v]];
        if (v.length === 0) return [[]];
        if (!Array.isArray(v[0])) return [v];
        return v;
    }

    // 多区域智能拼接：各区域起始行相同 → 横向并排；否则 → 纵向堆叠
    function concatAreas(blocks, metas) {
        if (blocks.length === 0) return [[]];
        if (blocks.length === 1) return blocks[0];
        // 判断方向：全部起始行相同视为横向并排
        var horiz = true, r0 = metas[0].row;
        for (var i = 1; i < metas.length; i++) {
            if (metas[i].row !== r0) { horiz = false; break; }
        }
        if (horiz) {
            // 横向：按最大行数对齐，缺失补 null
            var maxH = 0, widths = [];
            for (var a = 0; a < blocks.length; a++) {
                if (blocks[a].length > maxH) maxH = blocks[a].length;
                var w = 0;
                for (var rr = 0; rr < blocks[a].length; rr++) {
                    if (blocks[a][rr].length > w) w = blocks[a][rr].length;
                }
                widths.push(w);
            }
            var out = [];
            for (var r = 0; r < maxH; r++) {
                var line = [];
                for (var k = 0; k < blocks.length; k++) {
                    var row = blocks[k][r];
                    if (row) {
                        for (var c = 0; c < row.length; c++) line.push(row[c]);
                        for (var c2 = row.length; c2 < widths[k]; c2++) line.push(null);
                    } else {
                        for (var c3 = 0; c3 < widths[k]; c3++) line.push(null);
                    }
                }
                out.push(line);
            }
            return out;
        }
        // 纵向：按最大列数对齐，缺失补 null
        var maxW = 0;
        for (var b = 0; b < blocks.length; b++) {
            var w2 = (blocks[b][0] || []).length;
            if (w2 > maxW) maxW = w2;
        }
        var merged = [];
        for (var m = 0; m < blocks.length; m++) {
            for (var r3 = 0; r3 < blocks[m].length; r3++) {
                var src = blocks[m][r3];
                if (src.length >= maxW) merged.push(src);
                else { var dst = src.slice(); while (dst.length < maxW) dst.push(null); merged.push(dst); }
            }
        }
        return merged;
    }

    // 读取单个连续区域为二维数组（按地址）
    function readSingleRange(addr) {
        var app = window.Application;
        var rng;
        try { rng = app.Range(addr); }
        catch (e) { throw new Error("区域地址无效：" + addr + " - " + e.message); }
        rng = trimToUsedRange(app, rng);
        return readRangeValue(rng);
    }

    function readRangeData(addr) {
        var app = window.Application;
        if (!app || !app.Range) throw new Error("无法访问 WPS Application.Range（非 WPS 环境）");
        var rng = null;
        try { rng = app.Range(addr); } catch (e) { rng = null; }
        // 优先通过 .Areas 集合处理多区域（无需解析地址字符串）
        if (rng) {
            var areaCount = 1;
            try { if (rng.Areas) areaCount = rng.Areas.Count || 1; } catch (e) { areaCount = 1; }
            if (areaCount > 1) {
                var blocks = [], metas = [];
                for (var i = 1; i <= areaCount; i++) {
                    var a = null;
                    try { a = rng.Areas.Item(i); } catch (e) { a = null; }
                    if (!a) continue;
                    a = trimToUsedRange(app, a);
                    blocks.push(readRangeValue(a));
                    try { metas.push({ row: a.Row, rows: a.Rows.Count }); }
                    catch (e) { metas.push({ row: i, rows: 0 }); }
                }
                if (blocks.length > 1) return concatAreas(blocks, metas);
                if (blocks.length === 1) return blocks[0];
                return [[]];
            }
            rng = trimToUsedRange(app, rng);
            return readRangeValue(rng);
        }
        // 回退：按逗号拆分地址逐个读取并纵向堆叠
        if (addr && addr.indexOf(",") !== -1) {
            var parts = addr.split(",");
            var blocks2 = [];
            for (var k = 0; k < parts.length; k++) {
                var p = parts[k].trim();
                if (!p) continue;
                try { blocks2.push(readSingleRange(p)); } catch (e) {}
            }
            if (blocks2.length > 1) {
                var merged2 = [];
                for (var m2 = 0; m2 < blocks2.length; m2++) {
                    for (var r4 = 0; r4 < blocks2[m2].length; r4++) merged2.push(blocks2[m2][r4]);
                }
                return merged2;
            }
            if (blocks2.length === 1) return blocks2[0];
        }
        throw new Error("区域地址无效：" + addr);
    }

    function getCurrentSelectionAddr() {
        var app = window.Application;
        try {
            var sel = app.Selection;
            if (!sel || !sel.Address) return "";
            return sel.Address(true, true, undefined, true);
        } catch (e) { return ""; }
    }

    function pickRangeByInputBox(prompt) {
        var app = window.Application;
        if (!app || !app.InputBox) { alert("InputBox 不可用"); return ""; }
        try {
            var r = app.InputBox(prompt || "请选择区域：", "选择区域", "", undefined, undefined, undefined, undefined, 8);
            if (r && r.Address) return r.Address(true, true, undefined, true);
            return "";
        } catch (e) { return ""; }
    }

    // 数据规范化：null / 空字符串 / 错误值统一处理
    function cleanCell(v) {
        if (v === undefined || v === null || v === "") return null;
        if (typeof v === "string") {
            var s = v.trim();
            if (s === "") return null;
            // 错误值
            if (/^#[A-Z/_0-9!?]+$/.test(s)) return null;
            return s;
        }
        return v; // number / Date
    }

    function cleanMatrix(data) {
        if (!Array.isArray(data)) return [];
        return data.map(function (row) {
            if (!Array.isArray(row)) return [cleanCell(row)];
            return row.map(cleanCell);
        });
    }

    // ===================== 数据 → series 工具 =====================
    // 把二维矩阵按 seriesInCol 拆解为 {categories, series:[{name, data}]}
    function splitSeriesInCol(data, hasHeader) {
        if (!data || data.length === 0) return { categories: [], series: [] };
        var rows = data.length;
        var cols = data[0].length;
        if (cols < 2) return { categories: data.map(function (r) { return r[0]; }), series: [] };

        var categories = [];
        var seriesNames = [];
        for (var c = 1; c < cols; c++) seriesNames.push("series" + c);

        var startRow = 0;
        if (hasHeader) {
            var firstRow = data[0];
            for (var c2 = 1; c2 < cols; c2++) {
                if (firstRow[c2] !== undefined && firstRow[c2] !== null && firstRow[c2] !== "") {
                    seriesNames[c2 - 1] = String(firstRow[c2]);
                }
            }
            startRow = 1;
        }
        for (var r = startRow; r < rows; r++) {
            categories.push(data[r][0]);
        }
        var series = [];
        for (var c3 = 1; c3 < cols; c3++) {
            var arr = [];
            for (var r2 = startRow; r2 < rows; r2++) {
                arr.push(data[r2][c3]);
            }
            series.push({ name: seriesNames[c3 - 1], data: arr });
        }
        return { categories: categories, series: series };
    }

    // 把二维矩阵按 seriesInRow 拆解（行列互换思路）
    function splitSeriesInRow(data, hasHeader) {
        if (!data || data.length === 0) return { categories: [], series: [] };
        // 转置后复用 splitSeriesInCol
        var transposed = transpose(data);
        return splitSeriesInCol(transposed, hasHeader);
    }

    function transpose(data) {
        if (!data || data.length === 0) return [];
        var cols = data[0].length;
        var out = [];
        for (var c = 0; c < cols; c++) {
            var row = [];
            for (var r = 0; r < data.length; r++) row.push(data[r][c]);
            out.push(row);
        }
        return out;
    }

    // 二维矩阵（x,y,value 三列）
    function splitMatrix(data) {
        if (!data || data.length === 0) return { x: [], y: [], values: [], xSet: [], ySet: [] };
        var xSet = [], ySet = [];
        var xs = [], ys = [], vs = [];
        var xMap = {}, yMap = {};
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            if (!row || row.length < 3) continue;
            var x = row[0], y = row[1], v = row[2];
            if (x === null || y === null) continue;
            xs.push(x); ys.push(y); vs.push(Number(v) || 0);
            if (!xMap[String(x)]) { xMap[String(x)] = true; xSet.push(x); }
            if (!yMap[String(y)]) { yMap[String(y)] = true; ySet.push(y); }
        }
        return { x: xs, y: ys, values: vs, xSet: xSet, ySet: ySet };
    }

    // 关系三列 source|target|value 或 name|parent|value
    function splitRelational(data) {
        if (!data || data.length === 0) return { sources: [], targets: [], values: [], nodes: [], links: [] };
        var srcs = [], tgts = [], vals = [];
        var nodeMap = {};
        var nodes = [];
        var links = [];
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            if (!row || row.length < 2) continue;
            var s = row[0], t = row[1], v = row.length >= 3 ? Number(row[2]) : 1;
            if (s === null || t === null) continue;
            srcs.push(s); tgts.push(t); vals.push(v);
            if (!nodeMap[String(s)]) { nodeMap[String(s)] = true; nodes.push({ name: String(s) }); }
            if (!nodeMap[String(t)]) { nodeMap[String(t)] = true; nodes.push({ name: String(t) }); }
            links.push({ source: String(s), target: String(t), value: v });
        }
        return { sources: srcs, targets: tgts, values: vals, nodes: nodes, links: links };
    }

    // 由关系边列表构建层级树：叶子节点必须赋 value，否则 ECharts 按默认 0 渲染导致扇形不可见
    function buildTreeFromRelational(rel) {
        var nodeMap = {};
        rel.nodes.forEach(function (n) { nodeMap[n.name] = { name: n.name, children: [] }; });
        var isSource = {};
        rel.links.forEach(function (l) {
            isSource[l.source] = true;
            if (nodeMap[l.source] && nodeMap[l.target]) {
                nodeMap[l.source].children.push(nodeMap[l.target]);
            }
        });
        // 叶子（非 source）取入边 value；内部节点不赋值，由 ECharts 按子节点求和
        rel.links.forEach(function (l) {
            if (!isSource[l.target] && nodeMap[l.target]) {
                nodeMap[l.target].value = (nodeMap[l.target].value || 0) + l.value;
            }
        });
        var isChild = {};
        rel.links.forEach(function (l) { isChild[l.target] = true; });
        return rel.nodes.filter(function (n) { return !isChild[n.name]; }).map(function (n) { return nodeMap[n.name]; });
    }

    // ===================== 通用 option 构造器 =====================
    function buildCommonBase(commonOpts, chartType) {
        var base = {
            color: COLOR_THEMES[commonOpts.colorTheme] || COLOR_THEMES.default,
            title: {
                text: commonOpts.titleText,
                subtext: commonOpts.subtitleText,
                left: commonOpts.titleLeft,
                top: commonOpts.titleTop
            },
            tooltip: {
                show: commonOpts.tooltipShow,
                trigger: commonOpts.tooltipTrigger === "auto" ? guessTooltipTrigger(chartType) : commonOpts.tooltipTrigger
            },
            legend: {
                show: commonOpts.legendShow,
                left: commonOpts.legendLeft,
                top: commonOpts.legendTop,
                orient: commonOpts.legendOrient
            },
            animation: commonOpts.animation,
            animationDuration: commonOpts.animationDuration
        };
        if (commonOpts.toolbox) {
            base.toolbox = {
                right: 10,
                feature: {
                    saveAsImage: {},
                    restore: {},
                    dataView: {},
                    refresh: {}
                }
            };
        }
        if (commonOpts.dataZoom) {
            base.dataZoom = [{ type: "slider" }, { type: "inside" }];
        }
        return base;
    }

    function guessTooltipTrigger(chartType) {
        if (["pie","radar","funnel","gauge","treemap","sunburst","sankey","graph","tree","map"].indexOf(chartType) >= 0) return "item";
        return "axis";
    }

    function applyCommonAxis(base, commonOpts) {
        base.xAxis = {
            name: commonOpts.xAxisName,
            type: commonOpts.xAxisType,
            inverse: commonOpts.xAxisInverse,
            splitLine: { show: commonOpts.showGrid }
        };
        base.yAxis = {
            name: commonOpts.yAxisName,
            type: commonOpts.yAxisType,
            splitLine: { show: commonOpts.showGrid }
        };
    }

    function applyLabelStyle(seriesItem, commonOpts) {
        if (commonOpts.labelShow) {
            seriesItem.label = { show: true, position: commonOpts.labelPosition };
        }
        if (commonOpts.borderRadius && (seriesItem.type === "bar" || seriesItem.type === "pictorialBar")) {
            seriesItem.itemStyle = seriesItem.itemStyle || {};
            seriesItem.itemStyle.borderRadius = commonOpts.borderRadius;
        }
        if (commonOpts.opacity !== 1) {
            seriesItem.itemStyle = seriesItem.itemStyle || {};
            seriesItem.itemStyle.opacity = commonOpts.opacity;
        }
        if (commonOpts.gradient) {
            seriesItem.itemStyle = seriesItem.itemStyle || {};
            // 渐变在 build 函数里按需覆写
        }
        return seriesItem;
    }

    // ===================== 19 种图表 build 函数 =====================

    function buildBar(data, layout, commonOpts, specificOpts) {
        var sp = splitByLayout(data, layout, commonOpts.hasHeader);
        var base = buildCommonBase(commonOpts, "bar");
        var horizontal = !!(specificOpts && specificOpts.horizontal);
        var isHorizontal = horizontal;
        var catAxis = isHorizontal ? "yAxis" : "xAxis";
        var valAxis = isHorizontal ? "xAxis" : "yAxis";
        base[catAxis] = {
            type: "category",
            data: sp.categories,
            name: isHorizontal ? commonOpts.yAxisName : commonOpts.xAxisName,
            inverse: isHorizontal ? false : commonOpts.xAxisInverse,
            splitLine: { show: commonOpts.showGrid }
        };
        base[valAxis] = {
            type: "value",
            name: isHorizontal ? commonOpts.xAxisName : commonOpts.yAxisName,
            splitLine: { show: commonOpts.showGrid }
        };
        base.series = sp.series.map(function (s) {
            var item = { type: "bar", name: s.name, data: s.data };
            if (specificOpts && specificOpts.stack) item.stack = "total";
            if (specificOpts && specificOpts.barWidth) item.barWidth = String(specificOpts.barWidth) + "%";
            if (commonOpts.gradient) {
                item.itemStyle = { color: buildLinearGradient(commonOpts.colorTheme) };
            }
            return applyLabelStyle(item, commonOpts);
        });
        return base;
    }

    function buildLine(data, layout, commonOpts, specificOpts) {
        var sp = splitByLayout(data, layout, commonOpts.hasHeader);
        var base = buildCommonBase(commonOpts, "line");
        applyCommonAxis(base, commonOpts);
        base.xAxis.data = sp.categories;
        base.series = sp.series.map(function (s) {
            var item = { type: "line", name: s.name, data: s.data };
            if (specificOpts) {
                if (specificOpts.smooth) item.smooth = true;
                if (specificOpts.area) item.areaStyle = {};
                if (specificOpts.step) item.step = "end";
                if (specificOpts.showSymbol === false) item.showSymbol = false;
                if (specificOpts.lineType) item.lineStyle = { type: specificOpts.lineType };
            }
            return applyLabelStyle(item, commonOpts);
        });
        return base;
    }

    function buildPie(data, layout, commonOpts, specificOpts) {
        var sp = splitByLayout(data, layout, commonOpts.hasHeader);
        // 用第一个 series 做饼图
        var firstSeries = sp.series[0] || { name: "", data: [] };
        var pieData = firstSeries.data.map(function (v, i) {
            return { name: String(sp.categories[i]), value: Number(v) || 0 };
        });
        var base = buildCommonBase(commonOpts, "pie");
        var ir = (specificOpts && specificOpts.innerRadius) || 0;
        var cx = (specificOpts && specificOpts.centerX != null) ? specificOpts.centerX : 50;
        var cy = (specificOpts && specificOpts.centerY != null) ? specificOpts.centerY : 50;
        base.series = [{
            type: "pie",
            radius: [ir + "%", "65%"],
            center: [cx + "%", cy + "%"],
            data: pieData,
            roseType: (specificOpts && specificOpts.roseType && specificOpts.roseType !== "off") ? specificOpts.roseType : undefined
        }];
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return applyLabelStyle(base.series[0], commonOpts), base;
    }

    function buildScatter(data, layout, commonOpts, specificOpts) {
        var base = buildCommonBase(commonOpts, "scatter");
        applyCommonAxis(base, commonOpts);
        var sp;
        if (layout === "matrix") {
            // 三列 x,y,value
            var m = splitMatrix(data);
            base.series = [{
                type: "scatter",
                data: m.values.map(function (v, i) { return [m.x[i], m.y[i], v]; }),
                symbolSize: (specificOpts && specificOpts.symbolSize) || 10
            }];
        } else {
            sp = splitByLayout(data, layout, commonOpts.hasHeader);
            base.series = sp.series.map(function (s) {
                return {
                    type: "scatter",
                    name: s.name,
                    data: s.data.map(function (v, i) { return [i, v]; }),
                    symbolSize: (specificOpts && specificOpts.symbolSize) || 10
                };
            });
        }
        return base;
    }

    function buildEffectScatter(data, layout, commonOpts, specificOpts) {
        var base = buildScatter(data, layout, commonOpts, { symbolSize: (specificOpts && specificOpts.symbolSize) || 12 });
        base.series.forEach(function (s) {
            s.type = "effectScatter";
            s.rippleEffect = { scale: (specificOpts && specificOpts.rippleScale) || 3 };
        });
        return base;
    }

    function buildRadar(data, layout, commonOpts, specificOpts) {
        var sp = splitByLayout(data, layout, commonOpts.hasHeader);
        var indicators = sp.categories.map(function (c) {
            return { name: String(c), max: (specificOpts && specificOpts.maxValue) || undefined };
        });
        var base = buildCommonBase(commonOpts, "radar");
        base.radar = {
            indicator: indicators,
            shape: (specificOpts && specificOpts.shape) || "polygon"
        };
        base.series = [{
            type: "radar",
            data: sp.series.map(function (s) {
                return { name: s.name, value: s.data, areaStyle: (specificOpts && specificOpts.area) ? {} : undefined };
            })
        }];
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildFunnel(data, layout, commonOpts, specificOpts) {
        var sp = splitByLayout(data, layout, commonOpts.hasHeader);
        var first = sp.series[0] || { data: [] };
        var fData = first.data.map(function (v, i) { return { name: String(sp.categories[i]), value: Number(v) || 0 }; });
        var base = buildCommonBase(commonOpts, "funnel");
        base.series = [{
            type: "funnel",
            data: fData,
            sort: (specificOpts && specificOpts.sort) || "descending",
            align: (specificOpts && specificOpts.align) || "center"
        }];
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildGauge(data, layout, commonOpts, specificOpts) {
        var sp = splitByLayout(data, layout, commonOpts.hasHeader);
        var first = sp.series[0] || { data: [] };
        var base = buildCommonBase(commonOpts, "gauge");
        base.series = [{
            type: "gauge",
            max: (specificOpts && specificOpts.maxValue) || 100,
            progress: { show: true, width: (specificOpts && specificOpts.progressWidth) || 14 },
            data: first.data.map(function (v, i) { return { name: String(sp.categories[i] || ("指标" + (i+1))), value: Number(v) || 0 }; })
        }];
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildBoxplot(data, layout, commonOpts, specificOpts) {
        var sp = splitByLayout(data, layout, commonOpts.hasHeader);
        // 简化：把每个 series 当作一组数据，计算 5 数 + 异常点
        var cats = sp.categories;
        var boxData = sp.series.map(function (s) {
            var nums = (s.data || []).map(Number).filter(function (x) { return !isNaN(x); }).sort(function (a, b) { return a - b; });
            return calcBoxStats(nums);
        });
        var base = buildCommonBase(commonOpts, "boxplot");
        applyCommonAxis(base, commonOpts);
        base.xAxis.data = cats;
        base.series = [{
            type: "boxplot",
            data: boxData.map(function (b) { return b.five; })
        }];
        if (specificOpts && specificOpts.showOutlier) {
            base.series.push({
                type: "scatter",
                data: boxData.reduce(function (acc, b, idx) {
                    (b.outliers || []).forEach(function (o) { acc.push([idx, o]); });
                    return acc;
                }, [])
            });
        }
        return base;
    }

    function calcBoxStats(nums) {
        if (!nums || nums.length === 0) return { five: [0,0,0,0,0], outliers: [] };
        var n = nums.length;
        function quantile(p) {
            var idx = (n - 1) * p;
            var lo = Math.floor(idx), hi = Math.ceil(idx);
            if (lo === hi) return nums[lo];
            return nums[lo] * (hi - idx) + nums[hi] * (idx - lo);
        }
        var q1 = quantile(0.25), q2 = quantile(0.5), q3 = quantile(0.75);
        var iqr = q3 - q1;
        var lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
        var inRange = nums.filter(function (x) { return x >= lo && x <= hi; });
        var min = inRange[0], max = inRange[inRange.length - 1];
        var outliers = nums.filter(function (x) { return x < lo || x > hi; });
        return { five: [min, q1, q2, q3, max], outliers: outliers };
    }

    function buildCandlestick(data, layout, commonOpts, specificOpts) {
        var sp = splitByLayout(data, layout, commonOpts.hasHeader);
        var cats = sp.categories;
        // candlestick 每条数据需要 [open, close, low, high]
        // 我们约定：4 个 series 分别为 open,close,low,high（顺序）
        var s0 = (sp.series[0] || { data: [] }).data;
        var s1 = (sp.series[1] || { data: [] }).data;
        var s2 = (sp.series[2] || { data: [] }).data;
        var s3 = (sp.series[3] || { data: [] }).data;
        var cdata = cats.map(function (_, i) {
            return [Number(s0[i]) || 0, Number(s1[i]) || 0, Number(s2[i]) || 0, Number(s3[i]) || 0];
        });
        var base = buildCommonBase(commonOpts, "candlestick");
        applyCommonAxis(base, commonOpts);
        base.xAxis.data = cats;
        base.series = [{
            type: "candlestick",
            data: cdata,
            itemStyle: {
                color: (specificOpts && specificOpts.upColor) || "#ec0000",
                color0: (specificOpts && specificOpts.downColor) || "#00da3c",
                borderColor: (specificOpts && specificOpts.upColor) || "#ec0000",
                borderColor0: (specificOpts && specificOpts.downColor) || "#00da3c"
            }
        }];
        return base;
    }

    function buildParallel(data, layout, commonOpts, specificOpts) {
        var sp = splitByLayout(data, layout, commonOpts.hasHeader);
        var dims = sp.categories.map(function (c, i) { return { dim: i, name: String(c) }; });
        var base = buildCommonBase(commonOpts, "parallel");
        base.parallelAxis = dims;
        base.series = [{
            type: "parallel",
            data: sp.series.map(function (s) { return s.data; })
        }];
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildThemeRiver(data, layout, commonOpts, specificOpts) {
        var m = splitMatrix(data);
        // 三列：time, type, value
        var trData = [];
        for (var i = 0; i < m.x.length; i++) {
            trData.push([m.x[i], Number(m.values[i]) || 0, String(m.y[i])]);
        }
        var base = buildCommonBase(commonOpts, "themeRiver");
        base.series = [{
            type: "themeRiver",
            data: trData
        }];
        base.tooltip.trigger = "item";
        base.singleAxis = { type: "time" };
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildGraph(data, layout, commonOpts, specificOpts) {
        var rel = splitRelational(data);
        var base = buildCommonBase(commonOpts, "graph");
        base.series = [{
            type: "graph",
            layout: (specificOpts && specificOpts.layout) || "force",
            symbolSize: (specificOpts && specificOpts.nodeSize) || 20,
            lineStyle: { width: (specificOpts && specificOpts.lineWidth) || 1 },
            roam: true,
            data: rel.nodes,
            links: rel.links,
            force: { repulsion: 100 }
        }];
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildTree(data, layout, commonOpts, specificOpts) {
        // 关系数据转树：source 为父，target 为子
        var rel = splitRelational(data);
        var nodeMap = {};
        rel.nodes.forEach(function (n) { nodeMap[n.name] = { name: n.name, children: [] }; });
        rel.links.forEach(function (l) {
            if (nodeMap[l.source] && nodeMap[l.target]) {
                nodeMap[l.source].children.push(nodeMap[l.target]);
            }
        });
        // 找根节点：未被任何 target 引用过的 source
        var isChild = {};
        rel.links.forEach(function (l) { isChild[l.target] = true; });
        var roots = rel.nodes.filter(function (n) { return !isChild[n.name]; }).map(function (n) { return nodeMap[n.name]; });
        var root = roots[0] || { name: "root", children: [] };
        if (roots.length > 1) root = { name: "root", children: roots };
        var base = buildCommonBase(commonOpts, "tree");
        base.series = [{
            type: "tree",
            data: [root],
            layout: (specificOpts && specificOpts.orient) === "radial" ? "radial" : "orthogonal",
            symbolSize: 8,
            label: { show: true },
            leaves: { label: { show: (specificOpts && specificOpts.leafLabel !== false) } },
            orient: "LR",
            top: "5%", bottom: "5%", left: "10%", right: "20%"
        }];
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildTreemap(data, layout, commonOpts, specificOpts) {
        var roots = buildTreeFromRelational(splitRelational(data));
        var base = buildCommonBase(commonOpts, "treemap");
        base.series = [{
            type: "treemap",
            data: roots,
            roam: !!(specificOpts && specificOpts.roam),
            label: { show: true },
            leafDepth: 3
        }];
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildSunburst(data, layout, commonOpts, specificOpts) {
        var roots = buildTreeFromRelational(splitRelational(data));
        var base = buildCommonBase(commonOpts, "sunburst");
        base.series = [{
            type: "sunburst",
            data: roots,
            radius: [(specificOpts && specificOpts.innerRadius || 0) + "%", "90%"],
            label: { rotate: (specificOpts && specificOpts.labelRotate) || "tangential" }
        }];
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildSankey(data, layout, commonOpts, specificOpts) {
        var rel = splitRelational(data);
        var base = buildCommonBase(commonOpts, "sankey");
        base.series = [{
            type: "sankey",
            data: rel.nodes,
            links: rel.links,
            nodeWidth: (specificOpts && specificOpts.nodeWidth) || 20,
            nodeGap: (specificOpts && specificOpts.nodeGap) || 8,
            lineStyle: { curveness: (specificOpts && specificOpts.lineCurveness) || 0.5 }
        }];
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildHeatmap(data, layout, commonOpts, specificOpts) {
        var m = splitMatrix(data);
        var base = buildCommonBase(commonOpts, "heatmap");
        var allVals = m.values.map(Number).filter(function (x) { return !isNaN(x); });
        var min = (specificOpts && specificOpts.minValue != null && specificOpts.minValue !== "") ? Number(specificOpts.minValue) : (allVals.length ? Math.min.apply(null, allVals) : 0);
        var max = (specificOpts && specificOpts.maxValue != null && specificOpts.maxValue !== "") ? Number(specificOpts.maxValue) : (allVals.length ? Math.max.apply(null, allVals) : 1);
        base.tooltip = { show: true };
        base.visualMap = {
            min: min, max: max, calculable: true, orient: "horizontal", left: "center", bottom: 10
        };
        base.xAxis = { type: "category", data: m.xSet };
        base.yAxis = { type: "category", data: m.ySet };
        base.series = [{
            type: "heatmap",
            data: m.values.map(function (v, i) { return [String(m.x[i]), String(m.y[i]), Number(v) || 0]; }),
            label: { show: true }
        }];
        return base;
    }

    function buildMap(data, layout, commonOpts, specificOpts) {
        var sp = splitByLayout(data, layout, commonOpts.hasHeader);
        var first = sp.series[0] || { data: [] };
        var mapData = first.data.map(function (v, i) { return { name: String(sp.categories[i]), value: Number(v) || 0 }; });
        var allVals = mapData.map(function (d) { return d.value; });
        var min = (specificOpts && specificOpts.visualMin != null && specificOpts.visualMin !== "") ? Number(specificOpts.visualMin) : (allVals.length ? Math.min.apply(null, allVals) : 0);
        var max = (specificOpts && specificOpts.visualMax != null && specificOpts.visualMax !== "") ? Number(specificOpts.visualMax) : (allVals.length ? Math.max.apply(null, allVals) : 100);
        var base = buildCommonBase(commonOpts, "map");
        // 地图需注册（这里假设已注册 china）
        base.series = [{
            type: "map",
            map: (specificOpts && specificOpts.mapName) || "china",
            data: mapData
        }];
        base.visualMap = { min: min, max: max, calculable: true, orient: "horizontal", left: "center", bottom: 10 };
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildLines(data, layout, commonOpts, specificOpts) {
        var rel = splitRelational(data);
        // 假定 source/target 是省份名（与 china 地图对应）
        var lineData = rel.links.map(function (l) {
            return { coords: [{ name: l.source }, { name: l.target }], value: l.value };
        });
        var base = buildCommonBase(commonOpts, "lines");
        base.geo = { map: "china", roam: true };
        base.series = [{
            type: "lines",
            coordinateSystem: "geo",
            data: lineData,
            effect: {
                show: (specificOpts && specificOpts.effect) && specificOpts.effect !== "none",
                symbol: (specificOpts && specificOpts.effect) === "train" ? "triangle" : "arrow",
                symbolSize: 6
            },
            lineStyle: { curveness: (specificOpts && specificOpts.curveness) || 0.2 }
        }];
        base.tooltip.trigger = "item";
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    function buildPictorialBar(data, layout, commonOpts, specificOpts) {
        var sp = splitByLayout(data, layout, commonOpts.hasHeader);
        var base = buildCommonBase(commonOpts, "pictorialBar");
        applyCommonAxis(base, commonOpts);
        base.xAxis.data = sp.categories;
        base.series = sp.series.map(function (s) {
            return applyLabelStyle({
                type: "pictorialBar",
                name: s.name,
                data: s.data,
                symbol: (specificOpts && specificOpts.symbol) || "rect",
                symbolRepeat: true,
                symbolSize: ["50%", "100%"]
            }, commonOpts);
        });
        return base;
    }

    function buildCalendar(data, layout, commonOpts, specificOpts) {
        var m = splitMatrix(data);
        // x 为日期字符串，y 为忽略，value 为数值
        var calData = [];
        for (var i = 0; i < m.x.length; i++) {
            calData.push([String(m.x[i]), Number(m.values[i]) || 0]);
        }
        var allVals = calData.map(function (d) { return d[1]; });
        var min = allVals.length ? Math.min.apply(null, allVals) : 0;
        var max = allVals.length ? Math.max.apply(null, allVals) : 100;
        var year = (specificOpts && specificOpts.yearRange) || String(new Date().getFullYear());
        var base = buildCommonBase(commonOpts, "calendar");
        base.tooltip = { show: true };
        base.visualMap = { min: min, max: max, calculable: true, orient: "horizontal", left: "center", bottom: 10 };
        base.calendar = {
            top: 80,
            range: year,
            cellSize: [(specificOpts && specificOpts.cellSize) || 16, (specificOpts && specificOpts.cellSize) || 16]
        };
        base.series = [{
            type: "heatmap",
            coordinateSystem: "calendar",
            data: calData
        }];
        delete base.xAxis; delete base.yAxis;
        return base;
    }

    // ===================== 数据布局分发 =====================
    function splitByLayout(data, layout, hasHeader) {
        var clean = cleanMatrix(data);
        if (layout === "seriesInRow") return splitSeriesInRow(clean, hasHeader);
        return splitSeriesInCol(clean, hasHeader);
    }

    function buildLinearGradient(themeName) {
        var colors = COLOR_THEMES[themeName] || COLOR_THEMES.default;
        var c0 = colors[0], c1 = colors[1] || colors[0];
        return {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
                { offset: 0, color: c0 },
                { offset: 1, color: c1 }
            ]
        };
    }

    // ===================== 主入口 buildOption =====================
    function buildOption(chartType, data, layout, commonOpts, specificOpts) {
        var entry = findChartEntry(chartType);
        if (!entry) throw new Error("未知的图表类型：" + chartType);
        return entry.build(data, layout, commonOpts, specificOpts || {});
    }

    function findChartEntry(chartType) {
        for (var cat in CHART_TYPES) {
            if (CHART_TYPES.hasOwnProperty(cat)) {
                if (CHART_TYPES[cat][chartType]) return CHART_TYPES[cat][chartType];
            }
        }
        return null;
    }

    function findChartCategory(chartType) {
        for (var cat in CHART_TYPES) {
            if (CHART_TYPES.hasOwnProperty(cat) && CHART_TYPES[cat][chartType]) return cat;
        }
        return null;
    }

    function listChartTypes() {
        var out = [];
        for (var cat in CHART_TYPES) {
            if (!CHART_TYPES.hasOwnProperty(cat)) continue;
            for (var t in CHART_TYPES[cat]) {
                if (!CHART_TYPES[cat].hasOwnProperty(t)) continue;
                out.push({ category: cat, type: t, desc: CHART_TYPES[cat][t].desc });
            }
        }
        return out;
    }

    // ===================== 通信 =====================
    function getStorage(key) {
        try { return window.Application.PluginStorage.getItem(key); }
        catch (e) { return null; }
    }
    function setStorage(key, val) {
        try { window.Application.PluginStorage.setItem(key, val); }
        catch (e) { console.log("[TaskPane] setStorage 失败 " + key + ": " + e.message); }
    }

    function sendConfig(action) {
        // 只传元信息，不传 data 数组和 option 对象（避免超出 PluginStorage 大小限制）
        // Dialog 端会加载 EChartsTaskPane.js 自行调 readRangeData + buildOption
        // 关键：hasHeader 是 state 顶层属性，但 build 函数都从 commonOpts.hasHeader 读取
        // 所以这里必须把 hasHeader 同步注入 commonOpts，否则首行/首列不会被当作 series 名
        var mergedCommon = Object.assign({}, state.commonOpts || {}, { hasHeader: state.hasHeader });
        var cfg = {
            version: 2,
            timestamp: Date.now(),
            chartType: state.chartType,
            layout: state.layout,
            hasHeader: state.hasHeader,
            commonOpts: mergedCommon,
            specificOpts: state.specificOpts,
            dataAddr: state.dataAddr,
            action: action || "render"
        };
        try {
            setStorage(STORAGE_KEY, JSON.stringify(cfg));
            return true;
        } catch (e) {
            setStatus("写入 PluginStorage 失败：" + e.message + "（配置可能过大）", "fail");
            return false;
        }
    }

    function openDialog() {
        var app = window.Application;
        if (!app || !app.CreateTaskPane) { setStatus("CreateTaskPane 不可用（非 WPS 环境）", "fail"); return false; }
        // 将 taskpane 设为浮动模式并移到屏幕左侧（垂直居中）
        function applyFloatingLeft(tpObj) {
            try {
                if (app.Enum && typeof app.Enum.msoCTPDockPositionFloating !== "undefined") {
                    tpObj.DockPosition = app.Enum.msoCTPDockPositionFloating;
                }
            } catch (e) {}
            try { if (tpObj.Width !== undefined) tpObj.Width = 1000; } catch (e) {}
            try { if (tpObj.Height !== undefined) tpObj.Height = 800; } catch (e) {}
            var screenW = 1920, screenH = 1080;
            if (window.screen) {
                screenW = window.screen.width || screenW;
                screenH = window.screen.height || screenH;
            }
            var dlgW = 1000, dlgH = 800;
            var left = 0; // 屏幕左侧
            var top = Math.max(0, Math.floor((screenH - dlgH) / 2)); // 垂直居中
            try {
                if (tpObj.Left !== undefined) tpObj.Left = left;
                if (tpObj.Top !== undefined) tpObj.Top = top;
            } catch (e) {}
        }
        // 复用已存在的 floating TaskPane（通过 PluginStorage 保存的 ID）
        // 这是唯一能"复用同一窗口"的方案；ShowDialog 每次都新窗口
        var existingId = getStorage("echarts_dialog_id");
        if (existingId) {
            try {
                var existing = app.GetTaskPane(existingId);
                if (existing) {
                    // 已存在：直接 Visible=true 即可，配置轮询会自动重绘
                    try { existing.Visible = true; } catch (e) {}
                    applyFloatingLeft(existing);
                    setStorage(DIALOG_OPENED_KEY, "true");
                    return true;
                }
            } catch (e) {
                // 失效，清掉重建
                setStorage("echarts_dialog_id", "");
            }
        }
        try {
            var root = (typeof GetRootPath === "function") ? GetRootPath() : "";
            if (!root) throw new Error("无法获取根 URL（GetRootPath 不可用）");
            var url = root + "/ui/EChartsDialog.html";
            console.log("[TaskPane] openDialog URL = " + url);
            var tp = app.CreateTaskPane(url);
            if (!tp) throw new Error("CreateTaskPane 返回空");
            setStorage("echarts_dialog_id", tp.ID);
            // 设置 Enum
            try {
                if (typeof app.Enum !== "object" && typeof WPS_Enum === "object") {
                    app.Enum = WPS_Enum;
                }
            } catch (e) {}
            try { if (tp.Width !== undefined) tp.Width = 1000; } catch (e) {}
            try { if (tp.Height !== undefined) tp.Height = 800; } catch (e) {}
            // 显示
            try { tp.Visible = true; } catch (e) {}
            // 浮动模式并移到屏幕左侧
            applyFloatingLeft(tp);
            setTimeout(function () {
                var id2 = getStorage("echarts_dialog_id");
                if (id2) { var tp2 = app.GetTaskPane(id2); if (tp2) applyFloatingLeft(tp2); }
            }, 300);
            setStorage(DIALOG_OPENED_KEY, "true");
            return true;
        } catch (e) {
            setStorage(DIALOG_OPENED_KEY, "");
            setStorage("echarts_dialog_id", "");
            setStatus("打开预览窗口失败：" + e.message, "fail");
            return false;
        }
    }

    function renderPreview() {
        // 1. 读数据
        var addr = resolveAddr();
        if (!addr) { setStatus("未指定数据区域", "warn"); return; }
        try {
            state.currentData = readRangeData(addr);
            state.dataAddr = addr;
        } catch (e) {
            setStatus("读取数据失败：" + e.message, "fail");
            return;
        }
        // 1.5 刷新数据预览表格
        updateDataPreview();
        // 2. 构造并发送配置
        if (!sendConfig("render")) return;
        // 3. 打开 Dialog（首次）
        var opened = openDialog();
        if (!opened) return;  // 失败时错误已由 openDialog 写入状态栏
        setStatus("已发送渲染请求：" + state.chartType + " @ " + addr, "ok");
        // 4. 推入历史
        pushHistory();
    }

    function refreshData() {
        if (!state.dataAddr) { setStatus("尚未指定数据地址", "warn"); return; }
        try {
            state.currentData = readRangeData(state.dataAddr);
            updateDataPreview();
            sendConfig("render");
            setStatus("已重新读取并刷新：" + state.dataAddr, "ok");
        } catch (e) {
            setStatus("刷新失败：" + e.message, "fail");
        }
    }

    function resolveAddr() {
        if (state.dataMode === "selection") {
            var a = getCurrentSelectionAddr();
            if (!a) { setStatus("当前无选区，回退 A1", "warn"); return "A1"; }
            return a;
        }
        if (state.dataMode === "address") return state.dataAddr;
        if (state.dataMode === "inputbox") {
            var r = pickRangeByInputBox("请选择数据区域：");
            if (r) { state.dataAddr = r; return r; }
            return state.dataAddr;
        }
        return state.dataAddr;
    }

    // ===================== 配置存取 =====================
    function saveConfigToCell() {
        if (!state.dataAddr) { setStatus("尚无配置可保存（请先选择数据并渲染）", "warn"); return; }
        var cfg = {
            version: 1,
            chartType: state.chartType,
            layout: state.layout,
            hasHeader: state.hasHeader,
            dataAddr: state.dataAddr,
            commonOpts: state.commonOpts,
            specificOpts: state.specificOpts
        };
        var json = JSON.stringify(cfg, null, 2);
        var app = window.Application;
        if (!app || !app.InputBox) { setStatus("InputBox 不可用", "fail"); return; }
        try {
            var r = app.InputBox("请选择保存配置的单元格：", "选择位置", "", undefined, undefined, undefined, undefined, 8);
            if (!r || !r.Address) { setStatus("已取消保存", "warn"); return; }
            // 切分超长
            if (json.length <= MAX_CELL_LEN) {
                app.ActiveSheet.Range(r.Address).Value2 = json;
            } else {
                // 切分多列
                var sheet = app.ActiveSheet;
                var startAddr = r.Address;
                var parts = Math.ceil(json.length / MAX_CELL_LEN);
                for (var i = 0; i < parts; i++) {
                    var chunk = json.substring(i * MAX_CELL_LEN, (i + 1) * MAX_CELL_LEN);
                    var offset = i;
                    var cellAddr = app.ActiveSheet.Cells.Item(r.Row, r.Column + offset).Address(true, true);
                    sheet.Range(cellAddr).Value2 = chunk;
                }
                // 写 Defined Name 标记
                try {
                    var name = "ECHARTS_CONFIG_" + Date.now();
                    var endCell = app.ActiveSheet.Cells.Item(r.Row, r.Column + parts - 1).Address(true, true);
                    var fullRange = app.ActiveSheet.Range(startAddr + ":" + endCell);
                    app.ActiveWorkbook.Names.Add(name, "=" + fullRange.Address(true, true, undefined, true));
                    setStatus("配置已切分保存到 " + r.Address + "（" + parts + " 段），区域名：" + name, "ok");
                    return;
                } catch (e) {
                    setStatus("配置已切分保存到 " + r.Address + "（" + parts + " 段），但定义名失败：" + e.message, "warn");
                    return;
                }
            }
            setStatus("配置已保存到 " + r.Address, "ok");
        } catch (e) {
            setStatus("保存失败：" + e.message, "fail");
        }
    }

    function loadConfigFromCell() {
        var app = window.Application;
        if (!app || !app.InputBox) { setStatus("InputBox 不可用", "fail"); return; }
        var r;
        try {
            r = app.InputBox("请选择存配置的单元格：", "选择位置", "", undefined, undefined, undefined, undefined, 8);
        } catch (e) { setStatus("InputBox 调用失败：" + e.message, "fail"); return; }
        if (!r || !r.Address) { setStatus("已取消导入", "warn"); return; }
        var v;
        try { v = app.Range(r.Address).Value2; }
        catch (e) { setStatus("读取配置失败：" + e.message, "fail"); return; }
        if (v === null || v === "") { setStatus("单元格为空", "warn"); return; }
        // 多段拼接（向后探测连续非空单元格）
        var json = "";
        if (typeof v === "string") {
            json = v;
            // 探测后续
            var startRow = r.Row, startCol = r.Column;
            var idx = 0;
            while (true) {
                var next = app.ActiveSheet.Cells.Item(startRow, startCol + idx + 1).Value2;
                if (next === null || next === "") break;
                json += String(next);
                idx++;
            }
        } else {
            json = String(v);
        }
        var cfg;
        try { cfg = JSON.parse(json); }
        catch (e) { setStatus("配置 JSON 解析失败：" + e.message + "（单元格 " + r.Address + "）", "fail"); return; }
        // 复原 state
        if (cfg.chartType) state.chartType = cfg.chartType;
        if (cfg.layout) state.layout = cfg.layout;
        if (typeof cfg.hasHeader === "boolean") state.hasHeader = cfg.hasHeader;
        if (cfg.dataAddr) state.dataAddr = cfg.dataAddr;
        if (cfg.commonOpts) state.commonOpts = Object.assign({}, getDefaultCommonOpts(), cfg.commonOpts);
        if (cfg.specificOpts) state.specificOpts = cfg.specificOpts;
        // 重新读数据 + 渲染
        try {
            state.currentData = readRangeData(state.dataAddr);
        } catch (e) { setStatus("重新读取数据失败：" + e.message, "fail"); return; }
        // 更新 UI
        syncUIFromState();
        sendConfig("render");
        openDialog();
        setStatus("已导入配置：" + state.chartType + " @ " + state.dataAddr, "ok");
    }

    // ===================== 历史 =====================
    function pushHistory() {
        var hist = [];
        try { var raw = getStorage(HISTORY_KEY); if (raw) hist = JSON.parse(raw) || []; } catch (e) { hist = []; }
        var entry = {
            time: new Date().toLocaleString(),
            chartType: state.chartType,
            dataAddr: state.dataAddr,
            cfg: JSON.stringify({
                version: 1,
                chartType: state.chartType,
                layout: state.layout,
                hasHeader: state.hasHeader,
                dataAddr: state.dataAddr,
                commonOpts: state.commonOpts,
                specificOpts: state.specificOpts
            })
        };
        hist.unshift(entry);
        if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY);
        setStorage(HISTORY_KEY, JSON.stringify(hist));
        renderHistoryPanel();
    }

    function getHistory() {
        try { var raw = getStorage(HISTORY_KEY); if (raw) return JSON.parse(raw) || []; } catch (e) {}
        return [];
    }

    function restoreHistory(idx) {
        var hist = getHistory();
        if (idx < 0 || idx >= hist.length) return;
        var entry = hist[idx];
        try {
            var cfg = JSON.parse(entry.cfg);
            if (cfg.chartType) state.chartType = cfg.chartType;
            if (cfg.layout) state.layout = cfg.layout;
            if (typeof cfg.hasHeader === "boolean") state.hasHeader = cfg.hasHeader;
            if (cfg.dataAddr) state.dataAddr = cfg.dataAddr;
            if (cfg.commonOpts) state.commonOpts = Object.assign({}, getDefaultCommonOpts(), cfg.commonOpts);
            if (cfg.specificOpts) state.specificOpts = cfg.specificOpts;
        } catch (e) { setStatus("恢复失败：" + e.message, "fail"); return; }
        try { state.currentData = readRangeData(state.dataAddr); }
        catch (e) { setStatus("重新读取数据失败：" + e.message, "fail"); return; }
        syncUIFromState();
        sendConfig("render");
        openDialog();
        setStatus("已恢复历史：" + entry.time + " - " + state.chartType, "ok");
    }

    function clearHistory() {
        setStorage(HISTORY_KEY, "[]");
        renderHistoryPanel();
        setStatus("已清空历史", "ok");
    }

    function renderHistoryPanel() {
        var panel = document.getElementById("tab-history-list");
        if (!panel) return;
        var hist = getHistory();
        panel.innerHTML = "";
        if (hist.length === 0) {
            panel.textContent = "（暂无历史记录）";
            return;
        }
        hist.forEach(function (entry, idx) {
            var row = document.createElement("div");
            row.style.cssText = "padding:6px;border:1px solid #ddd;border-radius:3px;margin-bottom:4px;font-size:12px;";
            row.textContent = entry.time + " - " + entry.chartType + " - " + entry.dataAddr + " ";
            var btn = document.createElement("button");
            btn.textContent = "恢复";
            btn.style.cssText = "padding:2px 8px;margin-left:6px;";
            btn.addEventListener("click", function () { restoreHistory(idx); });
            row.appendChild(btn);
            panel.appendChild(row);
        });
    }

    // ===================== 图片导出 =====================
    function exportLocal() {
        var ratio = getExportRatio();
        var bg = getExportBg();
        if (getStorage(DIALOG_OPENED_KEY) !== "true") {
            setStatus("请先点「渲染预览」打开预览窗口", "warn");
            return;
        }
        setStorage(EXPORT_REQUEST_KEY, JSON.stringify({ target: "local", pixelRatio: ratio, bgColor: bg, timestamp: Date.now() }));
        setStatus("已发送本地保存请求到预览窗口…", "ok");
    }

    function exportToSheet() {
        var ratio = getExportRatio();
        var bg = getExportBg();
        if (getStorage(DIALOG_OPENED_KEY) !== "true") {
            setStatus("请先点「渲染预览」打开预览窗口", "warn");
            return;
        }
        setStorage(EXPORT_REQUEST_KEY, JSON.stringify({ target: "sheet", pixelRatio: ratio, bgColor: bg, timestamp: Date.now() }));
        setStatus("已发送插入表格请求到预览窗口…", "ok");
    }

    function getExportRatio() {
        var el = document.getElementById("export-ratio");
        if (!el) return 2;
        var v = el.value;
        return v === "1x" ? 1 : (v === "3x" ? 3 : 2);
    }
    function getExportBg() {
        var el = document.getElementById("export-bg");
        if (!el) return "#fff";
        var v = el.value;
        if (v === "transparent") return "rgba(0,0,0,0)";
        if (v === "custom") {
            var c = document.getElementById("export-bg-custom");
            return c ? c.value : "#fff";
        }
        return "#fff";
    }

    function pollExportStatus() {
        var raw = getStorage(EXPORT_STATUS_KEY);
        if (!raw) return;
        setStorage(EXPORT_STATUS_KEY, ""); // 消费
        try {
            var s = JSON.parse(raw);
            if (s.ok) setStatus(s.msg, "ok");
            else setStatus(s.msg, "fail");
        } catch (e) {}
    }

    // ===================== UI 状态同步 =====================
    function syncUIFromState() {
        // Tab 1
        var modeEls = document.getElementsByName("data-mode");
        for (var i = 0; i < modeEls.length; i++) {
            modeEls[i].checked = (modeEls[i].value === state.dataMode);
        }
        var addrEl = document.getElementById("data-addr");
        if (addrEl) addrEl.value = state.dataAddr;
        var layoutEl = document.getElementById("layout-select");
        if (layoutEl) layoutEl.value = state.layout;
        var headerEl = document.getElementById("has-header");
        if (headerEl) headerEl.checked = state.hasHeader;
        var chartCatEl = document.getElementById("chart-category");
        var chartTypeEl = document.getElementById("chart-type");
        if (chartCatEl) {
            chartCatEl.value = findChartCategory(state.chartType) || "基础统计";
            rebuildChartTypeSelect();
        }
        if (chartTypeEl) chartTypeEl.value = state.chartType;
        // Tab 2 通用
        syncCommonOptsUI();
        // Tab 3 专属
        renderSpecificOptsPanel();
        updateDataPreview();
        updateConfigJsonPreview();
    }

    function syncCommonOptsUI() {
        var co = state.commonOpts;
        function setVal(id, val) {
            var el = document.getElementById(id);
            if (el) el.value = val;
        }
        function setChk(id, val) {
            var el = document.getElementById(id);
            if (el) el.checked = !!val;
        }
        setVal("opt-title-text", co.titleText);
        setVal("opt-title-subtext", co.subtitleText);
        setVal("opt-title-left", co.titleLeft);
        setVal("opt-title-top", co.titleTop);
        setChk("opt-legend-show", co.legendShow);
        setVal("opt-legend-left", co.legendLeft);
        setVal("opt-legend-top", co.legendTop);
        setVal("opt-legend-orient", co.legendOrient);
        setVal("opt-xaxis-name", co.xAxisName);
        setVal("opt-yaxis-name", co.yAxisName);
        setVal("opt-xaxis-type", co.xAxisType);
        setVal("opt-yaxis-type", co.yAxisType);
        setChk("opt-xaxis-inverse", co.xAxisInverse);
        setChk("opt-show-grid", co.showGrid);
        setChk("opt-dual-yaxis", co.dualYAxis);
        setVal("opt-color-theme", co.colorTheme);
        setChk("opt-gradient", co.gradient);
        setVal("opt-border-radius", co.borderRadius);
        setVal("opt-opacity", co.opacity);
        setChk("opt-label-show", co.labelShow);
        setVal("opt-label-position", co.labelPosition);
        setChk("opt-animation", co.animation);
        setVal("opt-animation-duration", co.animationDuration);
        setChk("opt-toolbox", co.toolbox);
        setChk("opt-data-zoom", co.dataZoom);
        setChk("opt-tooltip-show", co.tooltipShow);
        setVal("opt-tooltip-trigger", co.tooltipTrigger);
        setChk("opt-emphasis", co.emphasis);
        setChk("opt-selected-mode", co.selectedMode);
    }

    function collectCommonOpts() {
        function val(id) { var el = document.getElementById(id); return el ? el.value : ""; }
        function chk(id) { var el = document.getElementById(id); return el ? el.checked : false; }
        state.commonOpts = {
            titleText: val("opt-title-text"),
            subtitleText: val("opt-title-subtext"),
            titleLeft: val("opt-title-left"),
            titleTop: val("opt-title-top"),
            legendShow: chk("opt-legend-show"),
            legendLeft: val("opt-legend-left"),
            legendTop: val("opt-legend-top"),
            legendOrient: val("opt-legend-orient"),
            xAxisName: val("opt-xaxis-name"),
            yAxisName: val("opt-yaxis-name"),
            xAxisType: val("opt-xaxis-type"),
            yAxisType: val("opt-yaxis-type"),
            xAxisInverse: chk("opt-xaxis-inverse"),
            showGrid: chk("opt-show-grid"),
            dualYAxis: chk("opt-dual-yaxis"),
            colorTheme: val("opt-color-theme"),
            gradient: chk("opt-gradient"),
            borderRadius: Number(val("opt-border-radius") || 0),
            opacity: Number(val("opt-opacity") || 1),
            labelShow: chk("opt-label-show"),
            labelPosition: val("opt-label-position"),
            animation: chk("opt-animation"),
            animationDuration: Number(val("opt-animation-duration") || 1000),
            toolbox: chk("opt-toolbox"),
            dataZoom: chk("opt-data-zoom"),
            tooltipShow: chk("opt-tooltip-show"),
            tooltipTrigger: val("opt-tooltip-trigger"),
            emphasis: chk("opt-emphasis"),
            selectedMode: chk("opt-selected-mode")
        };
    }

    function renderSpecificOptsPanel() {
        var panel = document.getElementById("tab-specific-content");
        var title = document.getElementById("tab-specific-title");
        if (!panel) return;
        panel.innerHTML = "";
        var entry = findChartEntry(state.chartType);
        if (title) title.textContent = (entry ? (state.chartType + " 专属选项") : "未知图表") + " - " + (entry ? entry.desc : "");
        var schema = SPECIFIC_OPTS[state.chartType] || [];
        if (schema.length === 0) {
            panel.textContent = "（该图表类型无专属选项）";
            state.specificOpts = {};
            return;
        }
        // 默认值初始化
        if (!state.specificOpts || Object.keys(state.specificOpts).length === 0) {
            state.specificOpts = {};
            schema.forEach(function (p) { state.specificOpts[p.key] = p.default; });
        }
        schema.forEach(function (p) {
            var row = document.createElement("div");
            row.className = "paramRow";
            var lbl = document.createElement("label");
            lbl.textContent = p.label;
            lbl.setAttribute("for", "sopt-" + p.key);
            row.appendChild(lbl);
            var input;
            if (p.type === "select") {
                input = document.createElement("select");
                (p.options || []).forEach(function (opt) {
                    var o = document.createElement("option");
                    o.value = opt; o.textContent = opt;
                    input.appendChild(o);
                });
                input.value = String(state.specificOpts[p.key] != null ? state.specificOpts[p.key] : p.default);
                input.id = "sopt-" + p.key;
                input.addEventListener("change", collectSpecificOpts);
            } else if (p.type === "checkbox") {
                input = document.createElement("input");
                input.type = "checkbox";
                input.checked = !!state.specificOpts[p.key];
                input.id = "sopt-" + p.key;
                input.addEventListener("change", collectSpecificOpts);
            } else if (p.type === "number") {
                input = document.createElement("input");
                input.type = "number";
                input.value = (state.specificOpts[p.key] === undefined || state.specificOpts[p.key] === "") ? "" : state.specificOpts[p.key];
                if (p.min != null) input.min = p.min;
                if (p.max != null) input.max = p.max;
                input.id = "sopt-" + p.key;
                input.addEventListener("input", collectSpecificOpts);
            } else if (p.type === "text") {
                input = document.createElement("input");
                input.type = "text";
                input.value = state.specificOpts[p.key] || "";
                input.id = "sopt-" + p.key;
                input.addEventListener("input", collectSpecificOpts);
            }
            row.appendChild(input);
            panel.appendChild(row);
            if (p.hint) {
                var h = document.createElement("div");
                h.className = "paramHint";
                h.textContent = p.hint;
                panel.appendChild(h);
            }
        });
    }

    function collectSpecificOpts() {
        var schema = SPECIFIC_OPTS[state.chartType] || [];
        var out = {};
        schema.forEach(function (p) {
            var el = document.getElementById("sopt-" + p.key);
            if (!el) { out[p.key] = p.default; return; }
            if (p.type === "checkbox") out[p.key] = el.checked;
            else if (p.type === "number") out[p.key] = (el.value === "" ? "" : Number(el.value));
            else out[p.key] = el.value;
        });
        state.specificOpts = out;
    }

    // ===================== Tab 切换 =====================
    function switchTab(tabId) {
        var btns = document.querySelectorAll(".tab-btn");
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove("active");
        var panels = document.querySelectorAll(".tab-panel");
        for (var j = 0; j < panels.length; j++) panels[j].classList.remove("active");
        var btn = document.querySelector('.tab-btn[data-tab="' + tabId + '"]');
        var panel = document.getElementById("tab-" + tabId);
        if (btn) btn.classList.add("active");
        if (panel) panel.classList.add("active");
        // 切到数据 Tab 时刷新预览
        if (tabId === "data") updateDataPreview();
        if (tabId === "config") updateConfigJsonPreview();
        if (tabId === "history") renderHistoryPanel();
        if (tabId === "specific") renderSpecificOptsPanel();
    }

    // ===================== 数据预览 =====================
    function updateDataPreview() {
        var panel = document.getElementById("data-preview");
        if (!panel) return;
        panel.innerHTML = "";
        if (!state.currentData || state.currentData.length === 0) {
            panel.textContent = "（请先在「数据」Tab 选择区域并点击「渲染预览」）";
            return;
        }
        var maxR = Math.min(8, state.currentData.length);
        var maxC = Math.min(8, (state.currentData[0] || []).length);
        var tbl = document.createElement("table");
        tbl.style.cssText = "border-collapse:collapse;font-size:11px;";
        for (var r = 0; r < maxR; r++) {
            var tr = document.createElement("tr");
            for (var c = 0; c < maxC; c++) {
                var td = document.createElement("td");
                td.style.cssText = "border:1px solid #ccc;padding:2px 4px;";
                var v = state.currentData[r][c];
                td.textContent = (v === null || v === undefined) ? "" : String(v).slice(0, 12);
                tr.appendChild(td);
            }
            if (state.currentData[r].length > maxC) {
                var more = document.createElement("td");
                more.style.cssText = "border:1px solid #ccc;padding:2px 4px;color:#888;";
                more.textContent = "...";
                tr.appendChild(more);
            }
            tbl.appendChild(tr);
        }
        if (state.currentData.length > maxR) {
            var tr2 = document.createElement("tr");
            var td2 = document.createElement("td");
            td2.style.cssText = "border:1px solid #ccc;padding:2px 4px;color:#888;";
            td2.colSpan = maxC + 1;
            td2.textContent = "... 共 " + state.currentData.length + " 行";
            tr2.appendChild(td2);
            tbl.appendChild(tr2);
        }
        panel.appendChild(tbl);
    }

    // ===================== 配置 JSON 预览 =====================
    function updateConfigJsonPreview() {
        var ta = document.getElementById("config-json-preview");
        if (!ta) return;
        if (!state.dataAddr) { ta.value = "（尚无配置）"; return; }
        var cfg = {
            version: 1,
            chartType: state.chartType,
            layout: state.layout,
            hasHeader: state.hasHeader,
            dataAddr: state.dataAddr,
            commonOpts: state.commonOpts,
            specificOpts: state.specificOpts
        };
        ta.value = JSON.stringify(cfg, null, 2);
    }

    // ===================== 状态栏 =====================
    function setStatus(msg, cls) {
        var el = document.getElementById("status");
        if (!el) { console.log("[TaskPane] " + msg); return; }
        el.textContent = msg;
        el.className = cls || "";
        console.log("[TaskPane] " + msg);
    }

    // ===================== 折叠面板 =====================
    function toggleCollapse(id) {
        var body = document.getElementById(id);
        if (!body) return;
        body.style.display = (body.style.display === "none") ? "block" : "none";
    }

    // ===================== 图表类型下拉联动 =====================
    function rebuildChartTypeSelect() {
        var catSel = document.getElementById("chart-category");
        var typeSel = document.getElementById("chart-type");
        if (!catSel || !typeSel) return;
        var cat = catSel.value;
        typeSel.innerHTML = "";
        var types = CHART_TYPES[cat] || {};
        for (var t in types) {
            if (!types.hasOwnProperty(t)) continue;
            var o = document.createElement("option");
            o.value = t; o.textContent = t + " - " + types[t].desc;
            typeSel.appendChild(o);
        }
        // 选中当前 state.chartType（若属于该分类）
        if (types[state.chartType]) typeSel.value = state.chartType;
        else {
            // 自动选第一个
            for (var k in types) { if (types.hasOwnProperty(k)) { state.chartType = k; break; } }
            typeSel.value = state.chartType;
        }
        // 触发专属面板重建
        renderSpecificOptsPanel();
    }

    function onChartTypeChange() {
        var typeSel = document.getElementById("chart-type");
        if (typeSel) state.chartType = typeSel.value;
        // 重置 specificOpts
        var schema = SPECIFIC_OPTS[state.chartType] || [];
        state.specificOpts = {};
        schema.forEach(function (p) { state.specificOpts[p.key] = p.default; });
        renderSpecificOptsPanel();
    }

    // ===================== 入口 =====================
    function init() {
        // 渲染图表类型下拉
        var catSel = document.getElementById("chart-category");
        if (catSel) {
            catSel.innerHTML = "";
            for (var c in CHART_TYPES) {
                if (CHART_TYPES.hasOwnProperty(c)) {
                    var o = document.createElement("option");
                    o.value = c; o.textContent = c;
                    catSel.appendChild(o);
                }
            }
            catSel.value = findChartCategory(state.chartType) || "基础统计";
        }
        rebuildChartTypeSelect();
        // 渲染专属面板
        renderSpecificOptsPanel();
        // 同步通用选项 UI
        syncCommonOptsUI();
        // 数据预览
        updateDataPreview();
        updateConfigJsonPreview();
        renderHistoryPanel();
        // 默认 Tab = data
        switchTab("data");
        // 状态栏
        setStatus("就绪。请选择数据区域并点「渲染预览」", "");
        // 启动导出状态轮询
        setInterval(pollExportStatus, 300);
    }

    return {
        init: init,
        switchTab: switchTab,
        renderPreview: renderPreview,
        refreshData: refreshData,
        saveConfigToCell: saveConfigToCell,
        loadConfigFromCell: loadConfigFromCell,
        exportLocal: exportLocal,
        exportToSheet: exportToSheet,
        pushHistory: pushHistory,
        clearHistory: clearHistory,
        restoreHistory: restoreHistory,
        toggleCollapse: toggleCollapse,
        rebuildChartTypeSelect: rebuildChartTypeSelect,
        onChartTypeChange: onChartTypeChange,
        collectCommonOpts: collectCommonOpts,
        collectSpecificOpts: collectSpecificOpts,
        pickRangeByInputBox: pickRangeByInputBox,
        resolveAddr: resolveAddr,
        // 对外暴露给 Dialog 调用
        readRangeData: readRangeData,
        buildOption: buildOption,
        // 状态暴露
        getState: function () { return state; }
    };
})();
