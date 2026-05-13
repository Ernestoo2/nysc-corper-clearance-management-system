import { cn } from "@/lib/utils";

type RouteLoadingProps = {
  label?: string;
  className?: string;
};

/** Sonner-adjacent: popover card, ring shadow, dual counter-rotating rings (Loader2-style motion). */
export function RouteLoading({ label = "Loading", className }: RouteLoadingProps) {
  return (
    <div
      className={cn(
        "flex min-h-[50vh] flex-col items-center justify-center bg-linear-to-b from-slate-50 via-white to-slate-50/90 px-6 py-12",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div
        className={cn(
          "flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-border/80 bg-popover/95 p-10 text-center",
          "shadow-[0_8px_30px_rgb(0,0,0,0.06),0_2px_8px_rgb(31,78,121,0.08)]",
          "ring-1 ring-foreground/5 backdrop-blur-sm",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200"
        )}
      >
        <div className="relative size-18 shrink-0">
          <div
            className="absolute inset-0 rounded-full border-2 border-muted border-t-[#1F4E79] border-r-[#1F4E79]/40 motion-safe:animate-spin motion-reduce:animate-none"
            style={{ animationDuration: "0.75s" }}
          />
          <div
            className="absolute inset-2 rounded-full border-2 border-muted border-b-[#F4B400] border-l-[#F4B400]/50 motion-safe:animate-spin motion-reduce:animate-none"
            style={{ animationDuration: "1.05s", animationDirection: "reverse" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="size-2.5 rounded-full bg-[#1F4E79] motion-safe:animate-pulse motion-reduce:animate-none" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium tracking-tight text-popover-foreground">{label}</p>
          <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "size-1.5 rounded-full bg-[#1F4E79]/75 motion-safe:animate-bounce motion-reduce:animate-none",
                  i === 1 && "delay-150",
                  i === 2 && "delay-300"
                )}
                style={{ animationDuration: "0.55s" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
