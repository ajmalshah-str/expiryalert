import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Mail, Lock, Eye, EyeOff, ArrowRight, Store, Languages } from 'lucide-react';

export const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [lang, setLang] = useState<'en' | 'ml'>('en');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const t = {
    en: {
      badge: 'Stock Loss Prevention',
      title: isSignUp ? 'Register Your Store' : 'Welcome to ExpiryAlert',
      subtitle: isSignUp
        ? 'Protect your daily margins and stop inventory expiry loss.'
        : "Log in to monitor your shop's stock at risk.",
      shopLabel: 'Shop / Store Name',
      emailLabel: 'Email Address',
      passLabel: 'Password',
      signInBtn: 'Sign In to Dashboard',
      signUpBtn: 'Create Store Account',
      noAccount: "Don't have an account?",
      hasAccount: 'Already registered?',
      registerLink: 'Register your shop',
      loginLink: 'Sign in here',
    },
    ml: {
      badge: 'സ്റ്റോക്ക് നഷ്ടം തടയാം',
      title: isSignUp ? 'കട രജിസ്റ്റർ ചെയ്യുക' : 'ExpiryAlert-ലേക്ക് സ്വാഗതം',
      subtitle: isSignUp
        ? 'കാലഹരണപ്പെടുന്ന സാധനങ്ങൾ ട്രാക്ക് ചെയ്ത് നഷ്ടം പൂർണ്ണമായി ഒഴിവാക്കാം.'
        : 'ഷോപ്പിലെ സ്റ്റോക്ക് നിലവാരം പരിശോധിക്കാൻ ലോഗിൻ ചെയ്യുക.',
      shopLabel: 'കടയുടെ പേര്',
      emailLabel: 'ഇമെയിൽ വിലാസം',
      passLabel: 'പാസ്‌വേഡ്',
      signInBtn: 'ഡാഷ്‌ബോർഡിലേക്ക് പ്രവേശിക്കുക',
      signUpBtn: 'പുതിയ അക്കൗണ്ട് തുറക്കുക',
      noAccount: 'അക്കൗണ്ട് ഇല്ലേ?',
      hasAccount: 'ഇതിനകം രജിസ്റ്റർ ചെയ്തിട്ടുണ്ടോ?',
      registerLink: 'കട രജിസ്റ്റർ ചെയ്യുക',
      loginLink: 'ഇവിടെ ലോഗിൻ ചെയ്യുക',
    },
  }[lang];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { shop_name: shopName },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Language Switcher */}
      <div className="mb-6 flex items-center bg-slate-900 border border-slate-800 rounded-full p-1 shadow-md z-10">
        <Languages className="w-4 h-4 text-slate-400 ml-2 mr-1.5" />
        <button
          type="button"
          onClick={() => setLang('en')}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
            lang === 'en' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => setLang('ml')}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
            lang === 'ml' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          മലയാളം
        </button>
      </div>

      {/* Card Container */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="inline-block px-3 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
            {t.badge}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t.title}
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            {t.subtitle}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
            <span className="font-bold">Error:</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                {t.shopLabel}
              </label>
              <div className="relative">
                <Store className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. City Supermarket"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {t.emailLabel}
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="owner@store.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {t.passLabel}
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? t.signUpBtn : t.signInBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            {isSignUp ? t.hasAccount : t.noAccount}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline ml-1"
            >
              {isSignUp ? t.loginLink : t.registerLink}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;