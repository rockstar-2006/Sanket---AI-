'use client';

import React from 'react';
import LoginPage from '../login/page';

/**
 * Register Page
 * Seamlessly routes into the friendly Sanket AI mascot onboarding experience
 * No doctor / patient specialization - open and accessible to all users!
 */
export default function RegisterPage() {
  // Directly loads the Sanket Mascot experience so new users see the friendly character intro (Image 2/3)
  return <LoginPage initialPhase="intro" initialMood="new" />;
}
