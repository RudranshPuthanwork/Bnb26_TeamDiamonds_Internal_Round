import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Accession,
  Actions,
  Button,
  DotLeaderList,
  Empty,
  Hash,
  LedgerTable,
  Screen,
  StatusText,
  Timestamp,
} from '../ui';
import { api, getVaultId } from '../api';
import { fmtDateTime, formatSpan } from '../format';
import { useLoad } from '../hooks';
import { COPY } from '../copy';

export const CollectionScreen: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useLoad(async () => {
    const id = getVaultId();
    const [vault, assets, info] = await Promise.all([api.getVault(id), api.listAssets(id), api.getChainInfo()]);
    return { vault, assets, info };
  }, []);

  const open = (accession: string) => navigate(`/item/${encodeURIComponent(accession)}`);
  const addItem = (
    <Button variant="primary" onClick={() => navigate('/item/new')}>
      {COPY.actions.catalogueItem}
    </Button>
  );

  return (
    <Screen
      title={COPY.header.defaultCollection}
      loading={loading}
      error={error}
      onRetry={reload}
      block={data?.info.blockNumber}
    >
      {data && (
        <>
          <DotLeaderList
            items={[
              { label: COPY.summary.owner, value: <Hash value={data.vault.owners[0]} /> },
              { label: COPY.summary.custodians, value: `${data.vault.guardians.length}, threshold ${data.vault.t}` },
              { label: COPY.summary.items, value: data.assets.length },
              { label: COPY.summary.lastSigned, value: <Timestamp value={fmtDateTime(data.vault.lastHeartbeat)} /> },
              { label: COPY.summary.epoch, value: data.vault.epoch },
              { label: COPY.summary.chain, value: `${COPY.summary.chainName(data.info.chainId)} (${data.info.chainId})` },
            ]}
          />

          <Actions>
            {addItem}
            <Link to="/create">{COPY.nav.create}</Link>
          </Actions>

          {data.assets.length === 0 ? (
            <Empty message={COPY.states.empty} action={addItem} />
          ) : (
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
                {data.assets.map((item) => (
                  <tr key={item.assetId} onClick={() => open(item.accessionNumber)}>
                    <td>
                      <Accession number={item.accessionNumber} />
                    </td>
                    <td>
                      <Link
                        to={`/item/${encodeURIComponent(item.accessionNumber)}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td>{item.contents}</td>
                    <td>
                      {item.policy.kAttest} of {item.quorumOf}
                    </td>
                    <td>{formatSpan(item.policy.window)}</td>
                    <td>
                      <StatusText status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </LedgerTable>
          )}
        </>
      )}
    </Screen>
  );
};
