import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import ImportPanel from './components/ImportPanel';
import DeliveryTable from './components/DeliveryTable';
import { DeliveryData, ImportedRow, Region } from './types';
import { processExcelData, updateDeliveryStatus } from './utils/dataProcessing';

function App() {
  const [deliveryData, setDeliveryData] = useState<DeliveryData[]>(() => {
    const savedData = localStorage.getItem('deliveryData');
    if (savedData) {
      try {
        return JSON.parse(savedData);
      } catch (error) {
        console.error('Erro ao carregar dados do localStorage', error);
        return [];
      }
    }
    return [];
  });
  
  const [activeTab, setActiveTab] = useState<'routes' | 'drivers'>('routes');
  const [selectedRegion, setSelectedRegion] = useState<Region>('Todos');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'alpha'>('asc');

  useEffect(() => {
    localStorage.setItem('deliveryData', JSON.stringify(deliveryData));
  }, [deliveryData]);

  const handleFileUpload = (data: ImportedRow[]) => {
    const processedData = processExcelData(data);
    setDeliveryData(prev => {
      // Mescla os dados existentes com os novos
      const combined = [...prev, ...processedData];
      
      // Remove duplicatas baseadas no ID do motorista e região
      const uniqueData = combined.reduce((acc, current) => {
        const existingIndex = acc.findIndex(item => 
          item.id === current.id
        );
        
        if (existingIndex >= 0) {
          // Se já existe, mescla os dados
          const existing = acc[existingIndex];
          acc[existingIndex] = {
            ...existing,
            totalOrders: existing.totalOrders + current.totalOrders,
            routes: existing.routes + current.routes,
            pending: existing.pending + current.pending,
            serviceCodes: [...existing.serviceCodes, ...current.serviceCodes],
            deliveryPercentage: existing.totalOrders + current.totalOrders > 0
              ? Math.round(((existing.delivered + current.delivered) / (existing.totalOrders + current.totalOrders)) * 100)
              : 0,
            routePercentage: existing.totalOrders + current.totalOrders > 0
              ? Math.round(((existing.totalOrders + current.totalOrders - existing.pending - current.pending) / (existing.totalOrders + current.totalOrders)) * 100)
              : 0
          };
        } else {
          // Se não existe, adiciona como novo
          acc.push(current);
        }
        
        return acc;
      }, [] as DeliveryData[]);
      
      return uniqueData;
    });
  };

  const handleImportStatus = (statusData: any[]) => {
    const updatedData = updateDeliveryStatus(deliveryData, statusData);
    setDeliveryData(updatedData);
  };

  const handleClearData = () => {
    setDeliveryData([]);
    localStorage.removeItem('deliveryData');
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = deliveryData;

    if (selectedRegion !== 'Todos') {
      filtered = filtered.filter(item => item.region === selectedRegion);
    }

    return filtered.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.deliveryPercentage - b.deliveryPercentage;
      } else if (sortOrder === 'desc') {
        return b.deliveryPercentage - a.deliveryPercentage;
      } else {
        return a.driver.localeCompare(b.driver);
      }
    });
  }, [deliveryData, selectedRegion, sortOrder]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onImportStatus={handleImportStatus}
        onClearData={handleClearData}
        selectedRegion={selectedRegion}
        setSelectedRegion={setSelectedRegion}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        data={filteredAndSortedData}
      />
      
      <main className="container mx-auto px-4 py-8">
        {deliveryData.length === 0 ? (
          <ImportPanel onFileUpload={handleFileUpload} />
        ) : (
          <DeliveryTable data={filteredAndSortedData} />
        )}
      </main>
    </div>
  );
}

export default App;