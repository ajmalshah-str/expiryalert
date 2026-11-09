import { useEffect, useState, useMemo } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import AddProductModal from './components/AddProductModal';
import StockRescue from './components/StockRescue';
import WhatsAppDigestModal from './components/WhatsAppDigestModal';
import AuditReport from './components/AuditReport';
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
  ChevronRight, 
  MessageCircle, 
  CheckCircle2,
  Minus,
  ShoppingCart,
  X,
  ArrowRight,
  Search
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
  const [productFilter, setProductFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDigestOpen, setIsDigestOpen] = useState(false);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [totalRescuedValue, setTotalRescuedValue] = useState<number>(0);

  // Quick Sale / Deduct Modal State
  const [sellingBatch, setSellingBatch] = useState<BatchItem | null>(null);
  const [sellQty, setSellQty] = useState<number>(1);
  const [submittingSale, setSubmittingSale] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Auto-healing store fetcher
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

  // Fetch all batches and total rescued value
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
        .order('expiry_date', { ascending: true });

      if (!error && data) {
        setBatches(data as unknown as BatchItem[]);
      }

      const { data: movements } = await supabase
        .from('stock_movements')
        .select('quantity_change, notes')
        .eq('business_id', bizId)
        .eq('movement_type', 'sale_fefo');

      if (movements) {
        let rescuedSum = 0;
        movements.forEach((m) => {
          const match = m.notes?.match(/₹(\d+(\.\d+)?)/);
          const unitPrice = match ? parseFloat(match[1]) : 0;
          const qty = Math.abs(m.quantity_change || 0);
          rescuedSum += qty * unitPrice;
        });
        setTotalRescuedValue(rescuedSum);
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
        setTotalRescuedValue(0);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Batches currently in stock
  const activeBatches = useMemo(() => {
    return batches.filter((b) => b.quantity > 0);
  }, [batches]);

  // Filtered and searched inventory list for Products tab
  const displayedBatches = useMemo(() => {
    let list = batches;

    if (productFilter === 'active') {
      list = batches.filter((b) => b.quantity > 0);
    } else if (productFilter === 'resolved') {
      list = batches.filter((b) => b.quantity === 0);
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase().trim();
    return list.filter((b) => {
      const name = b.products?.name?.toLowerCase() || '';
      const brand = b.products?.brand?.toLowerCase() || '';
      const category = b.products?.category?.toLowerCase() || '';
      const barcode = b.products?.barcode?.toLowerCase() || '';
      const batchNo = b.batch_number?.toLowerCase() || '';

      return (
        name.includes(query) ||
        brand.includes(query) ||
        category.includes(query) ||
        barcode.includes(query) ||
        batchNo.includes(query)
      );
    });
  }, [batches, productFilter, searchQuery]);

  // Dashboard Risk Calculations
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let moneyAtRisk = 0;
    let expiring7DaysCount = 0;
    let expiring30DaysCount = 0;
    let expiredLoss = 0;

    activeBatches.forEach((batch) => {
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
  }, [activeBatches]);

  const getDaysRemaining = (expiryDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDateStr);
    exp.setHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Open Quick Sale Modal
  const openSaleModal = (batch: BatchItem) => {
    setSellingBatch(batch);
    setSellQty(1);
    setSaleError(null);
  };

  // Confirm Quick Sale
  const handleConfirmSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellingBatch || !businessId) return;

    if (sellQty <= 0 || sellQty > sellingBatch.quantity) {
      setSaleError(`Quantity must be between 1 and ${sellingBatch.quantity}`);
      return;
    }

    setSubmittingSale(true);
    setSaleError(null);

    try {
      const priceUnit = sellingBatch.selling_price || sellingBatch.purchase_price;
      const notes = `Regular Sale @ MRP ₹${priceUnit}/unit`;

      const { error: moveError } = await supabase.from('stock_movements').insert({
        batch_id: sellingBatch.id,
        business_id: businessId,
        movement_type: 'sale_fefo',
        quantity_change: -Math.abs(sellQty),
        notes: notes,
      });

      if (moveError) throw moveError;

      const newQty = sellingBatch.quantity - sellQty;
      const { error: updateError } = await supabase
        .from('product_batches')
        .update({ quantity: newQty })
        .eq('id', sellingBatch.id);

      if (updateError) throw updateError;

      setSellingBatch(null);
      fetchInventory(businessId);
    } catch (err: any) {
      setSaleError(err.message || 'Failed to record sale.');
    } finally {
      setSubmittingSale(false);
    }
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
            {/* Signature Metric Card */}
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
              
              <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-300">
                  Unsold inventory nearing expiry. Rescuing stock early prevents write-offs.
                </p>
                <button
                  onClick={() => setIsDigestOpen(true)}
                  className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 shrink-0"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Staff Digest</span>
                </button>
              </div>
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
                <div className="text-2xl font-bold text-emerald-600">
                  ₹{totalRescuedValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-slate-400">Protected this month</p>
              </div>
            </div>

            {/* Urgent Batches Feed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Urgent Batches Needing Attention</h3>
                <span 
                  className="text-xs text-indigo-600 font-semibold cursor-pointer hover:underline" 
                  onClick={() => {
                    setProductFilter('active');
                    setActiveTab('products');
                  }}
                >
                  View All ({activeBatches.length})
                </span>
              </div>

              {loadingInventory ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading shop batches...</p>
                </div>
              ) : activeBatches.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                    <Package className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">No active stock nearing expiry</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    All current inventory batches are safe or resolved. Record new cartons to keep tracking.
                  </p>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-indigo-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Batch</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeBatches.slice(0, 5).map((batch) => {
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

        {/* Inventory Batches Tab with Search & Quick Sale */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Inventory Batches</h2>
                <p className="text-xs text-slate-500">Manage shelf stock, record customer sales, or inspect past resolved history.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-indigo-700 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stock</span>
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by product name, brand, barcode, batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Toggle Buttons */}
            <div className="flex space-x-1 bg-slate-200/70 p-1 rounded-xl w-fit text-xs font-semibold">
              <button
                onClick={() => setProductFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  productFilter === 'active'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                In Stock ({activeBatches.length})
              </button>

              <button
                onClick={() => setProductFilter('resolved')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  productFilter === 'resolved'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Resolved / Out of Stock ({batches.filter((b) => b.quantity === 0).length})
              </button>

              <button
                onClick={() => setProductFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  productFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Records ({batches.length})
              </button>
            </div>

            {/* Batches Feed */}
            <div className="space-y-2.5">
              {displayedBatches.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">No matching products found</p>
                  {searchQuery && (
                    <p className="text-[11px] text-slate-400">
                      No results for &quot;{searchQuery}&quot;. Try clearing the search or checking another filter tab.
                    </p>
                  )}
                </div>
              ) : (
                displayedBatches.map((batch) => {
                  const isResolved = batch.quantity === 0;

                  return (
                    <div 
                      key={batch.id} 
                      className={`p-4 rounded-xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                        isResolved ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-sm text-slate-900">{batch.products?.name}</h4>
                          {isResolved ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Resolved
                            </span>
                          ) : (
                            batch.products?.brand && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {batch.products.brand}
                              </span>
                            )
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Batch #{batch.batch_number} • Qty: <strong className={isResolved ? 'text-slate-400' : 'text-slate-900 text-sm'}>{batch.quantity} units</strong> • Cost: ₹{Number(batch.purchase_price).toFixed(2)} {batch.selling_price ? `• MRP: ₹${batch.selling_price}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end space-x-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-left sm:text-right">
                          <span className="text-xs font-semibold text-indigo-600">Exp: {batch.expiry_date}</span>
                        </div>

                        {!isResolved && (
                          <button
                            type="button"
                            onClick={() => openSaleModal(batch)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold shadow-sm active:scale-95 transition"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>− Sell Units</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Scan Tab */}
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

        {/* Rescue Tab */}
        {activeTab === 'rescue' && (
          <StockRescue
            batches={activeBatches}
            businessId={businessId}
            onStockUpdated={() => {
              if (businessId) fetchInventory(businessId);
            }}
          />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
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

            {/* GST & Tax Loss Audit Report Module */}
            <AuditReport businessId={businessId} businessName={businessName} />
          </div>
        )}
      </main>

      {/* Quick Sale / Deduct Modal */}
      {sellingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Customer Sale</h3>
                  <p className="text-[11px] text-slate-500">Deduct sold units from shelf stock</p>
                </div>
              </div>
              <button
                onClick={() => setSellingBatch(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900">{sellingBatch.products?.name}</div>
              <div className="text-slate-500">
                Batch #{sellingBatch.batch_number} • Currently on shelf: <strong className="text-slate-800">{sellingBatch.quantity} units</strong>
              </div>
              <div className="text-slate-500">
                Tag Price: <strong className="text-slate-800">₹{sellingBatch.selling_price || sellingBatch.purchase_price}</strong>
              </div>
            </div>

            {saleError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {saleError}
              </div>
            )}

            <form onSubmit={handleConfirmSale} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Units Sold
                  </label>
                  <div className="flex space-x-1">
                    {[1, 2, 5].map((preset) => (
                      preset <= sellingBatch.quantity && (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSellQty(preset)}
                          className="px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold transition"
                        >
                          +{preset}
                        </button>
                      )
                    ))}
                    <button
                      type="button"
                      onClick={() => setSellQty(sellingBatch.quantity)}
                      className="px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-indigo-700 rounded font-semibold transition"
                    >
                      All ({sellingBatch.quantity})
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSellQty(Math.max(1, sellQty - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold active:scale-95 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max={sellingBatch.quantity}
                    required
                    value={sellQty}
                    onChange={(e) => setSellQty(parseInt(e.target.value, 10) || 1)}
                    className="flex-1 h-10 text-center font-bold text-lg border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />

                  <button
                    type="button"
                    onClick={() => setSellQty(Math.min(sellingBatch.quantity, sellQty + 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Total Sale Value Summary */}
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="text-[11px] text-emerald-700">Total Customer Billed: </span>
                <strong className="text-emerald-800 text-sm">
                  ₹{(sellQty * Number(sellingBatch.selling_price || sellingBatch.purchase_price)).toFixed(2)}
                </strong>
              </div>

              <button
                type="submit"
                disabled={submittingSale}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
              >
                {submittingSale ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Confirm Sale & Deduct {sellQty} Unit(s)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Stock Entry Modal */}
      <AddProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProductAdded={() => {
          if (businessId) fetchInventory(businessId);
        }}
        businessId={businessId}
      />

      {/* WhatsApp Staff Digest Modal */}
      <WhatsAppDigestModal
        isOpen={isDigestOpen}
        onClose={() => setIsDigestOpen(false)}
        businessName={businessName}
        batches={activeBatches}
        moneyAtRisk={metrics.moneyAtRisk}
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