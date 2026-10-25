import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AppBrand from "@/components/AppBrand";
import { Target } from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <AppBrand name="ChoreReward" icon={<Target className="h-5 w-5" />} className="text-lg font-semibold text-foreground" />
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button variant="default" asChild>
              <Link to="/login?mode=signup">Create account</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6">
          Turn chores into a family quest.
        </h2>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          ChoreReward keeps responsibilities, profile handoffs, theme tiles, and family goals in one encouraging place.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild>
            <Link to="/login?mode=signup">Get Started Free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#features">Learn More</a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          <FeatureCard
            title="Profile-based handoffs"
            description="Parents and children choose a profile, theme, and secure four-digit PIN before they start their quest."
          />
          <FeatureCard
            title="Goals for every rhythm"
            description="Set daily, weekly, or monthly milestones for any parent or child in the household."
          />
          <FeatureCard
            title="Progress that feels personal"
            description="Each profile sees the theme and milestones that make the next win easy to spot."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h3 className="text-3xl font-bold text-foreground mb-4">Ready to get started?</h3>
        <p className="text-lg text-muted-foreground mb-8">
          Give every chore a home, then make the next win visible.
        </p>
        <Button size="lg" asChild>
          <Link to="/login?mode=signup">Create your family profiles</Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} ChoreReward. Family quests, made visible.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-left">
      <h4 className="text-lg font-semibold text-card-foreground mb-2">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
