import type {
  Simulacao, SimulacaoLucroPresumido, CenarioComparativo, ComparativoMultiplo, Regime,
} from "./tipos";

function ehLp(sim: Simulacao | SimulacaoLucroPresumido): sim is SimulacaoLucroPresumido {
  return "custoTotalMes" in sim;
}

// Custo mensal total tributário de uma simulação do Simples Nacional (sem honorário/legalização).
export function custoTotalSimples(sim: Simulacao | null): number {
  if (!sim || !sim.sucesso) return 0.0;
  return sim.dasEstimado + sim.cppCompletoTotal + sim.inssProLabore;
}

// Custo mensal total tributário de uma simulação do Lucro Presumido (sem honorário/legalização).
export function custoTotalPresumido(sim: SimulacaoLucroPresumido | null): number {
  if (!sim || !sim.sucesso) return 0.0;
  return sim.custoTotalMes;
}

// Carga efetiva total do Simples Nacional em percentual (0 a 100), sobre a receita do mês.
export function aliquotaEfetivaTotalSimples(sim: Simulacao | null): number {
  if (!sim || !sim.sucesso || sim.receitaMes <= 0) return 0.0;
  return (custoTotalSimples(sim) / sim.receitaMes) * 100;
}

// Carga efetiva total do Lucro Presumido em percentual (0 a 100).
export function aliquotaEfetivaTotalPresumido(sim: SimulacaoLucroPresumido | null): number {
  if (!sim || !sim.sucesso) return 0.0;
  return sim.cargaEfetivaPercentual;
}

function montarCenario(rotulo: string, regime: Regime, sim: Simulacao | SimulacaoLucroPresumido): CenarioComparativo {
  const cen: CenarioComparativo = {
    rotulo, regime, simulacao: sim,
    identificacao: "", custoTributarioMes: 0, honorarioContabil: 0, custoLegalizacao: 0,
    custoTotalApresentacao: 0, aliquotaEfetivaTotal: 0,
  };

  if (regime === "Simples Nacional" && !ehLp(sim)) {
    cen.identificacao = sim.anexoFinal;
    cen.custoTributarioMes = custoTotalSimples(sim);
    cen.aliquotaEfetivaTotal = aliquotaEfetivaTotalSimples(sim);
  } else if (ehLp(sim)) {
    cen.identificacao = sim.labelAtividade;
    cen.custoTributarioMes = custoTotalPresumido(sim);
    cen.aliquotaEfetivaTotal = aliquotaEfetivaTotalPresumido(sim);
  }

  cen.honorarioContabil = sim.honorarioContabil || 0;
  cen.custoLegalizacao = sim.custoLegalizacao || 0;
  cen.custoTotalApresentacao = cen.custoTributarioMes + cen.honorarioContabil;

  return cen;
}

export interface EntradaComparativo {
  rotulo: string;
  regime: Regime;
  simulacao: Simulacao | SimulacaoLucroPresumido;
}

// Compara de 2 a 3 cenários, cada um podendo ser Simples Nacional ou Lucro
// Presumido, em qualquer combinação (inclusive repetindo o mesmo regime).
export function compararMultiplo(entradas: EntradaComparativo[]): ComparativoMultiplo {
  const comp: ComparativoMultiplo = {
    cenarios: [], receitaMes: 0, rotuloMaisVantajoso: "", custoMaisVantajoso: 0,
    nomeEmpresa: "", cnpj: "", atividade: "", observacoes: "", sucesso: false, erro: "",
  };

  if (entradas.length < 2) {
    comp.erro = "Selecione ao menos 2 cenários para comparar.";
    return comp;
  }
  if (entradas.length > 3) {
    comp.erro = "É possível comparar no máximo 3 cenários por vez.";
    return comp;
  }

  const receitas = new Set<number>();
  for (const { rotulo, simulacao } of entradas) {
    if (!simulacao || !simulacao.sucesso) {
      comp.erro = `O cenário '${rotulo}' não possui uma simulação válida.`;
      return comp;
    }
    receitas.add(Math.round(simulacao.receitaMes * 100) / 100);
  }

  if (receitas.size > 1) {
    comp.observacoes =
      "Atenção: os cenários comparados utilizam receitas mensais diferentes. " +
      "A comparação de carga efetiva (%) continua válida, mas os valores absolutos " +
      "não partem da mesma base de faturamento.";
  }

  for (const { rotulo, regime, simulacao } of entradas) {
    comp.cenarios.push(montarCenario(rotulo, regime, simulacao));
  }

  const primeira = entradas[0].simulacao;
  comp.receitaMes = primeira.receitaMes;
  comp.nomeEmpresa = primeira.nomeEmpresa;
  comp.cnpj = primeira.cnpj;
  comp.atividade = primeira.atividade;

  // Regime mais vantajoso = menor custo total de apresentação (tributos + honorário contábil)
  const maisVantajoso = comp.cenarios.reduce((menor, atual) =>
    atual.custoTotalApresentacao < menor.custoTotalApresentacao ? atual : menor
  );
  comp.rotuloMaisVantajoso = maisVantajoso.rotulo;
  comp.custoMaisVantajoso = maisVantajoso.custoTotalApresentacao;

  comp.sucesso = true;
  return comp;
}
