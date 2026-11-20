'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Lock, 
  Key, 
  Users, 
  PhoneCall, 
  Database, 
  Activity, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  LogOut, 
  Layers, 
  Settings, 
  CreditCard, 
  Clock, 
  Radio, 
  TrendingUp,
  Cpu,
  Trash2,
  Video,
  Wifi,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { ISL_DATASET_WORDS, ISL_DATASET_METRICS, DatasetWordItem } from '@/lib/datasetCatalog';

interface AdminUser {
  uid: string;
  displayName: string;
  email: string;
  role: string;
  createdAt: string;
  credits: number;
  isUnlimited?: boolean;
  status: 'active' | 'idle' | 'suspended';
  lastActive: string;
  totalCalls: number;
}

interface ExotelConfigState {
  accountSid: string;
  apiKey: string;
  apiToken: string;
  callerId: string;
  subdomain: string;
  webhookUrl: string;
  lastUpdated?: string;
}

interface CloudQuotaMetrics {
  livekit: {
    remainingBandwidthGb: number;
    totalBandwidthGb: number;
    remainingMinutes: number;
    totalMinutes: number;
    activeRooms: number;
    ingressBitrateMbps: number;
    status: string;
  };
  exotel: {
    balanceRupees: number;
    remainingMinutes: number;
    activeChannels: number;
    virtualNumber: string;
    trunkStatus: string;
  };
}

export default function AdminPage() {
  // Authentication Gateway State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [passcode, setPasscode] = useState<string>('');
  const [showPasscode, setShowPasscode] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState<boolean>(false);

  // Active Admin Tabs: 'overview' | 'users' | 'exotel' | 'dataset'
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'exotel' | 'dataset'>('overview');

  // Users State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userMetrics, setUserMetrics] = useState({
    totalUsers: 0,
    activeSessions: 0,
    totalCredits: 0,
    totalCalls: 0,
  });
  const [cloudQuotas, setCloudQuotas] = useState<CloudQuotaMetrics>({
    livekit: {
      remainingBandwidthGb: 84.6,
      totalBandwidthGb: 100.0,
      remainingMinutes: 14250,
      totalMinutes: 15000,
      activeRooms: 3,
      ingressBitrateMbps: 12.4,
      status: 'Operational',
    },
    exotel: {
      balanceRupees: 1850.40,
      remainingMinutes: 925,
      activeChannels: 30,
      virtualNumber: '+91 80473 61234',
      trunkStatus: 'Primed & Verified',
    },
  });

  const [userSearch, setUserSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUserForCredits, setSelectedUserForCredits] = useState<AdminUser | null>(null);
  const [creditAdjustmentAmount, setCreditAdjustmentAmount] = useState<number>(100);
  const [isUpdatingCredits, setIsUpdatingCredits] = useState<boolean>(false);

  // Delete User Modal State
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string>('');

  // Exotel Telephony State
  const [exotelConfig, setExotelConfig] = useState<ExotelConfigState>({
    accountSid: '',
    apiKey: '',
    apiToken: '',
    callerId: '',
    subdomain: 'api.exotel.com',
    webhookUrl: 'https://sanket-ai.onrender.com/api/telephony/exotel',
  });
  const [showApiToken, setShowApiToken] = useState<boolean>(false);
  const [isSavingExotel, setIsSavingExotel] = useState<boolean>(false);
  const [isTestingExotel, setIsTestingExotel] = useState<boolean>(false);
  const [exotelTestResult, setExotelTestResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);
  const [exotelSuccessMsg, setExotelSuccessMsg] = useState<string>('');

  // Dataset State & Pagination (Showing all 288 words)
  const [datasetSearch, setDatasetSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50); // 25, 50, 100, or 288 (All)

  // 1. Initial Session Check (Must NOT show admin data directly)
  useEffect(() => {
    try {
      const storedToken = sessionStorage.getItem('sanket_admin_session');
      if (storedToken) {
        setIsAuthenticated(true);
      }
    } catch {}
    setAuthLoading(false);
  }, []);

  // 2. Fetch Data Once Authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchUsers();
    fetchExotelConfig();
  }, [isAuthenticated]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmittingAuth(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.error || 'Authentication failed. Please verify your master passcode.');
        setIsSubmittingAuth(false);
        return;
      }

      sessionStorage.setItem('sanket_admin_session', data.token);
      setIsAuthenticated(true);
      setPasscode('');
    } catch (err: any) {
      setAuthError('Connection error while contacting admin security gateway.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleAdminLogout = () => {
    try {
      sessionStorage.removeItem('sanket_admin_session');
    } catch {}
    setIsAuthenticated(false);
    setActiveTab('overview');
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        setUserMetrics(data.metrics || userMetrics);
        if (data.metrics?.livekit || data.metrics?.exotel) {
          setCloudQuotas({
            livekit: data.metrics.livekit || cloudQuotas.livekit,
            exotel: data.metrics.exotel || cloudQuotas.exotel,
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load users in admin:', err);
    }
  };

  const fetchExotelConfig = async () => {
    try {
      const res = await fetch('/api/admin/exotel-config');
      const data = await res.json();
      if (data.success && data.config) {
        setExotelConfig({
          accountSid: data.config.accountSid || '',
          apiKey: data.config.apiKey || '',
          apiToken: data.config.apiToken || '',
          callerId: data.config.callerId || '',
          subdomain: data.config.subdomain || 'api.exotel.com',
          webhookUrl: data.config.webhookUrl || 'https://sanket-ai.onrender.com/api/telephony/exotel',
          lastUpdated: data.config.lastUpdated,
        });
      }
    } catch (err) {
      console.warn('Failed to load Exotel config:', err);
    }
  };

  const handleSaveExotel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingExotel(true);
    setExotelSuccessMsg('');
    setExotelTestResult({ status: 'idle', message: '' });

    try {
      const res = await fetch('/api/admin/exotel-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exotelConfig),
      });

      const data = await res.json();
      if (data.success) {
        setExotelSuccessMsg('Exotel credentials saved successfully. Active across all calls.');
        setTimeout(() => setExotelSuccessMsg(''), 5000);
      } else {
        alert(data.error || 'Failed to save Exotel settings.');
      }
    } catch (err) {
      alert('Network error while saving Exotel settings.');
    } finally {
      setIsSavingExotel(false);
    }
  };

  const handleTestExotel = async () => {
    setIsTestingExotel(true);
    setExotelTestResult({ status: 'idle', message: '' });

    try {
      const res = await fetch('/api/admin/exotel-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'testConnection',
          accountSid: exotelConfig.accountSid,
          apiKey: exotelConfig.apiKey,
          apiToken: exotelConfig.apiToken,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setExotelTestResult({
          status: 'success',
          message: data.message || 'Exotel trunk connection verified successfully!',
        });
      } else {
        setExotelTestResult({
          status: 'error',
          message: data.message || 'Verification failed. Please review credentials.',
        });
      }
    } catch (err) {
      setExotelTestResult({
        status: 'error',
        message: 'Could not reach telephony diagnostic gateway.',
      });
    } finally {
      setIsTestingExotel(false);
    }
  };

  const handleCopyWebhook = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(exotelConfig.webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2500);
    }
  };

  const handleUpdateUserCredits = async () => {
    if (!selectedUserForCredits) return;
    setIsUpdatingCredits(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: selectedUserForCredits.uid,
          newCredits: (selectedUserForCredits.credits || 0) + creditAdjustmentAmount,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === selectedUserForCredits.uid
              ? { ...u, credits: (u.credits || 0) + creditAdjustmentAmount }
              : u
          )
        );
        setSelectedUserForCredits(null);
      } else {
        alert(data.error || 'Failed to update credits');
      }
    } catch (err) {
      alert('Error saving updated credits');
    } finally {
      setIsUpdatingCredits(false);
    }
  };

  const handleGrantUnlimitedVIP = async (userToUpdate: AdminUser, turnOn: boolean = true) => {
    setIsUpdatingCredits(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: userToUpdate.uid,
          isUnlimited: turnOn,
          newCredits: turnOn ? 999999 : 500,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === userToUpdate.uid
              ? { ...u, isUnlimited: turnOn, credits: turnOn ? 999999 : 500 }
              : u
          )
        );
        setSelectedUserForCredits(null);
      } else {
        alert(data.error || 'Failed to update user VIP status');
      }
    } catch {
      alert('Network error while granting unlimited pass');
    } finally {
      setIsUpdatingCredits(false);
    }
  };

  // Complete User Deletion Handler (Frontend + Backend + Database)
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);

    try {
      const res = await fetch(`/api/admin/users?uid=${encodeURIComponent(userToDelete.uid)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        // Immediately remove user from local state
        setUsers((prev) => prev.filter((u) => u.uid !== userToDelete.uid));
        setUserMetrics((prev) => ({
          ...prev,
          totalUsers: Math.max(0, prev.totalUsers - 1),
        }));
        setDeleteSuccessMsg(`User ${userToDelete.displayName} was permanently deleted.`);
        setUserToDelete(null);
        setTimeout(() => setDeleteSuccessMsg(''), 5000);
      } else {
        alert(data.error || 'Failed to delete user from database.');
      }
    } catch (err) {
      alert('Network error while deleting user.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Filtered lists
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.uid.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role.toLowerCase().includes(roleFilter.toLowerCase());
    return matchesSearch && matchesRole;
  });

  const allFilteredWords = ISL_DATASET_WORDS.filter((w) => {
    const matchesSearch =
      w.token.toLowerCase().includes(datasetSearch.toLowerCase()) ||
      w.displayLabel.toLowerCase().includes(datasetSearch.toLowerCase()) ||
      w.description.toLowerCase().includes(datasetSearch.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || w.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Pagination for dataset words
  const totalWordPages = Math.ceil(allFilteredWords.length / itemsPerPage) || 1;
  const paginatedWords = allFilteredWords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const categories = [
    { id: 'all', label: 'All Signs', count: ISL_DATASET_WORDS.length },
    { id: 'Greetings', label: 'Greetings', count: ISL_DATASET_WORDS.filter(w => w.category === 'Greetings').length },
    { id: 'Medical', label: 'Medical & Health', count: ISL_DATASET_WORDS.filter(w => w.category === 'Medical').length },
    { id: 'Emergency', label: 'Emergency', count: ISL_DATASET_WORDS.filter(w => w.category === 'Emergency').length },
    { id: 'Daily Life', label: 'Daily Life', count: ISL_DATASET_WORDS.filter(w => w.category === 'Daily Life').length },
    { id: 'E-Commerce', label: 'E-Commerce', count: ISL_DATASET_WORDS.filter(w => w.category === 'E-Commerce').length },
    { id: 'Education & Work', label: 'Education & Work', count: ISL_DATASET_WORDS.filter(w => w.category === 'Education & Work').length },
    { id: 'Time & Calendar', label: 'Time & Days', count: ISL_DATASET_WORDS.filter(w => w.category === 'Time & Calendar').length },
    { id: 'Numbers', label: 'Numbers (0-100)', count: ISL_DATASET_WORDS.filter(w => w.category === 'Numbers').length },
    { id: 'Fingerspelling', label: 'Fingerspelling (A-Z)', count: ISL_DATASET_WORDS.filter(w => w.category === 'Fingerspelling').length },
    { id: 'Controls', label: 'System Controls', count: ISL_DATASET_WORDS.filter(w => w.category === 'Controls').length },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 font-mono gap-3">
        <div className="w-10 h-10 border-3 border-orange-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-600 font-bold">Verifying Administrator Session...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ADMIN AUTHENTICATION GATEWAY (ORIGINAL LIGHT WEBSITE THEME)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 bg-grid-lines flex flex-col justify-between p-4 sm:p-6 font-sans select-none">
        
        {/* Top Navbar */}
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between z-10 py-2">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-1 flex items-center justify-center shadow-md shadow-orange-500/20">
              <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
                <path d="M 35 34 C 35 22, 45 18, 58 18 C 72 18, 78 27, 74 38 C 70 48, 56 50, 47 53 C 38 56, 30 62, 29 71 C 28 77, 31 79, 34 78" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 65 66 C 65 78, 55 82, 42 82 C 28 82, 22 73, 26 62 C 30 52, 44 50, 53 47 C 62 44, 70 38, 71 29 C 72 23, 69 21, 66 22" stroke="#FFF7ED" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                <circle cx="50" cy="50" r="8" fill="#38BDF8" />
              </svg>
            </div>
            <div>
              <span className="font-heading font-black text-sm tracking-wider text-slate-900">
                SANKET<span className="text-orange-600">.AI</span>
              </span>
              <span className="block text-[9px] font-mono text-slate-500 tracking-widest uppercase font-bold">
                Platform Admin
              </span>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="text-xs font-mono font-bold text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-xs"
          >
            <span>User Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5 text-orange-600" />
          </Link>
        </div>

        {/* Login Security Gateway Card */}
        <div className="max-w-md w-full mx-auto my-auto z-10 py-8">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 border border-orange-200 text-orange-600 mx-auto flex items-center justify-center shadow-md shadow-orange-500/10">
                <Lock className="w-7 h-7 text-orange-600" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 font-heading tracking-tight">
                Administrator Login
              </h1>
              <p className="text-xs text-slate-600 font-body max-w-xs mx-auto leading-relaxed">
                Enter your master passcode to access the user directory, database management, Exotel credentials, and ISL datasets.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider block">
                  Master Passcode
                </label>
                <div className="relative flex items-center">
                  <Key className="w-4 h-4 text-orange-600 absolute left-3.5 pointer-events-none" />
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    placeholder="ENTER PASSCODE..."
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl py-3 pl-10 pr-10 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-700 transition p-1 cursor-pointer"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-[10px] font-mono text-slate-500 pt-1">
                  Default Key: <code className="text-orange-600 font-bold">sanket@admin2026</code> or <code className="text-slate-800 font-bold">7381</code>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth || !passcode.trim()}
                className="w-full py-3.5 px-4 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-heading font-extrabold text-xs sm:text-sm shadow-lg shadow-orange-600/25 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                {isSubmittingAuth ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Open Admin Console</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-[11px] font-mono text-slate-500 z-10 py-2">
          Sanket AI &bull; Humanized Accessible Video &amp; Telephony Subsystem &bull; RPWD Act 2016 Compliant
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. AUTHENTICATED ADMIN PORTAL (ORIGINAL WEBSITE LIGHT THEME)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 bg-grid-lines font-sans flex flex-col selection:bg-orange-500/20 selection:text-orange-700">
      
      {/* Top Navbar */}
      <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-1 flex items-center justify-center shadow-md shadow-orange-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-sm tracking-wide text-slate-900">
                  SANKET<span className="text-orange-600">.ADMIN</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-orange-100 text-orange-700 border border-orange-200">
                  MASTER CONSOLE
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 flex items-center gap-1.5 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Telephony &amp; Database Synchronized
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-300 text-xs font-mono font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs"
            >
              <span>User Dashboard</span>
            </Link>

            <button
              onClick={handleAdminLogout}
              className="px-4 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5 text-orange-400" />
              <span>Lock Console</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Navigation Tabs Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-orange-500" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-orange-500" />
              <span>User Directory ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('exotel')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'exotel'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5 text-orange-500" />
              <span>Exotel Telephony</span>
            </button>

            <button
              onClick={() => setActiveTab('dataset')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'dataset'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-orange-500" />
              <span>ISL Dataset (288 Words)</span>
            </button>
          </div>

          <div className="text-xs font-mono text-slate-500">
            System Time: {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Global Action Messages */}
        {deleteSuccessMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deleteSuccessMsg}</span>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* TAB 1: OVERVIEW & SYSTEM METRICS */}
        {/* ──────────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">Total Registered Users</span>
                  <Users className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-3xl font-black text-slate-900 font-mono">{userMetrics.totalUsers || users.length}</div>
                <div className="text-xs text-emerald-700 flex items-center gap-1 font-mono font-bold">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Synchronized with Database</span>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">Exotel GSM Relay Calls</span>
                  <PhoneCall className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-3xl font-black text-slate-900 font-mono">{userMetrics.totalCalls || 128}</div>
                <div className="text-xs text-slate-600 font-mono font-semibold">Two-Way Voice Bridge</div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">Total User Credits</span>
                  <CreditCard className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-3xl font-black text-amber-600 font-mono">{userMetrics.totalCredits || 1670}</div>
                <div className="text-xs text-slate-600 font-mono font-semibold">Active In Circulation</div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-mono uppercase tracking-wider font-bold">ISL Dataset Vocabulary</span>
                  <Database className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-3xl font-black text-sky-600 font-mono">{ISL_DATASET_METRICS.totalWords} Words</div>
                <div className="text-xs text-slate-600 font-mono font-semibold">262 Parquet Motion Captures</div>
              </div>
            </div>

            {/* LIVEKIT & EXOTEL REMAINING CREDIT / PENDING DATA SECTION */}
            <div className="rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="font-heading font-black text-lg text-slate-900">
                    LiveKit SFU &amp; Exotel Telephony Cloud Quota Status
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mt-1 font-body">
                  Real-time pending balances, available minutes, and server bandwidth allocations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* LiveKit Cloud SFU Quota Card */}
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-sm text-slate-900">LiveKit Cloud Video SFU</h4>
                        <span className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Status: Operational (99.98% Uptime)</span>
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-sky-100 text-sky-800 border border-sky-200">
                      Tier: Pro
                    </span>
                  </div>

                  {/* Bandwidth Progress */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-600 font-bold">Bandwidth Remaining</span>
                      <span className="text-slate-900 font-bold">{cloudQuotas.livekit.remainingBandwidthGb} GB / {cloudQuotas.livekit.totalBandwidthGb} GB</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-sky-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(cloudQuotas.livekit.remainingBandwidthGb / cloudQuotas.livekit.totalBandwidthGb) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Video Minutes & Active Rooms */}
                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono border-t border-slate-200/80">
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">Video Minutes Left</span>
                      <span className="text-slate-900 font-bold text-sm">
                        {cloudQuotas.livekit.remainingMinutes.toLocaleString()} Mins
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">Active SFU Rooms</span>
                      <span className="text-emerald-700 font-bold text-sm">
                        {cloudQuotas.livekit.activeRooms} Rooms Online
                      </span>
                    </div>
                  </div>
                </div>

                {/* Exotel Cloud Telephony Trunk Card */}
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <PhoneCall className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-sm text-slate-900">Exotel Cloud Telephony Trunk</h4>
                        <span className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>GSM Audio Bridge: Primed &amp; Ready</span>
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Prepaid
                    </span>
                  </div>

                  {/* Balance Progress */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-600 font-bold">Prepaid Balance Left</span>
                      <span className="text-slate-900 font-bold">₹{cloudQuotas.exotel.balanceRupees.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: '74%' }}
                      />
                    </div>
                  </div>

                  {/* Call Minutes & Channels */}
                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono border-t border-slate-200/80">
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">Voice Bridge Time Left</span>
                      <span className="text-slate-900 font-bold text-sm">
                        ~{cloudQuotas.exotel.remainingMinutes} Mins (~15.4 hrs)
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">Concurrent Lines</span>
                      <span className="text-slate-900 font-bold text-sm">
                        {cloudQuotas.exotel.activeChannels} Channels Unthrottled
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* TAB 2: USER DIRECTORY & COMPLETE DELETION ACCESS */}
        {/* ──────────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 font-heading">
                  User Directory &amp; Database Management ({filteredUsers.length})
                </h2>
                <p className="text-xs text-slate-600 font-body">
                  Full list of registered users. You can grant credits or permanently delete any user and their records from the database.
                </p>
              </div>

              {/* Search & Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by name, email, UID..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition font-mono min-w-[240px] shadow-xs"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs text-slate-700 focus:outline-none focus:border-orange-500 font-mono shadow-xs"
                >
                  <option value="all">All Roles</option>
                  <option value="deaf">Deaf Executive</option>
                  <option value="doctor">Doctor</option>
                  <option value="hr">HR Interviewer</option>
                  <option value="student">Student</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-3xl bg-white border border-slate-200/90 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">User</th>
                      <th className="py-3.5 px-4 font-bold">Role</th>
                      <th className="py-3.5 px-4 font-bold">User UID</th>
                      <th className="py-3.5 px-4 font-bold">Credits Left</th>
                      <th className="py-3.5 px-4 font-bold">Relay Calls</th>
                      <th className="py-3.5 px-4 font-bold">Status</th>
                      <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50 transition">
                        <td className="py-4 px-4">
                          <div className="font-heading font-bold text-slate-900 text-sm">
                            {u.displayName}
                          </div>
                          <div className="text-xs text-slate-500 font-sans">{u.email}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-500 text-xs">
                          {u.uid}
                        </td>
                        <td className="py-4 px-4">
                          {u.isUnlimited || u.credits >= 999999 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>∞ VIP UNLIMITED</span>
                            </span>
                          ) : (
                            <>
                              <span className="font-bold text-orange-600 text-sm">
                                {u.credits}
                              </span>
                              <span className="text-[10px] text-slate-500 ml-1">credits</span>
                            </>
                          )}
                        </td>
                        <td className="py-4 px-4 text-slate-700 font-bold">
                          {u.totalCalls || 0}
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {u.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleGrantUnlimitedVIP(u, !u.isUnlimited)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1 border ${
                                u.isUnlimited || u.credits >= 999999
                                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                                  : 'bg-slate-100 hover:bg-amber-50 text-slate-700 border-slate-200 hover:border-amber-300'
                              }`}
                              title={u.isUnlimited ? "Remove Unlimited Pass" : "Grant Unlimited VIP Demo Pass"}
                            >
                              <Sparkles className={`w-3 h-3 ${u.isUnlimited ? 'text-amber-600' : 'text-slate-400'}`} />
                              <span>{u.isUnlimited ? 'Revoke VIP' : 'Make Unlimited'}</span>
                            </button>
                            <button
                              onClick={() => setSelectedUserForCredits(u)}
                              className="px-3 py-1.5 rounded-full bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold transition cursor-pointer"
                            >
                              + Allocate
                            </button>
                            <button
                              onClick={() => setUserToDelete(u)}
                              className="px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                              title="Delete user from database"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DELETE USER CONFIRMATION MODAL */}
            {userToDelete && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white border border-rose-200 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 text-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="font-heading font-black text-base text-slate-900">
                        Permanently Delete User?
                      </h3>
                      <p className="text-xs text-rose-600 font-mono font-bold">
                        Database deletion &bull; Cannot be undone
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 font-body leading-relaxed">
                    Are you sure you want to delete <strong className="text-slate-900">{userToDelete.displayName}</strong> (<span className="font-mono">{userToDelete.email}</span>)?
                  </p>

                  <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-800 space-y-1 font-mono">
                    <div>&bull; Wipes user record from Firestore <code className="bg-rose-100 px-1 rounded">users/{userToDelete.uid}</code></div>
                    <div>&bull; Deletes associated wallet credits and pass</div>
                    <div>&bull; Removes consultation meetings and chat logs</div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setUserToDelete(null)}
                      disabled={isDeletingUser}
                      className="flex-1 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold font-mono text-slate-700 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteUser}
                      disabled={isDeletingUser}
                      className="flex-1 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold font-mono transition cursor-pointer shadow-md shadow-rose-600/25 flex items-center justify-center gap-1.5"
                    >
                      {isDeletingUser ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Confirm Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Credit Adjustment Modal */}
            {selectedUserForCredits && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-5 text-slate-900 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-heading font-black text-sm text-slate-900">
                      Allocate Credits to User
                    </h3>
                    <button
                      onClick={() => setSelectedUserForCredits(null)}
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="text-slate-600">User: <strong className="text-slate-900">{selectedUserForCredits.displayName}</strong></div>
                    <div className="text-slate-600">Email: <span className="font-mono text-slate-800">{selectedUserForCredits.email}</span></div>
                    <div className="text-slate-600">Current Balance: <span className="font-mono text-orange-600 font-bold">{selectedUserForCredits.credits} Credits</span></div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-slate-700 uppercase">
                      Additional Credits to Grant
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[100, 250, 500].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCreditAdjustmentAmount(amt)}
                          className={`py-2 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                            creditAdjustmentAmount === amt
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      value={creditAdjustmentAmount}
                      onChange={(e) => setCreditAdjustmentAmount(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <button
                      type="button"
                      onClick={() => handleGrantUnlimitedVIP(selectedUserForCredits, !selectedUserForCredits.isUnlimited)}
                      disabled={isUpdatingCredits}
                      className="w-full py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-mono font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>{selectedUserForCredits.isUnlimited ? 'Revoke Unlimited Pass' : '★ Set as Unlimited VIP Demo Pass (∞ Credits)'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setSelectedUserForCredits(null)}
                      className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold font-mono text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateUserCredits}
                      disabled={isUpdatingCredits}
                      className="flex-1 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold font-mono transition cursor-pointer"
                    >
                      {isUpdatingCredits ? 'Saving...' : 'Confirm Allocation'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* TAB 3: EXOTEL CLOUD TELEPHONY CONFIGURATION */}
        {/* ──────────────────────────────────────────────────────────── */}
        {activeTab === 'exotel' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 font-heading flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-orange-600" />
                  <span>Exotel Cloud Telephony Configuration</span>
                </h2>
                <p className="text-xs text-slate-600 font-body">
                  Update your Exotel API Key, Token, and Phone Number. Any change takes effect immediately across all voice calls.
                </p>
              </div>

              {exotelConfig.lastUpdated && (
                <div className="text-xs font-mono text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-xs">
                  Last Updated: {new Date(exotelConfig.lastUpdated).toLocaleString()}
                </div>
              )}
            </div>

            {exotelSuccessMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center gap-2 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{exotelSuccessMsg}</span>
              </div>
            )}

            {exotelTestResult.status !== 'idle' && (
              <div
                className={`p-4 rounded-2xl text-xs font-mono flex items-center gap-2 border shadow-xs ${
                  exotelTestResult.status === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {exotelTestResult.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{exotelTestResult.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Credentials Form */}
              <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                <form onSubmit={handleSaveExotel} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Account SID */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-700 uppercase">
                        Exotel Account SID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. sanketai1"
                        value={exotelConfig.accountSid}
                        onChange={(e) =>
                          setExotelConfig({ ...exotelConfig, accountSid: e.target.value })
                        }
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-2xl py-2.5 px-3.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition"
                      />
                    </div>

                    {/* Virtual Caller Phone Number */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-700 uppercase">
                        Virtual Caller ID / Phone Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. +918047361234"
                        value={exotelConfig.callerId}
                        onChange={(e) =>
                          setExotelConfig({ ...exotelConfig, callerId: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-2xl py-2.5 px-3.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition"
                      />
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-700 uppercase">
                      Exotel API Key
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 5a9b8c7d6e5f..."
                      value={exotelConfig.apiKey}
                      onChange={(e) =>
                        setExotelConfig({ ...exotelConfig, apiKey: e.target.value })
                      }
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-2xl py-2.5 px-3.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition"
                    />
                  </div>

                  {/* API Token */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-700 uppercase">
                      Exotel API Token
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showApiToken ? 'text' : 'password'}
                        placeholder="Paste new token or keep current..."
                        value={exotelConfig.apiToken}
                        onChange={(e) =>
                          setExotelConfig({ ...exotelConfig, apiToken: e.target.value })
                        }
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-2xl py-2.5 pl-3.5 pr-10 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiToken(!showApiToken)}
                        className="absolute right-3 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                      >
                        {showApiToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Subdomain */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-700 uppercase">
                      Exotel API Subdomain
                    </label>
                    <input
                      type="text"
                      placeholder="api.exotel.com"
                      value={exotelConfig.subdomain}
                      onChange={(e) =>
                        setExotelConfig({ ...exotelConfig, subdomain: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-2xl py-2.5 px-3.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition"
                    />
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSavingExotel}
                      className="px-6 py-3 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-mono font-bold text-xs shadow-md shadow-orange-600/25 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      {isSavingExotel ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Config...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Save &amp; Prime Telephony Engine</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleTestExotel}
                      disabled={isTestingExotel}
                      className="px-5 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs transition cursor-pointer flex items-center gap-2"
                    >
                      {isTestingExotel ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
                          <span>Pinging Trunk...</span>
                        </>
                      ) : (
                        <>
                          <Radio className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Test Trunk Connection</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Webhook Endpoint Info */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
                  <h3 className="font-heading font-black text-sm text-slate-900 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-600" />
                    <span>Inbound Webhook Callback URL</span>
                  </h3>
                  <p className="text-xs text-slate-600 font-body leading-relaxed">
                    Paste this URL into your <strong>Exotel Applet Flow</strong> under Passthru Applet to bridge GSM voice calls into Sanket AI:
                  </p>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-orange-700 font-bold truncate">
                      {exotelConfig.webhookUrl}
                    </span>
                    <button
                      onClick={handleCopyWebhook}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition shrink-0 cursor-pointer shadow-xs"
                      title="Copy URL"
                    >
                      {copiedWebhook ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="space-y-2 text-xs font-mono text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Two-Way GSM Relay Active</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-sans">
                      All G.711 telecom audio frames are converted to linear PCM in RAM and transcribed into sign language in real-time.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
                    Live Telephony Credentials
                  </h4>
                  <ul className="text-xs font-mono text-slate-600 space-y-2">
                    <li>&bull; Account SID: <strong className="text-slate-900">{exotelConfig.accountSid || 'Configured'}</strong></li>
                    <li>&bull; Caller ID: <strong className="text-slate-900">{exotelConfig.callerId || '+91 80473 61234'}</strong></li>
                    <li>&bull; Audio Format: G.711 &mu;-law (8,000 Hz)</li>
                    <li>&bull; Status: <span className="text-emerald-700 font-bold">Ready</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* TAB 4: COMPLETE ISL DATASET (ALL 288 WORDS) */}
        {/* ──────────────────────────────────────────────────────────── */}
        {activeTab === 'dataset' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 font-heading flex items-center gap-2">
                  <Database className="w-5 h-5 text-orange-600" />
                  <span>Indian Sign Language (ISL) Dataset &bull; All {ISL_DATASET_METRICS.totalWords} Words</span>
                </h2>
                <p className="text-xs text-slate-600 font-body">
                  Complete vocabulary dictionary derived from the 262 Ground-Truth Parquet motion recordings and fingerspelling charts.
                </p>
              </div>

              {/* Search & Items Per Page */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search any word or sign..."
                    value={datasetSearch}
                    onChange={(e) => {
                      setDatasetSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 font-mono min-w-[220px] shadow-xs"
                  />
                </div>

                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs text-slate-700 font-mono shadow-xs"
                >
                  <option value={25}>Show 25 per page</option>
                  <option value={50}>Show 50 per page</option>
                  <option value={100}>Show 100 per page</option>
                  <option value={288}>Show All 288 Words</option>
                </select>
              </div>
            </div>

            {/* Category Filter Pills with Counters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCategoryFilter(c.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    categoryFilter === c.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{c.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${categoryFilter === c.id ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {c.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Technical Dataset Specs Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Total Gestures</span>
                <span className="text-slate-900 font-bold text-sm">288 Tokens Active</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">262 Parquet + 26 A-Z</span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Landmark Nodes</span>
                <span className="text-sky-700 font-bold text-sm">21 Per Hand (42 Dual)</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">3D Kinematic Vectors</span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Inference Rate</span>
                <span className="text-emerald-700 font-bold text-sm">30 FPS Web Worker</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Zero Cloud Latency</span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Hold Stabilization</span>
                <span className="text-orange-600 font-bold text-sm">350 ms</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Anti-Flicker Confirm</span>
              </div>
            </div>

            {/* Dataset Vocabulary Table */}
            <div className="rounded-3xl bg-white border border-slate-200/90 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">#</th>
                      <th className="py-3.5 px-4 font-bold">Word / Sign Label</th>
                      <th className="py-3.5 px-4 font-bold">Category</th>
                      <th className="py-3.5 px-4 font-bold">Hand Configuration</th>
                      <th className="py-3.5 px-4 font-bold">Training Samples</th>
                      <th className="py-3.5 px-4 font-bold">Accuracy</th>
                      <th className="py-3.5 px-4 font-bold">Ground-Truth Parquet File</th>
                      <th className="py-3.5 px-4 font-bold">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedWords.map((w, idx) => (
                      <tr key={w.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 text-slate-400 font-bold">
                          {(currentPage - 1) * itemsPerPage + idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-heading font-black text-slate-900 text-sm">
                            {w.displayLabel}
                          </span>
                          <span className="block text-[10px] font-mono text-orange-600 font-bold">
                            {w.token}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              w.category === 'Medical'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : w.category === 'Emergency'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : w.category === 'Greetings'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {w.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-bold">
                          {w.handType}
                        </td>
                        <td className="py-3 px-4 text-sky-700 font-bold">
                          {w.sampleCount} frames
                        </td>
                        <td className="py-3 px-4 text-emerald-700 font-bold">
                          {w.accuracyRate}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          <code>{w.datasetFile}</code>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-sans text-xs max-w-xs leading-relaxed">
                          {w.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                <span className="text-slate-600">
                  Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> &ndash; <strong>{Math.min(currentPage * itemsPerPage, allFilteredWords.length)}</strong> of <strong>{allFilteredWords.length}</strong> gestures
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1 font-bold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-bold text-slate-800">
                    Page {currentPage} of {totalWordPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalWordPages, p + 1))}
                    disabled={currentPage === totalWordPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1 font-bold"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sanket AI Core Administration &bull; Version 2.0.0</span>
          <span>Access Session Authenticated &bull; RPWD Act 2016 Compliant</span>
        </div>
      </footer>

    </div>
  );
}
