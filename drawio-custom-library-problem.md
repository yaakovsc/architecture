# draw.io Embedded Custom Library — Not Appearing

## Goal

Inject a custom shape library ("דואר") into a self-hosted draw.io instance that is embedded via `<iframe>` inside a React app, using the `proto=json` postMessage protocol. The library should appear in the shape panel on the left side of the editor, positioned before the built-in "כללי" (General) library.

---

## Environment

| Component | Details |
|---|---|
| draw.io | `jgraph/drawio:24.04` running in Docker, port 8181 |
| Host app | React 18 + Vite 4 (dev server on port 5173) |
| Embed mode | `<iframe src="http://localhost:8181/?embed=1&spin=1&proto=json&lang=he&ui=kennedy&configure=1">` |
| Protocol | `proto=json` — bidirectional postMessage in JSON |
| Browser | Chrome (latest) |
| OS | macOS |

---

## What We Know Works

The `proto=json` embed protocol works correctly end-to-end:

1. draw.io sends `{ event: 'configure' }` (because `configure=1` is in the URL)
2. App responds with `{ action: 'configure', config: { customLibraries: [...] } }`
3. draw.io sends `{ event: 'init' }`
4. App responds with `{ action: 'load', xml: '' }` (or existing diagram XML)
5. draw.io sends `{ event: 'load' }` — editor is visible and functional

Save, export-to-PNG, and exit all work correctly.

**Confirmed via browser console logging:** the `configure` event IS received, and `init` fires after our `configure` action response — meaning draw.io processed the configure action without error.

---

## The Problem

Despite the correct event flow, the custom library **never appears** in the shape panel. The panel looks identical to an unconfigured editor (shows only the default built-in libraries).

No JavaScript errors appear in the outer page console. We cannot easily inspect the draw.io iframe's internal console.

---

## What We Have Tried

### Attempt 1 — Send configure on `init` (no `configure=1` in URL)
Responded to `init` with a configure action before `load`. Had no effect — draw.io ignores configure actions received after init.

### Attempt 2 — Add `configured=1` to URL
Used `configured=1` (wrong parameter name). draw.io sent `init` directly without `configure` event — the parameter was silently ignored.

### Attempt 3 — Correct `configure=1` + full mxGraphModel XML in entries
Used correct URL parameter. Confirmed configure event fires. Entries used full `<mxGraphModel><root>...<mxCell>...</root></mxGraphModel>` XML, with `<`/`>` HTML-encoded but `"` left raw (relying on JSON.stringify to escape as `\"`).

Theory: draw.io does `JSON.stringify(entries)` → wraps in `<mxlibrary>…</mxlibrary>` → XML-parses it → reads text content → JSON.parses. The `\"` sequences survive XML text-content parsing and are decoded by JSON.parse. But the library still did not appear.

### Attempt 4 — Bare `<mxCell>` + full encoding including `"` → `&quot;`
Switched to the format draw.io library files actually export: bare `<mxCell>` without the mxGraphModel wrapper. Also encoded `"` as `&quot;` in addition to `<`/`>`. Removed `defaultLibraries` from config. **Still no change.**

---

## Current Code

### iframe URL

```
http://localhost:8181/?embed=1&spin=1&proto=json&lang=he&ui=kennedy&configure=1
```

### postMessage handler (React component)

```js
const handleMessage = (e) => {
  if (e.origin !== 'http://localhost:8181') return;
  let msg;
  try { msg = JSON.parse(e.data); } catch { return; }

  const send = (action) =>
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(action), 'http://localhost:8181');

  if (msg.event === 'configure') {
    send({
      action: 'configure',
      config: {
        customLibraries: [{ id: 'postal', title: 'דואר', entries: POSTAL_LIBRARY }],
      },
    });
  } else if (msg.event === 'init') {
    send({ action: 'load', xml: xml || '' });
  }
  // ... save / export / exit handlers
};
```

### Library entries definition

```js
// Full entity-encoding: &, <, >, " all encoded
const _x = s => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const POSTAL_LIBRARY = [
  {
    title: 'שירות', tooltip: 'Service / Application Layer', w: 120, h: 60,
    xml: _x('<mxCell value="שירות" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1"><mxGeometry x="0" y="0" width="120" height="60" as="geometry"/></mxCell>'),
  },
  {
    title: 'דטהבייס', tooltip: 'Database / Storage Layer', w: 80, h: 100,
    xml: _x('<mxCell value="דטהבייס" style="shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#ffe6cc;strokeColor=#d6b656;" vertex="1"><mxGeometry x="0" y="0" width="80" height="100" as="geometry"/></mxCell>'),
  },
  {
    title: 'FW / Security', tooltip: 'Firewall, WAF, Security Zone', w: 80, h: 80,
    xml: _x('<mxCell value="FW" style="shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1"><mxGeometry x="0" y="0" width="80" height="80" as="geometry"/></mxCell>'),
  },
  {
    title: 'LB', tooltip: 'Load Balancer / Proxy', w: 80, h: 80,
    xml: _x('<mxCell value="LB" style="rhombus;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1"><mxGeometry x="0" y="0" width="80" height="80" as="geometry"/></mxCell>'),
  },
  {
    title: 'Logs', tooltip: 'Logging / Monitoring', w: 100, h: 60,
    xml: _x('<mxCell value="Logs" style="shape=note;whiteSpace=wrap;html=1;size=15;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1"><mxGeometry x="0" y="0" width="100" height="60" as="geometry"/></mxCell>'),
  },
  {
    title: 'API', tooltip: 'API Gateway / Integration', w: 120, h: 60,
    xml: _x('<mxCell value="API" style="shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;fillColor=#d5e8d4;strokeColor=#009900;fontColor=#006600;" vertex="1"><mxGeometry x="0" y="0" width="120" height="60" as="geometry"/></mxCell>'),
  },
  {
    title: 'External', tooltip: 'שירות חיצוני / Cloud', w: 120, h: 80,
    xml: _x('<mxCell value="External" style="ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;" vertex="1"><mxGeometry x="0" y="0" width="120" height="80" as="geometry"/></mxCell>'),
  },
  {
    title: 'ממשק', tooltip: 'תלות / Interface', w: 120, h: 60,
    xml: _x('<mxCell value="ממשק" style="endArrow=block;startArrow=none;html=1;strokeColor=#000000;strokeWidth=2;" edge="1"><mxGeometry width="120" relative="1" as="geometry"><mxPoint x="0" y="30" as="sourcePoint"/><mxPoint x="120" y="30" as="targetPoint"/></mxGeometry></mxCell>'),
  },
];
```

### What `_x()` produces for the first entry

Input:
```
<mxCell value="שירות" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1">
  <mxGeometry x="0" y="0" width="120" height="60" as="geometry"/>
</mxCell>
```

Output (what is placed in the `xml` field):
```
&lt;mxCell value=&quot;שירות&quot; style=&quot;rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;&quot; vertex=&quot;1&quot;&gt;
  &lt;mxGeometry x=&quot;0&quot; y=&quot;0&quot; width=&quot;120&quot; height=&quot;60&quot; as=&quot;geometry&quot;/&gt;
&lt;/mxCell&gt;
```

---

## Our Understanding of draw.io's Internal Processing

When draw.io receives `{ action: 'configure', config: { customLibraries: [...] } }`, it calls `configureEditor(config)` which (based on reading the draw.io source) does approximately:

```js
// Pseudocode — draw.io's configureEditor
for (const lib of config.customLibraries) {
  const xml = '<mxlibrary>' + JSON.stringify(lib.entries) + '</mxlibrary>';
  loadLibraryXml(xml, lib.id, lib.title);
}

// loadLibraryXml:
function loadLibraryXml(xml, id, title) {
  const doc = mxUtils.parseXml(xml);           // DOMParser, text/xml
  const json = mxUtils.getTextContent(doc.documentElement); // text content, entities decoded
  const entries = JSON.parse(json);
  for (const entry of entries) {
    if (entry.xml) {
      const node = mxUtils.parseXml(entry.xml).documentElement;
      // add shape preview to sidebar
    }
  }
}
```

The encoding chain we believe is required:

```
Raw XML string
  → _x() → HTML-entity-encoded string (stored in entry.xml)
  → JSON.stringify(entries) → JSON (no further escaping needed since no raw ")
  → '<mxlibrary>' + json + '</mxlibrary>' → valid XML (entities in text content are valid)
  → mxUtils.getTextContent() → entities decoded back to raw JSON
  → JSON.parse() → array with { xml: '<mxCell ...>' }
  → mxUtils.parseXml(entry.xml) → valid parse → shape added to sidebar
```

---

## Open Questions

1. **Is the `configureEditor` pseudocode above accurate for draw.io 24.04?** Specifically, does `lib.entries` get `JSON.stringify`'d and wrapped in `<mxlibrary>`, or is it processed directly?

2. **Is there a known-working minimal example** of injecting a custom library via `configure=1` + `{ action: 'configure', config: { customLibraries: [...] } }` in draw.io 24.x?

3. **Is the `<mxCell>` bare format correct for entries**, or should entries contain full `<mxGraphModel>` XML? Does the `xml` field value need to be raw, HTML-encoded, or something else?

4. **Is `configure=1` the correct URL parameter for draw.io 24.04**, or has it been renamed (e.g. to `configured=1`)?

5. **Is there a working alternative** — for example, serving a `.xml` library file and loading it via `&clibs=<url>` — and if so, does it work in embedded (`embed=1`) mode with the `kennedy` UI?

6. **Does `lang=he` affect the configure flow?** The Hebrew locale is the only unusual parameter compared to typical embed examples.

---

## What a Working Solution Must Do

- Load the "דואר" library in the shape panel without user action
- The library should appear before or near the "כללי" (General) built-in library
- All of the above must work inside a `<iframe>` in embedded/proto=json mode
- The draw.io instance is self-hosted via Docker (`jgraph/drawio:24.04`) — no cloud/online draw.io
- The parent React app is on a different port (5173) from draw.io (8181), both on localhost
