// ============================================================
// Chance 随机填充 对话框逻辑
//
// 本文件由 ui/ChanceFill.html 引入，运行在 ShowDialog 打开的独立窗口上下文中，
// 所有 WPS 对象通过 window.Application 访问（与 js/dialog.js / js/calc.js 一致）。
// 加载顺序：Lodash.js → Dayjs.js → Chance.js → ChanceFill.js
// 全局变量 chance 由 Chance.js 暴露。
// ============================================================

// ---------- 参数类型说明 ----------
// type 取值：
//   "select"   下拉，需提供 options:["a","b"]
//   "number"   数字输入，可配 min/max
//   "checkbox" 布尔复选框
//   "text"     单行文本
//   "textlist" 逗号分隔字符串，build 中解析为数组
// build(p) 接收 {key:value,...}，返回生成的随机值（出错时抛异常，调用方捕获）

var CHANCE_FUNCS = {
    "Basics 基础": [
        {
            name: "bool",
            desc: "生成随机布尔值（true/false）。",
            params: [
                { key: "likelihood", label: "true 概率(%)", type: "number", default: 90, min: 0, max: 100, hint: "返回 true 的概率百分比（0-100）" }
            ],
            build: function (p) { return chance.bool({ likelihood: Number(p.likelihood) }); }
        },
        {
            name: "floating",
            desc: "生成随机浮点数。",
            params: [
                { key: "min", label: "最小值", type: "number", default: 5 },
                { key: "max", label: "最大值", type: "number", default: 10 },
                { key: "fixed", label: "小数位数", type: "number", default: 2, min: 0, max: 17 }
            ],
            build: function (p) { return chance.floating({ min: Number(p.min), max: Number(p.max), fixed: Number(p.fixed) }); }
        },
        {
            name: "integer",
            desc: "生成随机整数。",
            params: [
                { key: "min", label: "最小值", type: "number", default: 5 },
                { key: "max", label: "最大值", type: "number", default: 10 }
            ],
            build: function (p) { return chance.integer({ min: Number(p.min), max: Number(p.max) }); }
        },
        {
            name: "natural",
            desc: "生成随机自然数（≥0）。",
            params: [
                { key: "numerals", label: "位数", type: "number", default: 3, min: 1 },
                { key: "min", label: "最小值(可选)", type: "number", default: "" },
                { key: "max", label: "最大值(可选)", type: "number", default: "" }
            ],
            build: function (p) {
                var o = {};
                if (p.min !== "" && p.min !== undefined) o.min = Number(p.min);
                if (p.max !== "" && p.max !== undefined) o.max = Number(p.max);
                if (p.numerals !== "" && p.numerals !== undefined) o.numerals = Number(p.numerals);
                return chance.natural(o);
            }
        },
        {
            name: "hex",
            desc: "生成随机十六进制数。",
            params: [
                { key: "min", label: "最小值", type: "number", default: 50 },
                { key: "max", label: "最大值", type: "number", default: 100 },
                { key: "casing", label: "大小写", type: "select", default: "upper", options: ["lower", "upper"] }
            ],
            build: function (p) { return chance.hex({ min: Number(p.min), max: Number(p.max), casing: p.casing }); }
        },
        {
            name: "character",
            desc: "生成单个随机字符。pool 设置后优先于 alpha/symbols/casing。",
            params: [
                { key: "alpha", label: "仅字母", type: "checkbox", default: true },
                { key: "casing", label: "大小写", type: "select", default: "upper", options: ["lower", "upper"] },
                { key: "symbols", label: "含符号", type: "checkbox", default: false },
                { key: "pool", label: "自定义字符池", type: "text", default: "aeiou", hint: "非空时优先使用，忽略 alpha/symbols/casing" }
            ],
            build: function (p) {
                var o = { alpha: p.alpha, casing: p.casing, symbols: p.symbols };
                if (p.pool && p.pool.length > 0) { o = { pool: p.pool }; }
                return chance.character(o);
            }
        },
        {
            name: "letter",
            desc: "生成单个随机字母。",
            params: [
                { key: "casing", label: "大小写", type: "select", default: "upper", options: ["lower", "upper", "all"] }
            ],
            build: function (p) { return chance.letter({ casing: p.casing }); }
        },
        {
            name: "string",
            desc: "生成随机字符串。",
            params: [
                { key: "length", label: "长度", type: "number", default: 10, min: 1 },
                { key: "pool", label: "字符池(可选)", type: "text", default: "" }
            ],
            build: function (p) {
                var o = { length: Number(p.length) };
                if (p.pool && p.pool.length > 0) o.pool = p.pool;
                return chance.string(o);
            }
        },
        {
            name: "unique",
            desc: "调用某 Chance 函数 N 次并保证不重复。返回数组，单元格写入 JSON 字符串。",
            params: [
                { key: "generator", label: "生成器", type: "select", default: "integer", options: ["integer", "natural", "floating", "letter", "character", "string"] },
                { key: "count", label: "数量", type: "number", default: 5, min: 1 },
                { key: "min", label: "min(integer/natural/floating)", type: "number", default: 5 },
                { key: "max", label: "max(integer/natural/floating)", type: "number", default: 10 },
                { key: "length", label: "length(string)", type: "number", default: 10 }
            ],
            build: function (p) {
                var genMap = {
                    integer: chance.integer, natural: chance.natural, floating: chance.floating,
                    letter: chance.letter, character: chance.character, string: chance.string
                };
                var fn = genMap[p.generator] || chance.integer;
                var opts = {};
                if (p.generator === "string") opts.length = Number(p.length);
                else { opts.min = Number(p.min); opts.max = Number(p.max); }
                return chance.unique(fn, Number(p.count), opts);
            }
        },
        {
            name: "weighted",
            desc: "按权重随机返回一个值。values 与 weights 数量需一致。池可手动输入（逗号分隔）或从区域取。",
            params: [
                { key: "values", label: "取值池", type: "pooltextlist", default: "a,b" },
                { key: "weights", label: "权重池", type: "pooltextlist", default: "100,1" }
            ],
            build: function (p) {
                var vals = parseList(p.values);
                var wts = parseList(p.weights).map(Number);
                if (vals.length !== wts.length) throw new Error("values 与 weights 数量不一致");
                return chance.weighted(vals, wts);
            }
        },
        {
            name: "pick",
            desc: "从池中随机挑 N 个（可重复）。池可手动输入（逗号分隔）或从区域取。",
            params: [
                { key: "pool", label: "池子", type: "poolchar", default: "aeiou" },
                { key: "count", label: "数量", type: "number", default: 2, min: 1 }
            ],
            build: function (p) { return chance.pick(parsePool(p.pool), Number(p.count)); }
        },
        {
            name: "pickone",
            desc: "从池中随机挑 1 个。池可手动输入（逗号分隔）或从区域取。",
            params: [
                { key: "pool", label: "池子", type: "poolchar", default: "aeiou" }
            ],
            build: function (p) { return chance.pickone(parsePool(p.pool)); }
        },
        {
            name: "pickset",
            desc: "从池中随机不重复挑 N 个。池可手动输入（逗号分隔）或从区域取。",
            params: [
                { key: "pool", label: "池子", type: "poolchar", default: "aeiou" },
                { key: "count", label: "数量", type: "number", default: 2, min: 1 }
            ],
            build: function (p) { return chance.pickset(parsePool(p.pool), Number(p.count)); }
        },
        {
            name: "shuffle",
            desc: "打乱池顺序。池可手动输入（逗号分隔）或从区域取。",
            params: [
                { key: "pool", label: "池子", type: "poolchar", default: "aeiou" }
            ],
            build: function (p) { return chance.shuffle(parsePool(p.pool)); }
        },
        {
            name: "normal",
            desc: "生成正态分布随机数。pool 非空时返回 pool 中元素；为空时返回浮点数。",
            params: [
                { key: "mean", label: "均值", type: "number", default: 1 },
                { key: "dev", label: "标准差", type: "number", default: 1 },
                { key: "pool", label: "pool(可选)", type: "pooltextlist", default: "" }
            ],
            build: function (p) {
                var o = { mean: Number(p.mean), dev: Number(p.dev) };
                if (p.pool && p.pool.length > 0) o.pool = parseList(p.pool);
                return chance.normal(o);
            }
        }
    ],

    "Text 文本": [
        { name: "syllable", desc: "生成随机音节。", params: [], build: function () { return chance.syllable(); } },
        {
            name: "word", desc: "生成随机单词。",
            params: [
                { key: "length", label: "长度", type: "number", default: 5, min: 1 },
                { key: "syllables", label: "音节数(可选)", type: "number", default: "" }
            ],
            build: function (p) {
                var o = {};
                if (p.length !== "" && p.length !== undefined) o.length = Number(p.length);
                if (p.syllables !== "" && p.syllables !== undefined) o.syllables = Number(p.syllables);
                return chance.word(o);
            }
        },
        {
            name: "sentence", desc: "生成随机句子。",
            params: [{ key: "words", label: "词数", type: "number", default: 5, min: 1 }],
            build: function (p) { return chance.sentence({ words: Number(p.words) }); }
        },
        {
            name: "paragraph", desc: "生成随机段落。",
            params: [{ key: "sentences", label: "句数", type: "number", default: 2, min: 1 }],
            build: function (p) { return chance.paragraph({ sentences: Number(p.sentences) }); }
        }
    ],

    "Person 人物": [
        {
            name: "age", desc: "生成随机年龄。",
            params: [
                { key: "type", label: "年龄段", type: "select", default: "teen", options: ["all", "child", "teen", "adult", "senior"] }
            ],
            build: function (p) { return chance.age({ type: p.type }); }
        },
        {
            name: "birthday", desc: "生成随机生日。year/month/day 留空时随机。",
            params: [
                { key: "string", label: "字符串输出", type: "checkbox", default: true },
                { key: "year", label: "年(可选)", type: "number", default: 1989, hint: "留空=随机" },
                { key: "month", label: "月(可选)", type: "number", default: "" },
                { key: "day", label: "日(可选)", type: "number", default: "" },
                { key: "type", label: "年龄段(可选)", type: "select", default: "all", options: ["all", "child", "teen", "adult", "senior"] }
            ],
            build: function (p) {
                var o = { string: p.string, type: p.type };
                if (p.year !== "" && p.year !== undefined) o.year = Number(p.year);
                if (p.month !== "" && p.month !== undefined) o.month = Number(p.month);
                if (p.day !== "" && p.day !== undefined) o.day = Number(p.day);
                return chance.birthday(o);
            }
        },
        {
            name: "first", desc: "生成随机名字（名）。",
            params: [
                { key: "gender", label: "性别", type: "select", default: "male", options: ["male", "female"] },
                { key: "nationality", label: "国籍", type: "select", default: "cn", options: ["cn", "en", "it", "nl", "fr"] }
            ],
            build: function (p) { return chance.first({ gender: p.gender, nationality: p.nationality }); }
        },
        {
            name: "name", desc: "生成随机姓名。",
            params: [
                { key: "gender", label: "性别", type: "select", default: "female", options: ["", "male", "female"] },
                { key: "nationality", label: "国籍", type: "select", default: "cn", options: ["cn", "en", "it", "nl", "fr"] },
                { key: "prefix", label: "前缀", type: "checkbox", default: false },
                { key: "suffix", label: "后缀", type: "checkbox", default: false }
            ],
            build: function (p) {
                var o = { nationality: p.nationality, prefix: p.prefix, suffix: p.suffix };
                if (p.gender) o.gender = p.gender;
                return chance.name(o);
            }
        },
        {
            name: "gender", desc: "生成随机性别。",
            params: [
                { key: "extraGenders", label: "额外性别(逗号分隔)", type: "textlist", default: "walmat bag" }
            ],
            build: function (p) {
                var o = {};
                if (p.extraGenders && p.extraGenders.length > 0) o.extraGenders = parseList(p.extraGenders);
                return chance.gender(o);
            }
        },
        {
            name: "profession", desc: "生成随机职业。",
            params: [{ key: "rank", label: "含职级", type: "checkbox", default: true }],
            build: function (p) { return chance.profession({ rank: p.rank }); }
        },
        { name: "company", desc: "生成随机公司名。", params: [], build: function () { return chance.company(); } },
        { name: "emotion", desc: "生成随机情绪词。", params: [], build: function () { return chance.emotion(); } },
        {
            name: "cnProvince", desc: "生成 N 个中国省份名。",
            params: [{ key: "count", label: "数量", type: "number", default: 1, min: 1 }],
            build: function (p) { return chance.cnProvince(Number(p.count)); }
        },
        {
            name: "cnID", desc: "生成中国身份证号。可用 year/month/day 精确指定，或用 ageMin/ageMax 按年龄。",
            params: [
                { key: "province", label: "省份", type: "text", default: "湖北", hint: "省份全称或简写都可" },
                { key: "year", label: "年(可选)", type: "number", default: "" },
                { key: "month", label: "月(可选)", type: "number", default: "" },
                { key: "day", label: "日(可选)", type: "number", default: "" },
                { key: "ageMin", label: "年龄下限(可选)", type: "number", default: 18 },
                { key: "ageMax", label: "年龄上限(可选)", type: "number", default: 60 },
                { key: "gender", label: "性别", type: "select", default: "female", options: ["male", "female"] }
            ],
            build: function (p) {
                var o = { province: p.province, gender: p.gender };
                if (p.year !== "" && p.year !== undefined) o.year = Number(p.year);
                if (p.month !== "" && p.month !== undefined) o.month = Number(p.month);
                if (p.day !== "" && p.day !== undefined) o.day = Number(p.day);
                if (p.ageMin !== "" && p.ageMin !== undefined) o.ageMin = Number(p.ageMin);
                if (p.ageMax !== "" && p.ageMax !== undefined) o.ageMax = Number(p.ageMax);
                return chance.cnID(o);
            }
        },
        {
            name: "cnPhone", desc: "生成中国手机号。",
            params: [
                { key: "operator", label: "运营商", type: "select", default: "中国移动", options: ["中国移动", "中国联通", "中国电信"] }
            ],
            build: function (p) { return chance.cnPhone({ operator: p.operator }); }
        }
    ],

    "Animal 动物": [
        {
            name: "animal", desc: "生成随机动物名。",
            params: [
                { key: "type", label: "类型", type: "select", default: "pet", options: ["pet", "desert", "ocean", "grassland", "forest", "zoo", "farm"] }
            ],
            build: function (p) { return chance.animal({ type: p.type }); }
        }
    ],

    "Strange ID 各国证件号": [
        { name: "cpf", desc: "巴西个人税务登记号。", params: [], build: function () { return chance.cpf(); } },
        { name: "cnpj", desc: "巴西法人国家登记号。", params: [], build: function () { return chance.cnpj(); } },
        {
            name: "cf", desc: "意大利社保号。需提供完整参数，city 须为有效代码，否则可能失败。",
            params: [
                { key: "first", label: "名", type: "text", default: "Sophia" },
                { key: "last", label: "姓", type: "text", default: "Loren" },
                { key: "gender", label: "性别", type: "select", default: "Female", options: ["Male", "Female"] },
                { key: "birthday", label: "生日 YYYY-MM-DD", type: "text", default: "1934-09-20" },
                { key: "city", label: "城市代码", type: "text", default: "h501" }
            ],
            build: function (p) {
                var parts = p.birthday.split("-");
                var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                return chance.cf({ first: p.first, last: p.last, gender: p.gender, birthday: d, city: p.city });
            }
        },
        { name: "israelId", desc: "以色列 ID。", params: [], build: function () { return chance.israelId(); } },
        { name: "ssn", desc: "美国社保号。", params: [], build: function () { return chance.ssn(); } },
        { name: "HIDN", desc: "韩国住院医师号（可能不可用）。", params: [], build: function () { return chance.HIDN(); } },
        { name: "aadhar", desc: "印度 Aadhaar 号（可能不可用）。", params: [], build: function () { return chance.aadhar(); } },
        { name: "mrz", desc: "机读区码（可能不可用）。", params: [], build: function () { return chance.mrz(); } },
        { name: "vat", desc: "增值税号（可能不可用）。", params: [], build: function () { return chance.vat(); } },
        { name: "iban", desc: "国际银行账号（可能不可用）。", params: [], build: function () { return chance.iban(); } },
        { name: "pl_pesel", desc: "波兰 PESEL（可能不可用）。", params: [], build: function () { return chance.pl_pesel(); } },
        { name: "pl_nip", desc: "波兰 NIP（可能不可用）。", params: [], build: function () { return chance.pl_nip(); } },
        { name: "pl_regon", desc: "波兰 REGON（可能不可用）。", params: [], build: function () { return chance.pl_regon(); } }
    ],

    "Location 地理": [
        {
            name: "locale", desc: "ISO-639-1 语言码 / IETF 区域码。",
            params: [{ key: "region", label: "区域码", type: "checkbox", default: true }],
            build: function (p) { return chance.locale({ region: p.region }); }
        },
        { name: "address", desc: "随机街道地址。", params: [], build: function () { return chance.address(); } },
        {
            name: "altitude", desc: "海拔（米）。",
            params: [
                { key: "fixed", label: "小数位", type: "number", default: 7, min: 0 },
                { key: "min", label: "最小值", type: "number", default: 100 },
                { key: "max", label: "最大值", type: "number", default: 1000 }
            ],
            build: function (p) { return chance.altitude({ fixed: Number(p.fixed), min: Number(p.min), max: Number(p.max) }); }
        },
        {
            name: "areacode", desc: "区号。",
            params: [{ key: "parens", label: "加括号", type: "checkbox", default: true }],
            build: function (p) { return chance.areacode({ parens: p.parens }); }
        },
        { name: "city", desc: "随机城市名（字符组合）。", params: [], build: function () { return chance.city(); } },
        {
            name: "coordinates", desc: "随机经纬度。",
            params: [
                { key: "fixed", label: "小数位", type: "number", default: 7 },
                { key: "min", label: "最小值", type: "number", default: 100 },
                { key: "max", label: "最大值", type: "number", default: 1000 }
            ],
            build: function (p) { return chance.coordinates({ fixed: Number(p.fixed), min: Number(p.min), max: Number(p.max) }); }
        },
        { name: "country", desc: "随机国家名。", params: [], build: function () { return chance.country(); } },
        {
            name: "depth", desc: "深度（米）。",
            params: [
                { key: "fixed", label: "小数位", type: "number", default: 7 },
                { key: "min", label: "最小值", type: "number", default: 100 },
                { key: "max", label: "最大值", type: "number", default: 1000 }
            ],
            build: function (p) { return chance.depth({ fixed: Number(p.fixed), min: Number(p.min), max: Number(p.max) }); }
        },
        {
            name: "geohash", desc: "地理哈希。",
            params: [{ key: "length", label: "长度", type: "number", default: 5, min: 1 }],
            build: function (p) { return chance.geohash({ length: Number(p.length) }); }
        },
        {
            name: "geojson", desc: "GeoJSON 坐标对象（可能不可用）。",
            params: [
                { key: "fixed", label: "小数位", type: "number", default: 7 },
                { key: "min", label: "最小值", type: "number", default: 100 },
                { key: "max", label: "最大值", type: "number", default: 1000 }
            ],
            build: function (p) { return chance.geojson({ fixed: Number(p.fixed), min: Number(p.min), max: Number(p.max) }); }
        },
        {
            name: "latitude", desc: "纬度。",
            params: [
                { key: "fixed", label: "小数位", type: "number", default: 7 },
                { key: "min", label: "最小值", type: "number", default: 100 },
                { key: "max", label: "最大值", type: "number", default: 1000 }
            ],
            build: function (p) { return chance.latitude({ fixed: Number(p.fixed), min: Number(p.min), max: Number(p.max) }); }
        },
        {
            name: "longitude", desc: "经度。",
            params: [
                { key: "fixed", label: "小数位", type: "number", default: 7 },
                { key: "min", label: "最小值", type: "number", default: 100 },
                { key: "max", label: "最大值", type: "number", default: 1000 }
            ],
            build: function (p) { return chance.longitude({ fixed: Number(p.fixed), min: Number(p.min), max: Number(p.max) }); }
        },
        {
            name: "phone", desc: "随机电话号。",
            params: [
                { key: "country", label: "国家", type: "select", default: "us", options: ["us", "fr", "uk", "br"] },
                { key: "mobile", label: "手机号", type: "checkbox", default: true }
            ],
            build: function (p) {
                return chance.phone({ country: p.country, mobile: p.mobile });
            }
        },
        { name: "postal", desc: "加拿大邮编（可能不可用）。", params: [], build: function () { return chance.postal(); } },
        { name: "county", desc: "英国郡名（可能不可用）。", params: [], build: function () { return chance.county(); } },
        {
            name: "province", desc: "省/邦（ca|it）。",
            params: [{ key: "country", label: "国家", type: "select", default: "ca", options: ["ca", "it"] }],
            build: function (p) { return chance.province({ country: p.country }); }
        },
        {
            name: "state", desc: "州/省。country=us|it|uk。",
            params: [
                { key: "country", label: "国家", type: "select", default: "it", options: ["us", "it", "uk"] },
                { key: "full", label: "全称", type: "checkbox", default: true },
                { key: "armed_forces", label: "含武装部队", type: "checkbox", default: false },
                { key: "territories", label: "含领地", type: "checkbox", default: false },
                { key: "us_states_and_dc", label: "本土+DC", type: "checkbox", default: false }
            ],
            build: function (p) {
                return chance.state({
                    country: p.country, full: p.full,
                    armed_forces: p.armed_forces, territories: p.territories, us_states_and_dc: p.us_states_and_dc
                });
            }
        },
        {
            name: "street", desc: "街道名。",
            params: [
                { key: "country", label: "国家", type: "select", default: "us", options: ["us", "it"] },
                { key: "short_suffix", label: "简写后缀", type: "checkbox", default: true },
                { key: "syllables", label: "音节数", type: "number", default: 3, min: 1 }
            ],
            build: function (p) {
                return chance.street({ country: p.country, short_suffix: p.short_suffix, syllables: Number(p.syllables) });
            }
        },
        {
            name: "street_suffix", desc: "街道后缀。",
            params: [{ key: "country", label: "国家", type: "select", default: "us", options: ["us", "it", "uk"] }],
            build: function (p) { return chance.street_suffix({ country: p.country }); }
        },
        {
            name: "zip", desc: "美国邮编。",
            params: [{ key: "plusfour", label: "含+4", type: "checkbox", default: true }],
            build: function (p) { return chance.zip({ plusfour: p.plusfour }); }
        }
    ],

    "Time 时间": [
        { name: "ampm", desc: "AM/PM。", params: [], build: function () { return chance.ampm(); } },
        {
            name: "date", desc: "随机日期。year/month/day 留空时随机。string=false 返回 Date 对象，将转 JSON。",
            params: [
                { key: "string", label: "字符串输出", type: "checkbox", default: true },
                { key: "american", label: "美式格式", type: "checkbox", default: true },
                { key: "year", label: "年(可选)", type: "number", default: 1983 },
                { key: "month", label: "月(可选)", type: "number", default: "" },
                { key: "day", label: "日(可选)", type: "number", default: "" }
            ],
            build: function (p) {
                var o = { string: p.string, american: p.american };
                if (p.year !== "" && p.year !== undefined) o.year = Number(p.year);
                if (p.month !== "" && p.month !== undefined) o.month = Number(p.month);
                if (p.day !== "" && p.day !== undefined) o.day = Number(p.day);
                return chance.date(o);
            }
        },
        {
            name: "hammertime", desc: "时间戳。",
            params: [
                { key: "year", label: "年(可选)", type: "number", default: 1983 },
                { key: "month", label: "月(可选)", type: "number", default: "" },
                { key: "day", label: "日(可选)", type: "number", default: "" }
            ],
            build: function (p) {
                var o = {};
                if (p.year !== "" && p.year !== undefined) o.year = Number(p.year);
                if (p.month !== "" && p.month !== undefined) o.month = Number(p.month);
                if (p.day !== "" && p.day !== undefined) o.day = Number(p.day);
                return chance.hammertime(o);
            }
        },
        {
            name: "hour", desc: "小时。",
            params: [{ key: "twentyfour", label: "24 小时制", type: "checkbox", default: true }],
            build: function (p) { return chance.hour({ twentyfour: p.twentyfour }); }
        },
        { name: "millisecond", desc: "毫秒。", params: [], build: function () { return chance.millisecond(); } },
        { name: "minute", desc: "分钟。", params: [], build: function () { return chance.minute(); } },
        {
            name: "month", desc: "月份。raw=true 输出对象，false 输出字符串。",
            params: [{ key: "raw", label: "对象输出", type: "checkbox", default: false }],
            build: function (p) { return chance.month({ raw: p.raw }); }
        },
        { name: "second", desc: "秒。", params: [], build: function () { return chance.second(); } },
        { name: "timestamp", desc: "Unix 时间戳。", params: [], build: function () { return chance.timestamp(); } },
        {
            name: "weekday", desc: "星期。",
            params: [{ key: "weekday_only", label: "仅工作日", type: "checkbox", default: true }],
            build: function (p) { return chance.weekday({ weekday_only: p.weekday_only }); }
        },
        {
            name: "year", desc: "年份。默认 min=1900, max=2100。",
            params: [
                { key: "min", label: "最小值", type: "number", default: 1900 },
                { key: "max", label: "最大值", type: "number", default: 2100 }
            ],
            build: function (p) { return chance.year({ min: Number(p.min), max: Number(p.max) }); }
        },
        { name: "timezone", desc: "时区。", params: [], build: function () { return chance.timezone(); } }
    ],

    "Finance 金融": [
        {
            name: "cc", desc: "信用卡号。",
            params: [
                { key: "type", label: "类型", type: "select", default: "Mastercard", options: ["", "Visa", "Mastercard", "American Express", "Discover", "JCB", "Maestro"] }
            ],
            build: function (p) {
                var o = {};
                if (p.type) o.type = p.type;
                return chance.cc(o);
            }
        },
        {
            name: "cc_type", desc: "信用卡类型。raw=true 输出对象。",
            params: [{ key: "raw", label: "对象输出", type: "checkbox", default: true }],
            build: function (p) { return chance.cc_type({ raw: p.raw }); }
        },
        {
            name: "get_cc_types", desc: "获取全部信用卡类型定义（chance.get）。返回数组，写入 JSON。",
            params: [],
            build: function () { return chance.get("cc_types"); }
        },
        { name: "currency", desc: "货币。", params: [], build: function () { return chance.currency(); } },
        { name: "currency_pair", desc: "货币对（便于模拟汇率）。", params: [], build: function () { return chance.currency_pair(); } },
        {
            name: "dollar", desc: "美元金额。",
            params: [
                { key: "min", label: "最小值", type: "number", default: 100 },
                { key: "max", label: "最大值", type: "number", default: 250 }
            ],
            build: function (p) { return chance.dollar({ min: Number(p.min), max: Number(p.max) }); }
        },
        {
            name: "euro", desc: "欧元金额。",
            params: [
                { key: "min", label: "最小值", type: "number", default: 100 },
                { key: "max", label: "最大值", type: "number", default: 250 }
            ],
            build: function (p) { return chance.euro({ min: Number(p.min), max: Number(p.max) }); }
        },
        {
            name: "exp", desc: "信用卡有效期。raw=true 输出对象。",
            params: [{ key: "raw", label: "对象输出", type: "checkbox", default: true }],
            build: function (p) { return chance.exp({ raw: p.raw }); }
        },
        {
            name: "exp_month", desc: "有效期月。",
            params: [{ key: "future", label: "未来", type: "checkbox", default: true }],
            build: function (p) { return chance.exp_month({ future: p.future }); }
        },
        { name: "exp_year", desc: "有效期年。", params: [], build: function () { return chance.exp_year(); } }
    ],

    "Music 音乐": [
        {
            name: "note", desc: "音符。",
            params: [{ key: "notes", label: "调式", type: "select", default: "sharpKey", options: ["all", "flatKey", "sharpKey"] }],
            build: function (p) { return chance.note({ notes: p.notes }); }
        },
        {
            name: "midi_note", desc: "MIDI 音符。",
            params: [
                { key: "min", label: "最小值", type: "number", default: 0, min: 0, max: 127 },
                { key: "max", label: "最大值", type: "number", default: 127, min: 0, max: 127 }
            ],
            build: function (p) { return chance.midi_note({ min: Number(p.min), max: Number(p.max) }); }
        },
        {
            name: "chord_quality", desc: "和弦质量。",
            params: [{ key: "jazz", label: "爵士", type: "checkbox", default: false }],
            build: function (p) { return chance.chord_quality({ jazz: p.jazz }); }
        },
        {
            name: "chord", desc: "和弦。",
            params: [
                { key: "notes", label: "调式", type: "select", default: "sharpKey", options: ["all", "flatKey", "sharpKey"] },
                { key: "jazz", label: "爵士", type: "checkbox", default: false }
            ],
            build: function (p) { return chance.chord({ notes: p.notes, jazz: p.jazz }); }
        },
        {
            name: "tempo", desc: "节拍。",
            params: [
                { key: "min", label: "最小值", type: "number", default: 40 },
                { key: "max", label: "最大值", type: "number", default: 320 }
            ],
            build: function (p) { return chance.tempo({ min: Number(p.min), max: Number(p.max) }); }
        },
        {
            name: "radio", desc: "广播呼号。",
            params: [{ key: "side", label: "海岸", type: "select", default: "east", options: ["east", "west"] }],
            build: function (p) { return chance.radio({ side: p.side }); }
        },
        {
            name: "tv", desc: "电视呼号。",
            params: [{ key: "side", label: "海岸", type: "select", default: "west", options: ["east", "west"] }],
            build: function (p) { return chance.tv({ side: p.side }); }
        }
    ],

    "Miscellaneous 杂项": [
        { name: "coin", desc: "硬币正反。", params: [], build: function () { return chance.coin(); } },
        { name: "d4", desc: "掷 d4。", params: [], build: function () { return chance.d4(); } },
        { name: "d6", desc: "掷 d6。", params: [], build: function () { return chance.d6(); } },
        { name: "d8", desc: "掷 d8。", params: [], build: function () { return chance.d8(); } },
        { name: "d10", desc: "掷 d10。", params: [], build: function () { return chance.d10(); } },
        { name: "d12", desc: "掷 d12。", params: [], build: function () { return chance.d12(); } },
        { name: "d20", desc: "掷 d20。", params: [], build: function () { return chance.d20(); } },
        { name: "d30", desc: "掷 d30。", params: [], build: function () { return chance.d30(); } },
        { name: "d100", desc: "掷 d100。", params: [], build: function () { return chance.d100(); } },
        {
            name: "rpg", desc: "骰子表达式，如 '3d12'。",
            params: [
                { key: "expression", label: "表达式", type: "text", default: "3d12" },
                { key: "sum", label: "求和", type: "checkbox", default: true }
            ],
            build: function (p) {
                var o = {};
                if (p.sum !== undefined) o.sum = p.sum;
                return chance.rpg(p.expression, o);
            }
        }
    ],

    "Web 网络": [
        { name: "android_id", desc: "Android ID（可能不可用）。", params: [], build: function () { return chance.android_id(); } },
        { name: "apple_token", desc: "Apple Token（可能不可用）。", params: [], build: function () { return chance.apple_token(); } },
        { name: "wp7_anid", desc: "WP7 ANID（可能不可用）。", params: [], build: function () { return chance.wp7_anid(); } },
        { name: "wp8_anid2", desc: "WP8 ANID2（可能不可用）。", params: [], build: function () { return chance.wp8_anid2(); } },
        { name: "bb_pin", desc: "BlackBerry PIN（可能不可用）。", params: [], build: function () { return chance.bb_pin(); } },
        { name: "avatar", desc: "头像 URL。", params: [], build: function () { return chance.avatar(); } },
        {
            name: "color", desc: "颜色。format=hex|shorthex|rgb|0x。",
            params: [
                { key: "format", label: "格式", type: "select", default: "rgb", options: ["hex", "shorthex", "rgb", "0x"] },
                { key: "grayscale", label: "灰度", type: "checkbox", default: false },
                { key: "casing", label: "大小写", type: "select", default: "lower", options: ["lower", "upper"] }
            ],
            build: function (p) {
                var o = { format: p.format, grayscale: p.grayscale, casing: p.casing };
                return chance.color(o);
            }
        },
        { name: "domain", desc: "域名。", params: [], build: function () { return chance.domain(); } },
        {
            name: "email", desc: "邮箱。domain 留空时使用默认。",
            params: [
                { key: "length", label: "长度", type: "number", default: 8, min: 1 },
                { key: "domain", label: "域名", type: "text", default: "163.com" }
            ],
            build: function (p) {
                var o = { length: Number(p.length) };
                if (p.domain) o.domain = p.domain;
                return chance.email(o);
            }
        },
        { name: "fbid", desc: "Facebook ID（可能不可用）。", params: [], build: function () { return chance.fbid(); } },
        { name: "google_analytics", desc: "GA 追踪码（可能不可用）。", params: [], build: function () { return chance.google_analytics(); } },
        { name: "hashtag", desc: "话题标签。", params: [], build: function () { return chance.hashtag(); } },
        { name: "ip", desc: "IPv4。", params: [], build: function () { return chance.ip(); } },
        { name: "ipv6", desc: "IPv6（可能不可用）。", params: [], build: function () { return chance.ipv6(); } },
        { name: "klout", desc: "Klout 分数（可能不可用）。", params: [], build: function () { return chance.klout(); } },
        { name: "semver", desc: "语义化版本号。", params: [], build: function () { return chance.semver(); } },
        { name: "tld", desc: "顶级域。", params: [], build: function () { return chance.tld(); } },
        { name: "twitter", desc: "Twitter 用户名（可能不可用）。", params: [], build: function () { return chance.twitter(); } },
        {
            name: "url", desc: "URL。",
            params: [
                { key: "protocol", label: "协议", type: "select", default: "http", options: ["http", "https", "ftp"] },
                { key: "domain", label: "域名", type: "text", default: "baidu.com" },
                { key: "domain_prefix", label: "子域", type: "text", default: "docs" },
                { key: "path", label: "路径", type: "text", default: "images" },
                { key: "extensions", label: "扩展名(逗号分隔)", type: "textlist", default: "gif,jpg,png" }
            ],
            build: function (p) {
                var o = { protocol: p.protocol, domain: p.domain, domain_prefix: p.domain_prefix, path: p.path };
                if (p.extensions && p.extensions.length > 0) o.extensions = parseList(p.extensions);
                return chance.url(o);
            }
        },
        { name: "port", desc: "端口号。", params: [], build: function () { return chance.port(); } },
        {
            name: "loremPicsum", desc: "Lorem Picsum 图片 URL（可能不可用）。",
            params: [
                { key: "width", label: "宽", type: "number", default: 500, min: 1 },
                { key: "height", label: "高", type: "number", default: 200, min: 1 },
                { key: "greyscale", label: "灰度", type: "checkbox", default: false },
                { key: "blurred", label: "模糊", type: "checkbox", default: false }
            ],
            build: function (p) {
                return chance.loremPicsum({
                    width: Number(p.width), height: Number(p.height),
                    greyscale: p.greyscale, blurred: p.blurred
                });
            }
        },
        {
            name: "mac_address", desc: "MAC 地址（可能不可用）。",
            params: [{ key: "networkVersion", label: "网络版本格式", type: "checkbox", default: false }],
            build: function (p) { return chance.mac_address({ networkVersion: p.networkVersion }); }
        }
    ],

    "File 文件": [
        {
            name: "guid", desc: "GUID。version 留空时随机。",
            params: [{ key: "version", label: "版本", type: "select", default: "5", options: ["", "1", "5"] }],
            build: function (p) {
                var o = {};
                if (p.version !== "") o.version = Number(p.version);
                return chance.guid(o);
            }
        },
        {
            name: "hash", desc: "哈希。",
            params: [{ key: "casing", label: "大小写", type: "select", default: "upper", options: ["lower", "upper"] }],
            build: function (p) { return chance.hash({ casing: p.casing }); }
        },
        {
            name: "md5", desc: "MD5（可能不可用）。",
            params: [{ key: "text", label: "输入字符串", type: "text", default: "asdasdasd" }],
            build: function (p) { return chance.md5(p.text); }
        },
        {
            name: "file", desc: "文件名。fileType 留空时使用 extensions。",
            params: [
                { key: "length", label: "长度", type: "number", default: 5, min: 1 },
                { key: "fileType", label: "类型", type: "select", default: "document", options: ["", "raster", "vector", "3d", "document"] },
                { key: "extensions", label: "扩展名(逗号分隔,可选)", type: "textlist", default: "" }
            ],
            build: function (p) {
                var o = { length: Number(p.length) };
                if (p.fileType) o.fileType = p.fileType;
                if (p.extensions && p.extensions.length > 0) o.extensions = parseList(p.extensions);
                return chance.file(o);
            }
        }
    ]
};

// ---------- 工具函数 ----------
function parseList(s) {
    if (s === undefined || s === null) return [];
    return String(s).split(",").map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 0; });
}

// 将 Range.Value2（可能是单一值/一维数组/二维数组）扁平化成字符串数组，过滤空值
function flattenRangeValues(v) {
    var out = [];
    if (v === undefined || v === null || v === "") return out;
    if (v.constructor === Array) {
        for (var i = 0; i < v.length; i++) {
            var row = v[i];
            if (row === undefined || row === null) continue;
            if (row.constructor === Array) {
                for (var j = 0; j < row.length; j++) {
                    var cell = row[j];
                    if (cell !== undefined && cell !== null && cell !== "") out.push(String(cell));
                }
            } else if (row !== "") {
                out.push(String(row));
            }
        }
    } else {
        out.push(String(v));
    }
    return out;
}

// 读区域，返回 1D 字符串数组；失败时抛异常
function readRangeAsArray(addr) {
    if (!addr) throw new Error("区域地址为空");
    var app = window.Application;
    if (!app) throw new Error("无法访问 WPS Application 对象（区域模式仅在 WPS 对话框中可用）");
    var rng;
    try { rng = app.Range(addr); }
    catch (e) { throw new Error("区域地址无效：" + e.message); }
    var v;
    try { v = rng.Value2; }
    catch (e) { throw new Error("读取区域失败：" + e.message); }
    var arr = flattenRangeValues(v);
    if (arr.length === 0) throw new Error("区域内容为空：" + addr);
    return arr;
}

// 池子解析：若字符串中没有逗号，按"字符池"（原样返回字符串，Chance 内部会按字符拆）处理；
// 若含逗号，按数组返回，保持与用户"逗号分隔"输入一致。
function parsePool(s) {
    if (s === undefined || s === null) return [];
    var str = String(s);
    if (str.indexOf(",") === -1) return str; // 字符池：直接给字符串
    return parseList(str); // 列表池：返回数组
}

// 点击选择区域按钮：调用 WPS InputBox 让用户框选，结果写回到对应输入框
function pickRangeForPool(poolKey) {
    try {
        var app = window.Application;
        if (!app) { alert("无法访问 WPS Application 对象（区域模式仅在 WPS 对话框中可用）"); return; }
        var r = app.InputBox("请选择池子区域：", "选择池子区域", "", undefined, undefined, undefined, undefined, 8);
        if (r) document.getElementById("poolrange_" + poolKey).value = r.Address(true, true);
    } catch (e) {
        console.log("pickRangeForPool 取消或失败：" + e.message);
    }
}

// 根据当前池子配置（手动 / 区域）与期望模式，产出字符串：
// - pooltextlist：最终为逗号分隔字符串（后续 parseList 复用）
// - poolchar：手动输入原样返回（含逗号则 parsePool 会转数组）；区域模式下把区域值逗号 join
function resolvePoolValue(key, kind) {
    var modeEl = document.getElementById("poolmode_" + key);
    if (!modeEl) {
        // 回退到旧的简单文本控件
        var plain = document.getElementById("param_" + key);
        return plain ? plain.value : "";
    }
    var mode = modeEl.value; // "text" | "range"
    if (mode === "text") {
        var t = document.getElementById("pooltext_" + key);
        return t ? t.value : "";
    } else {
        var addr = (document.getElementById("poolrange_" + key).value || "").trim();
        var arr = readRangeAsArray(addr);
        if (kind === "poolchar") {
            // 区域取到的是多值数组。如果每个元素均为单字符，则 join 成字符串（字符池语义）；
            // 否则用逗号拼成"列表字符串"，交由 parsePool 判断。
            var allSingleChar = arr.every(function (x) { return x.length === 1; });
            return allSingleChar ? arr.join("") : arr.join(",");
        } else {
            // pooltextlist：直接逗号 join
            return arr.join(",");
        }
    }
}

function setStatus(msg, cls) {
    var bar = document.getElementById("statusBar");
    bar.className = "statusBar" + (cls ? " " + cls : "");
    bar.textContent = msg;
}

// ---------- 渲染 ----------
function getSelectedFunc() {
    var catKey = document.getElementById("selCategory").value;
    var fnName = document.getElementById("selFunction").value;
    var list = CHANCE_FUNCS[catKey] || [];
    for (var i = 0; i < list.length; i++) {
        if (list[i].name === fnName) return list[i];
    }
    return null;
}

function renderCategorySelect() {
    var sel = document.getElementById("selCategory");
    sel.innerHTML = "";
    Object.keys(CHANCE_FUNCS).forEach(function (cat) {
        var opt = document.createElement("option");
        opt.value = cat; opt.textContent = cat;
        sel.appendChild(opt);
    });
    renderFunctionSelect();
}

function renderFunctionSelect() {
    var catKey = document.getElementById("selCategory").value;
    var sel = document.getElementById("selFunction");
    sel.innerHTML = "";
    var list = CHANCE_FUNCS[catKey] || [];
    list.forEach(function (f) {
        var opt = document.createElement("option");
        opt.value = f.name; opt.textContent = f.name;
        sel.appendChild(opt);
    });
    renderParamPanel();
}

function renderParamPanel() {
    var f = getSelectedFunc();
    var descEl = document.getElementById("funcDesc");
    var panel = document.getElementById("paramPanel");
    descEl.textContent = f ? f.desc : "";
    panel.innerHTML = "";
    if (!f || !f.params || f.params.length === 0) {
        var empty = document.createElement("div");
        empty.className = "paramHint";
        empty.textContent = "（该函数无可配参数，直接生成即可）";
        panel.appendChild(empty);
        return;
    }
    f.params.forEach(function (param) {
        var row = document.createElement("div");
        row.className = "paramRow";

        var lbl = document.createElement("label");
        lbl.textContent = param.label;
        lbl.setAttribute("for", "param_" + param.key);
        row.appendChild(lbl);

        var input;
        if (param.type === "select") {
            input = document.createElement("select");
            (param.options || []).forEach(function (opt) {
                var o = document.createElement("option");
                o.value = opt;
                o.textContent = opt === "" ? "（空）" : opt;
                input.appendChild(o);
            });
            input.value = String(param.default);
            input.id = "param_" + param.key;
            row.appendChild(input);
        } else if (param.type === "checkbox") {
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = !!param.default;
            input.id = "param_" + param.key;
            row.appendChild(input);
        } else if (param.type === "number") {
            input = document.createElement("input");
            input.type = "number";
            input.value = (param.default === undefined || param.default === "") ? "" : param.default;
            if (param.min !== undefined) input.min = param.min;
            if (param.max !== undefined) input.max = param.max;
            input.id = "param_" + param.key;
            row.appendChild(input);
        } else if (param.type === "text" || param.type === "textlist") {
            input = document.createElement("input");
            input.type = "text";
            input.value = (param.default === undefined) ? "" : param.default;
            input.id = "param_" + param.key;
            row.appendChild(input);
        } else if (param.type === "poolchar" || param.type === "pooltextlist") {
            // 两栏布局：左边放 mode + 控件组，占据 row 的"input"部分
            var wrap = document.createElement("div");
            wrap.style.flex = "1";
            wrap.style.display = "flex";
            wrap.style.flexDirection = "column";
            wrap.style.gap = "4px";

            // 模式选择（一行）
            var modeRow = document.createElement("div");
            modeRow.style.display = "flex";
            modeRow.style.alignItems = "center";
            modeRow.style.gap = "14px";
            modeRow.style.fontSize = "12.5px";
            modeRow.style.color = "#555";

            var r1 = document.createElement("label");
            r1.style.cursor = "pointer"; r1.style.width = "auto"; r1.style.padding = "0";
            var rdo1 = document.createElement("input");
            rdo1.type = "radio"; rdo1.name = "poolmode_name_" + param.key;
            rdo1.value = "text"; rdo1.checked = true;
            rdo1.style.verticalAlign = "middle";
            r1.appendChild(rdo1); r1.appendChild(document.createTextNode("手动输入"));

            var r2 = document.createElement("label");
            r2.style.cursor = "pointer"; r2.style.width = "auto"; r2.style.padding = "0";
            var rdo2 = document.createElement("input");
            rdo2.type = "radio"; rdo2.name = "poolmode_name_" + param.key;
            rdo2.value = "range";
            rdo2.style.verticalAlign = "middle";
            r2.appendChild(rdo2); r2.appendChild(document.createTextNode("区域地址"));

            modeRow.appendChild(r1); modeRow.appendChild(r2);
            wrap.appendChild(modeRow);

            // 手动输入控件（一行）
            var textRow = document.createElement("div");
            textRow.style.display = "flex";
            textRow.style.gap = "4px";
            var txtInput = document.createElement("input");
            txtInput.type = "text";
            txtInput.id = "pooltext_" + param.key;
            txtInput.value = (param.default === undefined) ? "" : param.default;
            txtInput.placeholder = param.type === "pooltextlist" ? "a,b,c（逗号分隔）" : "aeiou 或 a,b,c";
            txtInput.style.flex = "1";
            txtInput.style.padding = "4px 6px";
            txtInput.style.border = "1px solid #ccc";
            txtInput.style.borderRadius = "3px";
            txtInput.style.fontSize = "12.5px";
            txtInput.style.boxSizing = "border-box";
            textRow.appendChild(txtInput);
            wrap.appendChild(textRow);

            // 区域地址控件（一行：input + 按钮）
            var rangeRow = document.createElement("div");
            rangeRow.style.display = "flex";
            rangeRow.style.gap = "4px";
            var rngInput = document.createElement("input");
            rngInput.type = "text";
            rngInput.id = "poolrange_" + param.key;
            rngInput.placeholder = "A1:C10 或留空点击「选择…」";
            rngInput.style.flex = "1";
            rngInput.style.padding = "4px 6px";
            rngInput.style.border = "1px solid #ccc";
            rngInput.style.borderRadius = "3px";
            rngInput.style.fontSize = "12.5px";
            rngInput.style.boxSizing = "border-box";
            var rngBtn = document.createElement("button");
            rngBtn.type = "button";
            rngBtn.textContent = "选择…";
            rngBtn.style.padding = "4px 10px";
            rngBtn.style.border = "1px solid #aaa";
            rngBtn.style.background = "#fafafa";
            rngBtn.style.borderRadius = "4px";
            rngBtn.style.cursor = "pointer";
            rngBtn.style.fontSize = "12px";
            (function (k) { rngBtn.addEventListener("click", function () { pickRangeForPool(k); }); })(param.key);
            rangeRow.appendChild(rngInput); rangeRow.appendChild(rngBtn);
            wrap.appendChild(rangeRow);

            // 隐藏的 mode 汇总控件，供 collectParams 统一读取
            var modeHidden = document.createElement("input");
            modeHidden.type = "hidden";
            modeHidden.id = "poolmode_" + param.key;
            modeHidden.value = "text";
            wrap.appendChild(modeHidden);

            // 同步 mode（单选切换时更新 hidden.value + 行可用性样式）
            function syncMode() {
                var selected = rdo1.checked ? "text" : (rdo2.checked ? "range" : "text");
                modeHidden.value = selected;
                if (selected === "text") {
                    txtInput.disabled = false; txtInput.style.opacity = "1"; txtInput.style.background = "";
                    rngInput.disabled = true;  rngInput.style.opacity = "0.45"; rngInput.style.background = "#eee";
                    rngBtn.disabled = true;     rngBtn.style.opacity = "0.45"; rngBtn.style.cursor = "not-allowed";
                } else {
                    txtInput.disabled = true;  txtInput.style.opacity = "0.45"; txtInput.style.background = "#eee";
                    rngInput.disabled = false; rngInput.style.opacity = "1"; rngInput.style.background = "";
                    rngBtn.disabled = false;    rngBtn.style.opacity = "1"; rngBtn.style.cursor = "pointer";
                }
            }
            rdo1.addEventListener("change", syncMode);
            rdo2.addEventListener("change", syncMode);
            syncMode();

            row.appendChild(wrap);
        }
        panel.appendChild(row);

        if (param.hint) {
            var hint = document.createElement("div");
            hint.className = "paramHint";
            hint.textContent = param.hint;
            panel.appendChild(hint);
        }
    });
}

function collectParams() {
    var f = getSelectedFunc();
    var p = {};
    if (!f || !f.params) return p;
    f.params.forEach(function (param) {
        if (param.type === "poolchar" || param.type === "pooltextlist") {
            try {
                p[param.key] = resolvePoolValue(param.key, param.type);
            } catch (e) {
                // 预览/写入时统一再抛一次；这里先留空避免 UI 渲染崩
                p[param.key] = "";
                // 挂到 p.__errors 里，generateOne 统一处理
                if (!p.__errors) p.__errors = {};
                p.__errors[param.key] = e.message;
            }
            return;
        }
        var el = document.getElementById("param_" + param.key);
        if (!el) return;
        if (param.type === "checkbox") {
            p[param.key] = el.checked;
        } else {
            p[param.key] = el.value;
        }
    });
    return p;
}

// ---------- 生成与写入 ----------
function generateOne() {
    var f = getSelectedFunc();
    if (!f) throw new Error("未选择函数");
    var p = collectParams();
    if (p.__errors) {
        var msgs = [];
        for (var k in p.__errors) if (p.__errors.hasOwnProperty(k)) msgs.push(k + ": " + p.__errors[k]);
        throw new Error(msgs.join(" ; "));
    }
    var v = f.build(p);
    // 非标量 → JSON 字符串
    if (v !== null && v !== undefined && typeof v === "object") {
        v = JSON.stringify(v);
    }
    return v;
}

function preview() {
    try {
        var v = generateOne();
        document.getElementById("previewOut").textContent = String(v);
        setStatus("预览成功：" + String(v).slice(0, 80), "ok");
    } catch (e) {
        document.getElementById("previewOut").textContent = "[跳过] " + e.message;
        setStatus("[跳过] " + getSelectedFunc().name + ": " + e.message, "error");
    }
}

// 解析目标区域
function resolveTargetRange() {
    var app = window.Application;
    if (!app) throw new Error("无法访问 WPS Application 对象");
    var mode = "selection";
    var radios = document.getElementsByName("outmode");
    for (var i = 0; i < radios.length; i++) { if (radios[i].checked) { mode = radios[i].value; break; } }

    var rng;
    if (mode === "custom") {
        var addr = (document.getElementById("inpRange").value || "").trim();
        if (!addr) throw new Error("未填写自定义区域地址");
        try { rng = app.Range(addr); }
        catch (e) { throw new Error("区域地址无效：" + e.message); }
    } else {
        rng = app.Selection;
        if (!rng) {
            rng = app.ActiveSheet.Cells.Item(1, 1);
            setStatus("未检测到选区，将默认写入 A1", "error");
        }
    }
    return rng;
}

function runFill() {
    var f = getSelectedFunc();
    if (!f) { alert("请选择函数"); return; }

    var rng;
    try { rng = resolveTargetRange(); }
    catch (e) { alert(e.message); setStatus(e.message, "error"); return; }

    var count = parseInt(document.getElementById("inpCount").value, 10);
    if (!(count > 0)) { alert("填充数量必须为正整数"); return; }

    var skipNonEmpty = document.getElementById("chkSkip").checked;
    var needConfirm = document.getElementById("chkConfirm").checked;

    // 计算填充布局
    var app = window.Application;
    var rows = rng.Rows.Count;
    var cols = rng.Columns.Count;
    var total = rows * cols;
    var fillRows, fillCols;
    if (rows === 1 || cols === 1) {
        // 单行/单列：直接铺 count 个（可能超出选区，截断）
        var n = Math.min(count, total);
        if (rows === 1 && cols === 1) { fillRows = 1; fillCols = n; }
        else if (rows === 1) { fillRows = 1; fillCols = n; }
        else { fillRows = n; fillCols = 1; } // 单列
        if (count > total) {
            setStatus("提示：N=" + count + " 大于选区容量 " + total + "，将截断为 " + n + " 个", "error");
        }
    } else {
        // 多行多列：按行优先铺满，最多填 count 个
        var cap = Math.min(count, total);
        fillRows = rows;
        fillCols = cols;
        count = cap;
        if (cap < total) {
            setStatus("提示：N=" + count + " 小于选区容量 " + total + "，将按行优先填充 " + cap + " 个", "error");
        }
    }

    if (needConfirm) {
        var ok = confirm("将在 " + rng.Address(true, true) + " 中生成 " + count + " 个 " + f.name + " 随机值。\n"
            + (skipNonEmpty ? "（已勾选：跳过非空单元格）" : "（未勾选：将覆盖非空单元格）"));
        if (!ok) { setStatus("用户取消写入。"); return; }
    }

    var okCount = 0, skipCount = 0, errCount = 0, skipped = [];
    app.ScreenUpdating = false;
    try {
        var cells = rng.Cells;
        var idx = 0;
        outer:
        for (var r = 1; r <= fillRows; r++) {
            for (var c = 1; c <= fillCols; c++) {
                if (idx >= count) break outer;
                var cell;
                try { cell = cells.Item(r, c); }
                catch (e) { cell = cells.Item((r - 1) * fillCols + c); }
                if (!cell) continue;

                if (skipNonEmpty) {
                    try {
                        var cur = cell.Value2;
                        if (cur !== null && cur !== undefined && cur !== "") {
                            skipCount++;
                            idx++;
                            continue;
                        }
                    } catch (e) { /* 忽略读取错误，照常写入 */ }
                }

                var v;
                try { v = generateOne(); }
                catch (e) {
                    errCount++;
                    if (skipped.length < 5) skipped.push(f.name + ": " + e.message);
                    idx++;
                    continue;
                }

                try {
                    cell.Value2 = v;
                    okCount++;
                } catch (e) {
                    errCount++;
                    if (skipped.length < 5) skipped.push("写入失败(" + f.name + "): " + e.message);
                }
                idx++;
            }
        }
    } finally {
        app.ScreenUpdating = true;
    }

    var msg = "完成 " + f.name + "：成功 " + okCount + " / 跳过非空 " + skipCount + " / 失败 " + errCount + " / 总计 " + count;
    if (skipped.length > 0) {
        msg += "\n[跳过] 列表：\n  - " + skipped.join("\n  - ");
        setStatus(msg, errCount > 0 ? "error" : "ok");
    } else {
        setStatus(msg, "ok");
    }
    alert(msg);
}

// 用 InputBox 重新框选区域
function pickRange() {
    try {
        var app = window.Application;
        if (!app) return;
        var r = app.InputBox("请选择目标区域：", "选择区域", "", undefined, undefined, undefined, undefined, 8);
        if (r) document.getElementById("inpRange").value = r.Address(true, true);
    } catch (e) {
        console.log("pickRange 取消或失败：" + e.message);
    }
}

// ---------- 初始化 ----------
window.onload = function () {
    renderCategorySelect();

    document.getElementById("selCategory").onchange = renderFunctionSelect;
    document.getElementById("selFunction").onchange = renderParamPanel;

    var radios = document.getElementsByName("outmode");
    for (var i = 0; i < radios.length; i++) {
        radios[i].onchange = function () {
            var custom = false;
            var rs = document.getElementsByName("outmode");
            for (var j = 0; j < rs.length; j++) {
                if (rs[j].checked && rs[j].value === "custom") { custom = true; break; }
            }
            document.getElementById("customRow").style.display = custom ? "flex" : "none";
        };
    }

    document.getElementById("btnPick").onclick = pickRange;
    document.getElementById("btnPreview").onclick = preview;
    document.getElementById("btnRun").onclick = runFill;
    document.getElementById("btnCancel").onclick = function () { window.close(); };

    // 首次预览
    preview();
};
