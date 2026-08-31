/*
 * Advisory temporal parser — client fast path (CHAT_INTELLIGENCE §7.3).
 *
 * Mirrors ke/studio/tutor/temporal_engine.py for UI hints only.
 * Backend receipts are canonical; use reconcile() to compare advisory vs server.
 */
(function (global) {
  "use strict";

  var PARSER_VERSION = "temporal-advisory/1.1.0";
  var DEFAULT_FISCAL_START = 10;
  var DEFAULT_CALENDAR = "us-federal";
  var WEEKDAYS = [
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  ];
  var MONTHS = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12,
  };

  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function isoDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function addDays(d, n) {
    var out = new Date(d.getTime());
    out.setDate(out.getDate() + n);
    return out;
  }
  function addMonths(d, months) {
    var out = new Date(d.getTime());
    out.setMonth(out.getMonth() + months);
    return out;
  }
  function dateOnly(y, m, d) { return new Date(y, m - 1, d); }

  function observed(d) {
    var day = d.getDay();
    if (day === 6) return addDays(d, -1);
    if (day === 0) return addDays(d, 1);
    return d;
  }

  function nthWeekday(year, month, weekday, n) {
    var count = 0;
    var last = new Date(year, month, 0).getDate();
    for (var day = 1; day <= last; day++) {
      var candidate = dateOnly(year, month, day);
      if (candidate.getDay() === weekday) {
        count += 1;
        if (count === n) return candidate;
      }
    }
    return null;
  }

  function lastWeekday(year, month, weekday) {
    for (var day = new Date(year, month, 0).getDate(); day >= 1; day--) {
      var candidate = dateOnly(year, month, day);
      if (candidate.getDay() === weekday) return candidate;
    }
    return null;
  }

  function usFederalHolidays(year) {
    var out = {};
    function add(d) { out[isoDate(d)] = true; }
    add(observed(dateOnly(year, 1, 1)));
    add(observed(dateOnly(year, 6, 19)));
    add(observed(dateOnly(year, 7, 4)));
    add(observed(dateOnly(year, 11, 11)));
    add(observed(dateOnly(year, 12, 25)));
    add(nthWeekday(year, 1, 1, 3));
    add(nthWeekday(year, 2, 1, 3));
    add(lastWeekday(year, 5, 1));
    add(nthWeekday(year, 9, 1, 1));
    add(nthWeekday(year, 10, 1, 2));
    add(nthWeekday(year, 11, 4, 4));
    return out;
  }

  function holidaySet(calendarId, ref) {
    if (!calendarId || calendarId === "none" || calendarId === "weekends-only") return {};
    var y = ref.getFullYear();
    return Object.assign({}, usFederalHolidays(y - 1), usFederalHolidays(y), usFederalHolidays(y + 1));
  }

  function isBusinessDay(d, calendarId) {
    var day = d.getDay();
    if (day === 0 || day === 6) return false;
    if (calendarId === "weekends-only" || calendarId === "none") return true;
    return !holidaySet(calendarId, d)[isoDate(d)];
  }

  function addBusinessDays(base, n, calendarId) {
    var step = n > 0 ? 1 : -1;
    var remaining = Math.abs(n);
    var cursor = new Date(base.getTime());
    while (remaining > 0) {
      cursor = addDays(cursor, step);
      if (isBusinessDay(cursor, calendarId)) remaining -= 1;
    }
    return cursor;
  }

  function nextBusinessDay(base, calendarId) {
    var cursor = new Date(base.getTime());
    do { cursor = addDays(cursor, 1); } while (!isBusinessDay(cursor, calendarId));
    return cursor;
  }

  function previousBusinessDay(base, calendarId) {
    return addBusinessDays(base, -1, calendarId);
  }

  function fiscalYearLabel(d, startMonth) {
    if (startMonth === 1) return d.getFullYear();
    return d.getMonth() + 1 >= startMonth ? d.getFullYear() + 1 : d.getFullYear();
  }

  function fiscalQuarterBounds(fyLabel, quarter, startMonth) {
    var fyStart;
    var fyEnd;
    if (startMonth === 1) {
      fyStart = dateOnly(fyLabel, 1, 1);
      fyEnd = dateOnly(fyLabel, 12, 31);
    } else {
      fyStart = dateOnly(fyLabel - 1, startMonth, 1);
      fyEnd = addDays(dateOnly(fyLabel, startMonth, 1), -1);
    }
    var qStart = addMonths(dateOnly(fyStart.getFullYear(), fyStart.getMonth() + 1, 1), (quarter - 1) * 3);
    if (qStart < fyStart) qStart = fyStart;
    var qEnd = addDays(addMonths(qStart, 3), -1);
    return { start: qStart, end: qEnd };
  }

  function fiscalQuarterForDate(d, startMonth) {
    var fy = fiscalYearLabel(d, startMonth);
    var bounds = fiscalQuarterBounds(fy, 1, startMonth);
    var offset = (d.getFullYear() - bounds.start.getFullYear()) * 12 + (d.getMonth() - bounds.start.getMonth());
    var quarter = Math.min(4, Math.max(1, Math.floor(offset / 3) + 1));
    return { fy: fy, quarter: quarter };
  }

  function parseNamedDate(text, ref) {
    var m = text.match(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i
    );
    if (!m) return null;
    var month = MONTHS[m[1].toLowerCase()] || 0;
    if (!month) return null;
    var day = parseInt(m[2], 10);
    var year = m[3] ? parseInt(m[3], 10) : ref.getFullYear();
    var candidate = new Date(year, month - 1, day);
    if (!m[3] && candidate < ref) candidate = new Date(ref.getFullYear() + 1, month - 1, day);
    return candidate;
  }

  function resolveOptions(options) {
    options = options || {};
    return {
      fiscal_year_start_month: options.fiscal_year_start_month != null
        ? parseInt(options.fiscal_year_start_month, 10) : DEFAULT_FISCAL_START,
      business_calendar_id: options.business_calendar_id || DEFAULT_CALENDAR,
    };
  }

  function resolve(text, referenceDate, options) {
    var ref = referenceDate || new Date();
    var q = String(text || "").toLowerCase().trim();
    if (!q) return null;
    var cfg = resolveOptions(options);
    var cal = cfg.business_calendar_id;
    var fiscalStart = cfg.fiscal_year_start_month;

    var bizN = q.match(/\b(?:in\s+)?(\d+)\s+business\s+days?\b/);
    if (bizN) {
      var n = parseInt(bizN[1], 10);
      var past = /\bago\b|\bprior\b|\bbefore\b/.test(q);
      var target = addBusinessDays(ref, past ? -n : n, cal);
      return { kind: "business_offset", result: isoDate(target), advisory: true };
    }
    if (/\bnext\s+business\s+day\b/.test(q)) {
      return { kind: "business_day", result: isoDate(nextBusinessDay(ref, cal)), advisory: true };
    }
    var wdTime = q.match(/\b(next|last|this\s+coming|this\s+past)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    if (wdTime) {
      var mod = wdTime[1].toLowerCase();
      var dayName = wdTime[2].toLowerCase();
      var targetIdx = WEEKDAYS.indexOf(dayName);
      if (targetIdx >= 0) {
        var currIdx = ref.getDay() === 0 ? 6 : ref.getDay() - 1;
        var delta = mod.indexOf("next") >= 0 || mod.indexOf("coming") >= 0
          ? (targetIdx - currIdx + 7) % 7 || 7
          : -((currIdx - targetIdx + 7) % 7 || 7);
        var targetDate = addDays(ref, delta);
        var hour = parseInt(wdTime[3], 10);
        var minute = parseInt(wdTime[4] || "0", 10);
        var mer = (wdTime[5] || "").toLowerCase();
        if (mer === "pm" && hour < 12) hour += 12;
        if (mer === "am" && hour === 12) hour = 0;
        var instant = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hour, minute);
        return {
          kind: "named_weekday_time",
          result: isoDate(instant),
          result_instant: instant.toISOString(),
          advisory: true,
        };
      }
    }
    if (/\b(?:previous|prior|last)\s+business\s+day\b/.test(q)) {
      return { kind: "previous_business_day", result: isoDate(previousBusinessDay(ref, cal)), advisory: true };
    }

    var fyMatch = q.match(/\bfy\s*(\d{2,4})\s*q([1-4])\b/);
    if (fyMatch) {
      var fyRaw = parseInt(fyMatch[1], 10);
      var fyLabel = fyRaw >= 100 ? fyRaw : 2000 + fyRaw;
      var fq = parseInt(fyMatch[2], 10);
      var fb = fiscalQuarterBounds(fyLabel, fq, fiscalStart);
      return {
        kind: "fiscal_quarter",
        start: isoDate(fb.start),
        end: isoDate(fb.end),
        advisory: true,
      };
    }
    if (/\b(?:this|current)\s+fiscal\s+quarter\b/.test(q)) {
      var cur = fiscalQuarterForDate(ref, fiscalStart);
      var curB = fiscalQuarterBounds(cur.fy, cur.quarter, fiscalStart);
      return { kind: "fiscal_quarter", start: isoDate(curB.start), end: isoDate(curB.end), advisory: true };
    }

    var timeAt = q.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    if (timeAt) {
      var hour = parseInt(timeAt[1], 10);
      var minute = parseInt(timeAt[2] || "0", 10);
      var mer = (timeAt[3] || "").toLowerCase();
      if (mer === "pm" && hour < 12) hour += 12;
      if (mer === "am" && hour === 12) hour = 0;
      var local = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), hour, minute);
      return {
        kind: "time_at",
        result: isoDate(local),
        result_instant: local.toISOString(),
        advisory: true,
      };
    }

    var delta = q.match(/\b(?:in\s+)?(\d+)\s+(day|week|month)s?\s*(ago|from\s+now|ahead|prior)?\b/);
    if (delta) {
      var dn = parseInt(delta[1], 10);
      var unit = delta[2];
      var dpast = !!(delta[3] && /ago|prior/.test(delta[3])) || /\bago\b|\bprior\b|\bpast\b/.test(q);
      var days = unit === "week" ? dn * 7 : dn;
      if (unit === "month") return { kind: "relative_offset", result: isoDate(addMonths(ref, dpast ? -dn : dn)), advisory: true };
      return { kind: "relative_offset", result: isoDate(addDays(ref, dpast ? -days : days)), advisory: true };
    }

    if (/\bhow\s+many\s+days\b|\bdays\s+(?:until|left|remaining)\b/.test(q)) {
      var target = null;
      if (/\bend\s+of\s+(?:the\s+)?year\b|\b(?:left|remaining)\s+in\s+(?:the\s+)?year\b/.test(q)) {
        target = new Date(ref.getFullYear(), 11, 31);
      } else {
        target = parseNamedDate(q, ref);
      }
      if (target) {
        var remaining = Math.max(0, Math.round((target - ref) / 86400000));
        return { kind: "countdown", result: isoDate(target), days_remaining: remaining, advisory: true };
      }
    }

    if (/\bpast\s+2\s+weeks\b|\blast\s+two\s+weeks\b/.test(q)) {
      return { kind: "interval", start: isoDate(addDays(ref, -14)), end: isoDate(ref), advisory: true };
    }

    if (/\blast\s+quarter\b|\bprevious\s+quarter\b/.test(q) && !/fiscal/.test(q)) {
      var cq = Math.floor(ref.getMonth() / 3) + 1;
      var qy = ref.getFullYear();
      var tq = cq === 1 ? 4 : cq - 1;
      var ty = cq === 1 ? qy - 1 : qy;
      var sm = (tq - 1) * 3;
      return {
        kind: "calendar_quarter",
        start: isoDate(new Date(ty, sm, 1)),
        end: isoDate(new Date(ty, sm + 3, 0)),
        advisory: true,
      };
    }

    return null;
  }

  function reconcile(advisory, receipt) {
    if (!advisory || !receipt) return { ok: true, reason: "no_advisory" };
    if (advisory.kind === "countdown" && receipt.days_remaining != null) {
      return {
        ok: advisory.days_remaining === receipt.days_remaining,
        reason: advisory.days_remaining === receipt.days_remaining ? "match" : "countdown_mismatch",
      };
    }
    if (advisory.result && receipt.result) {
      return {
        ok: advisory.result === receipt.result,
        reason: advisory.result === receipt.result ? "match" : "result_mismatch",
      };
    }
    if (advisory.start && receipt.start) {
      return {
        ok: advisory.start === receipt.start.slice(0, 10),
        reason: advisory.start === receipt.start.slice(0, 10) ? "match" : "interval_mismatch",
      };
    }
    return { ok: true, reason: "incomparable" };
  }

  global.TemporalAdvisory = {
    PARSER_VERSION: PARSER_VERSION,
    DEFAULT_FISCAL_START: DEFAULT_FISCAL_START,
    DEFAULT_CALENDAR: DEFAULT_CALENDAR,
    resolve: resolve,
    reconcile: reconcile,
    isBusinessDay: isBusinessDay,
    addBusinessDays: addBusinessDays,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
