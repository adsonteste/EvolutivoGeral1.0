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
      className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${fileState.isDragging
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
        className={`px-6 py-2 rounded-md transition-colors flex items-center ${fileState.isUploaded
          ? 'bg-green-600 hover:bg-black text-white'
          : 'bg-green-600 hover:bg-black text-white'
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

      {showSecondFilePrompt ? (
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full animate-fadeIn">
         
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 w-full max-w-6xl animate-fadeIn">
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


    </div>
  );
};

export default ImportPanel;