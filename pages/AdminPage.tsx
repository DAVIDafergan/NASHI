import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';
import AdminShell, { AdminTab, NAV } from '../components/admin/AdminShell';
import Dashboard from '../components/admin/Dashboard';
import EventsAdmin from '../components/admin/EventsAdmin';
import ClassesAdmin from '../components/admin/ClassesAdmin';
import CommunityAdmin from '../components/admin/CommunityAdmin';
import LotteriesAdmin from '../components/admin/LotteriesAdmin';
import UsersAdmin from '../components/admin/UsersAdmin';
import { ApprovalsAdmin, MessagesAdmin, StoriesAdmin } from '../components/admin/QueueAdmin';
import { AnnouncementsAdmin, InspirationsAdmin } from '../components/admin/SimpleContentAdmin';
import AdsAdmin from '../components/admin/AdsAdmin';
import { BroadcastAdmin, ForumAdmin, SettingsAdmin, TicketsAdmin } from '../components/admin/MiscAdmin';
import FlyersAdmin from '../components/admin/FlyersAdmin';
import PersonalityAdmin from '../components/admin/PersonalityAdmin';
import { ToastHost, AdminScopeContext, regionOfItem } from '../components/admin/ui';
import RegionDashboard from '../components/admin/RegionDashboard';
import ManagerRequestsAdmin from '../components/admin/ManagerRequestsAdmin';
import { regionName } from '../shared/regions';

const TABS = NAV.flatMap(g => g.items.map(i => i.id));
const PRIMARY: Partial<Record<AdminTab, string>> = {
  events: 'אירוע חדש', classes: 'חוג חדש', community: 'הוספה לקהילה', lotteries: 'הגרלה חדשה',
  inspirations: 'השראה חדשה', ads: 'פרסום חדש', announcements: 'הודעה חדשה',
};
const WITH_REGION: AdminTab[] = ['events', 'classes', 'community', 'lotteries', 'users'];
const WITH_SEARCH: AdminTab[] = ['events', 'classes', 'community', 'lotteries', 'users', 'messages', 'forum', 'inspirations'];

const arr = (x: any) => (Array.isArray(x) ? x : []);
const REGION_TABS: AdminTab[] = ['dashboard', 'events', 'classes', 'community', 'lotteries', 'tickets'];

const AdminPage: React.FC<{ user: User | null; onLogin: (user: User) => void }> = ({ user }) => {
  const [params, setParams] = useSearchParams();
  // main admin = everything; regional manager = her region's events, classes, community and lotteries
  const isMain = !!user?.isAdmin;
  const lockRegion = !isMain && user?.role === 'regionAdmin' && user?.adminRegion ? user.adminRegion : '';
  const canEnter = isMain || !!lockRegion;
  const allowedTabs = lockRegion ? REGION_TABS : TABS;
  const tabParam = params.get('tab') as AdminTab | null;
  const active: AdminTab = tabParam && allowedTabs.includes(tabParam) ? tabParam : 'dashboard';

  const [regionState, setRegion] = useState('all');
  const region = lockRegion || regionState;
  const [search, setSearch] = useState('');
  // a "new item" request is tied to the tab it was made for, so it never leaks into another section
  const [createReq, setCreateReq] = useState<{ tab: AdminTab | null; n: number }>({ tab: null, n: 0 });
  const [loading, setLoading] = useState(false);

  // core data (dashboard, badges, most lists)
  const [users, setUsers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [lotteries, setLotteries] = useState<any[]>([]);
  const [community, setCommunity] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [pendingPosts, setPendingPosts] = useState<any[]>([]);
  const [pendingStories, setPendingStories] = useState<any[]>([]);
  const [activeStories, setActiveStories] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [managerApps, setManagerApps] = useState<any[]>([]);
  // per-section data
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [inspirations, setInspirations] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ pointsPerRegister: 50, pointsPerEventJoin: 10, pointsPerShare: 5 });

  const loadCore = useCallback(async () => {
    const mainOnly = <T,>(p: () => Promise<T>, empty: any) => (lockRegion ? Promise.resolve(empty) : p().catch(() => empty));
    const [u, ap, ev, cl, lo, co, ps, as, ms, mapps] = await Promise.all([
      mainOnly(() => api.getUsers(), []),
      mainOnly(() => api.getAdminApprovals(), null),
      api.getEvents().catch(() => []),
      api.getClasses().catch(() => []),
      api.getLotteries().catch(() => []),
      api.getCommunityItems().catch(() => []),
      mainOnly(() => api.getPendingStories(), []),
      mainOnly(() => api.getActiveStoriesAdmin(), []),
      mainOnly(() => api.getContactMessages(), []),
      mainOnly(() => api.getManagerApplications('pending'), []),
    ]);
    setManagerApps(arr(mapps));
    // a regional manager sees (and can edit) only the local items of her region
    const own = (list: any) => (lockRegion ? arr(list).filter((x: any) => (x.scope || 'local') === 'local' && regionOfItem(x) === lockRegion) : arr(list));
    setUsers(arr(u)); setEvents(own(ev)); setClasses(own(cl)); setLotteries(own(lo)); setCommunity(own(co));
    setPendingUsers(arr(ap?.pendingUsers)); setPendingPosts(arr(ap?.pendingPosts));
    setPendingStories(arr(ps)); setActiveStories(arr(as)); setMessages(arr(ms));
  }, [lockRegion]);

  const loadSection = useCallback(async (tab: AdminTab) => {
    if (tab === 'forum') setForumPosts(arr(await api.getForumPosts().catch(() => [])));
    else if (tab === 'inspirations') setInspirations(arr(await api.getInspirations().catch(() => [])));
    else if (tab === 'ads') setAds(arr(await api.getAdminAds().catch(() => [])));
    else if (tab === 'announcements') setAnnouncements(arr(await api.getAnnouncements().catch(() => [])));
    else if (tab === 'tickets') setTickets(arr(await api.getTickets().catch(() => [])));
    else if (tab === 'settings') { const s = await api.getSettings().catch(() => null); if (s) setSettings((x: any) => ({ ...x, ...s })); }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try { await Promise.all([loadCore(), loadSection(active)]); } finally { setLoading(false); }
  }, [loadCore, loadSection, active]);

  useEffect(() => { if (canEnter) reload(); }, [canEnter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isMain || (lockRegion && active === 'tickets')) loadSection(active); }, [active, isMain, lockRegion, loadSection]);

  const go = (t: AdminTab) => {
    setSearch('');
    setParams(t === 'dashboard' ? {} : { tab: t });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const requestCreate = (t: AdminTab) => setCreateReq(r => ({ tab: t, n: r.n + 1 }));
  const create = (t: AdminTab) => { go(t); window.setTimeout(() => requestCreate(t), 60); };
  const createTick = createReq.tab === active ? createReq.n : 0;

  const counts = useMemo(() => ({
    approvals: pendingUsers.length + pendingPosts.length + managerApps.length,
    stories: pendingStories.length,
    messages: messages.filter(m => !m.isRead).length,
    forum: pendingPosts.length,
  }), [pendingUsers, pendingPosts, pendingStories, messages, managerApps]);

  if (!user || !canEnter) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center" dir="rtl">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"><ShieldCheck size={30} /></span>
        <h1 className="mt-5 text-3xl">אזור הניהול</h1>
        <p className="mt-2 text-slate-500">הכניסה למנהלות בלבד. יש להתחבר עם חשבון מנהלת.</p>
      </div>
    );
  }

  const primaryLabel = PRIMARY[active];
  const firstName = (user.name || '').split(' ')[0];

  return (
    <>
      <AdminShell
        active={active} onNavigate={go} counts={counts} adminName={firstName}
        primary={primaryLabel ? { label: primaryLabel, onClick: () => requestCreate(active) } : null}
        region={region} setRegion={setRegion} search={search} setSearch={setSearch}
        showRegion={WITH_REGION.includes(active)} showSearch={WITH_SEARCH.includes(active)} loading={loading}
        allowed={lockRegion ? REGION_TABS : undefined} lockedRegionName={lockRegion ? regionName(lockRegion) : undefined}
      >
        <AdminScopeContext.Provider value={{ lockRegion: lockRegion || undefined }}>
        {active === 'dashboard' && lockRegion && (
          <RegionDashboard region={lockRegion} name={firstName} go={go} create={create} data={{ events, classes, lotteries, community }} />
        )}
        {active === 'dashboard' && !lockRegion && (
          <Dashboard go={go} create={create} data={{ users, events, classes, lotteries, community, pendingUsers, pendingPosts, pendingStories, activeStories, messages, managerApps }} />
        )}
        {active === 'approvals' && (
          <div className="space-y-8">
            <ManagerRequestsAdmin items={managerApps} reload={reload} />
            <ApprovalsAdmin pendingUsers={pendingUsers} pendingPosts={pendingPosts} reload={reload} />
          </div>
        )}
        {active === 'stories' && <StoriesAdmin pending={pendingStories} active={activeStories} reload={reload} />}
        {active === 'messages' && <MessagesAdmin messages={messages} search={search} reload={reload} />}
        {active === 'events' && <EventsAdmin events={events} region={region} search={search} createTick={createTick} reload={reload} />}
        {active === 'classes' && <ClassesAdmin classes={classes} region={region} search={search} createTick={createTick} reload={reload} />}
        {active === 'community' && <CommunityAdmin items={community} region={region} search={search} createTick={createTick} reload={reload} />}
        {active === 'lotteries' && <LotteriesAdmin lotteries={lotteries} region={region} search={search} createTick={createTick} reload={reload} />}
        {active === 'personality' && <PersonalityAdmin />}
        {active === 'inspirations' && <InspirationsAdmin items={inspirations} search={search} createTick={createTick} reload={reload} />}
        {active === 'flyers' && <FlyersAdmin />}
        {active === 'ads' && <AdsAdmin items={ads} createTick={createTick} reload={reload} />}
        {active === 'announcements' && <AnnouncementsAdmin items={announcements} createTick={createTick} reload={reload} />}
        {active === 'users' && <UsersAdmin users={users} region={region} search={search} reload={reload} />}
        {active === 'forum' && <ForumAdmin pending={pendingPosts} posts={forumPosts} search={search} reload={reload} />}
        {active === 'tickets' && <TicketsAdmin tickets={tickets} events={events} reload={reload} />}
        {active === 'broadcast' && <BroadcastAdmin recipients={users.length} />}
        {active === 'settings' && <SettingsAdmin settings={settings} setSettings={setSettings} />}
        </AdminScopeContext.Provider>
      </AdminShell>
      <ToastHost />
    </>
  );
};

export default AdminPage;
