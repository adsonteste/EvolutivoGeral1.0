import { v4 as uuidv4 } from 'uuid';
import { DeliveryData, ImportedRow, Region } from '../types';

// Função para detectar se é arquivo TMS
function isTMSFile(rawData: ImportedRow[]): boolean {
  if (rawData.length === 0) return false;

  // Verifica as primeiras linhas para encontrar os cabeçalhos
  const firstRows = rawData.slice(0, 5);

  let hasMotorista = false;
  let hasQuantidadeVolumes = false;
  let hasUsuarioCarregamento = false;

  for (const row of firstRows) {
    // Verifica todas as colunas da linha
    Object.values(row).forEach(value => {
      if (value && typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (lowerValue.includes('motorista')) {
          hasMotorista = true;
        }
        if (lowerValue.includes('quantidade') && lowerValue.includes('volumes')) {
          hasQuantidadeVolumes = true;
        }
        if (lowerValue.includes('usuário') && lowerValue.includes('carregamento')) {
          hasUsuarioCarregamento = true;
        }
      }
    });
  }

  console.log('Detecção TMS:', { hasMotorista, hasQuantidadeVolumes, hasUsuarioCarregamento });

  // É TMS se tem pelo menos 2 dos 3 indicadores
  return (hasMotorista && hasQuantidadeVolumes) ||
    (hasMotorista && hasUsuarioCarregamento) ||
    (hasQuantidadeVolumes && hasUsuarioCarregamento);
}

// Função para processar dados TMS
function processTMSData(rawData: ImportedRow[]): DeliveryData[] {
  console.log('Processando dados TMS');

  // Encontra a linha de cabeçalho verificando o conteúdo das células
  let headerRowIndex = -1;

  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const row = rawData[i];

    // Verifica se esta linha contém os cabeçalhos esperados
    const idCargaValue = row.A?.toString().toLowerCase() || '';
    const motoristaValue = row.F?.toString().toLowerCase() || '';
    const quantidadeValue = row.P?.toString().toLowerCase() || '';
    const usuarioValue = row.Q?.toString().toLowerCase() || '';

    if ((idCargaValue.includes('id') && idCargaValue.includes('carga')) &&
      motoristaValue.includes('motorista') &&
      quantidadeValue.includes('quantidade') &&
      usuarioValue.includes('usuário')) {
      headerRowIndex = i;
      console.log(`Cabeçalho TMS encontrado na linha ${i}`);
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.error('Não foi possível encontrar o cabeçalho TMS nas primeiras 10 linhas');
    return [];
  }

  // Processa os dados a partir da linha após o cabeçalho
  const dataRows = rawData.slice(headerRowIndex + 1);

  const result: DeliveryData[] = [];

  dataRows.forEach(row => {
    const idCarga = row.A?.toString()?.trim();
    let motorista = row.F?.toString()?.trim();
    const quantidadeVolumes = parseInt(row.P?.toString() || '0');
    const usuarioCarregamento = row.Q?.toString()?.trim() || '';

    // Se o motorista estiver vazio, usa o ID da carga
    if (!motorista || motorista === '') {
      motorista = idCarga || 'ID não identificado';
    }

    if (idCarga && motorista && quantidadeVolumes > 0) {
      const region = determineTMSRegion(motorista, usuarioCarregamento);

      // Gera códigos de serviço baseados no ID da carga e quantidade de volumes
      const serviceCodes: string[] = [];

      for (let i = 1; i <= quantidadeVolumes; i++) {
        serviceCodes.push(`${idCarga}-VOL-${i}`);
      }

      result.push({
        id: idCarga, // Usa o ID da carga como identificador único
        driver: motorista,
        totalOrders: quantidadeVolumes,
        region: region,
        routes: 1, // Cada entrada é uma rota individual
        delivered: 0,
        pending: quantidadeVolumes,
        unsuccessful: 0,
        deliveryPercentage: 0,
        routePercentage: 0,
        serviceCodes: [], // Remove códigos automáticos do TMS
        successfulCodes: [],
        unsuccessfulCodes: [],
        senderMap: {}
      });
    }
  });

  //Excluir motoristas dafiti do evolutivo
  const ignoredDrivers = [
  'Aroldo Moreira da Silva Junior',
  'Elisama de Oliveira Pereira',
  'João Batista Carneiro',
  'Edson Rodrigues de Figueiredo',
  'Gabriel Silva de Figueiredo'
];

  const filteredResult = result.filter(driver =>
    !ignoredDrivers.some(name =>
      driver.driver.toLowerCase().includes(name.toLowerCase())
    )
  );

  console.log(`Processadas ${result.length} entradas do arquivo TMS`);
  console.log(`Filtradas ${result.length - filteredResult.length} entradas (motoristas ignorados)`);

  return filteredResult.sort((a, b) => a.deliveryPercentage - b.deliveryPercentage);
}

const dafitiBrokers = [
  'Aroldo Moreira da Silva Junior',
  'Elisama de Oliveira Pereira',
  'Joao Batista Carneiro',
  'Edson Rodrigues de Figueiredo',
  'Gabriel Silva de Figueiredo'
];

function determineRegion(veiculo: string | undefined, localInicio: string | undefined, driver: string): Region {
  if (dafitiBrokers.includes(driver)) {
    return 'Dafiti';
  }

  const veiculoUpper = veiculo?.toUpperCase() || '';
  const localInicioUpper = localInicio?.toUpperCase() || '';

  if (veiculoUpper.includes('NESPRESSO') || localInicioUpper.includes('NESPRESSO')) {
    return 'Nespresso';
  }

  if ((veiculoUpper.includes('SP') && localInicioUpper.includes('PARI')) ||
    (veiculoUpper.includes('PARI') || localInicioUpper.includes('SP'))) {
    return 'São Paulo';
  }

  if ((veiculoUpper.includes('BARUERI') && localInicioUpper.includes('BARUERI')) ||
    (veiculoUpper.includes('BARUERI') || localInicioUpper.includes('BARUERI'))) {
    return 'Dafiti';
  }

  if ((veiculoUpper.includes('RJ') && localInicioUpper.includes('CRISTOVAO')) ||
    (veiculoUpper.includes('RJ') || localInicioUpper.includes('RJ'))) {
    return 'Rio De Janeiro';
  }

  return 'Dafiti';
}

// Função específica para determinar região dos dados TMS
function determineTMSRegion(motorista: string, usuarioCarregamento: string): Region {
  const motoristaUpper = motorista.toUpperCase();
  const usuarioUpper = usuarioCarregamento.toUpperCase();

  // Verifica se é Nespresso
  if (motoristaUpper.includes('NESPRESSO') || usuarioUpper.includes('NESPRESSO')) {
    return 'Nespresso';
  }

  // Verifica se é São Paulo
  if (motoristaUpper.includes('SP') || usuarioUpper.includes('SP') ||
    motoristaUpper.includes('SAO PAULO') || usuarioUpper.includes('SAO PAULO') ||
    motoristaUpper.includes('PARI') || usuarioUpper.includes('PARI')) {
    return 'São Paulo';
  }

  // Verifica se é Rio de Janeiro
  if (motoristaUpper.includes('RJ') || usuarioUpper.includes('RJ') ||
    motoristaUpper.includes('RIO') || usuarioUpper.includes('RIO') ||
    motoristaUpper.includes('CRISTOVAO') || usuarioUpper.includes('CRISTOVAO')) {
    return 'Rio De Janeiro';
  }

  // Verifica se é Dafiti (Barueri)
  if (motoristaUpper.includes('BARUERI') || usuarioUpper.includes('BARUERI') ||
    motoristaUpper.includes('DAFITI') || usuarioUpper.includes('DAFITI')) {
    return 'Dafiti';
  }

  // Se não conseguir determinar pela nomenclatura, tenta por padrões comuns
  // Motoristas que começam com certas letras ou padrões podem indicar região

  // Default para São Paulo se não conseguir determinar
  return 'São Paulo';
}
export function processExcelData(rawData: ImportedRow[]): DeliveryData[] {
  console.log('Iniciando processamento de dados Excel');

  // Verifica se é arquivo TMS
  if (isTMSFile(rawData)) {
    return processTMSData(rawData);
  }

  console.log('Processando dados VUUPT');

  const driversMap = new Map<string, Array<{
    region: Region;
    codes: string[];
    titles: string[];
    veiculo?: string;
    localInicio?: string;
  }>>();

  let currentDriver = '';

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row.A) continue;

    const cellA = String(row.A);

    if (cellA.includes('Agente:') && row.B) {
      currentDriver = row.B;
      if (!driversMap.has(currentDriver)) {
        driversMap.set(currentDriver, []);
      }
      // Add a new route entry for this driver
      driversMap.get(currentDriver)?.push({
        region: 'Dafiti',
        codes: [],
        titles: []
      });
    }
    else if (cellA.includes('Veículo:') && row.B && currentDriver) {
      const driverRoutes = driversMap.get(currentDriver);
      if (driverRoutes && driverRoutes.length > 0) {
        driverRoutes[driverRoutes.length - 1].veiculo = row.B;
      }
    }
    else if (cellA.includes('Início:') && row.B && currentDriver) {
      const driverRoutes = driversMap.get(currentDriver);
      if (driverRoutes && driverRoutes.length > 0) {
        driverRoutes[driverRoutes.length - 1].localInicio = row.B;
      }
    }
    else if ((row.G || row.H) && currentDriver) {
      const driverRoutes = driversMap.get(currentDriver);
      if (driverRoutes && driverRoutes.length > 0) {
        const isDafitiBroker = dafitiBrokers.includes(currentDriver);

        // Primeiro tenta buscar o código na coluna G
        let code = row.G?.toString() || '';

        // Se o código estiver vazio, usa o título da coluna H
        if (!code || code.trim() === '') {
          code = row.H?.toString() || '';
        }

        // Para Dafiti brokers, sempre usa o título (coluna H)
        if (isDafitiBroker && row.H) {
          driverRoutes[driverRoutes.length - 1].codes.push(row.H);
          driverRoutes[driverRoutes.length - 1].titles.push(row.H);
        } else if (code) {
          // Para outros motoristas, usa o código encontrado (G ou H se G estiver vazio)
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
      const delivered = 0;
      const pending = totalOrders;
      const unsuccessful = 0;
      const deliveryPercentage = 0;
      const routePercentage = 0;
      const region = determineRegion(data.veiculo, data.localInicio, driver);

      result.push({
        id: uuidv4(),
        driver: driver,
        totalOrders,
        region,
        routes: routes.length,
        delivered,
        pending,
        unsuccessful,
        deliveryPercentage,
        routePercentage,
        serviceCodes: isDafitiBroker ? data.titles : data.codes,
        successfulCodes: [],
        unsuccessfulCodes: [],
        senderMap: {}
      });
    });
  });

  // 🔥 Adicione este trecho:
  const ignoredDrivers = [""]

  return result
    .filter(driver => !ignoredDrivers.some(name =>
      driver.driver.toLowerCase() === name.toLowerCase()
    ))
    .sort((a, b) => a.deliveryPercentage - b.deliveryPercentage);

}

function parseDateTime(dateStr: string): Date {
  if (!dateStr) return new Date(0);

  // Remove any potential timezone information
  dateStr = dateStr.split('+')[0].trim();

  // Handle different date formats
  const formats = [
    { regex: /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/, order: [3, 2, 1, 4, 5, 6] }, // DD/MM/YYYY HH:mm(:ss)
    { regex: /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/, order: [1, 2, 3, 4, 5, 6] }, // YYYY-MM-DD HH:mm(:ss)
    { regex: /(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/, order: [0, 2, 1, 4, 5, 6] }  // MM/DD/YY HH:mm(:ss)
  ];

  for (const format of formats) {
    const match = dateStr.match(format.regex);
    if (match) {
      const parts = match.slice(1).map(part => part ? parseInt(part) : 0);
      const [year, month, day, hour, minute, second] = format.order.map(i => parts[i] || 0);

      // Handle two-digit years
      const fullYear = year < 100 ? 2000 + year : year;

      return new Date(fullYear, month - 1, day, hour, minute, second);
    }
  }

  // Try parsing as ISO string
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  console.warn(`Unable to parse date: ${dateStr}`);
  return new Date(0);
}

interface StatusEntry {
  status: string;
  timestamp: Date;
  sender: string;
  allTimestamps: Array<{
    timestamp: Date;
    status: string;
    rawDate: string;
    agent?: string;
    title?: string;
    sender?: string;
  }>;
}

export function updateDeliveryStatus(currentData: DeliveryData[], statusData: ImportedRow[]): DeliveryData[] {
  // Detecta se é arquivo de status TMS
  const isTMSStatusFile = statusData.some(entry => {
    return entry['A'] || entry['AI'] || entry['AJ'] ||
      Object.keys(entry).some(key =>
        key.toLowerCase().includes('carga') ||
        key.toLowerCase().includes('entregues') ||
        key.toLowerCase().includes('baixas')
      );
  });

  if (isTMSStatusFile) {
    return updateTMSDeliveryStatus(currentData, statusData);
  }

  return updateVUUPTDeliveryStatus(currentData, statusData);
}

function updateTMSDeliveryStatus(currentData: DeliveryData[], statusData: ImportedRow[]): DeliveryData[] {
  console.log('Processando status TMS');
  console.log('Dados atuais:', currentData);
  console.log('Dados de status:', statusData);

  // Cria um mapa de status baseado no ID da carga
  const tmsStatusMap = new Map<string, { entregues: number; baixas: number; motorista?: string }>();

  // Processa todos os dados de status
  statusData.forEach((row, index) => {
    console.log(`Processando linha ${index}:`, row);

    // Tenta diferentes formas de acessar os dados
    const idCarga = row.A?.toString()?.trim() ||
      row['A']?.toString()?.trim() ||
      row['ID Carga']?.toString()?.trim() ||
      row['Id Carga']?.toString()?.trim() ||
      row['id carga']?.toString()?.trim();

    const motorista = row.F?.toString()?.trim() ||
      row['F']?.toString()?.trim() ||
      row['Motorista']?.toString()?.trim() ||
      row['motorista']?.toString()?.trim();

    const entregues = parseInt(row.AI?.toString() ||
      row['AI']?.toString() ||
      row['Entregues']?.toString() ||
      row['entregues']?.toString() ||
      '0');

    const baixas = parseInt(row.AJ?.toString() ||
      row['AJ']?.toString() ||
      row['Baixas']?.toString() ||
      row['baixas']?.toString() ||
      '0');

    console.log(`Dados extraídos - ID: ${idCarga}, Motorista: ${motorista}, Entregues: ${entregues}, Baixas: ${baixas}`);

    if (idCarga && !isNaN(entregues)) {
      tmsStatusMap.set(idCarga, {
        entregues: entregues || 0,
        baixas: baixas || 0,
        motorista: motorista
      });
      console.log(`Adicionado ao mapa - ID: ${idCarga}, Entregues: ${entregues}, Baixas: ${baixas}`);
    }
  });

  console.log('Mapa de status TMS criado:', Array.from(tmsStatusMap.entries()));

  console.log(`Processados ${tmsStatusMap.size} registros de status TMS`);

  // Atualiza os dados atuais com base no mapa de status
  const updatedData = currentData.map(driver => {
    console.log(`Verificando driver: ${driver.driver} com ID: ${driver.id}`);
    const statusEntry = tmsStatusMap.get(driver.id);
    console.log(`Status encontrado para ${driver.id}:`, statusEntry);

    if (statusEntry) {
      const { entregues, baixas } = statusEntry;

      // Lógica corrigida conforme especificação:
      // Entregues = AI (sempre)
      // Se baixas = entregues: Pendentes = total - baixas, Insucessos = 0
      // Se baixas > entregues: Entregues = AI, Insucessos = baixas - entregues, Pendentes = total - baixas
      const delivered = entregues;
      let unsuccessful = 0;
      let pending = 0;

      console.log(`>>> Cálculo para ${driver.driver}: total=${driver.totalOrders}, entregues=${entregues}, baixas=${baixas}`);


      if (baixas === entregues) {
        // Se baixas = entregues: sem insucessos, resto são pendentes
        unsuccessful = 0;
        pending = Math.max(0, driver.totalOrders - baixas);
      } else if (baixas > entregues) {
        // Se baixas > entregues: insucessos = diferença, pendentes = total - baixas
        unsuccessful = baixas - entregues;
        pending = Math.max(0, driver.totalOrders - baixas);
      } else {
        // Se baixas < entregues (caso anômalo): sem insucessos, pendentes = total - entregues
        unsuccessful = 0;
        pending = Math.max(0, driver.totalOrders - entregues);
      }

      console.log(`<<< Resultado: unsuccessful=${unsuccessful}, pending=${pending}`);


      const deliveryPercentage = driver.totalOrders > 0
        ? Math.round((delivered / driver.totalOrders) * 100)
        : 0;

      const routePercentage = driver.totalOrders > 0
        ? Math.round(((delivered + unsuccessful) / driver.totalOrders) * 100)
        : 0;

      console.log(`Atualizando ${driver.driver} (ID: ${driver.id}):`);
      console.log(`  Total: ${driver.totalOrders}`);
      console.log(`  Entregues: ${delivered}`);
      console.log(`  Baixas: ${baixas}`);
      console.log(`  Insucessos: ${unsuccessful}`);
      console.log(`  Pendentes: ${pending}`);
      console.log(`  %Entrega: ${deliveryPercentage}%, %Rota: ${routePercentage}%`);

      return {
        ...driver,
        delivered,
        unsuccessful,
        pending,
        deliveryPercentage,
        routePercentage,
        successfulCodes: [],
        unsuccessfulCodes: [],
        senderMap: {}
      };
    }

    console.log(`Nenhum status encontrado para ${driver.driver} (ID: ${driver.id})`);
    return driver;
  });

  console.log('Dados atualizados:', updatedData);
  return updatedData;
}

function updateVUUPTDeliveryStatus(currentData: DeliveryData[], statusData: ImportedRow[]): DeliveryData[] {
  console.log('Processando status VUUPT');

  const statusMap = new Map<string, StatusEntry>();

  // Process all status entries
  statusData.forEach(entry => {
    // Primeiro tenta buscar o código
    let code = entry['Código']?.toString() ||
      entry['Codigo']?.toString() ||
      entry['Code']?.toString();

    // Se o código estiver vazio, usa o título
    if (!code || code.trim() === '') {
      code = entry['H']?.toString() ||
        entry['Título']?.toString() ||
        entry['Titulo']?.toString() ||
        entry['Title']?.toString();
    }

    const title = entry['H']?.toString() ||
      entry['Título']?.toString() ||
      entry['Titulo']?.toString() ||
      entry['Title']?.toString();

    const status = entry['Situação - Finalizado']?.toString().toLowerCase() ||
      entry['Situacao - Finalizado']?.toString().toLowerCase() ||
      entry['Status']?.toString().toLowerCase();

    const sender = entry['F']?.toString() ||
      entry['Remetente']?.toString() ||
      'Não especificado';

    const dateStr = String(
      entry['Horários (execução) - Concluído'] ||
      entry['Horarios (execucao) - Concluido'] ||
      entry['Timestamp'] || ''
    );

    const agent = entry['Agente']?.toString() ||
      entry['Agent']?.toString() ||
      'Não especificado';

    const timestamp = parseDateTime(dateStr);

    // Para Dafiti brokers, usa o título como código; para outros, usa o código encontrado
    const finalCode = dafitiBrokers.includes(agent) ? title : code;

    if (!finalCode) return;

    if (statusMap.has(finalCode)) {
      const existing = statusMap.get(finalCode)!;

      // Add this entry to all timestamps
      existing.allTimestamps.push({
        timestamp,
        status,
        rawDate: dateStr,
        agent,
        title,
        sender
      });

      // Update the main status if this is more recent
      if (timestamp > existing.timestamp) {
        existing.status = status;
        existing.timestamp = timestamp;
        existing.sender = sender;
      }
    } else {
      statusMap.set(finalCode, {
        status,
        timestamp,
        sender,
        allTimestamps: [{
          timestamp,
          status,
          rawDate: dateStr,
          agent,
          title,
          sender
        }]
      });
    }
  });

  // Log detailed information about duplicate entries
  console.group('Análise de Códigos Duplicados');
  statusMap.forEach((value, code) => {
    if (value.allTimestamps.length > 1) {
      console.group(`\nCódigo/Título ${code} (${value.allTimestamps.length} entradas):`);

      // Sort timestamps in descending order
      const sortedEntries = [...value.allTimestamps]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      sortedEntries.forEach((entry, index) => {
        console.log(`\nEntrada ${index + 1}:`);
        console.log(`  Agente: ${entry.agent}`);
        console.log(`  Título: ${entry.title || 'N/A'}`);
        console.log(`  Data/Hora: ${entry.rawDate}`);
        console.log(`  Status: ${entry.status}`);
        console.log(`  Remetente: ${entry.sender}`);
        console.log(`  Timestamp processado: ${entry.timestamp.toISOString()}`);

        if (index === 0) {
          console.log('  >>> ESTE É O STATUS SENDO UTILIZADO <<<');
        }
      });

      console.groupEnd();
    }
  });
  console.groupEnd();

  return currentData.map(driver => {
    let delivered = 0;
    let unsuccessful = 0;
    const successfulCodes: string[] = [];
    const unsuccessfulCodes: string[] = [];
    const senderMap: { [key: string]: string } = {};

    driver.serviceCodes.forEach(code => {
      const statusEntry = statusMap.get(code);

      if (statusEntry) {
        const { status, sender } = statusEntry;
        senderMap[code] = sender;

        if (status?.includes('sucesso') && !status?.includes('sem sucesso')) {
          delivered++;
          successfulCodes.push(code);
        } else if (status?.includes('sem sucesso')) {
          unsuccessful++;
          unsuccessfulCodes.push(code);
        }
      }
    });

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
      successfulCodes,
      unsuccessfulCodes,
      senderMap
    };
  });
}