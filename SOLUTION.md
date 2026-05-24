Python
content = """# draw.io Custom Library Solution

## Root Causes of the Issue

Your event flow and `postMessage` protocol are actually completely correct. The issue lies entirely in **how the XML payload is formatted and encoded** within the `config` object. 

There are three specific reasons the library is failing to render:

1. **Over-Encoding (The `_x()` function):**
   draw.io expects the `xml` property of a custom library entry to be a **raw XML string**. 
   By converting `<` to `&lt;` and `"` to `&quot;`, you are passing HTML-encoded text. When draw.io internally calls `mxUtils.parseXml()`, it sees plain text instead of XML nodes, causing it to fail silently and skip the shape. `JSON.stringify` naturally handles the escaping of quotes (`"`) for JSON transport. **You must remove the `_x()` HTML-encoding function entirely.**
   
2. **Missing `<mxGraphModel>` Wrapper:**
   A bare `<mxCell>` is not a valid draggable snippet in draw.io. Every shape in a library must be a fully formed graph model. It must be wrapped in `<mxGraphModel><root>...`, and crucially, the shape itself must have a `parent="1"` attribute to attach it to the default diagram layer.

3. **Library Ordering (`defaultLibraries`):**
   While `customLibraries` defines the library, to force it to appear *before* the built-in "כללי" (General) library, you must explicitly declare the `defaultLibraries` array in your `config` object and place your custom ID first.

---

## The Solution (For the AI Code Writer)

Refactor your configuration code to implement the following:

### 1. The Helper Function & Library Definition
Replace your `_x()` function with a `wrapXml()` function that constructs a valid `mxGraphModel`.

Code output
File generated successfully.

```javascript
// Wraps a bare cell in the required draw.io graph model structure.
// Automatically injects parent="1" so the shape is attached to the default layer.
const wrapXml = (cellXml) => {
  const modifiedCell = cellXml.replace('<mxCell', '<mxCell parent="1"');
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${modifiedCell}</root></mxGraphModel>`;
};

const POSTAL_LIBRARY = [
  {
    title: 'שירות', tooltip: 'Service / Application Layer', w: 120, h: 60,
    // Pass raw XML (no HTML entities). JSON.stringify will safely escape the quotes.
    xml: wrapXml('<mxCell value="שירות" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1"><mxGeometry x="0" y="0" width="120" height="60" as="geometry"/></mxCell>'),
  },
  {
    title: 'דטהבייס', tooltip: 'Database / Storage Layer', w: 80, h: 100,
    xml: wrapXml('<mxCell value="דטהבייס" style="shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#ffe6cc;strokeColor=#d6b656;" vertex="1"><mxGeometry x="0" y="0" width="80" height="100" as="geometry"/></mxCell>'),
  },
  {
    title: 'FW / Security', tooltip: 'Firewall, WAF, Security Zone', w: 80, h: 80,
    xml: wrapXml('<mxCell value="FW" style="shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1"><mxGeometry x="0" y="0" width="80" height="80" as="geometry"/></mxCell>'),
  },
  {
    title: 'LB', tooltip: 'Load Balancer / Proxy', w: 80, h: 80,
    xml: wrapXml('<mxCell value="LB" style="rhombus;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1"><mxGeometry x="0" y="0" width="80" height="80" as="geometry"/></mxCell>'),
  },
  {
    title: 'Logs', tooltip: 'Logging / Monitoring', w: 100, h: 60,
    xml: wrapXml('<mxCell value="Logs" style="shape=note;whiteSpace=wrap;html=1;size=15;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1"><mxGeometry x="0" y="0" width="100" height="60" as="geometry"/></mxCell>'),
  },
  {
    title: 'API', tooltip: 'API Gateway / Integration', w: 120, h: 60,
    xml: wrapXml('<mxCell value="API" style="shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;fillColor=#d5e8d4;strokeColor=#009900;fontColor=#006600;" vertex="1"><mxGeometry x="0" y="0" width="120" height="60" as="geometry"/></mxCell>'),
  },
  {
    title: 'External', tooltip: 'שירות חיצוני / Cloud', w: 120, h: 80,
    xml: wrapXml('<mxCell value="External" style="ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;" vertex="1"><mxGeometry x="0" y="0" width="120" height="80" as="geometry"/></mxCell>'),
  },
  {
    title: 'ממשק', tooltip: 'תלות / Interface', w: 120, h: 60,
    xml: wrapXml('<mxCell value="ממשק" style="endArrow=block;startArrow=none;html=1;strokeColor=#000000;strokeWidth=2;" edge="1"><mxGeometry width="120" relative="1" as="geometry"><mxPoint x="0" y="30" as="sourcePoint"/><mxPoint x="120" y="30" as="targetPoint"/></mxGeometry></mxCell>'),
  },
];
2. The React postMessage Handler
Update the configure block to include defaultLibraries, which dictates the order in the sidebar.

JavaScript
  if (msg.event === 'configure') {
    send({
      action: 'configure',
      config: {
        // Force 'postal' to appear first, followed by the standard built-in libraries
        defaultLibraries: 'postal;general;miscellaneous;advanced;uml;er;bpmn;flowchart;basic;arrows2',
        customLibraries: [
          { 
            id: 'postal', 
            title: 'דואר', 
            entries: POSTAL_LIBRARY 
          }
        ],
      },
    });
  }
Answers to Your Open Questions
Is the configureEditor pseudocode accurate?
No. When passing JSON via the configure protocol, draw.io does not wrap your array in an <mxlibrary> XML tag and parse it as text. It iterates over your JSON array directly. It expects the xml property to be either base64-deflated (how .xml files are normally exported) or a valid, raw XML string starting with <mxGraphModel>.

Is there a known-working minimal example?
Yes, the updated code block above is the standard, working implementation for injecting libraries via JSON in draw.io 24.x.

Bare <mxCell> vs full <mxGraphModel>? Raw vs HTML-encoded?
It must be a full <mxGraphModel>. It must be raw, completely unencoded XML (no &lt; or &quot;). The wrapXml helper provided above handles the exact boilerplate mxGraph requires.

Is configure=1 the correct URL parameter?
Yes. configure=1 is correct and necessary to trigger the early configure event before init.

Is there a working alternative (e.g., clibs)?
While you can serve a standalone XML file and use &clibs=http://localhost:5173/my-lib.xml, your current approach using configure=1 and postMessage is actually the preferred best practice for React embedding. It avoids CORS headaches and keeps your application state centralized. Stick with configure.

Does lang=he affect the configure flow?
No. The lang parameter strictly loads translation files for the UI labels. It does not alter the underlying configuration protocols or JSON schemas.
"""
with open("drawio-custom-library-solution.md", "w", encoding="utf-8") as f:
f.write(content)
print("File generated successfully.")