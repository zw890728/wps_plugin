//这个文件由index.html包含
// 先加载工具类模块（按依赖顺序：Lodash → Dayjs → Chance → Pinyin → Table → echarts）
document.write("<script language='javascript' src='js/Lodash.js'></script>");
document.write("<script language='javascript' src='js/Dayjs.js'></script>");
document.write("<script language='javascript' src='js/Chance.js'></script>");
document.write("<script language='javascript' src='js/Pinyin.js'></script>");
document.write("<script language='javascript' src='js/Table.js'></script>");
document.write("<script language='javascript' src='js/echarts.min.js'></script>");
document.write("<script language='javascript' src='js/EChartsTaskPane.js'></script>");
document.write("<script language='javascript' src='js/EChartsDialog.js'></script>");
// 再加载工具与Ribbon回调
document.write("<script language='javascript' src='js/util.js'></script>");
document.write("<script language='javascript' src='js/ribbon.js'></script>");
document.write("<script language='javascript' src='js/systemdemo.js'></script>");