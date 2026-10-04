import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Accession, Empty, LedgerTable, Screen, StatusText } from '../ui';
import { api, getVaultId } from '../api';
import { Reason, REASON_NAMES } from '../api/types';
import type { GuardianNotice } from '../api/types';
import { useLoad } from '../hooks';
import { COPY } from '../copy';

function mine(n: GuardianNotice): string {
  if (n.iSubmitted) return COPY.guardianNotices.mineShared;
  if (n.iDisputed) return COPY.guardianNotices.mineDisputed;
  if (n.myReason !== Reason.NONE) return COPY.guardianNotices.mineAttested(REASON_NAMES[n.myReason].toLowerCase());
  return COPY.guardianNotices.mineNone;
}

export const GuardianNoticesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useLoad(() => api.listGuardianNotices(getVaultId()), []);
  const c = COPY.guardianNotices;

  return (
    <Screen title={c.pageTitle} loading={loading} error={error} onRetry={reload}>
      <p>
        <Link to="/g/guide">{c.guideLink}</Link>
      </p>
      {!data || data.length === 0 ? (
        <Empty message={c.empty} />
      ) : (
        <LedgerTable>
          <thead>
            <tr>
              <th>{c.colAccession}</th>
              <th>{c.colItem}</th>
              <th>{c.colFiled}</th>
              <th>{c.colMine}</th>
              <th>{c.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((n) => (
              <tr key={n.assetId} onClick={() => navigate(`/g/${encodeURIComponent(n.accessionNumber)}`)}>
                <td>
                  <Accession number={n.accessionNumber} />
                </td>
                <td>
                  <Link to={`/g/${encodeURIComponent(n.accessionNumber)}`} onClick={(e) => e.stopPropagation()}>
                    {n.title}
                  </Link>
                </td>
                <td>{c.filed(n.filed, n.kAttest)}</td>
                <td>{mine(n)}</td>
                <td>
                  <StatusText status={n.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </LedgerTable>
      )}
    </Screen>
  );
};
