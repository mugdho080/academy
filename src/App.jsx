import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import LevelMap from './pages/LevelMap';
import LevelDashboard from './pages/LevelDashboard';
import LessonView from './pages/LessonView';
import AdminPanel from './pages/AdminPanel';
import AIFriendPage from './pages/AIFriendPage';
import SidebarLayout from './components/SidebarLayout';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import ParticipantDetail from './pages/admin/ParticipantDetail';
import { ActivityTimerProvider } from './context/ActivityTimerProvider';
function App() {
    return (
        <Router>
            <ActivityTimerProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/admin" element={<AdminPanel />} />
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/participant/:id" element={<ParticipantDetail />} />

                    {/* Learner Routes wrapped in SidebarLayout */}
                    <Route path="/dashboard" element={<SidebarLayout><Dashboard /></SidebarLayout>} />
                    <Route path="/chapter/:chapterId" element={<SidebarLayout><LevelMap /></SidebarLayout>} />
                    <Route path="/level/:levelId" element={<SidebarLayout><LevelDashboard /></SidebarLayout>} />
                    <Route path="/ai-friend" element={<SidebarLayout><AIFriendPage /></SidebarLayout>} />
                    <Route path="/profile" element={<SidebarLayout><Profile /></SidebarLayout>} />
                    <Route path="/lesson/:levelId" element={<SidebarLayout><LessonView /></SidebarLayout>} />

                    <Route path="/" element={<Navigate to="/login" replace />} />
                </Routes>
            </ActivityTimerProvider>
        </Router>
    );
}

export default App;
