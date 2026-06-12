/**
 * Admin entry. Registers a settings-section link to the content-model sync page.
 * Bundled by the Strapi plugin toolchain (@strapi/sdk-plugin), not this package's tsc.
 */
import { PLUGIN_ID } from '../index.js';

export default {
  register(app: {
    createSettingSection: (
      section: { id: string; intlLabel: { id: string; defaultMessage: string } },
      links: Array<{
        intlLabel: { id: string; defaultMessage: string };
        id: string;
        to: string;
        Component: () => Promise<{ default: unknown }>;
      }>,
    ) => void;
  }) {
    app.createSettingSection(
      { id: PLUGIN_ID, intlLabel: { id: `${PLUGIN_ID}.section`, defaultMessage: 'Content Helper' } },
      [
        {
          intlLabel: { id: `${PLUGIN_ID}.sync`, defaultMessage: 'Sync content model' },
          id: 'content-helper-sync',
          to: `/settings/${PLUGIN_ID}`,
          Component: () => import('./SyncPage.js'),
        },
      ],
    );
  },
  bootstrap() {},
};
