* { box-sizing: border-box; }
:root {
  --navy: #101B3D;
  --navy-2: #1B2C5C;
  --orange: #FF5A1F;
  --orange-soft: #FFE4D6;
  --teal: #0FA3A3;
  --bg: #F4F5FA;
  --surface: #fff;
  --ink: #14213D;
  --muted: #626E8C;
  --line: #E2E5EF;
  --danger: #D6473C;
  --warning: #E08A1E;
  --success: #189A5C;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: 'IBM Plex Sans', sans-serif;
}
.app { max-width: 1180px; margin: 0 auto; padding: 28px 20px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; gap: 12px; flex-wrap: wrap; }
.eyebrow { font-size: 11px; letter-spacing: 0.06em; color: var(--orange); font-weight: 700; margin-bottom: 6px; }
.h1 { font-size: 23px; font-weight: 700; margin: 0; line-height: 1.25; color: var(--navy); }
.sub { font-size: 13.5px; color: var(--muted); margin-top: 6px; max-width: 480px; }
.save-state { font-size: 12px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }
.error-msg { font-size: 12px; color: var(--danger); margin-top: 4px; max-width: 220px; }
.user-label { font-size: 12px; color: var(--muted); margin-bottom: 6px; display: block; }

.summary-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 20px; }
.card { background: var(--surface); border-top: 3px solid var(--navy); border-radius: 6px; padding: 14px; box-shadow: 0 1px 3px rgba(16,27,61,0.06); }
.card-total { background: var(--navy); border-top: 3px solid var(--orange); color: #fff; }
.card-total .card-meta { color: #B7C0DE; }
.card-label { font-size: 11.5px; color: var(--muted); font-weight: 500; margin-bottom: 6px; }
.card-total .card-label { color: #B7C0DE; }
.card-big { font-size: 25px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; line-height: 1; color: var(--navy); }
.card-total .card-big { color: #fff; }
.card-meta { font-size: 11.5px; color: var(--muted); margin-top: 6px; }

.tabs { display: flex; gap: 4px; margin-bottom: -1px; position: relative; z-index: 1; }
.tab { font-family: 'IBM Plex Sans', sans-serif; font-size: 13.5px; font-weight: 600; padding: 9px 16px; border-radius: 6px 6px 0 0; cursor: pointer; border: none; background: transparent; color: var(--muted); }
.tab.active { background: var(--surface); color: var(--navy); box-shadow: 0 -2px 0 var(--orange) inset; }

.table-wrap { background: var(--surface); border: 1px solid var(--line); border-radius: 0 8px 8px 8px; overflow-x: auto; }
.tab-toolbar { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 12px 0; }
table { width: 100%; border-collapse: collapse; min-width: 900px; margin-top: 10px; }
thead tr { border-bottom: 1px solid var(--line); }
th { text-align: left; font-size: 11.5px; font-weight: 700; color: var(--muted); padding: 10px 12px; white-space: nowrap; }
tbody tr { border-bottom: 1px solid #EEF0F7; }
tbody tr:hover { background: #F7F8FC; }
td { padding: 8px 12px; vertical-align: middle; }
.footnote { font-size: 12px; color: var(--muted); padding: 10px 14px 14px; line-height: 1.5; }

.input { font-family: 'IBM Plex Mono', monospace; font-size: 13px; border: 1px solid var(--line); border-radius: 5px; padding: 5px 7px; width: 100%; background: #fff; color: var(--ink); }
.input.text { font-family: 'IBM Plex Sans', sans-serif; }
.input:focus { outline: 2px solid var(--teal); outline-offset: 1px; }
.select { font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; border: 1px solid var(--line); border-radius: 5px; padding: 5px 7px; background: #fff; color: var(--ink); }
.btn { font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; font-weight: 600; border-radius: 5px; padding: 7px 14px; border: 1px solid transparent; cursor: pointer; }
.btn:hover { opacity: 0.88; }
.btn-ghost { background: #fff; border: 1px solid var(--line); color: var(--navy); }
.btn-primary { background: var(--orange); color: #fff; }
.del-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 16px; }
.del-btn:hover { color: var(--danger); }
.warn-tiny { font-size: 10.5px; color: var(--danger); margin-top: 3px; }
.ok-tiny { font-size: 10.5px; color: var(--success); margin-top: 3px; }
