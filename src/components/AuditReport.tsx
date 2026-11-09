import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface AuditReportProps {
  businessId: string | null;
  businessName: string;
}

export default function AuditReport({ businessId, businessName }: AuditReportProps) {
  const [downloading, setDownloading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExportCSV = async () => {
    if (!businessId) {
      setStatusMsg({ type: 'error', text: 'Store ID not found. Please log in again.' });
      return;
    }

    setDownloading(true);
    setStatusMsg(null);

    try {
      // Fetch all stock movements with batch and product metadata
      const { data: movements, error } = await supabase
        .from('stock_movements')
        .select(`
          id,
          movement_type,
          quantity_change,
          notes,
          created_at,
          product_batches (
            batch_number,
            purchase_price,
            selling_price,
            expiry_date,
            products (
              name,
              brand,
              category,
              barcode
            )
          )
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!movements || movements.length === 0) {
        setStatusMsg({ type: 'error', text: 'No stock movements recorded yet to export.' });
        setDownloading(false);
        return;
      }

      // Build CSV Headers matching Indian GST / accounting audit format
      const headers = [
        'Record ID',
        'Date & Time (IST)',
        'Product Name',
        'Brand',
        'Category',
        'Barcode',
        'Batch Number',
        'Expiry Date',
        'Movement Type',
        'Units Resolved',
        'Unit Purchase Cost (INR)',
        'Total Purchase Cost (INR)',
        'Value Recovered / Credit (INR)',
        'Net Loss to Business (INR)',
        'Notes & Supplier Details'
      ];

      const rows: string[][] = [];

      movements.forEach((m: any) => {
        const batch = m.product_batches;
        const product = batch?.products;

        const date = new Date(m.created_at).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const qty = Math.abs(m.quantity_change || 0);
        const purchaseCost = Number(batch?.purchase_price || 0);
        const totalPurchaseVal = qty * purchaseCost;

        // Parse price or credit notes
        let recoveredVal = 0;
        let movementLabel = 'Adjustment';

        if (m.movement_type === 'sale_fefo') {
          movementLabel = 'Clearance Discount Sale (Rescued)';
          const match = m.notes?.match(/₹(\d+(\.\d+)?)/);
          const unitSale = match ? parseFloat(match[1]) : 0;
          recoveredVal = qty * unitSale;
        } else if (m.movement_type === 'returned') {
          movementLabel = 'Distributor Return (Credit Claim)';
          recoveredVal = totalPurchaseVal; // Supplier credit reimburses full cost
        } else if (m.movement_type === 'expired') {
          movementLabel = 'Dead-Stock Write-Off (Destroyed/Expired)';
          recoveredVal = 0;
        }

        const netLoss = Math.max(0, totalPurchaseVal - recoveredVal);

        rows.push([
          m.id,
          `"${date}"`,
          `"${product?.name || 'Unknown'}"`,
          `"${product?.brand || 'N/A'}"`,
          `"${product?.category || 'General'}"`,
          `"${product?.barcode || 'N/A'}"`,
          `"${batch?.batch_number || 'N/A'}"`,
          `"${batch?.expiry_date || 'N/A'}"`,
          `"${movementLabel}"`,
          qty.toString(),
          purchaseCost.toFixed(2),
          totalPurchaseVal.toFixed(2),
          recoveredVal.toFixed(2),
          netLoss.toFixed(2),
          `"${(m.notes || '').replace(/"/g, '""')}"`
        ]);
      });

      // Assemble CSV with UTF-8 Byte Order Mark (\uFEFF) for Microsoft Excel compatibility
      const csvString = '\uFEFF' + [
        headers.join(','),
        ...rows.map((row) => row.join(','))
      ].join('\r\n');

      // Trigger automatic file download
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filenameDate = new Date().toISOString().split('T')[0];
      
      link.href = url;
      link.setAttribute('download', `ExpiryAlert_GST_Audit_${businessName.replace(/\s+/g, '_')}_${filenameDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMsg({ type: 'success', text: `Exported ${rows.length} stock movement records successfully.` });
    } catch (err: any) {
      console.error('Audit export error:', err);
      setStatusMsg({ type: 'error', text: err.message || 'Failed to generate audit export.' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">GST & Tax Loss Audit Report</h3>
            <p className="text-[11px] text-slate-500">
              Export dead-stock write-offs, supplier returns, and clearance recoveries for your CA.
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
        Complies with Section 17(5)(h) ITC reversal recording. Outputs a spreadsheet detailing itemized purchase costs, distributor credit claims, and net inventory losses.
      </p>

      {statusMsg && (
        <div className={`p-2.5 rounded-lg text-xs flex items-center space-x-1.5 ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleExportCSV}
        disabled={downloading}
        className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
      >
        {downloading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Generating Audit File...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Download Audit Report (.CSV)</span>
          </>
        )}
      </button>
    </div>
  );
}