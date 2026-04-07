import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSignedInRedirectPath } from "@/lib/auth/redirect";
import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";

export default async function LandingPage() {
  const { userId } = await auth();
  const locale = await getCurrentLocale();
  const m = getMessages(locale);

  if (userId) {
    redirect(await getSignedInRedirectPath(userId));
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">{m.common.appName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-md px-4 py-2 text-sm hover:bg-secondary"
            >
              {m.landing.signInTenant}
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {m.landing.signInLandlord}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pb-20 pt-32">
        <div className="mx-auto max-w-6xl text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium">
              {m.landing.badge}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              {m.landing.heroPrefix}{" "}
              <span className="bg-gradient-to-r from-green-500 to-blue-500 bg-clip-text text-transparent">
                {m.landing.heroHighlight}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {m.landing.heroDescription}
            </p>
          </div>

          {/* Two big entry cards */}
          <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
            <Link href="/sign-in" className="group">
              <div className="h-full rounded-2xl border border-border bg-card p-8 text-left transition-all hover:border-blue-400 hover:shadow-lg">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500">
                  <svg
                    className="h-7 w-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold">{m.landing.tenantTitle}</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {m.landing.tenantDescription}
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-primary transition-all group-hover:gap-3">
                  {m.landing.tenantCta}
                </div>
              </div>
            </Link>

            <Link href="/sign-in" className="group">
              <div className="h-full rounded-2xl border border-border bg-card p-8 text-left transition-all hover:border-green-400 hover:shadow-lg">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500">
                  <svg
                    className="h-7 w-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold">{m.landing.landlordTitle}</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {m.landing.landlordDescription}
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-primary transition-all group-hover:gap-3">
                  {m.landing.landlordCta}
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-secondary/30 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">
              {m.landing.featuresTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              {m.landing.featuresDescription}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {m.landing.features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-background p-6"
              >
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h3 className="text-3xl font-bold">{m.landing.ctaTitle}</h3>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          {m.landing.ctaDescription}
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-block rounded-lg bg-primary px-8 py-3 text-lg font-medium text-primary-foreground hover:bg-primary/90"
        >
          {m.landing.signUp}
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>{m.landing.footer}</p>
      </footer>
    </div>
  );
}
