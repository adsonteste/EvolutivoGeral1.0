import React, { useState } from 'react';
import { FileDown, X } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { DeliveryData } from '../types';

interface ExportButtonProps {
  data: DeliveryData[];
}

interface SenderReport {
  remetente: string;
  motorista: string;
  status: 'Sucesso' | 'Sem Sucesso';
  codigo: string;
}

const SENDERS = [
  'Dafiti MR',
  'Nespresso - Last Mile',
  'Riachuelo',
  'Mary Kay - Barueri',
  'Infracommerce'
];

const ExportButton: React.FC<ExportButtonProps> = ({ data }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSenders, setSelectedSenders] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'success' | 'failure'>('all');

  const handleSenderToggle = (sender: string) => {
    setSelectedSenders(prev =>
      prev.includes(sender)
        ? prev.filter(s => s !== sender)
        : [...prev, sender]
    );
  };

  const generateReport = () => {
    const report: SenderReport[] = [];

    data.forEach(delivery => {
      const processCode = (code: string, isSuccess: boolean) => {
        const sender = delivery.senderMap[code] || 'Não especificado';
        
        if (selectedSenders.length > 0 && !selectedSenders.includes(sender)) {
          return;
        }

        if (
          selectedStatus === 'success' && !isSuccess ||
          selectedStatus === 'failure' && isSuccess
        ) {
          return;
        }

        report.push({
          remetente: sender,
          motorista: delivery.driver,
          status: isSuccess ? 'Sucesso' : 'Sem Sucesso',
          codigo: code
        });
      };

      // Process based on selected status
      if (selectedStatus !== 'failure') {
        delivery.successfulCodes.forEach(code => processCode(code, true));
      }
      if (selectedStatus !== 'success') {
        delivery.unsuccessfulCodes.forEach(code => processCode(code, false));
      }
    });

    // Create workbook and worksheet
    const wb = utils.book_new();
    const ws = utils.json_to_sheet(report);

    // Add column widths
    const colWidths = [
      { wch: 25 }, // remetente
      { wch: 30 }, // motorista
      { wch: 15 }, // status
      { wch: 20 }, // codigo
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    utils.book_append_sheet(wb, ws, 'Relatório por Remetente');

    // Generate filename with current date
    const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const fileName = `relatorio-evolutivo-${date}.xlsx`;

    // Save file
    writeFile(wb, fileName);
    setIsModalOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-all flex items-center gap-2"
      >
        <FileDown className="w-4 h-4" />
        Exportar Relatório
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Exportar Relatório</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <h3 className="font-medium mb-2">Status de Entrega:</h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="status"
                    checked={selectedStatus === 'all'}
                    onChange={() => setSelectedStatus('all')}
                    className="text-blue-600"
                  />
                  Todos
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="status"
                    checked={selectedStatus === 'success'}
                    onChange={() => setSelectedStatus('success')}
                    className="text-blue-600"
                  />
                  Sucesso
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="status"
                    checked={selectedStatus === 'failure'}
                    onChange={() => setSelectedStatus('failure')}
                    className="text-blue-600"
                  />
                  Sem Sucesso
                </label>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-medium mb-2">Remetentes:</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {SENDERS.map(sender => (
                  <label key={sender} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedSenders.includes(sender)}
                      onChange={() => handleSenderToggle(sender)}
                      className="text-blue-600"
                    />
                    {sender}
                  </label>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {selectedSenders.length === 0 ? "Caixa Vazia todos os remetentes serão incluídos" : ""}
              </p>
            </div>

            <button
              onClick={generateReport}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Gerar Relatório
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ExportButton;