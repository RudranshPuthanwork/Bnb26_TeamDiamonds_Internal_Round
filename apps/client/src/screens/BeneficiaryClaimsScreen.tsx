import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Accession, Empty, LedgerTable, Screen, StatusText } from '../ui';
import { api, getVaultId } from '../api';
import { useLoad } from '../hooks';
import { COPY } from '../copy';

export const BeneficiaryClaimsScreen: React.FC = () => {
  const navigate = useNavigate();
  const c = COPY.claims;
  const { data, loading, error, reload } = useLoad(async () => {
    const items = await api.listClaims(getVaultId());
    const progress = await Promise.all(items.map((i) => api.getClaimProgress(i.vaultId, i.assetId)));
    return items.map((item, k) => ({ item, step: progress[k]?.step ?? 'waiting' }));
  }, []);

  return (
    <Screen title={c.pageTitle} loading={loading} error={error} onRetry={reload}>
      {!data || data.length === 0 ? (
        <Empty message={c.empty} />
      ) : (
        <LedgerTable>
          <thead>
            <tr>
              <th>{c.colAccession}</th>
              <th>{c.colItem}</th>
              <th>{c.colStatus}</th>
              <th>{c.colProgress}</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ item, step }) => (
              <tr key={item.assetId} onClick={() => navigate(`/b/${encodeURIComponent(item.accessionNumber)}`)}>
                <td>
                  <Accession number={item.accessionNumber} />
                </td>
                <td>
                  <Link to={`/b/${encodeURIComponent(item.accessionNumber)}`} onClick={(e) => e.stopPropagation()}>
                    {item.title}
                  </Link>
                </td>
                <td>
                  <StatusText status={item.status} />
                </td>
                <td>{c.progress[step]}</td>
              </tr>
            ))}
          </tbody>
        </LedgerTable>
      )}
    </Screen>
  );
};
