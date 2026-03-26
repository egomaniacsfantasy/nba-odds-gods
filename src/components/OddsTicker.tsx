interface OddsTickerItem {
  teamId: number;
  abbr: string;
  logoUrl: string;
  probability: number;
}

interface OddsTickerProps {
  items: OddsTickerItem[];
}

export function OddsTicker({ items }: OddsTickerProps) {
  if (items.length === 0) {
    return null;
  }

  const repeatedItems = [...items, ...items];

  return (
    <div className="odds-ticker" aria-label="Championship contenders">
      <div className="odds-ticker-track">
        {repeatedItems.map((item, index) => (
          <div key={`${item.teamId}-${index}`} className="ticker-item">
            <span className="ticker-logo-wrap">
              <img
                className="ticker-logo"
                src={item.logoUrl}
                alt={item.abbr}
                loading="lazy"
                onError={(event: { currentTarget: HTMLImageElement }) => {
                  event.currentTarget.style.display = 'none';
                  const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;

                  if (fallback) {
                    fallback.style.display = 'flex';
                  }
                }}
              />
              <span className="logo-fallback ticker-logo-fallback" style={{ display: 'none' }}>
                {item.abbr}
              </span>
            </span>
            <span className="ticker-abbr">{item.abbr}</span>
            <span className="ticker-odds">{(item.probability * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
