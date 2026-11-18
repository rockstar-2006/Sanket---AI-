'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  timestamp: number;
  txnId?: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  badge?: string;
  priceInr: number;
  credits: number;
  approxMinutes: number;
  features: string[];
  popular?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter Relay',
    priceInr: 29,
    credits: 150,
    approxMinutes: 15,
    features: [
      '150 Telecom Relay Credits (~15 mins)',
      'Sub-150ms Groq Whisper Speech-to-Text',
      'ElevenLabs Neural Voice Downlink',
      'Dual SIM Call Forwarding Bridge'
    ]
  },
  {
    id: 'pro',
    name: 'Pro Accessibility',
    badge: 'MOST POPULAR',
    popular: true,
    priceInr: 79,
    credits: 500,
    approxMinutes: 50,
    features: [
      '500 Telecom Relay Credits (~50 mins)',
      'Priority LPU Speech Transcription',
      'Natural AI Contextual Interpreter',
      'Full HD 3D Sign Avatar in Meetings',
      'Valid for 30 Days'
    ]
  },
  {
    id: 'unlimited',
    name: 'Student & Enterprise Pass',
    badge: 'BEST VALUE',
    priceInr: 149,
    credits: 1500,
    approxMinutes: 150,
    features: [
      '1,500 Telecom Relay Credits (~150 mins)',
      'Unlimited Video Meeting Access',
      'All AI Models (Gemini + Groq + Claude)',
      'Zero Queue Dedicated Telecom Port',
      'Full Project Viva / Demo Support'
    ]
  }
];

interface WalletContextType {
  credits: number;
  transactions: WalletTransaction[];
  loading: boolean;
  isModalOpen: boolean;
  selectedPlan: PricingPlan | null;
  openRechargeModal: (plan?: PricingPlan) => void;
  closeRechargeModal: () => void;
  deductCredits: (amount: number, reason: string) => boolean;
  addCredits: (amount: number, planName: string, txnId?: string) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const FREE_WELCOME_CREDITS = 100;

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number>(FREE_WELCOME_CREDITS);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);

  // Storage key is tied to user UID so each user has their own distinct credit balance
  const storageKey = user ? `sanket_wallet_${user.uid}` : 'sanket_wallet_guest';

  useEffect(() => {
    try {
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setCredits(typeof parsed.credits === 'number' ? parsed.credits : FREE_WELCOME_CREDITS);
        setTransactions(Array.isArray(parsed.transactions) ? parsed.transactions : []);
      } else {
        // Initialize new user with Starter Account Credits
        const initialTxn: WalletTransaction = {
          id: `welcome-${Date.now()}`,
          type: 'credit',
          amount: FREE_WELCOME_CREDITS,
          description: 'Starter Account Balance (100 Credits)',
          timestamp: Date.now()
        };
        setCredits(FREE_WELCOME_CREDITS);
        setTransactions([initialTxn]);
        localStorage.setItem(storageKey, JSON.stringify({
          credits: FREE_WELCOME_CREDITS,
          transactions: [initialTxn]
        }));
      }
    } catch {
      setCredits(FREE_WELCOME_CREDITS);
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  const saveWalletState = (newCredits: number, newTxns: WalletTransaction[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        credits: newCredits,
        transactions: newTxns
      }));
    } catch {}
  };

  const deductCredits = (amount: number, reason: string): boolean => {
    if (credits < amount) {
      setIsModalOpen(true);
      return false;
    }
    const updatedCredits = Math.max(0, credits - amount);
    const newTxn: WalletTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'debit',
      amount,
      description: reason,
      timestamp: Date.now()
    };
    const updatedTxns = [newTxn, ...transactions].slice(0, 30);
    setCredits(updatedCredits);
    setTransactions(updatedTxns);
    saveWalletState(updatedCredits, updatedTxns);
    return true;
  };

  const addCredits = (amount: number, planName: string, txnId?: string) => {
    const updatedCredits = credits + amount;
    const newTxn: WalletTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'credit',
      amount,
      description: `Recharge: ${planName} (UPI)`,
      timestamp: Date.now(),
      txnId
    };
    const updatedTxns = [newTxn, ...transactions].slice(0, 30);
    setCredits(updatedCredits);
    setTransactions(updatedTxns);
    saveWalletState(updatedCredits, updatedTxns);
  };

  const openRechargeModal = (plan?: PricingPlan) => {
    if (plan) setSelectedPlan(plan);
    else setSelectedPlan(PRICING_PLANS[1]); // default to Popular Pro
    setIsModalOpen(true);
  };

  const closeRechargeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <WalletContext.Provider
      value={{
        credits,
        transactions,
        loading,
        isModalOpen,
        selectedPlan,
        openRechargeModal,
        closeRechargeModal,
        deductCredits,
        addCredits
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
