// Configura o pdfjs-dist pra funcionar em Node.js dentro de uma função
// serverless (Vercel). Só precisa ser importado (o efeito colateral roda
// sozinho) antes de qualquer getDocument().
//
// Em Node.js, o pdfjs-dist processa o PDF de forma síncrona no próprio
// processo através de um "fake worker". Pra montar esse fake worker, ele
// primeiro confere se `globalThis.pdfjsWorker.WorkerMessageHandler` já
// existe (nesse caso usa direto) — e SÓ se não existir, tenta
// `eval("require")(GlobalWorkerOptions.workerSrc || "./pdf.worker.js")`,
// um require dinâmico ofuscado de propósito (pra bundlers não tentarem
// empacotar esse arquivo sozinhos).
//
// Isso funciona local (o node_modules inteiro está no disco), mas quebra
// numa função serverless: a etapa de rastreamento de arquivos do Next
// (@vercel/nft) não enxerga esse require dinâmico, então "pdf.worker.js"
// nunca é copiado pro pacote da função — todo PDF processado no servidor
// falha com "Setting up fake worker failed: Cannot find module
// './pdf.worker.js'".
//
// A tentativa óbvia de corrigir isso é setar GlobalWorkerOptions.workerSrc
// com o caminho resolvido via require.resolve(...) — mas o webpack do
// Next INTERCEPTA require.resolve() mesmo pra pacotes marcados como
// externos (serverComponentsExternalPackages) e substitui a chamada pelo
// ID interno do módulo (um número), não pelo caminho de arquivo de
// verdade. Isso faz o require dinâmico do pdfjs-dist falhar de um jeito
// diferente (tenta `require(74021)`, por exemplo).
//
// A saída limpa: importar o módulo do worker aqui do jeito normal (o
// webpack SIM rastreia e empacota essa dependência corretamente, porque é
// um import estático de verdade) e publicar o resultado em
// `globalThis.pdfjsWorker` — é exatamente o primeiro lugar que o pdfjs-dist
// confere antes de tentar qualquer require dinâmico, então o caminho
// problemático nunca chega a ser executado.
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.js";

let configurado = false;

export function configurarPdfWorker(): void {
  if (configurado || typeof window !== "undefined") return;
  configurado = true;
  // require() puro (não require.resolve) — o pdfjs-dist não tem
  // declaração de tipos pra esse subcaminho, e um require() dinâmico
  // continua sendo rastreado/empacotado certinho pelo webpack do Next
  // (diferente do require.resolve(), que o webpack substitui pelo ID
  // interno do módulo em vez do caminho de arquivo de verdade).
  const pdfjsWorker = require("pdfjs-dist/legacy/build/pdf.worker.js");
  (globalThis as any).pdfjsWorker = pdfjsWorker;
  // Ainda deixamos workerSrc com algo não-vazio, só por segurança — com
  // globalThis.pdfjsWorker já presente, o pdfjs-dist nem chega a ler esse
  // valor, mas evita o aviso "No GlobalWorkerOptions.workerSrc specified".
  if (!GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.js";
  }
}

configurarPdfWorker();
