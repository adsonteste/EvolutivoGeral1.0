import { v4 as uuidv4 } from 'uuid';
import { DeliveryData, ImportedRow, Region } from '../types';

// Função para detectar se é arquivo TMS
function isTMSFile(rawData: ImportedRow[]): boolean {
  if (rawData.length === 0) return false;

  const firstRows = rawData.slice(0, 5);

  let hasMotorista = false;
  let hasQuantidadeVolumes = false;
  let hasUsuarioCarregamento = false;

  for (const row of firstRows) {
    Object.values(row).forEach(value => {
      if (value && typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (lowerValue.includes('motorista')) hasMotorista = true;
        if (lowerValue.includes('quantidade') && lowerValue.includes('volumes')) hasQuantidadeVolumes = true;
        if (lowerValue.includes('usuário') && lowerValue.includes('carregamento')) hasUsuarioCarregamento = true;
      }
    });
  }

  return (hasMotorista && hasQuantidadeVolumes) ||
         (hasMotorista && hasUsuarioCarregamento) ||
         (hasQuantidadeVolumes && hasUsuarioCarregamento);
}

// Função para determinar região usando a coluna K (Filial)
function determineTMSRegionByFilial(filial: string, motorista: string, usuarioCarregamento: string): Region {
  const filialUpper = filial?.toUpperCase() || '';

  if (filialUpper === 'R2PP PARI') return 'São Paulo';
  if (filialUpper === 'R2PP PAVUNA') return 'Rio De Janeiro';

  return 'Dafiti';
}

// Função para processar dados TMS
function processTMSData(rawData: ImportedRow[]): DeliveryData[] {
  let headerRowIndex = -1;

  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const row = rawData[i];
    const idCargaValue = row.A?.toString().toLowerCase() || '';
    const motoristaValue = row.F?.toString().toLowerCase() || '';
    const quantidadeValue = row.P?.toString().toLowerCase() || '';
    const usuarioValue = row.Q?.toString().toLowerCase() || '';

    if ((idCargaValue.includes('id') && idCargaValue.includes('carga')) &&
        motoristaValue.includes('motorista') &&
        quantidadeValue.includes('quantidade') &&
        usuarioValue.includes('usuário')) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return [];

  const dataRows = rawData.slice(headerRowIndex + 1);
  const result: DeliveryData[] = [];

  dataRows.forEach(row => {
    const idCarga = row.A?.toString()?.trim();
    let motorista = row.F?.toString()?.trim();
    const quantidadeVolumes = parseInt(row.P?.toString() || '0');
    const usuarioCarregamento = row.Q?.toString()?.trim() || '';
    const filial = row.K?.toString()?.trim() || '';

    if (!motorista || motorista === '') motorista = idCarga || 'ID não identificado';

    if (idCarga && motorista && quantidadeVolumes > 0) {
      const region = determineTMSRegionByFilial(filial, motorista, usuarioCarregamento);

      result.push({
        id: idCarga,
        driver: motorista,
        totalOrders: quantidadeVolumes,
        region,
        routes: 1,
        delivered: 0,
        pending: quantidadeVolumes,
        unsuccessful: 0,
        deliveryPercentage: 0,
        routePercentage: 0,
        serviceCodes: [],
        successfulCodes: [],
        unsuccessfulCodes: [],
        senderMap: {}
      });
    }
  });

  const ignoredDrivers = [
    'Aroldo Moreira da Silva Junior',
    'Elisama de Oliveira Pereira',
    'Joao Batista Carneiro',
    'Edson Rodrigues de Figueiredo',
    'Gabriel Silva de Figueiredo'
  ];

  return result
    .filter(driver => !ignoredDrivers.some(name => driver.driver.toLowerCase().includes(name.toLowerCase())))
    .sort((a, b) => a.deliveryPercentage - b.deliveryPercentage);
}

const dafitiBrokers = [
  'Aroldo Moreira da Silva Junior',
  'Elisama de Oliveira Pereira',
  'Joao Batista Carneiro',
  'Edson Rodrigues de Figueiredo',
  'Gabriel Silva de Figueiredo'
];

function determineRegion(veiculo: string | undefined, localInicio: string | undefined, driver: string): Region {
  if (dafitiBrokers.includes(driver)) return 'Dafiti';

  const veiculoUpper = veiculo?.toUpperCase() || '';
  const localInicioUpper = localInicio?.toUpperCase() || '';

  if (veiculoUpper.includes('NESPRESSO') || localInicioUpper.includes('NESPRESSO')) return 'Nespresso';
  if ((veiculoUpper.includes('SP') && localInicioUpper.includes('PARI')) ||
      (veiculoUpper.includes('PARI') || localInicioUpper.includes('SP'))) return 'São Paulo';
  if ((veiculoUpper.includes('BARUERI') && localInicioUpper.includes('BARUERI')) ||
      (veiculoUpper.includes('BARUERI') || localInicioUpper.includes('BARUERI'))) return 'Dafiti';
  if ((veiculoUpper.includes('RJ') && localInicioUpper.includes('CRISTOVAO')) ||
      (veiculoUpper.includes('RJ') || localInicioUpper.includes('RJ'))) return 'Rio De Janeiro';

  return 'Dafiti';
}

export function processExcelData(rawData: ImportedRow[]): DeliveryData[] {
  if (isTMSFile(rawData)) return processTMSData(rawData);

  const driversMap = new Map<string, Array<{ region: Region; codes: string[]; titles: string[]; veiculo?: string; localInicio?: string }>>();
  let currentDriver = '';

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row.A) continue;

    const cellA = String(row.A);
    if (cellA.includes('Agente:') && row.B) {
      currentDriver = row.B;
      if (!driversMap.has(currentDriver)) driversMap.set(currentDriver, []);
      driversMap.get(currentDriver)?.push({ region: 'Dafiti', codes: [], titles: [] });
    } else if (cellA.includes('Veículo:') && row.B && currentDriver) {
      const driverRoutes = driversMap.get(currentDriver);
      if (driverRoutes && driverRoutes.length > 0) driverRoutes[driverRoutes.length - 1].veiculo = row.B;
    } else if (cellA.includes('Início:') && row.B && currentDriver) {
      const driverRoutes = driversMap.get(currentDriver);
      if (driverRoutes && driverRoutes.length > 0) driverRoutes[driverRoutes.length - 1].localInicio = row.B;
    } else if ((row.G || row.H) && currentDriver) {
      const driverRoutes = driversMap.get(currentDriver);
      if (driverRoutes && driverRoutes.length > 0) {
        const isDafitiBroker = dafitiBrokers.includes(currentDriver);
        let code = row.G?.toString() || '';
        if (!code || code.trim() === '') code = row.H?.toString() || '';

        if (isDafitiBroker && row.H) {
          driverRoutes[driverRoutes.length - 1].codes.push(row.H);
          driverRoutes[driverRoutes.length - 1].titles.push(row.H);
        } else if (code) {
          driverRoutes[driverRoutes.length - 1].codes.push(code);
          driverRoutes[driverRoutes.length - 1].titles.push(row.H || '');
        }
      }
    }
  }

  const result: DeliveryData[] = [];
  driversMap.forEach((routes, driver) => {
    routes.forEach((data) => {
      const isDafitiBroker = dafitiBrokers.includes(driver);
      const totalOrders = isDafitiBroker ? data.titles.length : data.codes.length;
      const region = determineRegion(data.veiculo, data.localInicio, driver);

      result.push({
        id: uuidv4(),
        driver,
        totalOrders,
        region,
        routes: routes.length,
        delivered: 0,
        pending: totalOrders,
        unsuccessful: 0,
        deliveryPercentage: 0,
        routePercentage: 0,
        serviceCodes: isDafitiBroker ? data.titles : data.codes,
        successfulCodes: [],
        unsuccessfulCodes: [],
        senderMap: {}
      });
    });
  });

  return result.sort((a, b) => a.deliveryPercentage - b.deliveryPercentage);
}

function parseDateTime(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  dateStr = dateStr.split('+')[0].trim();
  const formats = [
    { regex: /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/, order: [3,2,1,4,5,6] },
    { regex: /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/, order: [1,2,3,4,5,6] },
    { regex: /(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/, order: [0,2,1,4,5,6] }
  ];

  for (const format of formats) {
    const match = dateStr.match(format.regex);
    if (match) {
      const parts = match.slice(1).map(part => part ? parseInt(part) : 0);
      const [year, month, day, hour, minute, second] = format.order.map(i => parts[i] || 0);
      const fullYear = year < 100 ? 2000 + year : year;
      return new Date(fullYear, month - 1, day, hour, minute, second);
    }
  }

  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) return isoDate;

  return new Date(0);
}

interface StatusEntry {
  status: string;
  timestamp: Date;
  sender: string;
  allTimestamps: Array<{ timestamp: Date; status: string; rawDate: string; agent?: string; title?: string; sender?: string }>;
}

export function updateDeliveryStatus(currentData: DeliveryData[], statusData: ImportedRow[]): DeliveryData[] {
  const isTMSStatusFile = statusData.some(entry => {
    return entry['A'] || entry['AI'] || entry['AJ'] ||
      Object.keys(entry).some(key =>
        key.toLowerCase().includes('carga') ||
        key.toLowerCase().includes('entregues') ||
        key.toLowerCase().includes('baixas')
      );
  });

  if (isTMSStatusFile) return updateTMSDeliveryStatus(currentData, statusData);
  return updateVUUPTDeliveryStatus(currentData, statusData);
}

function updateTMSDeliveryStatus(currentData: DeliveryData[], statusData: ImportedRow[]): DeliveryData[] {
  const tmsStatusMap = new Map<string, { entregues: number; baixas: number; motorista?: string }>();

  statusData.forEach(row => {
    const idCarga = row.A?.toString()?.trim() || row['ID Carga']?.toString()?.trim();
    const motorista = row.F?.toString()?.trim() || row['Motorista']?.toString()?.trim();
    const entregues = parseInt(row.AI?.toString() || row['Entregues']?.toString() || '0');
    const baixas = parseInt(row.AJ?.toString() || row['Baixas']?.toString() || '0');

    if (idCarga && !isNaN(entregues)) {
      tmsStatusMap.set(idCarga, { entregues, baixas, motorista });
    }
  });

  return currentData.map(driver => {
    const statusEntry = tmsStatusMap.get(driver.id);
    if (!statusEntry) return driver;

    const { entregues, baixas } = statusEntry;
    const delivered = entregues;
    let unsuccessful = 0;
    let pending = 0;

    if (baixas === entregues) pending = Math.max(0, driver.totalOrders - baixas);
    else if (baixas > entregues) { unsuccessful = baixas - entregues; pending = Math.max(0, driver.totalOrders - baixas); }
    else pending = Math.max(0, driver.totalOrders - entregues);

    const deliveryPercentage = driver.totalOrders > 0 ? Math.round((delivered / driver.totalOrders) * 100) : 0;
    const routePercentage = driver.totalOrders > 0 ? Math.round(((delivered + unsuccessful) / driver.totalOrders) * 100) : 0;

    return { ...driver, delivered, unsuccessful, pending, deliveryPercentage, routePercentage, successfulCodes: [], unsuccessfulCodes: [], senderMap: {} };
  });
}

function updateVUUPTDeliveryStatus(currentData: DeliveryData[], statusData: ImportedRow[]): DeliveryData[] {
  const statusMap = new Map<string, StatusEntry>();

  statusData.forEach(entry => {
    let code = entry['Código']?.toString() || entry['Titulo']?.toString() || '';
    const title = entry['Titulo']?.toString() || '';
    const status = entry['Situação - Finalizado']?.toString().toLowerCase() || '';
    const sender = entry['F']?.toString() || 'Não especificado';
    const dateStr = String(entry['Horários (execução) - Concluído'] || '');
    const agent = entry['Agente']?.toString() || 'Não especificado';
    const timestamp = parseDateTime(dateStr);
    const finalCode = dafitiBrokers.includes(agent) ? title : code;

    if (!finalCode) return;

    if (statusMap.has(finalCode)) {
      const existing = statusMap.get(finalCode)!;
      existing.allTimestamps.push({ timestamp, status, rawDate: dateStr, agent, title, sender });
      if (timestamp > existing.timestamp) { existing.status = status; existing.timestamp = timestamp; existing.sender = sender; }
    } else {
      statusMap.set(finalCode, { status, timestamp, sender, allTimestamps: [{ timestamp, status, rawDate: dateStr, agent, title, sender }] });
    }
  });

  return currentData.map(driver => {
    let delivered = 0, unsuccessful = 0;
    const successfulCodes: string[] = [], unsuccessfulCodes: string[] = [];
    const senderMap: { [key: string]: string } = {};

    driver.serviceCodes.forEach(code => {
      const statusEntry = statusMap.get(code);
      if (statusEntry) {
        const { status, sender } = statusEntry;
        senderMap[code] = sender;

        if (status?.includes('sucesso') && !status?.includes('sem sucesso')) { delivered++; successfulCodes.push(code); }
        else if (status?.includes('sem sucesso')) { unsuccessful++; unsuccessfulCodes.push(code); }
      }
    });

    const pending = driver.totalOrders - (delivered + unsuccessful);
    const deliveryPercentage = driver.totalOrders > 0 ? Math.round((delivered / driver.totalOrders) * 100) : 0;
    const routePercentage = driver.totalOrders > 0 ? Math.round(((driver.totalOrders - pending) / driver.totalOrders) * 100) : 0;

    return { ...driver, delivered, unsuccessful, pending, deliveryPercentage, routePercentage, successfulCodes, unsuccessfulCodes, senderMap };
  });
}
