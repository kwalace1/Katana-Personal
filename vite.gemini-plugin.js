var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { loadEnv } from 'vite';
import { handleAskLlmRequest } from './api/ask-llm-core';
import { handleFoodEstimateRequest } from './api/food-estimate-core';
/** Local `/api/ask-llm` + `/api/food-estimate` during `vite` without `vercel dev`. */
export function geminiAskDevPlugin() {
    return {
        name: 'katana-gemini-ask-dev',
        configureServer: function (server) {
            var _this = this;
            var env = loadEnv(server.config.mode, server.config.root, '');
            var openRouterEnv = {
                apiKey: env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
                model: env.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || env.GEMINI_MODEL,
            };
            server.middlewares.use(function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
                var url, chunks, chunk, e_1_1, body, headers, _i, _a, _b, key, value, request, response, _c, reader, _d, done, value, err_1, buf, _e, _f, err_2;
                var _g, req_1, req_1_1;
                var _h, e_1, _j, _k;
                var _l;
                return __generator(this, function (_m) {
                    switch (_m.label) {
                        case 0:
                            url = (_l = req.url) === null || _l === void 0 ? void 0 : _l.split('?')[0];
                            if (url !== '/api/ask-llm' && url !== '/api/food-estimate') {
                                next();
                                return [2 /*return*/];
                            }
                            _m.label = 1;
                        case 1:
                            _m.trys.push([1, 26, , 27]);
                            chunks = [];
                            _m.label = 2;
                        case 2:
                            _m.trys.push([2, 7, 8, 13]);
                            _g = true, req_1 = __asyncValues(req);
                            _m.label = 3;
                        case 3: return [4 /*yield*/, req_1.next()];
                        case 4:
                            if (!(req_1_1 = _m.sent(), _h = req_1_1.done, !_h)) return [3 /*break*/, 6];
                            _k = req_1_1.value;
                            _g = false;
                            chunk = _k;
                            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                            _m.label = 5;
                        case 5:
                            _g = true;
                            return [3 /*break*/, 3];
                        case 6: return [3 /*break*/, 13];
                        case 7:
                            e_1_1 = _m.sent();
                            e_1 = { error: e_1_1 };
                            return [3 /*break*/, 13];
                        case 8:
                            _m.trys.push([8, , 11, 12]);
                            if (!(!_g && !_h && (_j = req_1.return))) return [3 /*break*/, 10];
                            return [4 /*yield*/, _j.call(req_1)];
                        case 9:
                            _m.sent();
                            _m.label = 10;
                        case 10: return [3 /*break*/, 12];
                        case 11:
                            if (e_1) throw e_1.error;
                            return [7 /*endfinally*/];
                        case 12: return [7 /*endfinally*/];
                        case 13:
                            body = Buffer.concat(chunks);
                            headers = new Headers();
                            for (_i = 0, _a = Object.entries(req.headers); _i < _a.length; _i++) {
                                _b = _a[_i], key = _b[0], value = _b[1];
                                if (typeof value === 'string')
                                    headers.set(key, value);
                                else if (Array.isArray(value))
                                    headers.set(key, value.join(','));
                            }
                            request = new Request("http://localhost".concat(req.url || url), {
                                method: req.method || 'POST',
                                headers: headers,
                                body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
                            });
                            if (!(url === '/api/food-estimate')) return [3 /*break*/, 15];
                            return [4 /*yield*/, handleFoodEstimateRequest(request, openRouterEnv)];
                        case 14:
                            _c = _m.sent();
                            return [3 /*break*/, 17];
                        case 15: return [4 /*yield*/, handleAskLlmRequest(request, openRouterEnv)];
                        case 16:
                            _c = _m.sent();
                            _m.label = 17;
                        case 17:
                            response = _c;
                            res.statusCode = response.status;
                            response.headers.forEach(function (value, key) {
                                res.setHeader(key, value);
                            });
                            if (!response.body) return [3 /*break*/, 24];
                            reader = response.body.getReader();
                            _m.label = 18;
                        case 18:
                            _m.trys.push([18, 22, , 23]);
                            _m.label = 19;
                        case 19:
                            if (!true) return [3 /*break*/, 21];
                            return [4 /*yield*/, reader.read()];
                        case 20:
                            _d = _m.sent(), done = _d.done, value = _d.value;
                            if (done)
                                return [3 /*break*/, 21];
                            if (value)
                                res.write(Buffer.from(value));
                            return [3 /*break*/, 19];
                        case 21:
                            res.end();
                            return [3 /*break*/, 23];
                        case 22:
                            err_1 = _m.sent();
                            if (!res.headersSent) {
                                res.statusCode = 500;
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({
                                    error: err_1 instanceof Error ? err_1.message : 'Stream pipe failed',
                                }));
                            }
                            else {
                                res.end();
                            }
                            return [3 /*break*/, 23];
                        case 23: return [2 /*return*/];
                        case 24:
                            _f = (_e = Buffer).from;
                            return [4 /*yield*/, response.arrayBuffer()];
                        case 25:
                            buf = _f.apply(_e, [_m.sent()]);
                            res.end(buf);
                            return [3 /*break*/, 27];
                        case 26:
                            err_2 = _m.sent();
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({
                                error: err_2 instanceof Error ? err_2.message : 'OpenRouter middleware failed',
                            }));
                            return [3 /*break*/, 27];
                        case 27: return [2 /*return*/];
                    }
                });
            }); });
        },
    };
}
