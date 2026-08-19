// ============================================================
// 发票识别 - 配置管理模块
//
// 本文件仅负责 API 配置的持久化与读取，不涉及任何 HTTP 请求或文件操作。
// 实际的识别流程（文件选择、HTTP 调用、结果写入）在 ribbon.js 主上下文中执行，
// 因为 ShowDialog webview 受 CORS 限制，无法直接调用百度 OCR API。
// ============================================================

var INVOICE_CONFIG_KEY = "invoice_ocr_config";
var DEFAULT_API_KEY = "L7XHdud9PuNGpuEHAdvn4sto";
var DEFAULT_SECRET_KEY = "0ufkCHxu5HoOsz6RTbNovHs2iTHfqYDO";

function loadInvoiceConfig() {
    try {
        var raw = window.Application.PluginStorage.getItem(INVOICE_CONFIG_KEY);
        if (raw) {
            var cfg = JSON.parse(raw);
            return {
                apiKey: cfg.apiKey || DEFAULT_API_KEY,
                secretKey: cfg.secretKey || DEFAULT_SECRET_KEY
            };
        }
    } catch (e) {}
    return { apiKey: DEFAULT_API_KEY, secretKey: DEFAULT_SECRET_KEY };
}

function saveInvoiceConfig(cfg) {
    try {
        window.Application.PluginStorage.setItem(INVOICE_CONFIG_KEY, JSON.stringify({
            apiKey: cfg.apiKey,
            secretKey: cfg.secretKey
        }));
    } catch (e) {}
}

// 测试连接（仅验证 Token 获取，实际 HTTP 调用在主上下文中）
async function testInvoiceConnection() {
    var cfg = loadInvoiceConfig();
    var results = [];

    // 步骤 1: 尝试获取 Token（使用 XMLHttpRequest，Token 接口支持 GET）
    results.push("HTTP 引擎: XMLHttpRequest");
    try {
        var token = await getInvoiceToken(cfg);
        results.push("Token 获取: 成功");
    } catch (e) {
        results.push("Token 获取: 失败 - " + e.message);
        return results;
    }

    // 步骤 2: 测试 OCR API 连通性
    try {
        var testBody = "image=" + encodeURIComponent("");
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "https://aip.baidubce.com/rest/2.0/ocr/v1/vat_invoice?access_token=" + token, true);
        xhr.timeout = 15000;
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        var text = await new Promise(function (resolve, reject) {
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) resolve(xhr.responseText);
                    else if (xhr.status === 0) reject(new Error("HTTP 0: 被 CORS/WPS 安全策略拦截"));
                    else reject(new Error("HTTP " + xhr.status));
                }
            };
            xhr.onerror = function () { reject(new Error("网络请求失败")); };
            xhr.send(testBody);
        });
        var data = JSON.parse(text);
        if (data.error_code && data.error_code === 1100) {
            results.push("OCR API 连通: 成功（返回参数错误，说明 API 可达）");
        } else if (data.error_code) {
            results.push("OCR API 连通: 错误 " + data.error_code + " - " + (data.error_msg || ""));
        } else {
            results.push("OCR API 连通: 成功");
        }
    } catch (e) {
        results.push("OCR API 连通: 失败 - " + e.message);
    }

    return results;
}

function getInvoiceToken(cfg) {
    var now = Date.now();
    if (cfg._token && cfg._tokenExpire && cfg._tokenExpire > now) {
        return Promise.resolve(cfg._token);
    }
    var url = "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials" +
        "&client_id=" + encodeURIComponent(cfg.apiKey) +
        "&client_secret=" + encodeURIComponent(cfg.secretKey);
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.timeout = 15000;
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (data.error) {
                            reject(new Error("Token 获取失败: " + (data.error_description || data.error)));
                        } else {
                            cfg._token = data.access_token;
                            cfg._tokenExpire = now + (data.expires_in - 300) * 1000;
                            resolve(cfg._token);
                        }
                    } catch (e) {
                        reject(new Error("Token 响应解析失败"));
                    }
                } else if (xhr.status === 0) {
                    reject(new Error("HTTP 0: 被 CORS/WPS 安全策略拦截"));
                } else {
                    reject(new Error("HTTP " + xhr.status));
                }
            }
        };
        xhr.onerror = function () { reject(new Error("网络请求失败")); };
        xhr.send(null);
    });
}
