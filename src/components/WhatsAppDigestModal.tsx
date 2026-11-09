import { useState } from 'react';
import { X, MessageCircle, Copy, Check, Send, Languages } from 'lucide-react';

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
  } | null;
}

interface WhatsAppDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  batches: BatchItem[];
  moneyAtRisk: number;
}

export default function WhatsAppDigestModal({
  isOpen,
  onClose,
  businessName,
  batches,
}: WhatsAppDigestModalProps) {
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState<'ml' | 'en'>('ml');

  if (!isOpen) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter urgent batches (expired or expiring in <= 7 days)
  const urgentBatches = batches.filter((b) => {
    const exp = new Date(b.expiry_date);
    exp.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  });

  // Calculate risk value specifically for these urgent 7-day batches
  const urgentCostAtRisk = urgentBatches.reduce((sum, b) => {
    return sum + b.quantity * Number(b.purchase_price);
  }, 0);

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  let message = '';

  if (language === 'ml') {
    message += `🚨 *ExpiryAlert രാവിലത്തെ സ്റ്റോക്ക് പരിശോധന — ${businessName}*\n`;
    message += `📅 *തീയതി:* ${formattedDate}\n`;
    message += `⚠️ *അടുത്ത 7 ദിവസത്തിനകം തീരുന്നവ:* ${urgentBatches.length} ഇനങ്ങൾ\n`;
    message += `💰 *നഷ്ടസാധ്യത തുക:* ₹${urgentCostAtRisk.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*ഷെൽഫ് പരിശോധന ലിസ്റ്റ്*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (urgentBatches.length === 0) {
      message += `✅ *എല്ലാം സുരക്ഷിതം!* അടുത്ത 7 ദിവസത്തിനകം കാലാവധി തീരുന്ന സാധനങ്ങൾ ഒന്നും നിലവിലില്ല.\n\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `_സ്റ്റാഫ് ശ്രദ്ധിക്കുക: ഇന്ന് അടിയന്തരമായി മാറ്റേണ്ട സാധനങ്ങൾ ഒന്നുമില്ല. പതിവുപോലെ തുടരുക._`;
    } else {
      urgentBatches.forEach((batch, idx) => {
        const exp = new Date(batch.expiry_date);
        exp.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const status =
          diffDays < 0
            ? `🔴 കാലാവധി കഴിഞ്ഞു (${Math.abs(diffDays)} ദിവസം മുൻപ്)`
            : diffDays === 0
            ? `🔴 ഇന്ന് കാലാവധി തീരുന്നു!`
            : `🟠 ${diffDays} ദിവസത്തിനകം തീരും`;

        message += `${idx + 1}. *${batch.products?.name || 'Product'}* ${batch.products?.brand ? `(${batch.products.brand})` : ''}\n`;
        message += `   • അവസ്ഥ: ${status}\n`;
        message += `   • സ്റ്റോക്ക്: *${batch.quantity} എണ്ണം* (Batch #${batch.batch_number})\n`;
        message += `   • അവസാന തീയതി: ${batch.expiry_date}\n\n`;
      });

      message += `━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `_സ്റ്റാഫ് ശ്രദ്ധിക്കുക: ദയവായി ഷെൽഫിൽ നിന്ന് ഈ സാധനങ്ങൾ പരിശോധിച്ച് ഉടൻ തന്നെ ഡിസ്കൗണ്ട് സ്റ്റിക്കർ ഒട്ടിക്കുകയോ സപ്ലയർക്ക് റിട്ടേൺ നൽകുകയോ ചെയ്യുക._`;
    }
  } else {
    // English Version
    message += `🚨 *ExpiryAlert Morning Audit — ${businessName}*\n`;
    message += `📅 *Date:* ${formattedDate}\n`;
    message += `⚠️ *Urgent Batches (Next 7 Days):* ${urgentBatches.length} item(s)\n`;
    message += `💰 *Cost at Risk:* ₹${urgentCostAtRisk.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*SHELF ACTION CHECKLIST*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (urgentBatches.length === 0) {
      message += `✅ *All clear!* No stock expiring in the next 7 days.\n\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `_Staff Note: No urgent clearance actions required today. Regular operations continue._`;
    } else {
      urgentBatches.forEach((batch, idx) => {
        const exp = new Date(batch.expiry_date);
        exp.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const status =
          diffDays < 0
            ? `🔴 EXPIRED (${Math.abs(diffDays)}d ago)`
            : diffDays === 0
            ? `🔴 EXPIRES TODAY`
            : `🟠 Expires in ${diffDays} day(s)`;

        message += `${idx + 1}. *${batch.products?.name || 'Product'}* ${batch.products?.brand ? `(${batch.products.brand})` : ''}\n`;
        message += `   • Status: ${status}\n`;
        message += `   • Stock: *${batch.quantity} units* (Batch #${batch.batch_number})\n`;
        message += `   • Exp Date: ${batch.expiry_date}\n\n`;
      });

      message += `━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `_Action item: Staff please verify physical shelves, apply clearance tags or initiate vendor return._`;
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const encoded = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Morning Expiry Digest</h3>
              <p className="text-[11px] text-slate-500">Send shelf checklist directly to store staff</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl">
          <span className="text-[11px] font-semibold text-slate-500 pl-2 flex items-center gap-1">
            <Languages className="w-3.5 h-3.5" /> Language:
          </span>
          <div className="flex space-x-1">
            <button
              type="button"
              onClick={() => setLanguage('ml')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                language === 'ml'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              മലയാളം
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                language === 'en'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Message Preview Box */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 max-h-64 overflow-y-auto font-sans text-xs text-slate-700 whitespace-pre-wrap leading-relaxed shadow-inner">
          {message}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition border border-slate-200"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Text</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition"
          >
            <Send className="w-4 h-4" />
            <span>Open WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}