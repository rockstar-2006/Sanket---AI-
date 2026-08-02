'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import { createOrUpdateUserProfile } from '@/lib/firebase/services';
import { User, ShieldCheck, Mail, CheckCircle2, Lock } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
      return;
    }

    if (profile) {
      setDisplayName(profile.displayName || '');
    }
  }, [user, profile, loading, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      await createOrUpdateUserProfile({
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        photoURL: profile?.photoURL || null,
        role: profile?.role || 'patient',
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-grid-lines text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">User Account Profile</h1>
          <p className="text-slate-600 text-sm">Manage your account details & video meeting preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
          
          {/* Left Column: UNIQUE 3D Privacy Illustration */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white p-3">
              <div className="relative rounded-2xl overflow-hidden aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/img_device_privacy.jpg"
                  alt="On-Device Privacy Profile 3D Illustration"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>100% On-Device Privacy Guaranteed</span>
            </div>
          </div>

          {/* Right Column: Profile Form */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-lg p-8 space-y-6">
            
            <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
              <div className="w-16 h-16 rounded-full bg-orange-100 border-2 border-orange-200 flex items-center justify-center text-orange-600 text-2xl font-bold">
                {profile?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.photoURL} alt={profile.displayName || ''} className="w-full h-full rounded-full object-cover" />
                ) : (
                  (profile?.displayName || user.email || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">{profile?.displayName || 'User Profile'}</h2>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                  <Mail className="w-3.5 h-3.5" /> {user.email}
                </div>
              </div>
            </div>

            {saved && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Profile changes saved successfully.
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>

          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
}
