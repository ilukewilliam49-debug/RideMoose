const ITEMS = Array.from({ length: 20 });

const LaunchingSoonBanner = () => {
  return (
    <div className="w-full overflow-hidden bg-primary text-primary-foreground border-b border-primary/30">
      <div className="flex whitespace-nowrap animate-marquee py-1.5">
        {ITEMS.concat(ITEMS).map((_, i) => (
          <span
            key={i}
            className="mx-6 text-[11px] font-bold uppercase tracking-[0.2em] inline-flex items-center gap-2 shrink-0"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-foreground/80" />
            Launching Soon
          </span>
        ))}
      </div>
    </div>
  );
};

export default LaunchingSoonBanner;
