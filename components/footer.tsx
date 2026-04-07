"use client";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-6 w-full">
      <div className="w-full border-t border-white/10 bg-black/55 px-4 py-3 text-white/80 backdrop-blur-xl sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/90">Tempted Chat</p>
            <p className="text-[11px] text-white/55">Fast random conversations with a modern flow.</p>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-semibold text-white/60">
            <a href="#" className="transition hover:text-white">Safety</a>
            <a href="#" className="transition hover:text-white">Guidelines</a>
            <a href="#" className="transition hover:text-white">Privacy</a>
          </div>
        </div>

        <div className="mt-3 h-px w-full bg-white/10" />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
          <span>{`Copyright ${year} Tempted Chat`}</span>
          <span>Developed by Zevarone</span>
          <span>Live Protocol</span>
        </div>
      </div>
    </footer>
  );
}
