// postcss.config.js
// Este archivo se usa si necesitas procesar tu CSS con PostCSS,
// por ejemplo, para añadir prefijos de proveedor con Autoprefixer.
// Si no estás usando Tailwind CSS, no necesitas el plugin de Tailwind aquí.

module.exports = { // Cambiado de 'export default' a 'module.exports'
    plugins: {
      // Autoprefixer añade prefijos de proveedor a tu CSS.
      // Ya deberías tenerlo instalado (está en tu package.json).
      // Si Vite ya maneja esto por ti o no lo necesitas, puedes incluso tener este objeto 'plugins' vacío
      // o no tener el archivo postcss.config.js, a menos que otros plugins de PostCSS sean necesarios.
      'autoprefixer': {}, // Nombre del plugin como string es más seguro
      // Si tuvieras otros plugins de PostCSS, los añadirías aquí.
      // Ejemplo:
      // 'postcss-nesting': {},
    },
  };
  