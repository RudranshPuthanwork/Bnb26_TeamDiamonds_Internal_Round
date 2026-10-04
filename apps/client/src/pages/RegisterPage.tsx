import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Accession, Button, Hash, LedgerTable, Rule, ScreenHeader, Stamp, Timestamp } from '../ui';
import { MOCK_ASSETS, MOCK_VAULT } from '../api/mockApi';
import { COPY } from '../copy';
import styles from './RegisterPage.module.css';

const summary: [string, React.ReactNode][] = [
  [COPY.summary.owner, <Hash value="0x4be1…07a9" />],
  [COPY.summary.custodians, `${MOCK_VAULT.guardians.length}, threshold ${MOCK_VAULT.t}`],
  [COPY.summary.items, MOCK_ASSETS.length],
  [COPY.summary.lastSigned, <Timestamp value="02 Oct 2026, 14:07 UTC" />],
  [COPY.summary.epoch, 12],
  [COPY.summary.chain, 'Base Sepolia (84532)'],
];

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const open = (n: string) => navigate(`/item/${encodeURIComponent(n)}`);

  return (
    <div className={styles.page}>
      <ScreenHeader title={COPY.header.defaultCollection} />

      <dl className={styles.summary}>
        {summary.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <span className={styles.leader} aria-hidden="true" />
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.action}>
        <Button variant="primary">{COPY.actions.catalogueItem}</Button>
      </div>

      <LedgerTable>
        <thead>
          <tr>
            <th>{COPY.table.accession}</th>
            <th>{COPY.table.item}</th>
            <th>{COPY.table.contents}</th>
            <th>{COPY.table.quorum}</th>
            <th>{COPY.table.window}</th>
            <th>{COPY.table.status}</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_ASSETS.map((item) => (
            <tr key={item.assetId} onClick={() => open(item.accessionNumber)}>
              <td><Accession number={item.accessionNumber} /></td>
              <td>
                <Link to={`/item/${encodeURIComponent(item.accessionNumber)}`} onClick={(e) => e.stopPropagation()}>
                  {item.title}
                </Link>
              </td>
              <td>{item.contents}</td>
              <td>{item.policy.kAttest} of {item.quorumOf}</td>
              <td>{Math.round(item.policy.window / 86400)} d</td>
              <td><Stamp status={item.status} /></td>
            </tr>
          ))}
        </tbody>
      </LedgerTable>

      <Rule />
      <p className={styles.footnote}>{COPY.brand.sampleNotice}</p>

      {import.meta.env.DEV && (
        <footer className={styles.devLinks}>
          <Link to="/dev/states">{COPY.nav.devStates}</Link>
          <Link to="/dev/tokens">{COPY.nav.devTokens}</Link>
        </footer>
      )}
    </div>
  );
};
