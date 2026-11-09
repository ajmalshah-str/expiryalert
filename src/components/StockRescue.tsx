import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Flame, 
  Tag, 
  RotateCcw, 
  Trash2, 
  CheckCircle2, 
  Loader2, 
  ArrowRight,
  X,
  Percent
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

interface StockRescueProps {
  batches: BatchItem[];
  businessId: string | null;
  onStockUpdated: () => void;
}

export default function StockRescue({ batches, businessId, onStockUpdated }: StockRescueProps) {
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [actionType, setActionType] = useState<'sale_fefo' | 'returned' | 'expired'>('sale_fefo');
  const [actionQty, setActionQty] = useState<number>(1);
  const [customPrice, setCustomPrice] = useState<string>('');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Store owner custom discount overrides per batch (keyed by batch id)
  const [discountOverrides, setDiscountOverrides] = useState<Record<string, number>>({});

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Batches expiring within 30 days or already expired
  const rescueBatches = batches.filter((b) => {
    const exp = new Date(b.expiry_date);
    exp.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  });

  const getDefaultDiscount = (days: number) => {
    if (days < 0) return 0;
    if (days <= 7) return 40;
    if (days <= 15) return 25;
    return 15;
  };

  const getBatchData = (batch: BatchItem) => {
    const exp = new Date(batch.expiry_date);
    exp.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const basePrice = batch.selling_price ? Number(batch.selling_price) : Number(batch.purchase_price) * 1.2;

    const discount = discountOverrides[batch.id] !== undefined 
      ? discountOverrides[batch.id] 
      : getDefaultDiscount(diffDays);

    const clearancePrice = Math.max(1, Math.round(basePrice * (1 - discount / 100)));

    return {
      days: diffDays,
      basePrice,
      discount,
      clearancePrice,
      isExpired: diffDays < 0,
    };
  };

  const handleDiscountChange = (batchId: string, value: number) => {
    const clamped = Math.max(0, Math.min(95, value));
    setDiscountOverrides((prev) => ({ ...prev, [batchId]: clamped }));
  };

  const openActionModal = (batch: BatchItem, defaultAction: 'sale_fefo' | 'returned' | 'expired') => {
    const data = getBatchData(batch);
    setSelectedBatch(batch);
    setActionType(defaultAction);
    setActionQty(batch.quantity);
    setCustomPrice(data.clearancePrice.toString());
    setActionNotes('');
    setErrorMsg(null);
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch || !businessId) return;

    if (actionQty <= 0 || actionQty > selectedBatch.quantity) {
      setErrorMsg(`Quantity must be between 1 and ${selectedBatch.quantity}`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const priceNote = actionType === 'sale_fefo' ? `Sold @ ₹${customPrice}/unit` : '';
      const finalNotes = [priceNote, actionNotes.trim()].filter(Boolean).join(' • ');

      const { error: moveError } = await supabase.from('stock_movements').insert({
        batch_id: selectedBatch.id,
        business_id: businessId,
        movement_type: actionType,
        quantity_change: -Math.abs(actionQty),
        notes: finalNotes || null,
      });

      if (moveError) throw moveError;

      const remainingQty = selectedBatch.quantity - actionQty;
      const { error: updateError } = await supabase
        .from('product_batches')
        .update({ quantity: remainingQty })
        .eq('id', selectedBatch.id);

      if (updateError) throw updateError;

      setSelectedBatch(null);
      onStockUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update stock.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white rounded-2xl p-6 shadow-md">
        <div className="flex items-center space-x-2">
          <Flame className="w-6 h-6 text-yellow-200" />
          <h2 className="text-xl font-bold">Stock Rescue Mode</h2>
        </div>
        <p className="text-xs text-amber-50 max-w-xl mt-1 leading-relaxed">
          Set custom discount offers or clearances to sell nearing-expiry goods before they turn into dead-stock losses.
        </p>
      </div>

      {rescueBatches.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">All Batches Safe!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No stock batches are expiring within the next 30 days.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rescueBatches.map((batch) => {
            const { days, basePrice, discount, clearancePrice, isExpired } = getBatchData(batch);
            const valueAtRisk = batch.quantity * Number(batch.purchase_price);

            return (
              <div 
                key={batch.id} 
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-slate-300 transition space-y-4"
              >
                {/* Header Information */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">
                        {batch.products?.name}
                      </span>
                      {batch.products?.brand && (
                        <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                          {batch.products.brand}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Units at risk: <strong className="text-slate-800">{batch.quantity}</strong> • Batch #{batch.batch_number} • Cost: ₹{Number(batch.purchase_price).toFixed(2)} {batch.selling_price ? `• Tag MRP: ₹${batch.selling_price}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                      isExpired 
                        ? 'bg-rose-100 text-rose-800 border-rose-300' 
                        : days <= 7 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {isExpired ? `Expired ${Math.abs(days)}d ago` : `${days} days left`}
                    </span>
                    <div className="text-right">
                      <div className="text-xs font-bold text-rose-600">
                        ₹{valueAtRisk.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">cost risk</div>
                    </div>
                  </div>
                </div>

                {/* Customizable Discount Section */}
                {!isExpired && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        Set Your Clearance Offer:
                      </span>

                      {/* Quick preset chips */}
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] text-slate-400 font-semibold mr-1">Quick:</span>
                        {[15, 25, 40, 50].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleDiscountChange(batch.id, preset)}
                            className={`px-2 py-0.5 text-[11px] rounded font-semibold transition ${
                              discount === preset
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {preset}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Controls Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Owner Discount Input */}
                      <div className="flex items-center space-x-2">
                        <label className="text-xs text-slate-600 font-medium shrink-0">
                          Discount %:
                        </label>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="0"
                            max="95"
                            value={discount}
                            onChange={(e) => handleDiscountChange(batch.id, parseInt(e.target.value, 10) || 0)}
                            className="w-full pl-3 pr-7 py-1.5 text-sm font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                          <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                        </div>
                      </div>

                      {/* Resulting Price Banner */}
                      <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500">
                          Clearance MRP: <span className="line-through text-slate-400">₹{basePrice.toFixed(0)}</span>
                        </span>
                        <span className="text-base font-extrabold text-emerald-600">
                          ₹{clearancePrice}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!isExpired ? (
                    <>
                      <button
                        onClick={() => openActionModal(batch, 'sale_fefo')}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>Record Sale @ ₹{clearancePrice}</span>
                      </button>

                      <button
                        onClick={() => openActionModal(batch, 'returned')}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-slate-200 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Return to Supplier</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openActionModal(batch, 'expired')}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Write Off as Expired</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Dialog */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Record Stock Clearance</h3>
              <button
                onClick={() => setSelectedBatch(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="font-semibold text-slate-900">{selectedBatch.products?.name}</div>
              <div>Batch #{selectedBatch.batch_number} • Current stock: {selectedBatch.quantity} units</div>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleConfirmAction} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Action Type
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="sale_fefo">Sold at Clearance / Discount (Rescued)</option>
                  <option value="returned">Returned to Distributor / Supplier</option>
                  <option value="expired">Dispose / Write-off Dead Stock</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Units Sold (Max {selectedBatch.quantity})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedBatch.quantity}
                    required
                    value={actionQty}
                    onChange={(e) => setActionQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {actionType === 'sale_fefo' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Final Price (₹/unit)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      required
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-emerald-600"
                    />
                  </div>
                ) : null}
              </div>

              {actionType === 'sale_fefo' && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 font-medium text-center">
                  Total Money Recovered: <strong>₹{(actionQty * (parseFloat(customPrice) || 0)).toFixed(2)}</strong>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="e.g. Cleared via shelf promo"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Confirm & Update Stock</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}