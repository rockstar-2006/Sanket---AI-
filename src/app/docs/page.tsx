'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { 
  Database, 
  Terminal, 
  Copy, 
  Check, 
  Download, 
  Search, 
  Filter, 
  Code2, 
  Layers, 
  Cpu, 
  Activity, 
  CheckCircle2, 
  FileText, 
  BookOpen, 
  ExternalLink, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  Zap,
  Globe,
  Sliders,
  Share2,
  ChevronRight,
  Info
} from 'lucide-react';
import { ISL_DATASET_WORDS, ISL_DATASET_METRICS, DatasetWordItem } from '@/lib/datasetCatalog';

export default function DatasetDocsPage() {
  const [activeCliTab, setActiveCliTab] = useState<'powershell' | 'curl' | 'python' | 'npx'>('powershell');
  const [activeCodeTab, setActiveCodeTab] = useState<'pandas' | 'pytorch' | 'node'>('pandas');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const cliCommands = {
    powershell: 'irm https://sanket.ai/get-dataset.ps1 | iex',
    curl: 'curl -fsSL https://sanket.ai/get-dataset.sh | bash',
    python: 'python -c "import urllib.request, json; print(len(json.loads(urllib.request.urlopen(\'https://sanket.ai/api/dataset/download\').read())[\'dataset\']), \'ISL files ready\')"',
    npx: 'npx sanket-dataset download'
  };

  const codeSnippets = {
    pandas: `# Load and inspect any ISL motion trajectory in Python
import pandas as pd

# Load doctor sign motion capture recording
df = pd.read_parquet('sanket-isl-dataset/doctor/MVI_0128.parquet')

print("Total Video Frames Captured:", len(df))
print("Kinematic Schema:", df.columns.tolist()[:10])
print(df.head())`,
    pytorch: `# Load 21 3D Landmark Nodes into PyTorch Tensor [Batch, Frames, 63]
import pandas as pd
import numpy as np
import torch
import torch.nn as nn

# Load Apache Parquet coordinates
raw_df = pd.read_parquet('sanket-isl-dataset/doctor/MVI_0128.parquet')
landmark_values = raw_df.select_dtypes(include=[np.number]).values

# Convert to 32-bit floating point tensor for neural inference
motion_tensor = torch.tensor(landmark_values, dtype=torch.float32)
print("Tensor Shape [TimeFrames, Coordinates]:", motion_tensor.shape)

# Example BiLSTM classifier input
lstm = nn.LSTM(input_size=63, hidden_size=128, batch_first=True)
out, (hn, cn) = lstm(motion_tensor.unsqueeze(0))
print("Latent Feature Representation:", out.shape)`,
    node: `// Read and decode Parquet coordinates in Node.js / TypeScript
import { parquetRead } from 'hyparquet';
import fs from 'node:fs';

const buffer = fs.readFileSync('sanket-isl-dataset/doctor/MVI_0128.parquet');

await parquetRead({
  file: buffer,
  onComplete: (data) => {
    console.log('Decoded Frame Count:', data.length);
    console.log('Sample Landmark Node (Wrist x,y,z):', data[0]);
  }
});`
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    ISL_DATASET_WORDS.forEach(w => cats.add(w.category));
    return ['All', ...Array.from(cats)];
  }, []);

  const filteredWords = useMemo(() => {
    return ISL_DATASET_WORDS.filter((item) => {
      const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        item.token.toLowerCase().includes(q) ||
        item.displayLabel.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.datasetFile.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const bibtexCitation = `@dataset{sanket_ai_isl_2026,
  author = {Sanket AI Research & Telehealth Team},
  title = {Sanket AI Authentic Indian Sign Language (ISL) Ground-Truth Kinematic Dataset},
  year = {2026},
  publisher = {Sanket AI Open Access Repository},
  version = {2.4.0},
  url = {https://sanket.ai/docs},
  note = {288 ISL Tokens, 262 Parquet Motion Captures, 21 Landmark Nodes at 30 FPS}
}`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 bg-grid-lines">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        
        {/* Breadcrumb Header */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <Link href="/" className="hover:text-orange-600 transition">Sanket AI</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-700 font-semibold">Developer Documentation</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-orange-600 font-bold">ISL Dataset &amp; CLI</span>
        </div>

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-100/90 via-amber-50/70 to-white border border-slate-200/90 p-8 sm:p-12 shadow-xs">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-700 text-xs font-mono font-bold tracking-wide">
                Version 2.4.0 • Apache Parquet
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-mono font-bold">
                288 Tokens • 262 Parquet Captures
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-mono font-bold">
                CC-BY-4.0 Open Research
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-heading font-black text-slate-900 tracking-tight leading-[1.15]">
              Indian Sign Language (ISL) <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">
                Ground-Truth Kinematic Dataset.
              </span>
            </h1>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl">
              Official developer documentation and CLI tools for the Sanket AI Indian Sign Language motion dataset. 
              Clone 262 motion captures directly into your local workspace via terminal, explore the coordinate schema, 
              and train neural architectures with plug-and-play Python &amp; PyTorch loaders.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href="#quickstart"
                className="px-6 py-3 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-heading font-bold text-xs sm:text-sm shadow-md shadow-orange-600/20 transition flex items-center gap-2 cursor-pointer"
              >
                <Terminal className="w-4 h-4" />
                <span>Get Dataset CLI Command</span>
              </a>

              <a
                href="#vocabulary-catalog"
                className="px-6 py-3 rounded-full bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-heading font-bold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-orange-600" />
                <span>Browse 288 Signs</span>
              </a>
            </div>
          </div>
        </div>

        {/* ─── 1. QUICKSTART TERMINAL CLONE SECTION ─────────────────────────── */}
        <section id="quickstart" className="scroll-mt-20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-heading font-black text-slate-900 flex items-center gap-2.5">
                <Terminal className="w-6 h-6 text-orange-600" />
                <span>1-Click Terminal Clone</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Open VS Code terminal in your project directory, copy and execute the command below:
              </p>
            </div>

            <a
              href="/api/dataset/download?format=zip"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-heading font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Direct Download (.zip)</span>
            </a>
          </div>

          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
            {/* Terminal Window Top Bar */}
            <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-mono font-bold text-slate-400">
                  bash / powershell — Terminal
                </span>
              </div>

              {/* CLI Command Switcher Tabs */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                <button
                  onClick={() => setActiveCliTab('powershell')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer font-bold ${
                    activeCliTab === 'powershell'
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Windows (PowerShell)
                </button>
                <button
                  onClick={() => setActiveCliTab('curl')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer font-bold ${
                    activeCliTab === 'curl'
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  macOS / Linux (cURL)
                </button>
                <button
                  onClick={() => setActiveCliTab('python')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer font-bold ${
                    activeCliTab === 'python'
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Python
                </button>
                <button
                  onClick={() => setActiveCliTab('npx')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer font-bold ${
                    activeCliTab === 'npx'
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  NPX
                </button>
              </div>
            </div>

            {/* Terminal Command Execution Box */}
            <div className="p-6 sm:p-8 flex items-center justify-between gap-4 font-mono text-sm sm:text-base">
              <div className="flex items-center gap-3 overflow-x-auto select-all scrollbar-none text-slate-100">
                <span className="text-orange-400 select-none font-bold">$</span>
                <span className="text-emerald-400 font-semibold">{cliCommands[activeCliTab]}</span>
              </div>

              <button
                onClick={() => copyToClipboard(cliCommands[activeCliTab], 'cli-cmd')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-heading font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                title="Copy Terminal Command"
              >
                {copiedId === 'cli-cmd' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Copy Command</span>
                  </>
                )}
              </button>
            </div>

            <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800/80 text-xs font-mono text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-orange-400 shrink-0" />
              <span>
                Creates a <strong className="text-slate-200">./sanket-isl-dataset/</strong> folder with all 262 .parquet recordings, manifest, and schema.
              </span>
            </div>
          </div>
        </section>

        {/* ─── 2. DATASET ARCHITECTURE & BENCHMARK METRICS ──────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-heading font-black text-slate-900 flex items-center gap-2.5">
              <Database className="w-6 h-6 text-orange-600" />
              <span>Dataset Architecture &amp; Specifications</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Engineered with 3D kinematic MediaPipe landmarks and anti-flicker spatial smoothing
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Vocabulary</span>
              <div className="text-2xl font-heading font-black text-slate-900">{ISL_DATASET_METRICS.totalWords}</div>
              <p className="text-[11px] text-slate-500">Accessible Signs</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Recordings</span>
              <div className="text-2xl font-heading font-black text-slate-900">{ISL_DATASET_METRICS.parquetRecordings}</div>
              <p className="text-[11px] text-slate-500">Parquet Files</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Hand Nodes</span>
              <div className="text-2xl font-heading font-black text-slate-900">21 / Hand</div>
              <p className="text-[11px] text-slate-500">42 Dual-Hand Points</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Sample Rate</span>
              <div className="text-2xl font-heading font-black text-slate-900">{ISL_DATASET_METRICS.captureFrameRate}</div>
              <p className="text-[11px] text-slate-500">High-FPS Motion</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Hold Threshold</span>
              <div className="text-2xl font-heading font-black text-slate-900">{ISL_DATASET_METRICS.holdConfirmationTimeMs} ms</div>
              <p className="text-[11px] text-slate-500">Anti-Flicker Filter</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Storage Format</span>
              <div className="text-2xl font-heading font-black text-slate-900">Parquet</div>
              <p className="text-[11px] text-slate-500">Snappy Compressed</p>
            </div>
          </div>
        </section>

        {/* ─── 3. SCHEMA DOCUMENTATION TABLE ────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-heading font-black text-slate-900 flex items-center gap-2.5">
              <Layers className="w-6 h-6 text-orange-600" />
              <span>Coordinate Frame &amp; Column Schema</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Normalized coordinate spaces [0.0, 1.0] across dual-hand skeletal nodes
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-mono text-slate-600 uppercase text-[11px]">
                    <th className="py-3 px-5 font-bold">Column Name</th>
                    <th className="py-3 px-5 font-bold">Data Type</th>
                    <th className="py-3 px-5 font-bold">Value Range</th>
                    <th className="py-3 px-5 font-bold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-body">
                  <tr className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">frame_idx</td>
                    <td className="py-3 px-5 font-mono text-orange-600">int32</td>
                    <td className="py-3 px-5 font-mono text-slate-500">0 to N</td>
                    <td className="py-3 px-5 text-slate-700">Sequential video frame number recorded at 30 FPS.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">timestamp_ms</td>
                    <td className="py-3 px-5 font-mono text-orange-600">float64</td>
                    <td className="py-3 px-5 font-mono text-slate-500">&gt;= 0.0</td>
                    <td className="py-3 px-5 text-slate-700">Elapsed millisecond timing since the start of sign articulation.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">hand_type</td>
                    <td className="py-3 px-5 font-mono text-orange-600">string</td>
                    <td className="py-3 px-5 font-mono text-slate-500">&quot;left&quot; | &quot;right&quot; | &quot;dual&quot;</td>
                    <td className="py-3 px-5 text-slate-700">Detected dominant vs non-dominant anatomical hand orientation.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">x0 .. x20</td>
                    <td className="py-3 px-5 font-mono text-orange-600">float32</td>
                    <td className="py-3 px-5 font-mono text-slate-500">[0.0, 1.0]</td>
                    <td className="py-3 px-5 text-slate-700">Normalized horizontal coordinate of 21 landmark nodes (wrist to fingertips).</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">y0 .. y20</td>
                    <td className="py-3 px-5 font-mono text-orange-600">float32</td>
                    <td className="py-3 px-5 font-mono text-slate-500">[0.0, 1.0]</td>
                    <td className="py-3 px-5 text-slate-700">Normalized vertical coordinate of 21 landmark nodes.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">z0 .. z20</td>
                    <td className="py-3 px-5 font-mono text-orange-600">float32</td>
                    <td className="py-3 px-5 font-mono text-slate-500">Relative Depth</td>
                    <td className="py-3 px-5 text-slate-700">Relative depth from camera optical plane (Z-axis).</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">token</td>
                    <td className="py-3 px-5 font-mono text-orange-600">string</td>
                    <td className="py-3 px-5 font-mono text-slate-500">288 Tokens</td>
                    <td className="py-3 px-5 text-slate-700">Ground-truth canonical ISL gesture classification label.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── 4. STARTER CODE SNIPPETS (PYTHON & JAVASCRIPT) ───────────────── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-heading font-black text-slate-900 flex items-center gap-2.5">
                <Code2 className="w-6 h-6 text-orange-600" />
                <span>Quickstart Code Examples</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Zero-boilerplate loading scripts for Python Pandas, PyTorch tensors, and Node.js
              </p>
            </div>

            {/* Code Language Switcher */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 text-xs font-heading font-bold shadow-xs">
              <button
                onClick={() => setActiveCodeTab('pandas')}
                className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                  activeCodeTab === 'pandas' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Python (Pandas)
              </button>
              <button
                onClick={() => setActiveCodeTab('pytorch')}
                className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                  activeCodeTab === 'pytorch' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PyTorch / ML
              </button>
              <button
                onClick={() => setActiveCodeTab('node')}
                className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                  activeCodeTab === 'node' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Node.js / TS
              </button>
            </div>
          </div>

          <div className="relative bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 bg-slate-950/80 border-b border-slate-800">
              <span className="text-xs font-mono text-slate-400">
                {activeCodeTab === 'pandas' ? 'loader.py' : activeCodeTab === 'pytorch' ? 'train_isl_lstm.py' : 'loader.ts'}
              </span>
              <button
                onClick={() => copyToClipboard(codeSnippets[activeCodeTab], 'code-snippet')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedId === 'code-snippet' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-6 overflow-x-auto text-xs sm:text-sm font-mono text-slate-200 leading-relaxed">
              <code>{codeSnippets[activeCodeTab]}</code>
            </pre>
          </div>
        </section>

        {/* ─── 5. FULL 288-WORD VOCABULARY EXPLORER ─────────────────────────── */}
        <section id="vocabulary-catalog" className="scroll-mt-20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-heading font-black text-slate-900 flex items-center gap-2.5">
                <BookOpen className="w-6 h-6 text-orange-600" />
                <span>ISL Vocabulary Catalog ({filteredWords.length} Signs)</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Explore gesture definitions, accuracy rates, and Parquet recording filenames
              </p>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search signs, token, file..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-full text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 shadow-2xs"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold transition shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-md border-b border-slate-200 font-mono text-slate-700 uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-5 font-bold">Word / Gesture</th>
                    <th className="py-3 px-5 font-bold">Category</th>
                    <th className="py-3 px-5 font-bold">Hand Type</th>
                    <th className="py-3 px-5 font-bold">Training Samples</th>
                    <th className="py-3 px-5 font-bold">Accuracy</th>
                    <th className="py-3 px-5 font-bold">Parquet Recording File</th>
                    <th className="py-3 px-5 font-bold">Motion Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-body">
                  {filteredWords.slice(0, 100).map((w) => (
                    <tr key={w.token} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-5 font-bold text-slate-900 whitespace-nowrap">
                        <span className="block font-heading">{w.displayLabel}</span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{w.token}</span>
                      </td>
                      <td className="py-3 px-5 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-50 border border-orange-200 text-orange-700">
                          {w.category}
                        </span>
                      </td>
                      <td className="py-3 px-5 font-mono text-slate-600 text-xs whitespace-nowrap">
                        {w.handType}
                      </td>
                      <td className="py-3 px-5 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {w.sampleCount}
                      </td>
                      <td className="py-3 px-5 whitespace-nowrap font-mono font-bold text-emerald-600">
                        {w.accuracyRate}
                      </td>
                      <td className="py-3 px-5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {w.datasetFile}
                      </td>
                      <td className="py-3 px-5 text-slate-600 text-xs min-w-[260px]">
                        {w.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredWords.length > 100 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs font-mono text-slate-500">
                Showing first 100 of {filteredWords.length} matching signs. Use search or terminal clone for all 288 tokens.
              </div>
            )}
          </div>
        </section>

        {/* ─── 6. CITATION & RESEARCH LICENSE ───────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-heading font-black text-slate-900 flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-orange-600" />
              <span>Citation &amp; Research License</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              If you utilize the Sanket AI ISL Dataset in academic research or clinical papers, please cite:
            </p>
          </div>

          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-xl relative text-slate-200 font-mono text-xs leading-relaxed">
            <button
              onClick={() => copyToClipboard(bibtexCitation, 'bibtex')}
              className="absolute top-4 right-4 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              {copiedId === 'bibtex' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy BibTeX</span>
                </>
              )}
            </button>
            <pre className="overflow-x-auto pr-24">
              <code>{bibtexCitation}</code>
            </pre>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
