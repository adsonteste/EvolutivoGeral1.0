import React, { useRef, useState } from 'react';
import { FileUp, X, CheckCircle } from 'lucide-react';
import { read, utils } from 'xlsx';

interface ImportStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[]) => void;
}

interface FileUploadState {
  file: File | null;
  fileName: string;
  isUploaded: boolean;
  isDragging: boolean;
}

const ImportStatusModal: React.FC<ImportStatusModalProps> = ({ isOpen, onClose, onImport }) => {
  const [vuuptFile, setVuuptFile] = useState<FileUploadState>({
    file: null,
    fileName: '',
    isUploaded: false,
    isDragging: false
  });

  const [tmsFile, setTmsFile] = useState<FileUploadState>({
    file: null,
    fileName: '',
    isUploaded: false,
    isDragging: false
  });

  const [showSecondFilePrompt, setShowSecondFilePrompt] = useState(false);
  const [firstFileData, setFirstFileData] = useState<any[]>([]);
  const [canProcessFiles, setCanProcessFiles] = useState(false);
  const vuuptInputRef = useRef<HTMLInputElement>(null);
  const tmsInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, fileType: 'vuupt' | 'tms') => {
    e.preventDefault();
    if (fileType === 'vuupt') {
      setVuuptFile(prev => ({ ...prev, isDragging: true }));
    } else {
      setTmsFile(prev => ({ ...prev, isDragging: true }));
    }
  };

  const handleDragLeave = (fileType: 'vuupt' | 'tms') => {
    if (fileType === 'vuupt') {
      setVuuptFile(prev => ({ ...prev, isDragging: false }));
    } else {
      setTmsFile(prev => ({ ...prev, isDragging: false }));
    }
  };

  const processExcel = (file: File, fileType: 'vuupt' | 'tms') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = utils.sheet_to_json(worksheet);
        
        if (fileType === 'vuupt') {
          setVuuptFile(prev => ({ ...prev, file, fileName: file.name, isUploaded: true }));
          setFirstFileData(jsonData);
          setShowSecondFilePrompt(true);
        } else {
          setTmsFile(prev => ({ ...prev, file, fileName: file.name, isUploaded: true }));
          setCanProcessFiles(true);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, fileType: 'vuupt' | 'tms') => {
    e.preventDefault();
    
    if (fileType === 'vuupt') {
      setVuuptFile(prev => ({ ...prev, isDragging: false }));
    } else {
      setTmsFile(prev => ({ ...prev, isDragging: false }));
    }
    
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      processExcel(file, fileType);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'vuupt' | 'tms') => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processExcel(file, fileType);
    }
  };

  const handleButtonClick = (fileType: 'vuupt' | 'tms') => {
    if (fileType === 'vuupt') {
      vuuptInputRef.current?.click();
    } else {
      tmsInputRef.current?.click();
    }
  };

  const handleSecondFileChoice = (wantsSecondFile: boolean) => {
    if (wantsSecondFile) {
      setShowSecondFilePrompt(false);
      // Usuário quer importar o segundo arquivo, aguarda o upload
    } else {
      // Usuário não quer o segundo arquivo, processa apenas o primeiro
      setShowSecondFilePrompt(false);
      onImport(firstFileData);
      onClose();
    }
  };

  const handleProcessFiles = () => {
    // Combina os dados de ambos os arquivos se disponíveis
    let combinedData: any[] = [];
    
    if (firstFileData.length > 0) {
      combinedData = [...combinedData, ...firstFileData];
    }
    
    if (tmsFile.file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          const workbook = read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = utils.sheet_to_json(worksheet);
          
          const finalData = [...combinedData, ...jsonData];
          onImport(finalData);
          onClose();
        }
      };
      reader.readAsArrayBuffer(tmsFile.file);
    } else {
      // Se só tem dados do primeiro arquivo
      onImport(combinedData);
      onClose();
    }
  };

  const FileUploadArea: React.FC<{
    fileState: FileUploadState;
    fileType: 'vuupt' | 'tms';
    title: string;
    description: string;
  }> = ({ fileState, fileType, title, description }) => (
    <div
      className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-all cursor-pointer ${
        fileState.isDragging 
          ? 'border-blue-500 bg-blue-50' 
          : fileState.isUploaded
          ? 'border-green-500 bg-green-50'
          : 'border-gray-300 bg-white hover:border-gray-400'
      }`}
      onDragOver={(e) => handleDragOver(e, fileType)}
      onDragLeave={() => handleDragLeave(fileType)}
      onDrop={(e) => handleDrop(e, fileType)}
      onClick={() => handleButtonClick(fileType)}
    >
      {fileState.isUploaded ? (
        <CheckCircle className="w-8 h-8 text-green-500 mb-3" />
      ) : (
        <FileUp className="w-8 h-8 text-blue-500 mb-3" />
      )}
      
      <h3 className="text-md font-medium text-gray-700 mb-2">
        {title}
      </h3>
      
      {fileState.fileName ? (
        <p className="text-green-600 font-medium mb-2 text-sm text-center">{fileState.fileName}</p>
      ) : (
        <p className="text-gray-500 text-center mb-3 text-sm">
          {description}
        </p>
      )}

      <input
        type="file"
        ref={fileType === 'vuupt' ? vuuptInputRef : tmsInputRef}
        className="hidden"
        accept=".xlsx,.xls"
        onChange={(e) => handleFileChange(e, fileType)}
      />

      <button
        className={`px-4 py-2 rounded-md transition-colors flex items-center text-sm ${
          fileState.isUploaded
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          handleButtonClick(fileType);
        }}
      >
        <FileUp className="w-4 h-4 mr-2" />
        {fileState.isUploaded ? 'Arquivo Carregado' : 'Selecionar Arquivo'}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Importar Status de Entregas</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {showSecondFilePrompt ? (
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto animate-fadeIn">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
              Primeiro arquivo importado com sucesso!
            </h3>
            <p className="text-gray-600 mb-6 text-center">
              Deseja importar o segundo arquivo de status (TMS)?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => handleSecondFileChoice(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Sim
              </button>
              <button
                onClick={() => handleSecondFileChoice(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Não
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <FileUploadArea
                fileState={vuuptFile}
                fileType="vuupt"
                title="Status VUUPT"
                description="Arraste e solte seu arquivo de status VUUPT aqui"
              />

              <FileUploadArea
                fileState={tmsFile}
                fileType="tms"
                title="Status TMS"
                description="Arraste e solte seu arquivo de status TMS aqui"
              />
            </div>

            {(canProcessFiles || (tmsFile.isUploaded && !vuuptFile.isUploaded && !showSecondFilePrompt)) && (
              <div className="text-center animate-fadeIn">
                <button
                  onClick={handleProcessFiles}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 shadow-lg"
                >
                  Processar Status e Continuar
                </button>
              </div>
            )}

            <div className="text-center text-sm text-gray-500 mt-6">
              <p className="mb-2">
                <strong>Instruções:</strong>
              </p>
              <ul className="text-left space-y-1 max-w-2xl mx-auto">
                <li>• Você pode fazer upload apenas do arquivo de status VUUPT</li>
                <li>• Você pode fazer upload apenas do arquivo de status TMS</li>
                <li>• Ou fazer upload de ambos os arquivos de status</li>
                <li>• Se fizer upload do VUUPT primeiro, o sistema perguntará se deseja importar o TMS</li>
                <li>• Ambos os arquivos devem estar no formato Excel (.xlsx ou .xls)</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportStatusModal;