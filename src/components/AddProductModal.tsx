import { useState } from 'react';
import { supabase } from '../lib/supabase';
import BarcodeScanner from './BarcodeScanner';
import { 
  X, 
  Package, 
  Calendar, 
  Tag, 
  AlertCircle, 
  Loader2, 
  Camera, 
  Search,
  CheckCircle2
} from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductAdded: () => void;
  businessId: string | null;
}

export default function AddProductModal({
  isOpen,
  onClose,
  onProductAdded,
  businessId,
}: AddProductModalProps) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Dairy');
  const [barcode, setBarcode] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingProduct, setFetchingProduct] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  if (!isOpen) return null;

  // Auto-fill product info from existing store items or Open Food Facts database
  const lookupBarcode = async (codeToLookup: string) => {
    const trimmed = codeToLookup.trim();
    if (!trimmed) return;

    setBarcode(trimmed);
    setFetchingProduct(true);
    setLookupFeedback(null);
    setErrorMsg(null);

    try {
      // 1. Check if the shop already has this product saved
      if (businessId) {
        const { data: localMatch } = await supabase
          .from('products')
          .select('name, brand, category')
          .eq('business_id', businessId)
          .eq('barcode', trimmed)
          .maybeSingle();

        if (localMatch) {
          setName(localMatch.name || '');
          if (localMatch.brand) setBrand(localMatch.brand);
          if (localMatch.category) setCategory(localMatch.category);
          setLookupFeedback('Product matched from your existing inventory!');
          setFetchingProduct(false);
          return;
        }
      }

      // 2. Fallback: Query the Open Food Facts global grocery database
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(trimmed)}.json`);
      if (response.ok) {
        const result = await response.json();
        if (result.status === 1 && result.product) {
          const item = result.product;
          
          if (item.product_name) {
            setName(item.product_name);
          }
          if (item.brands) {
            setBrand(item.brands.split(',')[0].trim());
          }

          // Map categories if present
          const tags: string[] = item.categories_tags || [];
          const tagStr = tags.join(' ').toLowerCase();

          if (tagStr.includes('dairy') || tagStr.includes('milk') || tagStr.includes('cheese') || tagStr.includes('yogurt')) {
            setCategory('Dairy');
          } else if (tagStr.includes('bread') || tagStr.includes('bakery') || tagStr.includes('cake')) {
            setCategory('Bakery');
          } else if (tagStr.includes('beverage') || tagStr.includes('drink') || tagStr.includes('juice') || tagStr.includes('tea') || tagStr.includes('coffee')) {
            setCategory('Beverages');
          } else if (tagStr.includes('snack') || tagStr.includes('biscuit') || tagStr.includes('cookie') || tagStr.includes('chocolate')) {
            setCategory('Snacks');
          } else if (tagStr.includes('grain') || tagStr.includes('rice') || tagStr.includes('flour') || tagStr.includes('pasta')) {
            setCategory('Grains & Staples');
          }

          setLookupFeedback('Details auto-filled from Open Food Facts database.');
        } else {
          setLookupFeedback('Barcode scanned. Add product details manually below.');
        }
      } else {
        setLookupFeedback('Barcode scanned. Add product details manually below.');
      }
    } catch {
      setLookupFeedback('Network check skipped. You can enter details manually.');
    } finally {
      setFetchingProduct(false);
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    setIsScannerOpen(false);
    lookupBarcode(decodedText);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) {
      setErrorMsg('Store account not found. Please log in again.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      let productId: string | null = null;

      if (barcode.trim()) {
        const { data: existingBarcode } = await supabase
          .from('products')
          .select('id')
          .eq('business_id', businessId)
          .eq('barcode', barcode.trim())
          .maybeSingle();

        if (existingBarcode) productId = existingBarcode.id;
      }

      if (!productId) {
        const { data: newProduct, error: prodError } = await supabase
          .from('products')
          .insert({
            business_id: businessId,
            name: name.trim(),
            brand: brand.trim() || null,
            category,
            barcode: barcode.trim() || null,
          })
          .select('id')
          .single();

        if (prodError) throw prodError;
        productId = newProduct.id;
      }

      const { error: batchError } = await supabase.from('product_batches').insert({
        product_id: productId,
        business_id: businessId,
        batch_number: batchNumber.trim() || `B-${Date.now().toString().slice(-6)}`,
        quantity: parseInt(quantity, 10),
        purchase_price: parseFloat(purchasePrice),
        selling_price: sellingPrice ? parseFloat(sellingPrice) : null,
        expiry_date: expiryDate,
      });

      if (batchError) throw batchError;

      setName('');
      setBrand('');
      setBarcode('');
      setBatchNumber('');
      setQuantity('');
      setPurchasePrice('');
      setSellingPrice('');
      setExpiryDate('');
      setLookupFeedback(null);
      onProductAdded();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add stock batch.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Add Stock & Expiry Batch</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {lookupFeedback && (
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs rounded-lg flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600" />
                <span>{lookupFeedback}</span>
              </div>
            )}

            {/* Section: Barcode & Auto-lookup */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Barcode (Quick Scan or Type)
                </label>
                {fetchingProduct && (
                  <span className="text-[11px] text-indigo-600 font-medium flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Looking up product...
                  </span>
                )}
              </div>

              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="e.g. 8901262010019"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {barcode.trim() && (
                  <button
                    type="button"
                    onClick={() => lookupBarcode(barcode)}
                    disabled={fetchingProduct}
                    title="Find details for this barcode"
                    className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-200 transition"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Lookup</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm transition active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Scan</span>
                </button>
              </div>
            </div>

            {/* Section: Product Info */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Product Information
              </span>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amul Taaza Milk 500ml"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand / Producer
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Amul, Britannia"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="Dairy">Dairy</option>
                    <option value="Bakery">Bakery & Bread</option>
                    <option value="Packaged Foods">Packaged Foods</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Snacks">Snacks & Confectionery</option>
                    <option value="Grains & Staples">Grains & Staples</option>
                    <option value="Personal Care">Personal Care</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Batch & Expiry Details */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Batch & Expiry Values
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiry Date *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="date"
                      required
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Units in Batch *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 24"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cost / Unit (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="e.g. 25.00"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">Calculates Money at Risk</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selling Price / Unit (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="e.g. 28.00"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">MRP / Tag Price</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Batch Number (Optional)
                </label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="Printed code on pack (e.g. L0411B)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md flex items-center justify-center space-x-2 transition disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Save Batch to Inventory</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Camera Barcode Scanner Overlay */}
      {isScannerOpen && (
        <BarcodeScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </>
  );
}