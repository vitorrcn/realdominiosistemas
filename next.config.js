/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
