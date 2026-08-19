class Dayjs {
	constructor(date = new Date()) {
		if (typeof(date) === 'string') { //字符串
			date = new Date(date);
		} else if (Number.isInteger(date)) { //数字
			const daysFrom1970 = date - 25569;
			const timeSince1970 = daysFrom1970 * 24 * 60 * 60 * 1000;
			date = new Date(timeSince1970);
		} else if (date instanceof Dayjs) { //Dayjs对象
			date = date.getDate();
		} else if (Object.prototype.toString.call(date) !== '[object Date]') { //其他格式改用默认值
			date = new Date();
		}
		this.#date = date;
		this.#year = date.getFullYear();
		this.#month = date.getMonth() + 1;
		this.#day = date.getDate();
		this.#hours = date.getHours();
		this.#minutes = date.getMinutes();
		this.#seconds = date.getSeconds();
		this.REGEX_FORMAT = /y{1,4}|m{1,2}|d{1,2}|H{1,2}|M{1,2}|S{1,2}/g;
	}

	static random(obj, maxTry = 10) {
		// obj对象包括{min,max,year,month,day}
		// 参数初始化
		if (maxTry == 0) return "随机失败";
		if (obj && obj.max) {
			var max = new Dayjs(obj.max);
		} else {
			var max = 2958465;
		}
		if (obj && obj.min) {
			var min = new Dayjs(obj.min);
		} else {
			var min = 1;
		}
		// 随机
		let randomNumScaled = Math.floor(Math.random() * 10000001) / 10000000;
		let dateNum = Math.round(randomNumScaled * (max - min) + min);
		let dayjs = new Dayjs(dateNum); // min和max间的随机日期
		// 按要求修正
		if (obj && Number.isInteger(obj.year) && obj.year >= 1900 && obj.year <= 9999) {
			dayjs = dayjs.set("year", obj.year);
		}
		if (obj && Number.isInteger(obj.month) && obj.month >= 1 && obj.month <= 12) {
			dayjs = dayjs.set("month", obj.month);
		}
		if (obj && Number.isInteger(obj.day) && obj.day >= 1 && obj.day <= 31) {
			dayjs = dayjs.set("day", obj.day);
		}
		// 输出
		if (dayjs < min || dayjs > max ) { // 修改导致超出范围
			return Dayjs.random(obj, maxTry - 1);
		}
		if (obj && Number.isInteger(obj.day) && obj.day != dayjs.#day) { // 修改日期失败
			return Dayjs.random(obj, maxTry - 1);
		} 
		return dayjs;
	}

	#patchZero(num) {
		return num < 10 ? '0' + num : num;
	}

	getDateDetail() {
		return {
			year: this.#year,
			month: this.#month,
			day: this.#day,
			hours: this.#hours,
			minutes: this.#minutes,
			seconds: this.#seconds,
		}
	}

	getDate() {
		return this.#date;
	}

	#getMatches({
		year,
		month,
		day,
		hours,
		minutes,
		seconds
	}) {
		return {
			yyyy: year,
			yy: String(year).slice(-2),
			mm: this.#patchZero(month),
			m: month,
			dd: this.#patchZero(day),
			d: day,
			HH: this.#patchZero(hours),
			H: hours,
			MM: this.#patchZero(minutes),
			M: minutes,
			SS: this.#patchZero(seconds),
			S: seconds,
		}
	}

	toString() {
		return this.format();
	}

	toJSON() {
		return this.format();
	}

	valueOf() {
		return this.toNum();
	}

	format(template = 'yyyy-mm-dd') {
		const detail = this.getDateDetail();
		const matches = this.#getMatches(detail);
		return template.replace(this.REGEX_FORMAT, function(match) {
			return matches[match];
		})
	}

	isLeapYear(year = this.#year) { //判断是否为闰年
		if (year == 1900) return true; //1900年存在bug,必须赋值为true
		return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	}

	toNum() {
		let days = 0; //初始化距离天数为0		
		for (let y = 1900; y < this.#year; y++) { //循环判断是否为闰年
			days += (this.isLeapYear(y) ? 366 : 365);
		}
		for (let m = 1; m < this.#month; m++) { //循环取每个月有多少天
			let daysInMonth = new Date(this.#year, m, 0).getDate();
			days += daysInMonth;
		}
		days += this.#day; //累加天数
		return days;
	}

	set(scale, n) {
		let seconds = this.#seconds;
		let minutes = this.#minutes;
		let hours = this.#hours;
		let day = this.#day;
		let month = this.#month;
		let year = this.#year;
		let date = this.#date;
		n = Math.round(n);
		if (scale === "seconds") {
			seconds = n < 0 ? 0 : n > 59 ? 59 : n;
		} else if (scale === "minutes") {
			minutes = n < 0 ? 0 : n > 59 ? 59 : n;
		} else if (scale === "hours") {
			hours = n < 0 ? 0 : n > 23 ? 23 : n;
		} else if (scale === "day") {
			if ([1, 3, 5, 7, 8, 10, 12].includes(month)) {
				day = n < 1 ? 1 : n > 31 ? 31 : n;
			} else if ([4, 6, 9, 11].includes(month)) {
				day = n < 1 ? 1 : n > 30 ? 30 : n;
			} else {
				if (this.isLeapYear()) {
					day = n < 1 ? 1 : n > 29 ? 29 : n;
				} else {
					day = n < 1 ? 1 : n > 28 ? 28 : n;
				}
			}
		} else if (scale === "month") {
			month = n < 1 ? 1 : n > 12 ? 12 : n;
			if ([4,6,9,11].includes(month) && day > 30) day =30;
			if (2 === month && this.isLeapYear() && day > 29) day =29;
			if (2 === month && !this.isLeapYear() && day > 28) day =28;
		} else if (scale === "year") {
			year = n;
		}
		date = new Date(`${year}-${this.#patchZero(month)}-${this.#patchZero(day)}T${this.#patchZero(hours)}:${this.#patchZero(minutes)}:${this.#patchZero(seconds)}`);
		if (scale === "date") {
			date = new Date(n);
		}
		return new Dayjs(date);
	}

	add(scale, n) {
		let seconds = this.#seconds;
		let minutes = this.#minutes;
		let hours = this.#hours;
		let day = this.#day;
		let month = this.#month;
		let year = this.#year;
		let time = this.#date.getTime();
		if (scale === "seconds") {
			time += n;
		} else if (scale === "minutes") {
			time += n * 1000 * 60;
		} else if (scale === "hours") {
			time += n * 1000 * 60 * 60;
		} else if (scale === "day") {
			time += n * 1000 * 60 * 60 * 24;
		} else if (scale === "week") {
			time += n * 1000 * 60 * 60 * 24 * 7;
		} else if (scale === "month") {
			year += Math.floor((month + n - 1) / 12);
			month = month + Math.round(n % 12) <= 0 ? month + Math.round(n % 12) + 12 : month + Math.round(n % 12) > 12 ? month + Math.round(n % 12) - 12 : month + Math.round(n % 12);
			let date = new Date(`${year}-${this.#patchZero(month)}-${this.#patchZero(day)}T${this.#patchZero(hours)}:${this.#patchZero(minutes)}:${this.#patchZero(seconds)}`);
			for (let i = 0; i < 3; i++) {
				if (date.getMonth() + 1 > month) {
					day -= 1;
					date = new Date(`${year}-${this.#patchZero(month)}-${this.#patchZero(day)}T${this.#patchZero(hours)}:${this.#patchZero(minutes)}:${this.#patchZero(seconds)}`);
				} else {
					break;
				}
			}
			time = date.getTime();
		} else if (scale === "year") {
			year += Math.round(n);
			time = new Date(`${year}-${this.#patchZero(month)}-${this.#patchZero(day)}T${this.#patchZero(hours)}:${this.#patchZero(minutes)}:${this.#patchZero(seconds)}`).getTime();
		}
		return new Dayjs(new Date(time));
	}

	startOfMonth() {
		return this.set("day", 1);
	}

	startOfYear() {
		return this.set("month", 1).set("day", 1);
	}

	endOfMonth() {
		return this.add("month", 1).set("day", 1).add("day", -1);
	}

	endOfYear() {
		return this.set("month", 12).set("day", 31);
	}

	after(dayjs) {
		let result = 0;
		if (typeof(dayjs) === 'string' || Number.isInteger(dayjs)) { //字符串 or 数字
			dayjs = new Dayjs(dayjs);
		}
		if (dayjs instanceof Dayjs) {
			let time1 = dayjs.getDate().getTime();
			let time2 = this.#date.getTime();
			result = (time2 - time1) / 24 / 60 / 60 / 1000;
		}
		return result;
	}

	before(dayjs) {
		let result = 0;
		if (typeof(dayjs) === 'string' || Number.isInteger(dayjs)) { //字符串 or 数字
			dayjs = new Dayjs(dayjs);
		}
		if (dayjs instanceof Dayjs) {
			let time1 = this.#date.getTime();
			let time2 = dayjs.getDate().getTime();
			result = (time2 - time1) / 24 / 60 / 60 / 1000;
		}
		return result;
	}

	is(dayjs) {
		let result = false;
		if (typeof(dayjs) === 'string' || Number.isInteger(dayjs)) { //字符串 or 数字
			dayjs = new Dayjs(dayjs);
		}
		if (dayjs instanceof Dayjs) {
			result = this.#year === dayjs.#year && this.#month === dayjs.#month && this.#day === dayjs.#day;
		}
		return result;
	}

	isAfter(dayjs) {
		let result = false;
		if (typeof(dayjs) === 'string' || Number.isInteger(dayjs)) { //字符串 or 数字
			dayjs = new Dayjs(dayjs);
		}
		if (dayjs instanceof Dayjs) {
			result = this.#date.getTime() > dayjs.#date.getTime();
		}
		return result;
	}

	isBefore(dayjs) {
		let result = false;
		if (typeof(dayjs) === 'string' || Number.isInteger(dayjs)) { //字符串 or 数字
			dayjs = new Dayjs(dayjs);
		}
		if (dayjs instanceof Dayjs) {
			result = this.#date.getTime() < dayjs.#date.getTime();
		}
		return result;
	}

	isBetween(dayjs1, dayjs2) {
		let result = false;
		if (typeof(dayjs1) === 'string' || Number.isInteger(dayjs1)) { //字符串 or 数字
			dayjs1 = new Dayjs(dayjs1);
		}
		if (typeof(dayjs2) === 'string' || Number.isInteger(dayjs2)) { //字符串 or 数字
			dayjs2 = new Dayjs(dayjs2);
		}
		if (dayjs1 instanceof Dayjs && dayjs2 instanceof Dayjs) {
			result = (this.#date.getTime() >= dayjs1.#date.getTime() && this.#date.getTime() <= dayjs2.#date.getTime()) ||
				(this.#date.getTime() >= dayjs2.#date.getTime() && this.#date.getTime() <= dayjs1.#date.getTime())

		}
		return result;
	}

	weekday() {
		if (this.#date.getDay() === 0) return 7;
		else return this.#date.getDay();
	}

	weekdayOfTheMonth(weekday = this.weekday()) {
		let result = ["#"];
		let day1 = this.startOfMonth();
		let step = weekday - day1.weekday() >= 0 ? weekday - day1.weekday() : weekday - day1.weekday() + 7;
		for (let i = 0; i < 5; i++) {
			let next = new Dayjs(day1 + step)
			if (next.getDateDetail().month > this.#month) {
				break;
			}
			result.push(next);
			step += 7;
		}
		return result;
	}

	weekdayOfTheYear(weekday = this.weekday()) {
		let result = ["#"];
		let day1 = this.startOfYear();
		let step = weekday - day1.weekday() >= 0 ? weekday - day1.weekday() : weekday - day1.weekday() + 7;
		for (let i = 0; i < 52; i++) {
			let next = new Dayjs(day1 + step)
			if (next.getDateDetail().year > this.#year) {
				break;
			}
			result.push(next);
			step += 7;
		}
		return result;
	}

	nextWeekday(weekday = this.weekday(), nth = 1) {
		let step = weekday - this.weekday() > 0 ? weekday - this.weekday() : weekday - this.weekday() + 7;
		step += (nth - 1) * 7;
		return this.add("day", step);
	}

	lastWeekday(weekday = this.weekday(), nth = 1) {
		let step = weekday - this.weekday() > 0 ? weekday - this.weekday() - 7 : weekday - this.weekday();
		step -= (nth - 1) * 7;
		return this.add("day", step);
	}

	#date;
	#year;
	#month;
	#day;
	#hours;
	#minutes;
	#seconds;
}

// UMD 模块导出 (兼容 CommonJS / AMD / 全局变量 / WPS 环境)
(function (root, factory) {
	if (typeof module === 'object' && module.exports) {
		// Node.js / CommonJS
		var exportsObj = factory();
		module.exports = exportsObj;
		module.exports.Dayjs = exportsObj;
		module.exports.default = exportsObj;
	} else if (typeof define === 'function' && define.amd) {
		// AMD
		define([], factory);
	}
	// 浏览器 / WPS 全局
	if (typeof root !== 'undefined') {
		root.Dayjs = factory();
	}
}(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
	return Dayjs;
}));