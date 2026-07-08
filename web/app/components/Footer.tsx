"use client";

import { GithubIcon, LinkedinIcon, MailIcon, GlobeIcon } from "./Icons";

const LINKS = [
  { href: "https://anthony-le.vercel.app/", icon: <GlobeIcon size={18} />, label: "Portfolio" },
  { href: "https://www.linkedin.com/in/anthony-hn-le/", icon: <LinkedinIcon size={18} />, label: "LinkedIn" },
  { href: "https://github.com/anthony-hn-le", icon: <GithubIcon size={18} />, label: "GitHub" },
  { href: "mailto:anthony.hn.le@gmail.com", icon: <MailIcon size={18} />, label: "Email" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        padding: "2rem 1.5rem",
        marginTop: "3rem",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div>
          <span className="mono" style={{ fontWeight: 700, fontSize: "1rem", color: "var(--accent-cyan)" }}>
            Anthony Le
          </span>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            © {year} · Limit Order Book Simulator
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.9rem" }}>
          {LINKS.map(({ href, icon, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-cyan)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              {icon}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
