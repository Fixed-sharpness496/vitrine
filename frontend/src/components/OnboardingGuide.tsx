"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "vitrine_onboarding_done";

const STEPS = [
  {
    title: "Bienvenue sur Vitrine",
    body: "Vitrine est un moteur d'intelligence produit alimenté par l'IA. Il analyse 29 000 articles de mode et génère des insights en temps réel.",
    icon: "✦",
    cta: "Découvrir →",
  },
  {
    title: "Recherche sémantique",
    body: "Décris ce que tu cherches en langage naturel (ex. \"slim jeans under $80\", \"summer dress\") et le moteur retrouve les produits les plus proches par similarité vectorielle.",
    icon: "⌕",
    cta: "Suivant →",
  },
  {
    title: "Clusters produits",
    body: "L'algorithme HDBSCAN regroupe automatiquement les produits en 603 segments cohérents. Explore chaque cluster pour voir les articles et leurs prix moyens.",
    icon: "◎",
    cta: "Suivant →",
  },
  {
    title: "Analyse d'intention",
    body: "Décris le profil d'un acheteur (ex. \"jeune créateur de contenu urbain\") et le modèle GPT-4o-mini génère un brief d'achat ciblé par segment.",
    icon: "◈",
    cta: "Suivant →",
  },
  {
    title: "Analytics & Looker",
    body: "Visualise la distribution des clusters, les tendances de prix, la qualité des données et les performances de vente. Export vers Looker Studio disponible.",
    icon: "◱",
    cta: "C'est parti →",
  },
];

export default function OnboardingGuide() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10,10,10,0.55)",
          zIndex: 999,
          backdropFilter: "blur(2px)",
        }}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guide de démarrage Vitrine"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1000,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          width: "min(420px, calc(100vw - 32px))",
          padding: "36px 32px 28px",
        }}
      >
        {/* Progress dots */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? "var(--text)" : "var(--border-strong)",
                transition: "all 300ms",
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div
          className="mono mb-4"
          style={{ fontSize: 28, color: "var(--accent)" }}
          aria-hidden="true"
        >
          {current.icon}
        </div>

        {/* Content */}
        <h2
          className="display heading-tight mb-3"
          style={{ fontSize: 22, lineHeight: 1.2, color: "var(--text)" }}
        >
          {current.title}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65 }}>
          {current.body}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={dismiss}
            className="label-caps"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-faint)",
              padding: 0,
            }}
          >
            Passer
          </button>
          <button
            onClick={next}
            style={{
              background: "var(--text)",
              color: "var(--bg-surface)",
              border: "none",
              cursor: "pointer",
              padding: "10px 20px",
              fontSize: 13,
              fontFamily: "var(--font-ui)",
              letterSpacing: "0.02em",
              transition: "opacity 150ms",
            }}
            onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = "0.85")}
            onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = "1")}
          >
            {current.cta}
          </button>
        </div>
      </div>
    </>
  );
}
