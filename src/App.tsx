import { useEffect, useState, useMemo } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import AddProductModal from './components/AddProductModal';
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
  Loader2,
  ChevronRight
} from 'lucide-react';

interface BatchItem {
  id: string;
  batch_number: string;
  quantity: number;
  purchase_price: number;
  selling_price: number | null;
  expiry_date: string;
  products: {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    barcode: string | null;
  } | null;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>('My Store');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'scan' | 'rescue' | 'settings'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Auto-healing store fetcher: retrieves existing store or creates one automatically
  const fetchBusiness = async (userId: string) => {
    try {
      let { data } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('owner_id', userId)
        .maybeSingle();

      if (!data) {
        const { data: newBiz } = await supabase
          .from('businesses')
          .insert({
            owner_id: userId,
            name: 'My Grocery Store',
            currency: 'INR'
          })
          .select('id, name')
          .single();

        if (newBiz) {
          data = newBiz;
        }
      }

      if (data) {
        setBusinessId(data.id);
        setBusinessName(data.name);
        fetchInventory(data.id);
      }
    } catch (err) {
      console.error('Error fetching business:', err);
    }
  };

  const fetchInventory = async (bizId: string) => {
    setLoadingInventory(true);
    try {
      const { data, error } = await supabase
        .from('product_batches')
        .select(`
          id,
          batch_number,
          quantity,
          purchase_price,
          selling_price,
          expiry_date,
          products (
            id,
            name,
            brand,
            category,
            barcode
          )
        `)
        .eq('business_id', bizId)
        .gt('quantity', 0)
        .order('expiry_date', { ascending: true });

      if (!error && data) {
        setBatches(data as unknown as BatchItem[]);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoadingInventory(false);
    }
  };

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
        setBusinessId(null);
        setBusinessName('My Store');
        setBatches([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let moneyAtRisk = 0;
    let expiring7DaysCount = 0;
    let expiring30DaysCount = 0;
    let expiredLoss = 0;

    batches.forEach((batch) => {
      const exp = new Date(batch.expiry_date);
      exp.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const batchCost = batch.quantity * Number(batch.purchase_price);

      if (diffDays < 0) {
        expiredLoss += batchCost;
      } else if (diffDays <= 7) {
        expiring7DaysCount += 1;
        moneyAtRisk += batchCost;
      } else if (diffDays <= 30) {
        expiring30DaysCount += 1;
        moneyAtRisk += batchCost;
      }
    });

    return { moneyAtRisk, expiring7DaysCount, expiring30DaysCount, expiredLoss };
  }, [batches]);

  const getDaysRemaining = (expiryDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDateStr);
    exp.setHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs text-slate-500 font-medium">Loading ExpiryAlert...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth onSuccess={() => {}} />;
  }

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
              onClick={() => setIsModalOpen(true)}
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
                  Expiring in ≤ 30 Days
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl md:text-4xl font-extrabold tracking-tight">
                  ₹{metrics.moneyAtRisk.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-slate-400">cost value</span>
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
                <div className="text-2xl font-bold text-slate-900">{metrics.expiring7DaysCount}</div>
                <p className="text-[11px] text-slate-400">Immediate action needed</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-amber-600">
                  <span className="text-xs font-medium text-slate-500">Expiring ≤ 30 Days</span>
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{metrics.expiring30DaysCount}</div>
                <p className="text-[11px] text-slate-400">Monitor closely</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-medium text-slate-500">Already Expired</span>
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold text-rose-600">
                  ₹{metrics.expiredLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-slate-400">Dead stock write-off</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="text-xs font-medium text-slate-500">Stock Rescued</span>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold text-emerald-600">₹0.00</div>
                <p className="text-[11px] text-slate-400">Protected this month</p>
              </div>
            </div>

            {/* Tracked Batches List / Urgency Feed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Urgent Batches Needing Attention</h3>
                <span 
                  className="text-xs text-indigo-600 font-semibold cursor-pointer hover:underline" 
                  onClick={() => setActiveTab('products')}
                >
                  View All ({batches.length})
                </span>
              </div>

              {loadingInventory ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading shop batches...</p>
                </div>
              ) : batches.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                    <Package className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">No stock tracked yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Record your first grocery item or packaged batch to start monitoring expiration dates.
                  </p>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-indigo-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add First Batch</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {batches.slice(0, 5).map((batch) => {
                    const days = getDaysRemaining(batch.expiry_date);
                    let badgeClass = 'bg-slate-100 text-slate-700';
                    let statusLabel = `${days} days left`;

                    if (days < 0) {
                      badgeClass = 'bg-rose-100 text-rose-800 font-bold';
                      statusLabel = `Expired ${Math.abs(days)}d ago`;
                    } else if (days <= 7) {
                      badgeClass = 'bg-rose-50 text-rose-700 font-bold border border-rose-200';
                      statusLabel = `Expires in ${days}d!`;
                    } else if (days <= 30) {
                      badgeClass = 'bg-amber-50 text-amber-700 font-semibold border border-amber-200';
                      statusLabel = `${days} days left`;
                    }

                    return (
                      <div 
                        key={batch.id}
                        className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-slate-300 transition"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm text-slate-900">
                              {batch.products?.name || 'Unnamed Product'}
                            </span>
                            {batch.products?.brand && (
                              <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {batch.products.brand}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-slate-500">
                            <span>Qty: <strong className="text-slate-800">{batch.quantity}</strong></span>
                            <span>•</span>
                            <span>Cost: ₹{Number(batch.purchase_price).toFixed(2)}</span>
                            <span>•</span>
                            <span>Batch: #{batch.batch_number}</span>
                          </div>
                        </div>

                        <div className="text-right flex items-center space-x-2">
                          <div>
                            <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full ${badgeClass}`}>
                              {statusLabel}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Exp: {batch.expiry_date}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Inventory Batches</h2>
                <p className="text-xs text-slate-500">Track separate expiry dates and quantities per product.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stock</span>
              </button>
            </div>

            <div className="space-y-2">
              {batches.map((batch) => (
                <div key={batch.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">{batch.products?.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Batch #{batch.batch_number} • Qty: <strong>{batch.quantity}</strong> • Cost: ₹{batch.purchase_price} {batch.selling_price ? `• MRP: ₹${batch.selling_price}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-indigo-600">Exp: {batch.expiry_date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'scan' && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <QrCode className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Barcode Scanner Integration</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Scan grocery barcodes using your device camera to auto-fetch details from Open Food Facts.
              </p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
            >
              Enter Stock Manually Instead
            </button>
          </div>
        )}

        {activeTab === 'rescue' && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <Flame className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Stock Rescue Mode</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Items nearing expiration will appear here with recommended action plans (e.g. 20% discount sticker, bundle promotion, or return to vendor).
            </p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Shop Settings</h2>
            <div className="text-xs text-slate-600 space-y-2 border-b border-slate-100 pb-4">
              <div>Store Name: <strong className="text-slate-900">{businessName}</strong></div>
              <div>Account Email: <strong className="text-slate-900">{session.user.email}</strong></div>
              <div>Currency: <strong className="text-slate-900">INR (₹)</strong></div>
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

      {/* Stock Entry Modal */}
      <AddProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProductAdded={() => {
          if (businessId) fetchInventory(businessId);
        }}
        businessId={businessId}
      />

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
            onClick={() => setIsModalOpen(true)}
            className="flex flex-col items-center -mt-4 py-1"
          >
            <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg border-2 border-white active:scale-95 transition">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold text-indigo-600 mt-0.5">Add</span>
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