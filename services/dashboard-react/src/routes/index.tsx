/**
 * Route definitions and exports
 */

import { createHashRouter, RouteObject } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { LightsPage } from './LightsPage';
import { ClassicPage } from './ClassicPage';
import { CO2Page } from './CO2Page';
import { HotWaterPage } from './HotWaterPage';
import { LogsPage } from './LogsPage';
import { HeaterPage } from './HeaterPage';
import { PlaceholderPage } from './PlaceholderPage';

const TimelinePage = () => (
  <PlaceholderPage
    title="Event Timeline"
    icon="📖"
    description="Chronological view of thermostat and sensor events. (Phase 5)"
  />
);

const NetworkPage = () => (
  <PlaceholderPage
    title="Zigbee Network"
    icon="📡"
    description="3D floor plan with sensor positions and signal quality. (Phase 5)"
  />
);

const MailboxPage = () => (
  <PlaceholderPage
    title="Mailbox Monitor"
    icon="📬"
    description="Motion detection events from mailbox sensor. (Phase 5)"
  />
);

// Route definitions
const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <ClassicPage /> },
      { path: 'timeline', element: <TimelinePage /> },
      { path: 'logs', element: <LogsPage /> },
      { path: 'co2', element: <CO2Page /> },
      { path: 'hotwater', element: <HotWaterPage /> },
      { path: 'network', element: <NetworkPage /> },
      { path: 'lights', element: <LightsPage /> },
      { path: 'heater', element: <HeaterPage /> },
      { path: 'mailbox', element: <MailboxPage /> },
    ],
  },
];

// Use HashRouter for static file serving (no server-side routing needed)
export const router = createHashRouter(routes);
