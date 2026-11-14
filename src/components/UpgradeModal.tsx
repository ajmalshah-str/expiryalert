import React from 'react';
import { Crown, Check, X, MessageCircle } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  lang?: 'en' | 'ml';
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  userEmail = '',
  lang = 'en',
}) => {
  if (!isOpen) return null;

  const ownerWhatsAppNumber = '919961985507';
  const prefilledText = encodeURIComponent(
    `Hi! I want to upgrade my ExpiryAlert store (${userEmail}) to the Pro Plan (₹149/month - Unlimited Products).`
  );
  const whatsappUrl = `https://wa.me/${ownerWhatsAppNumber}?text=${prefilledText}`;

  const copy = {
    en: {
      badge: 'Free Limit Reached (30 / 30)',
      title: 'Upgrade to ExpiryAlert Pro',
      subtitle:
        'You have reached the 30-product limit on the Free Starter plan. Upgrade to track your entire shop inventory.',
      price: '₹149',
      period: '/ month',
      features: [
        'Unlimited product & barcode entries',
        'Full store shelf-life protection',
        'Priority WhatsApp & phone support',
      ],
      cta: 'Activate Pro via WhatsApp / UPI',
      later: 'Maybe Later',
    },
    ml: {
      badge: 'സൗജന്യ പരിധി പൂർത്തിയായി (30 / 30)',
      title: 'ExpiryAlert Pro-യിലേക്ക് മാറുക',
      subtitle:
        'സൗജന്യ പ്ലാനിൽ പരമാവധി 30 സാധനങ്ങൾ മാത്രമേ ചേർക്കാൻ സാധിക്കൂ. കൂടുതൽ സാധനങ്ങൾ ചേർക്കാൻ Pro പ്ലാൻ തിരഞ്ഞെടുക്കുക.',
      price: '₹149',
      period: '/ മാസം',
      features: [
        'പരിധിയില്ലാതെ എത്ര സാധനങ്ങൾ വേണമെങ്കിലും ചേർക്കാം',
        'മുഴുവൻ സ്റ്റോക്കിന്റെയും എക്സ്പയറി ട്രാക്കിംഗ്',
        'നേരിട്ടുള്ള WhatsApp സപ്പോർട്ട്',
      ],
      cta: 'WhatsApp / UPI വഴി Pro ആക്ടിവേറ്റ് ചെയ്യുക',
      later: 'പിന്നീട് മതി',
    },
  }[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <Crown className="h-6 w-6" />
          </div>

          <span className="inline-block rounded-full bg-rose-50 border border-rose-200 px-3 py-0.5 text-xs font-bold text-rose-700 mb-2">
            {copy.badge}
          </span>

          <h2 className="text-xl font-extrabold text-slate-900">{copy.title}</h2>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{copy.subtitle}</p>
        </div>

        <div className="my-5 rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-black text-slate-900">{copy.price}</span>
            <span className="text-xs font-semibold text-slate-500">{copy.period}</span>
          </div>

          <ul className="mt-4 space-y-2.5 text-left">
            {copy.features.map((feat, idx) => (
              <li key={idx} className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="h-3 w-3" />
                </span>
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition"
        >
          <MessageCircle className="h-5 w-5" />
          <span>{copy.cta}</span>
        </a>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600"
        >
          {copy.later}
        </button>
      </div>
    </div>
  );
};

export default UpgradeModal;