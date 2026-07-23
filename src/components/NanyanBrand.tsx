import { Confetti, Sparkle, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

const logoUrl = `${import.meta.env.BASE_URL}nanyan-public-welfare.jpg`;
const transparentLogoUrl = `${import.meta.env.BASE_URL}nanyan-public-welfare-transparent.png`;

export function NanyanBrand({ compact = false }: { compact?: boolean }) {
  const [showCredit, setShowCredit] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCredit) return;
    function closeCredit(event: PointerEvent) {
      if (!brandRef.current?.contains(event.target as Node)) setShowCredit(false);
    }
    function closeWithKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setShowCredit(false);
    }
    document.addEventListener("pointerdown", closeCredit);
    document.addEventListener("keydown", closeWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeCredit);
      document.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [showCredit]);

  const easterEgg = showCredit && (
    <div
      className="easter-egg-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && setShowCredit(false)}
    >
      <section className="easter-egg-dialog" role="dialog" aria-modal="true" aria-labelledby="easter-egg-title">
        <Sparkle className="easter-spark spark-one" size={28} weight="fill" aria-hidden="true" />
        <Sparkle className="easter-spark spark-two" size={18} weight="fill" aria-hidden="true" />
        <button
          type="button"
          className="easter-egg-close"
          onClick={() => setShowCredit(false)}
          aria-label="关闭彩蛋"
        >
          <X size={20} />
        </button>

        <img
          className="easter-egg-logo"
          src={transparentLogoUrl}
          alt="南雁公益 Nanyan Public Welfare"
        />
        <div className="easter-egg-label"><Confetti size={18} weight="duotone" />隐藏祝福</div>
        <h2 id="easter-egg-title">恭喜你发现了彩蛋！</h2>
        <p>愿这个夏天，你能在南雁遇见同频的朋友，解锁新的兴趣，也留下许多值得反复想起的快乐回忆。</p>
        <p>祝大家度过一个热烈、有趣、闪闪发光的夏令营。</p>
        <span className="easter-egg-credit">Built with care by Hengtao Wu</span>
        <button type="button" className="primary-button" autoFocus onClick={() => setShowCredit(false)}>
          收下这份祝福
        </button>
      </section>
    </div>
  );

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
        {easterEgg}
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
      {easterEgg}
    </div>
  );
}
