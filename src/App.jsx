import { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SidebarLayout from './components/SidebarLayout';
import { ActivityTimerProvider } from './context/ActivityTimerProvider';
import { CoachProvider } from './context/CoachContext';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LevelMap = lazy(() => import('./pages/LevelMap'));
const LevelDashboard = lazy(() => import('./pages/LevelDashboard'));
const LessonView = lazy(() => import('./pages/LessonView'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AIFriendPage = lazy(() => import('./pages/AIFriendPage'));
const Achievements = lazy(() => import('./pages/Achievements'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ParticipantDetail = lazy(() => import('./pages/admin/ParticipantDetail'));
const Invoicing = lazy(() => import('./pages/admin/Invoicing'));
const ClawGamePage = lazy(() => import('./pages/ClawGamePage'));

function App() {
    return (
        <Router>
            <ActivityTimerProvider>
                <CoachProvider>
                    <Suspense fallback={<div className="min-h-screen safe-mobile-height flex items-center justify-center bg-[#e0f7fa] text-[#00695C] font-black">Loading...</div>}>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/signup" element={<Signup />} />
                            <Route path="/admin" element={<AdminPanel />} />
                            <Route path="/admin/dashboard" element={<AdminDashboard />} />
                            <Route path="/admin/participant/:id" element={<ParticipantDetail />} />
                            <Route path="/admin/invoicing" element={<Invoicing />} />
                            <Route path="/admin/company-settings" element={<Invoicing />} />

                            {/* Learner Routes wrapped in SidebarLayout */}
                            <Route path="/dashboard" element={<SidebarLayout><Dashboard /></SidebarLayout>} />
                            <Route path="/chapter/:chapterId" element={<SidebarLayout><LevelMap /></SidebarLayout>} />
                            <Route path="/level/:levelId" element={<SidebarLayout><LevelDashboard /></SidebarLayout>} />
                            <Route path="/ai-friend" element={<SidebarLayout><AIFriendPage /></SidebarLayout>} />
                            <Route path="/achievements" element={<SidebarLayout><Achievements /></SidebarLayout>} />
                            <Route path="/profile" element={<SidebarLayout><Profile /></SidebarLayout>} />
                            <Route path="/arcade" element={<SidebarLayout><ClawGamePage /></SidebarLayout>} />
                            <Route path="/lesson/:levelId" element={<SidebarLayout><LessonView /></SidebarLayout>} />

                            <Route path="/" element={<Navigate to="/login" replace />} />
                        </Routes>
                    </Suspense>
                </CoachProvider>
            </ActivityTimerProvider>
        </Router>
    );
}

export default App;
