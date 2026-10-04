import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import styles from './AppHeader.module.css';
import { COPY } from '../copy';
import { api, DEFAULT_VAULT_ID } from '../api';
import { ROLE_HOME, useRole, type RoleName } from '../role';

const audit = { to: `/audit/${DEFAULT_VAULT_ID}`, label: COPY.nav.audit };

const LINKS: Record<RoleName, { to: string; label: string; end?: boolean }[]> = {
  owner: [
    { to: '/', label: COPY.nav.collection, end: true },
    { to: '/guardians', label: COPY.nav.guardians },
    { to: '/changes', label: COPY.nav.changes },
    audit,
  ],
  guardian: [{ to: '/g', label: COPY.nav.notices, end: true }, audit],
  beneficiary: [{ to: '/b', label: COPY.nav.claims, end: true }, audit],
};

const DevMenu: React.FC = () => {
  const { role, setRole } = useRole();
  const navigate = useNavigate();
  const [failNext, setFailNext] = React.useState(api.isFailNextWrite());
  return (
    <details className={styles.dev}>
      <summary>{COPY.nav.dev}</summary>
      <div className={styles.devPanel}>
        <div className={styles.devGroup}>
          {(Object.keys(LINKS) as RoleName[]).map((r) => (
            <button
              key={r}
              type="button"
              className={r === role ? styles.devActive : styles.devBtn}
              onClick={() => {
                setRole(r);
                navigate(ROLE_HOME[r]);
              }}
            >
              {COPY.roles[r]}
            </button>
          ))}
        </div>
        <Link to="/dev/states">{COPY.nav.devStates}</Link>
        <Link to="/dev/tokens">{COPY.nav.devTokens}</Link>
        <button
          type="button"
          className={failNext ? styles.devActive : styles.devBtn}
          title={COPY.dev.toggleNotice}
          onClick={() => setFailNext(api.toggleFailNextWrite())}
        >
          {failNext ? COPY.dev.failNextOn : COPY.dev.failNextOff}
        </button>
      </div>
    </details>
  );
};

export const AppHeader: React.FC = () => {
  const { role } = useRole();
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to={ROLE_HOME[role]} className={styles.wordmark}>
          {COPY.brand.name}
        </Link>
        <nav className={styles.links}>
          {LINKS[role].map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? styles.active : styles.link)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.right}>
          <span className={styles.role}>{COPY.roles[role]}</span>
          {import.meta.env.DEV && <DevMenu />}
        </div>
      </div>
    </header>
  );
};
