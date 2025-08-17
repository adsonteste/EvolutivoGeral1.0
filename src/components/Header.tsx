import React from 'react';
import { FileUp, Database, RefreshCw, ArrowUpDown, SortAsc } from 'lucide-react';
import { Region } from '../types';
import ImportStatusModal from './ImportStatusModal';
import ExportButton from './ExportButton';

interface HeaderProps {
  activeTab: 'routes' | 'drivers';
  setActiveTab: (tab: 'routes' | 'drivers') => void;
  onImportStatus: (data: any[]) => void;
  onClearData: () => void;
  selectedRegion: Region;
  setSelectedRegion: (region: Region) => void;
  sortOrder: 'asc' | 'desc' | 'alpha';
  setSortOrder: (order: 'asc' | 'desc' | 'alpha') => void;
  data: any[];
}

const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab, 
  onImportStatus, 
  onClearData,
  selectedRegion,
  setSelectedRegion,
  sortOrder,
  setSortOrder,
  data
}) => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const regions: Region[] = ['Todos', 'São Paulo', 'Rio De Janeiro', 'Nespresso', 'Dafiti'];

  const handleSortClick = () => {
    if (sortOrder === 'asc') setSortOrder('desc');
    else if (sortOrder === 'desc') setSortOrder('alpha');
    else setSortOrder('asc');
  };

  return (
    <>
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <h1 className="text-2xl font-semibold text-orange-800">
              Monitoramento De Entrega
            </h1>
            
            <div className="mt-4 md:mt-0 flex flex-wrap gap-2 items-center">
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value as Region)}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {regions.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>

              <ExportButton data={data} />
              
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-all flex items-center"
              >
                <FileUp className="w-4 h-4 mr-2" />
                Importar Status
              </button>
              
              <button 
                onClick={onClearData}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-all flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Limpar Dados
              </button>
            </div>
          </div>
        </div>
      </header>

      <ImportStatusModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onImport={onImportStatus}
      />
    </>
  );
};

export default Header