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
import { handlePushCronRequest, handlePushScheduleRequest, handlePushSendRequest, } from './api/push/push-core';
import { handleBillingCheckoutRequest } from './api/billing/checkout-core';
var PUSH_PATHS = new Map([
    ['/api/push/send', handlePushSendRequest],
    ['/api/push/schedule', handlePushScheduleRequest],
    ['/api/push/cron', handlePushCronRequest],
    ['/api/billing/checkout', handleBillingCheckoutRequest],
]);
/** Local push API routes during `vite` dev. */
export function pushDevPlugin() {
    return {
        name: 'katana-push-dev',
        configureServer: function (server) {
            var _this = this;
            server.middlewares.use(function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
                var path, handler, env, chunks, chunk, e_1_1, body, headers, _i, _a, _b, key, value, request, pushEnv, response, _c, buf, _d, _e, err_1;
                var _f, req_1, req_1_1;
                var _g, e_1, _h, _j;
                var _k;
                return __generator(this, function (_l) {
                    switch (_l.label) {
                        case 0:
                            path = (_k = req.url) === null || _k === void 0 ? void 0 : _k.split('?')[0];
                            handler = path ? PUSH_PATHS.get(path) : undefined;
                            if (!handler) {
                                next();
                                return [2 /*return*/];
                            }
                            env = loadEnv(server.config.mode, server.config.root, '');
                            _l.label = 1;
                        case 1:
                            _l.trys.push([1, 19, , 20]);
                            chunks = [];
                            _l.label = 2;
                        case 2:
                            _l.trys.push([2, 7, 8, 13]);
                            _f = true, req_1 = __asyncValues(req);
                            _l.label = 3;
                        case 3: return [4 /*yield*/, req_1.next()];
                        case 4:
                            if (!(req_1_1 = _l.sent(), _g = req_1_1.done, !_g)) return [3 /*break*/, 6];
                            _j = req_1_1.value;
                            _f = false;
                            chunk = _j;
                            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                            _l.label = 5;
                        case 5:
                            _f = true;
                            return [3 /*break*/, 3];
                        case 6: return [3 /*break*/, 13];
                        case 7:
                            e_1_1 = _l.sent();
                            e_1 = { error: e_1_1 };
                            return [3 /*break*/, 13];
                        case 8:
                            _l.trys.push([8, , 11, 12]);
                            if (!(!_f && !_g && (_h = req_1.return))) return [3 /*break*/, 10];
                            return [4 /*yield*/, _h.call(req_1)];
                        case 9:
                            _l.sent();
                            _l.label = 10;
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
                            request = new Request("http://localhost".concat(req.url || path), {
                                method: req.method || 'GET',
                                headers: headers,
                                body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
                            });
                            pushEnv = {
                                vapidPublicKey: env.VITE_VAPID_PUBLIC_KEY || env.VAPID_PUBLIC_KEY || '',
                                vapidPrivateKey: env.VAPID_PRIVATE_KEY || '',
                                vapidSubject: env.VAPID_SUBJECT || 'mailto:support@katana.app',
                                supabaseUrl: env.VITE_SUPABASE_URL || '',
                                supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
                                cronSecret: env.CRON_SECRET || '',
                            };
                            if (!(path === '/api/billing/checkout')) return [3 /*break*/, 15];
                            return [4 /*yield*/, handleBillingCheckoutRequest(request, {
                                    stripeSecretKey: env.STRIPE_SECRET_KEY || '',
                                    stripePriceId: env.STRIPE_PRICE_ID || '',
                                    appUrl: 'http://localhost:3001',
                                })];
                        case 14:
                            _c = _l.sent();
                            return [3 /*break*/, 17];
                        case 15: return [4 /*yield*/, handler(request, pushEnv)];
                        case 16:
                            _c = _l.sent();
                            _l.label = 17;
                        case 17:
                            response = _c;
                            res.statusCode = response.status;
                            response.headers.forEach(function (value, key) { return res.setHeader(key, value); });
                            _e = (_d = Buffer).from;
                            return [4 /*yield*/, response.arrayBuffer()];
                        case 18:
                            buf = _e.apply(_d, [_l.sent()]);
                            res.end(buf);
                            return [3 /*break*/, 20];
                        case 19:
                            err_1 = _l.sent();
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ error: err_1 instanceof Error ? err_1.message : 'Push middleware failed' }));
                            return [3 /*break*/, 20];
                        case 20: return [2 /*return*/];
                    }
                });
            }); });
        },
    };
}
