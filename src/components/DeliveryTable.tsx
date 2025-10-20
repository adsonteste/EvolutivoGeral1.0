import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronRight, Printer, CheckCircle, XCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { DeliveryData } from '../types';
import * as htmlToImage from 'html-to-image';

interface DeliveryTableProps {
  data: DeliveryData[];
}

const DeliveryTable: React.FC<DeliveryTableProps> = ({ data }) => {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [localData, setLocalData] = useState<DeliveryData[]>(data);
  const [sortConfig, setSortConfig] = useState<{ key: keyof DeliveryData | null; direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const tableRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setLocalData(data);
  }, [data]);

  // Função para calcular a numeração sequencial das rotas por motorista
  const getSequentialRouteNumber = (driverName: string, currentId: string, allData: DeliveryData[]) => {
    // Filtra todos os registros do mesmo motorista
    const sameDriverEntries = allData
      .filter(item => item.driver === driverName)
      .sort((a, b) => a.id.localeCompare(b.id)); // Ordena por ID para manter consistência
    
    // Encontra a posição do registro atual
    const currentIndex = sameDriverEntries.findIndex(item => item.id === currentId);
    
    // Retorna a posição + 1 (para começar em 1 em vez de 0)
    return currentIndex + 1;
  };

  const toggleRow = (driverId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [driverId]: !prev[driverId]
    }));
  };

  const handleSort = (key: keyof DeliveryData) => {
    let direction: 'asc' | 'desc' | null = 'asc';

    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }

    setSortConfig({ key: direction ? key : null, direction });

    if (!direction) {
      setLocalData(data);
      return;
    }

    const sorted = [...localData].sort((a, b) => {
      const aValue = a[key] as string | number;
      const bValue = b[key] as string | number;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return 0;
    });

    setLocalData(sorted);
  };

  const getSortIcon = (key: keyof DeliveryData) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="w-4 h-4" />;
    if (sortConfig.direction === 'desc') return <ArrowDown className="w-4 h-4" />;
    return <ArrowUpDown className="w-4 h-4" />;
  };

  const handlePrint = async () => {
    if (tableRef.current) {
      const now = new Date();
      const formattedDate = now.toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(/[/:]/g, '_');

      try {
        const { width, height } = tableRef.current.getBoundingClientRect();

        const dataUrl = await htmlToImage.toPng(tableRef.current, {
          quality: 1.0,
          width: Math.ceil(width),
          height: Math.ceil(height),
          pixelRatio: 3,
          backgroundColor: '#ffffff',
          style: {
            margin: '0',
            padding: '0'
          }
        });

        const link = document.createElement('a');
        link.download = `Evolutivo_${formattedDate}.png`;
        link.href = dataUrl;
        link.click();
      } catch (error) {
        console.error('Erro ao gerar imagem:', error);
      }
    }
  };

  const updateDeliveryStatus = (driverId: string, code: string, status: 'success' | 'unsuccessful') => {
    setLocalData(prevData => {
      return prevData.map(driver => {
        if (driver.id === driverId) {
          const successfulCodes = [...driver.successfulCodes];
          const unsuccessfulCodes = [...driver.unsuccessfulCodes];

          const filteredSuccessful = successfulCodes.filter(c => c !== code);
          const filteredUnsuccessful = unsuccessfulCodes.filter(c => c !== code);

          if (status === 'success') {
            filteredSuccessful.push(code);
          } else {
            filteredUnsuccessful.push(code);
          }

          const delivered = filteredSuccessful.length;
          const unsuccessful = filteredUnsuccessful.length;
          const pending = driver.totalOrders - (delivered + unsuccessful);
          const deliveryPercentage = driver.totalOrders > 0
            ? Math.round((delivered / driver.totalOrders) * 100)
            : 0;
          const routePercentage = driver.totalOrders > 0
            ? Math.round(((driver.totalOrders - pending) / driver.totalOrders) * 100)
            : 0;

          return {
            ...driver,
            delivered,
            unsuccessful,
            pending,
            deliveryPercentage,
            routePercentage,
            successfulCodes: filteredSuccessful,
            unsuccessfulCodes: filteredUnsuccessful
          };
        }
        return driver;
      });
    });
  };

  const truncateName = (name: string) => name.length > 20 ? `${name.substring(0, 20)}...` : name;

  // Função para determinar a cor de fundo da linha baseada na %Entrega
  const getRowBackgroundColor = (deliveryPercentage: number) => {
    if (deliveryPercentage >= 98) {
      return 'bg-green-400/80'; // Verde para >= 98%
    }
    if (deliveryPercentage >= 91) {
      return 'bg-yellow-200/80'; // Amarelo para >= 91%
    }
    return 'bg-red-200/80'; // Vermelho para < 91%
  };
  

  // Função para determinar a cor do texto da %Entrega
  const getDeliveryPercentageTextColor = (percentage: number) => {
    if (percentage >= 98) return 'text-green-800 font-bold';
    if (percentage >= 91) return 'text-yellow-800 font-bold';
    return 'text-red-800 font-bold';
  };

  // Função para determinar a cor de fundo da célula %Rota (independente da %Entrega)
  const getRoutePercentageBackgroundColor = (routePercentage: number) => {
    if (routePercentage === 100) return 'bg-green-400/80';
    if (routePercentage >= 96) return 'bg-yellow-100/80';
    return 'bg-red-500/90';
  };

  // Função para determinar a cor do texto da %Rota (independente da %Entrega)
  const getRoutePercentageTextColor = (routePercentage: number) => {
    if (routePercentage === 100) return 'text-green-900 font-bold';
    if (routePercentage >= 96) return 'text-yellow-800 font-bold';
    return 'text-white font-bold';
  };

  const getCodeStyle = (code: string, driver: DeliveryData) => {
    if (driver.successfulCodes.includes(code)) return 'bg-green-100 text-green-800';
    if (driver.unsuccessfulCodes.includes(code)) return 'bg-red-100 text-red-800';
    return 'bg-white';
  };

  return (
    <div className="bg-gradient-to-br from-orange-100 to-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 flex justify-end">
        <button
          onClick={handlePrint}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>
      <div ref={tableRef} className="bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-orange-400 to-orange-300 text-black">
              <th className="py-2 px-1 text-center border-2 border-black font-bold">
                <button
                  onClick={() => handleSort('driver')}
                  className="flex items-center justify-center gap-1 w-full hover:bg-orange-500/20 transition-colors rounded px-2 py-1"
                >
                  MOTORISTA {getSortIcon('driver')}
                </button>
              </th>
              <th className="py-2 px-1 text-center border-2 border-black font-bold">
                <button
                  onClick={() => handleSort('deliveryPercentage')}
                  className="flex items-center justify-center gap-1 w-full hover:bg-orange-500/20 transition-colors rounded px-2 py-1"
                >
                  %ENTREGA {getSortIcon('deliveryPercentage')}
                </button>
              </th>
              <th className="py-2 px-1 text-center border-2 border-black font-bold">ROTA</th>
              <th className="py-2 px-1 text-center border-2 border-black font-bold">TOTAL PEDIDO</th>
              <th className="py-2 px-1 text-center border-2 border-black font-bold">ENTREGUES</th>
              <th className="py-2 px-1 text-center border-2 border-black font-bold">PENDENTES</th>
              <th className="py-2 px-1 text-center border-2 border-black font-bold">INSUCESSOS</th>
              <th className="py-2 px-1 text-center border-2 border-black font-bold">
                <button
                  onClick={() => handleSort('routePercentage')}
                  className="flex items-center justify-center gap-1 w-full hover:bg-orange-500/20 transition-colors rounded px-2 py-1"
                >
                  %ROTA {getSortIcon('routePercentage')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {localData.map((row, index) => (
              <React.Fragment key={index}>
                <tr className={`${getRowBackgroundColor(row.deliveryPercentage)} hover:opacity-90 transition-all`}>
                  <td className="py-2 px-1 text-center border-2 border-black font-medium">
                    <div
                      className="flex items-center justify-center gap-0.5 cursor-pointer"
                      onClick={() => toggleRow(row.id)}
                      title={row.driver}
                    >
                      {row.serviceCodes.length > 0 && (
                        expandedRows[row.id]
                          ? <ChevronDown className="w-4 h-4 text-blue-600" />
                          : <ChevronRight className="w-4 h-4 text-blue-600" />
                      )}
                      <div className="flex flex-col items-center">
                        
                        <span>{truncateName(row.driver)}</span>
                      </div>
                    </div>
                  </td>
                  <td className={`py-2 px-1 text-center border-2 border-black ${getDeliveryPercentageTextColor(row.deliveryPercentage)}`}>
                    {row.deliveryPercentage}%
                  </td>
                  <td className="py-2 px-1 text-center border-2 border-black font-medium">
                    {getSequentialRouteNumber(row.driver, row.id, localData)}
                  </td>
                  <td className="py-2 px-1 text-center border-2 border-black font-medium">{row.totalOrders}</td>
                  <td className="py-2 px-1 text-center border-2 border-black font-medium">{row.delivered}</td>
                  <td className="py-2 px-1 text-center border-2 border-black font-medium">{row.pending}</td>
                  <td className="py-2 px-1 text-center border-2 border-black font-medium">{row.unsuccessful}</td>
                  <td className={`py-2 px-1 text-center border-2 border-black ${getRoutePercentageBackgroundColor(row.routePercentage)} ${getRoutePercentageTextColor(row.routePercentage)}`}>
                    {row.routePercentage}%
                  </td>
                </tr>
                {expandedRows[row.id] && row.serviceCodes.length > 0 && (
                  <tr>
                    <td colSpan={8} className="border-2 border-black bg-orange-50/30 p-0">
                      <div className="p-4 animate-fadeIn">
                        <h4 className="font-semibold text-gray-700 mb-2">Códigos de Serviço:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {row.serviceCodes.map((code, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <div
                                className={`flex-1 p-2 rounded border border-gray-200 text-center transition-colors ${getCodeStyle(code, row)}`}
                              >
                                {code}
                              </div>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateDeliveryStatus(row.id, code, 'success')}
                                  className="bg-green-500 hover:bg-green-600 text-white p-1 rounded"
                                  title="Marcar como entregue"
                                  aria-label={`Marcar ${code} como entregue`}
                                >
                                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateDeliveryStatus(row.id, code, 'unsuccessful')}
                                  className="bg-red-500 hover:bg-red-600 text-white p-1 rounded"
                                  title="Marcar como não entregue"
                                  aria-label={`Marcar ${code} como não entregue`}
                                >
                                  <XCircle className="w-4 h-4" aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeliveryTable;