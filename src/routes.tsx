import type { ReactNode } from 'react';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import {
  CaseDetail,
  CaseLibrary,
  Contact,
  HowItWorks,
  NotFound,
  Pricing,
  Privacy,
  PublicResult,
  Terms,
  Unauthorized,
} from './pages/PublicPages';
import Dashboard from './pages/app/Dashboard';
import Lobby from './pages/app/Lobby';
import Room from './pages/app/Room';
import Leaderboard from './pages/app/Leaderboard';
import Campaigns, { CampaignDetail } from './pages/app/Campaigns';
import Profile from './pages/app/Profile';
import Groups from './pages/app/Groups';
import Billing from './pages/app/Billing';
import Settings from './pages/app/Settings';
import Admin from './pages/app/Admin';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  /** Which shell wraps the page. */
  layout?: 'public' | 'app' | 'bare';
  /** Requires a signed-in session. */
  protected?: boolean;
  /** Requires the curator flag. */
  admin?: boolean;
  /** Reachable without login. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: 'Landing', path: '/', element: <Landing />, layout: 'public', public: true },
  { name: 'How it works', path: '/how-it-works', element: <HowItWorks />, layout: 'public', public: true },
  { name: 'Plans', path: '/pricing', element: <Pricing />, layout: 'public', public: true },
  { name: 'Privacy', path: '/privacy', element: <Privacy />, layout: 'public', public: true },
  { name: 'Terms', path: '/terms', element: <Terms />, layout: 'public', public: true },
  { name: 'Contact', path: '/contact', element: <Contact />, layout: 'public', public: true },
  { name: 'Case library', path: '/cases', element: <CaseLibrary />, layout: 'public', public: true },
  { name: 'Case file', path: '/cases/:slug', element: <CaseDetail />, layout: 'public', public: true },
  { name: 'Case result', path: '/cases/:slug/result', element: <PublicResult />, layout: 'public', public: true },
  { name: 'Sign in', path: '/auth', element: <Auth />, layout: 'bare', public: true },
  { name: 'Restricted', path: '/restricted', element: <Unauthorized />, layout: 'public', public: true },

  { name: 'Desk', path: '/app', element: <Dashboard />, layout: 'app', protected: true },
  { name: 'Rooms', path: '/app/lobby', element: <Lobby />, layout: 'app', protected: true },
  { name: 'Room', path: '/app/room/:roomId', element: <Room />, layout: 'app', protected: true },
  { name: 'Leaderboard', path: '/app/leaderboard', element: <Leaderboard />, layout: 'app', protected: true },
  { name: 'Campaigns', path: '/app/campaigns', element: <Campaigns />, layout: 'app', protected: true },
  { name: 'Campaign', path: '/app/campaigns/:slug', element: <CampaignDetail />, layout: 'app', protected: true },
  { name: 'Profile', path: '/app/profile', element: <Profile />, layout: 'app', protected: true },
  { name: 'Groups', path: '/app/groups', element: <Groups />, layout: 'app', protected: true },
  { name: 'Billing', path: '/app/billing', element: <Billing />, layout: 'app', protected: true },
  { name: 'Settings', path: '/app/settings', element: <Settings />, layout: 'app', protected: true },
  { name: 'Admin', path: '/app/admin', element: <Admin />, layout: 'app', protected: true, admin: true },

  { name: 'Not found', path: '*', element: <NotFound />, layout: 'public', public: true },
];
