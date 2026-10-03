import { useEffect } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { rpcUrl, usesCustomRpc } from '../lib/chain.ts';
import { Shield } from './Icons.tsx';

export const REPO_URL = 'https://github.com/aralroca/agent-escrow';

const NAV = [
  { to: '/?section=how', label: 'Protocol' },
  { to: '/?section=verify', label: 'Verification' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/agents', label: 'Agents' },
  { to: '/developers', label: 'Developers' },
];

const FOOTER = [
  {
    title: 'Product',
    links: [
      { to: '/?section=how', label: 'How it works' },
      { to: '/?section=verify', label: 'Verification' },
      { to: '/?section=reputation', label: 'Reputation' },
      { to: '/?section=pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'App',
    links: [
      { to: '/jobs', label: 'Jobs' },
      { to: '/agents', label: 'Discover agents' },
      { to: '/security', label: 'Security notes' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { to: '/developers', label: 'MCP server' },
      { to: '/developers?section=sdk', label: 'TypeScript SDK' },
      { to: '/developers?section=spec', label: 'Acceptance spec' },
    ],
  },
];

function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/" className={`logo ${inverted ? 'logo-inverted' : ''}`}>
      <span className="logo-mark">
        <Shield size={16} />
      </span>
      Agent Escrow
    </Link>
  );
}

/**
 * Section links all point at the home page, so they only count as current when their own section
 * is the one in the URL. Page links also cover their sub-pages, like a job under Jobs.
 */
function isCurrent(to: string, pathname: string, search: string): boolean {
  return to.includes('?') ? to === pathname + search : pathname.startsWith(to);
}

function Header() {
  const { pathname, search } = useLocation();

  return (
    <header className="header">
      <nav className="container header-inner" aria-label="Main">
        <Logo />
        <div className="header-links">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isCurrent(item.to, pathname, search) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="row header-actions">
          <a className="btn btn-outline header-github" href={REPO_URL}>
            GitHub
          </a>
          <Link className="btn" to="/jobs">
            Live jobs
          </Link>
        </div>
      </nav>
    </header>
  );
}

function FooterColumn({ title, links }: (typeof FOOTER)[number]) {
  return (
    <nav className="stack footer-column" aria-label={title}>
      <span className="footer-title">{title}</span>
      {links.map((link) => (
        <Link key={link.label} to={link.to}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-top">
          <div className="stack footer-brand">
            <Logo inverted />
            <p>
              USDC escrow for agent-to-agent work on Solana. Payment releases when the acceptance
              test passes.
            </p>
            <Link className="footer-command mono" to="/developers">
              npx agent-escrow-mcp
            </Link>
          </div>
          {FOOTER.map((column) => (
            <FooterColumn key={column.title} {...column} />
          ))}
        </div>
        <div className="footer-bottom">
          <span>
            © 2026 Agent Escrow. Open source on <a href={REPO_URL}>GitHub</a>. Built for the Crypto
            World's Fair Hackathon.
          </span>
          <span className="footer-warning">
            <span className="footer-dot" />
            Devnet only. Not audited. Do not use with real funds.
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Scrolls to the element named by `?section=`, or to the top on a plain navigation. */
function useSectionScroll() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const section = params.get('section');

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new pathname must scroll to the top too
  useEffect(
    function scrollToSection() {
      const target = section ? document.getElementById(section) : null;

      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
    },
    [pathname, section],
  );
}

function CustomRpcNotice() {
  return (
    <p className="rpc-notice" role="note">
      This link makes the page read from <code>{rpcUrl}</code>, not from the default Solana
      endpoint. Only trust what you see if you trust that endpoint. <a href="./">Use the default</a>
    </p>
  );
}

export function Layout() {
  useSectionScroll();

  return (
    <>
      <Header />
      {usesCustomRpc && <CustomRpcNotice />}
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
