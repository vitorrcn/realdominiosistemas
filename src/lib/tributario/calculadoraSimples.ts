import { TABELAS, DESCRICAO_ANEXOS, LIMITE_SIMPLES, type NomeAnexo, type FaixaSimples } from "./anexos";
import { INSS_PRO_LABORE_ALIQUOTA, TETO_INSS_2026, CPP_PATRONAL_PRO_LABORE_ALIQUOTA } from "./lucroPresumido";
import { novaSimulacaoVazia, type Simulacao } from "./tipos";

function encontrarFaixa(rbt12: number, tabela: FaixaSimples[]): FaixaSimples | null {
  for (const faixa of tabela) {
    if (rbt12 <= faixa.limite) return faixa;
  }
  return null;
}

function calcularAliquotaEfetiva(rbt12: number, aliquota: number, pd: number): number {
  return (rbt12 * aliquota - pd) / rbt12;
}

function calcularDas(receitaMes: number, aliquotaEfetiva: number): number {
  return receitaMes * aliquotaEfetiva;
}

function calcularFatorR(folha12m: number, rbt12: number): number {
  if (rbt12 === 0) return 0.0;
  return folha12m / rbt12;
}

function definirAnexoPeloFatorR(fatorR: number): NomeAnexo {
  return fatorR >= 0.28 ? "Anexo III" : "Anexo V";
}

// 11% sobre o pró-labore, limitado ao teto do INSS. Devido em qualquer regime (cota do sócio).
function calcularInssProLabore(proLabore: number): number {
  if (proLabore <= 0) return 0.0;
  const base = Math.min(proLabore, TETO_INSS_2026);
  return base * INSS_PRO_LABORE_ALIQUOTA;
}

// 20% de CPP patronal sobre o pró-labore. Nos Anexos I, II, III e V já está
// embutida no DAS (não soma nada a mais). No Anexo IV, é recolhida por
// fora, junto com o CPP da folha de empregados.
function calcularCppPatronalProLabore(proLabore: number): number {
  if (proLabore <= 0) return 0.0;
  return proLabore * CPP_PATRONAL_PRO_LABORE_ALIQUOTA;
}

export interface EntradaSimples {
  anexo: NomeAnexo;
  rbt12: number;
  receitaMes: number;
  folha12m?: number | null; // presente = Fator R ativo (checkbox marcado)
  nomeEmpresa?: string;
  cnpj?: string;
  atividade?: string;
  proLabore?: number;
  folhaParaCpp?: number;
  aliquotaCppPatronal?: number;
  aliquotaRat?: number;
  aliquotaTerceiros?: number;
  observacoes?: string;
}

export function calcularSimples(entrada: EntradaSimples): Simulacao {
  const sim = novaSimulacaoVazia();
  const {
    anexo, rbt12, receitaMes,
    folha12m = null,
    nomeEmpresa = "", cnpj = "", atividade = "",
    proLabore = 0, folhaParaCpp = 0,
    aliquotaCppPatronal = 0.2, aliquotaRat = 0.02, aliquotaTerceiros = 0.058,
    observacoes = "",
  } = entrada;

  sim.nomeEmpresa = nomeEmpresa;
  sim.cnpj = cnpj;
  sim.atividade = atividade;
  sim.anexo = anexo;
  sim.descricaoAnexo = DESCRICAO_ANEXOS[anexo] ?? "";
  sim.rbt12 = rbt12;
  sim.receitaMes = receitaMes;
  sim.folha12m = folha12m;
  sim.anexoOriginal = anexo;
  sim.anexoFinal = anexo;
  sim.proLabore = proLabore;
  sim.observacoes = observacoes;

  if (rbt12 <= 0) {
    sim.erro = "A Receita Bruta dos Últimos 12 Meses deve ser maior que zero.";
    return sim;
  }
  if (rbt12 > LIMITE_SIMPLES) {
    sim.erro = `RBT12 (R$ ${rbt12.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) ultrapassa o limite do Simples Nacional (R$ ${LIMITE_SIMPLES.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`;
    return sim;
  }
  if (receitaMes <= 0) {
    sim.erro = "A Receita do Mês de Apuração deve ser maior que zero.";
    return sim;
  }

  // Fator R: apenas se folha12m foi informada (usuário marcou o checkbox)
  if (folha12m !== null) {
    sim.usaFatorR = true;
    const fatorR = calcularFatorR(folha12m, rbt12);
    sim.fatorR = fatorR;
    sim.fatorRPercentual = fatorR * 100;
    const anexoCalculado = definirAnexoPeloFatorR(fatorR);
    sim.anexoFinal = anexoCalculado;
    sim.tributadoPeloAnexoIii = anexoCalculado === "Anexo III";
  } else {
    sim.usaFatorR = false;
    sim.anexoFinal = anexo;
  }

  const tabela = TABELAS[sim.anexoFinal as NomeAnexo];
  if (!tabela) {
    sim.erro = `Tabela não encontrada para ${sim.anexoFinal}.`;
    return sim;
  }

  const faixaDados = encontrarFaixa(rbt12, tabela);
  if (!faixaDados) {
    sim.erro = "RBT12 fora das faixas permitidas pelo Simples Nacional.";
    return sim;
  }

  sim.faixa = faixaDados.faixa;
  sim.aliquotaNominal = faixaDados.aliquota;
  sim.parcelaDedutivel = faixaDados.pd;

  sim.aliquotaEfetiva = calcularAliquotaEfetiva(rbt12, sim.aliquotaNominal, sim.parcelaDedutivel);
  sim.dasEstimado = calcularDas(receitaMes, sim.aliquotaEfetiva);

  // CPP fora do DAS: apenas Anexo IV recolhe a Contribuição Patronal por fora
  sim.cppForaDoDas = sim.anexoFinal === "Anexo IV";
  sim.folhaParaCpp = folhaParaCpp;
  sim.aliquotaCppPatronal = aliquotaCppPatronal;
  sim.aliquotaRat = aliquotaRat;
  sim.aliquotaTerceiros = aliquotaTerceiros;

  if (sim.cppForaDoDas && folhaParaCpp > 0) {
    sim.cppPatronalTotal = folhaParaCpp * aliquotaCppPatronal;
    sim.ratTotal = folhaParaCpp * aliquotaRat;
    sim.terceirosTotal = folhaParaCpp * aliquotaTerceiros;
    sim.cppCompletoTotal = sim.cppPatronalTotal + sim.ratTotal + sim.terceirosTotal;
  } else {
    sim.cppPatronalTotal = 0;
    sim.ratTotal = 0;
    sim.terceirosTotal = 0;
    sim.cppCompletoTotal = 0;
  }

  // CPP Patronal sobre Pró-labore (20%) - embutida no DAS nos Anexos I, II,
  // III e V. Só o Anexo IV recolhe por fora.
  if (sim.cppForaDoDas) {
    sim.cppPatronalProLabore = calcularCppPatronalProLabore(proLabore);
    sim.cppCompletoTotal += sim.cppPatronalProLabore;
  } else {
    sim.cppPatronalProLabore = 0;
  }

  // INSS sobre Pró-labore (cota do sócio, 11%, devido em qualquer anexo)
  sim.inssProLabore = calcularInssProLabore(proLabore);

  sim.sucesso = true;
  return sim;
}

export interface MesProjetado {
  mes: string; // ex: "set/26"
  rbt12: number;
  faixa: number | "—";
  aliquotaNominal: number;
  aliquotaEfetiva: number;
  anexoFinal: string;
  das: number;
  sucesso: boolean;
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Projeta os próximos 12 meses mantendo a mesma receita mensal.
//
// Lógica do RBT12:
// - A cada mês, o mês mais antigo do histórico sai e o novo entra.
// - Como o faturamento é constante, assumimos que o mês que sai
//   equivale a 1/12 do RBT12 atual.
// - Após 12 meses, o RBT12 estabiliza em receitaMes x 12.
export function projetarSimples12Meses(sim: Simulacao): MesProjetado[] {
  const projecao: MesProjetado[] = [];
  const receitaMes = sim.receitaMes;
  let rbt12Atual = sim.rbt12;
  const hoje = new Date();

  for (let i = 1; i <= 12; i++) {
    const totalMes = hoje.getMonth() + i; // 0-indexed
    const ano = hoje.getFullYear() + Math.floor(totalMes / 12);
    const mes = totalMes % 12;
    const nomeMes = `${MESES_ABREV[mes]}/${String(ano).slice(-2)}`;

    const rbt12Proj = rbt12Atual - rbt12Atual / 12 + receitaMes;
    rbt12Atual = rbt12Proj;

    const folhaProjetada = sim.usaFatorR ? sim.folha12m : null;

    const resultado = calcularSimples({
      anexo: sim.anexo as NomeAnexo,
      rbt12: rbt12Proj,
      receitaMes,
      folha12m: folhaProjetada,
    });

    projecao.push({
      mes: nomeMes,
      rbt12: rbt12Proj,
      faixa: resultado.sucesso ? resultado.faixa : "—",
      aliquotaNominal: resultado.sucesso ? resultado.aliquotaNominal : 0,
      aliquotaEfetiva: resultado.sucesso ? resultado.aliquotaEfetiva : 0,
      anexoFinal: resultado.sucesso ? resultado.anexoFinal : sim.anexo,
      das: resultado.sucesso ? resultado.dasEstimado : 0,
      sucesso: resultado.sucesso,
    });
  }

  return projecao;
}
