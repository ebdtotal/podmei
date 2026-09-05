import type { Company, Contact, Employee, Entry, MeiClient, PayrollRun } from "./types";
import { buildPayroll, daeDueDate, daeExpense, salaryDueDate, salaryExpense } from "./folha";
import { SALARIO_MINIMO } from "./das";

export const demoCompany: Company = {
  cnpj: "64.083.362/0001-76",
  nome: "AMANDA LINARES CASAGRANDE",
  telefone: "(18) 98163-5607",
  email: "irpf@abcdgeeg.com",
  endereco: "RUA JAGUAR",
  bairro: "JARDIM AEROPORTO II",
  cidade: "MIRANDOPOLIS",
  uf: "SP",
  tipo: "servicos",
  dataAbertura: "2025-12-16",
  capitalSocial: 5000,
  limiteFaturamento: 81000,
};

const sales = [
  ["2026-01-31", 6883],
  ["2026-02-28", 6456],
  ["2026-03-30", 6595.11],
  ["2026-04-30", 6957.03],
  ["2026-05-31", 8531],
  ["2026-06-30", 7237.37],
  ["2026-07-31", 8431],
] as const;

const das = [
  ["2026-01-20", 80.9, "DAS 12/2025"],
  ["2026-02-20", 80.9, "DAS 01/2026"],
  ["2026-03-20", 81.9, "DAS 02/2026"],
  ["2026-04-20", 81.9, "DAS 03/2026"],
  ["2026-05-20", 86.05, "DAS 04/2026"],
  ["2026-06-20", 86.05, "DAS 05/2026"],
  ["2026-07-20", 86.05, "DAS 06/2026"],
] as const;

function sale(id: string, data: string, valor: number): Entry {
  return {
    id,
    data,
    contraparte: "DIVERSOS",
    documento: "RECIBO",
    kind: "venda",
    revenueKind: "servico",
    valor,
    descricao: "SERVIÇOS",
    status: "liquidado",
    documentoFiscal: false,
    formaPagamento: "pix",
    source: "manual",
  };
}

export function demoEntries(): Entry[] {
  const entries: Entry[] = [];
  sales.forEach(([data, valor], i) => {
    entries.push(sale(`lan_sale_${i}`, data, valor));
  });
  das.forEach(([data, valor, doc], i) => {
    entries.push({
      id: `lan_das_${i}`,
      data,
      contraparte: "IMPOSTO",
      documento: doc,
      kind: "despesa",
      valor,
      descricao: "DAS MENSAL",
      status: "liquidado",
      documentoFiscal: false,
      formaPagamento: "pix",
      source: "manual",
    });
  });
  ["2026-01-02", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01"].forEach(
    (data, i) => {
      entries.push({
        id: `lan_cont_${i}`,
        data,
        contraparte: "O CONTADOR DO INVESTIDOR",
        documento: "RECIBO",
        kind: "despesa",
        valor: 150,
        descricao: "CONTABILIDADE",
        status: "liquidado",
        documentoFiscal: false,
        formaPagamento: "pix",
        source: "manual",
      });
    },
  );
  entries.push({
    id: "lan_compra_1",
    data: "2026-04-12",
    contraparte: "PAPELARIA CENTRAL",
    documento: "NF 441",
    kind: "compra",
    valor: 92.05,
    descricao: "MATERIAL DE ESCRITÓRIO",
    status: "liquidado",
    documentoFiscal: true,
    formaPagamento: "pix",
    source: "foto",
  });
  entries.push({
    id: "lan_ar_1",
    data: "2026-08-10",
    contraparte: "CLÍNICA SOLAR",
    documento: "RECIBO",
    kind: "venda",
    revenueKind: "servico",
    valor: 1800,
    descricao: "SERVIÇOS — A RECEBER",
    status: "a_receber",
    documentoFiscal: false,
    formaPagamento: "pix",
    source: "whatsapp",
    vencimento: "2026-08-25",
    contactId: "cad_am_clinica",
  });
  entries.push({
    id: "lan_ap_1",
    data: "2026-08-08",
    contraparte: "VIVO EMPRESAS",
    documento: "FATURA",
    kind: "despesa",
    valor: 129.9,
    descricao: "INTERNET",
    status: "a_pagar",
    documentoFiscal: false,
    formaPagamento: "boleto",
    source: "texto",
    vencimento: "2026-08-20",
    contactId: "cad_am_vivo",
  });
  return entries.sort((a, b) => a.data.localeCompare(b.data));
}

export const demoAccountant = {
  nome: "Carla Mendes",
  crc: "1SP-345678/O-6",
  email: "carla@contador.mei",
  telefone: "(11) 98888-0101",
  escritorio: "Mendes Contabilidade",
};

export function welcomeWhatsapp() {
  return [
    {
      id: "wa_welcome",
      from: "bot" as const,
      at: new Date().toISOString(),
      text: "Olá! Envie uma venda ou despesa em texto ou áudio. Ex.: Recebi R$ 850 de serviço da Maria no PIX, sem nota.",
    },
  ];
}

function comercioEntries(): Entry[] {
  const rows: Entry[] = [];
  (
    [
      ["2026-01-31", 9200],
      ["2026-02-28", 8800],
      ["2026-03-31", 9100],
      ["2026-04-30", 10200],
      ["2026-05-31", 9800],
      ["2026-06-30", 11100],
      ["2026-07-31", 10800],
      ["2026-08-31", 9500],
    ] as const
  ).forEach(([data, valor], i) => {
    rows.push({
      id: `jp_sale_${i}`,
      data,
      contraparte: "BALCÃO",
      documento: "CUPOM",
      kind: "venda",
      revenueKind: "comercio",
      valor,
      descricao: "REVENDA DE MERCADORIAS",
      status: "liquidado",
      documentoFiscal: false,
      formaPagamento: "pix",
      source: "manual",
    });
  });
  rows.push({
    id: "jp_compra_1",
    data: "2026-06-10",
    contraparte: "ATACADÃO CENTRAL",
    documento: "NF 8891",
    kind: "compra",
    valor: 4200,
    descricao: "MERCADORIA PARA REVENDA",
    status: "liquidado",
    documentoFiscal: true,
    formaPagamento: "boleto",
    source: "nota",
    contactId: "cad_jp_atacadao",
  });
  return rows.sort((a, b) => a.data.localeCompare(b.data));
}

function joaoEmployee(): Employee {
  return {
    id: "emp_lucas",
    nome: "LUCAS HENRIQUE ALVES",
    cpf: "000.000.001-91",
    cargo: "Vendedor",
    dataAdmissao: "2025-03-10",
    salario: SALARIO_MINIMO,
    pisoCategoria: SALARIO_MINIMO,
    valeTransporte: 220,
    jornada: "44h",
    status: "ativo",
    observacao: "Único empregado do MEI.",
  };
}

function joaoFolha(): { employee: Employee; payrolls: PayrollRun[]; entries: Entry[] } {
  const employee = joaoEmployee();
  const payrolls: PayrollRun[] = [];
  const entries: Entry[] = [];
  for (let month = 0; month <= 6; month += 1) {
    const run = buildPayroll({ employee, year: 2026, month, kind: "mensal" });
    const salaryEntry = { ...salaryExpense(run, salaryDueDate(2026, month)), id: `jp_sal_${month}` };
    const daeEntry = { ...daeExpense(run, daeDueDate(2026, month)), id: `jp_dae_${month}` };
    payrolls.push({
      ...run,
      id: `fol_jp_${month}`,
      salaryPaid: true,
      daePaid: true,
      salaryEntryId: salaryEntry.id,
      daeEntryId: daeEntry.id,
      createdAt: `2026-${String(month + 1).padStart(2, "0")}-28`,
    });
    entries.push(salaryEntry, daeEntry);
  }
  return { employee, payrolls, entries };
}

function novaMeiEntries(): Entry[] {
  return [
    {
      id: "md_sale_1",
      data: "2026-07-15",
      contraparte: "ANA PAULA",
      documento: "RECIBO",
      kind: "venda",
      revenueKind: "servico",
      valor: 1200,
      descricao: "CONSULTORIA",
      status: "liquidado",
      documentoFiscal: false,
      formaPagamento: "pix",
      source: "whatsapp",
      contactId: "cad_md_ana",
    },
    {
      id: "md_ar_1",
      data: "2026-08-20",
      contraparte: "ESCOLA NOVA",
      documento: "RECIBO",
      kind: "venda",
      revenueKind: "servico",
      valor: 2400,
      descricao: "TREINAMENTO — A RECEBER",
      status: "a_receber",
      documentoFiscal: false,
      formaPagamento: "pix",
      source: "texto",
      vencimento: "2026-09-05",
      contactId: "cad_md_escola",
    },
  ];
}

function contact(
  id: string,
  kind: Contact["kind"],
  nome: string,
  extra: Partial<Contact> = {},
): Contact {
  return {
    id,
    kind,
    nome,
    documento: extra.documento ?? "",
    telefone: extra.telefone ?? "",
    email: extra.email ?? "",
    endereco: extra.endereco ?? "",
    cidade: extra.cidade ?? "",
    uf: extra.uf ?? "SP",
    observacao: extra.observacao ?? "",
    createdAt: extra.createdAt ?? "2026-01-10",
  };
}

export function demoClients(): MeiClient[] {
  const joao = joaoFolha();
  return [
    {
      id: "mei_amanda",
      status: "ativo",
      createdAt: "2026-01-10",
      notes: "Cliente desde a abertura. Serviços, sem empregado.",
      honorario: 150,
      company: demoCompany,
      entries: demoEntries(),
      plan: "pro",
      whatsapp: welcomeWhatsapp(),
      whatsappPhone: "5518981635607",
      contacts: [
        contact("cad_am_clinica", "cliente", "CLÍNICA SOLAR", {
          documento: "23.456.789/0001-10",
          telefone: "(18) 3333-1200",
          email: "contato@clinicasolar.com",
          cidade: "MIRANDOPOLIS",
        }),
        contact("cad_am_vivo", "fornecedor", "VIVO EMPRESAS", {
          documento: "02.558.157/0001-62",
          telefone: "10315",
          email: "empresas@vivo.com.br",
          cidade: "SÃO PAULO",
        }),
        contact("cad_am_papel", "fornecedor", "PAPELARIA CENTRAL", {
          telefone: "(18) 3521-4411",
          cidade: "MIRANDOPOLIS",
        }),
        contact("cad_am_contador", "fornecedor", "O CONTADOR DO INVESTIDOR", {
          telefone: "(11) 98888-0101",
          email: "carla@contador.mei",
          cidade: "SÃO PAULO",
        }),
      ],
    },
    {
      id: "mei_joao",
      status: "ativo",
      createdAt: "2025-03-02",
      notes: "Comércio de utilidades. Um colaborador no mínimo — acompanhar teto e folha.",
      honorario: 220,
      company: {
        cnpj: "48.221.019/0001-33",
        nome: "JOÃO PEDRO FERREIRA",
        telefone: "(19) 99771-4422",
        email: "joao.ferreira@email.com",
        endereco: "RUA DAS PALMEIRAS, 120",
        bairro: "CENTRO",
        cidade: "CAMPINAS",
        uf: "SP",
        tipo: "comercio",
        dataAbertura: "2024-02-01",
        capitalSocial: 8000,
        limiteFaturamento: 81000,
        dasPerfil: "comercio",
      },
      entries: [...comercioEntries(), ...joao.entries],
      plan: "pro",
      whatsapp: welcomeWhatsapp(),
      whatsappPhone: "5519997714422",
      employee: joao.employee,
      payrolls: joao.payrolls,
      contacts: [
        contact("cad_jp_atacadao", "fornecedor", "ATACADÃO CENTRAL", {
          documento: "75.315.333/0001-09",
          telefone: "(19) 3232-9000",
          cidade: "CAMPINAS",
          createdAt: "2025-03-02",
        }),
      ],
    },
    {
      id: "mei_maria",
      status: "ativo",
      createdAt: "2026-07-01",
      notes: "Abertura recente. DAS ainda não lançado.",
      honorario: 150,
      company: {
        cnpj: "12.904.771/0001-08",
        nome: "MARIA EDUARDA SOUZA",
        telefone: "(11) 97654-2211",
        email: "maria.souza@email.com",
        endereco: "AV. PAULISTA, 900",
        bairro: "BELA VISTA",
        cidade: "SÃO PAULO",
        uf: "SP",
        tipo: "servicos",
        dataAbertura: "2026-06-18",
        capitalSocial: 1000,
        limiteFaturamento: 81000,
        dasPerfil: "servicos",
      },
      entries: novaMeiEntries(),
      plan: "pro",
      whatsapp: welcomeWhatsapp(),
      whatsappPhone: "5511976542211",
      contacts: [
        contact("cad_md_ana", "cliente", "ANA PAULA", {
          documento: "123.456.789-09",
          telefone: "(11) 98888-2211",
          email: "ana.paula@email.com",
          cidade: "SÃO PAULO",
          createdAt: "2026-07-01",
        }),
        contact("cad_md_escola", "cliente", "ESCOLA NOVA", {
          documento: "11.222.333/0001-44",
          telefone: "(11) 3003-2020",
          email: "financeiro@escolanova.com",
          cidade: "SÃO PAULO",
          createdAt: "2026-07-01",
        }),
      ],
    },
  ];
}
