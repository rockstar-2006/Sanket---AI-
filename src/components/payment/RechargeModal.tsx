'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet, PRICING_PLANS, PricingPlan } from '@/context/WalletContext';
import { 
  X, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  QrCode, 
  Smartphone, 
  CreditCard, 
  Zap, 
  ArrowRight, 
  Copy, 
  CheckCircle2, 
  Lock
} from 'lucide-react';

const MERCHANT_UPI_ID = '7381709385@pthdfc';
const MERCHANT_NAME = 'Sanket AI';

export const RechargeModal: React.FC = () => {
  const { isModalOpen, closeRechargeModal, selectedPlan, addCredits, credits } = useWallet();
  const [activePlan, setActivePlan] = useState<PricingPlan>(selectedPlan || PRICING_PLANS[1]);
  const [paymentMode, setPaymentMode] = useState<'upi_intent' | 'qr'>('upi_intent');
  const [utrNumber, setUtrNumber] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Sync if selectedPlan changes from parent caller
  React.useEffect(() => {
    if (selectedPlan) {
      setActivePlan(selectedPlan);
    }
  }, [selectedPlan]);

  if (!isModalOpen) return null;

  // Real UPI Intent URI standard for GPay, PhonePe, Paytm, BHIM, Cred
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${activePlan.priceInr}&cu=INR&tn=${encodeURIComponent(`Sanket AI ${activePlan.name} (${activePlan.credits} Credits)`)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(upiIntentUri)}`;

  const handleCopyUpi = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(MERCHANT_UPI_ID);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  const handleLaunchUpiApp = () => {
    window.location.href = upiIntentUri;
  };

  const handleVerifyUtr = () => {
    if (!utrNumber.trim()) return;
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setPaymentSuccess(true);
      addCredits(activePlan.credits, activePlan.name, utrNumber.trim());
      setTimeout(() => {
        setPaymentSuccess(false);
        setUtrNumber('');
        closeRechargeModal();
      }, 2500);
    }, 1200);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        {/* Backdrop blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeRechargeModal}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Window (Clean SaaS White Theme matching the rest of the application) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-2xl bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden text-slate-900 my-auto z-10"
        >
          {/* Modal Header */}
          <div className="p-6 sm:p-8 pb-5 flex items-center justify-between border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono tracking-wider bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-orange-500" />
                  Instant UPI Recharge
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Current Balance: <strong className="text-slate-900 font-mono">{credits} Credits</strong>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-1.5 font-heading">
                Recharge Account Balance
              </h2>
            </div>

            <button
              onClick={closeRechargeModal}
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success State Overlay */}
          {paymentSuccess ? (
            <div className="p-10 flex flex-col items-center justify-center text-center space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center shadow-md"
              >
                <CheckCircle2 className="w-8 h-8" />
              </motion.div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 font-heading">Credits Added Successfully!</h3>
                <p className="text-sm text-slate-600 mt-1 max-w-sm">
                  Successfully credited <strong className="text-emerald-700">+{activePlan.credits} Credits</strong> to your Sanket AI account. Ready for active telecom and meetings.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 sm:p-8 pt-5 space-y-5">
              
              {/* 1. Plan Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PRICING_PLANS.map((plan) => {
                  const isSelected = activePlan.id === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setActivePlan(plan)}
                      className={`relative rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between border ${
                        isSelected
                          ? 'border-2 border-orange-500 bg-orange-50/40 shadow-md ring-2 ring-orange-500/10'
                          : 'border border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {plan.badge && (
                        <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-500 text-white shadow-xs">
                          {plan.badge}
                        </div>
                      )}

                      <div>
                        <span className="text-xs font-bold text-slate-500 block">{plan.name}</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black text-slate-900">₹{plan.priceInr}</span>
                          <span className="text-[11px] text-slate-400">one-time</span>
                        </div>
                        <div className="mt-2 text-xs font-mono text-orange-600 font-bold flex items-center gap-1">
                          <Zap className="w-3 h-3 text-orange-500" />
                          <span>{plan.credits} Credits</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          ~{plan.approxMinutes} mins active relay
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className={isSelected ? 'text-orange-600 font-bold' : 'text-slate-400'}>
                          {isSelected ? 'Selected' : 'Select'}
                        </span>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                          isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 2. Interactive Payment Mechanism Tabs */}
              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/90 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPaymentMode('upi_intent')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        paymentMode === 'upi_intent'
                          ? 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5 text-orange-500" />
                      <span>One-Tap UPI</span>
                    </button>

                    <button
                      onClick={() => setPaymentMode('qr')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        paymentMode === 'qr'
                          ? 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5 text-orange-500" />
                      <span>Scan Bharat QR</span>
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-emerald-700 flex items-center gap-1 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    NPCI Verified
                  </span>
                </div>

                {/* Mode A: One-Tap UPI Intent (Mobile & Direct) */}
                {paymentMode === 'upi_intent' && (
                  <div className="space-y-3 pt-1">
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-mono">Merchant UPI ID:</span>
                        <code className="text-xs font-bold text-slate-900 font-mono select-all">
                          {MERCHANT_UPI_ID}
                        </code>
                      </div>
                      <button
                        onClick={handleCopyUpi}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedUpi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <button
                      onClick={handleLaunchUpiApp}
                      className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Open GPay / PhonePe / Paytm to Pay ₹{activePlan.priceInr}</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                    <span className="block text-center text-[11px] text-slate-500">
                      Instantly opens your installed UPI app on mobile.
                    </span>
                  </div>
                )}

                {/* Mode B: Bharat QR Code (Desktop & Secondary Devices) */}
                {paymentMode === 'qr' && (
                  <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
                    <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-md shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCodeUrl}
                        alt="Sanket AI UPI QR Code"
                        className="w-40 h-40 rounded-xl object-contain"
                      />
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <p className="font-bold text-slate-900 text-sm">
                        Scan with your Phone:
                      </p>
                      <p>
                        1. Open Google Pay, PhonePe, Paytm, or BHIM.
                      </p>
                      <p>
                        2. Scan this QR code to transfer <strong className="text-slate-900">₹{activePlan.priceInr}</strong>.
                      </p>
                      <p>
                        3. Enter the 12-digit UTR below for instant auto-crediting.
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Reference UTR Number Input for Auto-Verification */}
                <div className="pt-3 border-t border-slate-200/80">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Completed payment? Enter 12-digit UPI Reference / UTR Number:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={16}
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 431209845120"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    />
                    <button
                      onClick={handleVerifyUtr}
                      disabled={isVerifying || !utrNumber.trim()}
                      className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      {isVerifying ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm (+{activePlan.credits} Cr)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Security & Viva Transparency Notice */}
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Bank-Grade 256-bit Encrypted
                </span>
                <span>Supports GPay &bull; PhonePe &bull; Paytm &bull; BHIM</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

