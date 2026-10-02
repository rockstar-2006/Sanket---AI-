const fs = require("fs");
const file = "d:/Matri/src/lib/fingerspellingEngine.ts";
let src = fs.readFileSync(file, "utf8");

// Fix 1: Move right wrist to actual signing position (lower = in front of chest, not at shoulder)
// Real parquet signing: wrist at y~0.44-0.46, x~0.40-0.44
src = src.replace(
  "basePose[14] = { x: 0.34, y: 0.44, z:  0.02 }; // Right elbow",
  "basePose[14] = { x: 0.32, y: 0.48, z:  0.02 }; // Right elbow"
);
src = src.replace(
  "const rightWristBase: Landmark3D = { x: 0.43, y: 0.36, z: -0.03 }; // Right wrist",
  "const rightWristBase: Landmark3D = { x: 0.40, y: 0.44, z: -0.02 }; // Right wrist (signing position, in front of chest)"
);

// Fix 2: Scale up finger segments to match real parquet hand size (~0.07 Y span wrist-to-tip)
// Real: knuckles ~0.04 below wrist, fingertips ~0.07 below wrist → segments need to be bigger
src = src.replace(
  "    [0.026, 0.019, 0.015], // Index",
  "    [0.040, 0.028, 0.020], // Index"
);
src = src.replace(
  "    [0.028, 0.021, 0.016], // Middle",
  "    [0.042, 0.030, 0.022], // Middle"
);
src = src.replace(
  "    [0.025, 0.018, 0.015], // Ring",
  "    [0.038, 0.026, 0.020], // Ring"
);
src = src.replace(
  "    [0.020, 0.015, 0.013], // Pinky",
  "    [0.030, 0.022, 0.016], // Pinky"
);

// Fix 3: Scale up knuckle Y offsets to match (knuckles ~0.04 below wrist in real data)
src = src.replace(
  "    { x: -0.022, y: 0.020, z: -0.008 }, // Thumb CMC [1]",
  "    { x: -0.022, y: 0.024, z: -0.008 }, // Thumb CMC [1]"
);
src = src.replace(
  "    { x: -0.016, y: 0.048, z: -0.006 }, // Index  MCP [5]",
  "    { x: -0.018, y: 0.040, z: -0.006 }, // Index  MCP [5]"
);
src = src.replace(
  "    { x:  0.000, y: 0.052, z:  0.000 }, // Middle MCP [9]",
  "    { x:  0.000, y: 0.044, z:  0.000 }, // Middle MCP [9]"
);
src = src.replace(
  "    { x:  0.016, y: 0.048, z:  0.006 }, // Ring   MCP [13]",
  "    { x:  0.016, y: 0.040, z:  0.006 }, // Ring   MCP [13]"
);
src = src.replace(
  "    { x:  0.026, y: 0.040, z:  0.010 }, // Pinky  MCP [17]",
  "    { x:  0.026, y: 0.034, z:  0.010 }, // Pinky  MCP [17]"
);

// Fix 4: Scale up thumb segments accordingly
src = src.replace(
  "  joints[2] = { x: cmc.x - 0.018 * tExt - 0.006 * tCurl, y: cmc.y - 0.016 * tExt + 0.010 * tCurl, z: cmc.z - 0.010 };",
  "  joints[2] = { x: cmc.x - 0.026 * tExt - 0.008 * tCurl, y: cmc.y - 0.022 * tExt + 0.014 * tCurl, z: cmc.z - 0.012 };"
);
src = src.replace(
  "  joints[3] = { x: cmc.x - 0.030 * tExt + 0.002 * tCurl, y: cmc.y - 0.028 * tExt + 0.015 * tCurl, z: cmc.z - 0.012 };",
  "  joints[3] = { x: cmc.x - 0.042 * tExt + 0.004 * tCurl, y: cmc.y - 0.038 * tExt + 0.020 * tCurl, z: cmc.z - 0.015 };"
);
src = src.replace(
  "  joints[4] = { x: cmc.x - 0.040 * tExt + 0.010 * tCurl, y: cmc.y - 0.036 * tExt + 0.018 * tCurl, z: cmc.z - 0.014 };",
  "  joints[4] = { x: cmc.x - 0.054 * tExt + 0.014 * tCurl, y: cmc.y - 0.048 * tExt + 0.024 * tCurl, z: cmc.z - 0.018 };"
);

fs.writeFileSync(file, src, "utf8");
console.log("Fixed wrist position, hand scale, and knuckle offsets");
