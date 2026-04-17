import React from 'react';
import { Home, Search, Library, PlusSquare, Heart } from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, active = false }) => (
  <div className={`flex items-center space-x-4 px-4 py-3 transition-colors ${active ? 'text-white font-bold' : 'text-accent'}`}>
    <Icon size={24} />
    <span className="text-sm">{label}</span>
  </div>
);

export const Sidebar = () => {
  return (
    <div className="w-64 bg-black h-full flex flex-col border-r border-accent/10">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary tracking-tighter">Flowfade</h1>
      </div>
      
      <nav className="flex-1 space-y-1">
        <SidebarItem icon={Home} label="Inicio" active />
        <SidebarItem icon={Search} label="Buscar" />
        <SidebarItem icon={Library} label="Tu biblioteca" />
        
        <div className="mt-8 pt-8 px-4">
          <p className="text-xs uppercase tracking-widest text-accent font-bold mb-4">Playlists</p>
          <SidebarItem icon={PlusSquare} label="Crear lista" />
          <SidebarItem icon={Heart} label="Canciones que te gustan" />
        </div>
      </nav>

      <div className="p-4 border-t border-accent/10">
        <div className="text-[10px] text-accent uppercase tracking-tighter">Modo Offline Activo</div>
      </div>
    </div>
  );
};
