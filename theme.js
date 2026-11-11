// planEDU Shared Client Engine (Theme, API Routing & Calendar Export)
(function () {
    // 1. THEME ENGINE
    function getTheme() {
        return localStorage.getItem('theme') || 'light';
    }

    function updateIcons(theme) {
        document.querySelectorAll('#theme-toggle i, .theme-toggle-btn i').forEach(function (icon) {
            icon.className = theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line';
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (document.body) {
            document.body.classList.toggle('dark', theme === 'dark');
        }
        updateIcons(theme);
    }

    window.toggleTheme = function () {
        var current = getTheme();
        var next = current === 'dark' ? 'light' : 'dark';
        try {
            localStorage.setItem('theme', next);
            localStorage.setItem('facultyDarkMode', next === 'dark');
            localStorage.setItem('studentDarkMode', next === 'dark');
        } catch (e) { }
        applyTheme(next);
    };

    // Apply theme immediately
    applyTheme(getTheme());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            applyTheme(getTheme());
        });
    } else {
        applyTheme(getTheme());
    }

    // 2. DYNAMIC API ROUTING
    window.API_BASE = (function () {
        var host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return window.location.port === '5000' ? '' : 'http://localhost:5000';
        }
        return localStorage.getItem('planedu_api_url') || '';
    })();

    window.planeduFetch = function (endpoint, options) {
        var url = endpoint;
        if (endpoint.startsWith('/api') && window.API_BASE) {
            url = window.API_BASE + endpoint;
        }
        return fetch(url, options);
    };

    // 3. CALENDAR EXPORT HELPER (RFC 5545 iCalendar standard)
    window.downloadTimetableICS = function (scheduleData, filename) {
        if (!scheduleData || typeof scheduleData !== 'object' || Object.keys(scheduleData).length === 0) {
            alert('No schedule data found to export. Please load your timetable first.');
            return;
        }

        var dayMap = { 'Monday': 'MO', 'Tuesday': 'TU', 'Wednesday': 'WE', 'Thursday': 'TH', 'Friday': 'FR' };
        var periodHours = [
            { start: '090000', end: '100000' },
            { start: '100000', end: '110000' },
            { start: '111500', end: '121500' },
            { start: '121500', end: '131500' },
            { start: '140000', end: '150000' },
            { start: '150000', end: '160000' }
        ];

        var ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//planEDU//Academic Timetable//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        var dayOffset = { 'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4 };
        var hasEvents = false;

        Object.keys(scheduleData).forEach(function (day) {
            var periods = scheduleData[day];
            if (!periods || typeof periods !== 'object') return;
            var offset = dayOffset[day] || 0;
            var eventDate = 20261116 + offset;

            Object.keys(periods).forEach(function (pNum) {
                var slot = periods[pNum];
                if (!slot || !slot.name) return;

                hasEvents = true;
                var pIdx = parseInt(pNum) - 1;
                var times = periodHours[pIdx] || { start: '090000', end: '100000' };

                ics.push('BEGIN:VEVENT');
                ics.push('UID:planedu-' + eventDate + '-' + pNum + '-' + Date.now() + '@planedu.com');
                ics.push('DTSTAMP:20261111T120000Z');
                ics.push('DTSTART:' + eventDate + 'T' + times.start);
                ics.push('DTEND:' + eventDate + 'T' + times.end);
                ics.push('RRULE:FREQ=WEEKLY;BYDAY=' + (dayMap[day] || 'MO'));
                ics.push('SUMMARY:' + (slot.name || 'Class') + (slot.code ? ' (' + slot.code + ')' : ''));
                ics.push('DESCRIPTION:Teacher: ' + (slot.teacher || 'TBA') + ' | Room: ' + (slot.room || 'TBA'));
                ics.push('LOCATION:' + (slot.room || 'Campus'));
                ics.push('STATUS:CONFIRMED');
                ics.push('END:VEVENT');
            });
        });

        if (!hasEvents) {
            alert('Your timetable does not have any assigned classes to export.');
            return;
        }

        ics.push('END:VCALENDAR');
        var blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = (filename || 'planedu_timetable') + '.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
})();
