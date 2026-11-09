import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import { 
  LayoutDashboard, 
  Package, 
  QrCode, 
  Flame, 
  Settings, 
  AlertTriangle, 
  TrendingDown, 
  Plus, 
  ShieldCheck,
  Calendar,
  LogOut,
  Store,
  Loader2
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState<string>('My Store');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'scan' | 'rescue' | 'settings'>('dashboard');

  // Check and listen to authentication status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchBusiness(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchBusiness(session.user.id);
      } else {
        setBusinessName('My Store');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch the registered store name
  const fetchBusiness = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('name')
        .eq('owner_id', userId)
        .maybeSingle();

      if (!error && data?.name) {
        setBusinessName(data.name);
      }
    } catch (err) {
      console.error('Error fetching business:', err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // 1. Loading screen while checking login status
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs text-slate-500 font-medium">Loading ExpiryAlert...</p>
      </div>
    );
  }

  // 2. Show Auth screen if user is not logged in
  if (!session) {
    return <Auth onSuccess={() => {}} />;
  }

  // 3. Main Application Dashboard once authenticated
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-6">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              EA
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <Store className="w-3.5 h-3.5 text-indigo-600" />
                <h1 className="text-sm font-bold text-slate-900 leading-tight">{businessName}</h1>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">ExpiryAlert Loss Prevention</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setActiveTab('scan')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-indigo-700 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Stock</span>
            </button>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Signature Metric: Money at Risk */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Total Stock Purchase Value at Risk
                </span>
                <span className="text-[11px] bg-amber-500/20 text-amber-300 font-medium px-2 py-0.5 rounded-full border border-amber-500/30">
                  Immediate Focus
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl md:text-4xl font-extrabold tracking-tight">₹0.00</span>
                <span className="text-xs text-slate-400">calculated at cost price</span>
              </div>
              <p className="mt-3 text-xs text-slate-300 border-t border-slate-800 pt-3">
                Unsold inventory nearing expiry. Rescuing stock early prevents total write-offs.
              </p>
            </div>

            {/* Quick Status Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-rose-600">
                  <span className="text-xs font-medium text-slate-500">Expiring ≤ 7 Days</span>
                  <Flame className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold text-slate-900">0</div>
                <p className="text-[11px] text-slate-400">Batches needing priority sale</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-amber-600">
                  <span className="text-xs font-medium text-slate-500">Expiring ≤ 30 Days</span>
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold text-slate-900">0</div>
                <p className="text-[11px] text-slate-400">Batches to monitor closely</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-medium text-slate-500">Already Expired</span>
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold text-rose-600">₹0.00</div>
                <p className="text-[11px] text-slate-400">Dead stock loss</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="text-xs font-medium text-slate-500">Stock Rescued</span>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold text-emerald-600">₹0.00</div>
                <p className="text-[11px] text-slate-400">Saved this month</p>
              </div>
            </div>

            {/* Empty State Banner */}
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">No items tracked yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Start by scanning a product barcode or manually adding your first batch with its expiry date.
              </p>
              <button 
                onClick={() => setActiveTab('scan')}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-indigo-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Product</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-2">
            <h2 className="text-lg font-bold text-slate-900">Product Inventory</h2>
            <p className="text-xs text-slate-500">Manage tracked grocery products and batches.</p>
          </div>
        )}

        {activeTab === 'scan' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-2">
            <h2 className="text-lg font-bold text-slate-900">Stock Entry & Barcode Scanner</h2>
            <p className="text-xs text-slate-500">Mobile camera barcode detection and batch expiry entry.</p>
          </div>
        )}

        {activeTab === 'rescue' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-2">
            <h2 className="text-lg font-bold text-slate-900">Stock Rescue Mode</h2>
            <p className="text-xs text-slate-500">Action plans for near-expiry items: discount, bundle, or return to supplier.</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Settings</h2>
            <div className="text-xs text-slate-500 space-y-1">
              <p>Logged in as: <strong className="text-slate-700">{session.user.email}</strong></p>
              <p>Store: <strong className="text-slate-700">{businessName}</strong></p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-100 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Shop</span>
            </button>
          </div>
        )}
      </main>

      {/* Mobile-First Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center py-1.5 ${
              activeTab === 'dashboard' ? 'text-indigo-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`flex flex-col items-center py-1.5 ${
              activeTab === 'products' ? 'text-indigo-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Package className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Products</span>
          </button>

          <button
            onClick={() => setActiveTab('scan')}
            className="flex flex-col items-center -mt-4 py-1"
          >
            <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg border-2 border-white active:scale-95 transition">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold text-indigo-600 mt-0.5">Scan</span>
          </button>

          <button
            onClick={() => setActiveTab('rescue')}
            className={`flex flex-col items-center py-1.5 ${
              activeTab === 'rescue' ? 'text-indigo-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Flame className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Rescue</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center py-1.5 ${
              activeTab === 'settings' ? 'text-indigo-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Settings className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}