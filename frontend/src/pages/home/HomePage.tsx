import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { Backdrop } from "./Backdrop";
import {
  AlertTriangleIcon,
  ArrowIcon,
  BarsIcon,
  BellIcon,
  ClipboardIcon,
  FetusGlyph,
  LogoMark,
  NewbornGlyph,
  NewbornIcon,
  PeopleIcon,
  StethoscopeIcon,
  UserIcon,
} from "./icons";
import { WombScene } from "./WombScene";
import "./home.css";

// Public Home Page (route "/"). Static marketing content: no API calls, so it renders with the
// backend down. "Doctor portal" leads into the working app at /dashboard.

const APP_ROUTE = "/dashboard";

/** Sets a CSS custom property such as the stagger index `--i` or delay `--d`. */
const vars = (v: Record<string, string | number>) => v as CSSProperties;

const NAV = [
  ["Platform", "#platform"],
  ["How it works", "#journey"],
  ["For specialists", "#alerts"],
] as const;

const MILESTONES = [
  { name: "1st trimester", range: "(1–12 weeks)", size: 0.72 },
  { name: "2nd trimester", range: "(13–27 weeks)", size: 0.86 },
  { name: "3rd trimester", range: "(28–40 weeks)", size: 1 },
  { name: "Birth & newborn", range: "(0–28 days)", size: 1 },
] as const;

/** Adds `.in` to every [data-rv] element the first time it scrolls into view (CSS does the rest). */
function useRevealOnScroll(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const items = root.current?.querySelectorAll<HTMLElement>("[data-rv]") ?? [];
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          io.unobserve(e.target);
        }),
      { threshold: 0.3 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root]);
}

function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="nav" aria-label="Main">
      <Link to="/" className="brand" aria-label="Ona-Bola Signal, home">
        <LogoMark />
        <span className="brand-word">
          ona-bola<b>signal</b>
        </span>
      </Link>
      <span className="brand-sub">
        Maternal &amp; Perinatal
        <br />
        Monitoring Platform
      </span>
      <button
        type="button"
        className="burger"
        aria-expanded={open}
        aria-controls="home-links"
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
      >
        <i />
        <i />
        <i />
      </button>
      <div id="home-links" className={`nav-links${open ? " open" : ""}`}>
        {NAV.map(([label, href], i) => (
          <a key={href} href={href} style={vars({ "--i": i })} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
      </div>
      <Link to={APP_ROUTE} className="btn-portal">
        <UserIcon />
        Doctor portal
        <ArrowIcon className="arrow" />
      </Link>
    </nav>
  );
}

function Hero() {
  return (
    <header className="hero">
      <Nav />
      <div className="hero-copy">
        <h1>
          <span className="line">
            <span className="w" style={vars({ "--i": 0 })}>
              Every
            </span>{" "}
            <span className="w" style={vars({ "--i": 1 })}>
              pregnancy
            </span>
          </span>{" "}
          <span className="line">
            <span className="w" style={vars({ "--i": 2 })}>
              deserves
            </span>{" "}
            <span className="w" style={vars({ "--i": 3 })}>
              a
            </span>{" "}
            <span className="hl">
              <span className="w" style={vars({ "--i": 4 })}>
                closer
              </span>{" "}
              <span className="w" style={vars({ "--i": 5 })}>
                watch.
              </span>
            </span>
          </span>
        </h1>
        <p className="lead">
          A smart monitoring platform that connects care teams,
          <br className="desk-br" /> tracks maternal and fetal health, and spots changing
          <br className="desk-br" /> health signals earlier.
        </p>
        <div className="ctas">
          <a href="#platform" className="btn btn-primary">
            Explore the platform
            <ArrowIcon className="arrow" />
          </a>
          <Link to={APP_ROUTE} className="btn btn-ghost">
            <StethoscopeIcon />
            For healthcare professionals
          </Link>
        </div>
        <ul className="pills">
          <li style={vars({ "--i": 0 })}>
            <PeopleIcon />
            Maternal care
          </li>
          <li style={vars({ "--i": 1 })}>
            <NewbornIcon />
            Newborn care
          </li>
          <li style={vars({ "--i": 2 })}>
            <BarsIcon />
            Risk monitoring
          </li>
        </ul>
      </div>
      <WombScene />
    </header>
  );
}

function Strip() {
  return (
    <div className="strip-row" data-rv>
      <i className="strip-line left" />
      <p className="strip">
        <span>Connected care</span>
        <i className="strip-dot" />
        <span>Clear signals</span>
        <i className="strip-dot" />
        <span>Timely follow-up</span>
      </p>
      <i className="strip-line right" />
    </div>
  );
}

function Features() {
  const rows = [
    ["#7fc4a2", 0],
    ["#f4c15d", 1],
    ["#e8645a", 2],
  ] as const;
  const zones = [
    ["green", "Green — low risk"],
    ["yellow", "Yellow — monitor"],
    ["red", "Red — high risk"],
  ] as const;
  return (
    <section id="platform" className="features" aria-label="Platform">
      <article className="fc" data-rv>
        <ClipboardIcon className="fc-icon" />
        <div className="fc-text">
          <h2>Perinatal registry</h2>
          <p>A unified registry of pregnant women and newborns with complete care history.</p>
        </div>
        <div className="mini reg" aria-hidden="true">
          {rows.map(([color, i]) => (
            <div key={color} className="reg-row" style={vars({ "--i": i })}>
              <UserIcon />
              <i className="reg-bar" />
              <i className="reg-tag" style={{ background: color }} />
            </div>
          ))}
        </div>
      </article>

      <article className="fc" data-rv style={vars({ "--d": "120ms" })}>
        <BarsIcon className="fc-icon" />
        <div className="fc-text">
          <h2>Risk zones</h2>
          <p>
            Automatic risk assessment with Green, Yellow and Red zones based on clinical rules and
            health dynamics.
          </p>
        </div>
        <div className="mini zones" aria-hidden="true">
          {zones.map(([tone, label], i) => (
            <span key={tone} className={`zone ${tone}`} style={vars({ "--i": i })}>
              <i />
              {label}
            </span>
          ))}
        </div>
      </article>

      <article id="alerts" className="fc" data-rv style={vars({ "--d": "240ms" })}>
        <BellIcon className="fc-icon bell" />
        <div className="fc-text">
          <h2>Timely alerts</h2>
          <p>Instant notifications to responsible specialists when health indicators worsen.</p>
        </div>
        <div className="mini alert" aria-hidden="true">
          <div className="alert-card">
            <AlertTriangleIcon />
            <div>
              <b>Risk increase</b>
              <small>Patient ID: OB-1042</small>
            </div>
          </div>
          <i className="skeleton" />
          <i className="skeleton short" />
        </div>
      </article>
    </section>
  );
}

function Journey() {
  return (
    <section id="journey" className="journey" data-rv aria-label="The journey of pregnancy">
      <h2>
        The journey <br />
        of pregnancy
      </h2>
      <ol>
        {MILESTONES.map((m, i) => (
          <li
            key={m.name}
            className={i === MILESTONES.length - 1 ? "last" : undefined}
            style={vars({ "--i": i })}
          >
            <span className="orb">
              {i === MILESTONES.length - 1 ? <NewbornGlyph /> : <FetusGlyph size={m.size} />}
            </span>
            {i < MILESTONES.length - 1 ? <i className="link" /> : null}
            <b>{m.name}</b>
            <small>{m.range}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomePage() {
  const root = useRef<HTMLDivElement>(null);
  useRevealOnScroll(root);

  useEffect(() => {
    const previous = document.title;
    document.title = "Ona-Bola Signal — Maternal & Perinatal Monitoring Platform";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="home" lang="en" ref={root}>
      <Backdrop />
      <div className="canvas">
        <Hero />
        <Strip />
        <Features />
        <Journey />
      </div>
    </div>
  );
}
