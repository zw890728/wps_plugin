function Table(matrix, firstLineAsKey = true) {
	// matrix为二维数组，如果首行为key，则不能有重复值
	// 构造函数
	// 说明：_ (Lodash) 由 main.js 在本文件之前加载，已挂在全局作用域，无需 require
	Table.prototype.table = []; // 对象列表，格式[{"项目名":"xxx","余额":1000,...},...]
	Table.prototype.matrix = []; // 矩阵，格式[["项目名","余额",...],["xxx",1000,...],...]
	try {
		if (!Array.isArray(matrix) && !Array.isArray(matrix[0])) throw ("构造函数参数不为二维数组！");
		let keys = [];
		if (firstLineAsKey) {
			keys = matrix[0];
			this.table = matrix.slice(1).map(x => _.zipObject(keys, x));
		} else {
			// 52列，不够再加
			keys = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
			keys = keys.concat(keys.map(x => "A" + x));
			keys.length = matrix[0].length;
			this.table = matrix.map(x => _.zipObject(keys, x));
		}
		this.matrix = table2matrix(this.table);
	} catch (err) {
		console.log("Table对象构造失败：" + err.toString());
	}

	// 辅助函数
	function table2matrix(table) {
		// table格式转matrix格式
		let keys = [...new Set(table.flatMap(obj => Object.keys(obj)))];
		let matrix = [keys];
		table.forEach(obj => {
			let row = keys.map(key => obj.hasOwnProperty(key) ? obj[key] : null);
			matrix.push(row);
		});
		return matrix;
	}

	function matrix2table(matrix) {
		// matrix格式转table格式
		return matrix.slice(1).map(x => _.zipObject(matrix[0], x));
	}

	function isValueEqual(a, b, keyPairs) {
		// a,b为Object，对应key的值均相等则返回true
		let ok = true;
		for (let keyPair of keyPairs) {
			ok = ok && a[keyPair[0]] === b[keyPair[1]];
		}
		return ok;
	}

	function mergeObject(left, right, keyPairs, main) {
		// 将left和right两个对象合并，相同的key由main决定保留一个值，不同的key加上后缀后同时保留
		let obj = {};
		let a = _.mapKeys(left, (value, key) => (keyPairs.map(x => x[0]).includes(key) ? key : key + ".left"));
		let b = _.mapKeys(right, (value, key) => (keyPairs.map(x => x[1]).includes(key) ? key : key + ".right"));
		if (main === "left") {
			obj = _.defaults(a, b);
		} else if (main === "right") {
			obj = _.defaults(b, a);
		}
		return obj;
	}

	function rank(arr, sortFunc, duplicate) {
		// 将数组转换为排名
		// arr为要排名的数组，sortFunc为排序方法，duplicate为是否允许相同排名
		let rankMap = new Map();
		let sorted = arr.map((v, i) => ({
			v,
			i
		})).sort(_.overArgs(sortFunc, [x => x.v, x => x.v])); // 创建带索引的数组并排序
		if (duplicate) {
			let ranknum = 0;
			sorted.forEach((item, index, arr) => {
				if (index > 0 && arr[index - 1].v === item.v ) {
					rankMap.set(item.i, ranknum);
				} else {
					rankMap.set(item.i, index + 1);
					ranknum = index + 1;
				}
			});
		} else {
			sorted.forEach((item, index) => {
				rankMap.set(item.i, index + 1);
			});
		}
		return rankMap;
	}

	// 可调用函数
	Table.prototype.keys = function() {
		// 标题列表
		return this.matrix[0];
	}

	Table.prototype.print = function(rng) {
		// 输出到工作表
		try {
			if (!rng.AllowEdit) {
				// 字符串
				if (!(/^[A-Za-z]+.*[0-9]$/.test(rng))) throw "输出地址格式错误！"
				else rng = Range(rng);
			}
			let [n1, n2] = [this.matrix.length, this.matrix[0].length];
			rng.Resize(n1, n2).Value2 = this.matrix;
		} catch (err) {
			console.log("输出到表格失败：" + err.toString());
		}
	}

	Table.prototype.show = function() {
		// console窗口打印
		try {
			console.log(JSON.stringify(this.table, null, "\t"));
		} catch (err) {
			console.log("打印失败：" + err.toString());
		}
	}

	Table.prototype.rename = function(oldName, newName) {
		// 标题重命名
		try {
			let matrix = _.cloneDeep(this.matrix);
			for (let i in matrix[0]) {
				if (matrix[0][i] === oldName) {
					matrix[0][i] = newName;
				}
			}
			return new Table(matrix, true);
		} catch (err) {
			console.log("标题重命名失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.renameAll = function(regex, replacer) {
		// 标题重命名
		try {
			let matrix = _.cloneDeep(this.matrix);
			for (let i in matrix[0]) {
				matrix[0][i] = matrix[0][i].replace(regex, replacer);
			}
			return new Table(matrix, true);
		} catch (err) {
			console.log("标题重命名失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.rearrange = function(func, ...args) {
		// 按标题进行列顺序重排
		try {
			let matrix = _.unzip(this.matrix);
			if (Array.isArray(func)) {
				let matrixNew = [];
				let indexes = new Set();
				for (let i of func) {
					if (Number.isInteger(i) && i >= 0 && i < matrix.length) {
						matrixNew.push(matrix[i]);
						indexes.add(i);
					}
				}
				for (let i of Object.keys(matrix)) {
					if (!indexes.has(i)) {
						matrixNew.push(matrix[i]);
					}
				}
				matrix = matrixNew;
			} else if (typeof(func) === "function") {
				matrix = _.orderBy(matrix, _.overArgs(func, x => x[0]), ...args);
			} else if (typeof(func) === "string") {
				matrix = _.orderBy(matrix, x => x[0][func], ...args);
			} else {
				matrix = _.orderBy(matrix, x => x[0]);
			}
			matrix = _.unzip(matrix)
			return new Table(matrix, true);
		} catch (err) {
			console.log("列顺序重排失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.select = function(...cols) {
		// 选择若干列
		try {
			let selectedTable = this.table.map(row => {
				const newRow = {};
				cols.forEach(col => {
					if (row.hasOwnProperty(col)) {
						newRow[col] = row[col];
					}
				});
				return newRow;
			});
			return new Table(table2matrix(selectedTable), true);
		} catch (err) {
			console.log("选择列失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.drop = function(...cols) {
		// 删除若干列
		try {
			let selectedTable = this.table.map(row => _.omitBy(row, (value, key) => cols.includes(key)));
			return new Table(table2matrix(selectedTable), true);
		} catch (err) {
			console.log("删除列失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.copy = function(origin, added) {
		// 复制一列
		try {
			let matrix = _.cloneDeep(this.matrix);
			for (var i in matrix[0]) {
				if (matrix[0][i] === origin) {
					break
				}
			}
			matrix = [matrix[0].concat(added)].concat(matrix.slice(1).map(x => x.concat(x[i])))
			return new Table(matrix, true);
		} catch (err) {
			console.log("复制列失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.fix = function(col, func, sortFunc = (a, b) => (b - a), duplicate = false) {
		// 列数据修改
		try {
			let fixedTable = _.cloneDeep(this.table);
			if (!this.keys().includes(col)) throw ("不存在key：" + col);
			if (func === "rank") {
				let arr = this.table.map(x => x[col]);
				let rankMap = rank(arr, sortFunc, duplicate);
				fixedTable.forEach((row, index) => row[col] = rankMap.get(index));
			} else if (func === "%") {
				let sum = this.table.map(x => x[col]).slice(1).reduce((a, b) => (a + b));
				fixedTable.forEach(row => row[col] = row[col] / sum * 100 + "%");
			} else if (typeof(func) === "function") {
				fixedTable.forEach(row => row[col] = func(row[col]));
			} else {
				throw ("修改函数错误！");
			}
			return new Table(table2matrix(fixedTable), true);
		} catch (err) {
			console.log("列数据修改失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.sort = function(cols, orders) {
		// 排序
		try {
			let sortedTable = _.orderBy(this.table, cols, orders);
			return new Table(table2matrix(sortedTable), true);
		} catch (err) {
			console.log("排序失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.top = function(n) {
		// 前n条
		try {
			topTable = this.table.slice(0, n);
			return new Table(table2matrix(topTable), true);
		} catch (err) {
			console.log("获取前n条失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.filter = function(func) {
		// 筛选
		// 参数func：{"列名":function,...} 如：{"A":x=>x>0,"B":x=>x<0}
		//	         或者function 如：x=>(x.A>0 && x.B<0)
		let filteredTable = this.table;
		try {
			if (typeof(func) === "function") filteredTable = filteredTable.filter(func);
			else if (func instanceof Object) {
				for (let i of Object.keys(func)) {
					if (typeof(func[i]) === "function") filteredTable = filteredTable.filter(x => func[i](x[i]));
					else filteredTable = filteredTable.filter(x => x[i] === func[i]);
				}
			} else throw ("筛选函数错误！");
			if (filteredTable.length === 0) {
				filteredTable = matrix2table([this.matrix[0], this.matrix[0].fill(null)]);
			}
			return new Table(table2matrix(filteredTable), true);
		} catch (err) {
			console.log("筛选失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.find = function(func) {
		// 找出符合条件的值，与filter不同，主要针对统计量比较
		// 参数func：{"列名":function, "列名":stat, "列名":[stat, function...} 
		//	     如：{"A":x=>x>0,"B":"max","C":["mean",(x,mean)=>x>mean]}
		let foundTable = this.table;
		try {
			for (key of Object.keys(func)) {
				if (Array.isArray(func[key])) {
					func[key][0] = this.stat[func[key][0]](key);
					func[key] = _.partialRight(func[key][1], func[key][0]);
				}
				if (typeof(func[key]) === "string") {
					func[key] = this.stat[func[key]](key);
				}
			}
			return this.filter(func);
		} catch (err) {
			console.log("寻找复核条件的值失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.stat = {
		// 统计值计算函数集
		count: x => _.uniqBy(this.table, row => row[x]).length,
		sum: x => _.sumBy(this.table, row => row[x]),
		mean: x => _.meanBy(this.table, row => row[x]),
		median: x => _.medianBy(this.table, row => row[x]),
		max: x => _.maxBy(this.table, row => row[x])[x],
		min: x => _.minBy(this.table, row => row[x])[x],
		first: x => this.table.at(0)[x],
		last: x => this.table.at(-1)[x],
		stdevS: x => {
			let mean = _.meanBy(this.table, row => row[x]);
			let n = this.table.length - 1;
			let variance = this.table.reduce((a, b) => a + (b[x] - mean) ** 2, 0) / n;
			return Math.sqrt(variance);
		},
		stdevP: x => {
			let mean = _.meanBy(this.table, row => row[x]);
			let n = this.table.length;
			let variance = this.table.reduce((a, b) => a + (b[x] - mean) ** 2, 0) / n;
			return Math.sqrt(variance);
		},
		countBy: x => {
			if (typeof(x) === "function") return _.countBy(this.table, x).true;
			else return _.countBy(this.table, _.conforms(x)).true;
		}
	}

	Table.prototype.innerJoin = function(table, ...keyPairs) {
		// 表合并
		// 参数keyPairs：两个table合并时，作为key的键值对，组合后必须对应唯一一行数据，否则只会保留找到的首个。
		//               格式 ["key1Left","key1Right"],["key2Left","key2Right"],...
		try {
			let joinedTable = [];
			for (let i of this.table) {
				for (let j of table.table) {
					if (isValueEqual(i, j, keyPairs)) {
						joinedTable.push(mergeObject(i, j, keyPairs, "left"));
						break;
					}
				}
			}
			return new Table(table2matrix(joinedTable), true);
		} catch (err) {
			console.log("innerJoin失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.leftJoin = function(table, ...keyPairs) {
		// 参数keyPairs：两个table合并时，作为key的键值对，组合后必须对应唯一一行数据，否则只会保留找到的首个。
		//               格式 ["key1Left","key1Right"],["key2Left","key2Right"],...
		try {
			let joinedTable = [];
			for (let i of this.table) {
				let hasSameValueForKeyPairs = false;
				for (let j of table.table) {
					if (isValueEqual(i, j, keyPairs)) {
						hasSameValueForKeyPairs = true;
						joinedTable.push(mergeObject(i, j, keyPairs, "left"));
						break;
					}
				}
				if (!hasSameValueForKeyPairs) {
					joinedTable.push(mergeObject(i, {}, keyPairs, "left"));
				}
			}
			return new Table(table2matrix(joinedTable), true);
		} catch (err) {
			console.log("leftJoin失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.rightJoin = function(table, ...keyPairs) {
		// 参数keyPairs：两个table合并时，作为key的键值对，组合后必须对应唯一一行数据，否则只会保留找到的首个。
		//               格式 ["key1Left","key1Right"],["key2Left","key2Right"],...
		try {
			let joinedTable = [];
			for (let j of table.table) {
				let hasSameValueForKeyPairs = false;
				for (let i of this.table) {
					if (isValueEqual(i, j, keyPairs)) {
						hasSameValueForKeyPairs = true;
						joinedTable.push(mergeObject(i, j, keyPairs, "right"));
						break;
					}
				}
				if (!hasSameValueForKeyPairs) {
					joinedTable.push(mergeObject({}, j, keyPairs, "right"));
				}
			}
			return new Table(table2matrix(joinedTable), true);
		} catch (err) {
			console.log("rightJoin失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.outerJoin = function(table, ...keyPairs) {
		// 参数keyPairs：两个table合并时，作为key的键值对，组合后必须对应唯一一行数据，否则只会保留找到的首个。
		//               格式 ["key1Left","key1Right"],["key2Left","key2Right"],...
		try {
			let joinedTable = [];
			let leftTableClone = _.cloneDeep(this.table);
			let rightTableClone = _.cloneDeep(table.table);
			for (let iIndex = 0; iIndex < leftTableClone.length; iIndex++) {
				for (let jIndex = 0; jIndex < rightTableClone.length; jIndex++) {
					if (isValueEqual(leftTableClone[iIndex], rightTableClone[jIndex], keyPairs)) {
						_.pullAt(leftTableClone, iIndex);
						_.pullAt(rightTableClone, jIndex);
						iIndex--;
						jIndex--;
					}
				}
			}
			for (let i of leftTableClone) {
				joinedTable.push(mergeObject(i, {}, keyPairs, "left"));
			}
			for (let j of rightTableClone) {
				joinedTable.push(mergeObject({}, j, keyPairs, "right"));
			}
			return new Table(table2matrix(joinedTable), true);
		} catch (err) {
			console.log("outerJoin失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.fullJoin = function(table, ...keyPairs) {
		// 参数keyPairs：两个table合并时，作为key的键值对，组合后必须对应唯一一行数据，否则只会保留找到的首个。
		//               格式 ["key1Left","key1Right"],["key2Left","key2Right"],...
		try {
			let joinedTable = [];
			let rightTableClone = _.cloneDeep(table.table);
			for (let i of this.table) {
				let hasSameValueForKeyPairs = false;
				for (let jIndex = 0; jIndex < rightTableClone.length; jIndex++) {
					if (isValueEqual(i, rightTableClone[jIndex], keyPairs)) {
						hasSameValueForKeyPairs = true;
						joinedTable.push(mergeObject(i, rightTableClone[jIndex], keyPairs, "left"));
						_.pullAt(rightTableClone, jIndex);
						break;
					}
				}
				if (!hasSameValueForKeyPairs) {
					joinedTable.push(mergeObject(i, {}, keyPairs, "left"));
				}
			}
			for (let j of rightTableClone) {
				joinedTable.push(mergeObject({}, j, keyPairs, "right"));
			}
			return new Table(table2matrix(joinedTable), true);
		} catch (err) {
			console.log("fullJoin失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.uniq = function(key, criteriaAdd) {
		// 将key列取唯一值，其他列若为数字则sum，若为其他则first，obj按指定方法汇总
		// 参数obj：键值对集合，如[["A","sum"],["B","first"]]
		try {
			key = typeof(key) === "string" ? [key] : key;
			let criteria = []; // 整合标准
			for (let col of Object.keys(this.table[0])) {
				if (!key.includes(col)) {
					if (typeof(this.table[0][col]) === "number") {
						criteria.push([col, "sum"]);
					} else {
						criteria.push([col, "first"]);
					}
				}
			}
			criteria = Object.fromEntries(criteria);
			if (criteriaAdd) Object.assign(criteria, Object.fromEntries(criteriaAdd));
			criteria = Object.entries(criteria); // 最终的整合标准
			if (Array.isArray(key)) {
				return this.groupBy(...key).aggregate(criteria);
			} else {
				throw ("唯一值目标列名称错误");
			}
		} catch (err) {
			console.log("取唯一值失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.unpivot = function(pivotColName, valueColName) {
		// pivot反向，返回GroupTable对象
		// pivotColName, valueColName为新增的两列名称
		try {
			let dataGroupCol = this.matrix.map(x => x[0]).slice(1);
			let dataPivotCol = this.matrix[0].slice(1);
			let matrix = [
				[this.matrix[0][0], pivotColName, valueColName]
			];
			for (let i = 0; i < dataGroupCol.length; i++) {
				for (let j = 0; j < dataPivotCol.length; j++) {
					matrix.push([dataGroupCol[i], dataPivotCol[j], this.matrix[i + 1][j + 1]]);
				}
			}
			return new Table(matrix, true).groupBy(matrix[0][0]);
		} catch (err) {
			console.log("unpivot失败：" + err.toString());
			return this;
		}
	}

	Table.prototype.groupBy = function(...cols) {
		// 聚类，返回GroupTable对象
		try {
			let groupTable = {}
			if (cols.length === 1) {
				// 单层分组
				groupTable = _.groupBy(this.table, x => x[cols])
			} else {
				// 多层分组，递归法逐级嵌套，越靠前的参数越在外层
				groupTable = _.groupBy(this.table, x => x[cols[0]])
				for (let i of Object.keys(groupTable)) { // i对应上一层分组的可取值
					groupTable[i] = new Table(table2matrix(groupTable[i]), true).groupBy(...cols.slice(1)).groupTable;
				}
			}
			return new GroupTable(cols, groupTable, new Table(this.matrix, true));
		} catch (err) {
			console.log("聚类失败：" + err.toString());
			return this;
		}
	}

	function GroupTable(groupCols, groupTable, tableObj) {
		// groupTable变量格式：
		//		{
		//			a1: {
		//				b1: [{
		//					a: a1,
		//					b: b1,
		//					c: c1
		//				}, {
		//					a: a1,
		//					b: b1,
		//					c: c1
		//				}],
		//				b2: [{
		//					a: a1,
		//					b: b2,
		//					c: c1
		//				}, {
		//					a: a1,
		//					b: b2,
		//					c: c1
		//				}]
		//			},
		//			...
		//		}
		this.groupCols = groupCols; // 用于分组的列数组
		this.groupTable = groupTable; // 分组后形成的Object，key为分组列的全部可取值，可能有多级嵌套
		this.tableObj = tableObj; // 分组前Table对象的复制
		this.colsAddedForPivot = []; // 临时对象，拟pivot列的值数组（用于在多重group时指向顶层）
		this.stat = {}; // 临时对象，aggregate时，用于存放统计值（用于在多重group时指向顶层）
		this.table = []; // 临时对象，ungroup时，用于存放根据groupTable转化的table数组（用于在多重group时指向顶层）

		// 辅助函数
		function obj2arr(obj) {
			// 在aggregate、pivot函数中应用
			// 将{x:{a:[a1,a2],b:[b1,b2]},...}转换成[[x,a,a1,a2],[x,b,b1,b2],...]格式，可进一步嵌套
			obj = _.cloneDeep(obj);
			if (Array.isArray(obj)) {
				return obj;
			}
			if (Array.isArray(Object.values(obj)[0])) {
				let arr = [];
				for (let i of Object.keys(obj)) {
					let tmp = obj[i];
					tmp.unshift(i);
					arr.push(tmp);
				}
				return arr;
			}
			let arr = [];
			for (let i of Object.keys(obj)) {
				let tmp = obj2arr(obj[i]);
				for (let j of tmp) {
					j.unshift(i);
					arr.push(j);
				}
			}
			return arr;
		}

		// 可调用函数
		GroupTable.prototype.show = function() {
			// console打印
			try {
				console.log(JSON.stringify(this.groupTable, null, "\t"));
			} catch (err) {
				console.log("打印失败：" + err.toString());
			}
		}

		GroupTable.prototype.ungroup = function(gt = this.groupTable, depth = 0) {
			// GroupTable对象转为Table对象
			try {
				if (Array.isArray(Object.values(gt)[0])) {
					// 底层（键值是数组，包括本group的所有元素），所有数组插入table
					for (let table of Object.values(gt)) {
						this.table = this.table.concat(table);
					}
				} else {
					// 非底层，进行递归，进入下一层
					for (let groupName of Object.keys(gt)) {
						this.ungroup(gt[groupName], depth + 1);
					}
				}
				// 函数返回值
				if (depth === 0) {
					// 顶层，调整格式，输出为Table对象
					return new Table(table2matrix(this.table), true);
				}
			} catch (err) {
				console.log("ungroup失败：" + err.toString());
				return this.tableObj;
			}
		}

		GroupTable.prototype.fix = function(col, func, sortFunc = (a, b) => (b - a), duplicate = false, groupTable = this.groupTable, depth = 0) {
			// 列数据修改
			let gt = _.cloneDeep(groupTable); // groupTable对象的复制，后续会将最深层级的数据按要求进行修订
			try {
				// 修改gt对象
				if (!this.tableObj.keys().includes(col)) throw ("不存在key：" + col);
				if (Array.isArray(Object.values(gt)[0])) {
					// 底层（键值是数组，包括本group的所有元素），按要求修改每个元素
					for (let key of Object.keys(gt)) {
						if (func === "rank") {
							let arr = gt[key].map(x => x[col]);
							let rankMap = rank(arr, sortFunc, duplicate);
							gt[key].forEach((row, index) => row[col] = rankMap.get(index));
						} else if (func === "%") {
							let sum = gt[key].map(x => x[col]).reduce((a, b) => (a + b));
							gt[key].forEach(row => row[col] = row[col] / sum * 100 + "%");
						} else if (typeof(func) === "function") {
							gt[key].forEach(row => row[col] = func(row[col]));
						} else {
							throw ("修改函数错误！");
						}
					}
				} else {
					// 非底层，进行递归，进入下一层
					for (let groupName of Object.keys(gt)) {
						gt[groupName] = this.fix(col, func, sortFunc, duplicate, gt[groupName], depth + 1);
					}
				}
				// 函数返回值
				if (depth > 0) {
					// 深层，返回当前层gt到上一层
					return gt;
				} else {
					// 顶层，调整格式，输出为Table对象
					return new GroupTable(this.groupCols, gt, this.ungroup(gt));
				}
			} catch (err) {
				console.log("列数据修改失败：" + err.toString());
				return this;
			}
		}

		GroupTable.prototype.aggregate = function(criteria, groupTable = this.groupTable, depth = 0) {
			// 参数criteria：键值对集合，如[["A","sum"],["B","first"],["B","count"],["C","sum","%"]] 
			let gc = Array.from(this.groupCols); // 列名列表
			let gt = _.cloneDeep(groupTable); // groupTable对象的复制，后续会将最深层级的数据更换成一行统计值
			try {
				// 顶层初始化
				if (depth === 0) {
					// 默认criteria生成
					if (!criteria) {
						criteria = [];
						for (let col of Object.keys(this.tableObj.table[0])) {
							if (!this.groupCols.includes(col)) {
								if (typeof(this.tableObj.table[0][col]) === "number") {
									criteria.push([col, "sum"]);
								} else {
									criteria.push([col, "count"]);
								}
							}
						}
					}
					// 生成列名列表，包括aggregate的所有目标
					for (let agCol of criteria) {
						if (agCol[2] === "%") {
							gc.push(agCol[1] + "%:" + agCol[0]);
						} else if(agCol[1] === "lambda") {
							gc.push(agCol[3] ?? "lambda" + ":" + agCol[0]);
						} else {
							gc.push(agCol[1] + ":" + agCol[0]);
						}
					}
					// 计算整体统计值，用于计算单项百分比（重复值会被替换）
					for (let agCol of criteria) {
						if (agCol[2] === "%") {
							this.stat[agCol[1] + ":" + agCol[0]] = this.tableObj.stat[agCol[1]](agCol[0]);
						}
					}
				}
				// 修改gt对象
				if (Array.isArray(Object.values(gt)[0])) {
					// 底层（键值是数组，包括本group的所有元素），修改后每个groupName键对应一行统计值
					for (let groupName of Object.keys(gt)) {
						let aggregation = []; // groupName对应的一行统计值
						let tmp = new Table(table2matrix(gt[groupName]), true);
						for (let agCol of criteria) {
							if (agCol[2] === "%") {
								aggregation.push(tmp.stat[agCol[1]](agCol[0]) / this.stat[agCol[1] + ":" + agCol[0]] * 100 + "%");
							} else {
								tmp.stat[agCol[1]] = agCol[1] === "lambda" ? x => agCol[2](tmp.table.map(row => row[x])) : tmp.stat[agCol[1]];
								aggregation.push(tmp.stat[agCol[1]](agCol[0]));
							}
						}
						gt[groupName] = aggregation;
					}
				} else {
					// 非底层，进行递归，进入下一层
					for (let groupName of Object.keys(gt)) {
						gt[groupName] = this.aggregate(criteria, gt[groupName], depth + 1);
					}
				}
				// 函数返回值
				if (depth > 0) {
					// 深层，返回当前层gt到上一层
					return gt;
				} else {
					// 顶层，调整格式，输出为Table对象
					return new Table([gc].concat(obj2arr(gt)), true);
				}
			} catch (err) {
				console.log("aggregate失败：" + err.toString());
				return this.tableObj;
			}
		}

		GroupTable.prototype.pivot = function(pivotCol, valueCol, statMethod, groupTable = this.groupTable, depth = 0) {
			let gc = Array.from(this.groupCols); // 列名列表
			let gt = _.cloneDeep(groupTable); // groupTable对象的复制
			try {
				// 顶层初始化
				if (depth === 0) {
					// 生成列名列表，包括pivotCol对应的全部取值
					this.colsAddedForPivot = _.uniq(this.tableObj.select(pivotCol).matrix.slice(1).flat());
					gc = gc.concat(this.colsAddedForPivot.map(x => x + "." + statMethod + ":" + valueCol));
				}
				// 修改gt对象
				if (Array.isArray(Object.values(gt)[0])) {
					// 底层（键值是数组，包括本group的所有元素），修改后每个groupName键对应一行统计值
					for (let groupName of Object.keys(gt)) {
						let pivot = [];
						let tmp = new Table(table2matrix(gt[groupName]), true);
						for (let pivotValue of this.colsAddedForPivot) {
							tmp.filter(x => x[pivotCol] === pivotValue);
							pivot.push(tmp.stat[statMethod](valueCol));
						}
						gt[groupName] = pivot;
					}
				} else {
					// 非底层，进行递归，进入下一层
					for (let groupName of Object.keys(gt)) {
						gt[groupName] = this.pivot(pivotCol, valueCol, statMethod, gt[groupName], depth + 1);
					}
				}
				// 函数返回值
				if (depth > 0) {
					// 深层，返回当前层gt到上一层
					return gt;
				} else {
					// 顶层，调整格式，输出为Table对象
					return new Table([gc].concat(obj2arr(gt)), true);
				}
			} catch (err) {
				console.log("pivot失败：" + err.toString());
				return new Table(table2matrix(this.tableObj), true);
			}
		}
	}
}

// UMD 模块导出 (兼容 CommonJS / AMD / 全局变量 / WPS 环境)
(function (root, factory) {
	if (typeof module === 'object' && module.exports) {
		// Node.js / CommonJS
		var exportsObj = factory();
		module.exports = exportsObj;
		module.exports.Table = exportsObj;
		module.exports.default = exportsObj;
	} else if (typeof define === 'function' && define.amd) {
		// AMD
		define([], factory);
	}
	// 浏览器 / WPS 全局
	if (typeof root !== 'undefined') {
		root.Table = factory();
	}
}(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
	return Table;
}));