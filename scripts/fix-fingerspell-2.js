const fs = require("fs");
const file = "d:/Matri/src/lib/fingerspellingEngine.ts";
let src = fs.readFileSync(file, "utf8");

// Fix the hook direction — hook goes UP (negative Y = smaller = upward)
// Currently: dipDirY = l2 * 0.75 (positive = down) which is fine for a curled finger
// The hook case sends DIP upward which is correct for a hooked/bent finger

// Fix the pipDirZ: when extended (ext=1), Z should barely change (finger points straight up not toward camera)
// Current: lerp(-l1*0.70, -0.004, ext) — at ext=0: -0.017 (toward camera), at ext=1: -0.004 (barely)
// This is actually correct for MediaPipe convention where z becomes negative as finger extends forward

// The Y fixes already applied should be sufficient. Now fix the wrist position
// to match real parquet data (wrist at y~0.38, z~0.0 not -0.12)
src = src.replace(
  "const rightWristBase: Landmark3D = { x: 0.44, y: 0.38, z: -0.12 }; // Right wrist",
  "const rightWristBase: Landmark3D = { x: 0.44, y: 0.38, z: -0.04 }; // Right wrist (z matches parquet signing plane)"
);

// Also fix the right elbow to match (currently z:0.04 pointing away from camera while wrist was -0.12 = inconsistent)
src = src.replace(
  "basePose[14] = { x: 0.33, y: 0.44, z: 0.04 };  // Right elbow",
  "basePose[14] = { x: 0.33, y: 0.46, z: 0.0 };   // Right elbow"
);

// Fix hook DIP Y: should curl the fingertip TOWARD the palm which means going UP (negative Y = smaller)
src = src.replace(
  "      dipDirY = l2 * 0.75;",
  "      dipDirY = -l2 * 0.75;"
);
src = src.replace(
  "      tipDirY = l3 * 0.85;",
  "      tipDirY = -l3 * 0.85;"
);

// Fix thumb Y offsets: thumb 'up' should go UP = negative Y (already negative, keep)
// thumb 'fold' goes across palm — slightly down in Y is fine  
// Just fix the 'up' case: currently going -0.018, -0.034, -0.048 from CMC
// CMC is now at wY + 0.020 (knuckle fix). Thumb tip going up to wY + 0.020 - 0.048 = wY - 0.028
// That would put thumb tip ABOVE wrist at wY. For MediaPipe, thumb up means smaller Y, so this is correct.

fs.writeFileSync(file, src, "utf8");
console.log("Done");
