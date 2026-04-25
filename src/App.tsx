/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * [File Refreshed]
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  MapPin, 
  Kanban, 
  Map as MapIcon, 
  Settings, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Filter,
  Maximize2,
  ChevronRight,
  Search,
  LogIn,
  LogOut,
  Shield,
  Activity,
  ArrowUp,
  Leaf,
  Droplets,
  HardHat,
  Eye,
  TrendingUp,
  Percent,
  Layers,
  ZoomIn,
  ZoomOut,
  X,
  LayoutDashboard,
  Users,
  Phone,
  Mail,
  Info,
  Inbox
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  getDocFromServer,
  query,
  orderBy
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth();

// --- Types & Constants ---

type Status = 'backlog' | 'in-progress' | 'resolved' | 'archived';
type Priority = 'low' | 'medium' | 'high';
type Category = 'infrastructure' | 'sanitation' | 'safety' | 'greenery';

interface CivicIssue {
  id: string;
  title: string;
  description: string;
  address: string;
  pincode: string;
  status: Status;
  priority: Priority;
  category: Category;
  votes: number;
  lat: number;
  lng: number;
  timestamp: any;
  authorId: string;
  imageUrl?: string;
  updatedAt?: any;
}

const COLUMNS: { id: Status; label: string; icon: any }[] = [
  { id: 'backlog', label: 'Reported', icon: AlertCircle },
  { id: 'in-progress', label: 'In Progress', icon: Clock },
  { id: 'resolved', label: 'Resolved', icon: CheckCircle2 },
];

const CATEGORY_COLORS: Record<Category, string> = {
  infrastructure: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  sanitation: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
  safety: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  greenery: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
};

const CATEGORY_ICONS: Record<Category, any> = {
  infrastructure: HardHat,
  sanitation: Droplets,
  safety: Eye,
  greenery: Leaf,
};

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// --- Components ---

function MapEvents({ isCreating, onLocationSelect, onMapClick }: { 
  isCreating: boolean, 
  onLocationSelect: (p: {lat: number, lng: number}) => void,
  onMapClick: (lat: number, lng: number) => void 
}) {
  const map = useMapEvents({
    move: () => {
      if (isCreating) {
        const center = map.getCenter();
        onLocationSelect({ lat: center.lat, lng: center.lng });
      }
    },
    click: (e) => {
      if (!isCreating) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

function CenterPin() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[1000] mb-8">
      <motion.div
        initial={{ scale: 0.5, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="flex flex-col items-center"
      >
        <div className="relative">
          <div className="absolute -inset-4 bg-[#70133c]/20 rounded-full animate-ping" />
          <div className="w-8 h-8 rounded-full bg-[#70133c] shadow-2xl border-4 border-white flex items-center justify-center relative z-10">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>
        <div className="w-1 h-8 bg-[#70133c] rounded-full -mt-1 shadow-sm origin-top" />
        <div className="w-4 h-1.5 bg-black/20 rounded-[100%] blur-[2px] mt-1" />
      </motion.div>
    </div>
  );
}

function MapController({ zoomLevel, sidebarOpen }: { zoomLevel: number; sidebarOpen: boolean }) {
  const map = useMap();
  
  useEffect(() => {
    map.setZoom(zoomLevel);
  }, [zoomLevel, map]);

  useEffect(() => {
    // Immediate invalidation on sidebar toggle
    map.invalidateSize({ animate: true });

    const timer = setTimeout(() => {
      map.invalidateSize({ animate: true });
    }, 400);

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });

    const container = map.getContainer();
    if (container) {
      observer.observe(container);
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [sidebarOpen, map]);

  return null;
}

function Spinner({ className }: { className?: string }) {
  return (
    <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
  );
}

const categoryColors: Record<Category, string> = {
  infrastructure: 'bg-blue-50 text-blue-700',
  sanitation: 'bg-amber-50 text-amber-700',
  safety: 'bg-rose-50 text-rose-700',
  greenery: 'bg-emerald-50 text-emerald-700'
};

const statusColors: Record<Status, string> = {
  backlog: 'bg-slate-100 text-slate-700',
  'in-progress': 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-purple-100 text-purple-700'
};

const priorityColors: Record<Priority, string> = {
  low: 'bg-slate-50 text-slate-600',
  medium: 'bg-amber-50 text-amber-600',
  high: 'bg-rose-50 text-rose-600'
};

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider uppercase border ${className}`}>
      {label}
    </span>
  );
}

function SortableIssueCard({ issue, isSelected, onClick, categoryColors, t, isHovered, onHover, onLeave }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: issue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={() => onClick(issue.id)}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`group p-4 transition-all cursor-grab active:cursor-grabbing rounded-lg relative ${
        isSelected ? 'bg-white border-gov-maroon ring-1 ring-gov-maroon/20' : 
        isHovered ? 'bg-slate-50 border-gov-maroon/30 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
      } border-2`}
    >
      <div className="flex justify-between items-start mb-2 pointer-events-none">
        <span className="text-[10px] font-mono text-slate-400 tracking-tighter">{issue.id}</span>
        <div className="flex items-center gap-2">
           <Badge 
            label={t[issue.priority]} 
            className={issue.priority === 'high' ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-slate-400 border-slate-200 bg-slate-50'} 
          />
          {issue.votes > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500">
              <ArrowUp className="w-3 h-3" /> {issue.votes}
            </span>
          )}
        </div>
      </div>
      <h3 className={`text-sm font-bold truncate transition-colors mb-2 pointer-events-none ${isSelected || isHovered ? 'text-gov-maroon' : 'text-slate-900'}`}>
        {issue.title}
      </h3>
      
      {issue.imageUrl && (
        <div className="w-full h-24 mb-3 rounded-lg overflow-hidden border border-slate-100 pointer-events-none">
          <img src={issue.imageUrl} alt={issue.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center pointer-events-none">
        <Badge label={t[issue.category]} className={`${categoryColors[issue.category]} border-transparent`} />
        <span className="text-[10px] text-slate-400 font-mono ml-auto">{issue.timestamp}</span>
      </div>
    </div>
  );
}

function IssueForm({ pos, onCancel, onSubmit, t, onLocationUpdate, setZoom, isMobile }: any) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    pincode: '',
    imageUrl: '',
    category: 'infrastructure' as Category,
    priority: 'medium' as Priority
  });

  const [isSearchingPincode, setIsSearchingPincode] = useState(false);

  useEffect(() => {
    const searchPincode = async () => {
      if (formData.pincode.length === 6) {
        setIsSearchingPincode(true);
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${formData.pincode}&country=india&format=json`);
          const data = await response.json();
          if (data && data.length > 0) {
            const { lat, lon } = data[0];
            onLocationUpdate({ lat: parseFloat(lat), lng: parseFloat(lon) });
            setZoom(16); // Zoom in when location found via pincode
          }
        } catch (error) {
          console.error("Pincode lookup failed", error);
        } finally {
          setIsSearchingPincode(false);
        }
      }
    };

    const timer = setTimeout(searchPincode, 500);
    return () => clearTimeout(timer);
  }, [formData.pincode, onLocationUpdate, setZoom]);

  return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`absolute z-[1000] bg-white border border-slate-200 shadow-2xl flex flex-col gap-6 
          ${isMobile ? 'inset-x-4 top-4 bottom-20 rounded-2xl p-4' : 'top-6 right-6 w-80 rounded-2xl p-6'}`}
      >
        <div className="flex items-center justify-between">
        <h3 className="font-bold text-xs text-gov-maroon uppercase tracking-widest">{t.newReport}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
          <Plus className="w-4 h-4 rotate-45" />
        </button>
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.subjectLine}</label>
          <input 
            autoFocus
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-gov-maroon transition-colors"
            placeholder={t.incidentSummary}
            value={formData.title}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.categoryType}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['infrastructure', 'sanitation', 'safety', 'greenery'] as Category[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all ${
                    formData.category === cat ? 'bg-[#70133c]/10 border-[#70133c] text-[#70133c]' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {t[cat]}
                </button>
              ))}
            </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.address}</label>
          <input 
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-gov-maroon transition-colors"
            placeholder={t.addressPlaceholder}
            value={formData.address}
            onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5 relative">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.pincode}</label>
          <div className="relative">
            <input 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-gov-maroon transition-colors"
              placeholder={t.pincodePlaceholder}
              maxLength={6}
              value={formData.pincode}
              onChange={e => setFormData(prev => ({ ...prev, pincode: e.target.value.replace(/\D/g, '') }))}
            />
            {isSearchingPincode && (
              <div className="absolute right-3 top-2.5">
                <Spinner className="w-4 h-4 text-gov-maroon" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.photoURL}</label>
          
          <div className="flex gap-2">
            <input 
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-gov-maroon transition-colors"
              placeholder={t.imageUrlPlaceholder}
              value={formData.imageUrl}
              onChange={e => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
            />
            {formData.imageUrl && (
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                <img src={formData.imageUrl} alt={t.preview} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.descriptionPayload}</label>
          <textarea 
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-gov-maroon transition-colors h-24 resize-none"
            placeholder={t.telemetryData}
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>
      </div>

      <button
        disabled={!formData.title}
        onClick={() => onSubmit({ ...formData, lat: pos.lat, lng: pos.lng })}
        className="w-full py-3 bg-[#70133c] hover:opacity-90 disabled:opacity-50 disabled:hover:bg-[#70133c] text-white text-xs font-bold rounded-xl transition-all shadow-lg active:scale-[0.98]"
      >
        {t.transmit}
      </button>

      <div className="flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-2">
        <span>{t.loc}: {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}</span>
        <span>{t.verifiedSubmission}</span>
      </div>
    </motion.div>
  );
}

function LandingPage({ onLogin, lang, setLang, t, onShowContact }: { onLogin: () => void, lang: Lang, setLang: (l: Lang) => void, t: any, onShowContact: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onLogin();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        console.warn("Sign-in popup closed by user.");
        return; // Don't show error for intentional closure
      }
      console.error("Login failed", err);
      setError("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Top Header Layer 1: Emblems */}
      <header className="bg-white border-b border-gov-maroon/20 px-4 py-4 md:py-2 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center md:text-left">
           {/* Emblem Placeholder (Mocked with stylized lucide) */}
          <div className="flex flex-col md:flex-row items-center gap-3">
             <Shield className="w-10 h-10 text-gov-maroon hidden md:block" />
             <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gov-maroon uppercase leading-tight">प्रशासनिक सुधार और लोक शिकायत विभाग</span>
                <span className="text-[10px] font-bold text-gov-maroon uppercase leading-tight">DEPARTMENT OF ADMINISTRATIVE REFORMS & PUBLIC GRIEVANCES</span>
             </div>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
              <div className="h-14 overflow-hidden">
                <img 
                  src="https://p7.hiclipart.com/preview/817/707/614/lion-capital-of-ashoka-state-emblem-of-india-national-symbols-of-india-national-emblem-india.jpg" 
                  alt="National Emblem of India"
                  className="h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
          <div className="flex flex-col items-end">
             <div className="bg-gov-maroon text-white font-bold px-4 py-1.5 rounded text-sm tracking-widest uppercase">{t.appName}</div>
          </div>
        </div>
      </header>

      {/* Top Header Layer 2: Utilities */}
      <div className="bg-[#70133c] text-white overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-1.5">
           <div className="flex items-center gap-4">
              <button className="p-1 hover:bg-white/10 rounded"><Settings className="w-4 h-4" /></button>
              <button className="p-1 hover:bg-white/10 rounded"><Activity className="w-4 h-4" /></button>
              <button className="p-1 hover:bg-white/10 rounded"><Shield className="w-4 h-4" /></button>
           </div>
           <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-medium border-l border-white/20 pl-4 h-6">
                <span>{t.language}:</span>
                <select 
                  value={lang} 
                  onChange={(e) => setLang(e.target.value as Lang)}
                  className="bg-transparent border-none focus:ring-0 cursor-pointer font-bold"
                >
                  <option value="en" className="text-slate-900">English</option>
                  <option value="hi" className="text-slate-900">हिन्दी</option>
                </select>
              </div>
              <button 
                onClick={handleGoogleLogin}
                className="bg-gov-yellow text-slate-900 px-4 py-1 rounded-sm text-xs font-bold flex items-center gap-2 hover:bg-yellow-200 transition-colors"
              >
                <ChevronRight className="w-4 h-4" /> {t.signIn}
              </button>
           </div>
        </div>
      </div>

      {/* Alert Marquee */}
      <div className="bg-gov-maroon/10 border-b border-gov-maroon/20 py-2">
        <div className="max-w-7xl mx-auto px-4 overflow-hidden">
           <div className="animate-marquee whitespace-nowrap text-gov-maroon font-bold text-xs uppercase tracking-wide">
             {t.marqueeText}
           </div>
        </div>
      </div>

      {/* Hero Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-6 uppercase tracking-tight">{t.aboutTitle}</h1>
            <p className="text-slate-600 leading-relaxed mb-6">
              {t.aboutPara1}
            </p>
            <p className="text-slate-600 leading-relaxed">
              {t.aboutPara2}
            </p>
          </div>
          <div className="space-y-6">
             <div className="bg-gov-light-blue p-8 rounded-xl border border-gov-blue/10 flex flex-col items-center gap-4 text-center group cursor-pointer hover:shadow-lg transition-all" onClick={handleGoogleLogin}>
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                   <Activity className="w-8 h-8 text-gov-blue" />
                </div>
                <h3 className="font-bold text-gov-blue uppercase tracking-wider">{t.registerLogin}</h3>
             </div>
             <div className="bg-gov-pink p-8 rounded-xl border border-rose-200/50 flex flex-col items-center gap-4 text-center group cursor-pointer hover:shadow-lg transition-all">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                   <Search className="w-8 h-8 text-rose-500" />
                </div>
                <h3 className="font-bold text-rose-500 uppercase tracking-wider">{t.viewStatusStatus}</h3>
             </div>
             <div className="bg-gov-yellow p-8 rounded-xl border border-yellow-200/50 flex flex-col items-center gap-4 text-center group cursor-pointer hover:shadow-lg transition-all" onClick={onShowContact}>
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                   <Phone className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="font-bold text-amber-700 uppercase tracking-wider">{t.contactUs}</h3>
             </div>
          </div>
        </div>

        {/* What's New & Notes */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
           <section>
              <h2 className="text-xl font-bold uppercase mb-6 flex items-center gap-2">
                 <div className="w-1 h-6 bg-gov-maroon" /> {t.whatsNew}
              </h2>
              <div className="space-y-4">
                 {[
                   { date: '27', month: 'JULY 2022', title: `Strengthening of Machinery for Redressal of Public Grievance (${t.appName}) (PDF)`, size: '1.05 MB' },
                   { date: '23', month: 'AUGUST 2024', title: 'Comprehensive Guidelines for Handling the Public Grievances (PDF)', size: '0.25 MB' }
                 ].map((item, idx) => (
                    <div key={idx} className="flex gap-4 p-4 bg-white border border-slate-200 rounded-lg hover:border-gov-maroon/30 transition-colors">
                       <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded px-4 py-2 min-w-[100px]">
                          <span className="text-2xl font-bold text-gov-maroon leading-none">{item.date}</span>
                          <span className="text-[9px] font-bold text-slate-500 uppercase">{item.month}</span>
                       </div>
                       <div className="flex flex-col justify-center">
                          <p className="text-sm font-medium text-slate-800 leading-snug">{item.title}</p>
                          <span className="text-[10px] text-slate-500 font-mono mt-1">{item.size}</span>
                       </div>
                    </div>
                 ))}
              </div>
           </section>
           <section>
              <h2 className="text-xl font-bold uppercase mb-6 flex items-center gap-2">
                 <div className="w-1 h-6 bg-gov-maroon" /> {t.notRedressedTitle}
              </h2>
              <ul className="space-y-3">
                 {[t.rtiMatters, t.courtMatters, t.religiousMatters, t.serviceMatters].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-slate-600">
                       <ChevronRight className="w-4 h-4 text-gov-maroon" /> {item}
                    </li>
                 ))}
              </ul>
              <div className="mt-8 p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
                 <h4 className="font-bold text-xs uppercase mb-2 text-amber-800 tracking-wider">{t.note}</h4>
                 <p className="text-xs text-amber-700 leading-relaxed">
                   {t.feeNotice}
                 </p>
              </div>
           </section>
        </div>
      </main>

      {/* Footer Grid */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 mb-12">
              <div>
                 <div className="flex items-center gap-2 text-white font-bold mb-6">
                    <Shield className="w-6 h-6 text-gov-maroon" /> {t.appName}
                 </div>
                 <p className="text-xs leading-relaxed">
                   {t.footerDesc}
                 </p>
              </div>
              <div className="space-y-4">
                 <h4 className="text-white font-bold text-xs uppercase tracking-widest">{t.resources}</h4>
                 <ul className="text-xs space-y-2">
                    <li><a href="#" className="hover:text-white">{t.guidelines}</a></li>
                    <li><a href="#" className="hover:text-white">{t.rtiMatters}</a></li>
                    <li><a href="#" className="hover:text-white">{t.feedbackSystem}</a></li>
                 </ul>
              </div>
              <div className="space-y-4">
                 <h4 className="text-white font-bold text-xs uppercase tracking-widest">{t.connect}</h4>
                 <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white cursor-pointer transition-all"><Settings className="w-4 h-4" /></div>
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 hover:text-white cursor-pointer transition-all"><Activity className="w-4 h-4" /></div>
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-red-600 hover:text-white cursor-pointer transition-all"><Activity className="w-4 h-4" /></div>
                 </div>
              </div>
              <div className="space-y-4">
                 <h4 className="text-white font-bold text-xs uppercase tracking-widest">{t.details}</h4>
                 <p className="text-[10px] uppercase font-mono">{t.statusLabel} {t.verified}</p>
                 <p className="text-[10px] uppercase font-mono">{t.lastUpdated} 02-04-2026</p>
              </div>
           </div>
           
           <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] uppercase font-mono">
              <div className="flex gap-6">
                 <a href="#" className="hover:text-white">{t.disclaimer}</a>
                 <a href="#" className="hover:text-white">{t.websitePolicies}</a>
                 <a href="#" className="hover:text-white">{t.sitemap}</a>
              </div>
              <p>{t.nicHosted}</p>
           </div>
        </div>
      </footer>
    </div>
  );
}

// --- Translations ---

const translations = {
  en: {
    appName: "CCA",
    restrictedOps: "Public Grievance Redressal Ops",
    authRequired: "Officer Authentication Required",
    identify: "Verification_",
    citizenLogin: "Portal Login Access",
    authenticating: "VERIFYING...",
    signInGoogle: "OFFICIAL SIGN IN",
    booting: "Loading Portal Data...",
    mapView: "Spatial Visualization",
    kanbanView: "Redressal Pipeline",
    terminate: "Log Out",
    opsCenter: "",
    spatial: "Map_View",
    kanban: "Status_View",
    locality: "REGIONAL_HQ_NODAL",
    records: "Total_Grievances",
    resolution: "Closure_Rate",
    hotZone: "Active_Zone",
    dominant: "Top_Category",
    systemsOptimal: "SYSTEM_ONLINE",
    addRecord: "LODGE_GRIEVANCE",
    coordX: "LAT",
    coordY: "LONG",
    newReport: "Lodge New Grievance",
    subjectLine: "Grievance Subject",
    categoryType: "Nodal Department",
    descriptionPayload: "Detailed Description",
    transmit: "SUBMIT GRIEVANCE",
    incidentSummary: "Brief summary of the issue...",
    telemetryData: "Provide all relevant details for faster resolution...",
    address: "Location Address",
    pincode: "Pincode",
    photoUrl: "Evidence Photo URL",
    reported: "My Reported Grievances",
    history: "Grievance History",
    subjectInfo: "Grievance Details_",
    votes: "SUPPORTED",
    status: "Status_",
    priority: "Level_",
    reportedOn: "LODGED_ON",
    editProfile: "Edit Profile",
    changePassword: "Change Password",
    accountActivity: "Account Activity",
    deleteAccount: "Delete Account",
    backlog: "Reported",
    'in-progress': "Under Process",
    resolved: "Closed",
    archived: "Resolved",
    infrastructure: "Public Utilities",
    sanitation: "Sanitation",
    safety: "Public Safety",
    greenery: "Environment",
    low: "Routine",
    medium: "Urgent",
    high: "Critical",
    officersIncharge: "Officers Incharge",
    wardwiseOfficers: "Ward-wise Officers",
    ward: "Ward",
    contactUs: "Contact Support",
    helpline: "Grievance Helpline",
    emailSupport: "Email Support",
    techSupport: "Technical Support",
    faqs: "FAQs",
    frequentlyAsked: "Frequently Asked Questions",
    answer: "Answer",
    language: "Language",
    signIn: "Sign In",
    marqueeText: "Any Grievance sent by email will not be attended to / entertained. Please lodge your grievance on this portal.",
    aboutTitle: "About CCA",
    aboutPara1: "Citizen Complain Authority (CCA) is an online platform available to the citizens 24x7 to lodge their grievances to the public authorities on any subject related to service delivery. It is a single portal connected to all the Ministries/Departments of Government of India and States.",
    aboutPara2: "Every Ministry and States have role-based access to this system. CCA is also accessible to the citizens through standalone mobile application downloadable through Google Play store and mobile application integrated with UMANG.",
    registerLogin: "Register / Login",
    viewStatusStatus: "View Status",
    whatsNew: "What's New",
    notRedressedTitle: "Issues not taken up for redress",
    rtiMatters: "RTI Matters",
    courtMatters: "Court related / Subjudice matters",
    religiousMatters: "Religious matters",
    serviceMatters: "Service Matters of Govt. Employees",
    note: "Note:",
    feeNotice: "Government is not charging fee from the public for filing grievances. All money being paid by the public for filing grievance is going only to M/s CSC only.",
    footerDesc: "Centrally monitored public grievance system providing transparent and effective redressal for citizens of India.",
    resources: "Resources",
    guidelines: "Guidelines",
    feedbackSystem: "Feedback System",
    connect: "Connect",
    details: "Details",
    statusLabel: "Status:",
    verified: "Verified",
    lastUpdated: "Last Updated:",
    disclaimer: "Disclaimer",
    websitePolicies: "Website Policies",
    sitemap: "Sitemap",
    nicHosted: "Designed and hosted by National Informatics Centre (NIC)",
    verifiedOfficer: "Citizen",
    bootingPortal: "Booting Systems...",
    centralGrid: "CENTRAL_GRID_HQ",
    recordsLabel: "RECORDS",
    startReporting: "Start Reporting",
    noGrievances: "No grievances found",
    noGrievancesDesc: "You haven't reported any grievances yet. Use the map to drop a pin and start reporting issues in your locality.",
    lastUpdate: "Last Update:",
    syncing: "Syncing...",
    viewDetails: "VIEW DETAILS",
    resolutionHistory: "History of all grievances filed by your account",
    profileEditNotice: "Profile editing functionality is being initialized...",
    deleteConfirm: "Are you sure you want to delete your officer account? This action is irreversible.",
    verifiedSubmission: "VERIFIED_SUBMISSION",
    loc: "LOC",
    searchWards: "Search ward or officer...",
    incharge: "Incharge",
    contact: "Contact",
    messageOfficer: "Message Officer",
    helplineDesc: "Available 24x7 for urgent grievance reporting",
    emailSupportDesc: "Expected response time: 24-48 hours",
    techSupportDesc: "Direct HQ technical assistance (Mon-Fri, 9am-6pm)",
    close: "Close",
    addressPlaceholder: "Enter full address...",
    pincodePlaceholder: "6-digit pincode",
    imageUrlPlaceholder: "Paste image URL here...",
    preview: "Preview",
    detailsLabel: "Details",
    addressDetail: "Address",
    geolocation: "Geolocation",
    categoryLabel: "Category",
    assignOfficer: "Assign to Nodal Officer",
    grievanceTitle: "GRIEVANCE",
    previewAlt: "Grievance Evidence",
    faq1Q: "How do I lodge a grievance on CCA?",
    faq1A: "Log in to the portal using your official credentials or Google sign-in. Click on the 'LODGE_GRIEVANCE' button on the map or status view. Select the location on the map, fill in the subject, category, and description, and then click 'SUBMIT GRIEVANCE'.",
    faq2Q: "What happens after I submit a grievance?",
    faq2A: "Once submitted, the system assigns a unique ID to your grievance. It is then forwarded to the relevant Nodal Officer for investigation and redressal. You can track the status in the 'Redressal Pipeline' (Kanban) view.",
    faq3Q: "Which issues are not taken up for redressal?",
    faq3A: "RTI Matters, Court related/Subjudice matters, Religious matters, and Service Matters of Govt. Employees are generally not entertained as grievances on CCA.",
    faq4Q: "Is there any fee for filing a grievance?",
    faq4A: "No, the Government of India does not charge any fee for filing grievances on the CCA portal.",
    faq5Q: "How can I track my grievance status?",
    faq5A: "You can use the unique ID generated at the time of submission to track your grievance. In the portal, navigate to the 'Redressal Pipeline' or use the 'View Status' option on the landing page.",
    faq6Q: "Who is a Nodal Officer?",
    faq6A: "A Nodal Officer is a designated official in a Ministry, Department, or State Government responsible for receiving and ensuring the redressal of grievances related to their jurisdiction.",
    faq7Q: "What is the expected time for grievance redressal?",
    faq7A: "The standard timeframe for grievance redressal is generally 30 to 45 days, though it may vary depending on the complexity of the issue.",
    faq8Q: "Can I appeal if I am not satisfied with the resolution?",
    faq8A: "Yes, if the grievance is closed but you are not satisfied with the resolution, you can file an appeal with the next higher authority (Appellate Authority) within the portal.",
    faq9Q: "Is CCA available on mobile?",
    faq9A: "Yes, CCA is accessible via a standalone mobile application available on the Google Play Store and is also integrated into the UMANG app.",
    faq10Q: "How are grievances prioritized?",
    faq10A: "Grievances are prioritized based on their level of urgency—Routine (Low), Urgent (Medium), or Critical (High). This categorization is usually handled during the submission or initial review by the system."
  },
  hi: {
    appName: "CCA",
    restrictedOps: "लोक शिकायत निवारण संचालन",
    authRequired: "अधिकारी प्रमाणीकरण आवश्यक",
    identify: "सत्यापन_",
    citizenLogin: "पोर्टल लॉगिन एक्सेस",
    authenticating: "सत्यापित किया जा रहा है...",
    signInGoogle: "आधिकारिक साइन इन",
    booting: "पोर्टल डेटा लोड हो रहा है...",
    mapView: "स्थानिक दृश्य",
    kanbanView: "निवारण पाइपलाइन",
    terminate: "लॉग आउट",
    opsCenter: "",
    spatial: "मानचित्र_दृश्य",
    kanban: "स्थिति_दृश्य",
    locality: "क्षेत्रीय_मुख्यालय",
    records: "कुल_शिकायतें",
    resolution: "समाधान_दर",
    hotZone: "सक्रिय_क्षेत्र",
    dominant: "शीर्ष_श्रेणी",
    systemsOptimal: "सिस्टम_ऑनलाइन",
    addRecord: "शिकायत_दर्ज_करें",
    coordX: "अक्षांश",
    coordY: "देशांतर",
    newReport: "नई शिकायत दर्ज करें",
    subjectLine: "शिकायत का विषय",
    categoryType: "नोडल विभाग",
    descriptionPayload: "विस्तृत विवरण",
    transmit: "शिकायत जमा करें",
    incidentSummary: "मुद्दे का संक्षिप्त सारांश...",
    telemetryData: "तेजी से समाधान के लिए सभी प्रासंगिक विवरण प्रदान करें...",
    address: "स्थान का पता",
    pincode: "पिनकोड",
    photoUrl: "प्रमाण फोटो URL",
    reported: "मेरी रिपोर्ट की गई शिकायतें",
    history: "शिकायत इतिहास",
    subjectInfo: "शिकायत का विवरण_",
    votes: "समर्थित",
    status: "स्थिति_",
    priority: "स्तर_",
    reportedOn: "दर्ज किया गया",
    editProfile: "प्रोफ़ाइल संपादित करें",
    changePassword: "पासवर्ड बदलें",
    accountActivity: "खाता गतिविधि",
    deleteAccount: "खाता हटाएं",
    backlog: "सूचित",
    'in-progress': "प्रक्रिया के अधीन",
    resolved: "बंद",
    archived: "समाधान",
    infrastructure: "सार्वजनिक सुविधाएं",
    sanitation: "स्वच्छता",
    safety: "सार्वजनिक सुरक्षा",
    greenery: "पर्यावरण",
    low: "नियमित",
    medium: "तत्काल",
    high: "गंभीर",
    officersIncharge: "प्रभारी अधिकारी",
    wardwiseOfficers: "वार्डवार अधिकारी",
    ward: "वार्ड",
    contactUs: "सहायता संपर्क",
    helpline: "शिकायत हेल्पलाइन",
    emailSupport: "ईमेल सहायता",
    techSupport: "तकनीकी सहायता",
    faqs: "सामान्य प्रश्न",
    frequentlyAsked: "अक्सर पूछे जाने वाले प्रश्न",
    answer: "उत्तर",
    language: "भाषा",
    signIn: "साइन इन",
    marqueeText: "ईमेल द्वारा भेजी गई किसी भी शिकायत पर ध्यान नहीं दिया जाएगा / विचार नहीं किया जाएगा। कृपया अपनी शिकायत इस पोर्टल पर दर्ज करें।",
    aboutTitle: "CCA के बारे में",
    aboutPara1: "सिटिजन कम्प्लेन अथॉरिटी (CCA) एक ऑनलाइन प्लेटफॉर्म है जो नागरिकों को सेवा वितरण से संबंधित किसी भी विषय पर सार्वजनिक अधिकारियों को अपनी शिकायतें दर्ज करने के लिए 24x7 उपलब्ध है। यह भारत सरकार के सभी मंत्रालयों/विभागों और राज्यों से जुड़ा एक एकल पोर्टल है।",
    aboutPara2: "प्रत्येक मंत्रालय और राज्यों की इस प्रणाली तक भूमिका-आधारित पहुंच है। CCA नागरिकों के लिए Google Play स्टोर के माध्यम से डाउनलोड करने योग्य स्टैंडअलोन मोबाइल एप्लिकेशन और UMANG के साथ एकीकृत मोबाइल एप्लिकेशन के माध्यम से भी सुलभ है।",
    registerLogin: "पंजीकरण / लॉगिन",
    viewStatusStatus: "स्थिति देखें",
    whatsNew: "नया क्या है",
    notRedressedTitle: "निवारण के लिए नहीं उठाए गए मुद्दे",
    rtiMatters: "आरटीआई मामले",
    courtMatters: "न्यायालय से संबंधित / विचाराधीन मामले",
    religiousMatters: "धार्मिक मामले",
    serviceMatters: "सरकारी कर्मचारियों के सेवा मामले",
    note: "नोट:",
    feeNotice: "सरकार शिकायतों को दर्ज करने के लिए जनता से शुल्क नहीं ले रही है। शिकायत दर्ज करने के लिए जनता द्वारा भुगतान किया गया सारा पैसा केवल मेसर्स सीएससी को ही जा रहा है।",
    footerDesc: "भारत के नागरिकों के लिए पारदर्शी और प्रभावी निवारण प्रदान करने वाली केंद्रीय रूप से निगरानी वाली सार्वजनिक शिकायत प्रणाली।",
    resources: "संसाधन",
    guidelines: "दिशानिर्देश",
    feedbackSystem: "फीडबैक प्रणाली",
    connect: "जुड़ें",
    details: "विवरण",
    statusLabel: "स्थिति:",
    verified: "सत्यापित",
    lastUpdated: "अंतिम अद्यतन:",
    disclaimer: "अस्वीकरण",
    websitePolicies: "वेबसाइट नीतियां",
    sitemap: "साइटमैप",
    nicHosted: "राष्ट्रीय सूचना विज्ञान केंद्र (NIC) द्वारा डिज़ाइन और होस्ट किया गया",
    verifiedOfficer: "नागरिक",
    bootingPortal: "सिस्टम शुरू हो रहा है...",
    centralGrid: "केंद्रीय ग्रिड मुख्यालय",
    recordsLabel: "अभिलेख",
    startReporting: "रिपोर्ट करना शुरू करें",
    noGrievances: "कोई शिकायत नहीं मिली",
    noGrievancesDesc: "आपने अभी तक कोई शिकायत दर्ज नहीं की है। मानचित्र का उपयोग करके पिन ड्रॉप करें और अपने क्षेत्र की समस्याओं की रिपोर्ट करना शुरू करें।",
    lastUpdate: "अंतिम अद्यतन:",
    syncing: "सिंक्रनाइज़ हो रहा है...",
    viewDetails: "विवरण देखें",
    resolutionHistory: "आपके खाते द्वारा दर्ज की गई सभी शिकायतों का इतिहास",
    profileEditNotice: "प्रोफ़ाइल संपादन कार्यक्षमता शुरू की जा रही है...",
    deleteConfirm: "क्या आप वाकई अपना अधिकारी खाता हटाना चाहते हैं? यह क्रिया अपरिवर्तनीय है।",
    verifiedSubmission: "सत्यापित_प्रस्तुति",
    loc: "स्थान",
    searchWards: "वार्ड या अधिकारी खोजें...",
    incharge: "प्रभारी",
    contact: "संपर्क",
    messageOfficer: "अधिकारी को संदेश भेजें",
    helplineDesc: "तत्काल शिकायत रिपोर्ट करने के लिए 24x7 उपलब्ध",
    emailSupportDesc: "अपेक्षित प्रतिक्रिया समय: 24-48 घंटे",
    techSupportDesc: "सीधे मुख्यालय तकनीकी सहायता (सोम-शुक्र, सुबह 9 बजे से शाम 6 बजे तक)",
    close: "बंद करें",
    addressPlaceholder: "पूरा पता दर्ज करें...",
    pincodePlaceholder: "6-अंकों का पिनकोड",
    imageUrlPlaceholder: "यहां इमेज यूआरएल पेस्ट करें...",
    preview: "पूर्वावलोकन",
    detailsLabel: "विवरण",
    addressDetail: "पता",
    geolocation: "भौगोलिक स्थिति",
    categoryLabel: "श्रेणी",
    assignOfficer: "नोडल अधिकारी को सौंपें",
    grievanceTitle: "शिकायत",
    previewAlt: "शिकायत साक्ष्य",
    faq1Q: "CCA पर शिकायत कैसे दर्ज करें?",
    faq1A: "अपने आधिकारिक क्रेडेंशियल्स या Google साइन-इन का उपयोग करके पोर्टल पर लॉग इन करें। मानचित्र या स्थिति दृश्य पर 'शिकायत दर्ज करें' बटन पर क्लिक करें। मानचित्र पर स्थान चुनें, विषय, श्रेणी और विवरण भरें और फिर 'शिकायत सबमिट करें' पर क्लिक करें।",
    faq2Q: "शिकायत सबमिट करने के बाद क्या होता है?",
    faq2A: "एक बार सबमिट करने के बाद, सिस्टम आपकी शिकायत को एक विशिष्ट आईडी प्रदान करता है। इसके बाद इसे जांच और निवारण के लिए संबंधित नोडल अधिकारी को भेज दिया जाता है। आप 'निवारण पाइपलाइन' (कानबान) दृश्य में स्थिति को ट्रैक कर सकते हैं।",
    faq3Q: "निवारण के लिए कौन से मुद्दे नहीं उठाए जाते हैं?",
    faq3A: "आरटीआई मामले, अदालत से संबंधित/विचाराधीन मामले, धार्मिक मामले और सरकारी कर्मचारियों के सेवा मामलों को आम तौर पर CCA पर शिकायतों के रूप में स्वीकार नहीं किया जाता है।",
    faq4Q: "क्या शिकायत दर्ज करने के लिए कोई शुल्क है?",
    faq4A: "नहीं, भारत सरकार CCA पोर्टल पर शिकायतें दर्ज करने के लिए कोई शुल्क नहीं लेती है।",
    faq5Q: "मैं अपनी शिकायत की स्थिति कैसे ट्रैक कर सकता हूं?",
    faq5A: "आप अपनी शिकायत को ट्रैक करने के लिए सबमिशन के समय उत्पन्न विशिष्ट आईडी का उपयोग कर सकते हैं। पोर्टल में, 'निवारण पाइपलाइन' पर जाएं या लैंडिंग पृष्ठ पर 'स्थिति देखें' विकल्प का उपयोग करें।",
    faq6Q: "नोडल अधिकारी कौन है?",
    faq6A: "नोडल अधिकारी किसी मंत्रालय, विभाग या राज्य सरकार में एक नामित अधिकारी होता है जो अपने अधिकार क्षेत्र से संबंधित शिकायतों को प्राप्त करने और उनका निवारण सुनिश्चित करने के लिए जिम्मेदार होता है।",
    faq7Q: "शिकायत निवारण के लिए अपेक्षित समय क्या है?",
    faq7A: "शिकायत निवारण के लिए मानक समय सीमा आम तौर पर 30 से 45 दिन है, हालांकि यह मुद्दे की जटिलता के आधार पर भिन्न हो सकती है।",
    faq8Q: "यदि मैं समाधान से संतुष्ट नहीं हूं तो क्या मैं अपील कर सकता हूं?",
    faq8A: "हाँ, यदि शिकायत बंद कर दी गई है लेकिन आप समाधान से संतुष्ट नहीं हैं, तो आप पोर्टल के भीतर अगले उच्च अधिकारी (अपीलीय प्राधिकारी) के पास अपील दायर कर सकते।",
    faq9Q: "क्या CCA मोबाइल पर उपलब्ध है?",
    faq9A: "हाँ, CCA Google Play Store पर उपलब्ध एक स्टैंडअलोन मोबाइल एप्लिकेशन के माध्यम से सुलभ है और इसे UMANG ऐप में भी एकीकृत किया गया है।",
    faq10Q: "शिकायतों को कैसे प्राथमिकता दी जाती है?",
    faq10A: "शिकायतों को उनके तात्कालिकता के स्तर—नियमित (निम्न), तत्काल (मध्यम), या गंभीर (उच्च) के आधार पर प्राथमिकता दी जाती है। यह वर्गीकरण आमतौर पर सबमिशन या सिस्टम द्वारा प्रारंभिक समीक्षा के दौरान किया जाता है।"
  }
};

type Lang = 'en' | 'hi';

function OfficersView({ t }: { t: any }) {
  const wards = [
    { id: 'W01', name: 'Ward 01 - North Central', officer: 'Sh. Rajesh Kumar', contact: '+91 98765 43210', dept: 'Sanitation' },
    { id: 'W02', name: 'Ward 02 - East Delhi', officer: 'Ms. Anita Singh', contact: '+91 98765 43211', dept: 'Infrastructure' },
    { id: 'W03', name: 'Ward 03 - South West', officer: 'Sh. Manoj Verma', contact: '+91 98765 43212', dept: 'Public Safety' },
    { id: 'W04', name: 'Ward 04 - West Zone', officer: 'Ms. Priya Sharma', contact: '+91 98765 43213', dept: 'Environment' },
    { id: 'W05', name: 'Ward 05 - Central Hub', officer: 'Sh. Vikram Aditya', contact: '+91 98765 43214', dept: 'Public Utilities' },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-[#70133c] tracking-tight">{t.officersIncharge}</h1>
            <p className="text-sm text-slate-500 mt-1">{t.wardwiseOfficers}</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder={t.searchWards} className="bg-transparent border-none text-xs focus:ring-0 w-48" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wards.map(ward => (
            <motion.div 
              key={ward.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-[#70133c]/5 rounded-full flex items-center justify-center group-hover:bg-[#70133c] transition-colors">
                  <Shield className="w-6 h-6 text-[#70133c] group-hover:text-white" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest">{ward.id}</span>
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{ward.name}</h3>
              <p className="text-xs text-slate-500 mb-4">{ward.dept}</p>
              
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center">
                    <Eye className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">{t.incharge}</p>
                    <p className="text-xs font-bold text-slate-900">{ward.officer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">{t.contact}</p>
                    <p className="text-xs font-bold text-slate-900">{ward.contact}</p>
                  </div>
                </div>
              </div>

              <button className="w-full mt-6 py-2 border border-[#70133c] text-[#70133c] text-xs font-bold rounded-lg hover:bg-[#70133c] hover:text-white transition-all uppercase tracking-wider">
                {t.messageOfficer}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContactModal({ isOpen, onClose, t }: { isOpen: boolean; onClose: () => void; t: any }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 bg-[#70133c] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6" />
                <h3 className="font-bold uppercase tracking-tight">{t.contactUs}</h3>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#70133c]/5 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-[#70133c]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.helpline}</p>
                  <p className="text-lg font-bold text-slate-900">+91 1800 11 4455</p>
                  <p className="text-xs text-slate-500 mt-1">{t.helplineDesc}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#70133c]/5 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-[#70133c]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.emailSupport}</p>
                  <p className="text-lg font-bold text-slate-900 font-mono">support-cca@gov.in</p>
                  <p className="text-xs text-slate-500 mt-1">{t.emailSupportDesc}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#70133c]/5 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-[#70133c]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.techSupport}</p>
                  <p className="text-lg font-bold text-slate-900">+91 011 2374 1000</p>
                  <p className="text-xs text-slate-500 mt-1">{t.techSupportDesc}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all uppercase tracking-wider"
              >
                {t.close}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function FAQsView({ t }: { t: any }) {
  const faqs = [
    {
      q: t.faq1Q,
      a: t.faq1A
    },
    {
      q: t.faq2Q,
      a: t.faq2A
    },
    {
      q: t.faq3Q,
      a: t.faq3A
    },
    {
      q: t.faq4Q,
      a: t.faq4A
    },
    {
      q: t.faq5Q,
      a: t.faq5A
    },
    {
      q: t.faq6Q,
      a: t.faq6A
    },
    {
      q: t.faq7Q,
      a: t.faq7A
    },
    {
      q: t.faq8Q,
      a: t.faq8A
    },
    {
      q: t.faq9Q,
      a: t.faq9A
    },
    {
      q: t.faq10Q,
      a: t.faq10A
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col mb-8">
          <h1 className="text-2xl font-bold text-[#70133c] tracking-tight">{t.faqs}</h1>
          <p className="text-sm text-slate-500 mt-1">{t.frequentlyAsked}</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-start gap-4">
                 <div className="w-8 h-8 rounded-full bg-[#70133c] flex items-center justify-center text-white font-bold text-xs shrink-0">
                   Q
                 </div>
                 <h3 className="font-bold text-slate-900 pt-1.5">{faq.q}</h3>
              </div>
              <div className="p-6 flex items-start gap-4">
                 <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                   A
                 </div>
                 <div className="pt-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 leading-none">{t.answer}</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                 </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapFollower({ pos }: { pos: { lat: number, lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([pos.lat, pos.lng]);
  }, [pos, map]);
  return null;
}

export default function App() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang];

  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [activeView, setActiveView] = useState<'map' | 'kanban' | 'officers' | 'faqs' | 'reported'>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [zoom, setZoom] = useState(5);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [isCreating, setIsCreating] = useState(false);
  const [clickPos, setClickPos] = useState({ lat: 20.5937, lng: 78.9629 });
  const [isContactOpen, setIsContactOpen] = useState(false);

  // Map panning state
  const mapX = useMotionValue(0);
  const mapY = useMotionValue(0);
  const springX = useSpring(mapX, { stiffness: 100, damping: 20 });
  const springY = useSpring(mapY, { stiffness: 100, damping: 20 });

  // --- Firebase Effects ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
      
      if (u) {
        getDocFromServer(doc(db, 'test', 'connection')).catch(err => {
           if(err instanceof Error && err.message.includes('the client is offline')) {
              console.error("Please check your Firebase configuration.");
           }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'issues'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          // Migration/Safety: Ensure lat/lng exist for Leaflet. 
          // If they were created with old x/y, they might be missing.
          lat: typeof data.lat === 'number' ? data.lat : (typeof data.y === 'number' ? 28.6139 + (data.y / 1000) : undefined),
          lng: typeof data.lng === 'number' ? data.lng : (typeof data.x === 'number' ? 77.2090 + (data.x / 1000) : undefined),
          timestamp: data.updatedAt?.toDate()?.toLocaleTimeString() || 'Just now'
        };
      }).filter(issue => issue.lat !== undefined && issue.lng !== undefined) as CivicIssue[];
      setIssues(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issues');
    });

    return () => unsubscribe();
  }, [user]);

  // --- Operations ---

  const updateStatus = async (id: string, newStatus: Status) => {
    try {
      const ref = doc(db, 'issues', id);
      await updateDoc(ref, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues/${id}`);
    }
  };

  const upvoteIssue = async (id: string, currentVotes: number) => {
    try {
      const ref = doc(db, 'issues', id);
      await updateDoc(ref, {
        votes: (currentVotes || 0) + 1,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues/${id}`);
    }
  };

  const createIssue = async (details: Partial<CivicIssue>) => {
    if (!user) return;
    const id = `ISS-${Math.floor(1000 + Math.random() * 9000)}`;
    const newIssue = {
      title: details.title || 'New Reported Node',
      description: details.description || 'System generated placeholder description.',
      address: details.address || '',
      pincode: details.pincode || '',
      status: 'backlog',
      priority: details.priority || 'medium',
      category: details.category || 'infrastructure',
      lat: details.lat,
      lng: details.lng,
      votes: 0,
      authorId: user.uid,
      imageUrl: details.imageUrl || '',
      updatedAt: serverTimestamp()
    };
    
    try {
      await setDoc(doc(db, 'issues', id), newIssue);
      setSelectedId(id);
      setIsCreating(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `issues/${id}`);
    }
  };

  const stats = useMemo(() => {
    const total = issues.length;
    const resolved = issues.filter(i => i.status === 'resolved').length;
    const resRate = total ? Math.round((resolved / total) * 100) : 0;
    
    const catCounts = issues.reduce((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    }, {} as any);
    
    // Simple zone density (divide by coords)
    const zones = issues.reduce((acc, i) => {
      const zoneX = i.lng > 77.2090 ? 'East' : 'West';
      const zoneY = i.lat > 28.6139 ? 'South' : 'North';
      const zone = `${zoneY}-${zoneX}`;
      acc[zone] = (acc[zone] || 0) + 1;
      return acc;
    }, {} as any);

    const highestZone = (Object.entries(zones).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'N/A');
    const dominant = (Object.entries(catCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'N/A') as Category | 'N/A';
    
    // Mock history data for the last 7 days
    const history = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toLocaleDateString(),
        count: issues.filter(issue => {
          const seed = i + 1;
          const issueHash = issue.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return (issueHash + seed) % 8 > 3; 
        }).length
      };
    });

    return { total, resRate, dominant, highestZone, history };
  }, [issues]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      const activeIssue = issues.find(i => i.id === active.id);
      if (activeIssue && activeIssue.status !== over.id) {
        updateStatus(active.id, over.id as Status);
      }
    }
  };

  const logout = () => signOut(auth);

  // --- Logic Helpers ---

  const selectedIssue = useMemo(() => 
    issues.find(i => i.id === selectedId), [issues, selectedId]
  );

  useEffect(() => {
    if (selectedId && activeView === 'map') {
      const issue = issues.find(i => i.id === selectedId);
      if (issue) {
        mapX.set(-issue.x * 2 + 400); 
        mapY.set(-issue.y * 2 + 400);
      }
    }
  }, [selectedId, activeView]);

  if (!authChecked) {
    return (
      <div className="h-screen w-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 text-cyan-500 animate-pulse" />
          <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">{t.bootingPortal}</p>
        </div>
      </div>
    );
  }

  const containerVariants = {
    open: {
      transition: { staggerChildren: 0.1, delayChildren: 0.3 }
    },
    closed: {
      transition: { staggerChildren: 0.05, staggerDirection: -1 }
    }
  };

  const itemVariants = {
    open: {
      y: 0,
      opacity: 1,
      transition: {
        y: { stiffness: 1000, velocity: -100 }
      }
    },
    closed: {
      y: 50,
      opacity: 0,
      transition: {
        y: { stiffness: 1000 }
      }
    }
  };

  if (!user) {
    return <LandingPage onLogin={() => {}} lang={lang} setLang={setLang} t={t} onShowContact={() => setIsContactOpen(true)} />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden relative">
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} t={t} />
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (isMobile ? '85%' : 288) : 0, 
          opacity: isSidebarOpen ? 1 : 0,
          position: isMobile ? 'fixed' : 'relative',
          height: '100%',
          zIndex: isMobile ? 110 : 50
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="flex flex-col bg-white border-r border-slate-200 overflow-hidden shrink-0"
      >
        <div className={isMobile ? 'w-full flex flex-col h-full shrink-0' : 'w-72 flex flex-col h-full shrink-0'}>
          <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-[#70133c] text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-white p-1 flex items-center justify-center shrink-0 shadow-lg ring-2 ring-white/30 overflow-hidden">
                <img 
                  src="https://p7.hiclipart.com/preview/817/707/614/lion-capital-of-ashoka-state-emblem-of-india-national-symbols-of-india-national-emblem-india.jpg" 
                  alt="State Emblem of India" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              </div>
              <span className="font-bold tracking-tight uppercase text-sm">{t.appName} {t.opsCenter}</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-white/10 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          <motion.nav 
            className="flex-1 p-3 space-y-1"
            initial="closed"
            animate={isSidebarOpen ? "open" : "closed"}
            variants={containerVariants}
          >
            <motion.button 
              variants={itemVariants}
              onClick={() => setActiveView('map')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeView === 'map' ? 'bg-[#70133c]/10 text-[#70133c] font-bold shadow-sm' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'}`}
            >
              <MapIcon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{t.mapView}</span>
            </motion.button>
            <motion.button 
              variants={itemVariants}
              onClick={() => setActiveView('kanban')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeView === 'kanban' ? 'bg-[#70133c]/10 text-[#70133c] font-bold shadow-sm' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'}`}
            >
              <Kanban className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{t.kanbanView}</span>
            </motion.button>
            <motion.button 
              variants={itemVariants}
              onClick={() => setActiveView('reported')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeView === 'reported' ? 'bg-[#70133c]/10 text-[#70133c] font-bold shadow-sm' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'}`}
            >
              <Clock className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{t.reported}</span>
            </motion.button>
            <motion.button 
              variants={itemVariants}
              onClick={() => setActiveView('officers')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeView === 'officers' ? 'bg-[#70133c]/10 text-[#70133c] font-bold shadow-sm' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'}`}
            >
              <Users className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{t.officersIncharge}</span>
            </motion.button>
            <motion.button 
              variants={itemVariants}
              onClick={() => setActiveView('faqs')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeView === 'faqs' ? 'bg-[#70133c]/10 text-[#70133c] font-bold shadow-sm' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'}`}
            >
              <Info className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{t.faqs}</span>
            </motion.button>
            <motion.button 
              variants={itemVariants}
              onClick={() => setIsContactOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-slate-50 text-slate-500 hover:text-slate-900 mt-auto border-t border-slate-100 pt-4"
            >
              <Phone className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{t.contactUs}</span>
            </motion.button>
          </motion.nav>

          <div className="p-4 border-t border-slate-100 relative">
            <div className="relative">
              <button 
                onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-all text-left"
              >
                <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-slate-900 font-bold text-xs truncate">{user.displayName}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{t.verifiedOfficer}</p>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isAccountMenuOpen ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence>
                {isAccountMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-0 w-full mb-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-[60]"
                  >
                    <div className="p-2 space-y-1">
                      <button 
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          // Placeholder for real interaction
                          alert(t.profileEditNotice);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-[#70133c] rounded-lg transition-colors"
                      >
                        <Users className="w-4 h-4" /> {t.editProfile}
                      </button>
                      <button 
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-[#70133c] rounded-lg transition-colors"
                      >
                        <Shield className="w-4 h-4" /> {t.changePassword}
                      </button>
                      <button 
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-[#70133c] rounded-lg transition-colors"
                      >
                        <Activity className="w-4 h-4" /> {t.accountActivity}
                      </button>
                      <div className="h-[1px] bg-slate-100 my-1" />
                      <button 
                        onClick={() => {
                          if (confirm(t.deleteConfirm)) {
                            setIsAccountMenuOpen(false);
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4 rotate-45" /> {t.deleteAccount}
                      </button>
                      <button 
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-rose-600 rounded-lg transition-colors font-bold uppercase tracking-wider"
                      >
                        <LogOut className="w-4 h-4" /> {t.terminate}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Orchestrator */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header Bar with Metrics */}
        <header className="min-h-20 py-4 md:py-0 flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 bg-white border-b border-slate-200 z-20 shadow-sm gap-4">
          <div className="flex items-center gap-4 md:gap-6">
            {!isSidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-all text-[#70133c]"
              >
                <LayoutDashboard className="w-5 h-5" />
              </button>
            )}
            <div className="flex flex-col">
              <h1 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#70133c] mb-1">
                <span className="text-slate-500 font-normal">
                  {activeView === 'map' ? t.spatial : activeView === 'kanban' ? t.kanban : activeView === 'officers' ? t.officersIncharge : t.faqs}
                </span>
              </h1>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 tracking-tight">
                <Layers className="w-4 h-4 text-[#70133c]" />
                {t.centralGrid}
              </div>
            </div>

            <div className="hidden md:block h-8 w-[1px] bg-slate-200" />

            {/* Metrics Strip */}
            <div className="hidden sm:flex items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar">
              <div className="flex flex-col shrink-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t.records}</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">{stats.total}</span>
              </div>
              <div className="flex flex-col shrink-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t.resolution}</span>
                <div className="flex items-center gap-1.5 leading-none">
                  <Percent className="w-3 h-3 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-900">{stats.resRate}%</span>
                </div>
              </div>

              <div className="hidden md:block h-8 w-[1px] bg-slate-200" />

              <div 
                className="hidden md:flex flex-col min-w-[120px] cursor-pointer group"
                onClick={() => setActiveView('reported')}
              >
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1 group-hover:text-gov-maroon transition-colors">{t.history}</span>
                <div className="h-8 w-full group-hover:opacity-80 transition-opacity">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.history}>
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#70133c" 
                        strokeWidth={2} 
                        dot={false} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 shrink-0">
            {/* Mobile-only metrics for very small screens if needed, otherwise just the button */}
            <div className="sm:hidden flex items-center gap-4">
              <div className="flex flex-col shrink-0 text-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">{t.records}</span>
                <span className="text-xs font-bold text-slate-900">{stats.total}</span>
              </div>
              <div className="flex flex-col shrink-0 text-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">Rate</span>
                <span className="text-xs font-bold text-slate-900">{stats.resRate}%</span>
              </div>
            </div>
            <button 
              onClick={() => {
                setActiveView('map');
                setIsCreating(true);
              }}
              className="flex items-center gap-2 px-4 md:px-6 py-2 bg-[#70133c] text-white text-[10px] md:text-xs font-bold rounded shadow-md hover:bg-opacity-90 active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="uppercase tracking-wider">{t.addRecord}</span>
            </button>
          </div>
        </header>

        {/* Dynamic Viewport */}
        <div className="flex-1 flex overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeView === 'map' ? (
              <motion.div 
                key="spatial"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="flex-1 h-full relative"
              >
                <MapContainer 
                  center={[20.5937, 78.9629]} 
                  zoom={5} 
                  minZoom={4}
                  maxBounds={[[6.0, 68.0], [38.0, 98.0]]}
                  style={{ height: '100%', width: '100%', zIndex: 1 }}
                  zoomControl={false}
                  preferCanvas={true}
                  zoomAnimation={true}
                  fadeAnimation={true}
                  markerZoomAnimation={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    detectRetina={true}
                    maxZoom={19}
                  />
                  <MapEvents 
                    isCreating={isCreating} 
                    onLocationSelect={(p) => setClickPos(p)} 
                    onMapClick={(lat, lng) => {
                      setClickPos({ lat, lng });
                      setIsCreating(true);
                    }} 
                  />
                  <MapController zoomLevel={zoom} sidebarOpen={isSidebarOpen} />
                  <MapFollower pos={clickPos} />
                  {isCreating && <CenterPin />}
                  {issues.filter(issue => typeof issue.lat === 'number' && typeof issue.lng === 'number').map(issue => (
                    <Marker 
                      key={issue.id} 
                      position={[issue.lat, issue.lng]}
                      draggable={true}
                      eventHandlers={{
                        click: () => setSelectedId(issue.id),
                        mouseover: () => setHoveredIssueId(issue.id),
                        mouseout: () => setHoveredIssueId(null),
                        dragend: async (e) => {
                          const marker = e.target;
                          const position = marker.getLatLng();
                          try {
                            const ref = doc(db, 'issues', issue.id);
                            await updateDoc(ref, {
                              lat: position.lat,
                              lng: position.lng,
                              updatedAt: serverTimestamp()
                            });
                          } catch (err) {
                            handleFirestoreError(err, OperationType.UPDATE, `issues/${issue.id}`);
                          }
                        }
                      }}
                    >
                      <Popup>
                         <div className="p-2 min-w-[200px]">
                            <h4 className="font-bold text-sm text-gov-maroon mb-1">{issue.title}</h4>
                            <p className="text-xs text-slate-600 line-clamp-2 mb-3">{issue.description}</p>
                            <div className="flex items-center justify-between">
                                <Badge label={t[issue.status]} className="bg-blue-50 text-blue-700 border-blue-100" />
                                <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{issue.id}</span>
                            </div>
                            <button 
                              onClick={() => setSelectedId(issue.id)}
                              className="w-full mt-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold uppercase text-slate-600 rounded transition-colors"
                            >
                              {t.detailsLabel}
                            </button>
                         </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>

                <div className="absolute top-4 left-4 md:top-6 md:left-6 flex flex-col gap-4 pointer-events-none z-[1000]">
                   <div className="bg-white border border-slate-200 p-3 md:p-4 rounded-xl shadow-lg">
                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <p className="text-[8px] md:text-[9px] text-slate-400 mb-1 tracking-widest leading-none uppercase font-bold">{t.coordX}</p>
                        <p className="text-sm md:text-xl font-bold text-slate-900 leading-none tabular-nums">
                          {clickPos.lat.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[8px] md:text-[9px] text-slate-400 mb-1 tracking-widest leading-none uppercase font-bold">{t.coordY}</p>
                        <p className="text-sm md:text-xl font-bold text-slate-900 leading-none tabular-nums">
                          {clickPos.lng.toFixed(4)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Map Overlay Controls */}
                <div className="absolute right-6 bottom-6 flex flex-col gap-2 z-[1000]">
                  <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xl flex flex-col gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(prev + 1, 18)); }}
                      className="p-2.5 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-gov-maroon"
                    >
                      <ZoomIn className="w-5 h-5" />
                    </button>
                    <div className="h-[1px] bg-slate-100" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(prev - 1, 2)); }}
                      className="p-2.5 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-gov-maroon"
                    >
                      <ZoomOut className="w-5 h-5" />
                    </button>
                    <div className="h-[1px] bg-slate-100" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setZoom(13); }}
                      className="p-2.5 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-gov-maroon"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : activeView === 'reported' ? (
              <motion.div
                key="reported"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="flex-1 h-full p-6 bg-slate-100 overflow-y-auto"
              >
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 mb-1">{t.reported}</h2>
                      <p className="text-sm text-slate-500">{t.resolutionHistory}</p>
                    </div>
                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-gov-maroon shadow-sm uppercase tracking-widest">
                      {issues.filter(i => i.authorId === user.uid).length} {t.recordsLabel}
                    </div>
                  </div>

                  {issues.filter(i => i.authorId === user.uid).length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-20 text-center shadow-sm">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Inbox className="w-8 h-8 text-slate-300" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{t.noGrievances}</h3>
                      <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto">{t.noGrievancesDesc}</p>
                      <button 
                        onClick={() => setActiveView('map')}
                        className="px-6 py-2.5 bg-gov-maroon text-white font-bold text-xs rounded shadow-lg hover:bg-opacity-90 transition-all uppercase tracking-widest"
                      >
                        {t.startReporting}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 pb-20">
                      {issues.filter(i => i.authorId === user.uid).sort((a,b) => b.updatedAt?.seconds - a.updatedAt?.seconds).map(issue => (
                        <div 
                          key={issue.id}
                          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                          onClick={() => {
                            setSelectedId(issue.id);
                            // We don't change view, we just open the detail sidebar
                          }}
                        >
                          <div className="flex gap-6">
                            {issue.imageUrl && (
                              <div className="w-32 h-32 rounded-xl overflow-hidden border border-slate-100 shrink-0">
                                <img src={issue.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <Badge label={t[issue.status]} className={`${statusColors[issue.status]} border-transparent`} />
                                <span className="text-[10px] text-slate-400 font-mono">{issue.id}</span>
                              </div>
                              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-gov-maroon transition-colors">{issue.title}</h3>
                              <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed">{issue.description}</p>
                              <div className="flex items-center gap-4 border-t border-slate-100 pt-4">
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{issue.lat.toFixed(4)}, {issue.lng.toFixed(4)}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge label={t[issue.category]} className={`${categoryColors[issue.category]} border-transparent scale-90`} />
                                </div>
                                <div className="ml-auto text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
                                  {t.lastUpdate} {issue.updatedAt?.toDate ? issue.updatedAt.toDate().toLocaleDateString() : t.syncing}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : activeView === 'kanban' ? (
              <motion.div
                key="kanban"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="flex-1 h-full"
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex-1 flex gap-6 p-6 h-full overflow-x-auto bg-slate-100">
                    {COLUMNS.map(column => (
                      <div key={column.id} className="flex-1 min-w-[320px] flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm">
                        <div className="p-4 flex items-center justify-between border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <column.icon className="w-4 h-4 text-gov-maroon" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">{t[column.id]}</h2>
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500">
                              {issues.filter(i => i.status === column.id).length}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                          <SortableContext
                            items={issues.filter(i => i.status === column.id).map(i => i.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="min-h-full" id={column.id}>
                              {issues
                                .filter(i => i.status === column.id)
                                .sort((a, b) => (b.votes || 0) - (a.votes || 0))
                                .map(issue => (
                                  <div key={issue.id} className="mb-3">
                                    <SortableIssueCard 
                                      issue={issue}
                                      isSelected={selectedId === issue.id}
                                      onClick={setSelectedId}
                                      categoryColors={CATEGORY_COLORS}
                                      t={t}
                                      isHovered={hoveredIssueId === issue.id}
                                      onHover={() => setHoveredIssueId(issue.id)}
                                      onLeave={() => setHoveredIssueId(null)}
                                    />
                                  </div>
                                ))}
                            </div>
                          </SortableContext>
                        </div>
                      </div>
                    ))}
                  </div>
                </DndContext>
              </motion.div>
            ) : activeView === 'officers' ? (
              <motion.div
                key="officers"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="flex-1 h-full"
              >
                <OfficersView t={t} />
              </motion.div>
            ) : (
              <motion.div
                key="faqs"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="flex-1 h-full"
              >
                <FAQsView t={t} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isCreating && (
              <IssueForm 
                pos={clickPos}
                onCancel={() => setIsCreating(false)}
                onSubmit={createIssue}
                t={t}
                onLocationUpdate={setClickPos}
                setZoom={setZoom}
                isMobile={isMobile}
              />
            )}
          </AnimatePresence>

          {/* Issue Detail Panel (Slide-out) */}
          <AnimatePresence>
            {selectedIssue && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`absolute right-0 top-0 bottom-0 bg-white border-l border-slate-200 shadow-2xl z-[150] flex flex-col
                  ${isMobile ? 'w-full' : 'w-96'}`}
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="text-lg font-bold text-gov-maroon tracking-tight">{t.grievanceTitle}_{selectedIssue.id}</h2>
                  <button onClick={() => setSelectedId(null)} className="p-1 hover:bg-slate-50 rounded transition-colors">
                    <Plus className="w-5 h-5 text-slate-400 rotate-45" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  <section>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-[10px] text-gov-maroon uppercase font-bold tracking-widest">{t.subjectInfo}</h3>
                      <button 
                        onClick={() => upvoteIssue(selectedIssue.id, selectedIssue.votes)}
                        className="flex flex-col items-center gap-1 group/vote"
                      >
                        <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg group-hover/vote:bg-rose-500 group-hover/vote:text-white transition-all text-rose-500">
                          <ArrowUp className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedIssue.votes} {t.votes}</span>
                      </button>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2 leading-tight">{selectedIssue.title}</h1>
                    <p className="text-slate-600 text-sm leading-relaxed mb-6">{selectedIssue.description}</p>

                    {selectedIssue.imageUrl && (
                      <div className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm mb-6 aspect-video group">
                        <img 
                          src={selectedIssue.imageUrl} 
                          alt={t.previewAlt} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                      </div>
                    )}
                  </section>

                  <section className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 leading-none">{t.addressDetail}</p>
                      <p className="text-xs text-slate-900 font-bold">{selectedIssue.address || 'N/A'}</p>
                      {selectedIssue.pincode && <p className="text-[10px] text-slate-500 font-mono mt-1">PIN: {selectedIssue.pincode}</p>}
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 leading-none">{t.status}</p>
                      <Badge label={t[selectedIssue.status]} className="bg-blue-50 text-blue-700 border-blue-100" />
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 leading-none">{t.priority}</p>
                      <Badge label={t[selectedIssue.priority]} className="bg-rose-50 text-rose-700 border-rose-100" />
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 leading-none">{t.geolocation}</p>
                      <p className="text-xs text-slate-900 font-bold tabular-nums">{selectedIssue.lat.toFixed(4)}, {selectedIssue.lng.toFixed(4)}</p>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 leading-none">{t.categoryLabel}</p>
                      <p className="text-xs text-slate-900 uppercase font-bold">{t[selectedIssue.category]}</p>
                    </div>
                  </section>

                  <section className="p-6 bg-slate-50 border border-slate-100 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gov-maroon" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 leading-none">{t.reported}</p>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                        <Activity className="w-5 h-5 text-gov-maroon" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-900 font-bold">LODGED_ON_PORTAL</p>
                        <p className="text-[10px] text-slate-500 font-mono italic">Verified Submission</p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50">
                  <button className="w-full py-3 bg-gov-maroon hover:bg-opacity-90 text-white text-xs font-bold uppercase tracking-widest transition-all rounded shadow-sm">
                    {t.assignOfficer}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #70133c;
        }
      `}</style>
    </div>
  );
}
