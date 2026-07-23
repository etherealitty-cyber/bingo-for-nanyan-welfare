import { useEffect, useRef, useState } from "react";

const logoUrl = `${import.meta.env.BASE_URL}nanyan-public-welfare.jpg`;

export function NanyanBrand({ compact = false }: { compact?: boolean }) {
  const [showCredit, setShowCredit] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCredit) return;
    function closeCredit(event: PointerEvent) {
      if (!brandRef.current?.contains(event.target as Node)) setShowCredit(false);
    }
    document.addEventListener("pointerdown", closeCredit);
    return () => document.removeEventListener("pointerdown", closeCredit);
  }, [showCredit]);

  if (compact) {
    return (
      <div ref={brandRef} className="nanyan-brand-wrap compact-brand-wrap">
        <button
          type="button"
          className="nanyan-brand-compact"
          aria-label="南雁公益，查看制作信息"
          aria-expanded={showCredit}
          onClick={() => setShowCredit((visible) => !visible)}
        >
          <span className="nanyan-symbol" aria-hidden="true">
            <img src={logoUrl} alt="" />
          </span>
          <span>南雁公益</span>
        </button>
        {showCredit && <span className="builder-credit" role="status">Built by Hengtao Wu</span>}
      </div>
    );
  }

  return (
    <div ref={brandRef} className="nanyan-brand-wrap signature-brand-wrap">
      <button
        type="button"
        className="nanyan-signature"
        aria-label="南雁公益，查看制作信息"
        aria-expanded={showCredit}
        onClick={() => setShowCredit((visible) => !visible)}
      >
        <span>联合呈现</span>
        <img src={logoUrl} alt="南雁公益 Nanyan Public Welfare" />
      </button>
      {showCredit && <span className="builder-credit" role="status">Built by Hengtao Wu</span>}
    </div>
  );
}
