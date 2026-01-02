/**
 * App - Main app component with keyboard shortcuts
 */

import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes';

export function App() {
  return <RouterProvider router={router} />;
}
