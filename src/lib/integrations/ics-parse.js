function unfoldLines(text) {
    return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}
function parseIcsDate(raw) {
    var v = raw.trim();
    if (!v)
        return null;
    if (/^\d{8}$/.test(v)) {
        var y = v.slice(0, 4);
        var m = v.slice(4, 6);
        var d_1 = v.slice(6, 8);
        return { iso: "".concat(y, "-").concat(m, "-").concat(d_1, "T00:00:00.000Z"), allDay: true };
    }
    if (/^\d{8}T\d{6}Z?$/.test(v)) {
        var y = v.slice(0, 4);
        var m = v.slice(4, 6);
        var d_2 = v.slice(6, 8);
        var hh = v.slice(9, 11);
        var mm = v.slice(11, 13);
        var ss = v.slice(13, 15);
        var z = v.endsWith('Z') ? 'Z' : '';
        return { iso: "".concat(y, "-").concat(m, "-").concat(d_2, "T").concat(hh, ":").concat(mm, ":").concat(ss, ".000").concat(z || 'Z'), allDay: false };
    }
    var d = new Date(v);
    if (Number.isNaN(d.getTime()))
        return null;
    return { iso: d.toISOString(), allDay: false };
}
/** Minimal ICS parser — VEVENT blocks with SUMMARY, DTSTART, DTEND, UID. */
export function parseIcsEvents(icsText) {
    var _a, _b, _c, _d, _e;
    var text = unfoldLines(icsText);
    var blocks = text.split('BEGIN:VEVENT').slice(1);
    var out = [];
    for (var _i = 0, blocks_1 = blocks; _i < blocks_1.length; _i++) {
        var block = blocks_1[_i];
        var chunk = block.split('END:VEVENT')[0] || '';
        var lines = chunk.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        var fields = {};
        for (var _f = 0, lines_1 = lines; _f < lines_1.length; _f++) {
            var line = lines_1[_f];
            var idx = line.indexOf(':');
            if (idx <= 0)
                continue;
            var keyPart = line.slice(0, idx);
            var key = (_b = (_a = keyPart.split(';')[0]) === null || _a === void 0 ? void 0 : _a.toUpperCase()) !== null && _b !== void 0 ? _b : '';
            fields[key] = line.slice(idx + 1);
        }
        var uid = fields.UID || fields.URL;
        var summary = (_c = fields.SUMMARY) === null || _c === void 0 ? void 0 : _c.trim();
        var startRaw = fields.DTSTART;
        if (!uid || !summary || !startRaw)
            continue;
        var start = parseIcsDate(startRaw);
        if (!start)
            continue;
        var endField = fields.DTEND || fields.DURATION;
        var endIso = start.iso;
        var allDay = start.allDay;
        if (fields.DTEND) {
            var end = parseIcsDate(fields.DTEND);
            if (end) {
                endIso = end.iso;
                allDay = start.allDay && end.allDay;
            }
        }
        else if (!start.allDay) {
            var endDate = new Date(start.iso);
            endDate.setHours(endDate.getHours() + 1);
            endIso = endDate.toISOString();
        }
        out.push({
            external_id: uid,
            title: summary,
            notes: ((_d = fields.DESCRIPTION) === null || _d === void 0 ? void 0 : _d.replace(/\\n/g, '\n').trim()) || '',
            starts_at: start.iso,
            ends_at: endIso,
            all_day: allDay,
            location: ((_e = fields.LOCATION) === null || _e === void 0 ? void 0 : _e.replace(/\\,/g, ',').trim()) || '',
        });
    }
    return out;
}
export function filterEventsInWindow(events, timeMin, timeMax) {
    var min = new Date(timeMin).getTime();
    var max = new Date(timeMax).getTime();
    return events.filter(function (e) {
        var start = new Date(e.starts_at).getTime();
        var end = new Date(e.ends_at).getTime();
        return end >= min && start <= max;
    });
}
