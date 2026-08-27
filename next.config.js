/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfjs-dist precisa rodar com o require() nativo do Node em vez de
  // passar pelo bundle webpack do servidor — sem isso, a lógica interna
  // dele de "fake worker" (usada em Node.js, sem worker de verdade) tenta
  // um require relativo a "./pdf.worker.js" que o webpack não consegue
  // resolver, e todo endpoint que lê PDF (cadastro de empresas, Real
  // Extratos) quebra com "Setting up fake worker failed".
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist"],
  },
  webpack: (config) => {
    // pdfjs-dist (usado pra ler o PDF de cadastro de empresas) tenta
    // resolver "canvas" no build legacy, mas essa dependência opcional só
    // é usada pra renderizar páginas como imagem — a extração de texto
    // (o único uso daqui) não precisa dela. Sem isso o build falha com
    // "Module not found: Can't resolve 'canvas'".
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
