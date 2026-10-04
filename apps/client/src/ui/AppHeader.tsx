import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import styles from './AppHeader.module.css';
import { COPY } from '../copy';
import { api, chainClient, getVaultId, setVaultId } from '../api';
import { ROLE_HOME, useRole, type RoleName } from '../role';
import { describeError } from '../errors';
import { advanceTime } from '../dev/timeControl';
import { seedDemoCollection } from '../dev/seed';

const links = (role: RoleName) => {
  const audit = { to: `/audit/${getVaultId()}`, label: COPY.nav.audit };
  return {
  owner: [
    { to: '/', label: COPY.nav.collection, end: true },
    { to: '/guardians', label: COPY.nav.guardians },
    { to: '/changes', label: COPY.nav.changes },
    audit,
  ],
  guardian: [{ to: '/g', label: COPY.nav.notices, end: true }, audit],
  beneficiary: [{ to: '/b', label: COPY.nav.claims, end: true }, audit],
  }[role] as { to: string; label: string; end?: boolean }[];
};

const ROLES: RoleName[] = ['owner', 'guardian', 'beneficiary'];

const ADVANCE: { label: string; seconds: number }[] = [
  { label: COPY.dev.advanceHour, seconds: 3600 },
  { label: COPY.dev.advanceDay, seconds: 86400 },
  { label: COPY.dev.advanceWeek, seconds: 7 * 86400 },
  { label: COPY.dev.advanceMonth, seconds: 30 * 86400 },
];

/** Dev builds only. Role switcher, dev pages, failure toggle, and (on anvil) time and seed controls. */
const DevMenu: React.FC = () => {
  const { role, setRole } = useRole();
  const navigate = useNavigate();
  const [failNext, setFailNext] = React.useState(api.isFailNextWrite());
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [guardian, setGuardian] = React.useState(() => Number(localStorage.getItem('heirloom.dev.guardian') ?? 1));
  const [seconds, setSeconds] = React.useState(86400);
  const onAnvil = chainClient?.cfg.chainId === 31337;

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setNote('');
    try {
      await fn();
      setNote(done);
      navigate(0);
    } catch (e) {
      setNote(describeError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className={styles.dev}>
      <summary>{COPY.nav.dev}</summary>
      <div className={styles.devPanel}>
        <div className={styles.devGroup}>
          {ROLES.map((r) => (
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
        {chainClient && (
          <label className={styles.devRow}>
            {COPY.dev.guardianLabel}
            <select
              value={guardian}
              onChange={(e) => {
                const n = Number(e.target.value);
                setGuardian(n);
                localStorage.setItem('heirloom.dev.guardian', String(n));
                chainClient!.setGuardianNumber(n);
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
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
        {onAnvil && chainClient && (
          <>
            <div className={styles.devRow}>
              <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
                {ADVANCE.map((a) => (
                  <option key={a.seconds} value={a.seconds}>
                    {a.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.devBtn}
                disabled={busy}
                onClick={() => run(() => advanceTime(chainClient!, seconds), COPY.dev.advanced)}
              >
                {COPY.dev.advance}
              </button>
            </div>
            <button
              type="button"
              className={styles.devBtn}
              disabled={busy}
              onClick={() => run(async () => setVaultId(await seedDemoCollection(chainClient!)), COPY.dev.seeded)}
            >
              {COPY.dev.seed}
            </button>
          </>
        )}
        {busy && <span>{COPY.tx.pending}</span>}
        {note && <span>{note}</span>}
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
          {links(role).map((l) => (
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
