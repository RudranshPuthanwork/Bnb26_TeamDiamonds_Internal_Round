import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Actions,
  Button,
  Checklist,
  Empty,
  ErrorNote,
  Loading,
  Margin,
  Page,
  Rule,
  ScreenHeader,
} from '../ui';
import { api, getVaultId } from '../api';
import type { AssetItem } from '../api/types';
import { COPY } from '../copy';

export const RotateScreen: React.FC = () => {
  const { accession: rawAccession } = useParams<{ accession: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<AssetItem | null>(null);

  useEffect(() => {
    const decoded = decodeURIComponent(rawAccession ?? '');
    api
      .listAssets(getVaultId())
      .then((assets) => {
        const found = assets.find((a) => {
          const normDecoded = decoded.toLowerCase().trim();
          const normAcc = a.accessionNumber.toLowerCase().trim();
          return (
            normAcc === normDecoded ||
            normAcc.endsWith('/' + normDecoded) ||
            normAcc.replace(/^hl-\d+\//i, '') === normDecoded.replace(/^hl-\d+\//i, '') ||
            a.assetId.toLowerCase() === normDecoded
          );
        });
        setItem(found ?? null);
        setLoading(false);
      })
      .catch(() => {
        setError(COPY.states.error);
        setLoading(false);
      });
  }, [rawAccession]);

  if (loading) {
    return (
      <Page>
        <ScreenHeader title={COPY.rotate.pageTitle} />
        <Loading />
      </Page>
    );
  }

  if (error || !item) {
    return (
      <Page>
        <ScreenHeader title={COPY.rotate.pageTitle} />
        {error ? (
          <ErrorNote message={error} />
        ) : (
          <Empty
            message={COPY.itemDetail.notFound}
            action={
              <Button onClick={() => navigate('/')}>
                {COPY.itemDetail.returnLink}
              </Button>
            }
          />
        )}
      </Page>
    );
  }

  const steps = [
    {
      number: 1,
      title: COPY.rotate.step1Title,
      description: COPY.rotate.step1Desc,
    },
    {
      number: 2,
      title: COPY.rotate.step2Title,
      description: COPY.rotate.step2Desc,
    },
    {
      number: 3,
      title: COPY.rotate.step3Title,
      description: COPY.rotate.step3Desc,
    },
    {
      number: 4,
      title: COPY.rotate.step4Title,
      description: COPY.rotate.step4Desc,
    },
  ];

  return (
    <Page>
      <ScreenHeader
        title={COPY.rotate.pageTitle}
      />

      <Margin margin={COPY.rotate.marginLabel}>
        <p>{COPY.rotate.paragraph}</p>
      </Margin>

      <Checklist steps={steps} />

      <Actions>
        <Button
          variant="primary"
          onClick={() =>
            navigate(`/item/${encodeURIComponent(item.accessionNumber)}`)
          }
        >
          {COPY.rotate.doneBtn}
        </Button>
      </Actions>

      <Rule />
    </Page>
  );
};
