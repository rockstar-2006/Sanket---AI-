const fs = require("fs");
const file = "d:/Matri/src/lib/fingerspellingEngine.ts";
let src = fs.readFileSync(file, "utf8");

// Fix PIP Y: ext=1 (extended) should go +Y (downward in MediaPipe = toward fingertips)
src = src.replace(
  "const pipDirY = lerp(l1 * 0.45, -l1, ext);",
  "const pipDirY = lerp(-l1 * 0.18, l1, ext);"
);

// Fix DIP Y for straight fingers
src = src.replace(
  "dipDirY = lerp(l2 * 0.75, -l2, ext);",
  "dipDirY = lerp(-l2 * 0.5, l2, ext);"
);

// Fix Tip Y for straight fingers
src = src.replace(
  "tipDirY = lerp(l3 * 0.65, -l3, ext);",
  "tipDirY = lerp(-l3 * 0.5, l3, ext);"
);

// Fix knuckle Y: positive = downward from wrist (where knuckles actually are)
src = src.replace("{ x: -0.022, y: -0.020, z: -0.008 }, // Thumb CMC (1)", "{ x: -0.022, y:  0.020, z: -0.008 }, // Thumb CMC (1)");
src = src.replace("{ x: -0.014, y: -0.052, z: -0.006 }, // Index MCP (5)", "{ x: -0.014, y:  0.052, z: -0.006 }, // Index MCP (5)");
src = src.replace("{ x: 0.002, y: -0.056, z: 0.000 },  // Middle MCP (9)", "{ x: 0.002, y:  0.056, z: 0.000 },  // Middle MCP (9)");
src = src.replace("{ x: 0.016, y: -0.050, z: 0.006 },  // Ring MCP (13)", "{ x: 0.016, y:  0.050, z: 0.006 },  // Ring MCP (13)");
src = src.replace("{ x: 0.028, y: -0.042, z: 0.012 },  // Pinky MCP (17)", "{ x: 0.028, y:  0.042, z: 0.012 },  // Pinky MCP (17)");

fs.writeFileSync(file, src, "utf8");
console.log("Done");
