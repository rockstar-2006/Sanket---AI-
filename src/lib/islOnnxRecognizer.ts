/**
 * In-Browser ONNX Runtime Temporal Recognizer for ISL 262 Sequence Model
 * Evaluates a 30-frame rolling window of MediaPipe landmarks using WebGL/WebAssembly.
 * 
 * Zero server latency, running client-side at 60 FPS.
 */

export interface OnnxPrediction {
  token: string;
  displayLabel: string;
  confidence: number;
  topK: { token: string; confidence: number }[];
}

export interface LandmarkPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarkResult {
  landmarks: LandmarkPoint3D[];
  handedness: 'Left' | 'Right';
}

function dist3D(a: LandmarkPoint3D, b: LandmarkPoint3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const FEATURE_DIM = 138;
const SEQUENCE_LENGTH = 30;

export class ISLOnnxRecognizer {
  private ortSession: any = null;
  private labels: string[] = [];
  private frameBuffer: Float32Array[] = [];
  private isModelLoaded: boolean = false;
  private isLoading: boolean = false;

  constructor() {}

  async initialize(
    modelUrl: string = '/models/isl_model.onnx',
    labelsUrl: string = '/models/isl_labels.json'
  ): Promise<boolean> {
    if (this.isModelLoaded || this.isLoading || typeof window === 'undefined') return false;
    this.isLoading = true;

    try {
      // 1. Fetch Class Labels
      const labelsRes = await fetch(labelsUrl);
      if (labelsRes.ok) {
        this.labels = await labelsRes.json();
      } else {
        console.warn('[ISL ONNX] Could not fetch labels from', labelsUrl);
        this.isLoading = false;
        return false;
      }

      // 2. Load ONNX Runtime Web via CDN dynamically if not on window
      if (!(window as any).ort) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js');
      }

      const ort = (window as any).ort;
      if (!ort) {
        console.warn('[ISL ONNX] onnxruntime-web script not available on window.');
        this.isLoading = false;
        return false;
      }

      // 3. Configure WASM / WebGL execution providers
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;

      // 4. Create ONNX Inference Session
      this.ortSession = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['webgl', 'wasm'],
        graphOptimizationLevel: 'all',
      });

      this.isModelLoaded = true;
      this.isLoading = false;
      console.log(
        `%c🧠 [ISL ONNX ENGINE] Production Model Loaded Successfully! (${this.labels.length} classes, Backend: WebGL/WASM)`,
        'color: #10b981; font-weight: bold; font-size: 12px; background: #064e3b; padding: 4px 8px; border-radius: 4px;'
      );
      return true;
    } catch (err) {
      console.warn('[ISL ONNX] Note loading ONNX model:', err);
      this.isLoading = false;
      return false;
    }
  }

  isReady(): boolean {
    return this.isModelLoaded && this.ortSession !== null;
  }

  /**
   * Adds a live video frame's landmarks to the 30-frame rolling window.
   */
  pushFrame(hands: HandLandmarkResult[], poseLandmarks?: LandmarkPoint3D[]): void {
    const feat = new Float32Array(FEATURE_DIM);

    // 1. Pose landmarks (indices 0 to 11)
    const nose = poseLandmarks?.[0] || { x: 0.5, y: 0.2, z: 0 };
    const lSh = poseLandmarks?.[11] || { x: 0.4, y: 0.4, z: 0 };
    const rSh = poseLandmarks?.[12] || { x: 0.6, y: 0.4, z: 0 };
    const neck = {
      x: (lSh.x + rSh.x) / 2.0,
      y: (lSh.y + rSh.y) / 2.0,
      z: ((lSh.z || 0) + (rSh.z || 0)) / 2.0,
    };

    let shoulderWidth = dist3D(lSh, rSh);
    if (shoulderWidth < 0.05) shoulderWidth = 0.25;

    const posePts = [nose, lSh, rSh, neck];
    for (let i = 0; i < 4; i++) {
      feat[i * 3 + 0] = (posePts[i].x - neck.x) / shoulderWidth;
      feat[i * 3 + 1] = (posePts[i].y - neck.y) / shoulderWidth;
      feat[i * 3 + 2] = ((posePts[i].z || 0) - neck.z) / shoulderWidth;
    }

    // 2. Right Hand (indices 12 to 74 in ISL 262 training dataset)
    const rightHand = hands.find((h) => h.handedness === 'Right') || (hands.length === 1 ? hands[0] : null);
    if (rightHand && rightHand.landmarks?.length >= 21) {
      const lm = rightHand.landmarks;
      const wrist = lm[0];
      let palmScale = dist3D(wrist, lm[9]);
      if (palmScale < 0.03) palmScale = 0.12;

      for (let j = 0; j < 21; j++) {
        feat[12 + j * 3 + 0] = (lm[j].x - wrist.x) / palmScale;
        feat[12 + j * 3 + 1] = (lm[j].y - wrist.y) / palmScale;
        feat[12 + j * 3 + 2] = ((lm[j].z || 0) - (wrist.z || 0)) / palmScale;
      }
    }

    // 3. Left Hand (indices 75 to 137 in ISL 262 training dataset)
    const leftHand = hands.find((h) => h.handedness === 'Left') || (hands.length === 2 && hands[0] === rightHand ? hands[1] : null);
    if (leftHand && leftHand.landmarks?.length >= 21) {
      const lm = leftHand.landmarks;
      const wrist = lm[0];
      let palmScale = dist3D(wrist, lm[9]);
      if (palmScale < 0.03) palmScale = 0.12;

      for (let j = 0; j < 21; j++) {
        feat[75 + j * 3 + 0] = (lm[j].x - wrist.x) / palmScale;
        feat[75 + j * 3 + 1] = (lm[j].y - wrist.y) / palmScale;
        feat[75 + j * 3 + 2] = ((lm[j].z || 0) - (wrist.z || 0)) / palmScale;
      }
    }

    this.frameBuffer.push(feat);
    if (this.frameBuffer.length > SEQUENCE_LENGTH) {
      this.frameBuffer.shift();
    }
  }

  /**
   * Executes inference on the 30-frame temporal buffer.
   */
  async predict(): Promise<OnnxPrediction | null> {
    if (!this.isReady() || this.frameBuffer.length < SEQUENCE_LENGTH) {
      return null;
    }

    const ort = (window as any).ort;
    if (!ort) return null;

    try {
      // Flatten 30 frames * 138 features into 1D float array
      const flattened = new Float32Array(SEQUENCE_LENGTH * FEATURE_DIM);
      for (let t = 0; t < SEQUENCE_LENGTH; t++) {
        flattened.set(this.frameBuffer[t], t * FEATURE_DIM);
      }

      // Create Tensor [1, 30, 138]
      const inputTensor = new ort.Tensor('float32', flattened, [1, SEQUENCE_LENGTH, FEATURE_DIM]);
      const feeds = { input_landmarks: inputTensor };

      const results = await this.ortSession.run(feeds);
      const outputTensor = results.output_logits || Object.values(results)[0];
      const logits = outputTensor.data as Float32Array;

      // Compute Softmax probabilities
      let maxLogit = -Infinity;
      for (let i = 0; i < logits.length; i++) {
        if (logits[i] > maxLogit) maxLogit = logits[i];
      }

      let sumExp = 0.0;
      const probs = new Float32Array(logits.length);
      for (let i = 0; i < logits.length; i++) {
        probs[i] = Math.exp(logits[i] - maxLogit);
        sumExp += probs[i];
      }
      for (let i = 0; i < logits.length; i++) {
        probs[i] /= sumExp;
      }

      // Get Top 5 candidates with their probabilities
      const indexed = Array.from(probs).map((p, idx) => ({ idx, p }));
      indexed.sort((a, b) => b.p - a.p);
      const top5 = indexed.slice(0, 5).map((item) => ({
        token: (this.labels[item.idx] || 'UNKNOWN').toUpperCase(),
        confidence: Math.round(item.p * 100) / 100,
      }));

      const bestIdx = indexed[0].idx;
      const bestProb = indexed[0].p;
      const predictedWord = (this.labels[bestIdx] || 'UNKNOWN').toUpperCase();

      return {
        token: predictedWord,
        displayLabel: predictedWord.charAt(0) + predictedWord.slice(1).toLowerCase(),
        confidence: Math.round(bestProb * 100) / 100,
        topK: top5,
      };
    } catch (err) {
      return null;
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }
}
