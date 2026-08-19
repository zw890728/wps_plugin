function xLookup(LookupValue, LookupRange, ReturnRange, NotFound, SearchMode, ExactMatch, LookupSheetName) {
	// 手动设置默认值
	NotFound = NotFound === -2147352572 ? "#N/A" : NotFound ?? "#N/A";
	SearchMode = SearchMode === -2147352572 ? 1 : SearchMode ?? 1;
	ExactMatch = ExactMatch ?? true;

	// 手动设置目标表格默认值
	let LookupSheet;
	let sheetexist = false;
	if (LookupSheetName === null || LookupSheetName === "") {
		LookupSheet = LookupRange.Parent;
	} else {
		for (let i = 1; i <= wps.Sheets.Count; i++) {
			if (wps.Sheets.Item(i).Name.toLowerCase() === LookupSheetName.toLowerCase()) {
				LookupSheet = wps.Sheets.Item(LookupSheetName);
				sheetexist = true;
			}
		}
		if (!sheetexist) return "目标表格不存在";
	}

	// 验证查找目标
	if (typeof (LookupValue) !== "number" && typeof (LookupValue) !== "string") {
		return "查找目标需为数字或字符";
	}

	// 验证查找范围和返回范围
	if (!(LookupRange && ReturnRange)) return "查找列或返回列为空";
	if (LookupRange.hasOwnProperty("Value2")) {
		LookupRange = wps.Intersect(LookupSheet.Range(LookupRange.Address()), LookupSheet.UsedRange).Value2;
	}
	if (ReturnRange.hasOwnProperty("Value2")) {
		ReturnRange = wps.Intersect(LookupSheet.Range(ReturnRange.Address()), LookupSheet.UsedRange).Value2;
	}
	if (LookupRange.length !== ReturnRange.length) {
		return "查找范围与返回范围大小不一致";
	}

	// 确定搜索方向
	const start = SearchMode === 1 ? 0 : LookupRange.length - 1;
	const end = SearchMode === 1 ? LookupRange.length : -1;
	const step = SearchMode === 1 ? 1 : -1;

	// 遍历查找范围
	for (let i = start; i !== end; i += step) {
		const currentValue = LookupRange[i][0]; // 取单列数据

		// 精确匹配判断
		if (ExactMatch) {
			if (currentValue === LookupValue) {
				return ReturnRange[i][0];
			}
		}
		// 近似匹配判断
		else {
			if (typeof (currentValue) === 'number' && typeof (LookupValue) === 'number') {
				if (currentValue <= LookupValue) {
					return ReturnRange[i][0];
				}
			}
		}
	}

	// 处理未找到的情况
	return NotFound;
}
wps.AddCustomFunction("ZW", "xLookup", xLookup, {
	description: "模拟Excel的XLOOKUP函数",
	parameters: [
		{ name: "查找值", description: "要查找的值", type: "any" },
		{ name: "查找范围", description: "查找范围（单列）", type: "object" },
		{ name: "返回范围", description: "返回范围（单列）", type: "object" },
		{ name: "未找到值", description: "未找到时返回的值（默认#N/A）", type: "any?" },
		{ name: "搜索模式", description: "搜索模式：1(正向)/-1(逆向)（默认1）", type: "number?" },
		{ name: "精确匹配", description: "是否精确匹配（默认true）", type: "boolean?" },
		{ name: "目标表格名称", description: "目标表格名称（默认当前表格）", type: "string?" }
	],
	result: { type: "any" }
});

function sum_xLookup(LookupValue, LookupRange, ReturnRange, NotFound, SearchMode, ExactMatch, OmitThisSheet) {
	// 手动设置默认值
	NotFound = NotFound === -2147352572 ? 0 : NotFound ?? 0;
	SearchMode = SearchMode === -2147352572 ? 1 : SearchMode ?? 1;
	ExactMatch = ExactMatch ?? true;
	OmitThisSheet = OmitThisSheet === -2147352572 ? false : OmitThisSheet ?? false;

	// 初始化
	var SumNum = 0;
	var sh0 = wps.ActiveSheet;
	Application.Volatile(false);

	// 遍历
	for (let i = 1; i <= wps.Sheets.Count; i++) {
		if (wps.Sheets.Item(i).Name === sh0.Name && OmitThisSheet) {
			//略过当前表
			continue;
		} else {
			var xl = xLookup(LookupValue, LookupRange, ReturnRange, NotFound, SearchMode, ExactMatch, wps.Sheets.Item(i).Name);
			if (typeof (xl) === "number") {
				SumNum += xl;
			}
		}
	}
	return SumNum;
}
wps.AddCustomFunction("ZW", "sum_xLookup", sum_xLookup, {
	description: "加总本workbook内全部sheet的对应range里搜索到的值",
	parameters: [
		{ name: "查找值", description: "要查找的值", type: "any" },
		{ name: "查找范围", description: "查找范围（单列）", type: "object" },
		{ name: "返回范围", description: "返回范围（单列）", type: "object" },
		{ name: "未找到值", description: "未找到时返回的值（默认0）", type: "number?" },
		{ name: "搜索模式", description: "搜索模式：1(正向)/-1(逆向)（默认1）", type: "number?" },
		{ name: "精确匹配", description: "是否精确匹配（默认true）", type: "boolean?" },
		{ name: "是否略过当前表", description: "是否略过当前表（默认false）", type: "boolean?" }
	],
	result: { type: "any" }
});

function sheetName(num) {
	wps.Volatile(1);
	num = num.Value2 ?? num;
	if (Number.isInteger(num) && num > 0) {
		return wps.Sheets.Item(num).Name;
	} else {
		return "参数num必须为正整数";
	}
}
wps.AddCustomFunction("ZW", "sheetName", sheetName, {
	description: "获得指定表的名称",
	parameters: [
		{ name: "表序号", description: "表的编号", type: "number" }
	],
	result: { type: "any" }
});

function resize(rng, cols) {
	cols = cols?.[0]?.[0] ?? rng[0].length;
	let data = rng.flat(Infinity);
	if (Number.isInteger(cols) && cols > 0) {
		return data.reduce((acc, cur) => {
			if (acc[acc.length - 1].length < cols) {
				acc[acc.length - 1].push(cur);
			} else {
				acc.push([cur]);
			}
			return acc;
		}, [[]]);
	} else {
		return "参数cols必须为正整数";
	}
}
wps.AddCustomFunction("ZW", "resize", resize, {
	description: "对指定区域按规则重排",
	parameters: [
		{ name: "目标区域", description: "指定区块或数组", type: "any[][]" },
		{ name: "行宽", description: "每行的元素个数", type: "number[][]?" }
	],
	result: { type: "any" }
});

function reverse(rng, method) {
	method = method?.[0]?.[0] ?? 0;
	if (![0, 1, 2].includes(method)) return "method:0.完全颠倒;1.上下颠倒;2.左右颠倒";
	if (method === 0) { // 完全颠倒
		return rng.map(x => x.reverse()).reverse();
	} else if (method === 1) { // 上下颠倒
		return rng.reverse();
	} else if (method === 2) { // 左右颠倒
		return rng.map(x => x.reverse());
	}
}
wps.AddCustomFunction("ZW", "reverse", reverse, {
	description: "对指定区域数组按规则颠倒",
	parameters: [
		{ name: "目标区域", description: "要颠倒的数组", type: "any[][]" },
		{ name: "方法：0.完全颠倒；1.上下颠倒；2.左右颠倒", description: "颠倒方法", type: "number[][]?" }
	],
	result: { type: "any" }
});

function join(rng, separator, regex, flags, replacer) {
	let arr = rng.flat(Infinity);
	separator = separator === -2147352572 ? "," : separator ?? ",";
	if (regex) {
		replacer = replacer ?? ""
		flags = isValidRegexModifier(flags) ? flags : undefined;
		arr = arr.map(x => String(x).replace(new RegExp(regex, flags), replacer));
	}
	return arr.join(separator);

	function isValidRegexModifier(modifiers) {
		if (typeof modifiers !== 'string') return false;
		const validModifiers = new Set('imgsuy'); // 所有合法的正则修饰词
		const chars = [...modifiers];
		// 1. 检查每个字符是否合法  2. 检查是否有重复字符
		return chars.every(char => validModifiers.has(char)) && new Set(chars).size === chars.length;
	}
}
wps.AddCustomFunction("ZW", "join", join, {
	description: "区域合并为单一字符串",
	parameters: [
		{ name: "目标区域", description: "指定区块或数组，包涵所有要合并的字符串", type: "any[][]" },
		{ name: "分隔符", description: "分隔符，默认\",\"", type: "string?" },
		{ name: "替换用正则表达式", description: "正则表达式，配合replacer使用，先替换再合并", type: "string?" },
		{ name: "正则表达式修饰符", description: "正则表达式修饰符，默认不设置", type: "string?" },
		{ name: "替换字符", description: "替换字符，默认为空字符串", type: "string?" }
	],
	result: { type: "string" }
});

function split(rng, separator) {
	let str = rng.map(x => String(x[0])).flat();
	separator = separator === -2147352572 ? "[。，、,|\. ]+" : separator ?? "[。，、,|\. ]+";
	return str.map(x => x.split(new RegExp(separator)));
}
wps.AddCustomFunction("ZW", "split", split, {
	description: "字符串拆分",
	parameters: [
		{ name: "目标区域", description: "指定区块或数组，包涵拟拆分的字符串，也可为单个字符串", type: "any[][]" },
		{ name: "分隔符", description: "分隔符，默认\"[。，、,|\\. ]+\"", type: "string?" }
	],
	result: { type: "any" }
});

function sliceRange(rng, fromRow, toRow, fromCol, toCol) {
	fromRow = fromRow === -2147352572 ? 0 : !Number.isInteger(fromRow) ? 0 : fromRow ?? 0;
	toRow = toRow === -2147352572 ? undefined : !Number.isInteger(toRow) ? undefined : toRow ?? undefined;
	fromCol = fromCol === -2147352572 ? 0 : !Number.isInteger(fromCol) ? 0 : fromCol ?? 0;
	toCol = toCol === -2147352572 ? undefined : !Number.isInteger(toCol) ? undefined : toCol ?? undefined;
	return rng.slice(fromRow, toRow).map(x => x.slice(fromCol, toCol));
}
wps.AddCustomFunction("ZW", "sliceRange", sliceRange, {
	description: "目标区域或数组进行截取",
	parameters: [
		{ name: "目标区域", description: "指定区块或数组", type: "any[][]" },
		{ name: "起始行位置", description: "起始行位置", type: "number?" },
		{ name: "结束行位置", description: "结束行位置", type: "number?" },
		{ name: "起始列位置", description: "起始列位置", type: "number?" },
		{ name: "结束列位置", description: "结束列位置", type: "number?" }
	],
	result: { type: "any" }
});

function sliceText(rng, from, to) {
	let arr = rng.map(x => x.map(y => String(y)));
	from = from === -2147352572 ? 0 : !Number.isInteger(from) ? 0 : from ?? 0;
	to = to === -2147352572 ? undefined : !Number.isInteger(to) ? undefined : to ?? undefined;
	return arr.map(x => x.map(y => y.slice(from, to)));
}
wps.AddCustomFunction("ZW", "sliceText", sliceText, {
	description: "字符串截取，对区域内的每个单元格内的字符串进行逐项处理",
	parameters: [
		{ name: "目标区域", description: "指定区块或数组，包涵拟截取的字符串", type: "any[][]" },
		{ name: "起始位置", description: "起始位置", type: "number?" },
		{ name: "结束位置", description: "结束位置", type: "number?" }
	],
	result: { type: "any" }
});

function randomPick(rng, count, showByVertical) {
	let arr = rng.flat(Infinity);
	count = count === -2147352572 && Number.isInteger(count) ? 5 : count ?? 5;
	showByVertical = showByVertical ?? true;
	let data = chance.pick(arr, count);
	return showByVertical ? _.zip(data) : data;
}
wps.AddCustomFunction("ZW", "randomPick", randomPick, {
	description: "随机选取",
	parameters: [
		{ name: "目标区域", description: "指定区块，包涵备选值", type: "any[][]" },
		{ name: "选取数量", description: "选取数量，默认5", type: "number?" },
		{ name: "输出方向：1.纵向输出；0.横向输出", description: "1：纵向输出，0：横向输出，默认纵向输出", type: "boolean?" }
	],
	result: { type: "any" }
});

function dateList(start, end, intervalYear, intervalMonth, intervalDay, fixDay) {
	// 参数设置
	start = start?.[0]?.[0] ?? start;
	end = end?.[0]?.[0] ?? end;
	intervalYear = intervalYear?.[0]?.[0] ?? intervalYear ?? 0;
	intervalYear = intervalYear < 0 ? 0 : intervalYear;
	intervalMonth = intervalMonth?.[0]?.[0] ?? intervalMonth ?? 0;
	intervalMonth = intervalMonth < 0 ? 0 : intervalMonth;
	intervalDay = intervalDay?.[0]?.[0] ?? intervalDay ?? 0;
	intervalDay = intervalDay < 0 ? 0 : intervalDay;
	if (intervalDay > 0) fixDay = undefined;
	if (intervalYear + intervalMonth + intervalDay === 0) intervalMonth = 3;
	if (fixDay?.[0]?.[0] && typeof (fixDay[0][0]) === "number") fixDay = fixDay[0][0];
	// 生成时间列表
	let dl = [];
	start = new Dayjs(start);
	let now = start;
	end = new Dayjs(end);
	dl.push([start]);
	if (fixDay) {
		if (fixDay > start.getDateDetail().day) {
			now = start.set("day", fixDay);
		} else {
			now = start.add("year", intervalYear).add("month", intervalMonth).add("day", intervalDay).set("day", fixDay);
		}
	} else {
		now = start.add("year", intervalYear).add("month", intervalMonth).add("day", intervalDay);
	}
	while (now < end) {
		dl.push([now])
		if (fixDay) {
			now = now.add("year", intervalYear).add("month", intervalMonth).add("day", intervalDay).set("day", fixDay);
		} else {
			now = now.add("year", intervalYear).add("month", intervalMonth).add("day", intervalDay);
		}
	}
	dl.push([end]);
	dl = dl.map(x => x.map(y => y.toNum()));
	return dl;
}
wps.AddCustomFunction("ZW", "dateList", dateList, {
	description: "按指定间隔生成日期序列",
	parameters: [
		{ name: "开始日期", description: "开始日期", type: "any[][]" },
		{ name: "结束日期", description: "结束日期", type: "any[][]" },
		{ name: "间隔的年数", description: "间隔的年数，四舍五入", type: "number[][]?" },
		{ name: "间隔的月数", description: "间隔的月数，四舍五入", type: "number[][]?" },
		{ name: "间隔的天数", description: "间隔的天数，四舍五入", type: "number[][]?" },
		{ name: "固定日期", description: "序列中固定使用指定的日期，默认为起始日的日期", type: "number[][]?" }
	],
	result: { type: "any" }
});

function byRow(rng, func) {
	// 预处理-func
	try {
		func = eval(func);
	} catch (err) {
		return err;
	}
	if (typeof (func) !== "function") {
		return "参数func格式需为函数字符串！";
	}
	// 对指定区域应用函数
	try {
		let outPut = rng.map(func);
		if (Array.isArray(outPut[0])) {
			return outPut;
		} else {
			return outPut.map(x => [x]);
		}
	} catch (err) {
		return err;
	}
}
wps.AddCustomFunction("ZW", "byRow", byRow, {
	description: "逐行应用函数，原生的该函数无法返回数组",
	parameters: [
		{ name: "目标区域", description: "指定区块或数组，包涵拟应用函数的值", type: "any[][]" },
		{ name: "函数(字符串)", description: "函数（建议使用JS箭头函数），参数为JS数组", type: "string" }
	],
	result: { type: "any" }
});

function byCol(rng, func) {
	rng = wps.WorksheetFunction.Transpose(rng);
	let outPut = byRow(rng, func);
	return wps.WorksheetFunction.Transpose(outPut);
}
wps.AddCustomFunction("ZW", "byCol", byCol, {
	description: "逐列应用函数，原生的该函数无法返回数组",
	parameters: [
		{ name: "目标区域", description: "指定区块或数组，包涵拟应用函数的值", type: "any[][]" },
		{ name: "函数(字符串)", description: "函数（建议使用JS箭头函数），参数为JS数组", type: "string" }
	],
	result: { type: "any" }
});

function unPivot(row, val, includeTitle) {
	includeTitle = includeTitle ?? true;
	try {
		// 辅助函数
		function removeBottomEmptyRows(arr) {
			const newArr = JSON.parse(JSON.stringify(arr));

			function isRowEmpty(row) {
				if (!row) return true;
				return row.every(item => item === '' || item === null || item === undefined);
			}
			let i = newArr.length - 1;
			while (i >= 0) {
				if (isRowEmpty(newArr[i])) {
					newArr.splice(i, 1);
				} else {
					break;
				}
				i--;
			}
			return newArr;
		}
		// 数据清洗
		if (row.hasOwnProperty("Value2")) { // Range对象
			row = wps.Intersect(row, row.Parent.UsedRange);
			if (Array.isArray(row.Value2)) { // 多行Range
				row = row.Value2;
			} else { // 单个单元格
				row = [[row.Value2]];
			}
		}
		if (val.hasOwnProperty("Value2")) { // Range对象
			val = wps.Intersect(val, val.Parent.UsedRange);
			if (Array.isArray(val.Value2)) { // 多行Range
				val = val.Value2;
			} else { // 单个单元格
				val = [[val.Value2]];
			}
		}
		row = removeBottomEmptyRows(row);
		val = removeBottomEmptyRows(val);
		if (row.length > val.length) {
			val = row.map((x, i) => val[i] ? val[i] : [""]);
		} else {
			row = val.map((x, i) => row[i] ? row[i] : [""]);
		}
		includeTitle = includeTitle ?? true;
		// 处理
		let result = [];
		if (includeTitle) {
			result.push(row[0].concat(["属性名", "属性值"]));
			row = row.slice(1);
			let stat = val[0];
			val = val.slice(1);
			for (i = 0; i < row.length; i++) {
				for (j = 0; j < stat.length; j++) {
					result.push(row[i].concat([stat[j], val[i][j]]));
				}
			}
		} else {
			let statCount = Math.max(...val.map(x => x.length));
			for (i = 0; i < row.length; i++) {
				for (j = 0; j < statCount; j++) {
					result.push(row[i].concat([`属性${j + 1}`, val[i][j]]));
				}
			}
		}
		return result.map(x => x.map(y => y ?? ""));
	} catch (err) {
		return err.message;
	}
}
wps.AddCustomFunction("ZW", "unPivot", unPivot, {
	description: "pivotBy的逆向函数",
	parameters: [
		{ name: "row", description: "行数组", type: "object" },
		{ name: "val", description: "值数组", type: "object" },
		{ name: "includeTitle", description: "数据是否包含标题行", type: "boolean?" }
	],
	result: { type: "any" }
});

function amortizedCost(dateList1, amountList1) {
	// 数据清洗
	dateList1 = dateList1.flat().map(item => new Dayjs(item).toNum());
	amountList1 = amountList1.flat().map(item => Number(item));
	if (Number.isNaN(dateList1[0])) {
		dateList1.shift();
		amountList1.shift();
	}
	let xirr = wps.WorksheetFunction.Xirr(amountList1, dateList1);
	if (dateList1.length !== amountList1.length) return "日期列表和现金流列表的长度不一致";
	// 处理
	let dateList2 = dateList([[dateList1[0]]], [[dateList1.at(-1)]], 0, 1, 0, 31).flat();
	dateList2 = _.uniq(dateList2.concat(dateList1).sort((a, b) => a - b));
	let interestList2 = [0];
	let amountList2 = [amountList1[0]];
	let now = 0;
	for (let i = 1; i < dateList2.length; i++) {
		let amount2 = amountList2[i - 1] * (1 + xirr) ** ((dateList2[i] - dateList2[i - 1]) / 365);
		let interest2 = amount2 - amountList2[i - 1];
		for (let j = now; j < dateList1.length; j++) {
			if (dateList1[j] === dateList2[i]) {
				amount2 = amount2 + amountList1[j];
				now = j;
				break;
			}
		}
		amountList2.push(amount2);
		interestList2.push(interest2);
	}
	let output = _.zip(dateList2, interestList2, amountList2);
	output.unshift(["日期", "本期利息收入", "摊余成本"]);
	return output;
}
wps.AddCustomFunction("ZW", "计算摊余成本", amortizedCost, {
	description: "计算摊余成本",
	parameters: [
		{ name: "日期列表", description: "日期列表", type: "any[][]" },
		{ name: "现金流列表", description: "现金流列表", type: "any[][]" }
	],
	result: { type: "any" }
});

function toPinyin(rng, toneType, separator) {
	// 参数缺省值识别（WPS 省略参数会传入 -2147352572）
	const isMissing = v => v === -2147352572 || v === undefined || v === null || v === "";
	toneType = isMissing(toneType) ? 1 : Number(toneType);
	separator = isMissing(separator) ? " " : String(separator);

	// 枚举校验，非法值回退默认
	if (![1,2,3].includes(toneType)) toneType = 1;

	const opts = { toneType, separator };

	// 单值（字符串/数字）：直接转换
	if (typeof rng === "string" || typeof rng === "number") {
		const text = String(rng ?? "");
		if (!text) return "";
		return globalThis.pinyin(text, opts);
	}

	// 2D 区域：逐格转换并按原形状输出
	if (Array.isArray(rng)) {
		return rng.map(row => (row || []).map(cell => {
			const text = String(cell ?? "");
			if (!text) return "";
			return globalThis.pinyin(text, opts);
		}));
	}
	return "";
}
wps.AddCustomFunction("ZW", "拼音", toPinyin, {
	description: "将中文转换为拼音",
	parameters: [
		{ name: "文本或区域", description: "中文字符串，或包含中文的单元格区域", type: "any[][]" },
		{ name: "声调样式:1.声调;2.无声调;3.数字声调", description: "1.声调(默认)；2.无声调；3.数字声调", type: "number?" },
		{ name: "分隔符", description: "拼音之间的分隔符，默认空格", type: "string?" }
	],
	result: { type: "any" }
});

// jsonFetch 改为返回 Promise，由 WPS 加载项原生等待决议
function jsonFetch(url) {
	// 辅助函数：转化json对象为二维数组
	function objectToDepth(obj) {
		const rows = []; // 存储 { path: Array, value: any }
		// 递归收集所有叶子节点
		function collect(current, currentPath) {
			// 处理 null / undefined -> 对应字符串，避免 WPS 单元格把 null/undefined 显示为 0
			if (current === null || current === undefined) {
				rows.push({ path: [...currentPath], value: String(current) });
				return;
			}
			const type = typeof current;
			// 基本类型
			if (type !== 'object') {
				rows.push({ path: [...currentPath], value: current });
				return;
			}
			// 特殊对象：Date, RegExp 视作叶子
			if (current instanceof Date || current instanceof RegExp) {
				rows.push({ path: [...currentPath], value: current.toString() });
				return;
			}
			// 空对象或空数组：本身作为一个叶子
			if (Array.isArray(current) && current.length === 0) {
				rows.push({ path: [...currentPath], value: [] });
				return;
			}
			if (!Array.isArray(current) && Object.keys(current).length === 0) {
				rows.push({ path: [...currentPath], value: {} });
				return;
			}
			// 非空数组：遍历索引
			if (Array.isArray(current)) {
				for (let i = 0; i < current.length; i++) {
					collect(current[i], [...currentPath, i]);
				}
				return;
			}
			// 非空对象：遍历所有自有属性
			for (const key of Object.keys(current)) {
				collect(current[key], [...currentPath, key]);
			}
		}
		collect(obj, []);
		if (rows.length === 0) return [];
		// 计算最大深度（路径长度）
		let maxDepth = 0;
		for (const row of rows) {
			maxDepth = Math.max(maxDepth, row.path.length);
		}
		// 构建最终二维数组：每一行 = path数组（不足尾端补空字符） + [value]
		const result = [];
		for (const row of rows) {
			const paddedPath = [...row.path];
			while (paddedPath.length < maxDepth) {
				paddedPath.push("");
			}
			result.push([...paddedPath, row.value]);
		}
		return result;
	}

	// 参数归一化：单元格传入时可能是 {Value2:...} 这种结构
	url = (url && typeof url.valueOf === "function") ? url.valueOf() : url;
	if (typeof url !== "string" || !url) {
		return "参数url需为字符串链接";
	}

	// 加载项异步模式：直接返回 Promise，引擎原生等待决议
	return new Promise((resolve) => {
		let settled = false;
		function done(value) {
			if (settled) return;
			settled = true;
			resolve(value);
		}
		try {
			const xhr = new XMLHttpRequest();
			xhr.open("GET", url, true);
			// Accept 允许设置；其他受保护头（User-Agent/Referer/Sec-*/Accept-Encoding）XHR 会拒绝，这里不再尝试
			try { xhr.setRequestHeader("Accept", "application/json, text/javascript, */*;q=0.8"); } catch (e) { }
			xhr.timeout = 30000;
			// onloadend 在成功/失败/超时都会触发，能拿到 status/readyState 用于诊断
			xhr.onloadend = function () {
				try {
					const status = xhr.status;
					const readyState = xhr.readyState;
					const text = xhr.responseText || "";
					// 网络层错误：status=0 且 readyState<4
					if (status === 0 && readyState !== 4) {
						console.log("[jsonFetch] 网络错误", { url, readyState, status, responseTextHead: text.slice(0, 200) });
						done(`请求失败(status=0, readyState=${readyState}, 可能原因: 跨域CORS/协议混合/DNS/TLS)`);
						return;
					}
					// status=0 但 readyState=4：常见于 file:// 协议、本地资源、被沙箱拦截
					if (status === 0 && readyState === 4) {
						console.log("[jsonFetch] readyState=4 但 status=0", { url, responseTextHead: text.slice(0, 200) });
						done(`请求被拦截(status=0, readyState=4, 可能: 沙箱/CORS/协议)`);
						return;
					}
					if (status >= 200 && status < 300) {
						let body = text;
						// 兼容 JSONP 包裹：xxx({...}) -> {...}
						let matched = /\w+\((.*)\)/.exec(body);
						if (matched) body = matched[1];
						try {
							const obj = JSON.parse(body);
							done(objectToDepth(obj));
						} catch (parseErr) {
							done("JSON 解析失败: " + parseErr.message);
						}
					} else {
						done(`HTTP ${status}${xhr.statusText ? " " + xhr.statusText : ""}`);
					}
				} catch (e) {
					done("Error: " + e.message);
				}
			};
			xhr.ontimeout = function () { done("请求超时"); };
			xhr.send();
		} catch (e) {
			done("Error: " + e.message);
		}
	});
}
wps.AddCustomFunction("ZW", "jsonFetch", jsonFetch, {
	description: "获取链接的JSON对象，并输出为二维表格",
	parameters: [
		{ name: "url", description: "链接", type: "string" }
	],
	result: { type: "any" }
});