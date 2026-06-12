/**
 * Admin settings page: preview the content-model diff and apply it (dev-mode only).
 * Uses the Strapi admin fetch client to call the plugin's /preview and /apply routes.
 *
 * This file is bundled by the Strapi plugin toolchain; it is intentionally excluded
 * from this package's tsc build (React + admin SDK are provided by the host Strapi).
 */
import { useFetchClient } from '@strapi/strapi/admin';
import { Box, Button, Flex, Typography } from '@strapi/design-system';
import * as React from 'react';

interface PreviewResult {
  diff: string;
  warnings: string[];
  errors: string[];
  hasChanges: boolean;
  devMode: boolean;
  written?: string[];
}

const BASE = '/strapi-content-helper';

export default function SyncPage(): JSX.Element {
  const { get, post } = useFetchClient();
  const [state, setState] = React.useState<PreviewResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [prune, setPrune] = React.useState(false);
  const [force, setForce] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await get(`${BASE}/preview`);
      setState(data as PreviewResult);
    } finally {
      setBusy(false);
    }
  }, [get]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const apply = async () => {
    setBusy(true);
    try {
      const { data } = await post(`${BASE}/apply`, { prune, force });
      setState(data as PreviewResult);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box padding={8}>
      <Typography variant="alpha">Sync content model</Typography>
      <Box paddingTop={4} paddingBottom={4}>
        <Typography variant="omega">
          Generate Strapi schema from your frontend code. Restart Strapi after applying.
        </Typography>
      </Box>

      {state && !state.devMode && (
        <Box paddingBottom={4}>
          <Typography textColor="danger600">
            Sync is disabled in production. Use the CLI in CI and deploy the committed schema files.
          </Typography>
        </Box>
      )}

      <Flex gap={2} paddingBottom={4}>
        <Button variant="secondary" onClick={refresh} loading={busy}>
          Refresh preview
        </Button>
        <Button
          onClick={apply}
          loading={busy}
          disabled={!state?.devMode || !state?.hasChanges}
        >
          Apply
        </Button>
        <label>
          <input type="checkbox" checked={prune} onChange={(e) => setPrune(e.target.checked)} /> prune
        </label>
        <label>
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> force
        </label>
      </Flex>

      {state?.errors?.length ? (
        <Box paddingBottom={4}>
          {state.errors.map((e) => (
            <Typography key={e} textColor="danger600">
              {e}
            </Typography>
          ))}
        </Box>
      ) : null}

      <Box background="neutral100" padding={4} hasRadius>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{state?.diff ?? 'Loading…'}</pre>
      </Box>
    </Box>
  );
}
