import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhopElementsCheckout } from "@/components/WhopElementsCheckout";
import { useAuth } from "@/lib/auth";

const included = [
  "Create and assign recurring chores",
  "Track daily, weekly, and monthly progress",
  "Set rewards, goals, and parent verification",
  "Choose child-friendly royalty-free themes",
];

export default function Pricing() {
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = "ChoreReward Parent Plan";
    const description = "Give your family a clear, encouraging rhythm for chores, progress, goals, and rewards.";
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", description);
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            ChoreReward
          </Link>
          <span className="text-sm text-muted-foreground">Parent access</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <section className="space-y-8 lg:pt-8" aria-labelledby="pricing-heading">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              One simple family plan
            </p>
            <h1 id="pricing-heading" className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
              Make every completed chore feel like progress.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-muted-foreground">
              ChoreReward gives parents the tools to set clear responsibilities, celebrate follow-through, and make rewards feel achievable for every child.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {included.map((item) => (
              <div key={item} className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-sm leading-6 text-card-foreground">{item}</span>
              </div>
            ))}
          </div>

          {!loading && !user ? (
            <p className="text-sm text-muted-foreground">
              Already purchased?{" "}
              <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-lg sm:p-8" aria-labelledby="checkout-heading">
          <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="text-sm font-semibold text-primary">Parent monthly</p>
              <h2 id="checkout-heading" className="mt-2 font-display text-3xl font-bold text-card-foreground">
                $10<span className="text-base font-medium text-muted-foreground"> / month</span>
              </h2>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              Cancel anytime
            </span>
          </div>

          <WhopElementsCheckout planId={import.meta.env.VITE_PLAN_PARENT_MONTHLY} />

          <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
            Secured checkout for your family plan. Your access continues monthly until you cancel.
          </p>

          <Button variant="outline" size="sm" asChild className="mt-6 w-full">
            <Link to="/">Back to ChoreReward</Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
