const logoUrl = `${import.meta.env.BASE_URL}nanyan-public-welfare.jpg`;

export function NanyanBrand({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="nanyan-brand-compact" aria-label="南雁公益">
        <span className="nanyan-symbol" aria-hidden="true">
          <img src={logoUrl} alt="" />
        </span>
        <span>南雁公益</span>
      </div>
    );
  }

  return (
    <div className="nanyan-signature">
      <span>联合呈现</span>
      <img src={logoUrl} alt="南雁公益 Nanyan Public Welfare" />
    </div>
  );
}
