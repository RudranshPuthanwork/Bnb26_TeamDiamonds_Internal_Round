import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Accession,
  Actions,
  Button,
  DevFooter,
  DotLeaderList,
  Empty,
  ErrorNote,
  Footnote,
  Hash,
  LedgerTable,
  Loading,
  Page,
  Rule,
  ScreenHeader,
  Stamp,
  Timestamp,
} from '../ui';
import { mockApi, MOCK_VAULT_ID } from '../api/mockApi';
import type { AssetItem, Vault } from '../api/types';
import { COPY } from '../copy';

export const CollectionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [vault, setVault] = useState<Vault | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, a] = await Promise.all([
        mockApi.getVault(MOCK_VAULT_ID),
        mockApi.listAssets(MOCK_VAULT_ID),
      ]);
      setVault(v);
      setAssets(a);
    } catch {
      setError(COPY.states.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openItem = (accessionNumber: string) => {
    navigate(`/item/${encodeURIComponent(accessionNumber)}`);
  };

  if (loading) {
    return (
      <Page>
        <ScreenHeader title={COPY.header.defaultCollection} />
        <Loading />
        <DevFooter />
      </Page>
    );
  }

  if (error || !vault) {
    return (
      <Page>
        <ScreenHeader title={COPY.header.defaultCollection} />
        <ErrorNote
          message={error ?? COPY.states.error}
          action={<Button onClick={loadData}>{COPY.actions.retry}</Button>}
        />
        <DevFooter />
      </Page>
    );
  }

  const summaryItems = [
    { label: COPY.summary.owner, value: <Hash value={vault.owners[0]} /> },
    {
      label: COPY.summary.custodians,
      value: `${vault.guardians.length}, threshold ${vault.t}`,
    },
    { label: COPY.summary.items, value: assets.length },
    {
      label: COPY.summary.lastSigned,
      value: <Timestamp value="02 Oct 2026, 14:07 UTC" />,
    },
    { label: COPY.summary.epoch, value: vault.epoch },
    { label: COPY.summary.chain, value: 'Base Sepolia (84532)' },
  ];

  return (
    <Page>
      <ScreenHeader
        title={COPY.header.defaultCollection}
        links={
          <>
            <Link to="/guardians">{COPY.nav.guardians}</Link>
            <Link to="/changes">{COPY.nav.changes}</Link>
          </>
        }
      />

      <DotLeaderList items={summaryItems} />

      <Actions>
        <Button variant="primary" onClick={() => navigate('/item/new')}>
          {COPY.actions.catalogueItem}
        </Button>
      </Actions>

      {assets.length === 0 ? (
        <Empty
          message={COPY.states.empty}
          action={
            <Button variant="primary" onClick={() => navigate('/item/new')}>
              {COPY.actions.catalogueItem}
            </Button>
          }
        />
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
            {assets.map((item) => (
              <tr
                key={item.assetId}
                onClick={() => openItem(item.accessionNumber)}
              >
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
                <td>{Math.round(item.policy.window / 86400)} d</td>
                <td>
                  <Stamp status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </LedgerTable>
      )}

      <Rule />
      <Footnote />
      <DevFooter />
    </Page>
  );
};
