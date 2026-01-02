/**
 * Route definitions and exports
 */

import { createHashRouter, RouteObject } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { LightsPage } from './LightsPage';
import { ClassicPage } from './ClassicPage';
import { PlaceholderPage } from './PlaceholderPage';

const TimelinePage = () => (
  <PlaceholderPage
    title="Event Timeline"
    icon="📖"
    description="Chronological view of thermostat and sensor events."
  />
);

const LogsPage = () => (
  <PlaceholderPage
    title="Activity Logs"
    icon="📋"
    description="Real-time MQTT message logs with filtering."
  />
);

const CO2Page = () => (
  <PlaceholderPage
    title="CO2 Monitor"
    icon="💨"
    description="CO2 levels, air quality, and historical charts."
  />
);

const HotWaterPage = () => (
  <PlaceholderPage
    title="Hot Water Monitor"
    icon="🚿"
    description="Hot water usage tracking via vibration sensor."
  />
);

const NetworkPage = () => (
  <PlaceholderPage
    title="Zigbee Network"
    icon="📡"
    description="3D floor plan with sensor positions and signal quality."
  />
);

const HeaterPage = () => (
  <PlaceholderPage
    title="Heater Control"
    icon="🔥"
    description="Thermostat controls and heating cycle statistics."
  />
);

const MailboxPage = () => (
  <PlaceholderPage
    title="Mailbox Monitor"
    icon="📬"
    description="Motion detection events from mailbox sensor."
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
