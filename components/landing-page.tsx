import Link from "next/link";
import {
  ShieldCheck,
  User,
  Zap,
  Timer,
} from "lucide-react";

type FeatureProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
};

const ADVANTAGES = [
  {
    title: "End-to-end encrypted chat",
    description:
      "Messages and media are encrypted on your device before sending, then decrypted only by the recipient.",
    icon: ShieldCheck,
  },
  {
    title: "Anonymous by default",
    description:
      "Join quickly without public profiles. You control what you share and when.",
    icon: User,
  },
  {
    title: "Fast real-time matching",
    description:
      "Low-latency matching with smooth reconnects and instant transitions.",
    icon: Zap,
  },
  {
    title: "Timed encrypted media",
    description:
      "Send images with timers and automatic expiry for safer conversations.",
    icon: Timer,
  },
];

export function LandingPageSection() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-12">
      {/* Background glow */}
      <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-12 shadow-2xl">
        
        {/* TOP */}
        <div className="grid gap-10 md:grid-cols-2 items-center">
          
          {/* LEFT */}
          <div>
            {/* <div className="flex gap-2 flex-wrap">
              <span className="badge">Encrypted</span>
              <span className="badge">Realtime</span>
              <span className="badge">Anonymous</span>
            </div> */}

            <h1 className="mt-6 text-4xl md:text-6xl font-black text-white leading-tight">
              Meet strangers.
              <span className="block text-cyan-300">
                Stay private.
              </span>
            </h1>

            <p className="mt-4 text-white/70 max-w-md">
              Tempted.Chat lets you connect instantly while keeping your identity protected with strong encryption and privacy-first design.
            </p>

            <div className="mt-8 flex gap-3 flex-wrap">
              <Link
                href="/"
                className="btn-primary"
              >
                Start Chatting
              </Link>
              <Link
                href="/"
                className="btn-secondary"
              >
                Explore
              </Link>
            </div>
          </div>

          {/* RIGHT CARD */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg shadow-inner">
            <p className="text-xs uppercase text-white/50 mb-4 tracking-wider">
              Why choose us
            </p>

            <div className="space-y-4">
              <Feature icon={ShieldCheck} label="E2EE" sub="Client-side encryption" />
              <Feature icon={Zap} label="Realtime" sub="Instant matching" />
              <Feature icon={Timer} label="Timed Media" sub="Auto-expiring images" />
            </div>
          </div>
        </div>

        {/* FEATURES GRID */}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {ADVANTAGES.map((item) => (
            <div
              key={item.title}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <item.icon className="h-6 w-6 text-cyan-300" />

              <h3 className="mt-4 text-lg font-bold text-white">
                {item.title}
              </h3>

              <p className="mt-2 text-sm text-white/70">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* STYLES */}
      <style jsx>{`
        .badge {
          padding: 4px 10px;
          font-size: 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.7);
        }

        .btn-primary {
          background: linear-gradient(to right, #22d3ee, #34d399);
          color: black;
          font-weight: 700;
          padding: 10px 18px;
          border-radius: 12px;
          transition: 0.2s;
        }

        .btn-primary:hover {
          filter: brightness(1.1);
        }

        .btn-secondary {
          border: 1px solid rgba(255,255,255,0.2);
          padding: 10px 18px;
          border-radius: 12px;
          color: white;
        }

        .btn-secondary:hover {
          border-color: rgba(255,255,255,0.4);
        }
      `}</style>
    </section>
  );
}

/* SMALL FEATURE ROW */
function Feature({ icon: Icon, label, sub }: FeatureProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-cyan-400/10 border border-cyan-400/20">
        <Icon className="h-4 w-4 text-cyan-300" />
      </div>
      <div>
        <p className="text-white font-semibold text-sm">{label}</p>
        <p className="text-white/50 text-xs">{sub}</p>
      </div>
    </div>
  );
}