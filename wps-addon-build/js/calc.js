// ============================================================
// 万能计算 对话框逻辑
//
// 本文件由 ui/calc.html 引入，运行在 ShowDialog 打开的独立窗口上下文中，
// 因此所有 WPS 对象必须通过 window.Application 访问（与 js/dialog.js 一致）。
//
// 安全说明：本功能允许用户输入 JS 表达式对单元格做批量计算。
// 仅适用于用户自己的 WPS 文档，请勿粘贴未知来源的代码。
// 表达式经过关键字黑名单过滤，但无法做到完全沙箱，使用前请确认表达式可信。
// ============================================================

// 关键字黑名单：命中即拒绝编译
var FORBIDDEN_KEYWORDS = [
    "eval", "Function(", "fetch", "XMLHttpRequest", "ActiveXObject",
    "WScript", "Shell", "OAAssist", "PluginStorage",
    "window", "document", "parent", "self", "globalThis", "this"
];

// Math 库的函数名和常量名，用于预处理（用户可省略 Math. 前缀，不区分大小写）
var MATH_NAMES = [
    // 常量（大写）
    "PI", "E", "LN2", "LN10", "LOG2E", "LOG10E", "SQRT2", "SQRT1_2",
    // 标准函数（小写）
    "abs", "acos", "acosh", "asin", "asinh", "atan", "atan2", "atanh",
    "cbrt", "ceil", "clz32", "cos", "cosh", "exp", "expm1", "floor",
    "fround", "hypot", "imul", "log", "log10", "log1p", "log2",
    "max", "min", "pow", "random", "round", "sign", "sin", "sinh",
    "sqrt", "tan", "tanh", "trunc",
    // Lodash.js 扩展的 Math 函数
    "factorial", "permutation", "combination", "quadraticRoots", "fibonacci"
];

// 预处理：把用户表达式中的 Math 函数名/常量名自动补上 Math. 前缀
// 规则：不区分大小写；前面不能是 \w 或 .（避免误匹配 Math.sqrt 中的 sqrt、mymax 中的 max）
function preprocessMathFuncs(expr) {
    // 按名称长度逆序处理，避免短名（如 log）先替换影响长名（如 log10）
    var names = MATH_NAMES.slice().sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < names.length; i++) {
        var name = names[i];
        // 前面不能是 \w 或 .，后面不能是 \w
        var re = new RegExp("(^|[^\\w.])" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w])", "gi");
        expr = expr.replace(re, function (match, prefix) {
            return prefix + "Math." + name;
        });
    }
    return expr;
}

// String.prototype 上的常用方法和属性
// 如果表达式中用到了这些方法（x.方法名 形式），自动把 x 转成 String 并强制按字符串模式处理
var STRING_METHODS = [
    "charAt", "charCodeAt", "codePointAt", "concat",
    "endsWith", "startsWith", "includes",
    "indexOf", "lastIndexOf", "match", "matchAll",
    "normalize", "padStart", "padEnd", "repeat",
    "replace", "replaceAll", "search", "slice", "split",
    "substr", "substring", "toLowerCase", "toUpperCase",
    "trim", "trimStart", "trimEnd", "toString", "valueOf",
    "at", "localeCompare", "length"
];

// 检测表达式是否用到了 String 实例方法（x.方法名 形式，不区分大小写）
function usesStringMethods(expr) {
    if (!expr) return false;
    for (var i = 0; i < STRING_METHODS.length; i++) {
        var re = new RegExp("x\\." + STRING_METHODS[i] + "\\b", "i");
        if (re.test(expr)) return true;
    }
    return false;
}

// 预处理：把 x.方法名 统一为正确的大小写（x.TRIM → x.trim，x.ToUpperCase → x.toUpperCase）
function preprocessStringMethods(expr) {
    for (var i = 0; i < STRING_METHODS.length; i++) {
        var name = STRING_METHODS[i];
        var re = new RegExp("x\\." + name + "\\b", "gi");
        expr = expr.replace(re, "x." + name);
    }
    return expr;
}

// 检测表达式是否包含 x= 赋值（区分 ===/==/<=/>=/!=）
function hasAssignment(expr) {
    // 匹配 "x =" 或 "x=" ，但前面不能是 $ 或字母数字下划线或点（避免匹配 ax=、obj.x=）
    // 后面不能是 = （避免匹配 x===、x==）
    return /(?:^|[^$\w.])x\s*=[^=]/.test(expr);
}

function containsForbidden(expr) {
    for (var i = 0; i < FORBIDDEN_KEYWORDS.length; i++) {
        if (expr.indexOf(FORBIDDEN_KEYWORDS[i]) !== -1) {
            return FORBIDDEN_KEYWORDS[i];
        }
    }
    return null;
}

// 编译表达式
// which: 'if' | 'then' | 'else'
// 返回 { fn: Function|null, err: string|null }
function compileExpr(expr, which) {
    expr = (expr || "").trim();
    if (!expr) return { fn: null, err: null };  // 空表达式 = 不操作

    var bad = containsForbidden(expr);
    if (bad) {
        return { fn: null, err: "表达式含禁止关键字：" + bad + "（本功能仅用于对单元格 x 做纯计算）" };
    }

    // 预处理：自动补 Math. 前缀（sqrt → Math.sqrt，PI → Math.PI，不区分大小写）
    expr = preprocessMathFuncs(expr);
    // 预处理：统一 String 方法名大小写（x.TRIM → x.trim）
    expr = preprocessStringMethods(expr);

    // 如果用到了 String 方法，在函数体开头把 x 转成字符串
    var strPrefix = usesStringMethods(expr) ? "x = String(x); " : "";

    try {
        if (which === "if") {
            // if 必须返回 boolean
            return { fn: new Function("x", "\"use strict\"; " + strPrefix + "return !!(" + expr + ");"), err: null };
        }
        // then / else
        if (hasAssignment(expr)) {
            // 用户明确写了 x=...  → 作为语句执行，再返回 x
            return { fn: new Function("x", "\"use strict\"; " + strPrefix + expr + "; return x;"), err: null };
        } else {
            // 纯表达式 → 直接返回表达式结果
            return { fn: new Function("x", "\"use strict\"; " + strPrefix + "return (" + expr + ");"), err: null };
        }
    } catch (e) {
        return { fn: null, err: e.message };
    }
}

// 判断是否为非数字
function isNonNumber(x) {
    return typeof x !== "number" || Number.isNaN(x);
}

// 主执行函数
function runCalc() {
    var targetAddr = (document.getElementById("inpTarget").value || "").trim();
    var ifExpr = (document.getElementById("inpIf").value || "").trim();
    var thenExpr = (document.getElementById("inpThen").value || "").trim();
    var elseExpr = (document.getElementById("inpElse").value || "").trim();
    var nonNumMode = "skip";
    var radios = document.getElementsByName("nonnum");
    for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) { nonNumMode = radios[i].value; break; }
    }

    // 校验
    if (!targetAddr) {
        alert("请填写目标单元格");
        return false;
    }

    var app = window.Application;
    if (!app) {
        alert("无法访问 WPS Application 对象");
        return false;
    }

    // 预编译表达式
    var ifCompiled = compileExpr(ifExpr, "if");
    var thenCompiled = compileExpr(thenExpr, "then");
    var elseCompiled = compileExpr(elseExpr, "else");

    if (ifCompiled.err)   { alert("if 表达式编译失败：\n" + ifCompiled.err); return false; }
    if (thenCompiled.err) { alert("then 表达式编译失败：\n" + thenCompiled.err); return false; }
    if (elseCompiled.err) { alert("else 表达式编译失败：\n" + elseCompiled.err); return false; }

    // 如果表达式用到了 String 方法，强制按字符串处理（不跳过非数字单元格）
    var usesStr = usesStringMethods(ifExpr) || usesStringMethods(thenExpr) || usesStringMethods(elseExpr);
    if (usesStr) {
        nonNumMode = "string";
    }

    // 解析目标 Range
    var targetRng;
    try {
        targetRng = app.Range(targetAddr);
        targetRng = app.Intersect(targetRng, app.ActiveSheet.UsedRange);
    } catch (e) {
        alert("目标区域地址无效：\n" + e.message);
        return false;
    }
    if (!targetRng || targetRng.Count === 0) {
        alert("目标区域无效或与已用区域无交集，请检查地址");
        return false;
    }

    // 公式冻结：把目标区域的公式替换为值，防止单元格之间互相影响
    // （如 A1 =B1+1，若同时修改 A1 和 B1，B1 改变后 A1 的值会跟着变）
    try {
        targetRng.Value2 = targetRng.Value2;
    } catch (e) {
        // 合并单元格等特殊情况可能失败，忽略，后续逐格处理
    }

    // 计数器
    var counters = {
        total: 0,
        ok: 0,
        skipNonNum: 0,
        skipNoBranch: 0,
        fail: 0,
        failExamples: []
    };

    app.ScreenUpdating = false;
    try {
        var cells = targetRng.Cells;
        var n = cells.Count;
        for (var k = 1; k <= n; k++) {
            counters.total++;
            var cell, x;
            try {
                cell = cells.Item(k);
                x = cell.Value2;
            } catch (e) {
                counters.fail++;
                if (counters.failExamples.length < 3) {
                    counters.failExamples.push("第 " + k + " 格: 读取值失败 - " + e.message);
                }
                continue;
            }

            // 非数字处理
            if (isNonNumber(x)) {
                if (nonNumMode === "skip") {
                    counters.skipNonNum++;
                    continue;
                }
                // nonNumMode === "string"：保留原值进入下一步
            }

            // 判定分支
            var hitThen = false;
            if (!ifCompiled.fn) {
                // if 留空 → 全部命中 then
                hitThen = true;
            } else {
                try {
                    hitThen = !!ifCompiled.fn(x);
                } catch (e) {
                    counters.fail++;
                    if (counters.failExamples.length < 3) {
                        counters.failExamples.push("第 " + k + " 格 (值=" + x + "): if 执行报错 - " + e.message);
                    }
                    continue;
                }
            }

            // 选择分支函数
            var branchFn = hitThen ? thenCompiled.fn : elseCompiled.fn;
            var branchKey = hitThen ? "then" : "else";

            // 分支为空 → 不操作
            if (!branchFn) {
                counters.skipNoBranch++;
                continue;
            }

            // 执行分支
            try {
                var result = branchFn(x);
                // 返回 undefined/null/函数 时不写回，避免清空单元格
                if (result === undefined || result === null) {
                    counters.fail++;
                    if (counters.failExamples.length < 3) {
                        counters.failExamples.push("第 " + k + " 格 (值=" + x + "): " + branchKey + " 返回 undefined/null，未写回");
                    }
                } else if (typeof result === "function") {
                    counters.fail++;
                    if (counters.failExamples.length < 3) {
                        counters.failExamples.push("第 " + k + " 格 (值=" + x + "): " + branchKey + " 返回函数，可能忘了加 ()");
                    }
                } else {
                    cell.Value2 = result;
                    counters.ok++;
                }
            } catch (e) {
                counters.fail++;
                if (counters.failExamples.length < 3) {
                    counters.failExamples.push("第 " + k + " 格 (值=" + x + "): " + branchKey + " 执行报错 - " + e.message);
                }
            }
        }
    } finally {
        app.ScreenUpdating = true;
    }

    // 汇总
    var msg = "处理完成\n";
    msg += "------------------------------------\n";
    msg += "总计      : " + counters.total + "\n";
    msg += "成功      : " + counters.ok + "\n";
    msg += "跳过-非数字: " + counters.skipNonNum + "\n";
    msg += "跳过-分支空: " + counters.skipNoBranch + "\n";
    msg += "失败      : " + counters.fail + "\n";
    if (counters.failExamples.length > 0) {
        msg += "------------------------------------\n";
        msg += "失败示例（前 " + counters.failExamples.length + " 条）：\n";
        for (var j = 0; j < counters.failExamples.length; j++) {
            msg += "  " + (j + 1) + ") " + counters.failExamples[j] + "\n";
        }
    }
    alert(msg);

    return true;
}

// 打开时自动填入当前选区
function autofillSelection() {
    try {
        var app = window.Application;
        if (!app) return;
        var sel = app.Selection;
        if (!sel) return;
        var used = app.ActiveSheet.UsedRange;
        if (!used) return;
        var r = app.Intersect(sel, used);
        if (r) {
            // Address(RowAbsolute, ColumnAbsolute) → 输出 $A$1:$B$2 这种绝对引用
            document.getElementById("inpTarget").value = r.Address(true, true);
        }
    } catch (e) {
        // 静默失败，用户可手动输入
        console.log("autofillSelection 失败：" + e.message);
    }
}

// 用 InputBox 重新框选区域
function pickRange() {
    try {
        var app = window.Application;
        if (!app) return;
        // Type=8 表示让用户选择 Range
        var r = app.InputBox("请选择目标区域：", "选择区域", "", undefined, undefined, undefined, undefined, 8);
        if (r) {
            document.getElementById("inpTarget").value = r.Address(true, true);
        }
    } catch (e) {
        // 用户点「取消」会抛异常，静默忽略
        console.log("pickRange 取消或失败：" + e.message);
    }
}

// 初始化
window.onload = function () {
    autofillSelection();

    document.getElementById("btnPick").onclick = pickRange;

    document.getElementById("btnRun").onclick = function () {
        runCalc();
        // 不立即关闭窗口，让用户看到汇总后再手动关闭
        // 如果执行成功且用户希望关闭，可以取消下面注释
        // window.close();
    };

    document.getElementById("btnCancel").onclick = function () {
        window.close();
    };
};
