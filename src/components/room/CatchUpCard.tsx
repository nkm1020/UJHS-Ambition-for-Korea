"use client";

import type { CatchUp } from "@/lib/types";
import { IconClose, IconSparkle } from "@/components/icons";

interface CatchUpCardProps {
  /** null while the summary is still being written */
  summary: CatchUp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// The AI catch-up, laid over the table once the missed messages have played.
// Closing it leaves a small pill to bring it back.

export function CatchUpCard({ summary, open, onOpenChange }: CatchUpCardProps) {
  if (!open) {
    return (
      <button className="catchup-pill" onClick={() => onOpenChange(true)}>
        <IconSparkle size={14} /> Summary
      </button>
    );
  }

  return (
    <section className="catchup" aria-label="AI summary" aria-live="polite">
      <header className="catchup-head">
        <span className="catchup-label">
          <IconSparkle /> AI summary
        </span>
        <span className="catchup-sub">while you were away</span>
        <button className="catchup-close" aria-label="Hide summary" onClick={() => onOpenChange(false)}>
          <IconClose size={16} />
        </button>
      </header>

      {summary ? (
        <>
          <p className="catchup-headline">{summary.headline}</p>
          <ul className="catchup-points">
            {summary.points.map((point, i) => (
              <li key={i} style={{ "--i": i } as React.CSSProperties}>
                {point}
              </li>
            ))}
          </ul>
          {summary.forYou && (
            <p className="catchup-you" style={{ "--i": summary.points.length } as React.CSSProperties}>
              <strong>For you</strong> {summary.forYou}
            </p>
          )}
        </>
      ) : (
        <div className="catchup-loading" aria-label="Summarizing what you missed">
          <i />
          <i />
          <i />
        </div>
      )}
    </section>
  );
}
