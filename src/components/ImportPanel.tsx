import React, { useRef, useState } from 'react';
import { FileUp, Upload, CheckCircle } from 'lucide-react';
import { read, utils } from 'xlsx';
import { ImportedRow } from '../types';

interface ImportPanelProps {
  onFileUpload: (data: ImportedRow[]) => void;
}

interface FileUploadState {
  file: File | null;
  fileName: string;
  isUploaded: boolean;
  isDragging: boolean;
}

const ImportPanel: React.FC<ImportPanelProps> = ({ onFileUpload }) => {
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
  const [firstFileData, setFirstFileData] = useState<ImportedRow[]>([]);
  const [canProcessFiles, setCanProcessFiles] = useState(false);
  const vuuptInputRef = useRef<HTMLInputElement>(null);
  const tmsInputRef = useRef<HTMLInputElement>(null);

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
        const jsonData = utils.sheet_to_json<ImportedRow>(worksheet, { header: 'A' });
        
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
      onFileUpload(firstFileData);
    }
  };

  const handleProcessFiles = () => {
    // Processa ambos os arquivos se disponíveis
    if (firstFileData.length > 0 && tmsFile.file) {
      // Processa primeiro o arquivo VUUPT
      onFileUpload(firstFileData);
      
      // Depois processa o arquivo TMS
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          const workbook = read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = utils.sheet_to_json<ImportedRow>(worksheet, { header: 'A' });
          onFileUpload(jsonData);
        }
      };
      reader.readAsArrayBuffer(tmsFile.file);
    } else if (firstFileData.length > 0) {
      // Se só tem VUUPT
      onFileUpload(firstFileData);
    } else if (tmsFile.file) {
      // Se só tem TMS, processa os dados do TMS
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          const workbook = read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = utils.sheet_to_json<ImportedRow>(worksheet, { header: 'A' });
          onFileUpload(jsonData);
        }
      };
      reader.readAsArrayBuffer(tmsFile.file);
    }
  };

  const FileUploadArea: React.FC<{
    fileState: FileUploadState;
    fileType: 'vuupt' | 'tms';
    title: string;
    description: string;
  }> = ({ fileState, fileType, title, description }) => (
    <div
      className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${
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
        <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
      ) : (
        <FileUp className="w-12 h-12 text-blue-500 mb-4" />
      )}
      
      <h3 className="text-lg font-medium text-gray-700 mb-2">
        {title}
      </h3>
      
      {fileState.fileName ? (
        <p className="text-green-600 font-medium mb-2">{fileState.fileName}</p>
      ) : (
        <p className="text-gray-500 text-center mb-4">
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
        className={`px-6 py-2 rounded-md transition-colors flex items-center ${
          fileState.isUploaded
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          handleButtonClick(fileType);
        }}
      >
        <Upload className="w-4 h-4 mr-2" />
        {fileState.isUploaded ? 'Arquivo Carregado' : 'Selecionar Arquivo'}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Sistema de Gestão de Entrega
        </h2>
        <p className="text-gray-600 text-lg">
          Faça o upload dos arquivos VUUPT e TMS para começar o monitoramento
        </p>
      </div>

      {showSecondFilePrompt ? (
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full animate-fadeIn">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            Primeiro arquivo importado com sucesso!
          </h3>
          <p className="text-gray-600 mb-6 text-center">
            Deseja importar o segundo arquivo (TMS)?
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl">
          <FileUploadArea
            fileState={vuuptFile}
            fileType="vuupt"
            title="Arquivo VUUPT"
            description="Arraste e solte seu arquivo VUUPT aqui ou clique para selecionar"
          />

          <FileUploadArea
            fileState={tmsFile}
            fileType="tms"
            title="Arquivo TMS"
            description="Arraste e solte seu arquivo TMS aqui ou clique para selecionar"
          />
        </div>
      )}

      {(canProcessFiles || (tmsFile.isUploaded && !vuuptFile.isUploaded && !showSecondFilePrompt)) && (
        <div className="animate-fadeIn">
          <button
            onClick={handleProcessFiles}
            className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 shadow-lg"
          >
            Processar Dados e Continuar
          </button>
        </div>
      )}

      <div className="text-center text-sm text-gray-500 max-w-2xl">
        <p className="mb-2">
          <strong>Instruções:</strong>
        </p>
        <ul className="text-left space-y-1">
          <li>• Você pode fazer upload apenas do arquivo VUUPT</li>
          <li>• Você pode fazer upload apenas do arquivo TMS</li>
          <li>• Ou fazer upload de ambos os arquivos</li>
          <li>• Se fizer upload do VUUPT primeiro, o sistema perguntará se deseja importar o TMS</li>
          <li>• Ambos os arquivos devem estar no formato Excel (.xlsx ou .xls)</li>
        </ul>
      </div>
    </div>
  );
};

export default ImportPanel;