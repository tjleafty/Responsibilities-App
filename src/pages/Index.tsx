import React from 'react';
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { overskill } from "@/lib/auth";
import AppBrand from "@/components/AppBrand";
import { Target } from "lucide-react";

/**
 * Default Index page — public landing.
 *
 * INTENT: This is the **public face** of the app. It MUST render without any
 * `isAuthenticated()` checks or auto-redirects. Showing the landing page is
 * the correct behavior for:
 *   - Unauthenticated visitors discovering the app
 *   - SEO crawlers
 *   - Authenticated users who navigate to `/` (they should see the landing
 *     page and click through, NOT be silently teleported to /dashboard)
 *   - The OverSkill editor preview iframe (auto-injects auth tokens, but
 *     should still show the landing page so creators can edit/iterate)
 *
 * The AI MUST replace this file's CONTENT (hero text, features, CTA copy)
 * with app-specific marketing for each generated app. The structural
 * pattern — hero / features / CTA, no auth checks — should stay intact.
 *
 * For login-required internal tools (admin panels, dashboards-only apps),
 * the AI may opt-in to redirect logic here, but it's NOT the default.
 *
 * Apr 2026 (revert): previous "smart redirect" version (commits 6ac4d1dc1,
 * 2de0ba7cb, f83a4063a) auto-navigated authed users to /dashboard, which
 * meant nobody ever saw the landing page in preview or production. Reverted
 * to the Overskill template's public marketing landing.
 */
export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          {/* Header brand mark — shows the uploaded logo automatically when
              VITE_APP_LOGO_URL is set; otherwise renders the wordmark exactly
              like the classic <h1>. Restyle/replace freely (see AppBrand). */}
          <AppBrand name="ChoreReward" icon={<Target className="h-5 w-5" />} className="text-lg font-semibold text-foreground" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button onClick={() => overskill.auth.login()} variant="default">
              Create account
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
          <Button size="lg" onClick={() => overskill.auth.login()}>
            Get Started Free
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/pricing">View the parent plan</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="#features">Learn More</Link>
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
        <Button size="lg" onClick={() => overskill.auth.login()}>
          Create your family profiles
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
