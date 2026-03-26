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

  return (
    <div className="odds-ticker" aria-label="Championship odds">
      <div className="odds-ticker-track">
        <div className="odds-ticker-group">
          {items.map((item) => (
            <TickerItem key={item.teamId} item={item} />
          ))}
        </div>
        <div className="odds-ticker-group" aria-hidden="true">
          {items.map((item) => (
            <TickerItem key={`dup-${item.teamId}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TickerItem({ item }: { item: OddsTickerItem }) {
  return (
    <div className="ticker-item">
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
      <span className="ticker-prob">{(item.probability * 100).toFixed(1)}%</span>
    </div>
  );
}
