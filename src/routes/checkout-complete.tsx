// PLATFORM-MANAGED: /checkout/complete — the canonical post-purchase landing.
//
// This is the page the WhopCheckoutEmbed's `returnUrl` points at
// (`${window.location.origin}/checkout/complete`) AND where CheckoutDialog's
// default onComplete navigates. Register it as a PUBLIC route (the buyer is
// anonymous when they land here) — App.tsx already does this; DO NOT recreate
// this file or add a second `/checkout/complete` route.
//
// WHY THIS EXISTS (bolt-buy QA, app 10685, Jun 2026 — the post-purchase auth
// seam bug, 7 consecutive failed daily QA runs): an anonymous buyer completed
// a $0 test-mode checkout and was dumped straight onto a BARE OAuth sign-in
// page (`/auth/<token>/sign_in`) with:
//   1. no purchase-confirmation messaging, and
//   2. an EMPTY email field (the captured checkout email was never threaded).
// Two prior fixes (#1652 prefill, #1660 returnUrl) never engaged because the
// template shipped NO `/checkout/complete` route at all — the returnUrl
// pointed at a 404, and the in-SPA onComplete blind-navigated to /login.
//
// This route closes the seam: it shows the buyer their purchase succeeded,
// resolves the checkout email, and bridges into the purchase → login/signup →
// access flow (payments-basics Section 2b) with that email prefilled so the
// platform reconciles the purchase to the new account by email match.

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAuth, waitForAppAccess } from "@/lib/auth";
import { pollWalletBalanceUntilChanged } from "@/hooks/useWalletBalance";
import {
  clearPurchaseConfirming,
  markPurchaseConfirming,
} from "@/lib/purchase-confirmation";
import {
  captureCheckoutReceiptFromParams,
  chargeDeferredWhopBumps,
  claimPurchase,
  postPurchaseRedirect,
  resolveCheckoutEmail,
  resolvePostPurchaseDestination,
} from "@/lib/whop";

export default function CheckoutCompletePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [params] = useSearchParams();

  // Whop appends ?status=success|error to the returnUrl redirect. Success is
  // the default (the in-SPA onComplete path sets it explicitly).
  const status = params.get("status");
  const isError = status === "error";

  // Where to send the buyer after they sign in / create their account. The
  // destination is auth-gated, so a signed-out buyer flows through
  // login/signup first (postPurchaseRedirect handles that).
  //
  // Prefer the explicit ?redirect= the in-SPA onComplete carried. When Whop's
  // raw returnUrl top-redirect lands here with only ?status= (no redirect
  // param), resolve the app's REAL primary surface via
  // resolvePostPurchaseDestination (VITE_POST_LOGIN_ROUTE, else /dashboard) so
  // the buyer doesn't dead-end on a placeholder /dashboard (#2524).
  const destination = params.get("redirect") || resolvePostPurchaseDestination();

  const [resolvedEmail, setResolvedEmail] = useState<string | undefined>(undefined);

  // Post-purchase confirmation state for the signed-IN buyer (ticket
  // OS-C7KWQF). "confirming" = we are waiting on the entitlement the payment
  // just bought; "slow" = it did not land inside the bounded window, so we
  // reassure instead of routing into a gate that would show a paywall.
  const [confirmPhase, setConfirmPhase] = useState<"idle" | "confirming" | "slow">(
    "idle"
  );

  // Continue into purchase → login/signup → access. Signed-IN buyer goes
  // straight to the (auth-gated) destination; signed-OUT buyer is routed to
  // /login with the checkout email prefilled so the purchase reconciles by
  // email match.
  const proceed = useCallback(
    (email?: string) => {
      postPurchaseRedirect(navigate, user, { destination, email });
    },
    [navigate, user, destination]
  );

  useEffect(() => {
    // Error path: no charge was made — don't auto-route anywhere; let the
    // buyer read the message and choose to try again.
    if (isError || loading) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Stash the receipt if the provider's redirect carried one. This is the
    // proof of purchase the built-in claim spends — a signed-OUT buyer can't
    // spend it yet, so it has to survive the trip through login/signup (the
    // same reason the checkout email is stashed).
    captureCheckoutReceiptFromParams(params);

    // Open the post-purchase confirmation window (ticket OS-C7KWQF) BEFORE any
    // navigation. This is the flag every downstream gate reads to decide
    // "confirming" instead of "must buy", so it has to be set while we still
    // know a payment just happened — including on the signed-OUT path, where
    // the gate that used to show the paywall is the destination the buyer
    // reaches minutes later, after the whole OAuth signup round-trip.
    if (status === "success") {
      markPurchaseConfirming();
    }

    // Bridge the wallet-SEED lag: buyer credit wallets are seeded by the
    // AppMembership activation webhook, which can trail this post-purchase
    // redirect by a few seconds. A bounded re-poll (auto-stops on the first
    // balance/plan change, or after ~20s) makes the AI-credits counter reflect
    // the new plan without any tight polling — no-op on apps without wallets.
    // Fires for the signed-IN buyer (a signed-out buyer has no wallet to read
    // until they finish signup, at which point the fresh mount reads it).
    if (status === "success" && user) {
      pollWalletBalanceUntilChanged();
    }

    (async () => {
      // Model B: a 3DS full-page redirect lands here before the in-page bump
      // follow-up. Charge stashed selected bumps first. A miss must not hide
      // the already-paid primary — claim and access still proceed.
      if (status === "success") {
        try {
          await chargeDeferredWhopBumps();
        } catch (error) {
          console.error("[checkout-complete] deferred bump charge failed:", error);
        }
      }

      // Email resolution order:
      //   1. Explicit `?email=` on the success return URL. The provider (or a
      //      receipt/return link) can carry the buyer's checkout email in the
      //      query string. The `/login` route already reads `?email=` and
      //      forwards it as the OAuth `login_hint`; honoring it here too makes
      //      this route SYMMETRIC with `/login` so the email isn't dropped at
      //      the first hop when sessionStorage capture is absent (e.g. a buyer
      //      who landed here via a shared/return link rather than the in-SPA
      //      <WhopCheckoutEmbed> onIdentityCaptured path).
      //   2. resolveCheckoutEmail — sessionStorage capture (the normal in-SPA
      //      purchase path) then async server-side receipt lookup. NEVER throws;
      //      null means "no email resolvable", in which case the plain login
      //      flow still claims by email if the buyer signs up with the same
      //      address.
      // Security note: this email is DISPLAY-ONLY prefill of an editable field
      // (see PrefillsAuthEmail server-side). It authenticates nothing and grants
      // nothing — access comes only from MembershipClaimService matching a
      // completed signup (real password + confirmation) to an existing
      // entitlement by email. We only honor `?email=` on the success path
      // (`status === "success"`, already required for auto-advance) so the
      // confirmation copy can't be trivially deep-linked with an arbitrary
      // address. The server still re-sanitizes the value before reflecting it.
      const queryEmail = status === "success" ? params.get("email") || undefined : undefined;
      const email = queryEmail || (await resolveCheckoutEmail(params)) || undefined;
      if (cancelled) return;
      setResolvedEmail(email);

      if (user) {
        // Already signed in — start the claim, then wait for the entitlement
        // to be REAL before routing (ticket OS-C7KWQF).
        //
        // The claim itself is still deliberately NOT awaited: awaiting it put
        // the buyer's redirect behind a network call to the worker, so a slow
        // or hanging claim stranded a PAYING customer on the spinner.
        void claimPurchase();

        // What IS awaited is the app's own access decision, and only for as
        // long as it says "no". This is not the old un-bounded wait:
        //   - a PUBLIC app answers "allowed" on the first synchronous-ish
        //     check, so this adds ZERO delay to the common case
        //   - a `purchase_required` app is exactly the case that used to
        //     redirect the buyer into /purchase — the paywall for the thing
        //     they had just bought — because the destination was entered
        //     before the 1-2s grant landed
        //   - it is bounded, and it fails into an explicit "we have your
        //     payment" message rather than an indefinite spinner
        setConfirmPhase("confirming");
        const access = await waitForAppAccess();
        if (cancelled) return;

        if (access.allowed) {
          clearPurchaseConfirming();
          proceed(email);
        } else {
          setConfirmPhase("slow");
        }
      } else {
        // Signed-out: let the buyer SEE the confirmation for a beat, then
        // auto-advance to signup/login. The button below is the explicit
        // affordance and a fallback if the timer is interrupted.
        timer = setTimeout(() => proceed(email), 1600);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isError, loading, user, params, proceed]);

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Checkout didn&apos;t complete
          </h1>
          <p className="text-muted-foreground mb-6">
            No charge was made. You can head back and try again.
          </p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex justify-center items-center rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors w-full sm:w-auto"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-8 max-w-md w-full text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary mb-4" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Purchase confirmed
        </h1>

        {user ? (
          confirmPhase === "slow" ? (
            // The grant did not land inside the bounded window. Reassure and
            // offer a manual way in — NEVER route into a gate that would show
            // the buy CTA again (ticket OS-C7KWQF).
            <>
              <p className="text-muted-foreground mb-6">
                We have your payment. Unlocking your access is taking longer than
                usual — check your email for the confirmation and receipt, or try
                again in a moment. You have not been charged twice.
              </p>
              <button
                onClick={() => {
                  // Re-stamp before navigating. A buyer who sat on this screen
                  // longer than the confirming window would otherwise land on
                  // the destination with an EXPIRED marker — and get the
                  // paywall, which is precisely what must never happen to
                  // someone who has paid. An explicit action taken from a
                  // post-payment screen renews the grace period.
                  markPurchaseConfirming();
                  proceed(resolvedEmail);
                }}
                className="inline-flex justify-center items-center rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors w-full sm:w-auto"
              >
                Continue to your account
              </button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-6">
                You&apos;re all set — unlocking your access now.
              </p>
              <div className="flex items-center justify-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Confirming your purchase…
              </div>
            </>
          )
        ) : (
          <>
            <p className="text-muted-foreground mb-6">
              Create your account (or sign in) to access your purchase.
              {resolvedEmail
                ? " We’ll use the email you checked out with."
                : ""}
            </p>
            <button
              onClick={() => proceed(resolvedEmail)}
              className="inline-flex justify-center items-center rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors w-full sm:w-auto"
            >
              Create your account
            </button>
            <p className="text-muted-foreground/70 text-xs mt-4">
              Taking you there automatically…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
