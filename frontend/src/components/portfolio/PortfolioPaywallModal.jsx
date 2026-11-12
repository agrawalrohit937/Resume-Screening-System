import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Crown as CrownIcon,
  Check,
  Sparkles,
  ArrowRight,
  Loader2,
  Lock,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { createCheckout, verifyPayment, reportPaymentFailure } from '../../services/api';

const loadRazorpaySDK = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PortfolioPaywallModal({
  isOpen,
  onClose,
  user,
  refreshUser,
  onPaymentSuccess = () => {},
}) {
  const [selectedPlan, setSelectedPlan] = useState('pro'); // 'pro' | 'premium'
  const [processing, setProcessing] = useState(false);

  if (!isOpen) return null;

  const triggerPaymentGateway = async (planName) => {
    setProcessing(true);
    const toastId = toast.loading(`Initializing secure checkout for ${planName.toUpperCase()}...`);

    try {
      let orderData = null;
      try {
        const checkoutRes = await createCheckout(planName.toLowerCase());
        orderData = checkoutRes.data;
      } catch (checkoutErr) {
        console.warn('Backend checkout order init fallback', checkoutErr);
      }

      await loadRazorpaySDK();
      if (window.Razorpay && orderData && orderData.razorpay_key_id) {
        const options = {
          key: orderData.razorpay_key_id,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'CareerShala',
          description: `Unlock ${planName === 'pro' ? 'Candidate Pro' : 'Job Seeker VIP'} (3 Months)`,
          order_id: orderData.id,
          prefill: {
            name: user?.full_name || '',
            email: user?.email || '',
            contact: user?.phone || '',
          },
          theme: {
            color: '#0f172a',
          },
          handler: async function (response) {
            try {
              await verifyPayment({
                plan: planName.toLowerCase(),
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              toast.success(`🎉 Congratulations! You have upgraded to ${planName === 'pro' ? 'Candidate Pro' : 'Job Seeker VIP'}!`, { id: toastId });
              if (refreshUser) await refreshUser();
              onPaymentSuccess();
              onClose();
            } catch (vErr) {
              toast.error('Payment verification failed. Please contact support.', { id: toastId });
            } finally {
              setProcessing(false);
            }
          },
          modal: {
            ondismiss: function () {
              setProcessing(false);
              toast.dismiss(toastId);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', async function (response) {
          console.warn('[Razorpay] Payment failed:', response.error);
          const errorDesc = response.error?.description || response.error?.reason || 'Payment failed during checkout.';
          toast.error(errorDesc, { id: toastId });
          setProcessing(false);

          try {
            await reportPaymentFailure({
              plan: planName.toLowerCase(),
              order_id: response.error?.metadata?.order_id || orderData.id,
              failure_reason: errorDesc,
              failure_code: response.error?.code || 'payment_failed',
            });
          } catch (reportErr) {
            console.error('[Razorpay] Failed to report payment failure to server:', reportErr);
          }
        });

        rzp.open();
        return;
      }

      throw new Error('Secure checkout is unavailable. Please try again later.');
    } catch (err) {
      console.error('Payment Gateway Error:', err);
      toast.error('Payment processing failed. Please try again.', { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="relative w-full max-w-3xl bg-slate-50 rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header matching Platform Premium page */}
        <div className="p-6 sm:p-8 pb-4 text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider mb-1">
            <Sparkles size={12} className="text-indigo-600" />
            Quarterly Super Saver (3 Months)
          </div>
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Affordable Plans for Candidates
          </h3>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            Get complete 3-month unrestricted access at deeply discounted student-friendly rates.
          </p>
        </div>

        {/* Exact Candidate Pro & VIP Cards from Platform Pricing */}
        <div className="p-6 sm:p-8 pt-2 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            
            {/* 1. CANDIDATE PRO (BEST VALUE) — Exact styling from Premium.jsx */}
            <div
              onClick={() => setSelectedPlan('pro')}
              className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all cursor-pointer ${
                selectedPlan === 'pro'
                  ? 'bg-slate-950 text-white border-2 border-amber-400 shadow-xl ring-2 ring-amber-400/30'
                  : 'bg-slate-900 text-white/90 border border-slate-800 opacity-85 hover:opacity-100'
              }`}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 px-4 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                Best Value
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Candidate Pro
                  </span>
                  <CrownIcon className="text-amber-400" size={18} />
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black tracking-tight text-white">₹199</span>
                  <span className="text-xs text-slate-400">/3 months</span>
                </div>

                <p className="text-xs mb-5 font-medium text-slate-400">
                  Full AI enhancement studio and interview coaching for active job hunters (Just ₹66/mo).
                </p>

                <hr className="my-4 border-t border-slate-800" />

                <ul className="space-y-2.5 mb-6">
                  {[
                    'Unlimited ATS scans & keyword targeting',
                    'Full AI Resume Enhancer Studio (Live WYSIWYG)',
                    '15 AI Mock Interview sessions with audio review',
                    'Hosted Web Portfolio (careershala.tech/p/you)',
                    'Priority fast server processing queue',
                    'Export ATS-approved PDF resumes',
                  ].map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs font-medium">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      <span className="text-slate-300">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`w-full py-2.5 px-4 rounded-xl text-center text-xs font-black tracking-wide ${
                selectedPlan === 'pro'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {selectedPlan === 'pro' ? '✓ Selected for Checkout' : 'Select Candidate Pro'}
              </div>
            </div>

            {/* 2. JOB SEEKER VIP — Exact styling from Premium.jsx */}
            <div
              onClick={() => setSelectedPlan('premium')}
              className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all cursor-pointer ${
                selectedPlan === 'premium'
                  ? 'bg-white text-slate-900 border-2 border-indigo-600 shadow-xl ring-2 ring-indigo-600/30'
                  : 'bg-white text-slate-900 border border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                    Job Seeker VIP
                  </span>
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black tracking-tight text-slate-900">₹399</span>
                  <span className="text-xs text-slate-500">/3 months</span>
                </div>

                <p className="text-xs mb-5 font-medium text-slate-500">
                  Complete unlimited career accelerator with 1-click apply and recruiter spotlight (Just ₹133/mo).
                </p>

                <hr className="my-4 border-t border-slate-100" />

                <ul className="space-y-2.5 mb-6">
                  {[
                    'Everything in Pro included',
                    'Unlimited AI Mock Interviews & live proctoring',
                    '1-Click AI Apply Assistant browser tool',
                    'Priority Recruiter Spotlight profile boost',
                    'Interactive WYSIWYG resume compilation',
                    'Direct AI Career Mentor copilot support',
                  ].map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs font-medium">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      <span className="text-slate-600">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`w-full py-2.5 px-4 rounded-xl text-center text-xs font-black tracking-wide ${
                selectedPlan === 'premium'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {selectedPlan === 'premium' ? '✓ Selected for Checkout' : 'Select Job Seeker VIP'}
              </div>
            </div>

          </div>

          {/* Action CTA */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              disabled={processing}
              onClick={() => triggerPaymentGateway(selectedPlan)}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 size={18} className="animate-spin text-slate-950" />
                  Connecting Secure Payment Gateway...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Get {selectedPlan === 'pro' ? 'Candidate Pro (₹199)' : 'Job Seeker VIP (₹399)'} &amp; Go Live
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
              <Lock size={12} className="text-emerald-600" />
              Secure 256-bit Razorpay Checkout • Instant 90-day access • No hidden fees
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
